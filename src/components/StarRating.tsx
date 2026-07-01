import React, { useState, useEffect } from 'react'
import './StarRating.css'

// ── Rating → color (matches Music.tsx getRatingColor, 1-10 scale) ──────────────
function ratingColor(r: number): string {
  if (r >= 10)  return '#ffffff'
  if (r >= 9)   return '#dd00ff'
  if (r >= 8)   return '#0088ff'
  if (r >= 7)   return '#00bbaa'
  if (r >= 6)   return '#00cc44'
  if (r >= 5)   return '#aadd00'
  if (r >= 4)   return '#ffd000'
  if (r >= 3)   return '#ff8c00'
  if (r >= 2)   return '#ff6600'
  return '#e63333'
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd'

async function fetchCommunityRating(albumId: string) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ratings?album_id=eq.${encodeURIComponent(albumId)}&select=rating`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) return { avg: 0, count: 0 }
    const data: { rating: number }[] = await res.json()
    if (!data.length) return { avg: 0, count: 0 }
    return { avg: data.reduce((s, r) => s + r.rating, 0) / data.length, count: data.length }
  } catch { return { avg: 0, count: 0 } }
}

async function submitRating(albumId: string, rating: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/ratings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ album_id: albumId, rating }),
  })
}

function hasVoted(id: string) { return !!localStorage.getItem(`voted_${id}`) }
function markVoted(id: string) { localStorage.setItem(`voted_${id}`, '1') }

// ── Star SVG — color driven by prop ───────────────────────────────────────────
function StarSVG({ fill, color, size }: { fill: 'full' | 'half' | 'empty'; color: string; size: number }) {
  const gradId = `hg_${Math.random().toString(36).slice(2, 7)}`
  const emptyColor = 'rgba(200,200,255,0.18)'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="star-svg">
      {fill === 'half' && (
        <defs>
          <linearGradient id={gradId}>
            <stop offset="50%" stopColor={color} />
            <stop offset="50%" stopColor={emptyColor} />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={fill === 'full' ? color : fill === 'half' ? `url(#${gradId})` : emptyColor}
        stroke={fill !== 'empty' ? color : emptyColor}
        strokeWidth="0.8" strokeLinejoin="round"
      />
    </svg>
  )
}

// ── StaticStars — starValue is 0–5, color based on the 1–10 rating ────────────
function StaticStars({ starValue, color, size = 20 }: { starValue: number; color: string; size?: number }) {
  return (
    <span className="stars-row">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="star-wrap">
          <StarSVG
            size={size}
            color={color}
            fill={starValue >= i ? 'full' : starValue >= i - 0.5 ? 'half' : 'empty'}
          />
        </span>
      ))}
    </span>
  )
}

// ── InteractiveStars — picks 0.5–5 star values, color from hovered/selected ───
function InteractiveStars({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered > 0 ? hovered : value
  // Color based on what's currently selected/hovered (convert stars → 1–10)
  const activeColor = active > 0 ? ratingColor(active * 2) : 'rgba(200,200,255,0.35)'

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
            <StarSVG fill={fill} color={activeColor} size={size} />
          </span>
        )
      })}
    </span>
  )
}

// ── TrackRating — artistRating is 1–10 ────────────────────────────────────────
export function TrackRating({ trackId, trackName, artistRating, size = 'sm' }: {
  trackId: string; trackName: string; artistRating: number; size?: 'sm' | 'md'
}) {
  const starSize  = size === 'sm' ? 18 : 22
  const starValue = artistRating / 2  // 1–10 → 0.5–5 stars
  const color     = ratingColor(artistRating)
  const display   = artistRating % 1 === 0 ? artistRating.toString() : artistRating.toFixed(1)
  return (
    <div className={`track-rating track-rating--${size}`} style={{ '--track-color': color } as React.CSSProperties}>
      <span className="track-rating__name">{trackName}</span>
      <span className="track-rating__stars">
        <StaticStars starValue={starValue} color={color} size={starSize} />
        <span className="track-rating__value" style={{ color }}>{display}</span>
      </span>
    </div>
  )
}

// ── AlbumRating — artistRating is 1–10 ───────────────────────────────────────
export function AlbumRating({ albumId, albumName, artistRating, showCommunity = true }: {
  albumId: string; albumName: string; artistRating: number; showCommunity?: boolean
}) {
  const [community, setCommunity] = useState({ avg: 0, count: 0 })
  const [userStars, setUserStars]   = useState(0)
  const [submitted, setSubmitted]   = useState(false)
  const [voted, setVoted]           = useState(false)
  const [pulse, setPulse]           = useState(false)

  useEffect(() => {
    if (showCommunity) fetchCommunityRating(albumId).then(setCommunity)
    setVoted(hasVoted(albumId))
  }, [albumId, showCommunity])

  const artistColor   = ratingColor(artistRating)
  const artistStars   = artistRating / 2
  const artistDisplay = artistRating % 1 === 0 ? artistRating.toString() : artistRating.toFixed(1)

  const communityColor   = community.avg > 0 ? ratingColor(community.avg) : 'rgba(180,0,255,0.6)'
  const communityStars   = community.avg / 2
  const communityDisplay = community.avg > 0
    ? (community.avg % 1 === 0 ? community.avg.toString() : community.avg.toFixed(1))
    : '—'

  async function handleSubmit() {
    if (!userStars || voted) return
    await submitRating(albumId, userStars * 2)  // stars × 2 = 1–10
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
            <span className="score-card__dot" style={{ background: artistColor, boxShadow: `0 0 6px ${artistColor}` }} />
            Adrian's Rating
          </div>
          <div className="score-card__big" style={{ color: artistColor, textShadow: `0 0 30px ${artistColor}55` }}>
            {artistDisplay}
          </div>
          <StaticStars starValue={artistStars} color={artistColor} size={28} />
          <div className="score-card__sub">out of 10</div>
        </div>

        <div className="score-card__divider" />

        {/* Community score */}
        {showCommunity && (
          <div className={`score-card score-card--community ${pulse ? 'score-card--pulse' : ''}`}>
            <div className="score-card__label">
              <span className="score-card__dot" style={{ background: communityColor, boxShadow: `0 0 6px ${communityColor}` }} />
              Community Rating
            </div>
            <div className="score-card__big" style={{ color: communityColor, textShadow: `0 0 30px ${communityColor}55` }}>
              {communityDisplay}
            </div>
            <StaticStars starValue={communityStars} color={communityColor} size={28} />
            <div className="score-card__sub">
              {community.count > 0 ? `${community.count} rating${community.count !== 1 ? 's' : ''}` : 'no ratings yet'}
            </div>
          </div>
        )}
      </div>

      {showCommunity && (
        <div className="album-rating__input">
          {voted ? (
            <p className="album-rating__thanks">
              {submitted ? '✦ Thanks for rating!' : '✦ You already rated this one.'}
              {community.count > 0 && <span> Community avg: <strong style={{ color: communityColor }}>{communityDisplay}/10</strong></span>}
            </p>
          ) : (
            <>
              <p className="album-rating__prompt">Rate this yourself</p>
              <div className="album-rating__picker">
                <InteractiveStars value={userStars} onChange={setUserStars} size={32} />
                {userStars > 0 && (
                  <span className="album-rating__chosen" style={{ color: ratingColor(userStars * 2) }}>
                    {(userStars * 2) % 1 === 0 ? (userStars * 2).toString() : (userStars * 2).toFixed(1)}/10
                  </span>
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
