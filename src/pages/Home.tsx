import React, { useState } from 'react'
import PostCard from '../components/PostCard'
import { usePosts } from '../hooks/usePosts'

const CATEGORIES = ['All', 'General', 'Music Reviews', 'Tech']

function getActiveClass(cat: string) {
  if (cat === 'All') return 'active'
  if (cat === 'Tech') return 'active active-tech'
  if (cat === 'Music Reviews') return 'active active-music'
  return 'active active-general'
}

export default function Home() {
  const { posts, loading } = usePosts()
  const [active, setActive] = useState('All')

  const filtered = active === 'All' ? posts : posts.filter(p => p.categories.includes(active))

  return (
    <div className="page-transition">
      <div className="hero">
        <span className="hero-eyebrow">✦ Welcome to the feed</span>
        <h1 className="hero-title">TheAdrianBlog</h1>
        <p className="hero-sub">
          My personal corner to ramble about topics that scratch my brain.
        </p>
        <div className="hero-divider" />
      </div>

      <div className="section">
        <div className="category-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-btn ${active === cat ? getActiveClass(cat) : ''}`}
              onClick={() => setActive(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="no-posts"><p>Loading posts...</p></div>
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
