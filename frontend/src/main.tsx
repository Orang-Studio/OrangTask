import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLanguage } from './lib/i18n'
import './index.css'

initLanguage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
