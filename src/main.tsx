import React from 'react'
import ReactDOM from 'react-dom/client'
import LandingPage from './LandingPage'
import { BrowserRouter, useLocation } from './router'
import { DASHBOARD_PATH } from './landing/content'
import { Suspense, lazy } from 'react'
import './index.css'

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
    <BrowserRouter><AppRoutes /></BrowserRouter>
  </React.StrictMode>,
)
