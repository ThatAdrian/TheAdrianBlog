import React, { useState, useEffect, useRef, useCallback } from 'react'
import './InlineComments.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  post_slug: string
  display_name: string
  content: string
  selected_text: string
  parent_id: string | null
  created_at: string
  user_rating: number | null
}

interface PendingComment {
  selectedText: string
  trackId?: string
  x: number
  y: number
}

// ── Supabase ───────────────────────────────────────────────────────────────────

async function fetchComments(slug: string): Promise<Comment[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/comments?post_slug=eq.${encodeURIComponent(slug)}&order=created_at.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  if (!res.ok) return []
  return res.json()
}

async function postComment(data: {
  post_slug: string
  display_name: string
  content: string
  selected_text: string
  parent_id: string | null
  user_rating: number | null
}): Promise<Comment | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] ?? null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitial(name: string) { return name.trim().charAt(0).toUpperCase() }

function getInitialColor(name: string) {
  const colors = ['#00f5ff', '#b400ff', '#00ff88', '#ff006e', '#0080ff', '#ffd000', '#ff6600']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getRatingColor(r: number) {
  if (r >= 5)   return '#ff00ff'
  if (r >= 4.5) return '#dd00ff'
  if (r >= 4)   return '#0088ff'
  if (r >= 3.5) return '#00bbaa'
  if (r >= 3)   return '#00cc44'
  if (r >= 2.5) return '#aadd00'
  if (r >= 2)   return '#ffd000'
  if (r >= 1.5) return '#ff8c00'
  if (r >= 1)   return '#ff6600'
  return '#e63333'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}

// ── Mini star picker ───────────────────────────────────────────────────────────

function MiniStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered > 0 ? hovered : value
  const color = value > 0 ? getRatingColor(value) : 'rgba(200,200,255,0.3)'

  return (
    <div className="mini-stars">
      <span className="mini-stars-label">Your rating:</span>
      <div className="mini-stars-row" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map(i => {
          const fill = active >= i ? 'full' : active >= i - 0.5 ? 'half' : 'empty'
          return (
            <span
              key={i}
              className="mini-star"
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setHovered(e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i)
              }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                onChange(e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <defs>
                  {fill === 'half' && (
                    <linearGradient id={`mh${i}`}>
                      <stop offset="50%" stopColor={getRatingColor(hovered > 0 ? hovered : value)} />
                      <stop offset="50%" stopColor="rgba(200,200,255,0.2)" />
                    </linearGradient>
                  )}
                </defs>
                <polygon
                  points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                  fill={
                    fill === 'empty' ? 'rgba(200,200,255,0.15)' :
                    fill === 'half' ? `url(#mh${i})` :
                    getRatingColor(hovered > 0 ? hovered : value)
                  }
                  stroke={fill === 'empty' ? 'rgba(200,200,255,0.15)' : getRatingColor(hovered > 0 ? hovered : value)}
                  strokeWidth="1"
                />
              </svg>
            </span>
          )
        })}
        {value > 0 && (
          <span className="mini-stars-value" style={{ color: getRatingColor(value) }}>
            {value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Comment form (shared) ──────────────────────────────────────────────────────

function CommentForm({
  selectedText,
  isTrack,
  onSubmit,
  onCancel,
}: {
  selectedText: string
  isTrack: boolean
  onSubmit: (name: string, content: string, rating: number | null) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!content.trim() || !name.trim()) return
    setSubmitting(true)
    localStorage.setItem('comment_name', name)
    await onSubmit(name, content, isTrack && rating > 0 ? rating : null)
    setSubmitting(false)
  }

  return (
    <div className="comment-form">
      <div className="comment-selected-text">
        {isTrack ? `Track: "${selectedText}"` : `"${selectedText.slice(0, 100)}${selectedText.length > 100 ? '...' : ''}"`}
      </div>
      {isTrack && <MiniStars value={rating} onChange={setRating} />}
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="comment-input comment-input--name"
        maxLength={30}
        autoFocus
      />
      <textarea
        placeholder={isTrack ? 'Comment on this track...' : 'Add a comment...'}
        value={content}
        onChange={e => setContent(e.target.value)}
        className="comment-input comment-input--text"
        rows={3}
        maxLength={1000}
      />
      <div className="comment-form-actions">
        <button className="comment-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="comment-submit"
          onClick={handleSubmit}
          disabled={!content.trim() || !name.trim() || submitting}
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  )
}

// ── Thread popup ───────────────────────────────────────────────────────────────

function ThreadPopup({
  comments,
  allComments,
  onReply,
  onClose,
}: {
  comments: Comment[]
  allComments: Comment[]
  onReply: (parentId: string, selectedText: string, isTrack: boolean) => void
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const comment = comments[idx]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!comment) return null
  const replies = allComments.filter(c => c.parent_id === comment.id)
  const isTrack = comment.selected_text.startsWith('__track__')
  const displayText = isTrack ? comment.selected_text.replace('__track__', '') : comment.selected_text

  return (
    <div ref={ref} className="comment-thread">
      {/* Navigation if multiple comments */}
      {comments.length > 1 && (
        <div className="comment-thread-nav">
          <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>‹</button>
          <span>{idx + 1} / {comments.length}</span>
          <button onClick={() => setIdx(i => Math.min(comments.length - 1, i + 1))} disabled={idx === comments.length - 1}>›</button>
        </div>
      )}

      <div className="comment-selected-text">
        {isTrack ? `Track: "${displayText}"` : `"${displayText.slice(0, 80)}${displayText.length > 80 ? '...' : ''}"`}
      </div>

      {/* Root comment */}
      <div className="comment-item">
        <span className="comment-avatar-sm" style={{ '--avatar-color': getInitialColor(comment.display_name) } as React.CSSProperties}>
          {getInitial(comment.display_name)}
        </span>
        <div className="comment-item-body">
          <div className="comment-item-header">
            <span className="comment-item-name">{comment.display_name}</span>
            {comment.user_rating && (
              <span className="comment-item-rating" style={{ color: getRatingColor(comment.user_rating) }}>
                ★ {comment.user_rating.toFixed(1)}
              </span>
            )}
            <span className="comment-item-time">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="comment-item-text">{comment.content}</p>
        </div>
      </div>

      {/* Replies */}
      {replies.map(reply => (
        <div key={reply.id} className="comment-item comment-item--reply">
          <span className="comment-avatar-sm" style={{ '--avatar-color': getInitialColor(reply.display_name) } as React.CSSProperties}>
            {getInitial(reply.display_name)}
          </span>
          <div className="comment-item-body">
            <div className="comment-item-header">
              <span className="comment-item-name">{reply.display_name}</span>
              {reply.user_rating && (
                <span className="comment-item-rating" style={{ color: getRatingColor(reply.user_rating) }}>
                  ★ {reply.user_rating.toFixed(1)}
                </span>
              )}
              <span className="comment-item-time">{timeAgo(reply.created_at)}</span>
            </div>
            <p className="comment-item-text">{reply.content}</p>
          </div>
        </div>
      ))}

      {/* Reply input */}
      {replyingTo === comment.id ? (
        <ReplyForm
          comment={comment}
          isTrack={isTrack}
          onSubmit={async (name, content, rating) => {
            localStorage.setItem('comment_name', name)
            await onReply(comment.id, comment.selected_text, isTrack)
            setReplyingTo(null)
          }}
          onCancel={() => setReplyingTo(null)}
        />
      ) : (
        <button className="comment-reply-btn" onClick={() => setReplyingTo(comment.id)}>
          Reply
        </button>
      )}
    </div>
  )
}

function ReplyForm({ comment, isTrack, onSubmit, onCancel }: {
  comment: Comment
  isTrack: boolean
  onSubmit: (name: string, content: string, rating: number | null) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!content.trim() || !name.trim()) return
    setSubmitting(true)
    localStorage.setItem('comment_name', name)

    await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        post_slug: comment.post_slug,
        display_name: name,
        content,
        selected_text: comment.selected_text,
        parent_id: comment.id,
        user_rating: isTrack && rating > 0 ? rating : null,
      }),
    })

    await onSubmit(name, content, rating)
    setSubmitting(false)
  }

  return (
    <div className="comment-reply-input">
      {isTrack && <MiniStars value={rating} onChange={setRating} />}
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="comment-input comment-input--name"
        maxLength={30}
        autoFocus
      />
      <textarea
        placeholder="Write a reply..."
        value={content}
        onChange={e => setContent(e.target.value)}
        className="comment-input comment-input--text"
        rows={2}
        maxLength={1000}
      />
      <div className="comment-form-actions">
        <button className="comment-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="comment-submit"
          onClick={handleSubmit}
          disabled={!content.trim() || !name.trim() || submitting}
        >
          {submitting ? 'Posting...' : 'Reply'}
        </button>
      </div>
    </div>
  )
}

// ── Comment stack badge ────────────────────────────────────────────────────────

function CommentStack({ comments, allComments, onReply, top }: {
  comments: Comment[]
  allComments: Comment[]
  onReply: () => void
  top: number
}) {
  const [open, setOpen] = useState(false)
  const first = comments[0]
  const color = getInitialColor(first.display_name)
  const multiple = comments.length > 1

  const handleReply = async (parentId: string, selectedText: string, isTrack: boolean) => {
    await onReply()
  }

  return (
    <div className="comment-stack" style={{ top }}>
      <button
        className={`comment-avatar ${multiple ? 'comment-avatar--stacked' : ''}`}
        style={{ '--avatar-color': color } as React.CSSProperties}
        onClick={() => setOpen(o => !o)}
        title={multiple ? `${comments.length} comments` : `${first.display_name}: ${first.content}`}
      >
        {multiple ? (
          <span className="comment-stack-count">{comments.length}</span>
        ) : (
          getInitial(first.display_name)
        )}
      </button>
      {multiple && (
        <button
          className="comment-avatar comment-avatar--behind"
          style={{ '--avatar-color': getInitialColor(comments[1].display_name) } as React.CSSProperties}
          onClick={() => setOpen(o => !o)}
        >
          {getInitial(comments[1].display_name)}
        </button>
      )}

      {open && (
        <ThreadPopup
          comments={comments}
          allComments={allComments}
          onReply={handleReply}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

interface InlineCommentsProps {
  postSlug: string
}

export default function InlineComments({ postSlug }: InlineCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [pending, setPending] = useState<PendingComment | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadComments = useCallback(async () => {
    const data = await fetchComments(postSlug)
    setComments(data)
  }, [postSlug])

  useEffect(() => { loadComments() }, [loadComments])

  // ── Selection detection (mouse) ──────────────────────────────────────────────
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if (popupRef.current?.contains(e.target as Node)) return
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const text = sel.toString().trim()
        if (!text) return

        const range = sel.getRangeAt(0)
        const container = document.querySelector('.post-content-with-comments')
        if (!container || !container.contains(range.commonAncestorContainer)) return

        const rect = range.getBoundingClientRect()
        const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

        setPending({
          selectedText: text,
          x: Math.max(0, rect.left - wrapRect.left),
          y: rect.bottom - wrapRect.top + window.scrollY - (wrapRef.current?.getBoundingClientRect().top ?? 0) + 8,
        })
      }, 30)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  // ── Long press detection (touch/mobile) ─────────────────────────────────────
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      longPressTimer.current = setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const text = sel.toString().trim()
        if (!text) return

        const range = sel.getRangeAt(0)
        const container = document.querySelector('.post-content-with-comments')
        if (!container || !container.contains(range.commonAncestorContainer)) return

        const rect = range.getBoundingClientRect()
        const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

        setPending({
          selectedText: text,
          x: Math.max(0, touch.clientX - wrapRect.left - 100),
          y: rect.bottom - wrapRect.top + 8,
        })
      }, 600)
    }

    function onTouchEnd() {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }

    // Also detect touchend selection for iOS
    function onTouchEndSelection() {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const text = sel.toString().trim()
        if (!text) return

        const range = sel.getRangeAt(0)
        const container = document.querySelector('.post-content-with-comments')
        if (!container || !container.contains(range.commonAncestorContainer)) return

        const rect = range.getBoundingClientRect()
        const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

        setPending({
          selectedText: text,
          x: Math.max(0, rect.left - wrapRect.left),
          y: rect.bottom - wrapRect.top + 8,
        })
      }, 100)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEndSelection, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEndSelection)
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  // ── Close popup on outside click ────────────────────────────────────────────
  useEffect(() => {
    if (!pending) return
    function onMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPending(null)
        window.getSelection()?.removeAllRanges()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [pending])

  async function handleSubmit(name: string, content: string, rating: number | null) {
    if (!pending) return
    await postComment({
      post_slug: postSlug,
      display_name: name,
      content,
      selected_text: pending.trackId ? `__track__${pending.selectedText}` : pending.selectedText,
      parent_id: null,
      user_rating: rating,
    })
    await loadComments()
    setPending(null)
    window.getSelection()?.removeAllRanges()
  }

  // ── Group root comments by selected_text for stacking ───────────────────────
  const rootComments = comments.filter(c => !c.parent_id)
  const grouped = new Map<string, Comment[]>()
  rootComments.forEach(c => {
    const key = c.selected_text
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(c)
  })

  // ── Compute vertical positions for comment stacks ───────────────────────────
  const [stackPositions, setStackPositions] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    const positions = new Map<string, number>()
    grouped.forEach((_, key) => {
      const isTrack = key.startsWith('__track__')
      const searchText = isTrack ? key.replace('__track__', '') : key

      if (isTrack) {
        // Find the track row element
        const trackEls = document.querySelectorAll('.track-rating')
        trackEls.forEach(el => {
          if (el.textContent?.includes(searchText)) {
            const rect = el.getBoundingClientRect()
            const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { top: 0 }
            positions.set(key, rect.top - wrapRect.top + rect.height / 2 - 16)
          }
        })
      } else {
        // Find the text in prose
        const prose = document.querySelector('.prose-custom')
        if (!prose) return
        const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          const idx = node.textContent?.indexOf(searchText.slice(0, 40))
          if (idx !== undefined && idx >= 0) {
            const range = document.createRange()
            range.setStart(node, idx)
            range.setEnd(node, Math.min(idx + searchText.length, node.textContent!.length))
            const rect = range.getBoundingClientRect()
            const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { top: 0 }
            positions.set(key, rect.top - wrapRect.top + rect.height / 2 - 16)
            break
          }
        }
      }
    })
    setStackPositions(positions)
  }, [comments])

  return (
    <div ref={wrapRef} className="inline-comments-wrap">

      {/* Comment popup */}
      {pending && (
        <div
          ref={popupRef}
          className="comment-popup"
          style={{
            position: 'absolute',
            left: Math.min(pending.x, window.innerWidth - 300),
            top: pending.y,
            zIndex: 300,
          }}
        >
          <CommentForm
            selectedText={pending.selectedText}
            isTrack={!!pending.trackId}
            onSubmit={handleSubmit}
            onCancel={() => {
              setPending(null)
              window.getSelection()?.removeAllRanges()
            }}
          />
        </div>
      )}

      {/* Comment stacks in right margin */}
      <div className="comment-margin">
        {Array.from(grouped.entries()).map(([key, cmts]) => (
          <CommentStack
            key={key}
            comments={cmts}
            allComments={comments}
            onReply={loadComments}
            top={stackPositions.get(key) ?? 0}
          />
        ))}
      </div>
    </div>
  )
}

// ── Track comment button (exported for use in TrackRating) ─────────────────────

export function TrackCommentTrigger({ trackName, postSlug }: { trackName: string; postSlug: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleSubmit(name: string, content: string, rating: number | null) {
    setSubmitting(true)
    localStorage.setItem('comment_name', name)
    await postComment({
      post_slug: postSlug,
      display_name: name,
      content,
      selected_text: `__track__${trackName}`,
      parent_id: null,
      user_rating: rating,
    })
    setSubmitting(false)
    setOpen(false)
    // Trigger a re-fetch in parent — use a custom event
    document.dispatchEvent(new CustomEvent('comment-posted', { detail: { postSlug } }))
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="track-comment-btn"
        onClick={() => setOpen(o => !o)}
        title="Comment on this track"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      {open && (
        <div className="comment-popup" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 300, minWidth: 260 }}>
          <CommentForm
            selectedText={trackName}
            isTrack={true}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
