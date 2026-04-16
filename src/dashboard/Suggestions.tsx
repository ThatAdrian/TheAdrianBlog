import React, { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

interface Suggestion {
  id: string
  artist: string
  album: string
  note: string | null
  created_at: string
  reviewed: boolean
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending')

  async function load() {
    setLoading(true)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/album_suggestions?order=created_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (res.ok) setSuggestions(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markReviewed(id: string, reviewed: boolean) {
    await fetch(`${SUPABASE_URL}/rest/v1/album_suggestions?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ reviewed }),
    })
    setSuggestions(s => s.map(sg => sg.id === id ? { ...sg, reviewed } : sg))
  }

  async function deleteSuggestion(id: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/album_suggestions?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    setSuggestions(s => s.filter(sg => sg.id !== id))
  }

  const filtered = suggestions.filter(s => {
    if (filter === 'pending') return !s.reviewed
    if (filter === 'reviewed') return s.reviewed
    return true
  })

  const pendingCount = suggestions.filter(s => !s.reviewed).length

  return (
    <div className="db-section">
      <div className="db-section-titlebar">
        <h2 className="db-section-title">
          Album Suggestions
          {pendingCount > 0 && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: 'rgba(200,200,255,0.4)' }}>{pendingCount} pending</span>}
        </h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['pending','all','reviewed'] as const).map(f => (
            <button key={f} className={`db-btn db-btn--sm ${filter === f ? 'db-btn--active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="db-card">
        {loading ? (
          <p className="db-hint">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="db-hint">No {filter === 'all' ? '' : filter} suggestions yet.</p>
        ) : (
          <div className="db-drafts-list">
            {filtered.map(s => (
              <div key={s.id} className="db-draft-row" style={{ opacity: s.reviewed ? 0.5 : 1 }}>
                <div className="db-draft-info">
                  <span className="db-draft-title">{s.album} — {s.artist}</span>
                  {s.note && <span className="db-draft-date" style={{ color: 'rgba(220,220,255,0.5)', fontFamily: 'Space Grotesk' }}>{s.note}</span>}
                  <span className="db-draft-date">{timeAgo(s.created_at)}</span>
                </div>
                <div className="db-draft-actions">
                  <button
                    className={`db-btn db-btn--sm ${s.reviewed ? '' : 'db-btn--primary'}`}
                    onClick={() => markReviewed(s.id, !s.reviewed)}
                  >
                    {s.reviewed ? 'Unmark' : 'Reviewed'}
                  </button>
                  <button className="db-btn db-btn--sm db-btn--danger" onClick={() => deleteSuggestion(s.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
