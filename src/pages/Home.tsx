import React, { lazy, Suspense, useState } from 'react'
import PostCard from '../components/PostCard'
import SEO from '../components/SEO'
import { usePosts } from '../hooks/usePosts'

// Lazy load ASCIIText — pulls in Three.js only when the home page renders
const ASCIIText = lazy(() => import('../components/ASCIIText'))

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

  const filtered = posts.filter(p => {
    const matchesCat = active === 'All' || p.categories.includes(active)
    const matchesSearch = search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.summary.toLowerCase().includes(search.toLowerCase()) ||
      p.categories.some(c => c.toLowerCase().includes(search.toLowerCase()))
    return matchesCat && matchesSearch
  })

  return (
    <div className="page-transition">
      <SEO />

      <div className="hero">
        <div className="hero-ascii-wrap">
          <Suspense fallback={<div style={{ height: '100%' }} />}>
            <ASCIIText
              text="TheAdrianBlog"
              enableWaves={true}
              asciiFontSize={5}
              textFontSize={220}
              textColor="#fdf9f3"
              planeBaseHeight={10}
            />
          </Suspense>
        </div>

        <span className="hero-eyebrow">✦ Welcome to the feed</span>
        <p className="hero-sub">
          Dispatches from the digital frontier — tech deep-dives, music reviews, and the occasional off-topic thought.
        </p>
        <div className="hero-divider" />
      </div>

      <div className="section">
        {/* Search */}
        <div className="home-search-wrap">
          <input
            className="home-search"
            type="text"
            placeholder="Search posts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

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
          <div className="no-posts"><p>No posts found.</p></div>
        ) : (
          <div className="posts-grid">
            {filtered.map(post => <PostCard key={post.slug} post={post} fromPath="/" />)}
          </div>
        )}
      </div>
    </div>
  )
}
