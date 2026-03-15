import { useState, useMemo } from 'react'
import { EXTERNAL_SOURCES } from '../data/externalData'
import DataTableView from './DataTableView'

export default function ArchiveView({ theme = 'light' }) {
  const [activeTab, setActiveTab] = useState(EXTERNAL_SOURCES[0]?.key ?? 'airbnb')

  const currentSource = EXTERNAL_SOURCES.find((s) => s.key === activeTab)
  const allEventsForSource = currentSource?.events ?? []
  const events = useMemo(
    () => allEventsForSource.filter((e) => e && e.source === activeTab),
    [allEventsForSource, activeTab]
  )

  return (
    <div className="flex flex-1 flex-col min-h-0 w-full">
      <div
        className="flex flex-wrap gap-2 sm:gap-6 py-2 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]"
        role="tablist"
        aria-label="Fuente de datos"
      >
        {EXTERNAL_SOURCES.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`py-2 border-b-2 text-sm transition-colors duration-200 ${isActive ? 'text-[var(--color-text)] font-medium border-b-[var(--color-border)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-b-[var(--color-border)]'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <DataTableView
        events={events}
        sourceLabel={currentSource?.label ?? activeTab}
        sourceKey={activeTab}
        theme={theme}
      />
    </div>
  )
}
