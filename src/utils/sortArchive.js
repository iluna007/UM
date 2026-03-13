import { groupByYear } from './groupByYear'

function getCategories(item) {
  const c = item.category
  return Array.isArray(c) ? c : (c ? [c] : [])
}

export function groupByCategory(items) {
  return items.reduce((acc, item) => {
    const cats = getCategories(item)
    if (cats.length === 0) {
      const key = 'uncategorized'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
    } else {
      cats.forEach((cat) => {
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
      })
    }
    return acc
  }, {})
}

export function sortByDate(items, order = 'desc') {
  return [...items].sort((a, b) => {
    const [monthA, yearA] = a.date.split('.').map(Number)
    const [monthB, yearB] = b.date.split('.').map(Number)
    const dateA = yearA * 12 + monthA
    const dateB = yearB * 12 + monthB
    return order === 'desc' ? dateB - dateA : dateA - dateB
  })
}

export function sortByTitle(items, order = 'asc') {
  return [...items].sort((a, b) => {
    const titleA = (a.title ?? '').toLowerCase()
    const titleB = (b.title ?? '').toLowerCase()
    const cmp = titleA.localeCompare(titleB)
    return order === 'asc' ? cmp : -cmp
  })
}

export function sortByStatus(items, order = 'asc') {
  return [...items].sort((a, b) => {
    const statusA = (a.others?.status ?? '').toLowerCase()
    const statusB = (b.others?.status ?? '').toLowerCase()
    const cmp = statusA.localeCompare(statusB)
    return order === 'asc' ? cmp : -cmp
  })
}

export const SORT_OPTIONS = {
  date: { label: 'Date', group: false },
  title: { label: 'Title', group: false },
  year: { label: 'Year', group: true, groupFn: groupByYear },
  category: { label: 'Category', group: true, groupFn: groupByCategory },
  status: { label: 'Status', group: false },
}

export function getSortedArchive(archive, sortBy) {
  const opt = SORT_OPTIONS[sortBy]
  if (!opt) return { grouped: { all: archive }, keys: ['all'] }

  if (opt.group) {
    const sorted = sortBy === 'year'
      ? sortByDate(archive, 'desc')
      : sortByTitle(archive, 'asc')
    const grouped = opt.groupFn(sorted)
    const keys = Object.keys(grouped).sort((a, b) => {
      if (sortBy === 'year') return Number(b) - Number(a)
      return a.localeCompare(b)
    })
    return { grouped, keys }
  }

  let sorted
  if (sortBy === 'date') sorted = sortByDate(archive, 'desc')
  else if (sortBy === 'title') sorted = sortByTitle(archive, 'asc')
  else if (sortBy === 'status') sorted = sortByStatus(archive, 'asc')
  else sorted = archive

  return { grouped: { all: sorted }, keys: ['all'] }
}
