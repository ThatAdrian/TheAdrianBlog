import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import GlassSurface from '../components/GlassSurface'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export default function ConfirmSubscription() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    fetch(`${SUPABASE_URL}/functions/v1/confirm-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) { setEmail(data.email); setStatus('success') }
        else setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <GlassSurface width="100%" height="auto" borderRadius={18} brightness={14} opacity={0.7} blur={18}>
          <div style={{ padding: '2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {status === 'loading' && (
              <>
                <div style={{ width: 40, height: 40, border: '2px solid rgba(0,245,255,0.2)', borderTopColor: '#00f5ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <p style={{ color: 'rgba(200,200,255,0.5)', fontSize: '0.88rem', margin: 0 }}>Confirming your subscription...</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 600, color: 'rgba(240,240,255,0.95)', margin: 0 }}>You're subscribed!</h2>
                <p style={{ fontSize: '0.82rem', color: 'rgba(200,200,255,0.5)', lineHeight: 1.6, margin: 0 }}>
                  {email && <><strong style={{ color: 'rgba(220,220,255,0.7)' }}>{email}</strong><br/></>}
                  You'll get an email whenever new posts drop in your chosen categories.
                </p>
                <Link to="/" style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: '1px solid rgba(0,245,255,0.35)', background: 'rgba(0,245,255,0.08)', color: '#00f5ff', textDecoration: 'none', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  Back to blog
                </Link>
              </>
            )}

            {status === 'error' && (
              <>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.25)', color: '#ff4466', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✗</div>
                <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 600, color: 'rgba(240,240,255,0.9)', margin: 0 }}>Link invalid or expired</h2>
                <p style={{ fontSize: '0.82rem', color: 'rgba(200,200,255,0.45)', lineHeight: 1.6, margin: 0 }}>This confirmation link has already been used or has expired. Try subscribing again.</p>
                <Link to="/" style={{ padding: '0.5rem 1.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(200,200,255,0.5)', textDecoration: 'none', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>
                  Back to blog
                </Link>
              </>
            )}
          </div>
        </GlassSurface>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
