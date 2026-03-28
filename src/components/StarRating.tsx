'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './StarRating.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StarProps {
  index: number;          // 1-5
  value: number;          // current rating value
  hovered: number;        // current hover value
  onHover: (v: number) => void;
  onClick: (v: number) => void;
  size?: number;
  readonly?: boolean;
}

interface TrackRatingProps {
  trackId: string;
  trackName: string;
  artistRating: number;   // 0.5–5 in 0.5 steps, set by you
  size?: 'sm' | 'md';
}

interface AlbumRatingProps {
  albumId: string;
  albumName: string;
  artistRating: number;
  showCommunity?: boolean;
}

// ── Storage helpers ────────────────────────────────────────────────────────────

function getStorageKey(id: string) {
  return `rating_${id}`;
}

function loadRatings(id: string): { total: number; count: number } {
  try {
    const raw = localStorage.getItem(getStorageKey(id));
    return raw ? JSON.parse(raw) : { total: 0, count: 0 };
  } catch {
    return { total: 0, count: 0 };
  }
}

function saveRating(id: string, value: number) {
  const existing = loadRatings(id);
  const updated = { total: existing.total + value, count: existing.count + 1 };
  localStorage.setItem(getStorageKey(id), JSON.stringify(updated));
  return updated;
}

function hasVoted(id: string): boolean {
  return !!localStorage.getItem(`voted_${id}`);
}

function markVoted(id: string) {
  localStorage.setItem(`voted_${id}`, '1');
}

// ── Star SVG ──────────────────────────────────────────────────────────────────

function StarSVG({ fill, size }: { fill: 'full' | 'half' | 'empty'; size: number }) {
  const id = `half_${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="star-svg"
    >
      {fill === 'half' && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="var(--star-active)" />
            <stop offset="50%" stopColor="var(--star-empty)" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={
          fill === 'full'
            ? 'var(--star-active)'
            : fill === 'half'
            ? `url(#${id})`
            : 'var(--star-empty)'
        }
        stroke={fill !== 'empty' ? 'var(--star-active)' : 'var(--star-empty)'}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Single interactive star (left = 0.5, right = 1.0) ────────────────────────

function Star({ index, value, hovered, onHover, onClick, size = 28, readonly = false }: StarProps) {
  const active = hovered > 0 ? hovered : value;

  const fill =
    active >= index
      ? 'full'
      : active >= index - 0.5
      ? 'half'
      : 'empty';

  function handleMouseMove(e: React.MouseEvent<HTMLSpanElement>) {
    if (readonly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    onHover(isLeft ? index - 0.5 : index);
  }

  function handleClick(e: React.MouseEvent<HTMLSpanElement>) {
    if (readonly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    onClick(isLeft ? index - 0.5 : index);
  }

  return (
    <span
      className={`star-wrap ${readonly ? '' : 'star-interactive'}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !readonly && onHover(0)}
      onClick={handleClick}
      aria-label={`${index} stars`}
    >
      <StarSVG fill={fill} size={size} />
    </span>
  );
}

// ── Static star row (display only) ───────────────────────────────────────────

function StaticStars({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <span className="stars-row">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="star-wrap">
          <StarSVG
            size={size}
            fill={value >= i ? 'full' : value >= i - 0.5 ? 'half' : 'empty'}
          />
        </span>
      ))}
    </span>
  );
}

// ── Interactive star row ──────────────────────────────────────────────────────

function InteractiveStars({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <span
      className="stars-row"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          index={i}
          value={value}
          hovered={hovered}
          onHover={setHovered}
          onClick={onChange}
          size={size}
        />
      ))}
    </span>
  );
}

// ── Track Rating (small, inline next to a song) ───────────────────────────────

export function TrackRating({ trackId, trackName, artistRating, size = 'sm' }: TrackRatingProps) {
  const starSize = size === 'sm' ? 18 : 22;

  return (
    <div className={`track-rating track-rating--${size}`}>
      <span className="track-rating__name">{trackName}</span>
      <span className="track-rating__stars">
        <StaticStars value={artistRating} size={starSize} />
        <span className="track-rating__value">{artistRating.toFixed(1)}</span>
      </span>
    </div>
  );
}

// ── Album / Review Rating (large, top of page) ────────────────────────────────

export function AlbumRating({ albumId, albumName, artistRating, showCommunity = true }: AlbumRatingProps) {
  const [communityData, setCommunityData] = useState({ total: 0, count: 0 });
  const [userRating, setUserRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [voted, setVoted] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setCommunityData(loadRatings(albumId));
    setVoted(hasVoted(albumId));
  }, [albumId]);

  const communityAvg =
    communityData.count > 0
      ? Math.round((communityData.total / communityData.count) * 2) / 2
      : 0;

  function handleSubmit() {
    if (!userRating || voted) return;
    const updated = saveRating(albumId, userRating);
    markVoted(albumId);
    setCommunityData(updated);
    setVoted(true);
    setSubmitted(true);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  }

  return (
    <div className="album-rating">
      {/* ── Side-by-side score cards ── */}
      <div className="album-rating__scoreboard">

        {/* Adrian's score */}
        <div className="score-card score-card--adrian">
          <div className="score-card__label">
            <span className="score-card__dot score-card__dot--cyan" />
            Adrian's Rating
          </div>
          <div className="score-card__big">{artistRating.toFixed(1)}</div>
          <StaticStars value={artistRating} size={28} />
          <div className="score-card__sub">out of 5</div>
        </div>

        <div className="score-card__divider" />

        {/* Community score */}
        {showCommunity && (
          <div className={`score-card score-card--community ${pulse ? 'score-card--pulse' : ''}`}>
            <div className="score-card__label">
              <span className="score-card__dot score-card__dot--purple" />
              Community Rating
            </div>
            <div className="score-card__big">
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

      {/* ── Community input ── */}
      {showCommunity && (
        <div className="album-rating__input">
          {voted ? (
            <p className="album-rating__thanks">
              {submitted ? '✦ Thanks for rating!' : '✦ You already rated this one.'}
              {communityData.count > 0 && (
                <span> Community avg: <strong>{communityAvg.toFixed(1)}</strong></span>
              )}
            </p>
          ) : (
            <>
              <p className="album-rating__prompt">Rate this yourself</p>
              <div className="album-rating__picker">
                <InteractiveStars value={userRating} onChange={setUserRating} size={32} />
                {userRating > 0 && (
                  <span className="album-rating__chosen">{userRating.toFixed(1)}</span>
                )}
              </div>
              <button
                className="album-rating__submit"
                onClick={handleSubmit}
                disabled={!userRating}
              >
                Submit Rating
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Default export (convenience) ──────────────────────────────────────────────

export default AlbumRating;
