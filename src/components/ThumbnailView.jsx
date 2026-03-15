import { useState } from 'react'
import { getSortedArchive } from '../utils/sortArchive'

const archive = []
import TableHeader from './TableHeader'
import ProjectItemThumbnail from './ProjectItemThumbnail'
import DetailPanel from './DetailPanel'

export default function ThumbnailView({ selectedId, onSelect, theme = 'light' }) {
  const [sortBy, setSortBy] = useState('year')
  const { grouped, keys } = getSortedArchive(archive, sortBy)
  const selectedItem = archive.find((item) => item.id === selectedId)

  return (
    <div className="main-split">
      <div className="list-wrapper">
        <div className="table-container">
          <TableHeader sortBy={sortBy} onSort={setSortBy} />
          <div className="project-list thumbnail-view">
          {keys.map((key) => (
            <section key={key} className="year-group">
              {keys.length > 1 && <h2 className="year-label">{key}</h2>}
              {grouped[key].map((item) => (
                <ProjectItemThumbnail
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={onSelect}
                />
              ))}
            </section>
          ))}
          </div>
        </div>
      </div>
      <DetailPanel item={selectedItem} theme={theme} />
    </div>
  )
}
