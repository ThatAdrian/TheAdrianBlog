import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './InlineComments.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'
const isMobile = () => window.innerWidth <= 900

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

async function fetchComments(slug: string): Promise<Comment[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/comments?post_slug=eq.${encodeURIComponent(slug)}&order=created_at.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  if (!res.ok) return []
  return res.json()
}

async function postComment(data: {
  post_slug: string; display_name: string; content: string
  selected_text: string; parent_id: string | null; user_rating: number | null
}): Promise<Comment | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows[0] ?? null
}

function getInitial(name: string) { return name.trim().charAt(0).toUpperCase() }
function getInitialColor(name: string) {
  const colors = ['#00f5ff', '#b400ff', '#00ff88', '#ff006e', '#0080ff', '#ffd000', '#ff6600']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
function getRatingColor(r: number) {
  if (r >= 5) return '#ff00ff'; if (r >= 4.5) return '#dd00ff'; if (r >= 4) return '#0088ff'
  if (r >= 3.5) return '#00bbaa'; if (r >= 3) return '#00cc44'; if (r >= 2.5) return '#aadd00'
  if (r >= 2) return '#ffd000'; if (r >= 1.5) return '#ff8c00'; if (r >= 1) return '#ff6600'
  return '#e63333'
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'; if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24); return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString()
}


// ── Mobile bottom sheet ───────────────────────────────────────────────────────
function MobileSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [bottom, setBottom] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      const keyboardHeight = window.innerHeight - vv!.height - vv!.offsetTop
      setBottom(Math.max(0, keyboardHeight))
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) onClose()
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown) }
  }, [onClose])

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={onClose}/>
      <div ref={sheetRef} style={{
        position: 'fixed', bottom, left: 0, right: 0,
        zIndex: 1000, padding: '0 0 env(safe-area-inset-bottom)',
        transition: 'bottom 0.15s ease',
        display: 'flex', justifyContent: 'center',
      }}>
        <div className="mobile-sheet-inner">
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Mini stars ────────────────────────────────────────────────────────────────
function MiniStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered > 0 ? hovered : value
  return (
    <div className="mini-stars">
      <span className="mini-stars-label">Your rating:</span>
      <div className="mini-stars-row" onMouseLeave={() => setHovered(0)}>
        {[1,2,3,4,5].map(i => {
          const fill = active >= i ? 'full' : active >= i - 0.5 ? 'half' : 'empty'
          const col = getRatingColor(hovered > 0 ? hovered : value || 3)
          return (
            <span key={i} className="mini-star"
              onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHovered(e.clientX - r.left < r.width/2 ? i-0.5 : i) }}
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onChange(e.clientX - r.left < r.width/2 ? i-0.5 : i) }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <defs>{fill==='half'&&<linearGradient id={`mh${i}`}><stop offset="50%" stopColor={col}/><stop offset="50%" stopColor="rgba(200,200,255,0.15)"/></linearGradient>}</defs>
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                  fill={fill==='empty'?'rgba(200,200,255,0.15)':fill==='half'?`url(#mh${i})`:col}
                  stroke={fill==='empty'?'rgba(200,200,255,0.15)':col} strokeWidth="1"/>
              </svg>
            </span>
          )
        })}
        {value > 0 && <span className="mini-stars-value" style={{color:getRatingColor(value)}}>{value.toFixed(1)}</span>}
      </div>
    </div>
  )
}

// ── Comment form ──────────────────────────────────────────────────────────────
function CommentForm({ selectedText, isTrack, onSubmit, onCancel, autoFocusInput = true }: {
  selectedText: string; isTrack: boolean
  onSubmit: (name: string, content: string, rating: number|null) => Promise<void>
  onCancel: () => void
  autoFocusInput?: boolean
}) {
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit() {
    if (!content.trim() || !name.trim()) return
    setSubmitting(true); localStorage.setItem('comment_name', name)
    await onSubmit(name, content, isTrack && rating > 0 ? rating : null)
    setSubmitting(false)
  }
  return (
    <div className="comment-form">
      <div className="comment-selected-text">
        {isTrack ? `Track: "${selectedText}"` : `"${selectedText.slice(0,100)}${selectedText.length>100?'...':''}"`}
      </div>
      {isTrack && <MiniStars value={rating} onChange={setRating}/>}
      <input type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}
        className="comment-input comment-input--name" maxLength={30} autoFocus={autoFocusInput}/>
      <textarea placeholder={isTrack?'Comment on this track...':'Add a comment...'}
        value={content} onChange={e=>setContent(e.target.value)}
        className="comment-input comment-input--text" rows={3} maxLength={1000}/>
      <div className="comment-form-actions">
        <button className="comment-cancel" onClick={onCancel}>Cancel</button>
        <button className="comment-submit" onClick={handleSubmit}
          disabled={!content.trim()||!name.trim()||submitting}>
          {submitting?'Posting...':'Post'}
        </button>
      </div>
    </div>
  )
}

// ── Reply form ────────────────────────────────────────────────────────────────
function ReplyForm({ comment, isTrack, onDone, onCancel, autoFocusInput = true }: {
  comment: Comment; isTrack: boolean; onDone: () => void; onCancel: () => void; autoFocusInput?: boolean
}) {
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit() {
    if (!content.trim() || !name.trim()) return
    setSubmitting(true); localStorage.setItem('comment_name', name)
    await postComment({ post_slug: comment.post_slug, display_name: name, content,
      selected_text: comment.selected_text, parent_id: comment.id,
      user_rating: isTrack && rating > 0 ? rating : null })
    setSubmitting(false); onDone()
  }
  return (
    <div className="comment-reply-input">
      {isTrack && <MiniStars value={rating} onChange={setRating}/>}
      <input type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}
        className="comment-input comment-input--name" maxLength={30} autoFocus={autoFocusInput}/>
      <textarea placeholder="Write a reply..." value={content} onChange={e=>setContent(e.target.value)}
        className="comment-input comment-input--text" rows={2} maxLength={1000}/>
      <div className="comment-form-actions">
        <button className="comment-cancel" onClick={onCancel}>Cancel</button>
        <button className="comment-submit" onClick={handleSubmit}
          disabled={!content.trim()||!name.trim()||submitting}>
          {submitting?'Posting...':'Reply'}
        </button>
      </div>
    </div>
  )
}

// ── Thread popup ──────────────────────────────────────────────────────────────
function ThreadPopup({ comments, allComments, onReply, onClose }: {
  comments: Comment[]; allComments: Comment[]
  onReply: () => void; onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [replying, setReplying] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const comment = comments[idx]
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const t = setTimeout(() => document.addEventListener('mousedown', h), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h) }
  }, [onClose])
  if (!comment) return null
  const replies = allComments.filter(c => c.parent_id === comment.id)
  const isTrack = comment.selected_text.startsWith('__track__')
  const displayText = isTrack ? comment.selected_text.replace('__track__','') : comment.selected_text
  return (
    <div ref={ref} className="comment-thread">
      {comments.length > 1 && (
        <div className="comment-thread-nav">
          <button onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0}>‹</button>
          <span>{idx+1} / {comments.length}</span>
          <button onClick={()=>setIdx(i=>Math.min(comments.length-1,i+1))} disabled={idx===comments.length-1}>›</button>
        </div>
      )}
      <div className="comment-selected-text">
        {isTrack?`Track: "${displayText}"`:`"${displayText.slice(0,80)}${displayText.length>80?'...':''}"`}
      </div>
      <div className="comment-item">
        <span className="comment-avatar-sm" style={{'--avatar-color':getInitialColor(comment.display_name)} as React.CSSProperties}>{getInitial(comment.display_name)}</span>
        <div className="comment-item-body">
          <div className="comment-item-header">
            <span className="comment-item-name">{comment.display_name}</span>
            {comment.user_rating&&<span className="comment-item-rating" style={{color:getRatingColor(comment.user_rating)}}>★ {comment.user_rating.toFixed(1)}</span>}
            <span className="comment-item-time">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="comment-item-text">{comment.content}</p>
        </div>
      </div>
      {replies.map(reply=>(
        <div key={reply.id} className="comment-item comment-item--reply">
          <span className="comment-avatar-sm" style={{'--avatar-color':getInitialColor(reply.display_name)} as React.CSSProperties}>{getInitial(reply.display_name)}</span>
          <div className="comment-item-body">
            <div className="comment-item-header">
              <span className="comment-item-name">{reply.display_name}</span>
              {reply.user_rating&&<span className="comment-item-rating" style={{color:getRatingColor(reply.user_rating)}}>★ {reply.user_rating.toFixed(1)}</span>}
              <span className="comment-item-time">{timeAgo(reply.created_at)}</span>
            </div>
            <p className="comment-item-text">{reply.content}</p>
          </div>
        </div>
      ))}
      {replying ? (
        <ReplyForm comment={comment} isTrack={isTrack}
          onDone={()=>{setReplying(false);onReply()}} onCancel={()=>setReplying(false)}/>
      ) : (
        <button className="comment-reply-btn" onClick={()=>setReplying(true)}>Reply</button>
      )}
    </div>
  )
}

// ── Comment stack ─────────────────────────────────────────────────────────────
function CommentStack({ comments, allComments, onReply, top }: {
  comments: Comment[]; allComments: Comment[]; onReply: () => void; top: number
}) {
  const [open, setOpen] = useState(false)
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const first = comments[0]
  const color = getInitialColor(first.display_name)
  const multiple = comments.length > 1

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const popupWidth = 280
      const left = Math.max(8, rect.left - popupWidth - 8)
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow >= 400
        ? rect.bottom + 8
        : Math.max(8, rect.top - 400 - 8)
      setPortalPos({ top, left })
    }
    setOpen(o => !o)
  }

  // Desktop: render inline (position absolute, to the left via CSS)
  // Mobile: render via portal (position fixed, calculated from button rect)
  const threadEl = open ? (
    <ThreadPopup
      comments={comments}
      allComments={allComments}
      onReply={() => { setOpen(false); onReply() }}
      onClose={() => setOpen(false)}
    />
  ) : null

  return (
    <div className="comment-stack" style={{ top }}>
      {multiple && (
        <button className="comment-avatar comment-avatar--behind"
          style={{'--avatar-color': getInitialColor(comments[1].display_name)} as React.CSSProperties}
          onClick={handleOpen}>
          {getInitial(comments[1].display_name)}
        </button>
      )}
      <button
        ref={btnRef}
        className={`comment-avatar${multiple ? ' comment-avatar--stacked' : ''}`}
        style={{'--avatar-color': color} as React.CSSProperties}
        onClick={handleOpen}
        title={multiple ? `${comments.length} comments` : `${first.display_name}: ${first.content}`}
      >
        {multiple ? <span className="comment-stack-count">{comments.length}</span> : getInitial(first.display_name)}
      </button>

      {/* Desktop: inline, positioned via CSS */}
      {open && !isMobile() && threadEl}

      {/* Mobile: bottom sheet */}
      {open && isMobile() && (
        <MobileSheet onClose={() => setOpen(false)}>
          {threadEl}
        </MobileSheet>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface InlineCommentsProps { postSlug: string }

export default function InlineComments({ postSlug }: InlineCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [pending, setPending] = useState<{
    selectedText: string
    // desktop: relative to wrap
    relTop: number
    // mobile: viewport fixed
    viewportTop: number; viewportLeft: number
  } | null>(null)
  const [stackPositions, setStackPositions] = useState<Map<string, number>>(new Map())
  const wrapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const loadComments = useCallback(async () => {
    const data = await fetchComments(postSlug)
    setComments(data)
  }, [postSlug])

  useEffect(() => { loadComments() }, [loadComments])

  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent
      if (ce.detail?.postSlug === postSlug) loadComments()
    }
    document.addEventListener('comment-posted', h)
    return () => document.removeEventListener('comment-posted', h)
  }, [postSlug, loadComments])

  function tryCapture() {
    if (!wrapRef.current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const range = sel.getRangeAt(0)
    const container = document.querySelector('.post-content-with-comments')
    if (!container || !container.contains(range.commonAncestorContainer)) return

    const rangeRect = range.getBoundingClientRect()
    const wrapRect = wrapRef.current.getBoundingClientRect()

    // Desktop: position relative to wrap (absolute)
    const relTop = rangeRect.bottom - wrapRect.top

    // Mobile: position fixed relative to viewport, to the left of the margin
    const popupWidth = 280
    const margin = 8
    const viewportLeft = Math.max(margin, Math.min(rangeRect.left, window.innerWidth - popupWidth - margin))
    const spaceBelow = window.innerHeight - rangeRect.bottom
    const viewportTop = spaceBelow >= 320
      ? rangeRect.bottom + 8
      : Math.max(8, rangeRect.top - 320 - 8)

    setPending({ selectedText: text, relTop, viewportTop, viewportLeft })
  }

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setTimeout(tryCapture, 30)
    }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    const onTouchEnd = (e: TouchEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return
      setTimeout(tryCapture, 200)
    }
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => document.removeEventListener('touchend', onTouchEnd)
  }, [])

  useEffect(() => {
    if (!pending) return
    const onDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPending(null); window.getSelection()?.removeAllRanges()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown) }
  }, [pending])

  async function handleSubmit(name: string, content: string, rating: number|null) {
    if (!pending) return
    await postComment({ post_slug: postSlug, display_name: name, content,
      selected_text: pending.selectedText, parent_id: null, user_rating: rating })
    await loadComments()
    setPending(null)
    window.getSelection()?.removeAllRanges()
  }

  const rootComments = comments.filter(c => !c.parent_id)
  const grouped = new Map<string, Comment[]>()
  rootComments.forEach(c => {
    if (!grouped.has(c.selected_text)) grouped.set(c.selected_text, [])
    grouped.get(c.selected_text)!.push(c)
  })

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const positions = new Map<string, number>()
    const wrapRect = wrap.getBoundingClientRect()
    grouped.forEach((_, key) => {
      const isTrack = key.startsWith('__track__')
      const searchText = isTrack ? key.replace('__track__','') : key
      if (isTrack) {
        document.querySelectorAll('.track-rating').forEach(el => {
          if (el.textContent?.includes(searchText)) {
            const elRect = el.getBoundingClientRect()
            positions.set(key, elRect.top - wrapRect.top + elRect.height / 2 - 16)
          }
        })
      } else {
        const container = document.querySelector('.post-content-with-comments')
        if (!container) return
        const needle = searchText.slice(0, 30)
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          const idx = (node.textContent ?? '').indexOf(needle)
          if (idx >= 0) {
            try {
              const range = document.createRange()
              range.setStart(node, idx)
              range.setEnd(node, Math.min(idx + needle.length, node.textContent!.length))
              const rangeRect = range.getBoundingClientRect()
              if (rangeRect.height > 0) {
                positions.set(key, rangeRect.top - wrapRect.top + rangeRect.height / 2 - 16)
              }
            } catch {}
            break
          }
        }
      }
    })
    setStackPositions(positions)
  }, [comments])

  const popupForm = pending ? (
    <CommentForm
      selectedText={pending.selectedText}
      isTrack={false}
      onSubmit={handleSubmit}
      onCancel={() => { setPending(null); window.getSelection()?.removeAllRanges() }}
    />
  ) : null

  return (
    <div ref={wrapRef} className="inline-comments-wrap">

      {/* Desktop popup: absolute within wrap */}
      {pending && !isMobile() && (
        <div ref={popupRef} className="comment-popup"
          style={{ position: 'absolute', top: pending.relTop + 8, left: 0, zIndex: 300 }}>
          {popupForm}
        </div>
      )}

      {/* Mobile popup: bottom sheet */}
      {pending && isMobile() && (
        <MobileSheet onClose={() => { setPending(null); window.getSelection()?.removeAllRanges() }}>
          {popupForm}
        </MobileSheet>
      )}

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

// ── Track comment trigger ─────────────────────────────────────────────────────
export function TrackCommentTrigger({ trackName, postSlug }: { trackName: string; postSlug: string }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || isMobile()) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onMouseDown), 50)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onMouseDown) }
  }, [open])

  async function handleSubmit(name: string, content: string, rating: number|null) {
    localStorage.setItem('comment_name', name)
    await postComment({ post_slug: postSlug, display_name: name, content,
      selected_text: `__track__${trackName}`, parent_id: null, user_rating: rating })
    setOpen(false)
    document.dispatchEvent(new CustomEvent('comment-posted', { detail: { postSlug } }))
  }

  const form = <CommentForm selectedText={trackName} isTrack={true} onSubmit={handleSubmit} onCancel={() => setOpen(false)} />

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={btnRef} className="track-comment-btn" onClick={() => setOpen(o => !o)} title="Comment on this track">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* Desktop: inline absolute */}
      {open && !isMobile() && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 300 }}>
          <div className="comment-popup">{form}</div>
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {open && isMobile() && (
        <MobileSheet onClose={() => setOpen(false)}>
          {form}
        </MobileSheet>
      )}
    </div>
  )
}
