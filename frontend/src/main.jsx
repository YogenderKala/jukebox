import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/outfit'
import App from './App.jsx'
import './index.css'
import { applyTheme } from './theme'

applyTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
