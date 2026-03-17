import { useRef, useState, useEffect, useMemo } from 'react'
import {
  toTimestamp,
  findNearestItem,
  formatTimestamp,
  getTickLabels,
  getGridLines,
} from '../utils/datetime'
import { getUniqueCategories, getItemCategories, getCategoryColor, CATEGORY_COLORS } from '../utils/categoryColors'

const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS)

const ZOOM_FACTOR = 0.5
const ZOOM_IN_RATIO = 0.7
const ZOOM_OUT_RATIO = 1.4
const STEP_RATIO = 0.25
const ONE_YEAR_MS = 365.25 * 24 * 3600 * 1000
const MIN_ZOOM_RANGE_MS = 3600000

/** Escala de visualización según el rango visible (años vs meses). */
function getDisplayScale(rangeMs) {
  return rangeMs > 2 * ONE_YEAR_MS ? 'year' : 'month'
}

export default function InteractiveTimeline({
  items,
  visibleItems,
  selectedItem,
  onSelectItem,
  scale: _scale,
  onScaleChange: _onScaleChange,
  viewRange,
  onViewRangeChange,
  fullRange,
  categoryOrder = null,
  categoryLabels = null,
  compactMode = false,
}) {
  const trackRef = useRef(null)
  const onViewRangeChangeRef = useRef(onViewRangeChange)
  onViewRangeChangeRef.current = onViewRangeChange

  const { min, max } = viewRange
  const range = max - min || 1
  const isZoomed = fullRange.max > fullRange.min && (min > fullRange.min || max < fullRange.max)
  const displayScale = getDisplayScale(range)
  const ticks = getTickLabels(min, max, displayScale, 5)
  const gridLines = getGridLines(min, max, displayScale)

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

  const fullRangeSize = fullRange.max - fullRange.min || 1
  const stepMs = Math.min(range * STEP_RATIO, ONE_YEAR_MS)

  const handleZoomIn = () => {
    const center = (min + max) / 2
    let newRange = range * ZOOM_IN_RATIO
    newRange = Math.max(MIN_ZOOM_RANGE_MS, Math.min(fullRangeSize, newRange))
    let newMin = center - newRange / 2
    let newMax = center + newRange / 2
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

  const handleZoomOut = () => {
    const center = (min + max) / 2
    let newRange = range * ZOOM_OUT_RATIO
    newRange = Math.max(MIN_ZOOM_RANGE_MS, Math.min(fullRangeSize, newRange))
    let newMin = center - newRange / 2
    let newMax = center + newRange / 2
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

  const handleStepBack = () => {
    const rangeSize = max - min
    let newMin = min - stepMs
    let newMax = max - stepMs
    if (newMin < fullRange.min) {
      newMin = fullRange.min
      newMax = Math.min(fullRange.max, fullRange.min + rangeSize)
    }
    onViewRangeChangeRef.current({ min: newMin, max: newMax })
  }

  const handleStepForward = () => {
    const rangeSize = max - min
    let newMin = min + stepMs
    let newMax = max + stepMs
    if (newMax > fullRange.max) {
      newMax = fullRange.max
      newMin = Math.max(fullRange.min, fullRange.max - rangeSize)
    }
    onViewRangeChangeRef.current({ min: newMin, max: newMax })
  }

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
    <div className={`interactive-timeline${compactMode ? ' interactive-timeline--compact' : ''}`}>
      <div className="timeline-zoom-toolbar">
        <button
          type="button"
          className="timeline-zoom-btn timeline-zoom-back"
          onClick={handleStepBack}
          title="Atrás en el tiempo"
          aria-label="Atrás"
        >
          ← Atrás
        </button>
        <button
          type="button"
          className="timeline-zoom-btn timeline-zoom-fwd"
          onClick={handleStepForward}
          title="Adelante en el tiempo"
          aria-label="Adelante"
        >
          Adelante →
        </button>
        <button
          type="button"
          className="timeline-zoom-btn timeline-zoom-out"
          onClick={handleZoomOut}
          title="Alejar (zoom out)"
          aria-label="Zoom out"
        >
          − Zoom out
        </button>
        <button
          type="button"
          className="timeline-zoom-btn timeline-zoom-in"
          onClick={handleZoomIn}
          title="Acercar (zoom in)"
          aria-label="Zoom in"
        >
          + Zoom in
        </button>
        <span
          className="timeline-zoom-range"
          title={`${formatTimestamp(min, displayScale)} — ${formatTimestamp(max, displayScale)}. Rueda: zoom · Arrastrar: mover`}
        >
          {formatTimestamp(min, displayScale)} — {formatTimestamp(max, displayScale)}
        </span>
        {isZoomed && (
          <button
            type="button"
            className="timeline-zoom-reset"
            onClick={handleResetZoom}
            title="Ver todo el rango"
            aria-label="Restablecer zoom"
          >
            ⊡ Todo
          </button>
        )}
      </div>
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
                      title={`${item.title} — ${formatTimestamp(ts, displayScale)}`}
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
                        title={`${item.title} — ${formatTimestamp(ts, displayScale)} (${getCategoryLabel(category)})`}
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
    </div>
  )
}
