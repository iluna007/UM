/**
 * Worker: fetch + JSON.parse en segundo plano para no bloquear el hilo principal.
 * Uso: postMessage({ type: 'parse', url: '/data/airbnb.json' }) -> recibe el objeto parseado.
 */
self.onmessage = async (e) => {
  const { type, url } = e.data || {}
  if (type !== 'parse' || !url) {
    self.postMessage({ error: 'Invalid message: need { type: "parse", url: string }' })
    return
  }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    self.postMessage({ data: json })
  } catch (err) {
    self.postMessage({ error: err?.message || String(err) })
  }
}
