import React, { useState, useEffect } from 'react'

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

async function sb(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PostStats {
  slug: string
  title: string
  likes: number
  comments: number
  avgRating: number | null
}

type SortKey = 'likes' | 'comments' | 'avgRating'
export default function Analytics() {
  const [postStats, setPostStats]       = useState<PostStats[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [sort, setSort]                 = useState<SortKey>('likes')

  // Load Supabase post stats
  useEffect(() => {
    async function load() {
      setPostsLoading(true)
      try {
        const postsRes = await fetch('/posts.json')
        const posts: { slug: string; title: string }[] = await postsRes.json()

        const all = await Promise.all(posts.map(async post => {
          const enc = encodeURIComponent(post.slug)
          const [lRes, cRes, rRes] = await Promise.all([
            sb(`likes?post_slug=eq.${enc}&select=id`),
            sb(`comments?post_slug=eq.${enc}&parent_id=is.null&select=id`),
            sb(`comments?post_slug=eq.${enc}&user_rating=not.is.null&select=user_rating`),
          ])
          const likes    = parseInt(lRes.headers.get('content-range')?.split('/')[1] ?? '0')
          const comments = parseInt(cRes.headers.get('content-range')?.split('/')[1] ?? '0')
          let avgRating: number | null = null
          if (rRes.ok) {
            const rData: { user_rating: number }[] = await rRes.json()
            if (rData.length > 0) avgRating = rData.reduce((s, r) => s + r.user_rating, 0) / rData.length
          }
          return { slug: post.slug, title: post.title, likes, comments, avgRating }
        }))
        setPostStats(all)
      } catch (err) { console.error('Supabase stats error:', err) }
      setPostsLoading(false)
    }
    load()
  }, [])

  const sorted = [...postStats].sort((a, b) => ((b[sort] ?? 0) as number) - ((a[sort] ?? 0) as number))
  const totalLikes    = postStats.reduce((s, p) => s + p.likes, 0)
  const totalComments = postStats.reduce((s, p) => s + p.comments, 0)

  return (
    <div className="db-section">
      <h2 className="db-section-title">Analytics</h2>

{/* ── Umami embedded dashboard ── */}
      <div className="db-card" style={{ padding: 0, overflow: 'hidden' }}>
        <iframe
          src="https://cloud.umami.is/share/0LgVa2ryLTy0v2DU"
          style={{ width: '100%', height: '600px', border: 'none', display: 'block', borderRadius: '12px' }}
          title="Umami Analytics"
        />
      </div>

      {/* ── Summary stats ── */}
      <div className="db-stats-row">
        <div className="db-stat-card">
          <span className="db-stat-value">{totalLikes.toLocaleString()}</span>
          <span className="db-stat-label">Total Likes</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">{totalComments.toLocaleString()}</span>
          <span className="db-stat-label">Total Comments</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">{postStats.length}</span>
          <span className="db-stat-label">Posts</span>
        </div>
        <div className="db-stat-card">
          <span className="db-stat-value">
            {postStats.filter(p => p.avgRating !== null).length > 0
              ? (postStats.filter(p => p.avgRating !== null).reduce((s, p) => s + (p.avgRating ?? 0), 0) / postStats.filter(p => p.avgRating !== null).length).toFixed(1)
              : '—'}
          </span>
          <span className="db-stat-label">Avg Rating</span>
        </div>
      </div>

      {/* ── Per-post engagement ── */}
      <div className="db-card">
        <div className="db-table-header">
          <label className="db-label">Post Engagement</label>
          <div className="db-sort-btns">
            {(['likes','comments','avgRating'] as SortKey[]).map(k => (
              <button key={k} className={`db-btn db-btn--sm ${sort === k ? 'db-btn--active' : ''}`}
                onClick={() => setSort(k)}>
                {k === 'avgRating' ? 'Rating' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {postsLoading ? <p className="db-hint" style={{marginTop:'0.75rem'}}>Loading...</p> : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(post => (
                  <tr key={post.slug}>
                    <td className="db-table-title">
                      <a href={`/posts/${post.slug}`} target="_blank" rel="noopener noreferrer">
                        {post.title}
                      </a>
                    </td>
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
