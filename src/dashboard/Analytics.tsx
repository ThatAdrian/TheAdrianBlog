import React, { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

async function sb(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' }
  })
}

interface PostStats {
  slug: string
  title: string
  views: number
  likes: number
  comments: number
  avgRating: number | null
}

type SortKey = 'views' | 'likes' | 'comments' | 'avgRating'

export default function Analytics() {
  const [stats, setStats] = useState<PostStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('views')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const postsRes = await fetch('/posts.json')
        const posts: { slug: string; title: string }[] = await postsRes.json()

        const allStats = await Promise.all(posts.map(async post => {
          const enc = encodeURIComponent(post.slug)
          const [vRes, lRes, cRes, rRes] = await Promise.all([
            sb(`views?post_slug=eq.${enc}&select=count`),
            sb(`likes?post_slug=eq.${enc}&select=id`),
            sb(`comments?post_slug=eq.${enc}&parent_id=is.null&select=id`),
            sb(`comments?post_slug=eq.${enc}&user_rating=not.is.null&select=user_rating`),
          ])

          const views   = parseInt(vRes.headers.get('content-range')?.split('/')[1] ?? '0')
          const likes   = parseInt(lRes.headers.get('content-range')?.split('/')[1] ?? '0')
          const comments = parseInt(cRes.headers.get('content-range')?.split('/')[1] ?? '0')

          let avgRating: number | null = null
          if (rRes.ok) {
            const rData: { user_rating: number }[] = await rRes.json()
            if (rData.length > 0) avgRating = rData.reduce((s, r) => s + r.user_rating, 0) / rData.length
          }

          return { slug: post.slug, title: post.title, views, likes, comments, avgRating }
        }))

        setStats(allStats)
      } catch (err) {
        console.error('Analytics error:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...stats].sort((a, b) => ((b[sort] ?? 0) as number) - ((a[sort] ?? 0) as number))
  const totalViews    = stats.reduce((s, p) => s + p.views, 0)
  const totalLikes    = stats.reduce((s, p) => s + p.likes, 0)
  const totalComments = stats.reduce((s, p) => s + p.comments, 0)

  return (
    <div className="db-section">
      <h2 className="db-section-title">Analytics</h2>

      <div className="db-stats-row">
        <div className="db-stat-card">
          <span className="db-stat-value">{totalViews.toLocaleString()}</span>
          <span className="db-stat-label">Total Views</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">{totalLikes.toLocaleString()}</span>
          <span className="db-stat-label">Total Likes</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">{totalComments.toLocaleString()}</span>
          <span className="db-stat-label">Total Comments</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">{stats.length}</span>
          <span className="db-stat-label">Posts</span>
        </div>
      </div>

      <div className="db-card">
        <div className="db-table-header">
          <label className="db-label">Sort by:</label>
          <div className="db-sort-btns">
            {(['views','likes','comments','avgRating'] as SortKey[]).map(k => (
              <button key={k} className={`db-btn db-btn--sm ${sort === k ? 'db-btn--active' : ''}`} onClick={() => setSort(k)}>
                {k === 'avgRating' ? 'Rating' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="db-hint" style={{marginTop:'0.75rem'}}>Loading...</p> : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(post => (
                  <tr key={post.slug}>
                    <td className="db-table-title">
                      <a href={`/posts/${post.slug}`} target="_blank" rel="noopener noreferrer">{post.title}</a>
                    </td>
                    <td>{post.views.toLocaleString()}</td>
                    <td>{post.likes}</td>
                    <td>{post.comments}</td>
                    <td>{post.avgRating !== null ? post.avgRating.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
