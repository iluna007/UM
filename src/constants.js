export const VIEWS = {
  thumbnail: 'thumbnail',
  fullList: 'full-list',
}

export const ROUTES = {
  archive: 'pages',
  fullList: 'full-list-view',
  map: 'map',
  sound: 'sound',
  interviews: 'interviews',
  radar: 'radar',
  timeline: 'timeline',
  reflections: 'reflections',
}

export const NAV_ITEMS = [
  { key: 'archive', label: 'Archive', hash: '#pages' },
  { key: 'map', label: 'Interactive Map', hash: '#map' },
  { key: 'sound', label: 'Sound Analysis', hash: '#sound' },
  { key: 'interviews', label: 'Interviews', hash: '#interviews' },
  { key: 'radar', label: 'Radar Systems', hash: '#radar' },
  { key: 'timeline', label: 'Historical Timeline', hash: '#timeline' },
  { key: 'reflections', label: 'Reflections', hash: '#reflections' },
]

export function getViewFromHash() {
  const hash = window.location.hash.slice(1)
  return hash === 'full-list-view' ? VIEWS.fullList : VIEWS.thumbnail
}

export function getRouteFromHash() {
  const hash = window.location.hash.slice(1) || 'pages'
  if (hash === 'full-list-view') return 'fullList'
  if (hash === 'map') return 'map'
  if (hash === 'sound') return 'sound'
  if (hash === 'interviews') return 'interviews'
  if (hash === 'radar') return 'radar'
  if (hash === 'timeline') return 'timeline'
  if (hash === 'reflections') return 'reflections'
  return 'archive'
}
