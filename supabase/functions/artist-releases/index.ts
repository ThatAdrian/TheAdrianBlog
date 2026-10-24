// artist-releases — refreshes `artist_releases` for tracked artists.
//
//   POST { artistId, artistName }  → refresh one artist (called when someone tracks them)
//   POST { mode: "all" } + header x-cron-secret → refresh tracked artists, oldest-checked first (pg_cron)
//
// Released music comes from Spotify (artist albums), announced future dates
// from MusicBrainz (release groups with a first-release-date after today).
//
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, CRON_SECRET
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
// Deploy: supabase functions deploy artist-releases --no-verify-jwt

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MB_UA = 'TheAdrianBlog/1.0 ( https://theadrianblog.com )'
const RECENT_DAYS = 120

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Artist { artist_id: string; artist_name: string }

interface ReleaseRow {
  release_key: string
  artist_id: string
  artist_name: string
  title: string
  release_type: string
  release_date: string
  date_precision: string
  image: string
  url: string
  source: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const today = () => new Date().toISOString().slice(0, 10)

// "2026", "2026-11", "2026-11-14" → full date + precision
function normaliseDate(d: string): { date: string; precision: string } | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return { date: d, precision: 'day' }
  if (/^\d{4}-\d{2}$/.test(d)) return { date: `${d}-01`, precision: 'month' }
  if (/^\d{4}$/.test(d)) return { date: `${d}-01-01`, precision: 'year' }
  return null
}

// ── Spotify ──────────────────────────────────────────────────────────────────
let spotifyToken: { token: string; expires: number } | null = null

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyToken.expires) return spotifyToken.token
  const id = Deno.env.get('SPOTIFY_CLIENT_ID')!
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET')!
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`)
  const data = await res.json()
  spotifyToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return spotifyToken.token
}

async function spotifyReleases(a: Artist): Promise<ReleaseRow[]> {
  const token = await getSpotifyToken()
  const res = await fetch(
    `https://api.spotify.com/v1/artists/${a.artist_id}/albums?include_groups=album,single&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const data = await res.json()
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10)
  return (data.items ?? [])
    .map((al: any): ReleaseRow | null => {
      const nd = normaliseDate(al.release_date ?? '')
      if (!nd || nd.precision !== 'day' || nd.date < cutoff) return null
      const type = al.album_type === 'single' && al.total_tracks >= 4 ? 'ep' : al.album_type
      return {
        release_key: `spotify:${al.id}`,
        artist_id: a.artist_id,
        artist_name: a.artist_name,
        title: al.name,
        release_type: type ?? 'album',
        release_date: nd.date,
        date_precision: nd.precision,
        image: al.images?.find((i: any) => i.width && i.width <= 320)?.url ?? al.images?.[0]?.url ?? '',
        url: al.external_urls?.spotify ?? '',
        source: 'spotify',
      }
    })
    .filter(Boolean) as ReleaseRow[]
}

// ── MusicBrainz (max 1 request / second) ─────────────────────────────────────
async function mb(path: string): Promise<any> {
  await sleep(1100)
  const res = await fetch(`https://musicbrainz.org/ws/2/${path}`, { headers: { 'User-Agent': MB_UA, Accept: 'application/json' } })
  if (!res.ok) return null
  return res.json()
}

async function mbAnnounced(a: Artist): Promise<ReleaseRow[]> {
  const found = await mb(`artist?query=${encodeURIComponent(`artist:"${a.artist_name}"`)}&limit=3&fmt=json`)
  const match = (found?.artists ?? []).find((x: any) =>
    x.score >= 90 && x.name.toLowerCase() === a.artist_name.toLowerCase())
  if (!match) return []

  const q = `arid:${match.id} AND firstreleasedate:[${today()} TO 2099-12-31]`
  const groups = await mb(`release-group?query=${encodeURIComponent(q)}&limit=10&fmt=json`)
  return (groups?.['release-groups'] ?? [])
    .map((g: any): ReleaseRow | null => {
      const nd = normaliseDate(g['first-release-date'] ?? '')
      if (!nd || nd.date < today()) return null
      return {
        release_key: `mb:${g.id}`,
        artist_id: a.artist_id,
        artist_name: a.artist_name,
        title: g.title,
        release_type: (g['primary-type'] ?? 'other').toLowerCase(),
        release_date: nd.date,
        date_precision: nd.precision,
        image: `https://coverartarchive.org/release-group/${g.id}/front-250`,
        url: `https://musicbrainz.org/release-group/${g.id}`,
        source: 'musicbrainz',
      }
    })
    .filter(Boolean) as ReleaseRow[]
}

// ── Supabase (service role) ──────────────────────────────────────────────────
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }

async function trackedArtists(): Promise<Artist[]> {
  const res = await fetch(`${SB_URL}/rest/v1/tracked_artists?select=artist_id,artist_name`, { headers: sbHeaders })
  if (!res.ok) return []
  const rows: Artist[] = await res.json()
  const seen = new Map<string, Artist>()
  rows.forEach(r => seen.set(r.artist_id, r))
  return [...seen.values()]
}

// merge-duplicates updates only the columns sent, so first_seen_at is kept
async function upsert(rows: ReleaseRow[]) {
  if (!rows.length) return
  await fetch(`${SB_URL}/rest/v1/artist_releases?on_conflict=release_key`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
}

async function refresh(a: Artist): Promise<number> {
  const [sp, an] = await Promise.all([
    spotifyReleases(a).catch(() => []),
    mbAnnounced(a).catch(() => []),
  ])
  const rows = [...sp, ...an]
  await upsert(rows)
  return rows.length
}

// ── Batching: oldest-checked artists first, stopping well before the
// Edge Function time limit; the next scheduled run carries on from there.
const TIME_BUDGET_MS = 100_000
const CHECKED_COL = 'releases_checked_at'

async function lastChecked(): Promise<Map<string, string>> {
  const res = await fetch(`${SB_URL}/rest/v1/artist_refresh?select=artist_id,${CHECKED_COL}`, { headers: sbHeaders })
  if (!res.ok) return new Map()
  const rows: Record<string, string | null>[] = await res.json()
  return new Map(rows.map(r => [r.artist_id as string, r[CHECKED_COL] ?? '']))
}

async function markChecked(artistId: string) {
  await fetch(`${SB_URL}/rest/v1/artist_refresh?on_conflict=artist_id`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ artist_id: artistId, [CHECKED_COL]: new Date().toISOString() }),
  })
}

async function refreshDue(): Promise<{ checked: number; remaining: number }> {
  const started = Date.now()
  const last = await lastChecked()
  const queue = (await trackedArtists())
    .sort((a, b) => (last.get(a.artist_id) ?? '').localeCompare(last.get(b.artist_id) ?? ''))
  let checked = 0
  for (const a of queue) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    await refresh(a)
    await markChecked(a.artist_id)
    checked++
  }
  return { checked, remaining: queue.length - checked }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const body = await req.json().catch(() => ({}))

  if (body.mode === 'all') {
    if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'unauthorised' }, 401)
    return json(await refreshDue())
  }

  const artistId = String(body.artistId ?? '')
  const artistName = String(body.artistName ?? '').slice(0, 200)
  if (!/^[A-Za-z0-9]{22}$/.test(artistId) || !artistName) return json({ error: 'artistId and artistName required' }, 400)
  const releases = await refresh({ artist_id: artistId, artist_name: artistName })
  await markChecked(artistId)
  return json({ releases })
})
