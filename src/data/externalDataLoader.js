/**
 * Carga diferida por fuente: solo importa airbnb / google-review / noticias
 * cuando el usuario navega a esa sección. Opcionalmente parsea JSON grande en worker.
 */

import { useState, useEffect } from 'react'
import { normalizeEvents } from '../utils/normalizeExternalData'
import { createGoogleReviewFromRaw } from './googleReviewProcessor'
import { createNoticiasFromRaw } from './noticiasProcessor'

const cache = new Map()

const AIRBNB_STAR_ASSOCIATIONS = [
  { id: 'airbnb-1', title: '1 estrella' },
  { id: 'airbnb-2', title: '2 estrellas' },
  { id: 'airbnb-3', title: '3 estrellas' },
  { id: 'airbnb-4', title: '4 estrellas' },
  { id: 'airbnb-5', title: '5 estrellas' },
]
const AIRBNB_STAR_IDS = AIRBNB_STAR_ASSOCIATIONS.map((a) => a.id)

function parseJsonInWorker(pathname) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./jsonParse.worker.js', import.meta.url), { type: 'module' })
      const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
      const url = `${base}${pathname.startsWith('/') ? pathname : `/data/${pathname}`}`
      worker.onmessage = (e) => {
        worker.terminate()
        if (e.data?.error) reject(new Error(e.data.error))
        else resolve(e.data?.data)
      }
      worker.onerror = (err) => {
        worker.terminate()
        reject(err)
      }
      worker.postMessage({ type: 'parse', url })
    } catch (err) {
      reject(err)
    }
  })
}

function loadAirbnb() {
  if (cache.has('airbnb')) return cache.get('airbnb')
  const p = (async () => {
    try {
      const raw = await parseJsonInWorker('/data/airbnb.json')
      const events = Array.isArray(raw?.sheets?.events) ? raw.sheets.events : []
      const airbnbEvents = normalizeEvents(events, 'airbnb')
      const airbnbEventsWithCoords = airbnbEvents.filter(
        (e) => e.coordinates && e.coordinates.lat != null && e.coordinates.lng != null
      )
      const module = {
        airbnbEvents,
        airbnbEventsWithCoords,
        AIRBNB_STAR_ASSOCIATIONS,
        AIRBNB_STAR_IDS,
      }
      return { events: airbnbEvents, eventsWithCoords: airbnbEventsWithCoords, module }
    } catch (_) {
      const m = await import('./airbnb')
      return {
        events: m.airbnbEvents,
        eventsWithCoords: m.airbnbEventsWithCoords,
        module: m,
      }
    }
  })()
  cache.set('airbnb', p)
  return p
}

function loadGoogleReview() {
  if (cache.has('google-review')) return cache.get('google-review')
  const p = (async () => {
    try {
      const raw = await parseJsonInWorker('/data/google-review.json')
      return createGoogleReviewFromRaw(raw)
    } catch (_) {
      const m = await import('./googleReview')
      return {
        events: m.googleReviewEvents,
        eventsWithCoords: m.googleReviewEventsWithCoords,
        module: m,
      }
    }
  })()
  cache.set('google-review', p)
  return p
}

function loadNoticias() {
  if (cache.has('noticias')) return cache.get('noticias')
  const p = (async () => {
    try {
      const raw = await parseJsonInWorker('/data/noticias.json')
      return createNoticiasFromRaw(raw)
    } catch (_) {
      const m = await import('./noticias')
      return {
        events: m.noticiasEvents,
        eventsWithCoords: m.noticiasEventsWithCoords,
        module: m,
      }
    }
  })()
  cache.set('noticias', p)
  return p
}

/**
 * Carga una fuente por clave. Devuelve una promesa que se resuelve con
 * { events, eventsWithCoords, module } (module expone asociaciones, etc.).
 * @param {'airbnb'|'google-review'|'noticias'} sourceKey
 * @returns {Promise<{ events: unknown[], eventsWithCoords: unknown[], module: object }>}
 */
export function loadSource(sourceKey) {
  switch (sourceKey) {
    case 'airbnb':
      return loadAirbnb()
    case 'google-review':
      return loadGoogleReview()
    case 'noticias':
      return loadNoticias()
    default:
      return Promise.reject(new Error(`Unknown source: ${sourceKey}`))
  }
}

/** Lista estática de fuentes para pestañas (sin cargar datos). */
export const EXTERNAL_SOURCE_KEYS = [
  { key: 'airbnb', label: 'Airbnb' },
  { key: 'google-review', label: 'Google Review' },
  { key: 'noticias', label: 'Noticias' },
  { key: 'noise', label: 'Ruido' },
]

/**
 * Hook: carga la fuente solo cuando se usa y devuelve { events, eventsWithCoords, module, loading, error }.
 * Para 'noise' no hace carga async; el consumidor debe usar getNoiseArchiveEvents() por separado.
 */
export function useLazyExternalSource(sourceKey) {
  const [state, setState] = useState({
    events: [],
    eventsWithCoords: [],
    module: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    if (!sourceKey || sourceKey === 'noise') {
      setState({ events: [], eventsWithCoords: [], module: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    loadSource(sourceKey)
      .then(({ events, eventsWithCoords, module }) => {
        setState({
          events: events ?? [],
          eventsWithCoords: eventsWithCoords ?? [],
          module,
          loading: false,
          error: null,
        })
      })
      .catch((err) => {
        setState({
          events: [],
          eventsWithCoords: [],
          module: null,
          loading: false,
          error: err,
        })
      })
  }, [sourceKey])

  return state
}
