import React from 'react'
import { Link } from 'react-router-dom'
import BorderGlow from './BorderGlow'
import LikeButton from './LikeButton'
import { useCommentCount } from '../hooks/useCommentCount'

interface Post {
  slug: string
  title: string
  summary: string
  date: string
  categories: string[]
  image: string
}

interface PostCardProps {
  post: Post
  fromPath?: string
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

export default function PostCard({ post, fromPath = '/' }: PostCardProps) {
  const primaryCat = post.categories[0] ?? 'General'
  const commentCount = useCommentCount(post.slug)

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
      <Link
        to={`/posts/${post.slug}`}
        state={{ from: fromPath }}
        className="post-card-inner"
      >
        <div className="post-card-thumbnail">
          <img
            src={`/${post.image}`}
            alt={post.title}
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
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
          <div className="post-card-meta">
            {commentCount > 0 && (
              <span className="post-card-comment-count">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {commentCount}
              </span>
            )}
            <LikeButton postSlug={post.slug} compact={true} />
          </div>
        </div>
      </Link>
    </BorderGlow>
  )
}
