import React from 'react'
import ReactDOM from 'react-dom/client'
import LandingPage from './LandingPage'
import { BrowserRouter, useLocation } from './router'
import { DASHBOARD_PATH } from './landing/content'
import { Suspense, lazy } from 'react'
import './index.css'
import './theme.css'
import { ThemeProvider, readSavedTheme } from './theme'

// Set the stored theme before React mounts to avoid a flash on page load.
document.documentElement.dataset.theme = readSavedTheme()

const DashboardPage = lazy(() => import('./dashboard/DashboardPage'))

function AppRoutes() {
  const location = useLocation()
  const pathname = location.split(/[?#]/, 1)[0]
  if (pathname === DASHBOARD_PATH) {
    return <Suspense fallback={<main className="dashboard-loading" aria-live="polite">Loading dashboard…</main>}><DashboardPage /></Suspense>
  }
  return <LandingPage />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider><BrowserRouter><AppRoutes /></BrowserRouter></ThemeProvider>
  </React.StrictMode>,
)
