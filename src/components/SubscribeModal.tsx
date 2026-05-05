import React, { useState, useRef, useEffect } from 'react'
import GlassSurface from './GlassSurface'
import './SubscribeModal.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

const CATEGORIES = ['Music Reviews', 'Tech', 'General']

export default function SubscribeModal() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<string[]>(CATEGORIES) // all selected by default
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function toggleCategory(cat: string) {
    setSelected(s => s.includes(cat) ? s.filter(c => c !== cat) : [...s, cat])
  }

  async function handleSubmit() {
    if (!email.trim() || !email.includes('@')) { setErrorMsg('Please enter a valid email.'); return }
    if (selected.length === 0) { setErrorMsg('Please select at least one category.'); return }
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), categories: selected }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setStatus('success')
      } else {
        setErrorMsg(data.error || 'Something went wrong. Try again.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Something went wrong. Try again.')
      setStatus('error')
    }
  }

  function handleOpen() {
    setOpen(true)
    setStatus('idle')
    setErrorMsg('')
  }

  return (
    <>
      {/* Bell button */}
      <button className="sub-bell" onClick={handleOpen} aria-label="Subscribe to post notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="sub-overlay">
          <div ref={modalRef} className="sub-modal-wrap">
            <GlassSurface width="100%" height="auto" borderRadius={18} brightness={14} opacity={0.7} blur={18}>
              <div className="sub-modal">
                {status === 'success' ? (
                  <div className="sub-success">
                    <div className="sub-success-icon">✓</div>
                    <h3>Check your email</h3>
                    <p>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your subscription.</p>
                    <button className="sub-close-btn" onClick={() => setOpen(false)}>Done</button>
                  </div>
                ) : (
                  <>
                    <div className="sub-modal-header">
                      <div className="sub-modal-title-wrap">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#00f5ff' }}>
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <h3 className="sub-modal-title">Get notified</h3>
                      </div>
                      <button className="sub-modal-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
                    </div>

                    <p className="sub-modal-desc">Choose which categories to follow and get an email when new posts drop.</p>

                    <div className="sub-categories">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          className={`sub-cat-btn ${selected.includes(cat) ? 'active' : ''}`}
                          onClick={() => toggleCategory(cat)}
                        >
                          {selected.includes(cat) && <span className="sub-cat-check">✓</span>}
                          {cat}
                        </button>
                      ))}
                    </div>

                    <input
                      className="sub-email-input"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                      autoFocus
                    />

                    {errorMsg && <p className="sub-error">{errorMsg}</p>}

                    <button
                      className="sub-submit-btn"
                      onClick={handleSubmit}
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? (
                        <span className="sub-spinner" />
                      ) : 'Subscribe'}
                    </button>

                    <p className="sub-disclaimer">No spam. Unsubscribe any time.</p>
                  </>
                )}
              </div>
            </GlassSurface>
          </div>
        </div>
      )}
    </>
  )
}
