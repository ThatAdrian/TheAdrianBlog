import React, { useState, useEffect } from 'react'
import SEO from '../components/SEO'
import GlassSurface from '../components/GlassSurface'
import PostCard from '../components/PostCard'
import { usePosts } from '../hooks/usePosts'

const SPOTIFY_URL = 'https://open.spotify.com/user/realagamez123'
const SPOTIFY_USER_ID = 'realagamez123'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

interface AlbumStat {
  slug: string
  title: string
  image: string
  adrianRating: number
  communityAvg: number
  communityCount: number
}

async function fetchAllCommunityRatings(): Promise<Record<string, { avg: number; count: number }>> {
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

type FilterMode = 'adrian' | 'community'

export default function Music() {
  const { posts } = usePosts()
  const [filter, setFilter] = useState<FilterMode>('adrian')
  const [communityData, setCommunityData] = useState<Record<string, { avg: number; count: number }>>({})

  const musicReviews = posts.filter(p => p.categories.includes('Music Reviews'))

  useEffect(() => {
    fetchAllCommunityRatings().then(setCommunityData)
  }, [])

  // Build album stats from posts that have a rating field
  const albumStats: AlbumStat[] = musicReviews
    .filter(p => (p as any).rating)
    .map(p => ({
      slug: p.slug,
      title: p.title,
      image: p.image,
      adrianRating: parseFloat((p as any).rating),
      communityAvg: communityData[p.slug]?.avg ?? 0,
      communityCount: communityData[p.slug]?.count ?? 0,
    }))

  const top5 = [...albumStats]
    .sort((a, b) => filter === 'adrian'
      ? b.adrianRating - a.adrianRating
      : b.communityAvg - a.communityAvg)
    .slice(0, 5)

  const getRatingColor = (r: number) => {
    if (r >= 5)   return '#ff00ff'
    if (r >= 4.5) return '#dd00ff'
    if (r >= 4)   return '#0088ff'
    if (r >= 3.5) return '#00bbaa'
    if (r >= 3)   return '#00cc44'
    if (r >= 2.5) return '#aadd00'
    if (r >= 2)   return '#ffd000'
    if (r >= 1.5) return '#ff8c00'
    if (r >= 1)   return '#ff6600'
    return '#e63333'
  }

  return (
    <div className="page-transition" style={{ paddingTop: '80px', minHeight: '100vh' }}>
      <SEO title="Music" description="Music reviews, ratings and recommendations from Adrian." url="/music" />

      <div className="section">

        {/* ── Spotify widget ── */}
        <GlassSurface width="100%" height={100} borderRadius={16} brightness={25} opacity={0.85} blur={12}
          style={{ marginBottom: '2.5rem' }}>
          <div className="spotify-widget">
            <div className="spotify-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
            <div className="spotify-info">
              <p className="spotify-label">Adrian on Spotify</p>
              <p className="spotify-handle">@realagamez123</p>
            </div>
            <a href={SPOTIFY_URL} target="_blank" rel="noopener noreferrer" className="spotify-btn">
              Open Profile
            </a>
          </div>
        </GlassSurface>

        {/* ── Top Albums stats ── */}
        <div className="music-stats-header">
          <div className="section-title" style={{ marginBottom: '1rem' }}>Top Albums</div>
          <div className="music-filter-tabs">
            <button
              className={`music-filter-btn ${filter === 'adrian' ? 'active' : ''}`}
              onClick={() => setFilter('adrian')}
            >Adrian's Favourites</button>
            <button
              className={`music-filter-btn ${filter === 'community' ? 'active' : ''}`}
              onClick={() => setFilter('community')}
            >Community Favourites</button>
          </div>
        </div>

        {top5.length === 0 ? (
          <div className="no-posts" style={{ marginBottom: '2rem' }}>
            <p>No rated reviews yet — publish some music reviews with a rating field to see stats here.</p>
          </div>
        ) : (
          <div className="top-albums-list">
            {top5.map((album, i) => {
              const rating = filter === 'adrian' ? album.adrianRating : album.communityAvg
              const color = getRatingColor(rating)
              return (
                <a key={album.slug} href={`/posts/${album.slug}`} className="top-album-row">
                  <span className="top-album-rank" style={{ color }}>{i + 1}</span>
                  <div className="top-album-img">
                    <img src={`/${album.image}`} alt={album.title}
                      onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png' }} />
                  </div>
                  <span className="top-album-title">{album.title}</span>
                  <span className="top-album-score" style={{ color }}>
                    {rating > 0 ? rating.toFixed(1) : '—'}
                    {filter === 'community' && album.communityCount > 0 && (
                      <span className="top-album-votes"> ({album.communityCount})</span>
                    )}
                  </span>
                </a>
              )
            })}
          </div>
        )}

        {/* ── Reviews grid ── */}
        <div className="section-title" style={{ marginTop: '3rem' }}>Music Reviews</div>

        {musicReviews.length === 0 ? (
          <div className="no-posts"><p>No music reviews yet.</p></div>
        ) : (
          <div className="posts-grid">
            {musicReviews.map(post => <PostCard key={post.slug} post={post} />)}
          </div>
        )}

      </div>
    </div>
  )
}
