'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './StarRating.css';

// ── Rating colour map ─────────────────────────────────────────────────────────

const RATING_COLORS: Record<string, string> = {
  '0':   '#cc0000',
  '0.5': '#e63333',
  '1':   '#ff6600',
  '1.5': '#ff8c00',
  '2':   '#ffd000',
  '2.5': '#aadd00',
  '3':   '#00cc44',
  '3.5': '#00bbaa',
  '4':   '#0088ff',
  '4.5': '#dd00ff',
  '5':   'rainbow',
}

function getRatingColor(rating: number): string {
  const key = (Math.round(rating * 2) / 2).toFixed(1).replace('.0', '')
  const lookup = rating === 0 ? '0' : key
  return RATING_COLORS[lookup] ?? '#00f5ff'
}

function isRainbow(rating: number) {
  return rating === 5
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StarProps {
  index: number
  value: number
  hovered: number
  onHover: (v: number) => void
  onClick: (v: number) => void
  size?: number
  readonly?: boolean
  color: string
  rainbow: boolean
}

interface TrackRatingProps {
  trackId: string
  trackName: string
  artistRating: number
  size?: 'sm' | 'md'
}

interface AlbumRatingProps {
  albumId: string
  albumName: string
  artistRating: number
  showCommunity?: boolean
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadRatings(id: string): { total: number; count: number } {
  try {
    const raw = localStorage.getItem(`rating_${id}`)
    return raw ? JSON.parse(raw) : { total: 0, count: 0 }
  } catch {
    return { total: 0, count: 0 }
  }
}

function saveRating(id: string, value: number) {
  const existing = loadRatings(id)
  const updated = { total: existing.total + value, count: existing.count + 1 }
  localStorage.setItem(`rating_${id}`, JSON.stringify(updated))
  return updated
}

function hasVoted(id: string) {
  return !!localStorage.getItem(`voted_${id}`)
}

function markVoted(id: string) {
  localStorage.setItem(`voted_${id}`, '1')
}

// ── Star SVG ──────────────────────────────────────────────────────────────────

function StarSVG({
  fill,
  size,
  color,
  rainbow,
  gradId,
}: {
  fill: 'full' | 'half' | 'empty'
  size: number
  color: string
  rainbow: boolean
  gradId: string
}) {
  const halfId = `half_${gradId}`
  const rainbowId = `rainbow_${gradId}`

  let starFill: string
  if (fill === 'empty') {
    starFill = 'var(--star-empty)'
  } else if (fill === 'half') {
    starFill = `url(#${halfId})`
  } else if (rainbow) {
    starFill = `url(#${rainbowId})`
  } else {
    starFill = color
  }

  const strokeColor = fill !== 'empty' ? (rainbow ? `url(#${rainbowId})` : color) : 'var(--star-empty)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={`star-svg${rainbow && fill !== 'empty' ? ' star-rainbow' : ''}`}
    >
      <defs>
        {fill === 'half' && (
          <linearGradient id={halfId}>
            <stop offset="50%" stopColor={rainbow ? '#ff006e' : color} />
            <stop offset="50%" stopColor="var(--star-empty)" />
          </linearGradient>
        )}
        {rainbow && (
          <linearGradient id={rainbowId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ff0000" />
            <stop offset="20%"  stopColor="#ff8800" />
            <stop offset="40%"  stopColor="#ffee00" />
            <stop offset="60%"  stopColor="#00cc44" />
            <stop offset="80%"  stopColor="#0088ff" />
            <stop offset="100%" stopColor="#dd00ff" />
          </linearGradient>
        )}
      </defs>
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={starFill}
        stroke={strokeColor}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Static star row ───────────────────────────────────────────────────────────

function StaticStars({ value, size = 20 }: { value: number; size?: number }) {
  const color = getRatingColor(value)
  const rainbow = isRainbow(value)

  return (
    <span className={`stars-row${rainbow ? ' stars-rainbow' : ''}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="star-wrap">
          <StarSVG
            size={size}
            fill={value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty'}
            color={color}
            rainbow={rainbow}
            gradId={`static_${value}_${i}`}
          />
        </span>
      ))}
    </span>
  )
}

// ── Interactive star row ──────────────────────────────────────────────────────

function InteractiveStars({
  value,
  onChange,
  size = 28,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  const [hovered, setHovered] = useState(0)
  const active = hovered > 0 ? hovered : value
  const color = getRatingColor(active)
  const rainbow = isRainbow(active)

  function handleMouseMove(e: React.MouseEvent<HTMLSpanElement>, index: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const isLeft = e.clientX - rect.left < rect.width / 2
    setHovered(isLeft ? index - 0.5 : index)
  }

  function handleClick(e: React.MouseEvent<HTMLSpanElement>, index: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const isLeft = e.clientX - rect.left < rect.width / 2
    onChange(isLeft ? index - 0.5 : index)
  }

  return (
    <span className={`stars-row${rainbow ? ' stars-rainbow' : ''}`} onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = active >= i ? 'full' : active >= i - 0.5 ? 'half' : 'empty'
        return (
          <span
            key={i}
            className="star-wrap star-interactive"
            onMouseMove={e => handleMouseMove(e, i)}
            onClick={e => handleClick(e, i)}
          >
            <StarSVG
              size={size}
              fill={fill}
              color={color}
              rainbow={rainbow && fill !== 'empty'}
              gradId={`inter_${i}_${active}`}
            />
          </span>
        )
      })}
    </span>
  )
}

// ── Track Rating ──────────────────────────────────────────────────────────────

export function TrackRating({ trackId, trackName, artistRating, size = 'sm' }: TrackRatingProps) {
  const starSize = size === 'sm' ? 18 : 22
  const color = getRatingColor(artistRating)
  const rainbow = isRainbow(artistRating)

  return (
    <div
      className={`track-rating track-rating--${size}`}
      style={{ '--track-color': rainbow ? 'transparent' : color } as React.CSSProperties}
    >
      <span className="track-rating__name">{trackName}</span>
      <span className="track-rating__stars">
        <StaticStars value={artistRating} size={starSize} />
        <span
          className={`track-rating__value${rainbow ? ' track-rating__value--rainbow' : ''}`}
          style={{ color: rainbow ? undefined : color }}
        >
          {artistRating.toFixed(1)}
        </span>
      </span>
    </div>
  )
}

// ── Album Rating ──────────────────────────────────────────────────────────────

export function AlbumRating({ albumId, albumName, artistRating, showCommunity = true }: AlbumRatingProps) {
  const [communityData, setCommunityData] = useState({ total: 0, count: 0 })
  const [userRating, setUserRating] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [voted, setVoted] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    setCommunityData(loadRatings(albumId))
    setVoted(hasVoted(albumId))
  }, [albumId])

  const communityAvg =
    communityData.count > 0
      ? Math.round((communityData.total / communityData.count) * 2) / 2
      : 0

  const adrianColor = getRatingColor(artistRating)
  const adrianRainbow = isRainbow(artistRating)
  const communityColor = communityData.count > 0 ? getRatingColor(communityAvg) : '#555'
  const communityRainbow = communityData.count > 0 && isRainbow(communityAvg)
  const userColor = getRatingColor(userRating)
  const userRainbow = isRainbow(userRating)

  function handleSubmit() {
    if (!userRating || voted) return
    const updated = saveRating(albumId, userRating)
    markVoted(albumId)
    setCommunityData(updated)
    setVoted(true)
    setSubmitted(true)
    setPulse(true)
    setTimeout(() => setPulse(false), 600)
  }

  return (
    <div className="album-rating">
      <div className="album-rating__scoreboard">

        {/* Adrian's score */}
        <div
          className="score-card score-card--adrian"
          style={{ '--card-color': adrianColor, '--card-glow': adrianColor + '33' } as React.CSSProperties}
        >
          <div className="score-card__label">
            <span className="score-card__dot" style={{ background: adrianColor, boxShadow: `0 0 6px ${adrianColor}` }} />
            Adrian's Rating
          </div>
          <div className={`score-card__big${adrianRainbow ? ' score-card__big--rainbow' : ''}`}
            style={{ color: adrianRainbow ? undefined : adrianColor, textShadow: adrianRainbow ? undefined : `0 0 30px ${adrianColor}66` }}
          >
            {artistRating.toFixed(1)}
          </div>
          <StaticStars value={artistRating} size={28} />
          <div className="score-card__sub">out of 5</div>
        </div>

        <div className="score-card__divider" />

        {/* Community score */}
        {showCommunity && (
          <div
            className={`score-card score-card--community${pulse ? ' score-card--pulse' : ''}`}
            style={{ '--card-color': communityColor, '--card-glow': communityColor + '33' } as React.CSSProperties}
          >
            <div className="score-card__label">
              <span className="score-card__dot" style={{ background: communityColor, boxShadow: `0 0 6px ${communityColor}` }} />
              Community Rating
            </div>
            <div
              className={`score-card__big${communityRainbow ? ' score-card__big--rainbow' : ''}`}
              style={{ color: communityRainbow ? undefined : communityColor, textShadow: communityRainbow ? undefined : `0 0 30px ${communityColor}66` }}
            >
              {communityData.count > 0 ? communityAvg.toFixed(1) : '—'}
            </div>
            <StaticStars value={communityAvg} size={28} />
            <div className="score-card__sub">
              {communityData.count > 0
                ? `${communityData.count} rating${communityData.count !== 1 ? 's' : ''}`
                : 'no ratings yet'}
            </div>
          </div>
        )}
      </div>

      {/* Community input */}
      {showCommunity && (
        <div className="album-rating__input">
          {voted ? (
            <p className="album-rating__thanks">
              {submitted ? '✦ Thanks for rating!' : '✦ You already rated this one.'}
              {communityData.count > 0 && (
                <span> Community avg: <strong style={{ color: communityColor }}>{communityAvg.toFixed(1)}</strong></span>
              )}
            </p>
          ) : (
            <>
              <p className="album-rating__prompt">Rate this yourself</p>
              <div className="album-rating__picker">
                <InteractiveStars value={userRating} onChange={setUserRating} size={32} />
                {userRating > 0 && (
                  <span
                    className={`album-rating__chosen${userRainbow ? ' album-rating__chosen--rainbow' : ''}`}
                    style={{ color: userRainbow ? undefined : userColor }}
                  >
                    {userRating.toFixed(1)}
                  </span>
                )}
              </div>
              <button
                className="album-rating__submit"
                onClick={handleSubmit}
                disabled={!userRating}
                style={userRating ? {
                  borderColor: userColor + '99',
                  color: userColor,
                  background: userColor + '1a',
                } : {}}
              >
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
