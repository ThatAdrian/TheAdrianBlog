import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// Handle GitHub Pages SPA redirect
const params = new URLSearchParams(window.location.search)
const redirectPath = params.get('p')
if (redirectPath) {
  const cleanSearch = params.get('q') || ''
  // Keep the #hash: login/confirmation links from Supabase carry the session there
  window.history.replaceState(null, '', redirectPath + (cleanSearch ? decodeURIComponent(cleanSearch) : '') + window.location.hash)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
