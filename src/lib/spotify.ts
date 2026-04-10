const CLIENT_ID = '62fc99202df9401f8f53a086daebfc98'
const CLIENT_SECRET = '89957ce339d74f0ba8ec3a1a7fff0076'

let cachedToken: string | null = null
let tokenExpiry = 0

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('[Spotify] Using cached token')
    return cachedToken
  }
  console.log('[Spotify] Fetching new token...')
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) {
      console.error('[Spotify] Token request failed:', res.status, res.statusText)
      throw new Error(`Token request failed: ${res.status}`)
    }
    const data = await res.json()
    console.log('[Spotify] Token received OK')
    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return cachedToken!
  } catch (err) {
    console.error('[Spotify] Token fetch error:', err)
    throw err
  }
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
  console.log('[Spotify] Fetching album:', albumId)
  try {
    const token = await getSpotifyToken()
    const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('[Spotify] Album request failed:', res.status, res.statusText)
      return null
    }
    const data = await res.json()
    console.log('[Spotify] Album received:', data.name, '— tracks:', data.tracks?.items?.length)
    return data
  } catch (err) {
    console.error('[Spotify] Album fetch error:', err)
    return null
  }
}

export function parseSpotifyAlbumId(input: string): string {
  const match = input.match(/album\/([A-Za-z0-9]+)/)
  return match ? match[1] : input.trim()
}
