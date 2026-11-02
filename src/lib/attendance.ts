import { useState, useEffect, useCallback } from 'react'
import { getFingerprint } from './trackedArtists'
import { ArtistEvent } from './events'
import { supabase, onAccountChange, requireAccount, currentUserId } from './auth'

// "I'm going" marks live in Supabase (`event_attendance`, see
// supabase/migrations/20261024010000_event_attendance.sql and
// 20261102000000_user_accounts.sql) and belong to your account, like tracked
// artists. A local mirror keeps the button instant; pre-account fingerprint
// marks are shown while signed out and move into the account on first sign-in.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const LOCAL_KEY = 'tab_going'
const OWNER_KEY = 'tab_going_owner'
const CHANGE_EVENT = 'tab:going'
const COUNTS_EVENT = 'tab:going-counts'

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
      // Counts only; who is going isn't readable with the public key
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/event_going_counts`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ keys: chunk }),
      })
      if (res.ok) (await res.json() as { event_key: string; going: number }[]).forEach(r => counts.set(r.event_key, Number(r.going) || 0))
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
const SELECT = 'event_key,artist_id,event_date'

async function fetchAccount(): Promise<GoingMark[] | null> {
  const { data, error } = await supabase.from('event_attendance').select(SELECT)
  return error ? null : (data as GoingMark[])
}

function readOwner(): string | null {
  try { return localStorage.getItem(OWNER_KEY) } catch { return null }
}

function setOwner(id: string | null) {
  try { id ? localStorage.setItem(OWNER_KEY, id) : localStorage.removeItem(OWNER_KEY) } catch { /* ignore */ }
}

onAccountChange(async (user, firstLink) => {
  if (user) {
    if (firstLink && !readOwner()) {
      const local = readLocal()
      if (local.length) {
        await supabase.from('event_attendance').upsert(
          local.map(m => ({ user_id: user.id, ...m })),
          { onConflict: 'user_id,event_key', ignoreDuplicates: true }
        )
      }
    }
    const remote = await fetchAccount()
    if (remote && currentUserId() === user.id) {
      setOwner(user.id)
      writeLocal(remote)
    }
    return
  }
  if (readOwner()) {
    setOwner(null)
    writeLocal([])
    return
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event_attendance?fingerprint=eq.${encodeURIComponent(getFingerprint())}&select=${SELECT}`, { headers: headers() })
    const legacy: GoingMark[] | null = res.ok ? await res.json() : null
    if (legacy && legacy.length && !currentUserId() && !readOwner()) writeLocal(legacy)
  } catch { /* ignore */ }
})

async function markGoing(e: ArtistEvent) {
  const userId = currentUserId()
  if (!userId) return
  const mark = { event_key: e.event_key, artist_id: e.artist_id, event_date: e.event_date }
  writeLocal([mark, ...readLocal().filter(m => m.event_key !== e.event_key)])
  bumpCount(e.event_key, 1)
  const { error } = await supabase.from('event_attendance').upsert(
    { user_id: userId, ...mark },
    { onConflict: 'user_id,event_key', ignoreDuplicates: true }
  )
  if (error) {
    bumpCount(e.event_key, -1)
    const remote = await fetchAccount()
    if (remote) writeLocal(remote)
  }
}

async function unmarkGoing(key: string) {
  const userId = currentUserId()
  if (!userId) return
  writeLocal(readLocal().filter(m => m.event_key !== key))
  bumpCount(key, -1)
  const { error } = await supabase.from('event_attendance').delete().eq('user_id', userId).eq('event_key', key)
  if (error) {
    bumpCount(key, 1)
    const remote = await fetchAccount()
    if (remote) writeLocal(remote)
  }
}

export function useGoing() {
  const [marks, setMarks] = useState<GoingMark[]>(readLocal)

  useEffect(() => {
    const sync = () => setMarks(readLocal())
    window.addEventListener(CHANGE_EVENT, sync)
    sync()
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const isGoing = useCallback((key: string) => marks.some(m => m.event_key === key), [marks])
  // Signed out, this opens the "you need an account" prompt instead
  const toggle = useCallback((e: ArtistEvent) => {
    if (!requireAccount('mark concerts you’re going to')) return Promise.resolve()
    return isGoing(e.event_key) ? unmarkGoing(e.event_key) : markGoing(e)
  }, [isGoing])

  return { marks, isGoing, toggle }
}
