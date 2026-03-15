/**
 * Load all NoiseCapture track GeoJSONs from TRACKS (MORAZAN, SAN PEDRO, TRES RIOS).
 * Each feature is a point with leq_mean (dB). We export a flat list of { lat, lng, leq_mean, location }.
 */

const TRACK_GLOB = import.meta.glob('./TRACKS/**/*.geojson', { eager: true, query: '?raw', import: 'default' })

function getLocationFromPath(path) {
  const normalized = path.replace(/\\/g, '/')
  if (normalized.includes('MORAZAN')) return 'MORAZAN'
  if (normalized.includes('SAN PEDRO')) return 'SAN PEDRO'
  if (normalized.includes('TRES RIOS')) return 'TRES RIOS'
  return 'TRACKS'
}

/** @type {{ lat: number, lng: number, leq_mean: number, location: string }[]} */
let cachedPoints = null

export function getTracksNoisePoints() {
  if (cachedPoints) return cachedPoints
  const points = []
  for (const [path, raw] of Object.entries(TRACK_GLOB)) {
    const str = typeof raw === 'string' ? raw : (raw && (raw.default ?? raw))
    if (!str) continue
    try {
      const geojson = JSON.parse(str)
      const features = geojson?.features ?? []
      const location = getLocationFromPath(path)
      for (const f of features) {
        const geom = f.geometry
        const props = f.properties ?? {}
        const leq = props.leq_mean ?? props.Leq ?? props.LAeq
        if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2 && leq != null) {
          const [lng, lat] = geom.coordinates
          const utc = props.location_utc ?? props.leq_utc
          const date = utc != null ? new Date(Number(utc)) : null
          let weekKey = null
          if (date && !isNaN(date.getTime())) {
            const startOfYear = new Date(date.getFullYear(), 0, 1).getTime()
            const weekOfYear = Math.ceil((date.getTime() - startOfYear) / (7 * 24 * 3600 * 1000))
            weekKey = `${date.getFullYear()}-W${String(weekOfYear).padStart(2, '0')}`
          }
          points.push({
            lat: Number(lat),
            lng: Number(lng),
            leq_mean: Number(leq),
            location,
            date: date && !isNaN(date.getTime()) ? date : null,
            weekKey,
          })
        }
      }
    } catch (_) {
      // skip invalid or unparseable
    }
  }
  cachedPoints = points
  return points
}

export const TRACKS_LOCATIONS = [
  { id: 'MORAZAN', label: 'Morazán' },
  { id: 'SAN PEDRO', label: 'San Pedro' },
  { id: 'TRES RIOS', label: 'Tres Ríos' },
]

/** Centroids { MORAZAN: { lat, lng }, ... } from TRACKS points for assigning events to park by distance. */
let cachedCentroids = null
export function getParkCentroids() {
  if (cachedCentroids) return cachedCentroids
  const points = getTracksNoisePoints()
  const byPark = new Map()
  for (const p of points) {
    const id = p.location || 'TRACKS'
    if (id === 'TRACKS') continue
    const prev = byPark.get(id) ?? { sumLat: 0, sumLng: 0, count: 0 }
    prev.sumLat += p.lat
    prev.sumLng += p.lng
    prev.count += 1
    byPark.set(id, prev)
  }
  const out = {}
  for (const { id } of TRACKS_LOCATIONS) {
    const s = byPark.get(id)
    if (s && s.count > 0) {
      out[id] = { lat: s.sumLat / s.count, lng: s.sumLng / s.count }
    }
  }
  cachedCentroids = Object.keys(out).length ? out : null
  return cachedCentroids
}

/** Promedio LAeq por localidad (parque/área). */
export function getNoiseStatsByLocation() {
  const points = getTracksNoisePoints()
  const byLocation = new Map()
  for (const p of points) {
    const loc = p.location || 'TRACKS'
    const prev = byLocation.get(loc) ?? { sum: 0, count: 0 }
    prev.sum += p.leq_mean
    prev.count += 1
    byLocation.set(loc, prev)
  }
  return TRACKS_LOCATIONS.map(({ id, label }) => {
    const s = byLocation.get(id)
    const avg = s ? Math.round((s.sum / s.count) * 10) / 10 : null
    return { id, label, avg, count: s?.count ?? 0 }
  }).filter((r) => r.count > 0)
}

/** Promedio LAeq por semana (weekKey YYYY-Wnn). */
export function getNoiseStatsByWeek() {
  const points = getTracksNoisePoints()
  const byWeek = new Map()
  for (const p of points) {
    const w = p.weekKey || 'sin fecha'
    const prev = byWeek.get(w) ?? { sum: 0, count: 0 }
    prev.sum += p.leq_mean
    prev.count += 1
    byWeek.set(w, prev)
  }
  const entries = [...byWeek.entries()].filter(([k]) => k !== 'sin fecha').sort()
  return entries.map(([weekKey, s]) => ({
    weekKey,
    avg: Math.round((s.sum / s.count) * 10) / 10,
    count: s.count,
  }))
}

/**
 * Para gráfica comparativa: dB promedio por parque (localidad) y por semana.
 * Returns [{ weekKey, Morazán, 'San Pedro', 'Tres Ríos' }, ...] con avg dB por localidad en esa semana.
 */
export function getNoiseStatsByLocationAndTime() {
  const points = getTracksNoisePoints()
  const byWeekAndLocation = new Map()
  for (const p of points) {
    const w = p.weekKey
    if (!w) continue
    const loc = p.location || 'TRACKS'
    if (loc === 'TRACKS') continue
    const key = `${w}\t${loc}`
    const prev = byWeekAndLocation.get(key) ?? { sum: 0, count: 0 }
    prev.sum += p.leq_mean
    prev.count += 1
    byWeekAndLocation.set(key, prev)
  }
  const weekKeys = [...new Set([...byWeekAndLocation.keys()].map((k) => k.split('\t')[0]))].sort()
  const locationLabels = Object.fromEntries(TRACKS_LOCATIONS.map(({ id, label }) => [id, label]))

  return weekKeys.map((weekKey) => {
    const row = { weekKey }
    for (const { id, label } of TRACKS_LOCATIONS) {
      const s = byWeekAndLocation.get(`${weekKey}\t${id}`)
      row[label] = s ? Math.round((s.sum / s.count) * 10) / 10 : null
    }
    return row
  })
}
