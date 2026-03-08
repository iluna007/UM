import { NAV_ITEMS } from '../constants'

export default function MainNav({ currentRoute }) {
  const isArchiveActive = currentRoute === 'archive' || currentRoute === 'fullList'

  return (
    <nav className="main-nav">
      {NAV_ITEMS.map(({ key, label, hash }) => {
        const isActive = key === 'archive' ? isArchiveActive : currentRoute === key
        return (
          <a
            key={key}
            href={hash}
            className={`main-nav-link ${isActive ? 'active' : ''}`}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}
