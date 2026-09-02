import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import './components/common/WestPrimeLoader.css'
import App from './App.jsx'
import { dismissAppSplash } from './utils/splash'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hand off to React loader — avoid two loaders stacking on screen.
requestAnimationFrame(() => dismissAppSplash())
