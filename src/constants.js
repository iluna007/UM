export const VIEWS = {
  thumbnail: 'thumbnail',
  fullList: 'full-list',
}

export const ROUTES = {
  archive: 'pages',
  fullList: 'full-list-view',
  map: 'map',
  reflections: 'reflections',
  about: 'about',
}

export const NAV_ITEMS = [
  { key: 'archive', label: 'Archive', hash: '#pages' },
  { key: 'map', label: 'Interactive Map', hash: '#map' },
  { key: 'reflections', label: 'Reflections', hash: '#reflections' },
  { key: 'about', label: 'About', hash: '#about' },
]

export function getViewFromHash() {
  const hash = window.location.hash.slice(1)
  return hash === 'full-list-view' ? VIEWS.fullList : VIEWS.thumbnail
}

export function getRouteFromHash() {
  const hash = window.location.hash.slice(1) || 'pages'
  if (hash === 'full-list-view') return 'fullList'
  if (hash === 'map') return 'map'
  if (hash === 'reflections') return 'reflections'
  if (hash === 'about') return 'about'
  return 'archive'
}
