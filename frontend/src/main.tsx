import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/panels.css'
import './styles/topology.css'

const container = document.getElementById('root')
if (!container) throw new Error('root container missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
