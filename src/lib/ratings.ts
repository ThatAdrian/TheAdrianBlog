// ── Rating → color (1–10 scale, same scale as components/StarRating.tsx) ─────
export function ratingColor(r: number): string {
  if (r >= 10)  return '#ffffff'
  if (r >= 9)   return '#dd00ff'
  if (r >= 8)   return '#0088ff'
  if (r >= 7)   return '#00bbaa'
  if (r >= 6)   return '#00cc44'
  if (r >= 5)   return '#aadd00'
  if (r >= 4)   return '#ffd000'
  if (r >= 3)   return '#ff8c00'
  if (r >= 2)   return '#ff6600'
  return '#e63333'
}

export function formatRating(r: number): string {
  return r % 1 === 0 ? r.toString() : r.toFixed(1)
}

export function average(values: number[]): number | null {
  const valid = values.filter(v => v > 0)
  if (!valid.length) return null
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

// ── Community ratings (ratings table: album_id = post slug, rating 1–10) ─────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

export async function fetchAllCommunityRatings(): Promise<Record<string, { avg: number; count: number }>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ratings?select=album_id,rating`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    if (!res.ok) return {}
    const rows: { album_id: string; rating: number }[] = await res.json()
    const grouped: Record<string, { total: number; count: number }> = {}
    rows.forEach(r => {
      if (!grouped[r.album_id]) grouped[r.album_id] = { total: 0, count: 0 }
      grouped[r.album_id].total += Number(r.rating)
      grouped[r.album_id].count++
    })
    return Object.fromEntries(
      Object.entries(grouped).map(([id, { total, count }]) => [
        id, { avg: Math.round((total / count) * 2) / 2, count }
      ])
    )
  } catch { return {} }
}
