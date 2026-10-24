import { useState, useEffect, useCallback } from 'react'
import { requestArtistRefresh, RELEASES_EVENT } from './releases'
import { requestEventsRefresh, EVENTS_EVENT } from './events'

// Tracked artists live in Supabase (`tracked_artists`, see
// supabase/migrations/20261023000000_tracked_artists.sql), keyed by the same
// localStorage fingerprint LikeButton uses. A local mirror keeps the UI instant
// and still works if the table hasn't been created yet.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const LOCAL_KEY = 'tab_tracked_artists'
const CHANGE_EVENT = 'tab:tracked-artists'
let remoteSynced = false

export interface TrackedArtist {
  artist_id: string
  artist_name: string
  artist_image: string
  created_at?: string
}

// Same key as LikeButton's getFingerprint so a visitor has one identity
export function getFingerprint(): string {
  const key = 'tab_fp'
  let fp = localStorage.getItem(key)
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, fp)
  }
  return fp
}

const headers = () => ({
  apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
})

function readLocal(): TrackedArtist[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}

function writeLocal(list: TrackedArtist[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

async function fetchRemote(fp: string): Promise<TrackedArtist[] | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tracked_artists?fingerprint=eq.${encodeURIComponent(fp)}&select=artist_id,artist_name,artist_image,created_at&order=created_at.desc`,
      { headers: headers() }
    )
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

export async function trackArtist(artist: TrackedArtist): Promise<void> {
  const list = readLocal().filter(a => a.artist_id !== artist.artist_id)
  writeLocal([{ ...artist, created_at: new Date().toISOString() }, ...list])
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/tracked_artists?on_conflict=fingerprint,artist_id`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ fingerprint: getFingerprint(), ...artist }),
    })
  } catch { /* local mirror still has it */ }
  // Look up their releases and shows straight away rather than waiting for the schedule
  requestArtistRefresh(artist.artist_id, artist.artist_name)
    .then(() => window.dispatchEvent(new Event(RELEASES_EVENT)))
  requestEventsRefresh(artist.artist_id, artist.artist_name)
    .then(() => window.dispatchEvent(new Event(EVENTS_EVENT)))
}

export async function untrackArtist(artistId: string): Promise<void> {
  writeLocal(readLocal().filter(a => a.artist_id !== artistId))
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/tracked_artists?fingerprint=eq.${encodeURIComponent(getFingerprint())}&artist_id=eq.${encodeURIComponent(artistId)}`,
      { method: 'DELETE', headers: headers() }
    )
  } catch { /* ignore */ }
}

export function useTrackedArtists() {
  const [artists, setArtists] = useState<TrackedArtist[]>(readLocal)

  useEffect(() => {
    const sync = () => setArtists(readLocal())
    window.addEventListener(CHANGE_EVENT, sync)
    // Remote wins when reachable, so tracking survives a cleared mirror
    if (!remoteSynced) {
      remoteSynced = true
      fetchRemote(getFingerprint()).then(remote => {
        if (remote && remote.length) writeLocal(remote)
      })
    }
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const isTracked = useCallback((id: string) => artists.some(a => a.artist_id === id), [artists])

  const toggle = useCallback((artist: TrackedArtist) => {
    return isTracked(artist.artist_id) ? untrackArtist(artist.artist_id) : trackArtist(artist)
  }, [isTracked])

  return { artists, isTracked, toggle }
}
