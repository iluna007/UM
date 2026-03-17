import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAP_STYLE_LIGHT = 'mapbox://styles/ikerluna/cmmp9964u005401rzhlycalmk'
const MAP_STYLE_DARK = 'mapbox://styles/ikerluna/cmmp97lzz001o01s46t647djn'

export default function LocationMap({ coordinates, theme = 'light' }) {
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!MAPBOX_TOKEN || !coordinates || !mapContainer.current) return

    const [lng, lat] = Array.isArray(coordinates)
      ? coordinates
      : [coordinates?.lng, coordinates?.lat]

    if (lng == null || lat == null || !Number.isFinite(lng) || !Number.isFinite(lat)) return

    if (!mapRef.current) {
      mapboxgl.accessToken = MAPBOX_TOKEN
      mapRef.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [lng, lat],
        zoom: 12,
      })
    }

    const map = mapRef.current

    if (markerRef.current) {
      markerRef.current.remove()
    }

    markerRef.current = new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .addTo(map)

    map.flyTo({ center: [lng, lat], zoom: 12, duration: 800 })

    return () => {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    }
  }, [coordinates])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(mapStyle)
  }, [mapStyle])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  if (!MAPBOX_TOKEN || !coordinates) return null

  return <div ref={mapContainer} className="location-map" aria-label="Location map" />
}
