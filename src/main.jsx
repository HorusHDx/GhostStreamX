import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Modo TV: si el navegador es de Smart TV (Tizen/webOS), marca <html>.
// Solo activa ajustes CSS (sin blur, texto mayor). No cambia lógica.
if (/Tizen|Web0S|webOS|Smart-TV|SmartTV|HbbTV/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('tv')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
