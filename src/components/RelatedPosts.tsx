import React from 'react'
import { Link } from 'react-router-dom'

interface Post {
  slug: string
  title: string
  summary: string
  date: string
  categories: string[]
  image: string
}

interface RelatedPostsProps {
  currentSlug: string
  currentCategories: string[]
  allPosts: Post[]
}

function getCatClass(cat: string) {
  const c = cat.toLowerCase()
  if (c === 'tech') return 'cat-tech'
  if (c.includes('music')) return 'cat-music'
  return 'cat-general'
}

export default function RelatedPosts({ currentSlug, currentCategories, allPosts }: RelatedPostsProps) {
  // Find posts sharing a category, exclude current
  const related = allPosts
    .filter(p => p.slug !== currentSlug && p.categories.some(c => currentCategories.includes(c)))
    .slice(0, 3)

  if (related.length === 0) return null

  return (
    <div className="related-posts">
      <div className="section-title" style={{ marginBottom: '1.25rem' }}>Related posts</div>
      <div className="related-posts-grid">
        {related.map(post => {
          const cat = post.categories[0] ?? 'General'
          return (
            <Link key={post.slug} to={`/posts/${post.slug}`} className="related-post-card">
              <div className="related-post-thumb">
                <img
                  src={`/${post.image}`}
                  alt={post.title}
                  loading="lazy"
                  onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
                />
                <span className={`post-card-category ${getCatClass(cat)}`} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                  {cat}
                </span>
              </div>
              <div className="related-post-body">
                <h3 className="related-post-title">{post.title}</h3>
                <p className="related-post-date">{post.date}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
