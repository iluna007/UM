/**
 * Datos externos combinados (Ruido, helpers). Airbnb / Google Review / Noticias
 * se cargan en diferido vía externalDataLoader.js para mejorar rendimiento.
 */

import { getTracksNoisePoints } from './tracksLoader'
import { EXTERNAL_SOURCE_KEYS, useLazyExternalSource, loadSource } from './externalDataLoader'

export { EXTERNAL_SOURCE_KEYS, useLazyExternalSource, loadSource } from './externalDataLoader'

/** Ruido como eventos tipo archivo (pestaña Ruido). */
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

/**
 * EXTERNAL_SOURCES para la UI: keys + labels. Los events por pestaña se obtienen
 * con useLazyExternalSource(key) o getNoiseArchiveEvents() para Ruido.
 */
export const EXTERNAL_SOURCES = EXTERNAL_SOURCE_KEYS.map(({ key, label }) => ({
  key,
  label,
  events: key === 'noise' ? getNoiseArchiveEvents() : [],
}))
