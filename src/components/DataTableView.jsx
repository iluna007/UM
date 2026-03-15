import { useState, useMemo, Fragment } from 'react'
import { getNoticiasSourceLinks } from '../data/noticias'
import { getGoogleReviewSourceLinks } from '../data/googleReview'
import { formatAssociationsDisplay } from '../utils/formatAssociations'

/** Column keys to hide from table (noise columns) */
const HIDE_KEYS = new Set(['col_0', 'col_1', 'col_2'].concat(
  Array.from({ length: 30 }, (_, i) => `col_${i}`)
))

function getDisplayKeys(events) {
  if (!events?.length) return []
  const keys = new Set()
  events.forEach((e) => {
    const raw = e.raw || e
    Object.keys(raw).forEach((k) => {
      if (!HIDE_KEYS.has(k) && (raw[k] != null && raw[k] !== '')) keys.add(k)
    })
  })
  return Array.from(keys).sort((a, b) => {
    const order = ['id', 'title', 'description', 'desrciption', 'date', 'first review', 'location', 'leq_mean', 'provincia', 'canton', 'latitude', 'longitude', 'lat', 'lng', 'weekKey']
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
  })
}

function formatCellValue(val, item, key, truncate = true) {
  if (val == null) return '—'
  if (key === 'associations' && item) return formatAssociationsDisplay(item, val)
  if (typeof val === 'boolean') return val ? 'Sí' : 'No'
  if (typeof val === 'object') return JSON.stringify(val)
  const s = String(val)
  if (!truncate) return s
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

function getSortValue(item, columnKey) {
  if (columnKey === 'date') return item.date || ''
  if (columnKey === 'title') return (item.title || item.description || item.raw?.description || item.raw?.desrciption || item.id || '').toLowerCase()
  const raw = item.raw || item
  const v = raw[columnKey]
  if (v == null) return ''
  if (typeof v === 'number') return v
  return String(v).toLowerCase()
}

const EXTRA_COLS_MAX = 10

export default function DataTableView({ events, sourceLabel, theme = 'light' }) {
  const [sortColumn, setSortColumn] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [expandedId, setExpandedId] = useState(null)

  const displayKeys = useMemo(() => getDisplayKeys(events || []), [events])
  const extraKeys = useMemo(
    () => displayKeys.filter((k) => !['id', 'title', 'description', 'desrciption', 'date', 'first review'].includes(k)),
    [displayKeys]
  )

  const allRows = useMemo(() => {
    const list = Array.isArray(events) ? [...events] : []
    if (!sortColumn) return list
    return list.sort((a, b) => {
      const va = getSortValue(a, sortColumn)
      const vb = getSortValue(b, sortColumn)
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [events, sortColumn, sortDirection])

  const hasExpandableData = allRows.some((e) => e.raw && Object.keys(e.raw).length > 0)

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(columnKey)
      setSortDirection('desc')
    }
  }

  if (allRows.length === 0) {
    return (
      <div className="data-table-view">
        <div className="data-table-toolbar">
          <span className="data-table-source-badge">{sourceLabel}</span>
          <span className="data-table-count">0 registros</span>
        </div>
        <p className="data-table-empty">No hay datos para mostrar en esta fuente.</p>
      </div>
    )
  }

  return (
    <div className="data-table-view">
      <div className="data-table-toolbar">
        <span className="data-table-source-badge">{sourceLabel}</span>
        <span className="data-table-count">{allRows.length} registros</span>
      </div>
      <div className="data-table-scroll">
        <table className="data-table" role="grid">
          <thead>
            <tr>
              {hasExpandableData && <th className="data-table-col-expand" aria-label="Expandir" />}
              <th
                className="data-table-col-date data-table-col-sortable"
                onClick={() => handleSort('date')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('date') } }}
                role="button"
                tabIndex={0}
                title="Ordenar por fecha"
              >
                Fecha {sortColumn === 'date' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th
                className="data-table-col-title data-table-col-sortable"
                onClick={() => handleSort('title')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort('title') } }}
                role="button"
                tabIndex={0}
                title="Ordenar por título"
              >
                Título / Descripción {sortColumn === 'title' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
              </th>
              {extraKeys.slice(0, EXTRA_COLS_MAX).map((k) => (
                <th
                  key={k}
                  className="data-table-col-extra data-table-col-sortable"
                  onClick={() => handleSort(k)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(k) } }}
                  role="button"
                  tabIndex={0}
                  title={`Ordenar por ${k}`}
                >
                  {k} {sortColumn === k && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allRows.map((item) => {
              const raw = item.raw || item
              const isExpanded = expandedId === item.id
              return (
                <Fragment key={item.id}>
                  <tr
                    className={`data-table-row ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedId(isExpanded ? null : item.id)
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    {hasExpandableData && (
                      <td className="data-table-col-expand">
                        <span className="data-table-expand-icon" aria-hidden>{isExpanded ? '▼' : '▶'}</span>
                      </td>
                    )}
                    <td className="data-table-col-date">{item.date || '—'}</td>
                    <td className="data-table-col-title">
                      {item.title || item.description || item.raw?.desrciption || item.raw?.description || item.id}
                    </td>
                    {extraKeys.slice(0, EXTRA_COLS_MAX).map((k) => (
                      <td key={k} className="data-table-col-extra">{formatCellValue(raw[k], item, k)}</td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="data-table-row-detail">
                      <td colSpan={20}>
                        <div className="data-table-detail-panel">
                          {item.images?.[0] && (
                            <div className="data-table-detail-image">
                              <img src={item.images[0]} alt="" />
                            </div>
                          )}
                          {(item.date || item.title || item.year) && (
                            <dl className="data-table-detail-fields data-table-detail-main">
                              {item.date != null && item.date !== '' && (
                                <div className="data-table-detail-row">
                                  <dt>Fecha</dt>
                                  <dd>{item.date}</dd>
                                </div>
                              )}
                              {item.title != null && item.title !== '' && (
                                <div className="data-table-detail-row">
                                  <dt>Título</dt>
                                  <dd>{item.title}</dd>
                                </div>
                              )}
                              {item.year != null && item.year !== '' && (
                                <div className="data-table-detail-row">
                                  <dt>Año</dt>
                                  <dd>{item.year}</dd>
                                </div>
                              )}
                            </dl>
                          )}
                          <dl className="data-table-detail-fields">
                            {Object.entries(raw).filter(([k, v]) => !HIDE_KEYS.has(k) && (v != null && v !== '')).map(([k, v]) => (
                              <div key={k} className="data-table-detail-row">
                                <dt>{k}</dt>
                                <dd className={k === 'associations' ? 'detail-associations-stars' : ''}>{formatCellValue(v, item, k, false)}</dd>
                              </div>
                            ))}
                          </dl>
                          {(item.source === 'noticias' || item.source === 'google-review') && (() => {
                            const links = item.source === 'noticias' ? getNoticiasSourceLinks(item) : getGoogleReviewSourceLinks(item)
                            if (links.length === 0) return null
                            return (
                              <div className="data-table-detail-sources">
                                <h4 className="detail-sources-title">Fuentes</h4>
                                <ul className="detail-sources-list">
                                  {links.map((src, i) => (
                                    <li key={src.id || i}>
                                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="detail-source-link">
                                        {src.description || src.url}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
