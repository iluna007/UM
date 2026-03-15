/**
 * Category colors for timeline and map markers.
 */
export const CATEGORY_COLORS = {
  category1: '#e74c3c',
  category2: '#3498db',
  category3: '#2ecc71',
  category4: '#f39c12',
  category5: '#9b59b6',
  airbnb: '#ff5a5f',
  'airbnb-1': '#c0392b',
  'airbnb-2': '#e67e22',
  'airbnb-3': '#f1c40f',
  'airbnb-4': '#27ae60',
  'airbnb-5': '#1e8449',
  'google-review': '#4285f4',
  noticias: '#34a853',
  asc1: '#e74c3c',
  asc2: '#9b59b6',
  asc3: '#f39c12',
  asc4: '#3498db',
  asc5: '#1abc9c',
  asc6: '#2ecc71',
  asc7: '#e67e22',
  asc8: '#34495e',
}

const DEFAULT_COLOR = '#95a5a6'

export function getCategoryColor(category) {
  if (!category) return DEFAULT_COLOR
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR
}

export function getItemPrimaryColor(item) {
  const cats = Array.isArray(item?.category) ? item.category : item?.category ? [item.category] : []
  return cats.length > 0 ? getCategoryColor(cats[0]) : DEFAULT_COLOR
}

/** Hex to rgba with alpha for translucent backgrounds */
export function hexToRgba(hex, alpha = 0.2) {
  if (!hex || typeof hex !== 'string') return `rgba(128, 128, 128, ${alpha})`
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!m) return `rgba(128, 128, 128, ${alpha})`
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getItemCategories(item) {
  const c = item?.category
  return Array.isArray(c) ? c : (c ? [c] : [])
}

export function getUniqueCategories(items) {
  const set = new Set()
  items.forEach((item) => {
    getItemCategories(item).forEach((cat) => set.add(cat))
  })
  return Array.from(set).sort()
}
