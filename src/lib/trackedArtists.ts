import { useState, useEffect, useCallback } from 'react'
import { requestArtistRefresh, RELEASES_EVENT } from './releases'
import { requestEventsRefresh, EVENTS_EVENT } from './events'
import { supabase, onAccountChange, requireAccount, currentUserId } from './auth'

// Tracked artists live in Supabase (`tracked_artists`, see
// supabase/migrations/20261023000000_tracked_artists.sql and
// 20261102000000_user_accounts.sql) and belong to your account, so they
// follow you between devices. Tracking needs an account.
//
// A local mirror keeps the UI instant. While signed in it holds the account's
// list (OWNER_KEY says whose). Before accounts, rows were keyed by the
// localStorage fingerprint; signed-out visitors still see those, and they move
// into the account the first time this browser signs in (see auth.ts).

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const LOCAL_KEY = 'tab_tracked_artists'
const OWNER_KEY = 'tab_tracked_artists_owner'
const CHANGE_EVENT = 'tab:tracked-artists'
const SELECT = 'artist_id,artist_name,artist_image,created_at'

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

// Pre-account rows for this browser (public key, fingerprint filter)
async function fetchLegacy(fp: string): Promise<TrackedArtist[] | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tracked_artists?fingerprint=eq.${encodeURIComponent(fp)}&select=${SELECT}&order=created_at.desc`,
      { headers: headers() }
    )
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// The signed-in account's rows (RLS only returns your own)
async function fetchAccount(): Promise<TrackedArtist[] | null> {
  const { data, error } = await supabase.from('tracked_artists').select(SELECT).order('created_at', { ascending: false })
  return error ? null : (data as TrackedArtist[])
}

function setOwner(id: string | null) {
  try { id ? localStorage.setItem(OWNER_KEY, id) : localStorage.removeItem(OWNER_KEY) } catch { /* ignore */ }
}

function readOwner(): string | null {
  try { return localStorage.getItem(OWNER_KEY) } catch { return null }
}

onAccountChange(async (user, firstLink) => {
  if (user) {
    // Anything only in this browser's old mirror (e.g. a failed save) goes up too
    if (firstLink && !readOwner()) {
      const local = readLocal()
      if (local.length) {
        await supabase.from('tracked_artists').upsert(
          local.map(a => ({ user_id: user.id, artist_id: a.artist_id, artist_name: a.artist_name, artist_image: a.artist_image })),
          { onConflict: 'user_id,artist_id', ignoreDuplicates: true }
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
  // Signed out: drop the account's list from this browser
  if (readOwner()) {
    setOwner(null)
    writeLocal([])
    return
  }
  // Never signed in here: show any pre-account tracking
  const legacy = await fetchLegacy(getFingerprint())
  if (legacy && legacy.length && !currentUserId() && !readOwner()) writeLocal(legacy)
})

export async function trackArtist(artist: TrackedArtist): Promise<void> {
  const userId = currentUserId()
  if (!requireAccount('track artists') || !userId) return
  const list = readLocal().filter(a => a.artist_id !== artist.artist_id)
  writeLocal([{ ...artist, created_at: new Date().toISOString() }, ...list])
  const { error } = await supabase.from('tracked_artists').upsert(
    { user_id: userId, artist_id: artist.artist_id, artist_name: artist.artist_name, artist_image: artist.artist_image },
    { onConflict: 'user_id,artist_id', ignoreDuplicates: true }
  )
  if (error) {
    // Put the list back to what the account really has
    const remote = await fetchAccount()
    if (remote) writeLocal(remote)
    return
  }
  // Look up their releases and shows straight away rather than waiting for the schedule
  requestArtistRefresh(artist.artist_id, artist.artist_name)
    .then(() => window.dispatchEvent(new Event(RELEASES_EVENT)))
  requestEventsRefresh(artist.artist_id, artist.artist_name)
    .then(() => window.dispatchEvent(new Event(EVENTS_EVENT)))
}

export async function untrackArtist(artistId: string): Promise<void> {
  const userId = currentUserId()
  if (!requireAccount('track artists') || !userId) return
  writeLocal(readLocal().filter(a => a.artist_id !== artistId))
  const { error } = await supabase.from('tracked_artists').delete().eq('user_id', userId).eq('artist_id', artistId)
  if (error) {
    const remote = await fetchAccount()
    if (remote) writeLocal(remote)
  }
}

export function useTrackedArtists() {
  const [artists, setArtists] = useState<TrackedArtist[]>(readLocal)

  useEffect(() => {
    const sync = () => setArtists(readLocal())
    window.addEventListener(CHANGE_EVENT, sync)
    sync()
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const isTracked = useCallback((id: string) => artists.some(a => a.artist_id === id), [artists])

  // Signed out, this opens the "you need an account" prompt instead
  const toggle = useCallback((artist: TrackedArtist) => {
    if (!requireAccount('track artists')) return Promise.resolve()
    return isTracked(artist.artist_id) ? untrackArtist(artist.artist_id) : trackArtist(artist)
  }, [isTracked])

  return { artists, isTracked, toggle }
}
