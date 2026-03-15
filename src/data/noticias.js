/**
 * Noticias data from Noticias.xlsx (generated via scripts/xlsx-to-json.py).
 * Sheets: events, sources, associations.
 */

import noticiasData from './noticias.json'
import { normalizeEvents } from '../utils/normalizeExternalData'

export const noticiasSheets = noticiasData.sheets || {}
export const noticiasSheetNames = noticiasData.sheetNames || []

const events = Array.isArray(noticiasData.sheets?.events) ? noticiasData.sheets.events : []
const allNoticiasEvents = normalizeEvents(events, 'noticias')

/** Excluye registros sin información (filas vacías o solo con id). */
function hasNoticiasContent(event) {
  if (!event) return false
  const raw = event.raw || event
  const title = (event.title || '').trim()
  const description = (event.description || '').trim()
  const idStr = event.id ? String(event.id).replace(/^noticias-/, '') : ''
  if (title && title !== idStr && title.length > 1) return true
  if (description.length > 0) return true
  if (event.coordinates && event.coordinates.lat != null && event.coordinates.lng != null) return true
  const associations = (raw.associations != null && String(raw.associations).trim() !== '') || false
  if (associations) return true
  const sources = (raw.sources != null && String(raw.sources).trim() !== '') || false
  if (sources) return true
  const rawTitle = (raw.title != null && String(raw.title).trim() !== '') || false
  if (rawTitle) return true
  const rawDesc = (raw.description != null && String(raw.description).trim() !== '') || (raw.desrciption != null && String(raw.desrciption).trim() !== '') || false
  if (rawDesc) return true
  if (raw.location != null && String(raw.location).trim() !== '') return true
  if (raw.keywords != null && String(raw.keywords).trim() !== '') return true
  return false
}

export const noticiasEvents = allNoticiasEvents.filter(hasNoticiasContent)

/** Events with coordinates for map/timeline */
export const noticiasEventsWithCoords = noticiasEvents.filter(
  (e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
)

/** 8 associations = 8 timeline bands (Tipo de daño) */
const associationsSheet = Array.isArray(noticiasData.sheets?.associations) ? noticiasData.sheets.associations : []
export const NOTICIAS_ASSOCIATIONS = associationsSheet
  .filter((row) => row?.id)
  .slice(0, 8)
  .map((row) => ({ id: row.id, title: row.title || row.id }))

export const NOTICIAS_ASSOCIATION_IDS = NOTICIAS_ASSOCIATIONS.map((a) => a.id)

/** Lookup: source_id -> { paths (url), desrciption } */
const sourcesSheet = Array.isArray(noticiasData.sheets?.sources) ? noticiasData.sheets.sources : []
export const noticiasSourcesById = sourcesSheet.reduce((acc, row) => {
  const id = row?.source_id || row?.id
  if (id && (row.paths || row.path)) {
    acc[id] = { url: row.paths || row.path, description: row.desrciption || row.description || '' }
  }
  return acc
}, {})

/** Normalize source id: events may use "scr102" or "src1" - try exact and scr->src */
function resolveSourceIds(sourcesStr) {
  if (!sourcesStr || typeof sourcesStr !== 'string') return []
  return sourcesStr.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Get source links for a noticias event (raw.sources = "src1, src2" or "scr102").
 * Returns [{ id, url, description }].
 */
export function getNoticiasSourceLinks(item) {
  const raw = item?.raw || item
  if (!raw?.sources) return []
  const ids = resolveSourceIds(raw.sources)
  return ids
    .map((id) => {
      const rec = noticiasSourcesById[id] || noticiasSourcesById[id.replace(/^scr/, 'src')]
      if (!rec?.url) return null
      return { id, url: rec.url, description: rec.description }
    })
    .filter(Boolean)
}
