// similar-artists — "discover" suggestions for the Music page.
//
//   POST { seeds: [{ id, name }], exclude?: [spotifyArtistId], limit?: number }
//     → { artists: [{ id, name, image, genres, url, because: [seed name] }] }
//
// For each seed it asks Deezer for related artists (no key needed) and, when
// LASTFM_API_KEY is set, Last.fm's similar artists too (better on underground
// scenes). Artists that come up for several seeds rank highest. Each pick is
// then matched to Spotify so it can be tracked and opened like any other artist.
//
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET (shared), LASTFM_API_KEY (optional)
// Deploy with JWT verification off.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_SEEDS = 8
const PER_SEED = 20
const CACHE_MS = 6 * 60 * 60 * 1000

interface Seed { id: string; name: string }
interface Candidate { name: string; score: number; because: Set<string> }
interface OutArtist { id: string; name: string; image: string; genres: string[]; url: string; because: string[] }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

async function getJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, init)
    return res.ok ? await res.json() : null
  } catch { return null }
}

// ── Sources (each returns names, most similar first) ─────────────────────────
const relatedCache = new Map<string, { at: number; names: string[] }>()

async function cached(key: string, load: () => Promise<string[]>): Promise<string[]> {
  const hit = relatedCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.names
  const names = await load()
  relatedCache.set(key, { at: Date.now(), names })
  return names
}

function deezerRelated(name: string): Promise<string[]> {
  return cached(`dz:${norm(name)}`, async () => {
    const found = await getJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
    const match = (found?.data ?? []).find((a: any) => norm(a.name) === norm(name))
    if (!match) return []
    const rel = await getJson(`https://api.deezer.com/artist/${match.id}/related?limit=${PER_SEED}`)
    return (rel?.data ?? []).map((a: any) => String(a.name))
  })
}

function lastfmSimilar(name: string): Promise<string[]> {
  const key = (Deno.env.get('LASTFM_API_KEY') ?? '').trim()
  if (!key) return Promise.resolve([])
  return cached(`lf:${norm(name)}`, async () => {
    const data = await getJson(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(name)}&autocorrect=1&limit=${PER_SEED}&api_key=${key}&format=json`,
    )
    return (data?.similarartists?.artist ?? []).map((a: any) => String(a.name))
  })
}

// ── Spotify matching ─────────────────────────────────────────────────────────
let spotifyToken: { token: string; expires: number } | null = null

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyToken.expires) return spotifyToken.token
  const id = (Deno.env.get('SPOTIFY_CLIENT_ID') ?? '').trim()
  const secret = (Deno.env.get('SPOTIFY_CLIENT_SECRET') ?? '').trim()
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`)
  const data = await res.json()
  spotifyToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return spotifyToken.token
}

const spotifyCache = new Map<string, { at: number; artist: Omit<OutArtist, 'because'> | null }>()

async function spotifyArtist(name: string): Promise<Omit<OutArtist, 'because'> | null> {
  const hit = spotifyCache.get(norm(name))
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.artist
  const token = await getSpotifyToken()
  const data = await getJson(
    `https://api.spotify.com/v1/search?type=artist&limit=5&q=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const a = (data?.artists?.items ?? []).find((x: any) => norm(x.name) === norm(name))
  const artist = a ? {
    id: a.id,
    name: a.name,
    image: a.images?.find((i: any) => i.width && i.width <= 320)?.url ?? a.images?.[0]?.url ?? '',
    genres: a.genres ?? [],
    url: a.external_urls?.spotify ?? '',
  } : null
  spotifyCache.set(norm(name), { at: Date.now(), artist })
  return artist
}

// ── Ranking ──────────────────────────────────────────────────────────────────
async function suggest(seeds: Seed[], exclude: Set<string>, limit: number): Promise<OutArtist[]> {
  const seedNames = new Set(seeds.map(s => norm(s.name)))
  const pool = new Map<string, Candidate>()

  await Promise.all(seeds.map(async seed => {
    const lists = await Promise.all([deezerRelated(seed.name), lastfmSimilar(seed.name)])
    lists.forEach(list => list.forEach((name, rank) => {
      const k = norm(name)
      if (!k || seedNames.has(k)) return
      const c = pool.get(k) ?? { name, score: 0, because: new Set<string>() }
      c.score += 1 - rank / (PER_SEED + 1)   // closer matches count more
      c.because.add(seed.name)
      pool.set(k, c)
    }))
  }))

  // Shared by several seeds = closer to the whole taste, not just one artist
  const ranked = [...pool.values()]
    .map(c => ({ ...c, score: c.score * (1 + 0.5 * (c.because.size - 1)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 3)

  const out: OutArtist[] = []
  for (let i = 0; i < ranked.length && out.length < limit; i += 6) {
    const batch = await Promise.all(ranked.slice(i, i + 6).map(async c => ({ c, a: await spotifyArtist(c.name).catch(() => null) })))
    for (const { c, a } of batch) {
      if (!a || exclude.has(a.id) || out.some(o => o.id === a.id) || out.length >= limit) continue
      out.push({ ...a, because: [...c.because].slice(0, 3) })
    }
  }
  return out
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const body = await req.json().catch(() => ({}))
  const seeds: Seed[] = (Array.isArray(body.seeds) ? body.seeds : [])
    .filter((s: any) => s && typeof s.name === 'string' && s.name.trim())
    .slice(0, MAX_SEEDS)
    .map((s: any) => ({ id: String(s.id ?? ''), name: s.name.slice(0, 200) }))
  if (!seeds.length) return json({ error: 'seeds required' }, 400)

  const exclude = new Set<string>([
    ...seeds.map(s => s.id),
    ...(Array.isArray(body.exclude) ? body.exclude.map(String).slice(0, 500) : []),
  ])
  const limit = Math.min(Math.max(Number(body.limit) || 12, 1), 24)

  try {
    return json({ artists: await suggest(seeds, exclude, limit) })
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502)
  }
})
