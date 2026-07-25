import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { RunProvider } from './data/RunContext.jsx'
import './styles/tokens.css'
import './styles/global.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RunProvider>
      <App />
    </RunProvider>
  </React.StrictMode>
)
