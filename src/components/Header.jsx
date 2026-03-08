import MainNav from './MainNav'
import ThemeToggle from './ThemeToggle'

export default function Header({ currentRoute, isThumbnailView, theme, onThemeToggle }) {
  const isArchive = currentRoute === 'archive' || currentRoute === 'fullList'

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-left">
          <h1 className="header-title">
            {isArchive
              ? isThumbnailView
                ? 'Archive Overview'
                : 'Full List View'
              : getPageTitle(currentRoute)}
          </h1>
          {isArchive && (
            <>
              <a href="#" className="nav-link">Previous Page</a>
              <a
                href={isThumbnailView ? '#full-list-view' : '#pages'}
                className="nav-link view-toggle"
              >
                {isThumbnailView ? 'List View' : 'Thumbnail View'}
              </a>
            </>
          )}
        </div>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
      <MainNav currentRoute={currentRoute} />
    </header>
  )
}

function getPageTitle(route) {
  const titles = {
    map: 'Interactive Map',
    sound: 'Sound Analysis',
    interviews: 'Interviews',
    radar: 'Radar Systems',
    timeline: 'Historical Timeline',
    reflections: 'Reflections',
  }
  return titles[route] ?? 'Archive'
}
