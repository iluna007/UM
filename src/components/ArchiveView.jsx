import { useState } from 'react'
import { EXTERNAL_SOURCES } from '../data/externalData'
import DataTableView from './DataTableView'

export default function ArchiveView({ theme = 'light' }) {
  const [activeTab, setActiveTab] = useState(EXTERNAL_SOURCES[0]?.key ?? 'airbnb')

  const currentSource = EXTERNAL_SOURCES.find((s) => s.key === activeTab)
  const events = currentSource?.events ?? []

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full">
      <div
        className="flex flex-wrap gap-2 sm:gap-6 py-2 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]"
        role="tablist"
        aria-label="Fuente de datos"
      >
        {EXTERNAL_SOURCES.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`py-2 border-b-2 border-transparent text-sm text-[var(--color-text-muted)] transition-colors duration-200 hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border)] ${activeTab === tab.key ? 'text-[var(--color-text)] font-medium border-[var(--color-border)]' : ''}`}
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
