/**
 * Convert datetime object to timestamp (ms since epoch)
 */
export function toTimestamp(dt) {
  if (!dt) return 0
  const d = new Date(
    dt.year ?? 1970,
    (dt.month ?? 1) - 1,
    dt.day ?? 1,
    dt.hour ?? 0,
    dt.minute ?? 0,
    dt.second ?? 0
  )
  return d.getTime()
}

const ONE_YEAR_MS = 365.25 * 24 * 3600 * 1000

/**
 * Get min/max timestamps from archive items
 */
export function getTimeRange(items) {
  const withDt = items.filter((i) => i.datetime && toTimestamp(i.datetime) > 0)
  if (withDt.length === 0) return { min: 0, max: Date.now() }
  const timestamps = withDt.map((i) => toTimestamp(i.datetime))
  return { min: Math.min(...timestamps), max: Math.max(...timestamps) }
}

/**
 * Extend a time range by one year at each end (for timeline navigation).
 * If range is invalid (min >= max), returns unchanged.
 */
export function extendTimeRangeByOneYear(range) {
  if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || range.max <= range.min) {
    return range || { min: 0, max: 0 }
  }
  return {
    min: Math.max(0, range.min - ONE_YEAR_MS),
    max: range.max + ONE_YEAR_MS,
  }
}

/**
 * Filter items to those within [minTs, maxTs] inclusive.
 * Only items with valid datetime in range are returned.
 */
export function filterItemsByRange(items, minTs, maxTs) {
  const withDt = items.filter((i) => i.datetime && toTimestamp(i.datetime) > 0)
  if (items.length === 0) return []
  if (typeof minTs !== 'number' || typeof maxTs !== 'number' || maxTs <= minTs) {
    return withDt
  }
  return withDt.filter((i) => {
    const ts = toTimestamp(i.datetime)
    return ts >= minTs && ts <= maxTs
  })
}

/**
 * Find nearest item to a given timestamp
 */
export function findNearestItem(items, timestamp) {
  const withDt = items.filter((i) => i.datetime && toTimestamp(i.datetime) > 0)
  if (withDt.length === 0) return null
  return withDt.reduce((nearest, item) => {
    const dist = Math.abs(toTimestamp(item.datetime) - timestamp)
    const nearestDist = Math.abs(toTimestamp(nearest.datetime) - timestamp)
    return dist < nearestDist ? item : nearest
  })
}

export const SCALES = ['year', 'month', 'day', 'hour', 'minute', 'second']

/** Milliseconds per unit for each scale (for wheel navigation) */
export function getScaleUnitMs(scale) {
  switch (scale) {
    case 'year':
      return 365.25 * 24 * 3600 * 1000
    case 'month':
      return 30.44 * 24 * 3600 * 1000
    case 'day':
      return 24 * 3600 * 1000
    case 'hour':
      return 3600 * 1000
    case 'minute':
      return 60 * 1000
    case 'second':
      return 1000
    default:
      return 24 * 3600 * 1000
  }
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format timestamp for display based on scale
 */
export function formatTimestamp(ts, scale) {
  if (!ts || ts <= 0) return '—'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  const h = d.getHours()
  const min = d.getMinutes()
  const sec = d.getSeconds()

  switch (scale) {
    case 'year':
      return String(y)
    case 'month':
      return `${MONTH_NAMES[m]} ${y}`
    case 'day':
      return `${day} ${MONTH_NAMES[m]} ${y}`
    case 'hour':
      return `${String(h).padStart(2, '0')}:00`
    case 'minute':
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    case 'second':
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    default:
      return d.toLocaleDateString()
  }
}

/**
 * Get tick positions and labels for timeline ruler (min, max, scale)
 * Returns array of { ts, label, position } where position is 0–100
 */
export function getTickLabels(minTs, maxTs, scale, maxTicks = 6) {
  if (!minTs || !maxTs || maxTs <= minTs) return []
  const range = maxTs - minTs
  const result = []

  const addTick = (ts) => {
    const position = ((ts - minTs) / range) * 100
    result.push({ ts, label: formatTimestamp(ts, scale), position })
  }

  const dMin = new Date(minTs)
  const dMax = new Date(maxTs)

  switch (scale) {
    case 'year': {
      const yMin = dMin.getFullYear()
      const yMax = dMax.getFullYear()
      const step = Math.max(1, Math.ceil((yMax - yMin + 1) / maxTicks))
      for (let y = yMin; y <= yMax; y += step) {
        addTick(new Date(y, 0, 1).getTime())
      }
      if (result[result.length - 1]?.ts !== maxTs) addTick(maxTs)
      break
    }
    case 'month': {
      let cur = new Date(dMin.getFullYear(), dMin.getMonth(), 1)
      const end = new Date(dMax.getFullYear(), dMax.getMonth(), 1)
      const totalMonths = (end.getFullYear() - cur.getFullYear()) * 12 + (end.getMonth() - cur.getMonth()) + 1
      const step = Math.max(1, Math.ceil(totalMonths / maxTicks))
      while (cur <= end) {
        addTick(cur.getTime())
        cur.setMonth(cur.getMonth() + step)
      }
      if (result.length > 0 && result[result.length - 1].ts !== maxTs) addTick(maxTs)
      break
    }
    case 'day': {
      const dayMs = 86400000
      const days = Math.ceil(range / dayMs)
      const step = Math.max(1, Math.ceil(days / maxTicks))
      for (let t = minTs; t <= maxTs; t += step * dayMs) {
        addTick(t)
      }
      if (result.length > 0 && result[result.length - 1].ts !== maxTs) addTick(maxTs)
      break
    }
    case 'hour': {
      const hourMs = 3600000
      const hours = range / hourMs
      const step = Math.max(1, Math.ceil(hours / maxTicks))
      const startHour = new Date(minTs)
      startHour.setMinutes(0, 0, 0)
      for (let t = startHour.getTime(); t <= maxTs; t += step * hourMs) {
        addTick(t)
      }
      if (result.length > 0 && result[result.length - 1].ts !== maxTs) addTick(maxTs)
      break
    }
    case 'minute': {
      const minMs = 60000
      const mins = range / minMs
      const step = Math.max(1, Math.ceil(mins / maxTicks))
      const startMin = new Date(minTs)
      startMin.setSeconds(0, 0)
      for (let t = startMin.getTime(); t <= maxTs; t += step * minMs) {
        addTick(t)
      }
      if (result.length > 0 && result[result.length - 1].ts !== maxTs) addTick(maxTs)
      break
    }
    case 'second': {
      const secMs = 1000
      const secs = range / secMs
      const step = Math.max(1, Math.ceil(secs / maxTicks))
      const startSec = new Date(minTs)
      startSec.setMilliseconds(0)
      for (let t = startSec.getTime(); t <= maxTs; t += step * secMs) {
        addTick(t)
      }
      if (result.length > 0 && result[result.length - 1].ts !== maxTs) addTick(maxTs)
      break
    }
    default:
      addTick(minTs)
      addTick(maxTs)
  }

  return result
}

/** Max grid lines to avoid overcrowding */
const MAX_GRID_LINES = 36

/**
 * Get grid line positions for scale-aware timeline divisions.
 * Returns array of { position } (0–100) for subtle background lines.
 */
export function getGridLines(minTs, maxTs, scale) {
  if (!minTs || !maxTs || maxTs <= minTs) return []
  const range = maxTs - minTs
  const result = []

  const addLine = (ts) => {
    const position = ((ts - minTs) / range) * 100
    result.push({ position })
  }

  const dMin = new Date(minTs)
  const dMax = new Date(maxTs)

  switch (scale) {
    case 'year': {
      const yMin = dMin.getFullYear()
      const yMax = dMax.getFullYear()
      const total = yMax - yMin + 1
      const step = Math.max(1, Math.ceil(total / MAX_GRID_LINES))
      for (let y = yMin; y <= yMax; y += step) {
        addLine(new Date(y, 0, 1).getTime())
      }
      break
    }
    case 'month': {
      let cur = new Date(dMin.getFullYear(), dMin.getMonth(), 1)
      const end = new Date(dMax.getFullYear(), dMax.getMonth(), 1)
      const totalMonths =
        (end.getFullYear() - cur.getFullYear()) * 12 + (end.getMonth() - cur.getMonth()) + 1
      const step = Math.max(1, Math.ceil(totalMonths / MAX_GRID_LINES))
      while (cur <= end) {
        addLine(cur.getTime())
        cur.setMonth(cur.getMonth() + step)
      }
      break
    }
    case 'day': {
      const dayMs = 86400000
      const days = Math.ceil(range / dayMs)
      const step = Math.max(1, Math.ceil(days / MAX_GRID_LINES))
      for (let t = minTs; t <= maxTs; t += step * dayMs) {
        addLine(t)
      }
      break
    }
    case 'hour': {
      const hourMs = 3600000
      const hours = range / hourMs
      const step = Math.max(1, Math.ceil(hours / MAX_GRID_LINES))
      const startHour = new Date(minTs)
      startHour.setMinutes(0, 0, 0)
      for (let t = startHour.getTime(); t <= maxTs; t += step * hourMs) {
        addLine(t)
      }
      break
    }
    case 'minute': {
      const minMs = 60000
      const mins = range / minMs
      const step = Math.max(1, Math.ceil(mins / MAX_GRID_LINES))
      const startMin = new Date(minTs)
      startMin.setSeconds(0, 0)
      for (let t = startMin.getTime(); t <= maxTs; t += step * minMs) {
        addLine(t)
      }
      break
    }
    case 'second': {
      const secMs = 1000
      const secs = range / secMs
      const step = Math.max(1, Math.ceil(secs / MAX_GRID_LINES))
      const startSec = new Date(minTs)
      startSec.setMilliseconds(0)
      for (let t = startSec.getTime(); t <= maxTs; t += step * secMs) {
        addLine(t)
      }
      break
    }
    default:
      break
  }

  return result
}
