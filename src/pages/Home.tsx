import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PostCard from '../components/PostCard'
import ASCIIText from '../components/ASCIIText'
import SEO from '../components/SEO'
import GlassSurface from '../components/GlassSurface'
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
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const filtered = posts
    .filter(p => active === 'All' || p.categories.includes(active))
    .filter(p => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.categories.some(c => c.toLowerCase().includes(q))
      )
    })

  return (
    <div className="page-transition">
      <SEO />

      <div className="hero">
        <div className="hero-ascii-wrap">
          <ASCIIText
            text="TheAdrianBlog"
            enableWaves={true}
            asciiFontSize={window.innerWidth < 768 ? 4 : 5}
            textFontSize={window.innerWidth < 768 ? 120 : 220}
            textColor="#fdf9f3"
            planeBaseHeight={window.innerWidth < 768 ? 6 : 10}
          />
        </div>
        <span className="hero-eyebrow">✦ Welcome to the feed</span>
        <p className="hero-sub">
          Dispatches from the digital frontier — tech deep-dives, music reviews, and the occasional off-topic thought.
        </p>
        <div className="hero-divider" />
      </div>

      <div className="section">

        {/* Search bar */}
        <div className="search-wrap">
          <GlassSurface
            width="100%"
            height={52}
            borderRadius={26}
            brightness={35}
            opacity={0.88}
            blur={12}
            distortionScale={-100}
          >
            <div className="search-inner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(200,200,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search posts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </GlassSurface>
        </div>

        {/* Category filters */}
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
          <div className="no-posts">
            <p>{search ? `No posts matching "${search}"` : 'No posts in this category yet.'}</p>
          </div>
        ) : (
          <div className="posts-grid">
            {filtered.map(post => (
              <PostCard key={post.slug} post={post} fromPath="/" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
