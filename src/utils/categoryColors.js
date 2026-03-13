/**
 * Category colors for timeline and map markers.
 */
export const CATEGORY_COLORS = {
  category1: '#e74c3c',
  category2: '#3498db',
  category3: '#2ecc71',
  category4: '#f39c12',
  category5: '#9b59b6',
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
