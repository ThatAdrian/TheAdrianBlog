'use client';
import React, { useState, useEffect } from 'react';
import './StarRating.css';

// ── Supabase config ───────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://nwkissnpwmjktuaunzyt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_mzJyuPZF70HO3TdzQUUJvA_5YE0pWSd';

async function fetchCommunityRating(albumId: string): Promise<{ avg: number; count: number }> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ratings?album_id=eq.${encodeURIComponent(albumId)}&select=rating`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) return { avg: 0, count: 0 };
  const rows: { rating: number }[] = await res.json();
  if (!rows.length) return { avg: 0, count: 0 };
  const total = rows.reduce((sum, r) => sum + Number(r.rating), 0);
  const avg = Math.round((total / rows.length) * 2) / 2;
  return { avg, count: rows.length };
}

async function submitCommunityRating(albumId: string, rating: number): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/ratings`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ album_id: albumId, rating }),
  });
  return res.ok || res.status === 201;
}

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
};

function getRatingColor(rating: number): string {
  if (rating === 0) return RATING_COLORS['0'];
  const key = (Math.round(rating * 2) / 2).toFixed(1).replace(/\.0$/, '');
  return RATING_COLORS[key] ?? '#00f5ff';
}

function isRainbow(rating: number) {
  return rating === 5;
}

// ── Voted state (localStorage tracks if browser voted — actual data is in Supabase) ──

function hasVoted(id: string) {
  return !!localStorage.getItem(`voted_${id}`);
}

function markVoted(id: string) {
  localStorage.setItem(`voted_${id}`, '1');
}

// ── Star SVG ──────────────────────────────────────────────────────────────────

function StarSVG({
  fill, size, color, rainbow, gradId,
}: {
  fill: 'full' | 'half' | 'empty';
  size: number;
  color: string;
  rainbow: boolean;
  gradId: string;
}) {
  const halfId = `half_${gradId}`;
  const rainbowId = `rainbow_${gradId}`;

  let starFill: string;
  if (fill === 'empty') starFill = 'var(--star-empty)';
  else if (fill === 'half') starFill = `url(#${halfId})`;
  else if (rainbow) starFill = `url(#${rainbowId})`;
  else starFill = color;

  const strokeColor = fill !== 'empty'
    ? (rainbow ? `url(#${rainbowId})` : color)
    : 'var(--star-empty)';

  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
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
  );
}

// ── Static stars ──────────────────────────────────────────────────────────────

function StaticStars({ value, size = 20 }: { value: number; size?: number }) {
  const color = getRatingColor(value);
  const rainbow = isRainbow(value);
  return (
    <span className={`stars-row${rainbow ? ' stars-rainbow' : ''}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="star-wrap">
          <StarSVG
            size={size}
            fill={value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty'}
            color={color} rainbow={rainbow}
            gradId={`static_${value}_${i}`}
          />
        </span>
      ))}
    </span>
  );
}

// ── Interactive stars ─────────────────────────────────────────────────────────

function InteractiveStars({ value, onChange, size = 28 }: {
  value: number; onChange: (v: number) => void; size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered > 0 ? hovered : value;
  const color = getRatingColor(active);
  const rainbow = isRainbow(active);

  function handleMouseMove(e: React.MouseEvent<HTMLSpanElement>, index: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered(e.clientX - rect.left < rect.width / 2 ? index - 0.5 : index);
  }

  function handleClick(e: React.MouseEvent<HTMLSpanElement>, index: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    onChange(e.clientX - rect.left < rect.width / 2 ? index - 0.5 : index);
  }

  return (
    <span className={`stars-row${rainbow ? ' stars-rainbow' : ''}`} onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = active >= i ? 'full' : active >= i - 0.5 ? 'half' : 'empty';
        return (
          <span key={i} className="star-wrap star-interactive"
            onMouseMove={e => handleMouseMove(e, i)}
            onClick={e => handleClick(e, i)}
          >
            <StarSVG size={size} fill={fill} color={color}
              rainbow={rainbow && fill !== 'empty'}
              gradId={`inter_${i}_${active}`}
            />
          </span>
        );
      })}
    </span>
  );
}

// ── Track Rating ──────────────────────────────────────────────────────────────

export function TrackRating({ trackId, trackName, artistRating, size = 'sm' }: {
  trackId: string; trackName: string; artistRating: number; size?: 'sm' | 'md';
}) {
  const starSize = size === 'sm' ? 18 : 22;
  const color = getRatingColor(artistRating);
  const rainbow = isRainbow(artistRating);

  return (
    <div className={`track-rating track-rating--${size}`}
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
  );
}

// ── Album Rating ──────────────────────────────────────────────────────────────

export function AlbumRating({ albumId, albumName, artistRating, showCommunity = true }: {
  albumId: string; albumName: string; artistRating: number; showCommunity?: boolean;
}) {
  const [community, setCommunity] = useState({ avg: 0, count: 0 });
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [voted, setVoted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setVoted(hasVoted(albumId));
    if (showCommunity) {
      fetchCommunityRating(albumId)
        .then(data => { setCommunity(data); setLoadingCommunity(false); })
        .catch(() => setLoadingCommunity(false));
    }
  }, [albumId, showCommunity]);

  async function handleSubmit() {
    if (!userRating || voted || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await submitCommunityRating(albumId, userRating);
    if (ok) {
      markVoted(albumId);
      setVoted(true);
      setSubmitted(true);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
      const updated = await fetchCommunityRating(albumId);
      setCommunity(updated);
    } else {
      setError('Something went wrong — try again.');
    }
    setSubmitting(false);
  }

  const adrianColor = getRatingColor(artistRating);
  const adrianRainbow = isRainbow(artistRating);
  const communityColor = community.count > 0 ? getRatingColor(community.avg) : '#555';
  const communityRainbow = community.count > 0 && isRainbow(community.avg);
  const userColor = getRatingColor(userRating);
  const userRainbow = isRainbow(userRating);

  return (
    <div className="album-rating">
      <div className="album-rating__scoreboard">

        {/* Adrian's score */}
        <div className="score-card" style={{ '--card-glow': adrianColor + '22' } as React.CSSProperties}>
          <div className="score-card__label">
            <span className="score-card__dot" style={{ background: adrianColor, boxShadow: `0 0 6px ${adrianColor}` }} />
            Adrian's Rating
          </div>
          <div
            className={`score-card__big${adrianRainbow ? ' score-card__big--rainbow' : ''}`}
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
            className={`score-card${pulse ? ' score-card--pulse' : ''}`}
            style={{ '--card-glow': communityColor + '22' } as React.CSSProperties}
          >
            <div className="score-card__label">
              <span className="score-card__dot" style={{ background: communityColor, boxShadow: `0 0 6px ${communityColor}` }} />
              Community Rating
            </div>
            <div
              className={`score-card__big${communityRainbow ? ' score-card__big--rainbow' : ''}`}
              style={{ color: communityRainbow ? undefined : communityColor, textShadow: communityRainbow ? undefined : `0 0 30px ${communityColor}66` }}
            >
              {loadingCommunity ? '…' : community.count > 0 ? community.avg.toFixed(1) : '—'}
            </div>
            <StaticStars value={community.avg} size={28} />
            <div className="score-card__sub">
              {loadingCommunity ? 'loading...' : community.count > 0
                ? `${community.count} rating${community.count !== 1 ? 's' : ''}`
                : 'no ratings yet'}
            </div>
          </div>
        )}
      </div>

      {/* Voting input */}
      {showCommunity && (
        <div className="album-rating__input">
          {voted ? (
            <p className="album-rating__thanks">
              {submitted ? '✦ Thanks for rating!' : '✦ You already rated this one.'}
              {community.count > 0 && (
                <span> Community avg: <strong style={{ color: communityColor }}>{community.avg.toFixed(1)}</strong></span>
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
              {error && (
                <p style={{ color: '#e63333', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem' }}>{error}</p>
              )}
              <button
                className="album-rating__submit"
                onClick={handleSubmit}
                disabled={!userRating || submitting}
                style={userRating ? { borderColor: userColor + '99', color: userColor, background: userColor + '1a' } : {}}
              >
                {submitting ? 'Submitting…' : 'Submit Rating'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AlbumRating;
