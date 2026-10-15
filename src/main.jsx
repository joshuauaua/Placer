import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './analytics'

// Initialises PostHog opted out of capture and storage; it only starts once the
// visitor accepts on the cookie banner rendered by App.
initAnalytics()

// A deploy replaces the hashed files each page loads on demand, so a tab opened
// before it can ask for one that is no longer there and fail to show that page.
// Vite reports that here; a reload picks up the new files. (vercel.json keeps
// /assets/ out of the app's catch-all rewrite, so a missing file is a 404 rather
// than the app's HTML cached for a year under the file's name.)
// It reloads once per minute at most, so a file that really is missing shows the
// error rather than reloading forever; without storage to remember that in, it
// does not reload at all.
const RELOADED_AT = 'placer-chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT)) || 0
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
