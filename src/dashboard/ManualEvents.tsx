import React, { useState, useEffect, useMemo } from 'react'
import { searchSpotify, SearchArtist } from '../lib/spotify'

// Hand-entered shows (DICE, RA and anything the APIs miss). Saved through the
// artist-events Edge Function, authorised with the function's CRON_SECRET.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const SECRET_KEY = 'db_events_secret'

interface ManualEvent {
  event_key: string
  artist_name: string
  title: string
  venue: string
  city: string
  country_code: string
  event_date: string
  event_time: string
  url: string
}

type City = [string, string, number, number, number]

async function callFunction(secret: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/artist-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}`, 'x-cron-secret': secret },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

const EMPTY_FORM = { title: '', venue: '', date: '', time: '', url: '', customCity: '', customCountry: '' }

export default function ManualEvents() {
  const [secret, setSecret] = useState(() => localStorage.getItem(SECRET_KEY) ?? '')
  const [events, setEvents] = useState<ManualEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const [artistQuery, setArtistQuery] = useState('')
  const [artistResults, setArtistResults] = useState<SearchArtist[]>([])
  const [artist, setArtist] = useState<SearchArtist | null>(null)

  const [cities, setCities] = useState<City[]>([])
  const [cityQuery, setCityQuery] = useState('')
  const [city, setCity] = useState<City | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/artist_events?source=eq.manual&order=event_date.asc&select=event_key,artist_name,title,venue,city,country_code,event_date,event_time,url`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      )
      setEvents(res.ok ? await res.json() : [])
    } catch { setEvents([]) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/geo/cities.json').then(r => r.json()).then(setCities).catch(() => {})
  }, [])

  useEffect(() => {
    if (!artistQuery.trim() || artist?.name === artistQuery) { setArtistResults([]); return }
    const t = setTimeout(() => searchSpotify(artistQuery, 5).then(r => setArtistResults(r.artists)), 300)
    return () => clearTimeout(t)
  }, [artistQuery, artist])

  const citySuggestions = useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    if (!q || (city && city[0] === cityQuery)) return []
    return cities.filter(c => c[0].toLowerCase().startsWith(q)).slice(0, 6)
  }, [cityQuery, cities, city])

  function saveSecret(v: string) {
    setSecret(v)
    localStorage.setItem(SECRET_KEY, v)
  }

  async function add() {
    if (!artist || !form.date) { setStatus({ ok: false, text: 'Pick an artist and a date.' }); return }
    setStatus(null)
    try {
      await callFunction(secret, {
        mode: 'manual', action: 'add',
        event: {
          artist_id: artist.id, artist_name: artist.name,
          title: form.title, venue: form.venue,
          city: city ? city[0] : (form.customCity || cityQuery.trim()),
          country_code: city ? city[1] : form.customCountry,
          lat: city ? city[2] : null, lng: city ? city[3] : null,
          event_date: form.date, event_time: form.time, url: form.url,
        },
      })
      setStatus({ ok: true, text: `Added ${artist.name} on ${form.date}.` })
      setForm(EMPTY_FORM)
      setCity(null); setCityQuery('')
      load()
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message })
    }
  }

  async function remove(key: string) {
    try {
      await callFunction(secret, { mode: 'manual', action: 'delete', eventKey: key })
      load()
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message })
    }
  }

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="db-section">
      <div className="db-section-titlebar">
        <h2 className="db-section-title">Manual Events</h2>
      </div>

      <div className="db-card">
        <p className="db-hint" style={{ marginBottom: '1rem' }}>
          Add shows the APIs don't cover (DICE, Resident Advisor, small promoters). They appear on the Music → Events
          globe like any other show.
        </p>

        <div className="db-field" style={{ marginBottom: '1rem' }}>
          <label className="db-label">Events secret (your CRON_SECRET, saved on this device)</label>
          <input className="db-input" type="password" value={secret} onChange={e => saveSecret(e.target.value)} />
        </div>

        <div className="db-field" style={{ marginBottom: '1rem', position: 'relative' }}>
          <label className="db-label">Artist</label>
          <input
            className="db-input"
            placeholder="Search Spotify artists…"
            value={artistQuery}
            onChange={e => { setArtistQuery(e.target.value); setArtist(null) }}
          />
          {artistResults.length > 0 && (
            <div className="db-drafts-list">
              {artistResults.map(a => (
                <button key={a.id} type="button" className="db-btn db-btn--sm" style={{ justifyContent: 'flex-start' }}
                  onClick={() => { setArtist(a); setArtistQuery(a.name); setArtistResults([]) }}>
                  {a.name}{a.genres.length ? ` · ${a.genres.slice(0, 2).join(', ')}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div className="db-field">
            <label className="db-label">Date</label>
            <input className="db-input" type="date" value={form.date} onChange={set('date')} />
          </div>
          <div className="db-field">
            <label className="db-label">Time (optional)</label>
            <input className="db-input" type="time" value={form.time} onChange={set('time')} />
          </div>
          <div className="db-field">
            <label className="db-label">Venue</label>
            <input className="db-input" value={form.venue} onChange={set('venue')} />
          </div>
          <div className="db-field" style={{ position: 'relative' }}>
            <label className="db-label">City</label>
            <input className="db-input" placeholder="Start typing…" value={cityQuery}
              onChange={e => { setCityQuery(e.target.value); setCity(null) }} />
            {citySuggestions.length > 0 && (
              <div className="db-drafts-list">
                {citySuggestions.map(c => (
                  <button key={`${c[0]}-${c[1]}-${c[2]}`} type="button" className="db-btn db-btn--sm" style={{ justifyContent: 'flex-start' }}
                    onClick={() => { setCity(c); setCityQuery(c[0]) }}>
                    {c[0]} · {c[1]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!city && cityQuery.trim() && (
            <>
              <div className="db-field">
                <label className="db-label">City not listed? Name</label>
                <input className="db-input" value={form.customCity || cityQuery} onChange={set('customCity')} />
              </div>
              <div className="db-field">
                <label className="db-label">Country code (e.g. GB)</label>
                <input className="db-input" maxLength={2} value={form.customCountry} onChange={set('customCountry')} />
              </div>
            </>
          )}
          <div className="db-field">
            <label className="db-label">Title (optional)</label>
            <input className="db-input" value={form.title} onChange={set('title')} />
          </div>
          <div className="db-field">
            <label className="db-label">Ticket link (DICE / RA / etc.)</label>
            <input className="db-input" type="url" value={form.url} onChange={set('url')} />
          </div>
        </div>

        {status && <p className="db-hint" style={{ color: status.ok ? '#00ff88' : '#ff6b81', marginBottom: '0.75rem' }}>{status.text}</p>}
        <button type="button" className="db-btn db-btn--primary" onClick={add} disabled={!secret}>Add event</button>
        {!city && cityQuery.trim() && (
          <p className="db-hint" style={{ marginTop: '0.5rem' }}>
            Unlisted cities show in country searches but not on the city map (no coordinates).
          </p>
        )}
      </div>

      <div className="db-card">
        {loading ? (
          <p className="db-hint">Loading...</p>
        ) : events.length === 0 ? (
          <p className="db-hint">No manual events yet.</p>
        ) : (
          <div className="db-drafts-list">
            {events.map(e => (
              <div key={e.event_key} className="db-draft-row">
                <div className="db-draft-info">
                  <span className="db-draft-title">{e.artist_name}{e.title ? ` — ${e.title}` : ''}</span>
                  <span className="db-draft-date">
                    {e.event_date}{e.event_time ? ` ${e.event_time}` : ''} · {[e.venue, e.city, e.country_code].filter(Boolean).join(', ')}
                  </span>
                </div>
                <div className="db-draft-actions">
                  {e.url && <a className="db-btn db-btn--sm" href={e.url} target="_blank" rel="noopener noreferrer">Link</a>}
                  <button className="db-btn db-btn--sm db-btn--danger" onClick={() => remove(e.event_key)} disabled={!secret}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
