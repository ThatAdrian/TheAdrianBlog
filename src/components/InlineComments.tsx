import React, { useState, useEffect, useRef, useCallback } from 'react'
import './InlineComments.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Comment {
  id: string
  post_slug: string
  display_name: string
  content: string
  selected_text: string
  parent_id: string | null
  created_at: string
  replies?: Comment[]
}

interface PendingComment {
  selectedText: string
  anchorNode: Node
  anchorOffset: number
  x: number
  y: number
}

interface CommentBubbleData {
  comment: Comment
  x: number
  y: number
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

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

// ── Utility ───────────────────────────────────────────────────────────────────

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase()
}

function getInitialColor(name: string) {
  const colors = ['#00f5ff', '#b400ff', '#00ff88', '#ff006e', '#0080ff', '#ffd000', '#ff6600']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ── Comment bubble (avatar in margin) ────────────────────────────────────────

function CommentBubble({ comment, allComments, onReply }: {
  comment: Comment
  allComments: Comment[]
  onReply: (parentId: string, selectedText: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyName, setReplyName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const color = getInitialColor(comment.display_name)
  const replies = allComments.filter(c => c.parent_id === comment.id)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function submitReply() {
    if (!replyText.trim() || !replyName.trim()) return
    setSubmitting(true)
    localStorage.setItem('comment_name', replyName)
    await postComment({
      post_slug: comment.post_slug,
      display_name: replyName,
      content: replyText,
      selected_text: comment.selected_text,
      parent_id: comment.id,
    })
    setReplyText('')
    setSubmitting(false)
    onReply(comment.id, comment.selected_text)
  }

  return (
    <div ref={ref} className="comment-bubble-wrap">
      <button
        className="comment-avatar"
        style={{ '--avatar-color': color } as React.CSSProperties}
        onClick={() => setOpen(o => !o)}
        title={`${comment.display_name}: ${comment.content}`}
      >
        {getInitial(comment.display_name)}
      </button>

      {open && (
        <div className="comment-thread">
          {/* Original comment */}
          <div className="comment-selected-text">"{comment.selected_text}"</div>
          <div className="comment-item">
            <span className="comment-avatar-sm" style={{ '--avatar-color': color } as React.CSSProperties}>
              {getInitial(comment.display_name)}
            </span>
            <div className="comment-item-body">
              <div className="comment-item-header">
                <span className="comment-item-name">{comment.display_name}</span>
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
                  <span className="comment-item-time">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="comment-item-text">{reply.content}</p>
              </div>
            </div>
          ))}

          {/* Reply input */}
          <div className="comment-reply-input">
            <input
              type="text"
              placeholder="Your name"
              value={replyName}
              onChange={e => setReplyName(e.target.value)}
              className="comment-input comment-input--name"
              maxLength={30}
            />
            <textarea
              placeholder="Write a reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              className="comment-input comment-input--text"
              rows={2}
              maxLength={1000}
            />
            <button
              className="comment-submit"
              onClick={submitReply}
              disabled={!replyText.trim() || !replyName.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Highlight popup (appears when text is selected) ───────────────────────────

function HighlightPopup({ pending, onSubmit, onDismiss }: {
  pending: PendingComment
  onSubmit: (name: string, content: string) => Promise<void>
  onDismiss: () => void
}) {
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onDismiss])

  async function handleSubmit() {
    if (!content.trim() || !name.trim()) return
    setSubmitting(true)
    localStorage.setItem('comment_name', name)
    await onSubmit(name, content)
    setSubmitting(false)
  }

  if (!expanded) {
    return (
      <div
        ref={ref}
        className="highlight-popup"
        style={{ left: pending.x, top: pending.y }}
      >
        <button className="highlight-popup-btn" onClick={() => setExpanded(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comment
        </button>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="highlight-popup highlight-popup--expanded"
      style={{ left: pending.x, top: pending.y }}
    >
      <div className="highlight-popup-selected">"{pending.selectedText.slice(0, 80)}{pending.selectedText.length > 80 ? '...' : ''}"</div>
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
        placeholder="Add a comment..."
        value={content}
        onChange={e => setContent(e.target.value)}
        className="comment-input comment-input--text"
        rows={3}
        maxLength={1000}
      />
      <div className="highlight-popup-actions">
        <button className="comment-cancel" onClick={onDismiss}>Cancel</button>
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

// ── Main component ────────────────────────────────────────────────────────────

interface InlineCommentsProps {
  postSlug: string
  contentRef: React.RefObject<HTMLElement>
}

export default function InlineComments({ postSlug, contentRef }: InlineCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [pending, setPending] = useState<PendingComment | null>(null)
  const marginRef = useRef<HTMLDivElement>(null)

  const loadComments = useCallback(async () => {
    const data = await fetchComments(postSlug)
    // Attach replies to parents
    const roots = data.filter(c => !c.parent_id)
    roots.forEach(r => { r.replies = data.filter(c => c.parent_id === r.id) })
    setComments(data)
  }, [postSlug])

  useEffect(() => { loadComments() }, [loadComments])

  // Listen for text selection inside the prose content
  useEffect(() => {
  const container = contentRef.current
  if (!container) return

  function onMouseUp() {
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return
      const text = sel.toString().trim()
      if (text.length < 3 || text.length > 300) return

      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return

      const rect = range.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      setPending({
        selectedText: text,
        anchorNode: range.startContainer,
        anchorOffset: range.startOffset,
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top - 48,
      })
    }, 10)
  }

  document.addEventListener('mouseup', onMouseUp)
  return () => document.removeEventListener('mouseup', onMouseUp)
}, [contentRef])

  async function handleNewComment(name: string, content: string) {
    if (!pending) return
    const newComment = await postComment({
      post_slug: postSlug,
      display_name: name,
      content,
      selected_text: pending.selectedText,
      parent_id: null,
    })
    if (newComment) {
      await loadComments()
    }
    setPending(null)
    window.getSelection()?.removeAllRanges()
  }

  // Top-level comments only (no parent)
  const rootComments = comments.filter(c => !c.parent_id)

  return (
    <div className="inline-comments-wrap" style={{ position: 'relative' }}>
      {/* Highlight popup */}
      {pending && (
        <HighlightPopup
          pending={pending}
          onSubmit={handleNewComment}
          onDismiss={() => { setPending(null); window.getSelection()?.removeAllRanges() }}
        />
      )}

      {/* Comment avatars in right margin */}
      <div ref={marginRef} className="comment-margin">
        {rootComments.map(comment => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            allComments={comments}
            onReply={loadComments}
          />
        ))}
      </div>
    </div>
  )
}
