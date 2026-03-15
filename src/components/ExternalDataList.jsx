import { useState } from 'react'
import { getSortedArchive } from '../utils/sortArchive'
import TableHeader from './TableHeader'
import ProjectRow from './ProjectRow'
import DetailPanel from './DetailPanel'

export default function ExternalDataList({ events, sourceLabel, theme = 'light', onProjectClick }) {
  const [sortBy, setSortBy] = useState('year')
  const [selectedItem, setSelectedItem] = useState(null)
  const { grouped, keys } = getSortedArchive(events, sortBy)

  const handleRowClick = (item) => {
    setSelectedItem(item)
    onProjectClick?.(item.id)
  }

  return (
    <div className="list-wrapper full-width external-data-list">
      <div className="table-container">
        <TableHeader sortBy={sortBy} onSort={setSortBy} />
        <div className="project-list full-list-view">
          {keys.map((key) => (
            <section key={key} className="year-group">
              {keys.length > 1 && <h2 className="year-label">{key}</h2>}
              {grouped[key].map((item) => (
                <div key={item.id} className="project-item-full">
                  <button
                    type="button"
                    className="project-row clickable"
                    onClick={() => handleRowClick(item)}
                  >
                    <ProjectRow item={item} />
                  </button>
                  <hr className="project-divider" />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
      {selectedItem && (
        <div
          className="external-data-detail"
          style={{ borderLeftColor: 'var(--color-accent, #2563eb)' }}
        >
          <button
            type="button"
            className="interactive-map-close"
            onClick={() => setSelectedItem(null)}
            aria-label="Cerrar panel"
          >
            ×
          </button>
          <DetailPanel item={selectedItem} hideMap theme={theme} />
          {selectedItem.raw && (
            <div className="detail-raw-meta">
              <span className="detail-source-badge">{sourceLabel}</span>
              {selectedItem.raw.location && (
                <small>📍 {selectedItem.raw.location}</small>
              )}
              {selectedItem.raw.keywords && (
                <small>Keywords: {selectedItem.raw.keywords}</small>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
