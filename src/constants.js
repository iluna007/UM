export const NAV_ITEMS = [
  { key: 'archive', label: 'Data', hash: '#pages' },
  { key: 'map', label: 'Mapa interactivo', hash: '#map' },
  { key: 'reflections', label: 'Análisis', hash: '#reflections' },
  { key: 'about', label: 'Acerca de', hash: '#about' },
]

export function getRouteFromHash() {
  const hash = window.location.hash.slice(1) || 'pages'
  if (hash === 'map') return 'map'
  if (hash === 'reflections') return 'reflections'
  if (hash === 'about') return 'about'
  return 'archive'
}
