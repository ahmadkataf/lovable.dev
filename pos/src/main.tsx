import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/alexandria'
import './styles/base.css'
import './styles/ui.css'
import './styles/shell.css'
import './i18n/core'
import App from './App'

// ?qa=1 fills the app with sample data (screenshots, demos)
if (new URLSearchParams(location.search).get('qa')) void import('./dev/seed').then(m => m.install())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
