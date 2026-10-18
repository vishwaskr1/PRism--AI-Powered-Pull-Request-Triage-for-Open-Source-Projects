import { useTheme } from "./theme"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === "dark" ? "light" : "dark"
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {theme === "dark"
          ? <><circle cx="10" cy="10" r="3.2" /><path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" /></>
          : <path d="M16.7 12.8A7 7 0 0 1 7.2 3.3 7.1 7.1 0 1 0 16.7 12.8Z" />}
      </svg>
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  )
}
