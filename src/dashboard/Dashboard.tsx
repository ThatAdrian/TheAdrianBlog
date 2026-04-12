import React, { useState, useEffect } from 'react'
import MusicReviewCreator from './MusicReviewCreator'
import ArticleCreator from './ArticleCreator'
import Analytics from './Analytics'
import './Dashboard.css'

function hashPassword(pw: string): string {
  let hash = 0
  for (let i = 0; i < pw.length; i++) {
    hash = ((hash << 5) - hash) + pw.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

const CORRECT_HASH = hashPassword('Adrian200567.Tiko2017!')

export default function Dashboard() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [wrong, setWrong] = useState(false)
  const [tab, setTab] = useState<'music' | 'article' | 'analytics'>('music')

  useEffect(() => {
    if (sessionStorage.getItem('db_auth') === CORRECT_HASH) setAuthed(true)
  }, [])

  function login() {
    if (hashPassword(password) === CORRECT_HASH) {
      sessionStorage.setItem('db_auth', CORRECT_HASH)
      sessionStorage.setItem('db_token', token)
      setAuthed(true)
      setWrong(false)
    } else {
      setWrong(true)
      setPassword('')
    }
  }

  function logout() {
    sessionStorage.removeItem('db_auth')
    sessionStorage.removeItem('db_token')
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div className="db-login">
        <div className="db-login-box">
          <h1 className="db-login-title">Dashboard</h1>
          <p className="db-login-sub">TheAdrianBlog</p>
          <input
            type="password"
            className="db-input"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            autoFocus
          />
          <input
            type="password"
            className="db-input"
            placeholder="GitHub Token"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          {wrong && <p className="db-error">Incorrect password</p>}
          <button className="db-btn db-btn--primary db-btn--full" onClick={login}>
            Enter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="db-root">
      <aside className="db-sidebar">
        <div className="db-sidebar-logo">
          <span>TheAdrianBlog</span>
          <span className="db-sidebar-sub">Dashboard</span>
        </div>
        <nav className="db-nav">
          <button className={`db-nav-item ${tab === 'music' ? 'active' : ''}`} onClick={() => setTab('music')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Music Review
          </button>
          <button className={`db-nav-item ${tab === 'article' ? 'active' : ''}`} onClick={() => setTab('article')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            New Article
          </button>
          <button className={`db-nav-item ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Analytics
          </button>
        </nav>
        <button className="db-logout" onClick={logout}>Sign out</button>
      </aside>

      <main className="db-main">
        {tab === 'music'     && <MusicReviewCreator />}
        {tab === 'article'   && <ArticleCreator />}
        {tab === 'analytics' && <Analytics />}
      </main>
    </div>
  )
}
