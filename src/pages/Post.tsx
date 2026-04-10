import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { marked } from 'marked'
import { usePosts } from '../hooks/usePosts'
import { AlbumRating, TrackRating } from '../components/StarRating'
import SEO from '../components/SEO'
import ShareButton from '../components/ShareButton'
import RelatedPosts from '../components/RelatedPosts'
import InlineComments, { TrackCommentTrigger } from '../components/InlineComments'
import LikeButton from '../components/LikeButton'
import TrackPlayer from '../components/TrackPlayer'
import { getAlbum, getAlbumPreviews, parseSpotifyAlbumId } from '../lib/spotify'

function getCatClass(cat: string) {
  const c = cat.toLowerCase()
  if (c === 'tech') return 'cat-tech'
  if (c.includes('music')) return 'cat-music'
  return 'cat-general'
}

function parseTracklist(raw: string): { id: string; name: string; rating: number }[] {
  if (!raw) return []
  return raw.split('|').map((entry, i) => {
    const parts = entry.trim().split('~')
    const name = parts[0]?.trim() ?? ''
    const rating = parseFloat(parts[1]?.trim() ?? '0')
    return { id: `track-${i}`, name, rating }
  })
}

const trackHeadingStyle: React.CSSProperties = {
  fontFamily: 'Orbitron, monospace',
  fontSize: '1.1rem',
  color: 'var(--accent-cyan)',
  margin: '2.5rem 0 1rem',
  letterSpacing: '0.05em',
}

export default function Post() {
  const { slug } = useParams()
  const { posts, loading } = usePosts()
  const navigate = useNavigate()
  const location = useLocation()
  const [previewMap, setPreviewMap] = useState<Map<string, string>>(new Map())

  const referrer = (location.state as any)?.from ?? '/'
  const post = posts.find(p => p.slug === slug)

  useEffect(() => {
    if (!loading && !post) navigate('/')
  }, [loading, post, navigate])

  // Fetch Deezer previews via Spotify album metadata
  useEffect(() => {
    if (loading || !post) return
    const albumField = (post as any)?.spotifyAlbum
    if (!albumField) return
    const albumId = parseSpotifyAlbumId(albumField)
    getAlbum(albumId).then(async album => {
      if (!album) return
      const artistName = album.artists[0]?.name ?? ''
      const map = await getAlbumPreviews(album.tracks.items, artistName)
      setPreviewMap(map)
    })
  }, [loading, post?.slug])

  if (loading) return (
    <div className="post-detail">
      <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
    </div>
  )
  if (!post) return null

  const isMusicReview = post.categories.includes('Music Reviews')
  const html = marked(post.content || '') as string
  const tracks = parseTracklist((post as any).tracklist ?? '')
  const artistRating = parseFloat((post as any).rating ?? '0')
  const postSlug = slug ?? post.slug

  const postImage = post.image && post.image !== 'placeholder.png'
    ? post.image.startsWith('http') ? post.image : `/${post.image}`
    : undefined

  // Match track name to Spotify preview — fuzzy match by lowercase includes
  function getPreview(trackName: string): string | null {
    const key = trackName.toLowerCase()
    if (previewMap.has(key)) return previewMap.get(key)!
    // Fuzzy: find any key that contains the track name or vice versa
    for (const [k, v] of previewMap) {
      if (k.includes(key) || key.includes(k)) return v
    }
    return null
  }

  const TrackListBlock = () => (
    <>
      <h2 style={trackHeadingStyle}>Track Ratings</h2>
      <div className="track-list">
        {tracks.map((t, i) => {
          const preview = getPreview(t.name)
          return (
            <div key={t.id} className="track-rating-row">
              {preview && (
                <TrackPlayer previewUrl={preview} trackName={t.name} rating={t.rating} />
              )}
              <TrackRating
                trackId={`${postSlug}-${i}`}
                trackName={t.name}
                artistRating={t.rating}
              />
              <TrackCommentTrigger trackName={t.name} postSlug={postSlug} />
            </div>
          )
        })}
      </div>
    </>
  )

  const renderContent = () => {
    if (!isMusicReview || tracks.length === 0) {
      return <div className="prose-custom" dangerouslySetInnerHTML={{ __html: html }} />
    }
    const marker = '<p>[TRACK_RATINGS]</p>'
    const splitIdx = html.indexOf(marker)
    if (splitIdx === -1) {
      return (
        <>
          <div className="prose-custom" dangerouslySetInnerHTML={{ __html: html }} />
          <TrackListBlock />
        </>
      )
    }
    const before = html.slice(0, splitIdx)
    const after = html.slice(splitIdx + marker.length)
    return (
      <>
        <div className="prose-custom" dangerouslySetInnerHTML={{ __html: before }} />
        <TrackListBlock />
        <div className="prose-custom" dangerouslySetInnerHTML={{ __html: after }} />
      </>
    )
  }

  return (
    <div className="post-detail page-transition">
      <SEO
        title={post.title}
        description={post.summary}
        image={postImage}
        url={`/posts/${postSlug}`}
        type="article"
      />

      <Link to={referrer} className="back-link">← Back</Link>

      <div className="post-detail-header">
        <div className="post-detail-categories">
          {post.categories.map(cat => (
            <span key={cat} className={`post-card-category ${getCatClass(cat)}`} style={{ position: 'static' }}>
              {cat}
            </span>
          ))}
        </div>
        <h1 className="post-detail-title">{post.title}</h1>
        <div className="post-detail-meta-row">
          <p className="post-detail-meta">{post.date}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LikeButton postSlug={postSlug} compact={false} />
            <ShareButton title={post.title} />
          </div>
        </div>
      </div>

      {isMusicReview && artistRating > 0 && (
        <AlbumRating
          albumId={postSlug}
          albumName={post.title}
          artistRating={artistRating}
          showCommunity={true}
        />
      )}

      {post.summary && <p className="post-detail-summary">{post.summary}</p>}

      {post.image && post.image !== 'placeholder.png' && (
        <img
          src={`/${post.image}`}
          alt={post.title}
          className="post-detail-image"
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div className="post-content-with-comments">
        {renderContent()}
        <InlineComments postSlug={postSlug} />
      </div>

      <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <RelatedPosts
          currentSlug={postSlug}
          currentCategories={post.categories}
          allPosts={posts}
        />
      </div>
    </div>
  )
}
