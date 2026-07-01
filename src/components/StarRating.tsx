import React, { useState, useEffect } from 'react'
import './StarRating.css'

// ── Types ──────────────────────────────────────────────────────────────────────
interface TrackRatingProps {
  trackId: string
  trackName: string
  artistRating: number   // 1–10 scale
  size?: 'sm' | 'md'
}

interface AlbumRatingProps {
  albumId: string
  albumName: string
  artistRating: number   // 1–10 scale
  showCommunity?: boolean
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

async function fetchCommunityRating(albumId: string): Promise<{ avg: number; count: number }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ratings?album_id=eq.${encodeURIComponent(albumId)}&select=rating`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) return { avg: 0, count: 0 }
    const data: { rating: number }[] = await res.json()
    if (!data.length) return { avg: 0, count: 0 }
    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length
    return { avg, count: data.length }
  } catch { return { avg: 0, count: 0 } }
}

async function submitRating(albumId: string, rating: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/ratings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ album_id: albumId, rating }),
  })
}

function hasVoted(id: string) { return !!localStorage.getItem(`voted_${id}`) }
function markVoted(id: string) { localStorage.setItem(`voted_${id}`, '1') }

// ── Star SVG ───────────────────────────────────────────────────────────────────
const STAR_ACTIVE = '#00f5ff'
const STAR_ACTIVE_PURPLE = '#b400ff'
const STAR_EMPTY = 'rgba(200,200,255,0.18)'

function StarSVG({ fill, size, color = STAR_ACTIVE }: { fill: 'full' | 'half' | 'empty'; size: number; color?: string }) {
  const id = `half_${Math.random().toString(36).slice(2, 7)}`
  const activeFill = fill === 'full' ? color : fill === 'half' ? `url(#${id})` : STAR_EMPTY
  const activeStroke = fill !== 'empty' ? color : STAR_EMPTY
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="star-svg">
      {fill === 'half' && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor={color} />
            <stop offset="50%" stopColor={STAR_EMPTY} />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={activeFill}
        stroke={activeStroke}
        strokeWidth="1" strokeLinejoin="round"
      />
    </svg>
  )
}

// StaticStars — value is 0–5 star scale
function StaticStars({ value, size = 20, color = STAR_ACTIVE }: { value: number; size?: number; color?: string }) {
  return (
    <span className="stars-row">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="star-wrap">
          <StarSVG size={size} color={color} fill={value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty'} />
        </span>
      ))}
    </span>
  )
}

// InteractiveStars — picks 0.5–5, each star = 2 points on 1–10 scale
function InteractiveStars({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered > 0 ? hovered : value
  return (
    <span className="stars-row" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = active >= i ? 'full' : active >= i - 0.5 ? 'half' : 'empty'
        return (
          <span
            key={i}
            className="star-wrap star-interactive"
            onMouseMove={e => {
              const left = e.clientX - e.currentTarget.getBoundingClientRect().left < e.currentTarget.getBoundingClientRect().width / 2
              setHovered(left ? i - 0.5 : i)
            }}
            onClick={e => {
              const left = e.clientX - e.currentTarget.getBoundingClientRect().left < e.currentTarget.getBoundingClientRect().width / 2
              onChange(left ? i - 0.5 : i)
            }}
          >
            <StarSVG fill={fill} size={size} color={STAR_ACTIVE_PURPLE} />
          </span>
        )
      })}
    </span>
  )
}

// ── TrackRating ────────────────────────────────────────────────────────────────
// artistRating is 1–10; stars = artistRating / 2
export function TrackRating({ trackId, trackName, artistRating, size = 'sm' }: TrackRatingProps) {
  const starSize = size === 'sm' ? 18 : 22
  const starValue = artistRating / 2  // convert 1–10 → 0.5–5 stars
  const displayVal = artistRating % 1 === 0 ? artistRating.toString() : artistRating.toFixed(1)
  return (
    <div className={`track-rating track-rating--${size}`}>
      <span className="track-rating__name">{trackName}</span>
      <span className="track-rating__stars">
        <StaticStars value={starValue} size={starSize} />
        <span className="track-rating__value">{displayVal}</span>
      </span>
    </div>
  )
}

// ── AlbumRating ────────────────────────────────────────────────────────────────
// artistRating is 1–10; stars = artistRating / 2
// Community: interactive stars 0.5–5, stored × 2 → 1–10 in Supabase
export function AlbumRating({ albumId, albumName, artistRating, showCommunity = true }: AlbumRatingProps) {
  const [community, setCommunity] = useState({ avg: 0, count: 0 })
  const [userStars, setUserStars] = useState(0)  // 0.5–5 star scale
  const [submitted, setSubmitted] = useState(false)
  const [voted, setVoted] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (showCommunity) fetchCommunityRating(albumId).then(setCommunity)
    setVoted(hasVoted(albumId))
  }, [albumId, showCommunity])

  const artistStars   = artistRating / 2  // 1–10 → 0.5–5 stars
  const artistDisplay = artistRating % 1 === 0 ? artistRating.toString() : artistRating.toFixed(1)
  const communityDisplay = community.avg > 0
    ? (community.avg % 1 === 0 ? community.avg.toString() : community.avg.toFixed(1))
    : '—'
  const communityStars = community.avg / 2  // stored 1–10 → stars

  async function handleSubmit() {
    if (!userStars || voted) return
    const rating10 = userStars * 2  // convert stars → 1–10
    await submitRating(albumId, rating10)
    markVoted(albumId)
    setVoted(true); setSubmitted(true)
    setPulse(true); setTimeout(() => setPulse(false), 600)
    fetchCommunityRating(albumId).then(setCommunity)
  }

  return (
    <div className="album-rating">
      <div className="album-rating__scoreboard">

        {/* Adrian's score */}
        <div className="score-card score-card--adrian">
          <div className="score-card__label">
            <span className="score-card__dot score-card__dot--cyan" />
            Adrian's Rating
          </div>
          <div className="score-card__big">{artistDisplay}</div>
          <StaticStars value={artistStars} size={28} color={STAR_ACTIVE} />
          <div className="score-card__sub">out of 10</div>
        </div>

        <div className="score-card__divider" />

        {/* Community score */}
        {showCommunity && (
          <div className={`score-card score-card--community ${pulse ? 'score-card--pulse' : ''}`}>
            <div className="score-card__label">
              <span className="score-card__dot score-card__dot--purple" />
              Community Rating
            </div>
            <div className="score-card__big">{communityDisplay}</div>
            <StaticStars value={communityStars} size={28} color={STAR_ACTIVE_PURPLE} />
            <div className="score-card__sub">
              {community.count > 0
                ? `${community.count} rating${community.count !== 1 ? 's' : ''}`
                : 'no ratings yet'}
            </div>
          </div>
        )}
      </div>

      {showCommunity && (
        <div className="album-rating__input">
          {voted ? (
            <p className="album-rating__thanks">
              {submitted ? '✦ Thanks for rating!' : '✦ You already rated this one.'}
              {community.count > 0 && <span> Community avg: <strong>{communityDisplay}/10</strong></span>}
            </p>
          ) : (
            <>
              <p className="album-rating__prompt">Rate this yourself</p>
              <div className="album-rating__picker">
                <InteractiveStars value={userStars} onChange={setUserStars} size={32} />
                {userStars > 0 && (
                  <span className="album-rating__chosen">{(userStars * 2) % 1 === 0 ? (userStars * 2).toString() : (userStars * 2).toFixed(1)}/10</span>
                )}
              </div>
              <button className="album-rating__submit" onClick={handleSubmit} disabled={!userStars}>
                Submit Rating
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AlbumRating
