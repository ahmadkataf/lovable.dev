import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// the website works offline too: the service worker keeps a copy of the app
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.endsWith('.app')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) })
}
