import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

// After a deploy, old hashed chunks disappear; reload once instead of showing a broken screen.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  const key = 'fp_reloaded_once'
  if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); location.reload() }
})

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
