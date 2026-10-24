// spotify-token — hands the site a short-lived Spotify app token so the
// client secret never ships in the browser bundle.
//
//   POST {} → { access_token, expires_in }
//
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET (shared with artist-releases)
// Deploy with JWT verification off.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

let cached: { token: string; expires: number } | null = null

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (cached && Date.now() < cached.expires) {
    return json({ access_token: cached.token, expires_in: Math.floor((cached.expires - Date.now()) / 1000) })
  }

  const id = (Deno.env.get('SPOTIFY_CLIENT_ID') ?? '').trim()
  const secret = (Deno.env.get('SPOTIFY_CLIENT_SECRET') ?? '').trim()
  if (!id || !secret) return json({ error: 'SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set' }, 500)

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return json({ error: `Spotify said ${res.status}: ${(await res.text()).slice(0, 200)}` }, 502)

  const data = await res.json()
  // keep a minute of slack so the browser never gets a token about to expire
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return json({ access_token: cached.token, expires_in: data.expires_in - 60 })
})
