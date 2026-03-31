import React from 'react'
import { Link } from 'react-router-dom'
import BorderGlow from './BorderGlow'

interface Post {
  slug: string
  title: string
  summary: string
  date: string
  categories: string[]
  image: string
}

function getCatClass(cat: string) {
  const c = cat.toLowerCase()
  if (c === 'tech') return 'cat-tech'
  if (c.includes('music')) return 'cat-music'
  return 'cat-general'
}

function getCatGlowColor(cat: string): string {
  const c = cat.toLowerCase()
  if (c === 'tech') return '210 100 70'
  if (c.includes('music')) return '280 100 70'
  return '150 100 70'
}

function getCatColors(cat: string): string[] {
  const c = cat.toLowerCase()
  if (c === 'tech') return ['#0080ff', '#00f5ff', '#0040aa']
  if (c.includes('music')) return ['#b400ff', '#ff006e', '#6600cc']
  return ['#00ff88', '#00f5ff', '#00aa44']
}

export default function PostCard({ post }: { post: Post }) {
  const primaryCat = post.categories[0] ?? 'General'

  return (
    <BorderGlow
      backgroundColor="#03020f"
      borderRadius={16}
      glowColor={getCatGlowColor(primaryCat)}
      colors={getCatColors(primaryCat)}
      glowIntensity={0.8}
      edgeSensitivity={25}
      fillOpacity={0.3}
    >
      <Link to={`/posts/${post.slug}`} className="post-card-inner">
        <div className="post-card-thumbnail">
          <img
            src={`/${post.image}`}
            alt={post.title}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
            />
          <div className="glossy-overlay" />
          <span className={`post-card-category ${getCatClass(primaryCat)}`}>{primaryCat}</span>
        </div>
        <div className="post-card-body">
          <h2 className="post-card-title">{post.title}</h2>
          <p className="post-card-date">{post.date}</p>
          <p className="post-card-summary">{post.summary}</p>
        </div>
        <div className="post-card-footer">
          <span className="read-more">Read Article <span>→</span></span>
          {post.categories.length > 1 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>
              +{post.categories.length - 1} more
            </span>
          )}
        </div>
      </Link>
    </BorderGlow>
  )
}
