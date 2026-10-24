import { useState, useEffect, useCallback } from 'react'
import { getFingerprint } from './trackedArtists'
import { ArtistEvent } from './events'

// "I'm going" marks live in Supabase (`event_attendance`, see
// supabase/migrations/20261024010000_event_attendance.sql), keyed by the same
// fingerprint as tracked artists, with a local mirror so the button is instant.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const LOCAL_KEY = 'tab_going'
const CHANGE_EVENT = 'tab:going'
const COUNTS_EVENT = 'tab:going-counts'
let remoteSynced = false

export interface GoingMark { event_key: string; artist_id: string; event_date: string }

const headers = () => ({
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
})

function readLocal(): GoingMark[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}

function writeLocal(list: GoingMark[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// PostgREST in.() list; keys contain ':' so each value is quoted
const inList = (keys: string[]) => `in.(${keys.map(k => `"${k.replace(/"/g, '')}"`).map(encodeURIComponent).join(',')})`

// ── Going counts, batched so a list of rows makes one request ────────────────
const counts = new Map<string, number>()
const pending = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

async function flushCounts() {
  flushTimer = null
  const keys = [...pending]
  pending.clear()
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40)
    chunk.forEach(k => counts.set(k, 0))
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/event_attendance?event_key=${inList(chunk)}&select=event_key`, { headers: headers() })
      if (res.ok) (await res.json() as { event_key: string }[]).forEach(r => counts.set(r.event_key, (counts.get(r.event_key) ?? 0) + 1))
    } catch { /* counts stay 0 */ }
  }
  window.dispatchEvent(new Event(COUNTS_EVENT))
}

function requestCount(key: string) {
  if (counts.has(key) || pending.has(key)) return
  pending.add(key)
  flushTimer ??= setTimeout(flushCounts, 30)
}

function bumpCount(key: string, by: number) {
  if (!counts.has(key)) return
  counts.set(key, Math.max(0, (counts.get(key) ?? 0) + by))
  window.dispatchEvent(new Event(COUNTS_EVENT))
}

export function useGoingCount(key: string): number | null {
  const [n, setN] = useState<number | null>(counts.get(key) ?? null)
  useEffect(() => {
    const sync = () => setN(counts.get(key) ?? null)
    window.addEventListener(COUNTS_EVENT, sync)
    requestCount(key)
    sync()
    return () => window.removeEventListener(COUNTS_EVENT, sync)
  }, [key])
  return n
}

// ── Your own marks ───────────────────────────────────────────────────────────
async function markGoing(e: ArtistEvent) {
  writeLocal([{ event_key: e.event_key, artist_id: e.artist_id, event_date: e.event_date }, ...readLocal().filter(m => m.event_key !== e.event_key)])
  bumpCount(e.event_key, 1)
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/event_attendance?on_conflict=fingerprint,event_key`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ fingerprint: getFingerprint(), event_key: e.event_key, artist_id: e.artist_id, event_date: e.event_date }),
    })
  } catch { /* local mirror still has it */ }
}

async function unmarkGoing(key: string) {
  writeLocal(readLocal().filter(m => m.event_key !== key))
  bumpCount(key, -1)
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/event_attendance?fingerprint=eq.${encodeURIComponent(getFingerprint())}&event_key=eq.${encodeURIComponent(key)}`,
      { method: 'DELETE', headers: headers() }
    )
  } catch { /* ignore */ }
}

export function useGoing() {
  const [marks, setMarks] = useState<GoingMark[]>(readLocal)

  useEffect(() => {
    const sync = () => setMarks(readLocal())
    window.addEventListener(CHANGE_EVENT, sync)
    if (!remoteSynced) {
      remoteSynced = true
      fetch(`${SUPABASE_URL}/rest/v1/event_attendance?fingerprint=eq.${encodeURIComponent(getFingerprint())}&select=event_key,artist_id,event_date`, { headers: headers() })
        .then(r => (r.ok ? r.json() : null))
        .then((remote: GoingMark[] | null) => { if (remote && remote.length) writeLocal(remote) })
        .catch(() => {})
    }
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const isGoing = useCallback((key: string) => marks.some(m => m.event_key === key), [marks])
  const toggle = useCallback((e: ArtistEvent) => (isGoing(e.event_key) ? unmarkGoing(e.event_key) : markGoing(e)), [isGoing])

  return { marks, isGoing, toggle }
}
