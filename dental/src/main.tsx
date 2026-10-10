import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// A handle for support and automated QA: window.__dentora.db is the live database.
import { db } from '@/db'
;(window as any).__dentora = { db, version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev' }
