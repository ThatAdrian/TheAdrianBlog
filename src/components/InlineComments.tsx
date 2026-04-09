import React, { useState, useEffect, useRef, useCallback } from 'react'
import './InlineComments.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

interface Comment {
  id: string
  post_slug: string
  display_name: string
  content: string
  selected_text: string
  parent_id: string | null
  created_at: string
}

interface PendingComment {
  selectedText: string
  x: number
  y: number
}

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

function CommentBubble({ comment, allComments, onReply }: {
  comment: Comment
  allComments: Comment[]
  onReply: () => void
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
    onReply()
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

// ── Main component ─────────────────────────────────────────────────────────────

interface InlineCommentsProps {
  postSlug: string
  containerSelector?: string
}

export default function InlineComments({ postSlug, containerSelector = '.prose-custom' }: InlineCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [pending, setPending] = useState<PendingComment | null>(null)
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const loadComments = useCallback(async () => {
    const data = await fetchComments(postSlug)
    setComments(data)
  }, [postSlug])

  useEffect(() => { loadComments() }, [loadComments])

  // Listen for selections anywhere on the document
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      // Don't trigger if clicking inside the popup itself
      if (popupRef.current?.contains(e.target as Node)) return

      setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) {
          return
        }
        const text = sel.toString().trim()
        if (text.length < 3 || text.length > 300) return

        // Only trigger inside the prose content
        const range = sel.getRangeAt(0)
        const container = document.querySelector(containerSelector)
        if (!container || !container.contains(range.commonAncestorContainer)) return

        const rect = range.getBoundingClientRect()
        const wrapRect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

        setPending({
          selectedText: text,
          x: rect.left - wrapRect.left,
          y: rect.bottom - wrapRect.top + 8,
        })
      }, 30)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [containerSelector])

  // Close popup on outside click
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

  async function handleSubmit() {
    if (!pending || !commentText.trim() || !name.trim()) return
    setSubmitting(true)
    localStorage.setItem('comment_name', name)
    const result = await postComment({
      post_slug: postSlug,
      display_name: name,
      content: commentText,
      selected_text: pending.selectedText,
      parent_id: null,
    })
    if (result) {
      await loadComments()
      setCommentText('')
      setPending(null)
      window.getSelection()?.removeAllRanges()
    }
    setSubmitting(false)
  }

  const rootComments = comments.filter(c => !c.parent_id)

  return (
    <div ref={wrapRef} className="inline-comments-wrap">

      {/* Popup appears below the selection */}
      {pending && (
        <div
          ref={popupRef}
          className="highlight-popup--expanded"
          style={{
            position: 'absolute',
            left: Math.max(0, pending.x),
            top: pending.y,
            zIndex: 300,
          }}
        >
          <div className="highlight-popup-selected">
            "{pending.selectedText.slice(0, 80)}{pending.selectedText.length > 80 ? '...' : ''}"
          </div>
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
            placeholder="Add a comment on this passage..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            className="comment-input comment-input--text"
            rows={3}
            maxLength={1000}
          />
          <div className="highlight-popup-actions">
            <button className="comment-cancel" onClick={() => {
              setPending(null)
              window.getSelection()?.removeAllRanges()
            }}>
              Cancel
            </button>
            <button
              className="comment-submit"
              onClick={handleSubmit}
              disabled={!commentText.trim() || !name.trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Comment avatars in right margin */}
      <div className="comment-margin">
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
