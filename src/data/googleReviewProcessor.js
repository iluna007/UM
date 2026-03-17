/**
 * Procesa el JSON crudo de Google Review (tras parseo en worker).
 * Evita importar el JSON en el hilo principal.
 */
import { normalizeEvents } from '../utils/normalizeExternalData'
import { TRACKS_LOCATIONS, getParkCentroids } from './tracksLoader'

const LOCATION_NAME_TO_PARK = {
  'P. J.F. Kennedy': 'MORAZAN',
  'Parque Kennedy': 'MORAZAN',
  Kennedy: 'MORAZAN',
}

function hashSeed(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function jitterForHex(lat, lng, seed) {
  const s1 = hashSeed(seed)
  const s2 = hashSeed(seed + 'x')
  const jitterLat = ((s1 % 100) / 50 - 1) * 0.0025
  const jitterLng = ((s2 % 100) / 50 - 1) * 0.0025
  return { lat: lat + jitterLat, lng: lng + jitterLng }
}

export function createGoogleReviewFromRaw(raw) {
  const events = Array.isArray(raw?.sheets?.events) ? raw.sheets.events : []
  const googleReviewEvents = normalizeEvents(events, 'google-review')
  const associationsSheet = Array.isArray(raw?.sheets?.associations) ? raw.sheets.associations : []
  const GOOGLE_REVIEW_ASSOCIATIONS = associationsSheet
    .filter((row) => row?.id)
    .slice(0, 5)
    .map((row) => ({ id: row.id, title: row.title || row.id }))
  const GOOGLE_REVIEW_ASSOCIATION_IDS = GOOGLE_REVIEW_ASSOCIATIONS.map((a) => a.id)
  const sourcesSheet = Array.isArray(raw?.sheets?.sources) ? raw.sheets.sources : []
  const googleReviewSourcesById = sourcesSheet.reduce((acc, row) => {
    const id = row?.source_id || row?.id
    if (id && (row.paths || row.path)) {
      acc[id] = { url: row.paths || row.path, description: row.description || row.desrciption || '' }
    }
    return acc
  }, {})

  function getScoreFromEvent(e) {
    const cat = e.category || []
    const assocId = cat.find((c) => GOOGLE_REVIEW_ASSOCIATION_IDS.includes(c))
    const idx = assocId ? GOOGLE_REVIEW_ASSOCIATION_IDS.indexOf(assocId) : -1
    return idx >= 0 ? Math.max(1, Math.min(5, idx + 1)) : 3
  }

  function getStarsDisplay(score) {
    const s = Math.max(1, Math.min(5, Number(score) || 3))
    return '★'.repeat(s) + '☆'.repeat(5 - s)
  }

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

  function getYearFromEvent(e) {
    const dt = e.datetime
    return dt?.year ?? (e.raw?.date ? new Date(e.raw.date).getFullYear() : null)
  }

  function resolveSourceIds(sourcesStr) {
    if (!sourcesStr || typeof sourcesStr !== 'string') return []
    return sourcesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function getGoogleReviewSourceLinks(item) {
    const raw = item?.raw || item
    if (!raw?.sources) return []
    return resolveSourceIds(raw.sources)
      .map((id) => {
        const rec = googleReviewSourcesById[id]
        if (!rec?.url) return null
        return { id, url: rec.url, description: rec.description }
      })
      .filter(Boolean)
  }

  const googleReviewEventsWithCoords = googleReviewEvents
    .map((e) => {
      const park = getParkFromEvent(e)
      return { ...e, park }
    })
    .filter((e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null)

  function getGoogleReviewHexPoints() {
    return googleReviewEventsWithCoords.map((e, index) => {
      const score = getScoreFromEvent(e)
      const seed = `${e.id ?? index}-${e.coordinates.lat}-${e.coordinates.lng}`
      const { lat, lng } = jitterForHex(e.coordinates.lat, e.coordinates.lng, seed)
      return { lat, lng, score }
    })
  }

  function getGoogleReviewStatsByLocation() {
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
      return { id, label, avg: s ? Math.round((s.sum / s.count) * 100) / 100 : null, count: s?.count ?? 0 }
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

  function getGoogleReviewStatsByLocationAndTime() {
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
    const yearKeys = [...new Set([...byYearPark.keys()].map((k) => k.split('\t')[0]))].sort(
      (a, b) => Number(a) - Number(b)
    )
    return yearKeys.map((yearKey) => {
      const row = { yearKey }
      for (const { id, label } of TRACKS_LOCATIONS) {
        const s = byYearPark.get(`${yearKey}\t${id}`)
        row[label] = s ? Math.round((s.sum / s.count) * 100) / 100 : null
      }
      return row
    })
  }

  const module = {
    googleReviewEvents,
    googleReviewEventsWithCoords,
    GOOGLE_REVIEW_ASSOCIATIONS,
    GOOGLE_REVIEW_ASSOCIATION_IDS,
    getScoreFromEvent,
    getYearFromEvent,
    getStarsDisplay,
    getGoogleReviewSourceLinks,
    getGoogleReviewHexPoints,
    getGoogleReviewStatsByLocation,
    getGoogleReviewStatsByLocationAndTime,
  }
  return {
    events: googleReviewEvents,
    eventsWithCoords: googleReviewEventsWithCoords,
    module,
  }
}
