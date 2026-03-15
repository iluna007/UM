import { useState, useEffect, lazy, Suspense } from 'react'
import { getRouteFromHash } from './constants'
import { Header } from './components'
import { getStoredBgColor, setStoredBgColor } from './components/BackgroundColorPicker'
import { Reflections, About } from './pages'
import './App.css'

const InteractiveMap = lazy(() => import('./pages/InteractiveMap'))
const ArchiveView = lazy(() => import('./components/ArchiveView'))

const THEME_KEY = 'marquinaurbana-theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash)
  const [theme, setTheme] = useState(getInitialTheme)
  const [bgColor, setBgColor] = useState(getStoredBgColor())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (bgColor) {
      document.documentElement.style.setProperty('--color-bg', bgColor)
      setStoredBgColor(bgColor)
    } else {
      document.documentElement.style.removeProperty('--color-bg')
      setStoredBgColor(null)
    }
  }, [bgColor])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  useEffect(() => {
    const handleHashChange = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function renderContent() {
    if (route === 'map') return <InteractiveMap theme={theme} />
    if (route === 'reflections') return <Reflections />
    if (route === 'about') return <About />
    return <ArchiveView theme={theme} />
  }

  return (
    <div className="app">
      <Header currentRoute={route} theme={theme} onThemeToggle={toggleTheme} bgColor={bgColor} onBgColorChange={setBgColor} />

      <main className="main">
        <Suspense fallback={<div className="main-loading" aria-live="polite">Cargando…</div>}>
          {renderContent()}
        </Suspense>
      </main>
    </div>
  )
}
