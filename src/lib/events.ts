import { useState, useEffect, useMemo, useCallback } from 'react'
import { TrackedArtist } from './trackedArtists'
import { todayISO } from './releases'

// Reads `artist_events` (filled by the artist-events Edge Function) and filters
// it by the visitor's chosen regions: whole countries, or cities + radius.

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const REGIONS_KEY = 'tab_event_regions'
const REGIONS_EVENT = 'tab:event-regions'
export const EVENTS_EVENT = 'tab:events-updated'

export interface ArtistEvent {
  event_key: string
  artist_id: string
  artist_name: string
  title: string
  venue: string
  city: string
  country_code: string
  country_name: string
  lat: number | null
  lng: number | null
  event_date: string
  event_time: string
  url: string
  source: string
  first_seen_at: string
}

export interface CityRegion { name: string; country: string; lat: number; lng: number; radiusKm: number }
export interface Regions { countries: string[]; cities: CityRegion[] }

export const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: 'Ticketmaster', bandsintown: 'Bandsintown', seatgeek: 'SeatGeek', skiddle: 'Skiddle', manual: 'Added by Adrian',
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export function inRegions(e: ArtistEvent, r: Regions): boolean {
  if (e.country_code && r.countries.includes(e.country_code)) return true
  if (e.lat === null || e.lng === null) {
    // No coordinates: fall back to matching the city name
    return r.cities.some(c => c.country === e.country_code && c.name.toLowerCase() === e.city.toLowerCase())
  }
  return r.cities.some(c => distanceKm(c.lat, c.lng, e.lat!, e.lng!) <= c.radiusKm)
}

export function formatEventDate(e: ArtistEvent): string {
  const d = new Date(`${e.event_date}T00:00:00`)
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  return e.event_time ? `${date} · ${e.event_time}` : date
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const SOURCE_RANK = ['ticketmaster', 'bandsintown', 'seatgeek', 'skiddle', 'manual']

// The same show often appears on several sources: one per artist + date + city
export function dedupeEvents(rows: ArtistEvent[]): ArtistEvent[] {
  const byKey = new Map<string, ArtistEvent>()
  for (const e of rows) {
    const k = `${e.artist_id}:${e.event_date}:${norm(e.city)}`
    const cur = byKey.get(k)
    if (!cur) { byKey.set(k, e); continue }
    const better = SOURCE_RANK.indexOf(e.source) < SOURCE_RANK.indexOf(cur.source) ? e : cur
    const firstSeen = cur.first_seen_at < e.first_seen_at ? cur.first_seen_at : e.first_seen_at
    byKey.set(k, {
      ...better,
      lat: better.lat ?? cur.lat ?? e.lat,
      lng: better.lng ?? cur.lng ?? e.lng,
      first_seen_at: firstSeen,
    })
  }
  return [...byKey.values()].sort((a, b) => a.event_date.localeCompare(b.event_date))
}

export async function fetchEvents(artistIds: string[]): Promise<ArtistEvent[]> {
  if (!artistIds.length) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/artist_events?artist_id=in.(${artistIds.map(encodeURIComponent).join(',')})&event_date=gte.${todayISO()}&order=event_date.asc&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) return []
    return dedupeEvents(await res.json())
  } catch { return [] }
}

export async function requestEventsRefresh(artistId: string, artistName: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/artist-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ artistId, artistName }),
    })
  } catch { /* the scheduled refresh will pick it up */ }
}

// ── Regions (per visitor, localStorage) ──────────────────────────────────────
const EMPTY_REGIONS: Regions = { countries: [], cities: [] }

function readRegions(): Regions {
  try {
    const r = JSON.parse(localStorage.getItem(REGIONS_KEY) ?? 'null')
    return r && Array.isArray(r.countries) && Array.isArray(r.cities) ? r : EMPTY_REGIONS
  } catch { return EMPTY_REGIONS }
}

export function useRegions() {
  const [regions, setRegionsState] = useState<Regions>(readRegions)

  useEffect(() => {
    const sync = () => setRegionsState(readRegions())
    window.addEventListener(REGIONS_EVENT, sync)
    return () => window.removeEventListener(REGIONS_EVENT, sync)
  }, [])

  const setRegions = useCallback((update: (r: Regions) => Regions) => {
    const next = update(readRegions())
    try { localStorage.setItem(REGIONS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    window.dispatchEvent(new Event(REGIONS_EVENT))
  }, [])

  const toggleCountry = useCallback((iso: string) => setRegions(r => ({
    ...r, countries: r.countries.includes(iso) ? r.countries.filter(c => c !== iso) : [...r.countries, iso],
  })), [setRegions])

  const sameCity = (a: CityRegion, b: { name: string; country: string }) => a.name === b.name && a.country === b.country

  const toggleCity = useCallback((city: Omit<CityRegion, 'radiusKm'>, radiusKm: number) => setRegions(r => ({
    ...r, cities: r.cities.some(c => sameCity(c, city)) ? r.cities.filter(c => !sameCity(c, city)) : [...r.cities, { ...city, radiusKm }],
  })), [setRegions])

  const setCityRadius = useCallback((city: CityRegion, radiusKm: number) => setRegions(r => ({
    ...r, cities: r.cities.map(c => (sameCity(c, city) ? { ...c, radiusKm } : c)),
  })), [setRegions])

  const hasRegions = regions.countries.length > 0 || regions.cities.length > 0
  return { regions, hasRegions, toggleCountry, toggleCity, setCityRadius }
}

// ── Events for tracked artists ───────────────────────────────────────────────
export interface EventNotification { key: string; at: string; event: ArtistEvent }

export function useEvents(tracked: TrackedArtist[]) {
  const [events, setEvents] = useState<ArtistEvent[]>([])
  const [loading, setLoading] = useState(true)
  const { regions, hasRegions } = useRegions()
  const ids = tracked.map(t => t.artist_id).sort().join(',')

  useEffect(() => {
    let live = true
    const load = () => fetchEvents(ids ? ids.split(',') : []).then(e => { if (live) { setEvents(e); setLoading(false) } })
    setLoading(true)
    load()
    window.addEventListener(EVENTS_EVENT, load)
    return () => { live = false; window.removeEventListener(EVENTS_EVENT, load) }
  }, [ids])

  const nearby = useMemo(() => events.filter(e => inRegions(e, regions)), [events, regions])

  // A show in one of your regions counts as an announcement from when we first
  // saw it (or when you tracked the artist, if that was later)
  const notifications: EventNotification[] = useMemo(() => {
    const trackedAt = new Map(tracked.map(t => [t.artist_id, t.created_at ?? new Date(0).toISOString()]))
    return nearby
      .filter(e => trackedAt.has(e.artist_id))
      .map(e => {
        const since = trackedAt.get(e.artist_id)!
        return { key: `e:${e.event_key}`, at: e.first_seen_at > since ? e.first_seen_at : since, event: e }
      })
  }, [nearby, tracked])

  return { events, nearby, notifications, regions, hasRegions, loading }
}

export type EventsState = ReturnType<typeof useEvents>
