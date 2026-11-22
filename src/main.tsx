import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts: bundled and precached, so Hindi renders offline and on bills.
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'
import '@fontsource/rozha-one/400.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
