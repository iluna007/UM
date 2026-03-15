/**
 * Aggregate noise points into H3 hexagons. Resolution depends on zoom (dynamic hex size).
 * Returns GeoJSON FeatureCollection for Mapbox fill layer with gradient by meanLeq.
 */

import { latLngToCell, cellToBoundary } from 'h3-js'

/**
 * H3 resolution from map zoom: hexágonos pequeños y dinámicos (más pequeños al acercar).
 * Res 9 ~300m, 10 ~70m, 11 ~17m, 12 ~4m, 13 ~1m
 */
export function zoomToH3Resolution(zoom) {
  const z = Math.max(0, Math.min(22, Number(zoom)))
  const res = Math.min(15, Math.max(8, 9 + Math.floor((z - 10) / 1.2)))
  return res
}

/**
 * @param {{ lat: number, lng: number, leq_mean: number }[]} points
 * @param {number} resolution - H3 resolution (5–15)
 * @param {[number, number, number, number]} bounds - [west, south, east, north] optional filter
 * @returns {import('geojson').FeatureCollection}
 */
export function pointsToHexGeoJSON(points, resolution, bounds = null) {
  const byHex = new Map() // h3Index -> { sumLeq, count }

  for (const p of points) {
    if (bounds) {
      const [w, s, e, n] = bounds
      if (p.lng < w || p.lng > e || p.lat < s || p.lat > n) continue
    }
    try {
      const h = latLngToCell(p.lat, p.lng, resolution)
      const prev = byHex.get(h) ?? { sumLeq: 0, count: 0 }
      prev.sumLeq += p.leq_mean
      prev.count += 1
      byHex.set(h, prev)
    } catch (_) {
      // skip invalid
    }
  }

  const features = []
  for (const [h3Index, { sumLeq, count }] of byHex.entries()) {
    const meanLeq = sumLeq / count
    let boundary
    try {
      boundary = cellToBoundary(h3Index, true)
    } catch (_) {
      continue
    }
    const ring = Array.isArray(boundary[0]) ? boundary : boundary.map((p) => [p[0], p[1]])
    const closed = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? [...ring, ring[0]] : ring
    const coordinates = [closed]
    features.push({
      type: 'Feature',
      id: h3Index,
      properties: { meanLeq: Math.round(meanLeq * 10) / 10, count },
      geometry: { type: 'Polygon', coordinates },
    })
  }

  return { type: 'FeatureCollection', features }
}

/**
 * Same as pointsToHexGeoJSON but for any numeric value (e.g. Google Review score 1–5).
 * @param {{ lat: number, lng: number, [key: string]: number }[]} points - each point must have [valueKey]
 * @param {number} resolution - H3 resolution
 * @param {[number, number, number, number]} bounds - optional [w, s, e, n]
 * @param {{ valueKey: string, outputKey: string }} options - valueKey to sum (e.g. 'score'), outputKey in props (e.g. 'meanScore')
 * @returns {import('geojson').FeatureCollection}
 */
export function pointsToHexGeoJSONWithValue(points, resolution, bounds, options = {}) {
  const { valueKey = 'score', outputKey = 'meanScore' } = options
  const byHex = new Map()

  for (const p of points) {
    const val = p[valueKey]
    if (val == null || !Number.isFinite(Number(val))) continue
    if (bounds) {
      const [w, s, e, n] = bounds
      if (p.lng < w || p.lng > e || p.lat < s || p.lat > n) continue
    }
    try {
      const h = latLngToCell(p.lat, p.lng, resolution)
      const prev = byHex.get(h) ?? { sum: 0, count: 0 }
      prev.sum += Number(val)
      prev.count += 1
      byHex.set(h, prev)
    } catch (_) {}
  }

  const features = []
  for (const [h3Index, { sum, count }] of byHex.entries()) {
    const meanVal = sum / count
    let boundary
    try {
      boundary = cellToBoundary(h3Index, true)
    } catch (_) {
      continue
    }
    const ring = Array.isArray(boundary[0]) ? boundary : boundary.map((p) => [p[0], p[1]])
    const closed = ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? [...ring, ring[0]] : ring
    features.push({
      type: 'Feature',
      id: h3Index,
      properties: { [outputKey]: Math.round(meanVal * 100) / 100, count },
      geometry: { type: 'Polygon', coordinates: [closed] },
    })
  }
  return { type: 'FeatureCollection', features }
}
