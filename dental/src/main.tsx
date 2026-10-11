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

// A handle for support and automated QA: window.__dentora.db is the live database.
;(window as any).__dentora = { db, version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev' }
