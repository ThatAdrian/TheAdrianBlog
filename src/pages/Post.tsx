import React, { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { marked } from 'marked'
import { usePosts } from '../hooks/usePosts'

function getCatClass(cat: string) {
  const c = cat.toLowerCase()
  if (c === 'tech') return 'cat-tech'
  if (c.includes('music')) return 'cat-music'
  return 'cat-general'
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

  const html = marked(post.content || '')

  return (
    <div className="post-detail page-transition">
      <Link to="/" className="back-link">← Back to feed</Link>

      <div className="post-detail-header">
        <div className="post-detail-categories">
          {post.categories.map(cat => (
            <span key={cat} className={`post-card-category ${getCatClass(cat)}`} style={{ position: 'static' }}>{cat}</span>
          ))}
        </div>
        <h1 className="post-detail-title">{post.title}</h1>
        <p className="post-detail-meta">{post.date}</p>
      </div>

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
    </div>
  )
}
