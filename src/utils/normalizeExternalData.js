/**
 * Normalize rows from Airbnb, Google Review, Noticias (events sheets) into
 * archive-like items: id, title, description, date, year, datetime, coordinates, images, source.
 */

function parseLatLng(lat, lng) {
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat).replace(',', '.'))
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng).replace(',', '.'))
  if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln }
  return null
}

/** Parse date from ISO string or year number to { year, month, day } and timestamp. */
function parseDateField(value) {
  if (value == null) return null
  if (typeof value === 'number' && value >= 1900 && value <= 2100) {
    return { year: value, month: 1, day: 1, hour: 0, minute: 0, second: 0 }
  }
  const str = String(value).trim()
  if (!str) return null
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return null
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  }
}

/** Format date for display and sorting (MM.YYYY to match archive sortByDate). */
function formatDateDisplay(dt) {
  if (!dt) return ''
  const m = dt.month ?? 1
  const y = dt.year ?? new Date().getFullYear()
  return `${String(m).padStart(2, '0')}.${y}`
}

/**
 * @param {Record<string, unknown>} row - one row from events sheet
 * @param {string} source - 'airbnb' | 'google-review' | 'noticias'
 * @param {number} index - row index for fallback id
 * @returns {object | null}
 */
export function normalizeEventRow(row, source, index) {
  const lat = row.latitude ?? row.lat
  const lng = row.longitude ?? row.lng
  const coordinates = parseLatLng(lat, lng)
  const id = row.id != null ? String(row.id) : `${source}-${index}`

  const title =
    row.title ??
    row.location ??
    row.desrciption?.slice?.(0, 60) ??
    row.description?.slice?.(0, 60) ??
    id
  const description =
    row.description ?? row.desrciption ?? row.keywords ?? ''

  const dateRaw = row.date ?? row['first review'] ?? row.first_review
  const datetime = parseDateField(dateRaw)
  const year = datetime?.year ?? new Date().getFullYear()
  const date = formatDateDisplay(datetime) || String(year)

  const img = row.graphic
  const images = typeof img === 'string' && img && img !== 'false'
    ? [img]
    : Array.isArray(row.images)
      ? row.images.filter(Boolean)
      : []

  let category = [source]
  if (source === 'airbnb' && (row.rating != null || row.rating === 0)) {
    const ratingStr = String(row.rating || '').replace(',', '.')
    const ratingNum = parseFloat(ratingStr)
    const stars = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : 3
    category = [`airbnb-${stars}`, source]
  } else if ((source === 'noticias' || source === 'google-review') && row.associations) {
    const associationIds = String(row.associations).split(',').map((s) => s.trim()).filter(Boolean)
    category = [...associationIds, source]
  }
  if (row.location) category.push(String(row.location))
  if (row.provincia) category.push(String(row.provincia))
  if (row.canton) category.push(String(row.canton))

  return {
    id: `${source}-${id}`,
    title: String(title).slice(0, 200),
    description: String(description).slice(0, 2000),
    date,
    year,
    datetime: datetime || { year, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
    coordinates,
    gpsCoordinates: coordinates ? `${coordinates.lat} ${coordinates.lng}` : null,
    category,
    images,
    video: null,
    audioRecording: null,
    others: { status: source, location: row.location ?? row.provincia ?? '' },
    source,
    raw: row,
  }
}

/**
 * @param {Array<Record<string, unknown>>} rows - events array
 * @param {string} source
 * @returns {Array<import('./normalizeExternalData').ArchiveLikeItem>}
 */
export function normalizeEvents(rows, source) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row, i) => normalizeEventRow(row, source, i))
    .filter(Boolean)
}
