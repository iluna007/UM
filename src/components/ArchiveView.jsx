import { useState } from 'react'
import { EXTERNAL_SOURCES } from '../data/externalData'
import DataTableView from './DataTableView'

export default function ArchiveView({ theme = 'light' }) {
  const [activeTab, setActiveTab] = useState(EXTERNAL_SOURCES[0]?.key ?? 'airbnb')

  const currentSource = EXTERNAL_SOURCES.find((s) => s.key === activeTab)
  const events = currentSource?.events ?? []

  return (
    <div className="archive-view">
      <div className="archive-tabs" role="tablist" aria-label="Fuente de datos">
        {EXTERNAL_SOURCES.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`archive-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTableView
        events={events}
        sourceLabel={currentSource?.label ?? activeTab}
        theme={theme}
      />
    </div>
  )
}
