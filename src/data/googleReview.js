/**
 * Google Review data from Google Review.xlsx (generated via scripts/xlsx-to-json.py).
 * Sheets: events, sources, associations.
 */

import googleReviewData from './google-review.json'
import { normalizeEvents } from '../utils/normalizeExternalData'
import { TRACKS_LOCATIONS, getParkCentroids } from './tracksLoader'

export const googleReviewSheets = googleReviewData.sheets || {}
export const googleReviewSheetNames = googleReviewData.sheetNames || []

const events = Array.isArray(googleReviewData.sheets?.events) ? googleReviewData.sheets.events : []
export const googleReviewEvents = normalizeEvents(events, 'google-review')

/** Events with coordinates for map/timeline */
export const googleReviewEventsWithCoords = googleReviewEvents.filter(
  (e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
)

/** 5 associations = 5 timeline bands (Tipo de Comentario) */
const associationsSheet = Array.isArray(googleReviewData.sheets?.associations) ? googleReviewData.sheets.associations : []
export const GOOGLE_REVIEW_ASSOCIATIONS = associationsSheet
  .filter((row) => row?.id)
  .slice(0, 5)
  .map((row) => ({ id: row.id, title: row.title || row.id }))

export const GOOGLE_REVIEW_ASSOCIATION_IDS = GOOGLE_REVIEW_ASSOCIATIONS.map((a) => a.id)

/** Map location name from sheet to park id (fallback when centroids not available). */
const LOCATION_NAME_TO_PARK = {
  'P. J.F. Kennedy': 'MORAZAN',
  'Parque Kennedy': 'MORAZAN',
  'Kennedy': 'MORAZAN',
}

export function getScoreFromEvent(e) {
  const cat = e.category || []
  const assocId = cat.find((c) => GOOGLE_REVIEW_ASSOCIATION_IDS.includes(c))
  const idx = assocId ? GOOGLE_REVIEW_ASSOCIATION_IDS.indexOf(assocId) : -1
  return idx >= 0 ? Math.max(1, Math.min(5, idx + 1)) : 3
}

/** '★★★☆☆' from score 1–5 */
export function getStarsDisplay(score) {
  const s = Math.max(1, Math.min(5, Number(score) || 3))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

/** Assign park by coordinates: nearest TRACKS centroid. Fallback: location name. */
function getParkFromEvent(e) {
  const centroids = getParkCentroids()
  const lat = e.coordinates?.lat
  const lng = e.coordinates?.lng
  if (centroids && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    let bestId = null
    let bestDist2 = Infinity
    for (const [id, c] of Object.entries(centroids)) {
      const d2 = (c.lat - lat) ** 2 + (c.lng - lng) ** 2
      if (d2 < bestDist2) {
        bestDist2 = d2
        bestId = id
      }
    }
    if (bestId) return bestId
  }
  const name = (e.raw?.location || e.others?.location || '').trim()
  return LOCATION_NAME_TO_PARK[name] || (name ? 'OTROS' : null)
}

export function getYearFromEvent(e) {
  const dt = e.datetime
  return dt?.year ?? (e.raw?.date ? new Date(e.raw.date).getFullYear() : null)
}

/** Deterministic hash from string for jitter seed. */
function hashSeed(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Small deterministic offset so hex points with the same coordinates spread into different hexagons.
 * Offset ~±0.0025° (~250–300 m); same event always gets the same position.
 */
function jitterForHex(lat, lng, seed) {
  const s1 = hashSeed(seed)
  const s2 = hashSeed(seed + 'x')
  const jitterLat = ((s1 % 100) / 50 - 1) * 0.0025
  const jitterLng = ((s2 % 100) / 50 - 1) * 0.0025
  return { lat: lat + jitterLat, lng: lng + jitterLng }
}

/** Points for hexagon map: { lat, lng, score } with score 1–5 from association (asc1=1 … asc5=5). */
export function getGoogleReviewHexPoints() {
  return googleReviewEventsWithCoords.map((e, index) => {
    const score = getScoreFromEvent(e)
    const seed = `${e.id ?? index}-${e.coordinates.lat}-${e.coordinates.lng}`
    const { lat, lng } = jitterForHex(e.coordinates.lat, e.coordinates.lng, seed)
    return {
      lat,
      lng,
      score,
    }
  })
}

/** Promedio valoración (1–5) por localidad/parque. */
export function getGoogleReviewStatsByLocation() {
  const byPark = new Map()
  for (const e of googleReviewEventsWithCoords) {
    const park = getParkFromEvent(e)
    if (!park) continue
    const score = getScoreFromEvent(e)
    const prev = byPark.get(park) ?? { sum: 0, count: 0 }
    prev.sum += score
    prev.count += 1
    byPark.set(park, prev)
  }
  const result = TRACKS_LOCATIONS.map(({ id, label }) => {
    const s = byPark.get(id)
    const avg = s ? Math.round((s.sum / s.count) * 100) / 100 : null
    return { id, label, avg, count: s?.count ?? 0 }
  }).filter((r) => r.count > 0)
  const otros = byPark.get('OTROS')
  if (otros) {
    result.push({
      id: 'OTROS',
      label: 'Otros',
      avg: Math.round((otros.sum / otros.count) * 100) / 100,
      count: otros.count,
    })
  }
  return result
}

/** Promedio valoración por año (los datos tienen año, no semana). */
export function getGoogleReviewStatsByYear() {
  const byYear = new Map()
  for (const e of googleReviewEventsWithCoords) {
    const y = getYearFromEvent(e)
    if (y == null) continue
    const score = getScoreFromEvent(e)
    const prev = byYear.get(y) ?? { sum: 0, count: 0 }
    prev.sum += score
    prev.count += 1
    byYear.set(y, prev)
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([yearKey, s]) => ({
      yearKey: String(yearKey),
      avg: Math.round((s.sum / s.count) * 100) / 100,
      count: s.count,
    }))
}

/** Para gráfica comparativa: valoración media por parque y por año. */
export function getGoogleReviewStatsByLocationAndTime() {
  const byYearPark = new Map()
  for (const e of googleReviewEventsWithCoords) {
    const park = getParkFromEvent(e)
    const y = getYearFromEvent(e)
    if (park == null || y == null || park === 'OTROS') continue
    const key = `${y}\t${park}`
    const score = getScoreFromEvent(e)
    const prev = byYearPark.get(key) ?? { sum: 0, count: 0 }
    prev.sum += score
    prev.count += 1
    byYearPark.set(key, prev)
  }
  const yearKeys = [...new Set([...byYearPark.keys()].map((k) => k.split('\t')[0]))].sort((a, b) => Number(a) - Number(b))
  return yearKeys.map((yearKey) => {
    const row = { yearKey }
    for (const { id, label } of TRACKS_LOCATIONS) {
      const s = byYearPark.get(`${yearKey}\t${id}`)
      row[label] = s ? Math.round((s.sum / s.count) * 100) / 100 : null
    }
    return row
  })
}

/** Lookup: source_id -> { paths (url), description } */
const sourcesSheet = Array.isArray(googleReviewData.sheets?.sources) ? googleReviewData.sheets.sources : []
export const googleReviewSourcesById = sourcesSheet.reduce((acc, row) => {
  const id = row?.source_id || row?.id
  if (id && (row.paths || row.path)) {
    acc[id] = { url: row.paths || row.path, description: row.description || row.desrciption || '' }
  }
  return acc
}, {})

function resolveSourceIds(sourcesStr) {
  if (!sourcesStr || typeof sourcesStr !== 'string') return []
  return sourcesStr.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Get source links for a google-review event (raw.sources = "scr01" or "scr01, scr02").
 * Returns [{ id, url, description }].
 */
export function getGoogleReviewSourceLinks(item) {
  const raw = item?.raw || item
  if (!raw?.sources) return []
  const ids = resolveSourceIds(raw.sources)
  return ids
    .map((id) => {
      const rec = googleReviewSourcesById[id]
      if (!rec?.url) return null
      return { id, url: rec.url, description: rec.description }
    })
    .filter(Boolean)
}
