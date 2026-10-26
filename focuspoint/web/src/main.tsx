import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { readAppHint } from './lib/appHint'
import { readBoot } from './lib/content'
import './styles.css'

// After a deploy, old hashed chunks disappear; reload once instead of showing a broken screen.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  const key = 'fp_reloaded_once'
  if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); location.reload() }
})

readAppHint()   // before the router reads the address (removes ?np= from it)
readBoot()      // the content + settings the Worker put in index.html, so the first paint already shows the edits
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
