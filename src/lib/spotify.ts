const CLIENT_ID = '62fc99202df9401f8f53a086daebfc98'
const CLIENT_SECRET = '89957ce339d74f0ba8ec3a1a7fff0076'

let cachedToken: string | null = null
let tokenExpiry = 0

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`)
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

export interface SpotifyTrack {
  id: string
  name: string
  preview_url: string | null
  duration_ms: number
  track_number: number
}

export interface SpotifyAlbum {
  id: string
  name: string
  artists: { name: string }[]
  images: { url: string; width: number }[]
  release_date: string
  tracks: { items: SpotifyTrack[] }
}

export async function getAlbum(albumId: string): Promise<SpotifyAlbum | null> {
  try {
    const token = await getSpotifyToken()
    const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export interface SpotifyAlbumMeta {
  id: string
  name: string
  artists: { id: string; name: string }[]
}

// Cached album → artists lookup, used to map reviewed albums onto Spotify artists.
const ALBUM_META_KEY = 'tab_album_meta_v1'
const ALBUM_META_TTL = 7 * 24 * 60 * 60 * 1000

export async function getAlbumMetaCached(albumIds: string[]): Promise<Record<string, SpotifyAlbumMeta>> {
  let cache: { at: number; data: Record<string, SpotifyAlbumMeta> } = { at: Date.now(), data: {} }
  try {
    const raw = localStorage.getItem(ALBUM_META_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Date.now() - parsed.at < ALBUM_META_TTL) cache = parsed
    }
  } catch { /* ignore */ }

  const missing = albumIds.filter(id => !cache.data[id])
  for (const id of missing) {
    const album = await getAlbum(id)
    if (album) {
      cache.data[id] = {
        id: album.id,
        name: album.name,
        artists: (album.artists as any[]).map(a => ({ id: a.id, name: a.name })),
      }
    }
  }
  if (missing.length) {
    try { localStorage.setItem(ALBUM_META_KEY, JSON.stringify(cache)) } catch { /* ignore */ }
  }
  return cache.data
}

// ── Unified search (artists, albums, tracks) ─────────────────────────────────
export interface SearchArtist { id: string; name: string; image: string; genres: string[]; url: string }
export interface SearchAlbum  { id: string; name: string; artists: { id: string; name: string }[]; image: string; year: string; url: string }
export interface SearchTrack  { id: string; name: string; artists: { id: string; name: string }[]; albumId: string; albumName: string; image: string; url: string }

export interface SearchResults {
  artists: SearchArtist[]
  albums: SearchAlbum[]
  tracks: SearchTrack[]
}

const pickImage = (images: any[] | undefined) =>
  images?.find((i: any) => i.width && i.width <= 320)?.url ?? images?.[0]?.url ?? ''

export async function searchSpotify(query: string, limit = 5): Promise<SearchResults> {
  const empty: SearchResults = { artists: [], albums: [], tracks: [] }
  if (!query.trim()) return empty
  try {
    const token = await getSpotifyToken()
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist,album,track&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return empty
    const data = await res.json()
    return {
      artists: (data.artists?.items ?? []).filter(Boolean).map((a: any) => ({
        id: a.id, name: a.name, image: pickImage(a.images), genres: a.genres ?? [],
        url: a.external_urls?.spotify ?? '',
      })),
      albums: (data.albums?.items ?? []).filter(Boolean).map((a: any) => ({
        id: a.id, name: a.name,
        artists: (a.artists ?? []).map((x: any) => ({ id: x.id, name: x.name })),
        image: pickImage(a.images), year: a.release_date?.slice(0, 4) ?? '',
        url: a.external_urls?.spotify ?? '',
      })),
      tracks: (data.tracks?.items ?? []).filter(Boolean).map((t: any) => ({
        id: t.id, name: t.name,
        artists: (t.artists ?? []).map((x: any) => ({ id: x.id, name: x.name })),
        albumId: t.album?.id ?? '', albumName: t.album?.name ?? '',
        image: pickImage(t.album?.images), url: t.external_urls?.spotify ?? '',
      })),
    }
  } catch {
    return empty
  }
}

export async function getArtist(artistId: string): Promise<SearchArtist | null> {
  try {
    const token = await getSpotifyToken()
    const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const a = await res.json()
    return { id: a.id, name: a.name, image: pickImage(a.images), genres: a.genres ?? [], url: a.external_urls?.spotify ?? '' }
  } catch {
    return null
  }
}

export function parseSpotifyAlbumId(input: string): string {
  const match = input.match(/album\/([A-Za-z0-9]+)/)
  return match ? match[1] : input.trim()
}

// ── Deezer preview fetching via Supabase Edge Function ───────────────────────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export async function getDeezerPreview(trackName: string, artistName: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/deezer-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ trackName, artistName }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.preview ?? null
  } catch {
    return null
  }
}

// Fetch all previews for an album's tracks in parallel
export async function getAlbumPreviews(
  tracks: { name: string }[],
  artistName: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const t of tracks) {
    const preview = await getDeezerPreview(t.name, artistName)
    if (preview) map.set(t.name.toLowerCase(), preview)
    // Small delay to avoid Deezer rate limiting
    await new Promise(r => setTimeout(r, 80))
  }
  return map
}
