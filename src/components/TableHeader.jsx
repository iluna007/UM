const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'title', label: 'Project Title' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
]

export default function TableHeader({ sortBy, onSort }) {
  return (
    <div className="table-header">
      {COLUMNS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`table-header-cell ${sortBy === key ? 'active' : ''}`}
          onClick={() => onSort?.(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
