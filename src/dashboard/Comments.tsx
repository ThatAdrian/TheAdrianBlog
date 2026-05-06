import React, { useState, useEffect } from 'react'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

interface Comment {
  id: string
  post_slug: string
  display_name: string
  content: string
  selected_text: string | null
  parent_id: string | null
  created_at: string
  user_rating: number | null
}

interface PostGroup {
  slug: string
  comments: Comment[]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Comments() {
  const [groups, setGroups]       = useState<PostGroup[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<'all' | 'inline' | 'track'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?select=*&order=created_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) { setLoading(false); return }
    const data: Comment[] = await res.json()

    // Group by post slug
    const map = new Map<string, Comment[]>()
    for (const c of data) {
      if (!map.has(c.post_slug)) map.set(c.post_slug, [])
      map.get(c.post_slug)!.push(c)
    }
    setGroups(Array.from(map.entries()).map(([slug, comments]) => ({ slug, comments })))
    setLoading(false)
  }

  async function deleteComment(id: string, slug: string) {
    setDeleting(id)
    // Also delete replies to this comment
    await fetch(`${SUPABASE_URL}/rest/v1/comments?parent_id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    setGroups(g => g.map(group => {
      if (group.slug !== slug) return group
      const remaining = group.comments.filter(c => c.id !== id && c.parent_id !== id)
      return { slug, comments: remaining }
    }).filter(g => g.comments.length > 0))
    setDeleting(null)
  }

  const filtered = groups
    .map(g => ({
      ...g,
      comments: g.comments.filter(c => {
        const matchSearch = !search ||
          c.content.toLowerCase().includes(search.toLowerCase()) ||
          c.display_name.toLowerCase().includes(search.toLowerCase()) ||
          g.slug.toLowerCase().includes(search.toLowerCase())
        const matchFilter =
          filter === 'all' ? true :
          filter === 'inline' ? !!c.selected_text :
          filter === 'track' ? !c.selected_text && !!c.parent_id === false :
          true
        return matchSearch && matchFilter
      })
    }))
    .filter(g => g.comments.length > 0)

  const totalCount = groups.reduce((s, g) => s + g.comments.length, 0)

  return (
    <div className="db-section">
      <h2 className="db-section-title">
        Comments
        {!loading && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'rgba(200,200,255,0.35)', fontFamily: "'Space Mono', monospace" }}>{totalCount} total</span>}
      </h2>

      {/* Controls */}
      <div className="db-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <input
          className="db-input"
          style={{ flex: 1, minWidth: '180px' }}
          placeholder="Search by content, name or post..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'inline', 'track'] as const).map(f => (
            <button key={f} className={`db-btn db-btn--sm ${filter === f ? 'db-btn--active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="db-btn db-btn--sm" onClick={load}>Refresh</button>
      </div>

      {loading ? (
        <p className="db-hint">Loading comments...</p>
      ) : filtered.length === 0 ? (
        <p className="db-hint">No comments found.</p>
      ) : (
        filtered.map(group => (
          <div key={group.slug} className="db-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Post header — clickable to expand */}
            <button
              className="comments-post-header"
              onClick={() => setExpanded(expanded === group.slug ? null : group.slug)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span className="comments-post-slug">{group.slug}</span>
                <span className="comments-post-count">{group.comments.length} comment{group.comments.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a
                  href={`/posts/${group.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="db-btn db-btn--sm"
                  onClick={e => e.stopPropagation()}
                >
                  View post ↗
                </a>
                <span style={{ color: 'rgba(200,200,255,0.3)', fontSize: '0.9rem' }}>
                  {expanded === group.slug ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {/* Comment list */}
            {expanded === group.slug && (
              <div className="comments-list">
                {group.comments.map((c, i) => (
                  <div key={c.id} className={`comment-row ${c.parent_id ? 'comment-row--reply' : ''}`}>
                    <div className="comment-row-main">
                      <div className="comment-meta">
                        <span className="comment-name">{c.display_name}</span>
                        {c.selected_text && <span className="comment-tag comment-tag--inline">inline</span>}
                        {c.parent_id && <span className="comment-tag comment-tag--reply">reply</span>}
                        {c.user_rating && <span className="comment-tag comment-tag--rating">★ {c.user_rating}</span>}
                        <span className="comment-time">{timeAgo(c.created_at)}</span>
                      </div>
                      {c.selected_text && (
                        <p className="comment-selected-text">"{c.selected_text}"</p>
                      )}
                      <p className="comment-content">{c.content}</p>
                    </div>
                    <button
                      className="db-btn db-btn--sm db-btn--danger"
                      onClick={() => deleteComment(c.id, group.slug)}
                      disabled={deleting === c.id}
                      style={{ flexShrink: 0 }}
                    >
                      {deleting === c.id ? '...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
