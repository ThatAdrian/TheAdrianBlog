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

// Extract album ID from a Spotify URL or return as-is if already an ID
export function parseSpotifyAlbumId(input: string): string {
  const match = input.match(/album\/([A-Za-z0-9]+)/)
  return match ? match[1] : input.trim()
}
