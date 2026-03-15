import { useRef, useState, useEffect, useMemo } from 'react'
import {
  toTimestamp,
  findNearestItem,
  SCALES,
  formatTimestamp,
  getTickLabels,
  getGridLines,
  getScaleUnitMs,
} from '../utils/datetime'
import { getUniqueCategories, getItemCategories, getCategoryColor, CATEGORY_COLORS } from '../utils/categoryColors'

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS)

const ZOOM_FACTOR = 0.5
const WHEEL_PIXELS_PER_UNIT = 12
const MIN_ZOOM_RANGE_MS = 3600000

export default function InteractiveTimeline({
  items,
  visibleItems,
  selectedItem,
  onSelectItem,
  scale,
  onScaleChange,
  viewRange,
  onViewRangeChange,
  fullRange,
  categoryOrder = null,
  categoryLabels = null,
}) {
  const trackRef = useRef(null)
  const onViewRangeChangeRef = useRef(onViewRangeChange)
  onViewRangeChangeRef.current = onViewRangeChange

  const { min, max } = viewRange
  const range = max - min || 1
  const isZoomed = min > fullRange.min || max < fullRange.max

  const ticks = getTickLabels(min, max, scale, 5)
  const gridLines = getGridLines(min, max, scale)

  const handleTrackClick = (e) => {
    if (didDragRef.current) return
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const ratio = 1 - y / rect.height
    const timestamp = min + ratio * range
    const nearest = findNearestItem(visibleItems, timestamp)
    if (nearest) onSelectItem(nearest)
  }

  const handleTrackDoubleClick = (e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const ratio = 1 - y / rect.height
    const timestamp = min + ratio * range
    const newRange = range * ZOOM_FACTOR
    const newMin = Math.max(fullRange.min, timestamp - newRange / 2)
    const newMax = Math.min(fullRange.max, newMin + newRange)
    const clampedMin = Math.max(fullRange.min, newMax - newRange)
    onViewRangeChangeRef.current({ min: clampedMin, max: newMax })
  }

  const handleResetZoom = () => {
    onViewRangeChangeRef.current({ min: fullRange.min, max: fullRange.max })
  }

  const [dragStart, setDragStart] = useState(null)
  const didDragRef = useRef(false)

  const [wheelSpin, setWheelSpin] = useState(null)
  const didWheelSpinRef = useRef(false)
  const wheelSpinRef = useRef(null)

  const handleScaleMouseDown = (e, s) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    didWheelSpinRef.current = false
    const data = { scale: s, startY: e.clientY, startMin: min, startMax: max }
    wheelSpinRef.current = data
    setWheelSpin(data)
  }

  useEffect(() => {
    if (!wheelSpin) return
    const onMove = (e) => {
      const data = wheelSpinRef.current
      if (!data) return
      didWheelSpinRef.current = true
      const unitMs = getScaleUnitMs(data.scale)
      const totalDeltaY = data.startY - e.clientY
      const units = totalDeltaY / WHEEL_PIXELS_PER_UNIT
      const shiftMs = units * unitMs
      let newMin = data.startMin + shiftMs
      let newMax = data.startMax + shiftMs
      const rangeSize = data.startMax - data.startMin
      if (newMin < fullRange.min) {
        newMin = fullRange.min
        newMax = Math.min(fullRange.max, fullRange.min + rangeSize)
      }
      if (newMax > fullRange.max) {
        newMax = fullRange.max
        newMin = Math.max(fullRange.min, fullRange.max - rangeSize)
      }
      onViewRangeChangeRef.current({ min: newMin, max: newMax })
    }
    const onUp = () => {
      const data = wheelSpinRef.current
      if (!didWheelSpinRef.current && data) onScaleChange(data.scale)
      wheelSpinRef.current = null
      setWheelSpin(null)
    }
    window.addEventListener('mousemove', onMove, { capture: true })
    window.addEventListener('mouseup', onUp, { capture: true })
    return () => {
      window.removeEventListener('mousemove', onMove, { capture: true })
      window.removeEventListener('mouseup', onUp, { capture: true })
    }
  }, [wheelSpin, fullRange.min, fullRange.max, onScaleChange])

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setDragStart({ y: e.clientY, min, max })
      didDragRef.current = false
    }
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const y = e.clientY - rect.top
      const ratio = 1 - y / rect.height
      const centerTs = min + ratio * range
      const delta = e.deltaY > 0 ? 1.25 : 0.8
      let newRange = range * delta
      newRange = Math.max(MIN_ZOOM_RANGE_MS, Math.min(fullRange.max - fullRange.min, newRange))
      let newMin = centerTs - newRange / 2
      let newMax = centerTs + newRange / 2
      if (newMin < fullRange.min) {
        newMin = fullRange.min
        newMax = Math.min(fullRange.max, fullRange.min + newRange)
      }
      if (newMax > fullRange.max) {
        newMax = fullRange.max
        newMin = Math.max(fullRange.min, fullRange.max - newRange)
      }
      onViewRangeChangeRef.current({ min: newMin, max: newMax })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [min, max, range, fullRange.min, fullRange.max])

  useEffect(() => {
    if (!dragStart) return
    const onMove = (e) => {
      didDragRef.current = true
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const dy = (e.clientY - dragStart.y) / rect.height
      const rangeSize = dragStart.max - dragStart.min
      const delta = dy * rangeSize
      const newMin = Math.max(fullRange.min, Math.min(fullRange.max - rangeSize, dragStart.min + delta))
      onViewRangeChangeRef.current({ min: newMin, max: newMin + rangeSize })
    }
    const onUp = () => setDragStart(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragStart, fullRange.min, fullRange.max])

  const itemsWithDt = items.filter((i) => i.datetime && toTimestamp(i.datetime) > 0)
  const categories = useMemo(() => {
    if (categoryOrder && Array.isArray(categoryOrder) && categoryOrder.length > 0) {
      return categoryOrder
    }
    const fromItems = getUniqueCategories(itemsWithDt)
    return fromItems.length >= ALL_CATEGORIES.length
      ? fromItems
      : [...new Set([...ALL_CATEGORIES, ...fromItems])].sort()
  }, [itemsWithDt, categoryOrder])

  const getCategoryLabel = (cat) => (categoryLabels && categoryLabels[cat]) || cat

  return (
    <div className="interactive-timeline">
      <div className="timeline-main">
        <div className="timeline-track-wrapper">
          <div
            ref={trackRef}
            className={`timeline-track ${dragStart ? 'timeline-dragging' : ''}`}
            onClick={handleTrackClick}
            onDoubleClick={handleTrackDoubleClick}
            onMouseDown={handleMouseDown}
            role="slider"
            aria-label="Timeline: scroll to zoom, double-click to zoom in, drag to pan"
            title="Scroll: zoom · Double-click: zoom in · Drag: pan"
            tabIndex={0}
          >
            <div className="timeline-grid">
            {gridLines.map((line, i) => (
              <div
                key={i}
                className="timeline-grid-line"
                style={{ bottom: `${line.position}%` }}
              />
            ))}
          </div>
          {categories.length <= 1 && <div className="timeline-ruler" />}
          {ticks.map((tick) => (
            <div
              key={tick.ts}
              className="timeline-tick"
              style={{ bottom: `${tick.position}%` }}
              title={tick.label}
            >
              <span className="timeline-tick-line" />
              <span className="timeline-tick-label">{tick.label}</span>
            </div>
          ))}
          <div className="timeline-bands">
            {categories.length === 0 ? (
              <div className="timeline-band" style={{ flex: 1, minHeight: 0 }}>
                {itemsWithDt.map((item) => {
                  const ts = toTimestamp(item.datetime)
                  const position = ((ts - min) / range) * 100
                  const isSelected = selectedItem?.id === item.id
                  const isInView = position >= 0 && position <= 100
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`timeline-marker ${isSelected ? 'selected' : ''} ${!isInView ? 'timeline-marker-outside' : ''}`}
                      style={{ bottom: `${position}%` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isInView) onSelectItem(item)
                      }}
                      title={`${item.title} — ${formatTimestamp(ts, scale)}`}
                    >
                      <span className="timeline-marker-dot" />
                    </button>
                  )
                })}
              </div>
            ) : (
            categories.map((category) => (
              <div
                key={category}
                className="timeline-band timeline-band-parallel"
              >
                <span
                  className="timeline-band-label"
                  style={{ color: getCategoryColor(category) }}
                >
                  {getCategoryLabel(category)}
                </span>
                {itemsWithDt
                  .filter((item) => getItemCategories(item).includes(category))
                  .map((item) => {
                    const ts = toTimestamp(item.datetime)
                    const position = ((ts - min) / range) * 100
                    const isSelected = selectedItem?.id === item.id
                    const isInView = position >= 0 && position <= 100

                    return (
                      <button
                        key={`${item.id}-${category}`}
                        type="button"
                        className={`timeline-marker ${isSelected ? 'selected' : ''} ${!isInView ? 'timeline-marker-outside' : ''}`}
                        style={{
                          bottom: `${position}%`,
                          ['--marker-color']: getCategoryColor(category),
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isInView) onSelectItem(item)
                        }}
                        title={`${item.title} — ${formatTimestamp(ts, scale)} (${getCategoryLabel(category)})`}
                      >
                        <span className="timeline-marker-dot" />
                      </button>
                    )
                  })}
              </div>
            ))
            )}
          </div>
        </div>
        </div>
      </div>
      <div className="timeline-scales">
        <div className="timeline-legend timeline-legend-top">
          <span className="timeline-legend-label">{formatTimestamp(max, scale)}</span>
        </div>
        {SCALES.map((s) => (
          <button
            key={s}
            type="button"
            className={`timeline-scale-btn ${scale === s ? 'active' : ''} ${wheelSpin?.scale === s ? 'spinning' : ''}`}
            onMouseDown={(e) => handleScaleMouseDown(e, s)}
            title={`Arrastra arriba/abajo para navegar en ${s}`}
          >
            <span className="timeline-scale-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
          </button>
        ))}
        <div className="timeline-legend timeline-legend-bottom">
          <span className="timeline-legend-label">{formatTimestamp(min, scale)}</span>
        </div>
        {categories.length > 0 && (
          <div className="timeline-category-legend">
            {categories.map((cat) => (
              <span key={cat} className="timeline-category-legend-item" title={getCategoryLabel(cat)}>
                <span className="timeline-category-legend-dot" style={{ background: getCategoryColor(cat) }} />
                <span className="timeline-category-legend-label">{getCategoryLabel(cat)}</span>
              </span>
            ))}
          </div>
        )}
        {isZoomed && (
          <button
            type="button"
            className="timeline-reset-btn"
            onClick={handleResetZoom}
            title="View full range"
            aria-label="Reset zoom"
          >
            ⊡
          </button>
        )}
      </div>
    </div>
  )
}
