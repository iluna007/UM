/**
 * Combined external data (Airbnb, Google Review, Noticias, Ruido) for map, timeline and archive.
 */

import { airbnbEvents, airbnbEventsWithCoords } from './airbnb'
import { googleReviewEvents, googleReviewEventsWithCoords } from './googleReview'
import { noticiasEvents, noticiasEventsWithCoords } from './noticias'
import { getTracksNoisePoints } from './tracksLoader'
import { getTimeRange } from '../utils/datetime'

export { airbnbEvents, airbnbEventsWithCoords } from './airbnb'
export { googleReviewEvents, googleReviewEventsWithCoords } from './googleReview'
export { noticiasEvents, noticiasEventsWithCoords } from './noticias'

/** Noise points as archive-style events (for Archive Ruido tab). */
export function getNoiseArchiveEvents() {
  const points = getTracksNoisePoints()
  return points.map((p, i) => {
    const year = p.date ? p.date.getFullYear() : new Date().getFullYear()
    const month = p.date ? p.date.getMonth() + 1 : 1
    const dateStr = `${month}.${year}`
    return {
      id: `noise-${p.location}-${p.weekKey || i}-${i}`,
      year: String(year),
      date: dateStr,
      title: `${p.location} · ${p.leq_mean} dB`,
      raw: {
        location: p.location,
        leq_mean: p.leq_mean,
        lat: p.lat,
        lng: p.lng,
        weekKey: p.weekKey,
        date: p.date ? p.date.toISOString() : null,
      },
      source: 'noise',
    }
  })
}

/** All events from the three external sources (for archive tabs; noise is separate). */
export const allExternalEvents = [
  ...airbnbEvents,
  ...googleReviewEvents,
  ...noticiasEvents,
]

/** All events that have coordinates (for map). */
export const allExternalEventsWithCoords = [
  ...airbnbEventsWithCoords,
  ...googleReviewEventsWithCoords,
  ...noticiasEventsWithCoords,
]

/** All events with valid datetime (for timeline). */
export const allExternalEventsWithDatetime = allExternalEvents.filter(
  (e) => e.datetime && e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
)

/** Time range of external data for timeline. */
export const externalTimeRange = getTimeRange(allExternalEventsWithCoords)

/** Source labels for UI (Archive tabs). */
export const EXTERNAL_SOURCES = [
  { key: 'airbnb', label: 'Airbnb', events: airbnbEvents },
  { key: 'google-review', label: 'Google Review', events: googleReviewEvents },
  { key: 'noticias', label: 'Noticias', events: noticiasEvents },
  { key: 'noise', label: 'Ruido', events: getNoiseArchiveEvents() },
]
