import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import './index.css'

// App.jsx restores per-route scroll itself; the browser's own attempt races it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// Production web only. Registering the PWA worker while Vite is serving the app through a
// development tunnel mixes cached shell assets with Vite's live module graph and can make remote
// testing look like a real deployment. The native shell already serves everything from disk.
if (!MOBILE && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  } else if (import.meta.env.DEV) {
    // A browser that visited the HTTPS Funnel before this guard may already have the old worker.
    // Remove it once so subsequent dev sessions are purely Vite-driven.
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => {})
  }
}
