import { useState, useRef, useEffect } from 'react'

function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polygon points="2 17 12 22 22 17" />
    </svg>
  )
}

export default function MapLayersPanel({ layers = [], visibleLayerIds = [], onToggleLayer }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  return (
    <div className="map-layers-legend" ref={panelRef}>
      <button
        type="button"
        className="map-layers-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? 'Cerrar capas' : 'Abrir capas del mapa'}
        title="Capas del mapa"
      >
        <LayersIcon />
      </button>
      {open && (
        <div className="map-layers-panel" role="dialog" aria-label="Capas del mapa">
          <div className="map-layers-panel-title">Layers</div>
          <ul className="map-layers-list">
            {layers.map((layer) => {
              const isVisible = visibleLayerIds.includes(layer.id)
              return (
                <li key={layer.id} className="map-layers-list-item">
                  <label className="map-layers-label">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => onToggleLayer(layer.id)}
                      className="map-layers-checkbox"
                    />
                    <span className="map-layers-name">{layer.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
