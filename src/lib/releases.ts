import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrackedArtist } from './trackedArtists'

// Reads `artist_releases` (filled by the artist-releases Edge Function) and
// derives notifications + calendar entries for the visitor's tracked artists.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const SEEN_KEY = 'tab_notifs_seen_at'
const SEEN_EVENT = 'tab:notifs-seen'
export const RELEASES_EVENT = 'tab:releases-updated'

export interface Release {
  release_key: string
  artist_id: string
  artist_name: string
  title: string
  release_type: string
  release_date: string          // YYYY-MM-DD
  date_precision: 'day' | 'month' | 'year'
  image: string
  url: string
  source: 'spotify' | 'musicbrainz'
  first_seen_at: string
}

export interface ReleaseNotification {
  key: string
  kind: 'announced' | 'released'
  at: string                    // ISO timestamp used for ordering / unread
  release: Release
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function formatReleaseDate(r: Release): string {
  const d = new Date(`${r.release_date}T00:00:00`)
  if (r.date_precision === 'year') return d.getFullYear().toString()
  if (r.date_precision === 'month') return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// An announcement (MusicBrainz) and the later Spotify release are the same record:
// keep one row per artist + title, preferring Spotify once it exists.
export function dedupeReleases(rows: Release[]): Release[] {
  const byKey = new Map<string, Release>()
  for (const r of rows) {
    const k = `${r.artist_id}:${norm(r.title)}`
    const cur = byKey.get(k)
    if (!cur) { byKey.set(k, r); continue }
    const keep = cur.source === 'spotify' ? cur : r.source === 'spotify' ? r : cur
    // Remember the earliest sighting so the "announced" notice survives the merge
    const firstSeen = cur.first_seen_at < r.first_seen_at ? cur.first_seen_at : r.first_seen_at
    byKey.set(k, { ...keep, first_seen_at: firstSeen })
  }
  return [...byKey.values()]
}

export async function fetchReleases(artistIds: string[]): Promise<Release[]> {
  if (!artistIds.length) return []
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/artist_releases?artist_id=in.(${artistIds.map(encodeURIComponent).join(',')})&release_date=gte.${since}&order=release_date.asc&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) return []
    return dedupeReleases(await res.json())
  } catch { return [] }
}

// Ask the Edge Function to look up an artist now (used right after tracking)
export async function requestArtistRefresh(artistId: string, artistName: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/artist-releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ artistId, artistName }),
    })
  } catch { /* the scheduled refresh will pick it up */ }
}

// Notifications:
//  - "announced": any upcoming release, dated when we first saw it (or when tracked, if later)
//  - "released":  anything that came out on/after the day the artist was tracked
export function deriveNotifications(releases: Release[], tracked: TrackedArtist[]): ReleaseNotification[] {
  const trackedAt = new Map(tracked.map(t => [t.artist_id, t.created_at ?? new Date(0).toISOString()]))
  const today = todayISO()
  const out: ReleaseNotification[] = []
  for (const r of releases) {
    const since = trackedAt.get(r.artist_id)
    if (!since) continue
    const announcedAt = r.first_seen_at > since ? r.first_seen_at : since
    if (r.release_date > today || r.first_seen_at.slice(0, 10) < r.release_date) {
      out.push({ key: `a:${r.release_key}`, kind: 'announced', at: announcedAt, release: r })
    }
    if (r.release_date <= today && r.release_date >= since.slice(0, 10)) {
      out.push({ key: `r:${r.release_key}`, kind: 'released', at: `${r.release_date}T00:00:00.000Z`, release: r })
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

function readSeen(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}

export function useReleases(tracked: TrackedArtist[]) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [seenAt, setSeenAt] = useState(readSeen)
  const ids = tracked.map(t => t.artist_id).sort().join(',')

  useEffect(() => {
    let live = true
    const load = () => fetchReleases(ids ? ids.split(',') : []).then(r => { if (live) { setReleases(r); setLoading(false) } })
    setLoading(true)
    load()
    window.addEventListener(RELEASES_EVENT, load)
    return () => { live = false; window.removeEventListener(RELEASES_EVENT, load) }
  }, [ids])

  useEffect(() => {
    const sync = () => setSeenAt(readSeen())
    window.addEventListener(SEEN_EVENT, sync)
    return () => window.removeEventListener(SEEN_EVENT, sync)
  }, [])

  const notifications = useMemo(() => deriveNotifications(releases, tracked), [releases, tracked])
  const unread = notifications.filter(n => n.at > seenAt).length

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString()
    try { localStorage.setItem(SEEN_KEY, now) } catch { /* ignore */ }
    window.dispatchEvent(new Event(SEEN_EVENT))
  }, [])

  const upcoming = useMemo(() => releases.filter(r => r.release_date >= todayISO()), [releases])

  return { releases, upcoming, notifications, unread, seenAt, markAllSeen, loading }
}

export type ReleasesState = ReturnType<typeof useReleases>
