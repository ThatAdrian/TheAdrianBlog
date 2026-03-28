import React, { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { marked } from 'marked'
import { usePosts } from '../hooks/usePosts'
import { AlbumRating, TrackRating } from '../components/StarRating'

function getCatClass(cat: string) {
  const c = cat.toLowerCase()
  if (c === 'tech') return 'cat-tech'
  if (c.includes('music')) return 'cat-music'
  return 'cat-general'
}

function parseTracklist(raw: string): { id: string; name: string; rating: number }[] {
  if (!raw) return []
  return raw.split('|').map((entry, i) => {
    const parts = entry.trim().split(',')
    const name = parts[0]?.trim() ?? ''
    const rating = parseFloat(parts[1]?.trim() ?? '0')
    return { id: `track-${i}`, name, rating }
  })
}

export default function Post() {
  const { slug } = useParams()
  const { posts, loading } = usePosts()
  const navigate = useNavigate()

  const post = posts.find(p => p.slug === slug)

  useEffect(() => {
    if (!loading && !post) navigate('/')
  }, [loading, post, navigate])

  if (loading) return <div className="post-detail"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>
  if (!post) return null

  const isMusicReview = post.categories.includes('Music Reviews')
  const html = marked(post.content || '')
  const tracks = parseTracklist((post as any).tracklist ?? '')
  const artistRating = parseFloat((post as any).rating ?? '0')

  return (
    <div className="post-detail page-transition">
      <Link to="/" className="back-link">← Back to feed</Link>

      <div className="post-detail-header">
        <div className="post-detail-categories">
          {post.categories.map(cat => (
            <span
              key={cat}
              className={`post-card-category ${getCatClass(cat)}`}
              style={{ position: 'static' }}
            >
              {cat}
            </span>
          ))}
        </div>
        <h1 className="post-detail-title">{post.title}</h1>
        <p className="post-detail-meta">{post.date}</p>
      </div>

      {/* Album rating block — only on Music Reviews with a rating field */}
      {isMusicReview && artistRating > 0 && (
        <AlbumRating
          albumId={slug ?? post.slug}
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
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div
        className="prose-custom"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Track list — only renders if tracklist field is present */}
      {isMusicReview && tracks.length > 0 && (
        <>
          <h2 style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: '1.1rem',
            color: 'var(--accent-cyan)',
            margin: '2.5rem 0 1rem',
            letterSpacing: '0.05em',
          }}>
            Track Ratings
          </h2>
          <div className="track-list">
            {tracks.map((t, i) => (
              <TrackRating
                key={t.id}
                trackId={`${slug}-${i}`}
                trackName={t.name}
                artistRating={t.rating}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
