import React, { useState } from 'react'
import AlbumSearch, { type AlbumResult } from './AlbumSearch'
import './AlbumSuggestion.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export default function AlbumSuggestion() {
  const [selected, setSelected] = useState<AlbumResult | null>(null)
  const [searchVal, setSearchVal] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleSelect(album: AlbumResult) {
    setSelected(album)
    setError('')
  }

  async function handleSubmit() {
    if (!selected) { setError('Please select an album from the search results.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/album_suggestions`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          artist: selected.artist,
          album: selected.name,
          note: note.trim() || null,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Try again.')
      }
    } catch {
      setError('Something went wrong. Try again.')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="as-wrap">
        <div className="as-success">
          <span className="as-success-icon">✓</span>
          <div>
            <p className="as-success-title">Suggestion received</p>
            <p className="as-success-sub">I'll check it out — thanks for the rec.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="as-wrap">
      <div className="as-header">
        <span className="as-title">Suggest an Album</span>
        <span className="as-sub">Think I should review something? Let me know.</span>
      </div>
      <div className="as-form">
        <AlbumSearch
          placeholder="Search for an album..."
          value={searchVal}
          onChange={setSearchVal}
          onSelect={handleSelect}
        />

        {selected && (
          <div className="as-selected">
            {selected.image && <img src={selected.image} alt={selected.name} className="as-selected-art" />}
            <div className="as-selected-info">
              <span className="as-selected-name">{selected.name}</span>
              <span className="as-selected-artist">{selected.artist}{selected.year ? ` · ${selected.year}` : ''}</span>
            </div>
          </div>
        )}

        <input
          className="as-input"
          placeholder="Why should I review it? (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={300}
        />
        {error && <p className="as-error">{error}</p>}
        <button
          className="as-btn"
          onClick={handleSubmit}
          disabled={!selected || submitting}
        >
          {submitting ? 'Sending...' : 'Submit'}
        </button>
      </div>
    </div>
  )
}
