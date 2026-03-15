import { useState } from 'react'
import { getSortedArchive } from '../utils/sortArchive'

const archive = []
import TableHeader from './TableHeader'
import ProjectRow from './ProjectRow'

export default function FullListView({ onProjectClick }) {
  const [sortBy, setSortBy] = useState('year')
  const { grouped, keys } = getSortedArchive(archive, sortBy)

  return (
    <div className="list-wrapper full-width">
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
                  onClick={() => onProjectClick?.(item.id)}
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
    </div>
  )
}
