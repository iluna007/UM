/**
 * Airbnb data from Airbnb.xlsx (generated via scripts/xlsx-to-json.py).
 * Sheets: events, sources, associations.
 * Timeline/map: 5 bands by star rating (1–5), colors red to green.
 */

import airbnbData from './airbnb.json'
import { normalizeEvents } from '../utils/normalizeExternalData'

export const airbnbSheets = airbnbData.sheets || {}
export const airbnbSheetNames = airbnbData.sheetNames || []

const events = Array.isArray(airbnbData.sheets?.events) ? airbnbData.sheets.events : []
export const airbnbEvents = normalizeEvents(events, 'airbnb')

/** Events with coordinates for map/timeline */
export const airbnbEventsWithCoords = airbnbEvents.filter(
  (e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
)

/** 5 associations = 5 timeline bands (estrellas 1–5) */
export const AIRBNB_STAR_ASSOCIATIONS = [
  { id: 'airbnb-1', title: '1 estrella' },
  { id: 'airbnb-2', title: '2 estrellas' },
  { id: 'airbnb-3', title: '3 estrellas' },
  { id: 'airbnb-4', title: '4 estrellas' },
  { id: 'airbnb-5', title: '5 estrellas' },
]

export const AIRBNB_STAR_IDS = AIRBNB_STAR_ASSOCIATIONS.map((a) => a.id)
