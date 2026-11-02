import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { onAuthRequired, loginHref, useAuth } from '../lib/auth'
import '../pages/Account.css'

// Opens when a signed-out visitor tries something that needs an account
// (tracking an artist, "I'm going", rating). See requireAccount() in lib/auth.ts.
export default function AuthPrompt() {
  const [reason, setReason] = useState<string | null>(null)
  const { user } = useAuth()
  const location = useLocation()

  useEffect(() => onAuthRequired(r => setReason(r || 'do that')), [])
  useEffect(() => { setReason(null) }, [location.pathname, user])

  useEffect(() => {
    if (reason === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setReason(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reason])

  if (reason === null) return null
  const next = location.pathname + location.search

  // Portalled to <body> so page transforms don't break position: fixed
  return createPortal(
    <div className="auth-prompt" role="dialog" aria-modal="true" aria-labelledby="auth-prompt-title" onClick={() => setReason(null)}>
      <div className="auth-prompt__box" onClick={e => e.stopPropagation()}>
        <div className="acct-card">
          <button type="button" className="auth-prompt__close" aria-label="Close" onClick={() => setReason(null)}>×</button>
          <h2 id="auth-prompt-title" className="acct-title">Log in to {reason}</h2>
          <p className="acct-sub" style={{ marginTop: 0 }}>
            With a free account your tracked artists, concerts, ratings and comments are saved and synced across all your devices.
          </p>
          <div className="auth-prompt__actions">
            <Link className="acct-submit" to={loginHref(next)}>Log in</Link>
            <Link className="acct-submit acct-submit--ghost" to={loginHref(next, 'register')}>Create account</Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
