import React from 'react'
import { useParams, Link } from 'react-router-dom'
import PostCard from '../components/PostCard'
import { usePosts } from '../hooks/usePosts'

export default function Category() {
  const { category } = useParams()
  const { posts, loading } = usePosts()

  const filtered = posts.filter(p => p.categories.includes(category || ''))

  return (
    <div className="page-transition" style={{ paddingTop: '100px' }}>
      <div className="section">
        <Link to="/" className="back-link" style={{ marginBottom: '2rem', display: 'inline-flex' }}>← Back to feed</Link>

        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff, var(--accent-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.5rem',
          }}>{category}</h1>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace', fontSize: '0.875rem' }}>
            {filtered.length} post{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="no-posts"><p>Loading...</p></div>
        ) : filtered.length === 0 ? (
          <div className="no-posts"><p>No posts in this category yet.</p></div>
        ) : (
          <div className="posts-grid">
            {filtered.map(post => <PostCard key={post.slug} post={post} />)}
          </div>
        )}
      </div>
    </div>
  )
}
