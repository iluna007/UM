import { useEffect, useRef, useState, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { archive } from '../data/archive'
import DetailPanel from '../components/DetailPanel'
import InteractiveTimeline from '../components/InteractiveTimeline'
import { getTimeRange, filterItemsByRange } from '../utils/datetime'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAP_STYLE_LIGHT = 'mapbox://styles/ikerluna/cmmp9964u005401rzhlycalmk'
const MAP_STYLE_DARK = 'mapbox://styles/ikerluna/cmmp97lzz001o01s46t647djn'

const itemsWithCoords = archive.filter(
  (item) => item.coordinates && item.coordinates.lat != null && item.coordinates.lng != null
)

const itemsWithDatetime = archive.filter(
  (item) => item.datetime && typeof item.datetime === 'object'
)

const itemsWithDatetimeAndCoords = itemsWithDatetime.filter(
  (item) => item.coordinates && item.coordinates.lat != null && item.coordinates.lng != null
)

const fullRange = getTimeRange(itemsWithDatetime)

export default function InteractiveMap({ theme = 'light' }) {
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [timelineScale, setTimelineScale] = useState('month')
  const [viewRange, setViewRange] = useState({ min: fullRange.min, max: fullRange.max })

  const visibleItems = useMemo(
    () => filterItemsByRange(itemsWithDatetime, viewRange.min, viewRange.max),
    [viewRange.min, viewRange.max]
  )

  useEffect(() => {
    if (selectedItem && !visibleItems.some((i) => i.id === selectedItem.id)) {
      setSelectedItem(null)
    }
  }, [visibleItems, selectedItem])

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    if (item?.coordinates && mapRef.current) {
      const [lng, lat] = [item.coordinates.lng, item.coordinates.lat]
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 800 })
    }
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || itemsWithDatetimeAndCoords.length === 0) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const bounds = new mapboxgl.LngLatBounds()

    itemsWithDatetimeAndCoords.forEach((item) => {
      const [lng, lat] = [item.coordinates.lng, item.coordinates.lat]
      bounds.extend([lng, lat])
    })

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      bounds: bounds,
      fitBoundsOptions: { padding: 50, maxZoom: 10 },
    })

    mapRef.current = map

    const markers = itemsWithDatetimeAndCoords.map((item) => {
      const [lng, lat] = [item.coordinates.lng, item.coordinates.lat]
      const el = document.createElement('div')
      el.className = 'map-marker'
      el.innerHTML = '<span class="map-marker-pin"></span>'
      el.dataset.id = item.id

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map)

      el.addEventListener('click', () => handleSelectItem(item))

      return marker
    })

    markersRef.current = markers

    return () => {
      markers.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

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
      markersRef.current.forEach((m) => m.remove())
      const markers = itemsWithDatetimeAndCoords.map((item) => {
        const [lng, lat] = [item.coordinates.lng, item.coordinates.lat]
        const el = document.createElement('div')
        el.className = 'map-marker'
        el.innerHTML = '<span class="map-marker-pin"></span>'
        el.dataset.id = item.id
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map)
        el.addEventListener('click', () => handleSelectItem(item))
        return marker
      })
      markersRef.current = markers
    })
  }, [mapStyle])

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((i) => i.id))
    markersRef.current.forEach((marker) => {
      const id = marker.getElement()?.dataset?.id
      const el = marker.getElement()
      if (el) el.style.display = visibleIds.has(id) ? '' : 'none'
    })
  }, [visibleItems])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="interactive-map-page">
        <p className="map-error">Mapbox token not configured. Add VITE_MAPBOX_TOKEN to .env</p>
      </div>
    )
  }

  if (itemsWithDatetimeAndCoords.length === 0 || itemsWithDatetime.length === 0) {
    return (
      <div className="interactive-map-page">
        <p className="map-error">No archive items with coordinates and datetime to display.</p>
      </div>
    )
  }

  return (
    <div className="interactive-map-page">
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
      />
      <div ref={mapContainer} className="interactive-map-container" aria-label="Interactive map" />
      {selectedItem && (
        <div className="interactive-map-detail">
          <button
            type="button"
            className="interactive-map-close"
            onClick={() => setSelectedItem(null)}
            aria-label="Close detail panel"
          >
            ×
          </button>
          <DetailPanel item={selectedItem} hideMap theme={theme} />
        </div>
      )}
    </div>
  )
}
