// artist-events — refreshes `artist_events` (concerts / tour dates) for tracked artists.
//
//   POST { artistId, artistName }                      → refresh one artist (called when someone tracks them)
//   POST { mode: "all" }      + header x-cron-secret   → refresh tracked artists, oldest-checked first (pg_cron)
//   POST { mode: "manual", action: "add" | "delete", ... } + header x-cron-secret
//                                                      → dashboard: add / remove a hand-entered event
//
// Every source is optional and only runs when its secret is set:
//   TICKETMASTER_API_KEY   (also covers Live Nation)
//   BANDSINTOWN_APP_ID
//   SEATGEEK_CLIENT_ID
//   SKIDDLE_API_KEY        (UK)
// Plus CRON_SECRET (same value as the artist-releases function).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Artist { artist_id: string; artist_name: string }

interface EventRow {
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
}

const today = () => new Date().toISOString().slice(0, 10)
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

// Country name ⇄ ISO code, built from the runtime's own locale data
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const codeByName = new Map<string, string>()
// Aliases and retired codes that share a name with the real one (UK → GB, DD → DE, …)
const SKIP_CODES = new Set(['UK', 'FX', 'DD', 'SU', 'YU', 'CS', 'ZR', 'TP', 'BU', 'NT', 'AN', 'EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'HV', 'DY', 'NH', 'RH', 'VD', 'YD'])
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b)
  if (SKIP_CODES.has(code)) continue
  try {
    const name = regionNames.of(code)
    if (name && name !== code) codeByName.set(norm(name), code)
  } catch { /* not a region */ }
}
const COUNTRY_ALIASES: Record<string, string> = {
  'uk': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
  'usa': 'US', 'united states of america': 'US', 'czech republic': 'CZ', 'south korea': 'KR', 'russia': 'RU',
}
function countryCode(nameOrCode: string): string {
  if (/^[A-Za-z]{2}$/.test(nameOrCode)) return nameOrCode.toUpperCase()
  const n = norm(nameOrCode)
  return COUNTRY_ALIASES[n] ?? codeByName.get(n) ?? ''
}
function countryName(code: string, fallback = ''): string {
  try { return (code && regionNames.of(code)) || fallback } catch { return fallback }
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    // Include the provider's own reason (e.g. Ticketmaster's "Invalid ApiKey"), never the key itself
    const reason = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)
    throw new Error(`${res.status} ${url.split('?')[0]} ${reason}`.trim())
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ── Ticketmaster (Discovery API; includes Live Nation) ───────────────────────
async function ticketmaster(a: Artist, key: string): Promise<EventRow[]> {
  const base = 'https://app.ticketmaster.com/discovery/v2'
  const found = await getJson(`${base}/attractions.json?apikey=${key}&keyword=${encodeURIComponent(a.artist_name)}&classificationName=music&size=10`)
  const attraction = (found?._embedded?.attractions ?? []).find((x: any) => norm(x.name) === norm(a.artist_name))
  if (!attraction) return []
  const data = await getJson(`${base}/events.json?apikey=${key}&attractionId=${attraction.id}&size=100&sort=date,asc`)
  return (data?._embedded?.events ?? []).map((e: any): EventRow => {
    const v = e._embedded?.venues?.[0] ?? {}
    const cc = v.country?.countryCode ?? ''
    return {
      event_key: `ticketmaster:${e.id}`,
      artist_id: a.artist_id, artist_name: a.artist_name,
      title: e.name ?? '', venue: v.name ?? '', city: v.city?.name ?? '',
      country_code: cc, country_name: v.country?.name ?? countryName(cc),
      lat: num(v.location?.latitude), lng: num(v.location?.longitude),
      event_date: e.dates?.start?.localDate ?? '', event_time: (e.dates?.start?.localTime ?? '').slice(0, 5),
      url: e.url ?? '', source: 'ticketmaster',
    }
  })
}

// ── Bandsintown (strong on smaller / underground artists) ───────────────────
async function bandsintown(a: Artist, appId: string): Promise<EventRow[]> {
  const data = await getJson(`https://rest.bandsintown.com/artists/${encodeURIComponent(a.artist_name)}/events?app_id=${encodeURIComponent(appId)}&date=upcoming`)
  if (!Array.isArray(data)) return []
  return data.map((e: any): EventRow => {
    const v = e.venue ?? {}
    const cc = countryCode(v.country ?? '')
    return {
      event_key: `bandsintown:${e.id}`,
      artist_id: a.artist_id, artist_name: a.artist_name,
      title: e.title || (e.lineup ?? []).join(', ') || a.artist_name,
      venue: v.name ?? '', city: v.city ?? '',
      country_code: cc, country_name: countryName(cc, v.country ?? ''),
      lat: num(v.latitude), lng: num(v.longitude),
      event_date: (e.datetime ?? '').slice(0, 10), event_time: (e.datetime ?? '').slice(11, 16),
      url: e.url ?? '', source: 'bandsintown',
    }
  })
}

// ── SeatGeek ─────────────────────────────────────────────────────────────────
async function seatgeek(a: Artist, clientId: string): Promise<EventRow[]> {
  const base = 'https://api.seatgeek.com/2'
  const found = await getJson(`${base}/performers?q=${encodeURIComponent(a.artist_name)}&client_id=${clientId}`)
  const performer = (found?.performers ?? []).find((x: any) => norm(x.name) === norm(a.artist_name))
  if (!performer) return []
  const data = await getJson(`${base}/events?performers.id=${performer.id}&per_page=100&client_id=${clientId}`)
  return (data?.events ?? []).map((e: any): EventRow => {
    const v = e.venue ?? {}
    const cc = countryCode(v.country ?? '')
    return {
      event_key: `seatgeek:${e.id}`,
      artist_id: a.artist_id, artist_name: a.artist_name,
      title: e.title ?? '', venue: v.name ?? '', city: v.city ?? '',
      country_code: cc, country_name: countryName(cc, v.country ?? ''),
      lat: num(v.location?.lat), lng: num(v.location?.lon),
      event_date: (e.datetime_local ?? '').slice(0, 10), event_time: (e.datetime_local ?? '').slice(11, 16),
      url: e.url ?? '', source: 'seatgeek',
    }
  })
}

// ── Skiddle (UK clubs / gigs). Keyword search, so keep only events naming the artist.
async function skiddle(a: Artist, key: string): Promise<EventRow[]> {
  const data = await getJson(`https://www.skiddle.com/api/v1/events/search/?api_key=${key}&keyword=${encodeURIComponent(a.artist_name)}&limit=100&order=date`)
  const name = norm(a.artist_name)
  return (data?.results ?? [])
    .filter((e: any) =>
      norm(e.eventname ?? '').includes(name) ||
      (e.artists ?? []).some((x: any) => norm(x.name ?? '') === name))
    .map((e: any): EventRow => {
      const v = e.venue ?? {}
      const cc = countryCode(v.country ?? '') || 'GB'
      return {
        event_key: `skiddle:${e.id}`,
        artist_id: a.artist_id, artist_name: a.artist_name,
        title: e.eventname ?? '', venue: v.name ?? '', city: v.town ?? '',
        country_code: cc, country_name: countryName(cc),
        lat: num(v.latitude), lng: num(v.longitude),
        event_date: (e.date ?? '').slice(0, 10), event_time: (e.openingtimes?.doorsopen ?? '').slice(0, 5),
        url: e.link ?? '', source: 'skiddle',
      }
    })
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
async function upsert(rows: EventRow[]) {
  if (!rows.length) return
  const res = await fetch(`${SB_URL}/rest/v1/artist_events?on_conflict=event_key`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`upsert failed: ${res.status} ${await res.text()}`)
}

async function refresh(a: Artist): Promise<Record<string, number | string>> {
  const sources: [string, string | undefined, (a: Artist, k: string) => Promise<EventRow[]>][] = [
    ['ticketmaster', Deno.env.get('TICKETMASTER_API_KEY'), ticketmaster],
    ['bandsintown', Deno.env.get('BANDSINTOWN_APP_ID'), bandsintown],
    ['seatgeek', Deno.env.get('SEATGEEK_CLIENT_ID'), seatgeek],
    ['skiddle', Deno.env.get('SKIDDLE_API_KEY'), skiddle],
  ]
  const counts: Record<string, number | string> = {}
  const rows: EventRow[] = []
  await Promise.all(sources.map(async ([name, rawKey, fn]) => {
    const key = rawKey?.trim()  // pasted secrets often pick up a trailing space or newline
    if (!key) { counts[name] = 'no key'; return }
    try {
      const found = (await fn(a, key)).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.event_date) && r.event_date >= today())
      rows.push(...found)
      counts[name] = found.length
    } catch (err) {
      console.error(`${name} failed for ${a.artist_name}:`, err)
      counts[name] = `error: ${(err as Error).message}`
    }
  }))
  await upsert(rows)
  return counts
}

// ── Batching: oldest-checked artists first, stopping well before the
// Edge Function time limit; the next scheduled run carries on from there.
const TIME_BUDGET_MS = 100_000
const CHECKED_COL = 'events_checked_at'

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
  const authorised = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')

  try {
    if (body.mode === 'all') {
      if (!authorised) return json({ error: 'unauthorised' }, 401)
      return json(await refreshDue())
    }

    if (body.mode === 'manual') {
      if (!authorised) return json({ error: 'unauthorised' }, 401)
      if (body.action === 'delete') {
        const key = String(body.eventKey ?? '')
        if (!key.startsWith('manual:')) return json({ error: 'only manual events can be deleted' }, 400)
        await fetch(`${SB_URL}/rest/v1/artist_events?event_key=eq.${encodeURIComponent(key)}`, { method: 'DELETE', headers: sbHeaders })
        return json({ deleted: key })
      }
      const e = body.event ?? {}
      if (!/^[A-Za-z0-9]{22}$/.test(e.artist_id ?? '') || !e.artist_name || !/^\d{4}-\d{2}-\d{2}$/.test(e.event_date ?? '')) {
        return json({ error: 'artist and date are required' }, 400)
      }
      const cc = countryCode(String(e.country_code ?? ''))
      const row: EventRow = {
        event_key: `manual:${crypto.randomUUID()}`,
        artist_id: e.artist_id, artist_name: String(e.artist_name).slice(0, 200),
        title: String(e.title ?? '').slice(0, 300), venue: String(e.venue ?? '').slice(0, 200),
        city: String(e.city ?? '').slice(0, 120), country_code: cc, country_name: countryName(cc),
        lat: num(e.lat), lng: num(e.lng),
        event_date: e.event_date, event_time: String(e.event_time ?? '').slice(0, 5),
        url: String(e.url ?? '').slice(0, 500), source: 'manual',
      }
      await upsert([row])
      return json({ added: row.event_key })
    }

    const artistId = String(body.artistId ?? '')
    const artistName = String(body.artistName ?? '').slice(0, 200)
    if (!/^[A-Za-z0-9]{22}$/.test(artistId) || !artistName) return json({ error: 'artistId and artistName required' }, 400)
    const counts = await refresh({ artist_id: artistId, artist_name: artistName })
    await markChecked(artistId)
    return json(counts)
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
