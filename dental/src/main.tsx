import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTheme } from './app/theme'
import { db, getClinic, requestPersistentStorage } from '@/db'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'

initTheme()
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// The clinic's records live only on this device: ask the browser not to evict them when the disk runs low.
// Once the clinic is set up (a first-run visitor is not asked for anything); the answer shows in Settings → Backup.
void getClinic().then(c => { if (c.setupDone) return requestPersistentStorage() }).catch(() => undefined)

// A handle for development and automated QA only: window.__dentora.db is the live database. A release build
// (npm run build, the Windows and Android packages) never has it, so nothing in the page context or DevTools is
// handed the clinic's records. QA builds turn it on: VITE_QA=1 npx vite build --outDir /tmp/dist-qa
if (import.meta.env.DEV || import.meta.env.VITE_QA === '1') {
  ;(window as unknown as { __dentora?: unknown }).__dentora = { db, version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev' }
}
