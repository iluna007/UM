/**
 * Procesa el JSON crudo de Noticias (tras parseo en worker).
 */
import { normalizeEvents } from '../utils/normalizeExternalData'

function hasNoticiasContent(event) {
  if (!event) return false
  const raw = event.raw || event
  const title = (event.title || '').trim()
  const description = (event.description || '').trim()
  const idStr = event.id ? String(event.id).replace(/^noticias-/, '') : ''
  if (title && title !== idStr && title.length > 1) return true
  if (description.length > 0) return true
  if (event.coordinates && event.coordinates.lat != null && event.coordinates.lng != null) return true
  if (raw.associations != null && String(raw.associations).trim() !== '') return true
  if (raw.sources != null && String(raw.sources).trim() !== '') return true
  if (raw.title != null && String(raw.title).trim() !== '') return true
  if (
    (raw.description != null && String(raw.description).trim() !== '') ||
    (raw.desrciption != null && String(raw.desrciption).trim() !== '')
  )
    return true
  if (raw.location != null && String(raw.location).trim() !== '') return true
  if (raw.keywords != null && String(raw.keywords).trim() !== '') return true
  return false
}

export function createNoticiasFromRaw(raw) {
  const events = Array.isArray(raw?.sheets?.events) ? raw.sheets.events : []
  const allNoticiasEvents = normalizeEvents(events, 'noticias')
  const noticiasEvents = allNoticiasEvents.filter(hasNoticiasContent)
  const noticiasEventsWithCoords = noticiasEvents.filter(
    (e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
  )
  const associationsSheet = Array.isArray(raw?.sheets?.associations) ? raw.sheets.associations : []
  const NOTICIAS_ASSOCIATIONS = associationsSheet
    .filter((row) => row?.id)
    .slice(0, 8)
    .map((row) => ({ id: row.id, title: row.title || row.id }))
  const NOTICIAS_ASSOCIATION_IDS = NOTICIAS_ASSOCIATIONS.map((a) => a.id)
  const sourcesSheet = Array.isArray(raw?.sheets?.sources) ? raw.sheets.sources : []
  const noticiasSourcesById = sourcesSheet.reduce((acc, row) => {
    const id = row?.source_id || row?.id
    if (id && (row.paths || row.path)) {
      acc[id] = { url: row.paths || row.path, description: row.desrciption || row.description || '' }
    }
    return acc
  }, {})

  function resolveSourceIds(sourcesStr) {
    if (!sourcesStr || typeof sourcesStr !== 'string') return []
    return sourcesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function getNoticiasSourceLinks(item) {
    const raw = item?.raw || item
    if (!raw?.sources) return []
    return resolveSourceIds(raw.sources)
      .map((id) => {
        const rec = noticiasSourcesById[id] || noticiasSourcesById[id.replace(/^scr/, 'src')]
        if (!rec?.url) return null
        return { id, url: rec.url, description: rec.description }
      })
      .filter(Boolean)
  }

  const module = {
    noticiasEvents,
    noticiasEventsWithCoords,
    NOTICIAS_ASSOCIATIONS,
    NOTICIAS_ASSOCIATION_IDS,
    getNoticiasSourceLinks,
  }
  return {
    events: noticiasEvents,
    eventsWithCoords: noticiasEventsWithCoords,
    module,
  }
}
