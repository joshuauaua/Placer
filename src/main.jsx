import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './analytics'
import { migrateStorage } from './services/api'

// Discards imaginations stored under the old PLOT name. Runs before the app
// mounts, so nothing reads storage that is about to be cleared.
migrateStorage()

// Initialises PostHog opted out of capture and storage; it only starts once the
// visitor accepts on the cookie banner rendered by App.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
