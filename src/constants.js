export const NAV_ITEMS = [
  { key: 'archive', label: 'Archive', hash: '#pages' },
  { key: 'map', label: 'Interactive Map', hash: '#map' },
  { key: 'reflections', label: 'Reflections', hash: '#reflections' },
  { key: 'about', label: 'About', hash: '#about' },
]

export function getRouteFromHash() {
  const hash = window.location.hash.slice(1) || 'pages'
  if (hash === 'map') return 'map'
  if (hash === 'reflections') return 'reflections'
  if (hash === 'about') return 'about'
  return 'archive'
}
