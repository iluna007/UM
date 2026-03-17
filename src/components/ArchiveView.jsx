import { useState, useMemo, useEffect } from 'react'
import { EXTERNAL_SOURCES, useLazyExternalSource, getNoiseArchiveEvents } from '../data/externalData'
import DataTableView from './DataTableView'

const PAGE_SIZE = 50

export default function ArchiveView({ theme = 'light' }) {
  const [activeTab, setActiveTab] = useState(EXTERNAL_SOURCES[0]?.key ?? 'airbnb')
  const [page, setPage] = useState(1)

  const { events: lazyEvents, loading, error } = useLazyExternalSource(activeTab)
  const noiseEvents = useMemo(() => (activeTab === 'noise' ? getNoiseArchiveEvents() : []), [activeTab])

  const events = useMemo(() => {
    if (activeTab === 'noise') return noiseEvents
    return (lazyEvents ?? []).filter((e) => e && e.source === activeTab)
  }, [activeTab, lazyEvents, noiseEvents])

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  const totalCount = events.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const paginatedEvents = useMemo(
    () => events.slice(start, start + PAGE_SIZE),
    [events, start]
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

      {activeTab !== 'noise' && loading ? (
        <div className="flex flex-1 items-center justify-center p-8 text-[var(--color-text-muted)]">Cargando…</div>
      ) : activeTab !== 'noise' && error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-[var(--color-text-muted)]">
          <p>Error al cargar los datos.</p>
          <p className="text-sm mt-2">{error?.message ?? String(error)}</p>
        </div>
      ) : (
        <>
          {totalCount > PAGE_SIZE && (
            <div className="archive-pagination" role="navigation" aria-label="Paginación">
              <span className="archive-pagination-info">
                Mostrando {start + 1}–{Math.min(start + PAGE_SIZE, totalCount)} de {totalCount}
              </span>
              <div className="archive-pagination-buttons">
                <button
                  type="button"
                  className="archive-pagination-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                >
                  ← Anterior
                </button>
                <span className="archive-pagination-page">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="archive-pagination-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Página siguiente"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
          <DataTableView
            events={paginatedEvents}
            sourceLabel={EXTERNAL_SOURCES.find((s) => s.key === activeTab)?.label ?? activeTab}
            sourceKey={activeTab}
            theme={theme}
            totalCount={totalCount}
          />
        </>
      )}
    </div>
  )
}
