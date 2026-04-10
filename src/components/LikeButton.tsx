import React, { useState, useEffect, useCallback } from 'react'
import './LikeButton.css'

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

// Generate a stable fingerprint stored in localStorage
function getFingerprint(): string {
  const key = 'tab_fp'
  let fp = localStorage.getItem(key)
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, fp)
  }
  return fp
}

async function fetchLikes(slug: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/likes?post_slug=eq.${encodeURIComponent(slug)}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' } }
  )
  const count = res.headers.get('content-range')?.split('/')[1]
  return parseInt(count ?? '0', 10)
}

async function fetchHasLiked(slug: string, fp: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/likes?post_slug=eq.${encodeURIComponent(slug)}&fingerprint=eq.${encodeURIComponent(fp)}&select=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  )
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0
}

async function addLike(slug: string, fp: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/likes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ post_slug: slug, fingerprint: fp }),
  })
}

async function removeLike(slug: string, fp: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/likes?post_slug=eq.${encodeURIComponent(slug)}&fingerprint=eq.${encodeURIComponent(fp)}`,
    {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }
  )
}

interface LikeButtonProps {
  postSlug: string
  compact?: boolean  // true = card view (just icon + count), false = full button on post page
}

export default function LikeButton({ postSlug, compact = false }: LikeButtonProps) {
  const [count, setCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const fp = getFingerprint()

  const load = useCallback(async () => {
    const [c, h] = await Promise.all([fetchLikes(postSlug), fetchHasLiked(postSlug, fp)])
    setCount(c)
    setLiked(h)
  }, [postSlug, fp])

  useEffect(() => { load() }, [load])

  async function toggle() {
    if (loading) return
    setLoading(true)
    setAnimating(true)
    setTimeout(() => setAnimating(false), 400)
    if (liked) {
      setLiked(false); setCount(c => c - 1)
      await removeLike(postSlug, fp)
    } else {
      setLiked(true); setCount(c => c + 1)
      await addLike(postSlug, fp)
    }
    setLoading(false)
  }

  if (compact) {
    return (
      <button
        className={`like-btn like-btn--compact ${liked ? 'liked' : ''} ${animating ? 'animating' : ''}`}
        onClick={e => { e.preventDefault(); e.stopPropagation(); toggle() }}
        aria-label={liked ? 'Unlike' : 'Like'}
        title={liked ? 'Unlike' : 'Like this post'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>{count > 0 ? count : ''}</span>
      </button>
    )
  }

  return (
    <button
      className={`like-btn like-btn--full ${liked ? 'liked' : ''} ${animating ? 'animating' : ''}`}
      onClick={toggle}
      aria-label={liked ? 'Unlike this post' : 'Like this post'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span>{liked ? 'Liked' : 'Like'}</span>
      {count > 0 && <span className="like-count">{count}</span>}
    </button>
  )
}
