import { useRef } from 'react'

const BG_COLOR_KEY = 'marquinaurbana-bg-color'
const DEFAULT_LABEL = 'Default'

function normalizeHex(input) {
  let s = String(input).trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]
  return /^[0-9a-fA-F]{6}$/.test(s) ? '#' + s.toLowerCase() : null
}

function parseHex(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!result) return null
  return normalized
}

export function getStoredBgColor() {
  try {
    const s = localStorage.getItem(BG_COLOR_KEY)
    if (!s || s === 'default') return null
    return s
  } catch {
    return null
  }
}

export function setStoredBgColor(hexOrNull) {
  try {
    if (hexOrNull == null) localStorage.removeItem(BG_COLOR_KEY)
    else localStorage.setItem(BG_COLOR_KEY, hexOrNull)
  } catch {}
}

const INITIAL_HEX = '#e8f4fc'

export default function BackgroundColorPicker({ currentColor, onColorChange }) {
  const inputRef = useRef(null)
  const displayHex = currentColor || INITIAL_HEX

  const openPicker = () => {
    inputRef.current?.click()
  }

  const handleColorChange = (e) => {
    const hex = e.target.value
    if (hex) onColorChange(hex)
  }

  const setDefault = () => {
    onColorChange(null)
  }

  const icon = '\u263C'

  return (
    <div className="bg-color-picker-wrap">
      <input
        ref={inputRef}
        type="color"
        className="bg-color-native-hidden"
        value={displayHex}
        onChange={handleColorChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        className="bg-color-toggle"
        onClick={openPicker}
        aria-label="Choose background color"
        title="Background color"
      >
        <span className="theme-icon bg-color-icon" aria-hidden>{icon}</span>
      </button>
      {currentColor && (
        <button
          type="button"
          className="bg-color-default-btn"
          onClick={setDefault}
          aria-label="Reset background to default"
          title={DEFAULT_LABEL}
        >
          ×
        </button>
      )}
    </div>
  )
}
