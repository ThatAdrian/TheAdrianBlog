import React, { useState, useEffect } from 'react'

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

async function sb(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' }
  })
}

// ── Umami ─────────────────────────────────────────────────────────────────────
const UMAMI_BASE   = 'https://cloud.umami.is'
const UMAMI_KEY    = 'api_hkLv9zgAPC4HgdhdFriTto9a4cWjP9et'
const UMAMI_SITE   = '9f74e86c-18c2-4857-9b19-63a303455340'

async function umami(endpoint: string, params: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const url = `${UMAMI_BASE}/api/websites/${UMAMI_SITE}/${endpoint}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: { 'x-umami-api-key': UMAMI_KEY } })
  if (!res.ok) return null
  return res.json()
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PostStats {
  slug: string
  title: string
  likes: number
  comments: number
  avgRating: number | null
}

interface UmamiStats {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
}

interface TopPage {
  path: string
  views: number
}

interface TopReferrer {
  domain: string
  views: number
}

type SortKey = 'likes' | 'comments' | 'avgRating'
type TimeRange = '7d' | '30d' | '90d' | 'all'

function timeRangeMs(range: TimeRange): { startAt: number; endAt: number } {
  const endAt = Date.now()
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365 * 3
  return { startAt: endAt - days * 24 * 60 * 60 * 1000, endAt }
}

export default function Analytics() {
  const [postStats, setPostStats]       = useState<PostStats[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [sort, setSort]                 = useState<SortKey>('likes')

  const [umamiStats, setUmamiStats]     = useState<UmamiStats | null>(null)
  const [topPages, setTopPages]         = useState<TopPage[]>([])
  const [referrers, setReferrers]       = useState<TopReferrer[]>([])
  const [activeNow, setActiveNow]       = useState<number>(0)
  const [umamiLoading, setUmamiLoading] = useState(true)
  const [timeRange, setTimeRange]       = useState<TimeRange>('30d')

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

  // Load Umami stats
  useEffect(() => {
    async function loadUmami() {
      setUmamiLoading(true)
      const { startAt, endAt } = timeRangeMs(timeRange)
      try {
        const [stats, pages, refs, active] = await Promise.all([
          umami('stats', { startAt, endAt }),
          umami('metrics', { startAt, endAt, type: 'url', limit: 10 }),
          umami('metrics', { startAt, endAt, type: 'referrer', limit: 8 }),
          umami('active'),
        ])

        if (stats) setUmamiStats({
          pageviews: stats.pageviews?.value ?? 0,
          visitors:  stats.visitors?.value ?? 0,
          visits:    stats.visits?.value ?? 0,
          bounces:   stats.bounces?.value ?? 0,
        })

        if (pages) setTopPages(
          (pages as { x: string; y: number }[])
            .map(p => ({ path: p.x, views: p.y }))
            .filter(p => p.path !== '/')
            .slice(0, 10)
        )

        if (refs) setReferrers(
          (refs as { x: string; y: number }[])
            .filter(r => r.x)
            .map(r => ({ domain: r.x, views: r.y }))
        )

        if (active) setActiveNow(active.visitors ?? 0)
      } catch (err) { console.error('Umami error:', err) }
      setUmamiLoading(false)
    }
    loadUmami()
  }, [timeRange])

  const sorted = [...postStats].sort((a, b) => ((b[sort] ?? 0) as number) - ((a[sort] ?? 0) as number))
  const totalLikes    = postStats.reduce((s, p) => s + p.likes, 0)
  const totalComments = postStats.reduce((s, p) => s + p.comments, 0)

  const bounceRate = umamiStats && umamiStats.visits > 0
    ? Math.round((umamiStats.bounces / umamiStats.visits) * 100)
    : null

  return (
    <div className="db-section">
      <h2 className="db-section-title">Analytics</h2>

      {/* ── Umami: time range selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span className="db-label" style={{ marginBottom: 0 }}>Time range:</span>
        {(['7d','30d','90d','all'] as TimeRange[]).map(r => (
          <button key={r} className={`db-btn db-btn--sm ${timeRange === r ? 'db-btn--active' : ''}`}
            onClick={() => setTimeRange(r)}>
            {r === 'all' ? 'All time' : `Last ${r}`}
          </button>
        ))}
        {activeNow > 0 && (
          <span className="db-active-badge">● {activeNow} online now</span>
        )}
      </div>

      {/* ── Umami: overview stats ── */}
      {umamiLoading ? (
        <p className="db-hint">Loading site analytics...</p>
      ) : umamiStats ? (
        <div className="db-stats-row db-stats-row--5">
          <div className="db-stat-card">
            <span className="db-stat-value">{umamiStats.pageviews.toLocaleString()}</span>
            <span className="db-stat-label">Page Views</span>
          </div>
          <div className="db-stat-card">
            <span className="db-stat-value">{umamiStats.visitors.toLocaleString()}</span>
            <span className="db-stat-label">Unique Visitors</span>
          </div>
          <div className="db-stat-card">
            <span className="db-stat-value">{umamiStats.visits.toLocaleString()}</span>
            <span className="db-stat-label">Sessions</span>
          </div>
          <div className="db-stat-card">
            <span className="db-stat-value">{bounceRate !== null ? `${bounceRate}%` : '—'}</span>
            <span className="db-stat-label">Bounce Rate</span>
          </div>
          <div className="db-stat-card">
            <span className="db-stat-value">{totalLikes.toLocaleString()}</span>
            <span className="db-stat-label">Total Likes</span>
          </div>
        </div>
      ) : (
        <p className="db-hint" style={{ color: '#ff4466' }}>Could not load Umami data.</p>
      )}

      {/* ── Top pages + referrers ── */}
      <div className="db-two-col">
        <div className="db-card">
          <label className="db-label">Top Pages</label>
          {topPages.length === 0 ? (
            <p className="db-hint">No data yet.</p>
          ) : (
            <div className="db-bar-list">
              {topPages.map((p, i) => {
                const max = topPages[0]?.views ?? 1
                return (
                  <div key={i} className="db-bar-row">
                    <span className="db-bar-label" title={p.path}>{p.path}</span>
                    <div className="db-bar-track">
                      <div className="db-bar-fill" style={{ width: `${(p.views / max) * 100}%` }}/>
                    </div>
                    <span className="db-bar-val">{p.views}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="db-card">
          <label className="db-label">Top Referrers</label>
          {referrers.length === 0 ? (
            <p className="db-hint">No referrers yet.</p>
          ) : (
            <div className="db-bar-list">
              {referrers.map((r, i) => {
                const max = referrers[0]?.views ?? 1
                return (
                  <div key={i} className="db-bar-row">
                    <span className="db-bar-label">{r.domain || 'Direct'}</span>
                    <div className="db-bar-track">
                      <div className="db-bar-fill db-bar-fill--purple" style={{ width: `${(r.views / max) * 100}%` }}/>
                    </div>
                    <span className="db-bar-val">{r.views}</span>
                  </div>
                )
              })}
            </div>
          )}
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
