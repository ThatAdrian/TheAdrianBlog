import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePosts } from './usePosts'
import { parseSpotifyAlbumId, getAlbumMetaCached, SpotifyAlbumMeta } from '../lib/spotify'
import { fetchAllCommunityRatings, average } from '../lib/ratings'

// Lines up Spotify search results with Adrian's reviews (posts.json) and the
// community `ratings` table, so any artist / album / track can show both scores.

export interface ReviewEntry {
  slug: string
  title: string
  image: string
  albumId: string | null
  myRating: number | null
  audience: number | null
  audienceCount: number
  tracks: { name: string; rating: number }[]
  artistIds: string[]
}

export interface Scores {
  mine: number | null
  audience: number | null
  audienceCount: number
  slug: string | null
  reviewCount?: number
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\((with|feat\.?|ft\.?)[^)]*\)/g, '')
    .replace(/\s-\s.*(remaster|version|edit).*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Same format as Post.tsx: "name~rating | name~rating"
function parseTracklist(raw: string): { name: string; rating: number }[] {
  if (!raw) return []
  return raw.split('|').map(entry => {
    const parts = entry.trim().split('~')
    return { name: parts[0]?.trim() ?? '', rating: parseFloat(parts[1]?.trim() ?? '0') }
  }).filter(t => t.name)
}

export function useReviewIndex() {
  const { posts, loading: postsLoading } = usePosts()
  const [community, setCommunity] = useState<Record<string, { avg: number; count: number }>>({})
  const [albumMeta, setAlbumMeta] = useState<Record<string, SpotifyAlbumMeta>>({})
  const [metaLoading, setMetaLoading] = useState(true)

  useEffect(() => { fetchAllCommunityRatings().then(setCommunity) }, [])

  const reviews = useMemo(() => posts.filter(p => p.categories.includes('Music Reviews')), [posts])

  useEffect(() => {
    if (postsLoading) return
    const ids = reviews
      .map(p => (p as any).spotifyAlbum ? parseSpotifyAlbumId((p as any).spotifyAlbum) : null)
      .filter((id): id is string => !!id)
    getAlbumMetaCached(ids).then(meta => { setAlbumMeta(meta); setMetaLoading(false) })
  }, [reviews, postsLoading])

  const entries: ReviewEntry[] = useMemo(() => reviews.map(p => {
    const albumId = (p as any).spotifyAlbum ? parseSpotifyAlbumId((p as any).spotifyAlbum) : null
    const rating = parseFloat((p as any).rating ?? '')
    const c = community[p.slug]
    return {
      slug: p.slug,
      title: p.title,
      image: p.image,
      albumId,
      myRating: rating > 0 ? rating : null,
      audience: c?.count ? c.avg : null,
      audienceCount: c?.count ?? 0,
      tracks: parseTracklist((p as any).tracklist ?? ''),
      artistIds: albumId ? (albumMeta[albumId]?.artists ?? []).map(a => a.id) : [],
    }
  }), [reviews, community, albumMeta])

  const byAlbumId = useMemo(() => {
    const m = new Map<string, ReviewEntry>()
    entries.forEach(e => { if (e.albumId) m.set(e.albumId, e) })
    return m
  }, [entries])

  // Reviews without a spotifyAlbum link fall back to matching on the post title
  const findAlbumReview = useCallback((albumId: string, albumName: string, artistNames: string[]): ReviewEntry | null => {
    const direct = byAlbumId.get(albumId)
    if (direct) return direct
    const name = normalize(albumName)
    if (!name) return null
    return entries.find(e => {
      if (e.albumId) return false
      const t = normalize(e.title)
      return t.includes(name) && artistNames.some(a => t.includes(normalize(a)))
    }) ?? null
  }, [byAlbumId, entries])

  const albumScores = useCallback((albumId: string, albumName: string, artistNames: string[]): Scores => {
    const r = findAlbumReview(albumId, albumName, artistNames)
    return { mine: r?.myRating ?? null, audience: r?.audience ?? null, audienceCount: r?.audienceCount ?? 0, slug: r?.slug ?? null }
  }, [findAlbumReview])

  // Tracks only have Adrian's per-track ratings; there is no community track rating yet
  const trackScores = useCallback((trackName: string, albumId: string, albumName: string, artistNames: string[]): Scores => {
    const r = findAlbumReview(albumId, albumName, artistNames)
    if (!r) return { mine: null, audience: null, audienceCount: 0, slug: null }
    const key = normalize(trackName)
    const t = r.tracks.find(x => normalize(x.name) === key)
      ?? r.tracks.find(x => { const n = normalize(x.name); return n && (n.includes(key) || key.includes(n)) })
    return { mine: t && t.rating > 0 ? t.rating : null, audience: null, audienceCount: 0, slug: r.slug }
  }, [findAlbumReview])

  const artistReviews = useCallback((artistId: string, artistName: string): ReviewEntry[] => {
    const name = normalize(artistName)
    return entries.filter(e =>
      e.artistIds.includes(artistId) || (!e.albumId && name && normalize(e.title).includes(name))
    )
  }, [entries])

  // Artist score = average of their reviewed albums' scores
  const artistScores = useCallback((artistId: string, artistName: string): Scores => {
    const rs = artistReviews(artistId, artistName)
    return {
      mine: average(rs.map(r => r.myRating ?? 0)),
      audience: average(rs.map(r => r.audience ?? 0)),
      audienceCount: rs.reduce((s, r) => s + r.audienceCount, 0),
      slug: null,
      reviewCount: rs.length,
    }
  }, [artistReviews])

  return {
    loading: postsLoading || metaLoading,
    entries,
    albumScores,
    trackScores,
    artistScores,
    artistReviews,
  }
}

export type ReviewIndex = ReturnType<typeof useReviewIndex>
