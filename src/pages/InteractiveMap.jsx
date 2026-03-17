import { useEffect, useRef, useState, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Supercluster from 'supercluster'
import { useLazyExternalSource } from '../data/externalData'
import { GEOJSON_LAYERS } from '../data/geojsonLayers'
import { getTracksNoisePoints, getNoiseStatsByLocation, getNoiseStatsByWeek, getNoiseStatsByLocationAndTime, TRACKS_LOCATIONS, getParkCentroids } from '../data/tracksLoader'
import { pointsToHexGeoJSON, pointsToHexGeoJSONWithValue, zoomToH3Resolution } from '../utils/noiseHexGrid'
import DetailPanel from '../components/DetailPanel'
import InteractiveTimeline from '../components/InteractiveTimeline'
import MapLayersPanel from '../components/MapLayersPanel'
import { getTimeRange, filterItemsByRange, extendTimeRangeByOneYear } from '../utils/datetime'
import { getItemPrimaryColor } from '../utils/categoryColors'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAP_STYLE_LIGHT = 'mapbox://styles/ikerluna/cmmp9964u005401rzhlycalmk'
const MAP_STYLE_DARK = 'mapbox://styles/ikerluna/cmmp97lzz001o01s46t647djn'

const NOISE_SOURCE_ID = 'noise-hexagons'
const NOISE_LAYER_ID = 'noise-hexagons-fill'
const NOISE_COLOR_STOPS = [
  [40, '#2ecc71'],
  [50, '#a8e06c'],
  [55, '#f1c40f'],
  [65, '#f39c12'],
  [75, '#e67e22'],
  [85, '#c0392b'],
  [95, '#922b21'],
]

const GOOGLE_HEX_SOURCE_ID = 'google-review-hexagons'
const GOOGLE_HEX_LAYER_ID = 'google-review-hexagons-fill'
const GOOGLE_REVIEW_COLOR_STOPS = [
  [1, '#c0392b'],
  [2, '#e67e22'],
  [3, '#f1c40f'],
  [4, '#a8e06c'],
  [5, '#2ecc71'],
]

const MAP_LAYERS = [
  ...GEOJSON_LAYERS,
  { id: 'noise-hex', name: 'Mapa de ruido' },
  { id: 'google-hex', name: 'Google Review (hex)' },
]

const DATA_SOURCE_OPTIONS = [
  { key: 'airbnb', label: 'Airbnb' },
  { key: 'google-review-hex', label: 'Google Review' },
  { key: 'noticias', label: 'Noticias' },
  { key: 'noise', label: 'Ruido' },
]

const CLUSTER_THRESHOLD = 80
const CLUSTER_RADIUS = 60
const CLUSTER_MAX_ZOOM = 16

/** Simple deterministic hash from string (for jitter seed). */
function hashSeed(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Small deterministic offset so pins at the same location spread slightly and stay clickable.
 * Offset ~±0.0001° (~10–15 m); same item always gets the same position.
 */
function jitterCoordinates(lat, lng, seed) {
  const s1 = hashSeed(seed)
  const s2 = hashSeed(seed + 'x')
  const jitterLat = ((s1 % 200) / 100 - 1) * 0.0001
  const jitterLng = ((s2 % 200) / 100 - 1) * 0.0001
  return { lat: lat + jitterLat, lng: lng + jitterLng }
}

/** Pin SVG by source: 'airbnb' (casa), 'noticias' (documento), default (pin ubicación). Cache por (source, color) para crear marcadores más rápido. */
const pinSvgCache = new Map()
function getPinSvgBySource(source, color) {
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#95a5a6'
  const key = `${source || 'default'}-${safeColor}`
  if (pinSvgCache.has(key)) return pinSvgCache.get(key)
  const stroke = 'rgba(255,255,255,0.9)'
  let svg
  if (source === 'airbnb') {
    svg = `<svg class="map-marker-icon map-marker-icon-airbnb" viewBox="0 0 24 24" aria-hidden="true"><path fill="${safeColor}" stroke="${stroke}" stroke-width="1.2" d="M12 2L3 10v12h6v-7h6v7h6V10L12 2z"/></svg>`
  } else if (source === 'noticias') {
    svg = `<svg class="map-marker-icon map-marker-icon-noticias" viewBox="0 0 24 24" aria-hidden="true"><path fill="${safeColor}" stroke="${stroke}" stroke-width="1.2" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-5-5V3.5L18.5 9H11z"/></svg>`
  } else if (source === 'google-review') {
    svg = `<svg class="map-marker-icon" viewBox="0 0 24 36" aria-hidden="true"><path fill="${safeColor}" stroke="${stroke}" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>`
  } else {
    svg = `<svg class="map-marker-icon" viewBox="0 0 24 36" aria-hidden="true"><path fill="${safeColor}" stroke="${stroke}" stroke-width="1.5" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0zm0 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>`
  }
  pinSvgCache.set(key, svg)
  return svg
}

function createMapMarker(item, map, onSelect, options = {}) {
  if (!item?.coordinates || item.coordinates.lat == null || item.coordinates.lng == null) return null
  const { useJitter = false, source } = options
  const base = item.coordinates
  const { lat, lng } = useJitter
    ? jitterCoordinates(base.lat, base.lng, item.id)
    : { lat: base.lat, lng: base.lng }
  const el = document.createElement('div')
  el.className = 'map-marker'
  const color = (typeof getItemPrimaryColor === 'function' ? getItemPrimaryColor(item) : '#95a5a6') || '#95a5a6'
  el.innerHTML = getPinSvgBySource(source, color)
  el.dataset.id = item.id
  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([lng, lat])
    .addTo(map)
  el.addEventListener('click', () => onSelect(item))
  return marker
}

function createClusterMarker(cluster, map, onSelect, options = {}) {
  const [lng, lat] = cluster.geometry.coordinates
  const count = cluster.properties?.point_count ?? 0
  const isCluster = cluster.properties?.cluster === true
  const el = document.createElement('div')
  el.className = 'map-marker map-marker-cluster'
  el.innerHTML = `<span class="map-marker-cluster-count">${count}</span>`
  const marker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
  el.addEventListener('click', () => {
    if (isCluster && options.onClusterClick) options.onClusterClick(cluster)
    else if (cluster.properties?.item) onSelect(cluster.properties.item)
  })
  return marker
}

function geometryTypeToMapboxLayer(geomType) {
  const t = (geomType || '').toLowerCase()
  if (t === 'point' || t === 'multipoint') return 'circle'
  if (t === 'linestring' || t === 'multilinestring') return 'line'
  if (t === 'polygon' || t === 'multipolygon') return 'fill'
  return 'line'
}

async function addGeojsonLayer(map, layerConfig, visible) {
  const sourceId = `geojson-${layerConfig.id}`
  const layerId = `geojson-${layerConfig.id}-layer`
  try {
    const res = await fetch(layerConfig.url)
    if (!res.ok) throw new Error(res.statusText)
    const geojson = await res.json()
    const firstType =
      geojson?.features?.[0]?.geometry?.type ?? (layerConfig.type === 'point' ? 'Point' : 'Polygon')
    const layerType = layerConfig.type === 'point' ? 'circle' : geometryTypeToMapboxLayer(firstType)

    const outlineLayerId = `${layerId}-line`
    if (map.getSource(sourceId)) {
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId)
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      map.removeSource(sourceId)
    }

    map.addSource(sourceId, { type: 'geojson', data: geojson })
    const visibility = visible ? 'visible' : 'none'

    const c = layerConfig

    if (layerType === 'circle') {
      map.addLayer(
        {
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: {
            'circle-radius': c.pointRadius ?? 6,
            'circle-color': c.pointColor ?? '#2563eb',
            'circle-stroke-width': c.pointStrokeWidth ?? 1,
            'circle-stroke-color': c.pointStrokeColor ?? '#fff',
          },
          layout: { visibility },
        },
        undefined
      )
    } else if (layerType === 'line') {
      const linePaint = {
        'line-color': c.lineColor ?? '#2563eb',
        'line-width': c.lineWidth ?? 2,
      }
      if (c.lineDasharray && c.lineDasharray.length) linePaint['line-dasharray'] = c.lineDasharray
      map.addLayer(
        {
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: linePaint,
          layout: { visibility },
        },
        undefined
      )
    } else {
      map.addLayer(
        {
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': c.fillColor ?? '#2563eb',
            'fill-opacity': c.fillOpacity ?? 0.35,
            'fill-outline-color': c.fillOutlineColor ?? '#1d4ed8',
          },
          layout: { visibility },
        },
        undefined
      )
      if (c.lineDasharray && c.lineDasharray.length) {
        map.addLayer(
          {
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': c.lineColor ?? c.fillOutlineColor ?? '#1d4ed8',
              'line-width': c.lineWidth ?? 2,
              'line-dasharray': c.lineDasharray,
            },
            layout: { visibility },
          },
          undefined
        )
      }
    }
    return layerId
  } catch (err) {
    console.warn('GeoJSON layer failed:', layerConfig.id, err)
    return null
  }
}

function ensureNoiseHexLayer(map, visible) {
  if (!map.getSource(NOISE_SOURCE_ID)) {
    map.addSource(NOISE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    let firstSymbolId
    try {
      const style = map.getStyle()
      firstSymbolId = style?.layers?.find((l) => l.type === 'symbol')?.id
    } catch (_) {
      firstSymbolId = undefined
    }
    map.addLayer(
      {
        id: NOISE_LAYER_ID,
        type: 'fill',
        source: NOISE_SOURCE_ID,
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'meanLeq'], 40],
            ...NOISE_COLOR_STOPS.flat(),
          ],
          'fill-opacity': 0.75,
          'fill-outline-color': 'rgba(0,0,0,0.4)',
        },
        layout: { visibility: visible ? 'visible' : 'none' },
      },
      firstSymbolId
    )
  } else if (map.getLayer(NOISE_LAYER_ID)) {
    map.setLayoutProperty(NOISE_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }
}

function updateNoiseHexLayer(map) {
  if (!map.getSource(NOISE_SOURCE_ID)) return
  const points = getTracksNoisePoints()
  const zoom = map.getZoom()
  const res = zoomToH3Resolution(zoom)
  const geojson = points.length > 0
    ? pointsToHexGeoJSON(points, res, null)
    : { type: 'FeatureCollection', features: [] }
  map.getSource(NOISE_SOURCE_ID).setData(geojson)
}

function ensureGoogleHexLayer(map, visible) {
  if (!map || !map.getSource) return
  try {
    if (!map.getSource(GOOGLE_HEX_SOURCE_ID)) {
      map.addSource(GOOGLE_HEX_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      let firstSymbolId
      try {
        const style = map.getStyle()
        firstSymbolId = style?.layers?.find((l) => l.type === 'symbol')?.id
      } catch (_) {
        firstSymbolId = undefined
      }
      map.addLayer(
      {
        id: GOOGLE_HEX_LAYER_ID,
        type: 'fill',
        source: GOOGLE_HEX_SOURCE_ID,
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'meanScore'], 3],
            1, '#c0392b',
            2, '#e67e22',
            3, '#f1c40f',
            4, '#a8e06c',
            5, '#2ecc71',
          ],
          'fill-opacity': 0.8,
          'fill-outline-color': 'rgba(0,0,0,0.35)',
        },
        layout: { visibility: visible ? 'visible' : 'none' },
      },
      firstSymbolId
      )
    } else if (map.getLayer(GOOGLE_HEX_LAYER_ID)) {
      map.setLayoutProperty(GOOGLE_HEX_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
    }
  } catch (_) {
    // style not ready or layer add failed
  }
}

// Desactivar por completo los hexágonos de Google Review para evitar errores de datos.
function updateGoogleHexLayer() {
  return
}

export default function InteractiveMap({ theme = 'light' }) {
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const geojsonLayerIdsRef = useRef([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [visibleLayerIds, setVisibleLayerIds] = useState([])
  const [timelineScale, setTimelineScale] = useState('month')
  const [dataSource, setDataSource] = useState('airbnb')
  const [viewRange, setViewRange] = useState({ min: 0, max: 0 })
  const [selectedGoogleCommentId, setSelectedGoogleCommentId] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [containerReady, setContainerReady] = useState(false)

  const airbnbData = useLazyExternalSource('airbnb')
  const googleData = useLazyExternalSource('google-review')
  const noticiasData = useLazyExternalSource('noticias')

  const airbnbEventsWithCoords = airbnbData.eventsWithCoords ?? []
  const googleReviewEventsWithCoords = googleData.eventsWithCoords ?? []
  const noticiasEventsWithCoords = noticiasData.eventsWithCoords ?? []

  const AIRBNB_STAR_IDS = airbnbData.module?.AIRBNB_STAR_IDS ?? []
  const AIRBNB_STAR_ASSOCIATIONS = airbnbData.module?.AIRBNB_STAR_ASSOCIATIONS ?? []
  const NOTICIAS_ASSOCIATION_IDS = noticiasData.module?.NOTICIAS_ASSOCIATION_IDS ?? []
  const NOTICIAS_ASSOCIATIONS = noticiasData.module?.NOTICIAS_ASSOCIATIONS ?? []
  const getNoticiasSourceLinks = noticiasData.module?.getNoticiasSourceLinks ?? (() => [])
  const GOOGLE_REVIEW_ASSOCIATION_IDS = googleData.module?.GOOGLE_REVIEW_ASSOCIATION_IDS ?? []
  const GOOGLE_REVIEW_ASSOCIATIONS = googleData.module?.GOOGLE_REVIEW_ASSOCIATIONS ?? []
  const getGoogleReviewSourceLinks = googleData.module?.getGoogleReviewSourceLinks ?? (() => [])
  const getGoogleReviewStatsByLocation = () => googleData.module?.getGoogleReviewStatsByLocation?.() ?? []
  const getGoogleReviewStatsByLocationAndTime = () => googleData.module?.getGoogleReviewStatsByLocationAndTime?.() ?? []
  const getScoreFromEvent = (e) => googleData.module?.getScoreFromEvent?.(e) ?? 3
  const getYearFromEvent = (e) => googleData.module?.getYearFromEvent?.(e) ?? null
  const getStarsDisplay = (s) => googleData.module?.getStarsDisplay?.(s) ?? '★★★☆☆'

  const noisePoints = useMemo(() => {
    try {
      return getTracksNoisePoints()
    } catch (_) {
      return []
    }
  }, [])
  const hasNoiseData = noisePoints.length > 0
  const googleHexPoints = useMemo(() => {
    try {
      return googleData.module?.getGoogleReviewHexPoints?.() ?? []
    } catch (_) {
      return []
    }
  }, [googleData.module])
  const hasGoogleHexData = googleHexPoints.length > 0

  useEffect(() => {
    const el = mapContainer.current
    if (!el) return
    const check = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setContainerReady(true)
        return true
      }
      return false
    }
    if (check()) return
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (check()) ro.disconnect()
          })
        : null
    if (ro) ro.observe(el)
    let intervalId = null
    if (typeof setInterval !== 'undefined') {
      intervalId = setInterval(() => {
        if (check()) {
          if (intervalId) clearInterval(intervalId)
          if (ro) ro.disconnect()
        }
      }, 50)
    }
    const fallbackId = setTimeout(() => {
      if (mapContainer.current && !check()) setContainerReady(true)
    }, 400)
    return () => {
      if (ro) ro.disconnect()
      if (intervalId) clearInterval(intervalId)
      clearTimeout(fallbackId)
    }
  }, [])

  useEffect(() => {
    if (dataSource !== 'google-review-hex') setSelectedGoogleCommentId(null)
  }, [dataSource])

  useEffect(() => {
    if (dataSource !== 'google-review-hex' || !mapRef.current || !hasGoogleHexData) return
    const map = mapRef.current
    const t = setTimeout(() => {
      if (map.isStyleLoaded && map.isStyleLoaded()) {
        ensureGoogleHexLayer(map, true)
        updateGoogleHexLayer(map, googleHexPoints)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [dataSource, hasGoogleHexData])

  const { itemsWithDatetime, itemsWithDatetimeAndCoords, fullRange } = useMemo(() => {
    if (dataSource === 'noise' || dataSource === 'google-review-hex') {
      return {
        itemsWithDatetime: [],
        itemsWithDatetimeAndCoords: [],
        fullRange: { min: 0, max: 0 },
      }
    }
    const raw =
      dataSource === 'airbnb'
        ? airbnbEventsWithCoords
        : dataSource === 'noticias'
          ? noticiasEventsWithCoords
          : []
    const itemsDtCoords = Array.isArray(raw) ? raw : []
    const range = getTimeRange(itemsDtCoords)
    return {
      itemsWithDatetime: itemsDtCoords,
      itemsWithDatetimeAndCoords: itemsDtCoords,
      fullRange: extendTimeRangeByOneYear(range),
    }
  }, [dataSource, airbnbEventsWithCoords, noticiasEventsWithCoords, googleReviewEventsWithCoords])

  useEffect(() => {
    setViewRange({ min: fullRange.min, max: fullRange.max })
  }, [fullRange.min, fullRange.max])

  const visibleItems = useMemo(
    () => filterItemsByRange(itemsWithDatetime, viewRange.min, viewRange.max),
    [itemsWithDatetime, viewRange.min, viewRange.max]
  )

  /** Indexación por id para lookups O(1) en filtros y detalle */
  const eventsById = useMemo(() => {
    const byId = {}
    if (!Array.isArray(itemsWithDatetimeAndCoords)) return byId
    itemsWithDatetimeAndCoords.forEach((item) => {
      if (item?.id != null) byId[item.id] = item
    })
    return byId
  }, [itemsWithDatetimeAndCoords])

  /** Clustering: solo cuando hay muchos puntos para no crear cientos de marcadores */
  const clusterIndexRef = useRef(null)
  const clusterIndex = null

  const useJitter = dataSource === 'noticias'

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    if (item?.coordinates && mapRef.current) {
      const [lng, lat] = [item.coordinates.lng, item.coordinates.lat]
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
    }
  }

  useEffect(() => {
    if (selectedItem && !visibleItems.some((i) => i.id === selectedItem.id)) {
      setSelectedItem(null)
    }
  }, [visibleItems, selectedItem])

  const handleSelectRef = useRef(handleSelectItem)
  handleSelectRef.current = handleSelectItem
  const visibleLayerIdsRef = useRef(visibleLayerIds)
  visibleLayerIdsRef.current = visibleLayerIds
  const dataSourceRef = useRef(dataSource)
  dataSourceRef.current = dataSource

  useEffect(() => {
    setMapError(null)
    if (!containerReady || !MAPBOX_TOKEN || !mapContainer.current) return

    let map
    let resizeObserver = null
    let containerEl = null
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN

      const bounds = new mapboxgl.LngLatBounds()
      if (itemsWithDatetimeAndCoords.length > 0) {
        itemsWithDatetimeAndCoords.forEach((item) => {
          if (item?.coordinates?.lat != null && item?.coordinates?.lng != null) {
            bounds.extend([item.coordinates.lng, item.coordinates.lat])
          }
        })
      }
      if (noisePoints.length > 0) {
        noisePoints.forEach((p) => {
          if (p && p.lat != null && p.lng != null) {
            bounds.extend([p.lng, p.lat])
          }
        })
      }
      if (googleHexPoints.length > 0) {
        googleHexPoints.forEach((p) => {
          if (p && p.lat != null && p.lng != null) {
            bounds.extend([p.lng, p.lat])
          }
        })
      }

      const hasValidBounds =
        bounds.getWest() !== bounds.getEast() && bounds.getSouth() !== bounds.getNorth()

      if (hasValidBounds) {
        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: mapStyle,
          bounds,
          fitBoundsOptions: { padding: 50, maxZoom: 10 },
        })
      } else {
        const center = itemsWithDatetimeAndCoords.length > 0 && itemsWithDatetimeAndCoords[0].coordinates
          ? [itemsWithDatetimeAndCoords[0].coordinates.lng, itemsWithDatetimeAndCoords[0].coordinates.lat]
          : noisePoints.length > 0
            ? [noisePoints[0].lng, noisePoints[0].lat]
            : googleHexPoints.length > 0
              ? [googleHexPoints[0].lng, googleHexPoints[0].lat]
              : [-84.1, 9.93]
        map = new mapboxgl.Map({
          container: mapContainer.current,
          style: mapStyle,
          center: Array.isArray(center) ? center : [-84.1, 9.93],
          zoom: 10,
        })
      }

      mapRef.current = map
      geojsonLayerIdsRef.current = []

      containerEl = mapContainer.current
      if (typeof ResizeObserver !== 'undefined' && containerEl) {
        resizeObserver = new ResizeObserver(() => {
          try {
            if (mapRef.current) mapRef.current.resize()
          } catch (_) {}
        })
        resizeObserver.observe(containerEl)
      }

      const onSelect = (item) => handleSelectRef.current(item)

      map.once('load', () => {
        requestAnimationFrame(() => {
          try {
            if (mapRef.current) mapRef.current.resize()
          } catch (_) {}
        })
      const updateNoiseIfVisible = () => {
        if (visibleLayerIdsRef.current.includes('noise-hex') || dataSourceRef.current === 'noise') {
          updateNoiseHexLayer(map)
        }
      }
      const updateGoogleHexIfVisible = () => {
        if (visibleLayerIdsRef.current.includes('google-hex') || dataSourceRef.current === 'google-review-hex') {
          updateGoogleHexLayer(map, googleHexPoints)
        }
      }
      let zoomThrottle = null
      const updateHexThrottled = () => {
        if (zoomThrottle) return
        zoomThrottle = setTimeout(() => {
          zoomThrottle = null
          updateNoiseIfVisible()
          updateGoogleHexIfVisible()
        }, 120)
      }
      map.on('moveend', () => {
        updateNoiseIfVisible()
        updateGoogleHexIfVisible()
      })
      map.on('zoom', updateHexThrottled)
      map.on('zoomend', () => {
        updateNoiseIfVisible()
        updateGoogleHexIfVisible()
      })

      GEOJSON_LAYERS.forEach((cfg) => {
        const visible = visibleLayerIdsRef.current.includes(cfg.id)
        addGeojsonLayer(map, cfg, visible).then((layerId) => {
          if (layerId) {
            geojsonLayerIdsRef.current.push(layerId)
            const nowVisible = visibleLayerIdsRef.current.includes(cfg.id)
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', nowVisible ? 'visible' : 'none')
            }
          }
        })
      })

      const showNoise = visibleLayerIdsRef.current.includes('noise-hex') || dataSourceRef.current === 'noise'
      if (showNoise) {
        ensureNoiseHexLayer(map, true)
        updateNoiseHexLayer(map)
      } else {
        ensureNoiseHexLayer(map, false)
      }
      const showGoogleHex = visibleLayerIdsRef.current.includes('google-hex')
      if (showGoogleHex) {
        ensureGoogleHexLayer(map, true)
        updateGoogleHexLayer(map, googleHexPoints)
      }
      setTimeout(() => {
        updateNoiseIfVisible()
        updateGoogleHexIfVisible()
      }, 200)
    })

      map.on('error', (e) => {
        setMapError(e.error?.message || 'Error al cargar el mapa')
      })
    } catch (err) {
      setMapError(err?.message || 'Error al inicializar el mapa')
      return
    }

    return () => {
      if (resizeObserver && containerEl) {
        try {
          resizeObserver.disconnect()
        } catch (_) {}
      }
      markersRef.current.forEach((m) => m?.remove?.())
      markersRef.current = []
      if (map) {
        try {
          map.remove()
        } catch (_) {}
      }
      mapRef.current = null
      geojsonLayerIdsRef.current = []
    }
  }, [containerReady])

  const isInitialMount = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    map.setStyle(mapStyle)
    map.once('style.load', () => {
      if (!mapRef.current) return
      const updateNoiseIfVisible = () => {
        if (visibleLayerIdsRef.current.includes('noise-hex') || dataSourceRef.current === 'noise') {
          updateNoiseHexLayer(map)
        }
      }
      const updateGoogleHexIfVisible = () => {
        if (visibleLayerIdsRef.current.includes('google-hex') || dataSourceRef.current === 'google-review-hex') {
          updateGoogleHexLayer(map, googleHexPoints)
        }
      }
      let zoomThrottle = null
      const updateHexThrottled = () => {
        if (zoomThrottle) return
        zoomThrottle = setTimeout(() => {
          zoomThrottle = null
          updateNoiseIfVisible()
          updateGoogleHexIfVisible()
        }, 120)
      }
      map.on('moveend', () => {
        updateNoiseIfVisible()
        updateGoogleHexIfVisible()
      })
      map.on('zoom', updateHexThrottled)
      map.on('zoomend', () => {
        updateNoiseIfVisible()
        updateGoogleHexIfVisible()
      })

      const onSelect = (item) => handleSelectRef.current(item)
      const getPinSource = (item) =>
        dataSourceRef.current === 'airbnb'
          ? 'airbnb'
          : dataSourceRef.current === 'noticias'
            ? 'noticias'
            : undefined
      markersRef.current.forEach((m) => m.remove())
      const markers = itemsWithDatetimeAndCoords
        .map((item) => createMapMarker(item, map, onSelect, { useJitter, source: getPinSource(item) }))
        .filter(Boolean)
      markersRef.current = markers
      geojsonLayerIdsRef.current = []
      GEOJSON_LAYERS.forEach((cfg) => {
        const visible = visibleLayerIdsRef.current.includes(cfg.id)
        addGeojsonLayer(map, cfg, visible).then((layerId) => {
          if (layerId) {
            geojsonLayerIdsRef.current.push(layerId)
            const nowVisible = visibleLayerIdsRef.current.includes(cfg.id)
            if (map.getLayer(layerId)) {
              map.setLayoutProperty(layerId, 'visibility', nowVisible ? 'visible' : 'none')
            }
          }
        })
      })

      const showNoise = visibleLayerIdsRef.current.includes('noise-hex') || dataSourceRef.current === 'noise'
      if (showNoise) {
        ensureNoiseHexLayer(map, true)
        updateNoiseHexLayer(map)
      }
      const showGoogleHex = visibleLayerIdsRef.current.includes('google-hex') || dataSourceRef.current === 'google-review-hex'
      if (showGoogleHex) {
        ensureGoogleHexLayer(map, true)
        updateGoogleHexLayer(map, googleHexPoints)
      }
    })
  }, [mapStyle, containerReady])

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((i) => i.id))
    markersRef.current.forEach((marker) => {
      const el = marker.getElement()
      if (!el) return
      const id = el.dataset?.id
      if (id == null) {
        el.style.display = ''
        return
      }
      el.style.display = visibleIds.has(id) ? '' : 'none'
    })
  }, [visibleItems])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    if (dataSource === 'noise') {
      if (noisePoints.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        noisePoints.forEach((p) => {
          if (p && p.lat != null && p.lng != null) {
            bounds.extend([p.lng, p.lat])
          }
        })
        if (bounds.getNorth() !== bounds.getSouth() || bounds.getWest() !== bounds.getEast()) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 600 })
        }
        ensureNoiseHexLayer(map, true)
        updateNoiseHexLayer(map)
      }
      return
    }
    if (dataSource === 'google-review-hex') {
      const centroids = getParkCentroids()
      const byId = Array.isArray(googleStatsByLocation) ? googleStatsByLocation : []
      const markers = []
      if (centroids && typeof centroids === 'object') {
        byId.forEach(({ id, label, avg, count }) => {
          const c = centroids[id]
          if (!c || c.lat == null || c.lng == null) return
          const el = document.createElement('div')
          el.className = 'map-marker map-marker-cluster'
          el.innerHTML = `<span class=\"map-marker-cluster-count\">${avg != null ? avg.toFixed(1) : '—'}</span>`
          const marker = new mapboxgl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map)
          el.addEventListener('click', () => {
            setSelectedGooglePark((prev) => (prev === id ? null : id))
            map.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 600 })
          })
          markers.push(marker)
        })
      }
      markersRef.current = markers
      if (markers.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        markers.forEach((m) => {
          const ll = m.getLngLat()
          if (!ll) return
          const { lng, lat } = ll
          if (lng == null || lat == null) return
          bounds.extend([lng, lat])
        })
        if (
          bounds.getWest() !== bounds.getEast() &&
          bounds.getSouth() !== bounds.getNorth()
        ) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 600 })
        }
      }
      return
    }
    if (itemsWithDatetimeAndCoords.length === 0) return
    const onSelect = (item) => handleSelectRef.current(item)
    const pinSource = undefined
    const index = clusterIndexRef.current
    if (index) {
      const updateClusterMarkers = () => {
        const b = map.getBounds()
        const zoom = Math.floor(map.getZoom())
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
        const clusters = index.getClusters(bbox, zoom)
        markersRef.current.forEach((m) => m.remove())
        const newMarkers = clusters.map((cluster) => {
          if (cluster.properties?.cluster) {
            return createClusterMarker(cluster, map, onSelect, {
              onClusterClick: (c) => {
                const expZoom = index.getClusterExpansionZoom(c.id)
                map.flyTo({ center: c.geometry.coordinates, zoom: expZoom, duration: 400 })
              },
            })
          }
          const item = cluster.properties?.item
          return item ? createMapMarker(item, map, onSelect, { useJitter, source: pinSource }) : null
        }).filter(Boolean)
        markersRef.current = newMarkers
      }
      updateClusterMarkers()
      const onMoveEnd = () => updateClusterMarkers()
      map.on('moveend', onMoveEnd)
      return () => map.off('moveend', onMoveEnd)
    }
    const markers = itemsWithDatetimeAndCoords
      .map((item) => createMapMarker(item, map, onSelect, { useJitter, source: pinSource }))
      .filter(Boolean)
    markersRef.current = markers
    const bounds = new mapboxgl.LngLatBounds()
    itemsWithDatetimeAndCoords.forEach((item) => {
      if (item?.coordinates?.lat != null && item?.coordinates?.lng != null) {
        bounds.extend([item.coordinates.lng, item.coordinates.lat])
      }
    })
    if (bounds.getNorth() !== bounds.getSouth() || bounds.getWest() !== bounds.getEast()) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 600 })
    }
  }, [dataSource, itemsWithDatetimeAndCoords, useJitter, noisePoints.length, googleHexPoints.length, clusterIndex])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    GEOJSON_LAYERS.forEach((cfg) => {
      const layerId = `geojson-${cfg.id}-layer`
      if (!map.getLayer(layerId)) return
      const visible = visibleLayerIds.includes(cfg.id)
      const v = visible ? 'visible' : 'none'
      map.setLayoutProperty(layerId, 'visibility', v)
      const outlineId = `${layerId}-line`
      if (map.getLayer(outlineId)) map.setLayoutProperty(outlineId, 'visibility', v)
    })
    const noiseVisible = visibleLayerIds.includes('noise-hex') || dataSource === 'noise'
    if (noiseVisible && map.getSource(NOISE_SOURCE_ID)) {
      ensureNoiseHexLayer(map, true)
      updateNoiseHexLayer(map)
    } else if (map.getLayer(NOISE_LAYER_ID)) {
      map.setLayoutProperty(NOISE_LAYER_ID, 'visibility', noiseVisible ? 'visible' : 'none')
    }
    const googleHexVisible = visibleLayerIds.includes('google-hex')
    if (googleHexVisible) {
      ensureGoogleHexLayer(map, true)
      updateGoogleHexLayer(map)
    } else if (map.getLayer(GOOGLE_HEX_LAYER_ID)) {
      map.setLayoutProperty(GOOGLE_HEX_LAYER_ID, 'visibility', 'none')
    }
  }, [visibleLayerIds, dataSource])

  const statsByLocation = useMemo(() => {
    try {
      return getNoiseStatsByLocation()
    } catch (_) {
      return []
    }
  }, [])
  const statsByWeek = useMemo(() => {
    try {
      return getNoiseStatsByWeek()
    } catch (_) {
      return []
    }
  }, [])
  const chartDataByLocationAndTime = useMemo(() => {
    try {
      return getNoiseStatsByLocationAndTime()
    } catch (_) {
      return []
    }
  }, [])

  const googleStatsByLocation = useMemo(() => {
    try {
      return getGoogleReviewStatsByLocation()
    } catch (_) {
      return []
    }
  }, [])
  const googleChartDataByLocationAndTime = useMemo(() => {
    try {
      return getGoogleReviewStatsByLocationAndTime()
    } catch (_) {
      return []
    }
  }, [])
  const [selectedGooglePark, setSelectedGooglePark] = useState(null)
  const googleCommentsSorted = useMemo(() => {
    try {
      let list = Array.isArray(googleReviewEventsWithCoords) ? [...googleReviewEventsWithCoords] : []
      if (selectedGooglePark) {
        list = list.filter((e) => e.park === selectedGooglePark)
      }
      return list.sort((a, b) => {
        const ya = getYearFromEvent(a)
        const yb = getYearFromEvent(b)
        if ((yb ?? 0) !== (ya ?? 0)) return (yb ?? 0) - (ya ?? 0)
        return String(a?.id || '').localeCompare(String(b?.id || ''))
      })
    } catch (_) {
      return []
    }
  }, [googleReviewEventsWithCoords, googleData.module, selectedGooglePark])

  /** Etiquetas para timeline Todo: sin repetir títulos (prefijo Noticias/Google si coincide). */
  const allTimelineCategoryLabels = useMemo(() => {
    const out = {}
    const usedTitles = new Set()
    AIRBNB_STAR_ASSOCIATIONS.forEach((a) => {
      const t = (a.title || a.id || '').trim() || a.id
      out[a.id] = t
      if (t) usedTitles.add(t)
    })
    NOTICIAS_ASSOCIATIONS.forEach((a) => {
      const t = (a.title || a.id || '').trim()
      out[a.id] = t && usedTitles.has(t) ? `Noticias: ${t}` : t
      if (t) usedTitles.add(out[a.id])
    })
    GOOGLE_REVIEW_ASSOCIATIONS.forEach((a) => {
      const t = (a.title || a.id || '').trim()
      out[a.id] = t && usedTitles.has(t) ? `Google: ${t}` : t
      if (t) usedTitles.add(out[a.id])
    })
    return out
  }, [])

  const NOISE_CHART_COLORS = ['#2ecc71', '#3498db', '#e67e22']

  if (!MAPBOX_TOKEN) {
    return (
      <div className="interactive-map-page">
        <p className="map-error">Token de Mapbox no configurado. Añade VITE_MAPBOX_TOKEN al archivo .env</p>
      </div>
    )
  }

  const handleToggleLayer = (layerId) => {
    setVisibleLayerIds((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
    )
  }

  const isLoadingPinData =
    (dataSource === 'airbnb' && airbnbData.loading) ||
    (dataSource === 'noticias' && noticiasData.loading)
  const canShowMap =
    isLoadingPinData ||
    itemsWithDatetimeAndCoords.length > 0 ||
    (dataSource === 'noise' && hasNoiseData) ||
    (dataSource === 'google-review-hex' && hasGoogleHexData)
  if (!canShowMap) {
    return (
      <div className="interactive-map-page">
        <p className="map-error">
          {dataSource === 'noise'
            ? 'No hay datos de ruido en TRACKS (MORAZAN, SAN PEDRO, TRES RIOS).'
            : dataSource === 'google-review-hex'
              ? 'No hay datos de Google Review con coordenadas.'
              : 'No hay ítems con coordenadas y fecha para esta fuente.'}
        </p>
        <div className="map-data-source-tabs" role="tablist">
          {DATA_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              className={`map-data-source-btn ${dataSource === opt.key ? 'active' : ''}`}
              onClick={() => setDataSource(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="interactive-map-page">
      {mapError && (
        <div className="map-error-banner" role="alert">
          {mapError}
          <button type="button" onClick={() => setMapError(null)} aria-label="Cerrar">×</button>
        </div>
      )}
      <div className="interactive-map-left">
        <div className="map-data-source-tabs" role="tablist" aria-label="Fuente de datos del mapa">
          {DATA_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={dataSource === opt.key}
              className={`map-data-source-btn ${dataSource === opt.key ? 'active' : ''}`}
              onClick={() => setDataSource(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {dataSource === 'google-review-hex' ? (
          <div className="map-noise-panel map-google-hex-panel">
            <div className="map-noise-legend">
              <span className="map-noise-legend-title">Valoración (1–5)</span>
              <div className="map-noise-legend-gradient map-google-hex-gradient" />
              <div className="map-noise-legend-labels">
                <span>1</span>
                <span>5</span>
              </div>
              <p className="map-noise-legend-hint">Hexágonos por valoración media (tipo de comentario). Misma lógica que el mapa de ruido.</p>
            </div>
            <div className="map-noise-summary">
              <h3 className="map-noise-summary-title">Promedio por parque</h3>
              <ul className="map-noise-summary-list">
                {googleStatsByLocation.map(({ id, label, avg, count }) => (
                  <li key={id}>
                    <span className="map-noise-summary-label">{label}</span>
                    <span className="map-noise-summary-value">{avg != null ? `${avg}` : '—'}</span>
                    <span className="map-noise-summary-count">({count} comentarios)</span>
                  </li>
                ))}
              </ul>
              <h3 className="map-noise-summary-title">
                Comentarios por parque
                {selectedGooglePark &&
                  ` · parque seleccionado: ${
                    googleStatsByLocation.find((p) => p.id === selectedGooglePark)?.label ?? selectedGooglePark
                  }`}
              </h3>
              {(() => {
                const groups = new Map()
                const pushToGroup = (key, label, ev) => {
                  if (!groups.has(key)) groups.set(key, { label, items: [] })
                  groups.get(key).items.push(ev)
                }
                const DISPLAY_LABELS = {
                  MORAZAN: 'Parque Morazán',
                  'SAN PEDRO': 'P. J.F. Kennedy',
                  'TRES RIOS': 'Parque Central de Tres Ríos',
                  OTROS: 'Otros',
                }
                googleCommentsSorted.forEach((ev) => {
                  const parkId = ev.park || 'OTROS'
                  if (selectedGooglePark && parkId !== selectedGooglePark) return
                  const label =
                    DISPLAY_LABELS[parkId] ||
                    googleStatsByLocation.find((p) => p.id === parkId)?.label ||
                    parkId
                  pushToGroup(parkId, label, ev)
                })
                const order = ['MORAZAN', 'SAN PEDRO', 'TRES RIOS', 'OTROS']
                const orderedGroups = order
                  .map((id) => groups.get(id))
                  .filter(Boolean)
                if (!orderedGroups.length) return null
                return orderedGroups.map(({ label, items }) => (
                  <div key={label} className="map-google-comments-group">
                    <h4 className="map-google-comments-group-title">{label}</h4>
                    <ul className="map-google-comments-list">
                      {items.map((ev) => {
                        const year = getYearFromEvent(ev)
                        const score = getScoreFromEvent(ev)
                        const location = ev.raw?.location || ev.others?.location || '—'
                        const keywords = ev.raw?.keywords || '—'
                        const isSelected = selectedGoogleCommentId === ev.id
                        return (
                          <li
                            key={ev.id}
                            className={`map-google-comment-row ${isSelected ? 'selected' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setSelectedGoogleCommentId((id) => (id === ev.id ? null : ev.id))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedGoogleCommentId((id) => (id === ev.id ? null : ev.id))
                              }
                            }}
                          >
                            <span className="map-google-comment-year">{year ?? '—'}</span>
                            <span className="map-google-comment-location" title={location}>
                              {location}
                            </span>
                            <span className="map-google-comment-keywords" title={keywords}>
                              {keywords}
                            </span>
                            <span
                              className="map-google-comment-stars"
                              title={`Valoración ${score}`}
                            >
                              {getStarsDisplay(score)}
                            </span>
                            <span className="map-google-comment-id">{ev.raw?.id ?? ev.id}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              })()}
              {selectedGoogleCommentId && (() => {
                const ev = googleReviewEventsWithCoords.find((e) => e.id === selectedGoogleCommentId)
                if (!ev) return null
                const sourceLinks = getGoogleReviewSourceLinks(ev)
                return (
                  <div className="map-google-comment-detail">
                    <button
                      type="button"
                      className="map-google-comment-detail-close"
                      onClick={() => setSelectedGoogleCommentId(null)}
                      aria-label="Cerrar detalle"
                    >
                      ×
                    </button>
                    <dl className="map-google-comment-detail-dl">
                      <dt>Descripción</dt>
                      <dd>{ev.description || ev.raw?.description || '—'}</dd>
                      <dt>Año</dt>
                      <dd>{getYearFromEvent(ev) ?? '—'}</dd>
                      <dt>Ubicación</dt>
                      <dd>{ev.raw?.location || '—'}</dd>
                      <dt>Keywords</dt>
                      <dd>{ev.raw?.keywords || '—'}</dd>
                      <dt>Valoración</dt>
                      <dd>{getStarsDisplay(getScoreFromEvent(ev))}</dd>
                      {ev.raw?.precision != null && (
                        <>
                          <dt>Precisión</dt>
                          <dd>{String(ev.raw.precision)}</dd>
                        </>
                      )}
                      {sourceLinks.length > 0 && (
                        <>
                          <dt>Fuentes</dt>
                          <dd>
                            <ul className="map-google-comment-sources">
                              {sourceLinks.map(({ id, url, description }) => (
                                <li key={id}>
                                  <a href={url} target="_blank" rel="noopener noreferrer">{description || url || id}</a>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      )}
                    </dl>
                  </div>
                )
              })()}
            </div>
            {googleChartDataByLocationAndTime.length > 0 && (
              <div className="map-noise-chart">
                <h3 className="map-noise-summary-title">Comparativa 3 parques · valoración vs tiempo</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={googleChartDataByLocationAndTime}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="map-noise-chart-grid" />
                    <XAxis
                      dataKey="yearKey"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[1, 5]}
                      tick={{ fontSize: 10 }}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(value) => (value != null ? value : '—')}
                      labelFormatter={(label) => `Año ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {TRACKS_LOCATIONS.map(({ label }, i) => (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={label}
                        name={label}
                        stroke={NOISE_CHART_COLORS[i % NOISE_CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : dataSource === 'noise' ? (
          <div className="map-noise-panel">
            <div className="map-noise-legend">
              <span className="map-noise-legend-title">LAeq (dB)</span>
              <div className="map-noise-legend-gradient" />
              <div className="map-noise-legend-labels">
                <span>40</span>
                <span>95</span>
              </div>
              <p className="map-noise-legend-hint">Hexágonos dinámicos con el zoom · NoiseCapture (MORAZAN, SAN PEDRO, TRES RIOS)</p>
            </div>
            <div className="map-noise-summary">
              <h3 className="map-noise-summary-title">Promedio por localidad</h3>
              <ul className="map-noise-summary-list">
                {statsByLocation.map(({ label, avg, count }) => (
                  <li key={label}>
                    <span className="map-noise-summary-label">{label}</span>
                    <span className="map-noise-summary-value">{avg != null ? `${avg} dB` : '—'}</span>
                    <span className="map-noise-summary-count">({count} pts)</span>
                  </li>
                ))}
              </ul>
              {statsByWeek.length > 0 && (
                <>
                  <h3 className="map-noise-summary-title">Promedio por semana</h3>
                  <ul className="map-noise-summary-list map-noise-summary-weeks">
                    {statsByWeek.slice(0, 12).map(({ weekKey, avg, count }) => (
                      <li key={weekKey}>
                        <span className="map-noise-summary-label">{weekKey}</span>
                        <span className="map-noise-summary-value">{avg} dB</span>
                        <span className="map-noise-summary-count">({count})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {chartDataByLocationAndTime.length > 0 && (
              <div className="map-noise-chart">
                <h3 className="map-noise-summary-title">Comparativa 3 parques · dB vs tiempo</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={chartDataByLocationAndTime}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="map-noise-chart-grid" />
                    <XAxis
                      dataKey="weekKey"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => (v ? String(v).replace(/^.*-/, '') : '')}
                    />
                    <YAxis
                      domain={[40, 95]}
                      tick={{ fontSize: 10 }}
                      unit=" dB"
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(value) => (value != null ? `${value} dB` : '—')}
                      labelFormatter={(label) => (label ? `${label}` : '')}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {TRACKS_LOCATIONS.map(({ label }, i) => (
                      <Line
                        key={label}
                        type="monotone"
                        dataKey={label}
                        name={label}
                        stroke={NOISE_CHART_COLORS[i % NOISE_CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <InteractiveTimeline
            items={itemsWithDatetime}
            visibleItems={visibleItems}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            scale={timelineScale}
            onScaleChange={setTimelineScale}
            viewRange={viewRange}
            onViewRangeChange={setViewRange}
            fullRange={fullRange}
            categoryOrder={
              dataSource === 'airbnb'
                ? AIRBNB_STAR_IDS
                : dataSource === 'noticias'
                  ? NOTICIAS_ASSOCIATION_IDS
                  : dataSource === 'google-review'
                    ? GOOGLE_REVIEW_ASSOCIATION_IDS
                    : null
            }
            categoryLabels={
              dataSource === 'airbnb'
                ? Object.fromEntries(AIRBNB_STAR_ASSOCIATIONS.map((a) => [a.id, a.title]))
                : dataSource === 'noticias'
                  ? Object.fromEntries(NOTICIAS_ASSOCIATIONS.map((a) => [a.id, a.title]))
                  : dataSource === 'google-review'
                    ? Object.fromEntries(GOOGLE_REVIEW_ASSOCIATIONS.map((a) => [a.id, a.title]))
                    : null
            }
          />
        )}
      </div>
      <div
        className={`interactive-map-container${!containerReady ? ' interactive-map-container-loading' : ''}`}
        aria-label="Área del mapa"
      >
        {!containerReady && (
          <div className="interactive-map-loading-msg" aria-live="polite">
            Cargando mapa…
          </div>
        )}
        {containerReady && isLoadingPinData && itemsWithDatetimeAndCoords.length === 0 && (
          <div className="interactive-map-loading-msg" aria-live="polite">
            Cargando datos…
          </div>
        )}
        <div ref={mapContainer} className="interactive-map-gl" />
        <div className="map-layers-overlay">
          <MapLayersPanel
            layers={MAP_LAYERS}
            visibleLayerIds={visibleLayerIds}
            onToggleLayer={handleToggleLayer}
          />
        </div>
      </div>
      {selectedItem && (
        <div
          className="interactive-map-detail"
          style={{
            borderLeftColor: getItemPrimaryColor(selectedItem),
          }}
        >
          <button
            type="button"
            className="interactive-map-close"
            onClick={() => setSelectedItem(null)}
            aria-label="Cerrar panel de detalle"
          >
            ×
          </button>
          <DetailPanel
            item={selectedItem}
            hideMap
            theme={theme}
            sourceLinks={
              selectedItem?.source === 'noticias'
                ? getNoticiasSourceLinks(selectedItem)
                : selectedItem?.source === 'google-review'
                  ? getGoogleReviewSourceLinks(selectedItem)
                  : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
