import MainNav from './MainNav'

export default function Header({ currentRoute, theme, onThemeToggle, bgColor, onBgColorChange }) {
  return (
    <header className="header">
      <MainNav
        currentRoute={currentRoute}
        theme={theme}
        onThemeToggle={onThemeToggle}
        bgColor={bgColor}
        onBgColorChange={onBgColorChange}
      />
    </header>
  )
}
