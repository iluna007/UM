/**
 * Format "associations" for display: star rating (★/☆) for Airbnb, association titles for others.
 */

import { AIRBNB_STAR_ASSOCIATIONS } from '../data/airbnb'
import { GOOGLE_REVIEW_ASSOCIATIONS } from '../data/googleReview'
import { NOTICIAS_ASSOCIATIONS } from '../data/noticias'

/**
 * @param {object} item - Normalized event (has source, raw)
 * @param {string} value - Raw associations value (e.g. "asc4", "asc2, asc4")
 * @returns {string} Display string: "★★★★☆ 4 estrellas" for Airbnb, or association titles for others
 */
export function formatAssociationsDisplay(item, value) {
  const source = item?.source
  const raw = item?.raw || item
  if (source === 'airbnb') {
    const ratingStr = String(raw?.rating ?? '').replace(',', '.')
    const ratingNum = parseFloat(ratingStr)
    const stars = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : 3
    const title = AIRBNB_STAR_ASSOCIATIONS.find((a) => a.id === `airbnb-${stars}`)?.title ?? `${stars} estrellas`
    const filled = '★'.repeat(stars)
    const empty = '☆'.repeat(5 - stars)
    return `${filled}${empty} ${title}`
  }
  const ids = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const titles = []
  const lists = {
    'google-review': GOOGLE_REVIEW_ASSOCIATIONS,
    noticias: NOTICIAS_ASSOCIATIONS,
  }
  const list = lists[source]
  ids.forEach((id) => {
    const t = list?.find((a) => a.id === id)?.title ?? id
    titles.push(t)
  })
  return titles.length ? titles.join(', ') : String(value)
}
