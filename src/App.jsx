import { useState, useEffect, lazy, Suspense } from 'react'
import { getViewFromHash, getRouteFromHash, VIEWS } from './constants'
import { Header, Footer } from './components'
import { Interviews, RadarSystems, HistoricalTimeline, Reflections } from './pages'
import './App.css'

const InteractiveMap = lazy(() => import('./pages/InteractiveMap'))
const SoundAnalysis = lazy(() => import('./pages/SoundAnalysis'))
const FullListView = lazy(() => import('./components/FullListView'))
const ThumbnailView = lazy(() => import('./components/ThumbnailView'))

const THEME_KEY = 'floarchive-theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [view, setView] = useState(getViewFromHash)
  const [route, setRoute] = useState(getRouteFromHash)
  const [selectedId, setSelectedId] = useState(null)
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    const handleHashChange = () => {
      setView(getViewFromHash())
      setRoute(getRouteFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const selectProject = (id) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const openInThumbnailView = (id) => {
    setSelectedId(id)
    window.location.hash = '#pages'
  }

  const isThumbnailView = view === VIEWS.thumbnail

  function renderContent() {
    if (route === 'map') return <InteractiveMap theme={theme} />
    if (route === 'sound') return <SoundAnalysis />
    if (route === 'interviews') return <Interviews />
    if (route === 'radar') return <RadarSystems />
    if (route === 'timeline') return <HistoricalTimeline />
    if (route === 'reflections') return <Reflections />

    return isThumbnailView ? (
      <ThumbnailView selectedId={selectedId} onSelect={selectProject} theme={theme} />
    ) : (
      <FullListView onProjectClick={openInThumbnailView} />
    )
  }

  return (
    <div className="app">
      <Header currentRoute={route} isThumbnailView={isThumbnailView} theme={theme} onThemeToggle={toggleTheme} />

      <main className="main">
        <Suspense fallback={<div className="main-loading" aria-live="polite">Cargando…</div>}>
          {renderContent()}
        </Suspense>
      </main>

      <Footer />
    </div>
  )
}
