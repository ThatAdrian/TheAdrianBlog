import React, { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import {
  useAuth, register, logIn, logOut, sendPasswordReset, setNewPassword,
  updateDisplayName, loginHref,
} from '../lib/auth'
import { useTrackedArtists } from '../lib/trackedArtists'
import { useGoing } from '../lib/attendance'
import './Account.css'

// /login, /register and /account. Accounts are for commenting, rating, artist
// tracking and "I'm going"; everything else on the site works without one.

const PERKS = [
  'Comment on reviews and tracks under your own name',
  'Rate albums (and change your rating later)',
  'Track artists for release and concert alerts',
  'Mark concerts you’re going to',
]

// Only same-site paths, so ?next= can't send people elsewhere
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
}

function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="acct-field">
      <span className="acct-field__label">{label}</span>
      <input className="acct-input" {...input} />
    </label>
  )
}

// ── Log in / register ─────────────────────────────────────────────────────────
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { ready, user } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = safeNext(params.get('next'))

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')          // confirmation email sent
  const [forgot, setForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => { setError(''); setForgot(false); setResetSent(false) }, [mode])

  if (ready && user) return <Navigate to={next} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    if (forgot) {
      const r = await sendPasswordReset(email)
      setBusy(false)
      if (r.error) setError(r.error); else setResetSent(true)
      return
    }
    if (mode === 'register') {
      const r = await register(email, password, displayName)
      setBusy(false)
      if (r.error) { setError(r.error); return }
      if (r.needsConfirm) { setSentTo(email.trim()); return }
      navigate(next, { replace: true })
      return
    }
    const r = await logIn(email, password)
    setBusy(false)
    if (r.error) { setError(r.error); return }
    navigate(next, { replace: true })
  }

  const otherHref = loginHref(next === '/account' ? '' : next, mode === 'login' ? 'register' : 'login')
  const title = forgot ? 'Reset password' : mode === 'login' ? 'Log in' : 'Create account'

  return (
    <div className="acct-page page-transition">
      <SEO title={title} url={mode === 'login' ? '/login' : '/register'} />
      <div className="acct-card">
        {sentTo ? (
          <div className="acct-done">
            <div className="acct-done__icon">✓</div>
            <h1 className="acct-title">Check your email</h1>
            <p>We sent a link to <strong>{sentTo}</strong>. Open it to confirm your account and you'll be logged in.</p>
            <p className="acct-muted">Nothing there? Check spam, or <Link to="/login">try logging in</Link> once you've confirmed.</p>
          </div>
        ) : (
          <>
            <h1 className="acct-title">{title}</h1>
            {!forgot && (
              <p className="acct-sub">
                {mode === 'register'
                  ? 'One account for the whole blog, synced across your devices.'
                  : 'Welcome back. Your comments, ratings and tracked artists are waiting.'}
              </p>
            )}

            {mode === 'register' && (
              <ul className="acct-perks">
                {PERKS.map(p => <li key={p}>{p}</li>)}
              </ul>
            )}

            {resetSent ? (
              <div className="acct-done">
                <p>If there's an account for <strong>{email.trim()}</strong>, a reset link is on its way. Open it to choose a new password.</p>
                <button type="button" className="acct-link" onClick={() => { setForgot(false); setResetSent(false) }}>Back to log in</button>
              </div>
            ) : (
              <form className="acct-form" onSubmit={submit} noValidate>
                {mode === 'register' && !forgot && (
                  <Field
                    label="Display name"
                    type="text"
                    autoComplete="nickname"
                    placeholder="Shown on your comments"
                    value={displayName}
                    maxLength={30}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                  />
                )}
                <Field
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus={mode === 'login'}
                />
                {!forgot && (
                  <div className="acct-password">
                    <Field
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      placeholder={mode === 'register' ? 'At least 8 characters' : ''}
                      value={password}
                      minLength={8}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="acct-show" onClick={() => setShowPassword(s => !s)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}

                {error && <p className="acct-error" role="alert">{error}</p>}

                <button className="acct-submit" type="submit" disabled={busy || !email.trim() || (!forgot && !password) || (mode === 'register' && !forgot && !displayName.trim())}>
                  {busy ? <span className="acct-spinner" /> : forgot ? 'Send reset link' : mode === 'login' ? 'Log in' : 'Create account'}
                </button>

                {mode === 'login' && (
                  <button type="button" className="acct-link" onClick={() => { setForgot(f => !f); setError('') }}>
                    {forgot ? 'Back to log in' : 'Forgot your password?'}
                  </button>
                )}
              </form>
            )}

            {!forgot && (
              <p className="acct-switch">
                {mode === 'login' ? 'New here? ' : 'Already have an account? '}
                <Link to={otherHref}>{mode === 'login' ? 'Create an account' : 'Log in'}</Link>
              </p>
            )}
            <p className="acct-muted acct-footnote">Likes and reading stay anonymous. You don't need an account for those.</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Account ───────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const { ready, user, profile, recovering } = useAuth()
  const { artists } = useTrackedArtists()
  const { marks } = useGoing()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [password, setPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => { if (profile) setName(profile.display_name) }, [profile])

  if (!ready) return <div className="acct-page" style={{ minHeight: '60vh' }} />
  if (!user) return <Navigate to={loginHref('/account')} replace />

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true); setNameMsg(null)
    const r = await updateDisplayName(name)
    setSavingName(false)
    setNameMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: 'Saved. Your comments show the new name.' })
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setSavingPw(true); setPwMsg(null)
    const r = await setNewPassword(password)
    setSavingPw(false)
    if (r.error) { setPwMsg({ ok: false, text: r.error }); return }
    setPassword('')
    setPwMsg({ ok: true, text: 'Password updated.' })
  }

  async function signOut() {
    await logOut()
    navigate('/', { replace: true })
  }

  const passwordForm = (
    <form className="acct-form" onSubmit={savePassword}>
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        minLength={8}
        onChange={e => setPassword(e.target.value)}
        autoFocus={recovering}
      />
      {pwMsg && <p className={pwMsg.ok ? 'acct-ok' : 'acct-error'}>{pwMsg.text}</p>}
      <button className="acct-submit" type="submit" disabled={savingPw || password.length < 8}>
        {savingPw ? <span className="acct-spinner" /> : 'Save password'}
      </button>
    </form>
  )

  return (
    <div className="acct-page page-transition">
      <SEO title="Your account" url="/account" />
      <div className="acct-card acct-card--wide">
        <h1 className="acct-title">Hey {profile?.display_name ?? 'there'}</h1>
        <p className="acct-sub">{user.email}</p>

        {recovering && (
          <section className="acct-section acct-section--alert">
            <h2>Choose a new password</h2>
            {passwordForm}
          </section>
        )}

        <section className="acct-section">
          <h2>Synced to your account</h2>
          <div className="acct-stats">
            <Link to="/music?tab=tracked" className="acct-stat">
              <span className="acct-stat__n">{artists.length}</span>
              <span className="acct-stat__label">tracked artist{artists.length === 1 ? '' : 's'}</span>
            </Link>
            <Link to="/music?tab=calendar" className="acct-stat">
              <span className="acct-stat__n">{marks.length}</span>
              <span className="acct-stat__label">concert{marks.length === 1 ? '' : 's'} going</span>
            </Link>
          </div>
          <p className="acct-muted">Comments and ratings are saved to this account too. Log in on any device to pick up where you left off.</p>
        </section>

        <section className="acct-section">
          <h2>Display name</h2>
          <form className="acct-form acct-form--inline" onSubmit={saveName}>
            <input
              className="acct-input"
              type="text"
              aria-label="Display name"
              value={name}
              maxLength={30}
              onChange={e => { setName(e.target.value); setNameMsg(null) }}
            />
            <button className="acct-submit" type="submit" disabled={savingName || !profile || name.trim() === profile.display_name}>
              {savingName ? <span className="acct-spinner" /> : 'Save'}
            </button>
          </form>
          {nameMsg && <p className={nameMsg.ok ? 'acct-ok' : 'acct-error'}>{nameMsg.text}</p>}
        </section>

        {!recovering && (
          <section className="acct-section">
            <h2>Password</h2>
            {passwordForm}
          </section>
        )}

        <button type="button" className="acct-logout" onClick={signOut}>Log out</button>
      </div>
    </div>
  )
}
