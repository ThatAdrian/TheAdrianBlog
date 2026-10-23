import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import GlassSurface from '../components/GlassSurface'
import PostCard from '../components/PostCard'
import NowPlaying from '../components/NowPlaying'
import AlbumSuggestion from '../components/AlbumSuggestion'
import { usePosts } from '../hooks/usePosts'
import { useReviewIndex } from '../hooks/useReviewIndex'
import { ratingColor, fetchAllCommunityRatings } from '../lib/ratings'
import { getArtist, SearchArtist } from '../lib/spotify'
import { useTrackedArtists } from '../lib/trackedArtists'
import Dock, { DockItemData } from '../components/Dock'
import MusicSearch from '../components/music/MusicSearch'
import TrackedArtists from '../components/music/TrackedArtists'
import '../components/music/MusicHub.css'

const SPOTIFY_URL = 'https://open.spotify.com/user/realagamez123'

interface AlbumStat {
  slug: string
  title: string
  image: string
  adrianRating: number
  communityAvg: number
  communityCount: number
}

type FilterMode = 'adrian' | 'community'

// ── Music hub tabs ── add new tabs here (notifications, calendar, events...)
type TabId = 'overview' | 'search' | 'tracked'

const icon = (path: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
)

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Music',   icon: icon(<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 18V5l12-2v13" /></>) },
  { id: 'search',   label: 'Search',  icon: icon(<><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>) },
  { id: 'tracked',  label: 'Tracked', icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>) },
]

export default function Music() {
  const { posts } = usePosts()
  const [filter, setFilter] = useState<FilterMode>('adrian')
  const [communityData, setCommunityData] = useState<Record<string, { avg: number; count: number }>>({})
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') as TabId : 'overview'
  const [artist, setArtist] = useState<SearchArtist | null>(null)
  const index = useReviewIndex()
  const { artists: tracked } = useTrackedArtists()

  const setTab = useCallback((id: TabId) => {
    setParams(id === 'overview' ? {} : { tab: id }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setParams])

  // Opening an artist always lands on the Search tab's profile view
  const openArtist = useCallback((a: SearchArtist | null) => {
    setArtist(a)
    if (!a) return
    setTab('search')
    if (!a.genres.length) getArtist(a.id).then(full => { if (full) setArtist(cur => cur?.id === full.id ? full : cur) })
  }, [setTab])

  const dockItems: DockItemData[] = TABS.map(t => ({
    icon: t.icon,
    label: t.label,
    active: t.id === tab,
    badge: t.id === 'tracked' && tracked.length > 0 ? tracked.length : undefined,
    onClick: () => setTab(t.id),
  }))

  const musicReviews = posts.filter(p => p.categories.includes('Music Reviews'))

  useEffect(() => {
    fetchAllCommunityRatings().then(setCommunityData)
  }, [])

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

  const getRatingColor = ratingColor

  return (
    <div className="page-transition music-hub" style={{ paddingTop: '80px', minHeight: '100vh' }}>
      <SEO title="Music" description="Music reviews, ratings and recommendations from Adrian." url="/music" />

      <div className="section">

        {tab === 'search' && (
          <>
            <div className="section-title">Search</div>
            <MusicSearch index={index} artist={artist} onOpenArtist={openArtist} />
          </>
        )}

        {tab === 'tracked' && (
          <>
            <div className="section-title">Tracked Artists</div>
            <TrackedArtists index={index} onOpenArtist={openArtist} onFindArtists={() => setTab('search')} />
          </>
        )}

        {tab === 'overview' && <>

        {/* ── Spotify widget ── */}
        <GlassSurface width="100%" height={100} borderRadius={16} brightness={25} opacity={0.85} blur={12}
          style={{ marginBottom: '1.5rem' }}>
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

        {/* ── Now Playing / Recently Listened ── */}
        <NowPlaying />

        {/* ── Album Suggestion ── */}
        <AlbumSuggestion />

        {/* ── Top Albums stats ── */}
        <div className="music-stats-header" style={{ marginTop: '2.5rem' }}>
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
            <p>No rated reviews yet.</p>
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
                    {rating > 0 ? `${rating.toFixed(1)}/10` : '—'}
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
            {musicReviews.map(post => <PostCard key={post.slug} post={post} fromPath="/music" />)}
          </div>
        )}

        </>}

      </div>

      <div className="music-dock-host">
        <Dock items={dockItems} accentColor="#00f5ff" badgeColor="#b400ff" baseItemSize={46} magnification={64} panelHeight={62} />
      </div>
    </div>
  )
}
