import React, { useState } from 'react'
import PostCard from '../components/PostCard'
import ASCIIText from '../components/ASCIIText'
import { usePosts } from '../hooks/usePosts'

const CATEGORIES = ['All', 'Tech', 'Music Reviews', 'General']

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
        {/* ASCII animated title */}
        <div className="hero-ascii-wrap">
          <ASCIIText
            text="TheAdrianBlog"
            enableWaves={true}
            asciiFontSize={8}
            textFontSize={200}
            textColor="#fdf9f3"
            planeBaseHeight={8}
          />
        </div>

        <span className="hero-eyebrow">✦ Welcome to the feed</span>
        <p className="hero-sub">
          Dispatches from the digital frontier — tech deep-dives, music reviews, and the occasional off-topic thought.
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
