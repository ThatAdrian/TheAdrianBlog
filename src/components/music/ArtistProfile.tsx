import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SearchArtist } from '../../lib/spotify'
import { ratingColor, formatRating } from '../../lib/ratings'
import { useTrackedArtists } from '../../lib/trackedArtists'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import ScorePill from './ScorePill'
import ReleaseRow from './ReleaseRow'
import { fetchReleases, Release, todayISO, RELEASES_EVENT } from '../../lib/releases'

export function TrackButton({ artist, compact = false }: { artist: SearchArtist; compact?: boolean }) {
  const { isTracked, toggle } = useTrackedArtists()
  const tracked = isTracked(artist.id)
  return (
    <button
      type="button"
      className={`track-btn ${tracked ? 'track-btn--on' : ''} ${compact ? 'track-btn--compact' : ''}`}
      aria-pressed={tracked}
      title={tracked ? `Stop tracking ${artist.name}` : `Track ${artist.name}`}
      onMouseDown={e => e.preventDefault()}
      onClick={e => {
        e.stopPropagation()
        toggle({ artist_id: artist.id, artist_name: artist.name, artist_image: artist.image })
      }}
    >
      {tracked ? '✓' : '+'}{!compact && <span>{tracked ? ' Tracking' : ' Track artist'}</span>}
    </button>
  )
}

export default function ArtistProfile({ artist, index, onClose }: { artist: SearchArtist; index: ReviewIndex; onClose: () => void }) {
  const { artistScores, artistReviews } = index
  const scores = artistScores(artist.id, artist.name)
  const reviews = artistReviews(artist.id, artist.name)
  const [releases, setReleases] = useState<Release[] | null>(null)

  useEffect(() => {
    let live = true
    const load = () => fetchReleases([artist.id]).then(r => { if (live) setReleases(r) })
    setReleases(null)
    load()
    window.addEventListener(RELEASES_EVENT, load)
    return () => { live = false; window.removeEventListener(RELEASES_EVENT, load) }
  }, [artist.id])

  const today = todayISO()
  const upcoming = (releases ?? []).filter(r => r.release_date >= today)
  const recent = (releases ?? []).filter(r => r.release_date < today).reverse()

  return (
    <div className="artist-profile">
      <button type="button" className="artist-profile__close" onClick={onClose} aria-label="Close artist">×</button>

      <div className="artist-profile__head">
        <div className="artist-profile__img">
          {artist.image ? <img src={artist.image} alt={artist.name} /> : <span>{artist.name[0]}</span>}
        </div>
        <div className="artist-profile__meta">
          <h2 className="artist-profile__name">{artist.name}</h2>
          {artist.genres.length > 0 && <p className="artist-profile__genres">{artist.genres.slice(0, 3).join(' · ')}</p>}
          <div className="artist-profile__scores">
            <ScorePill label="Audience" value={scores.audience} />
            <ScorePill label="Adrian" value={scores.mine} />
          </div>
          <div className="artist-profile__actions">
            <TrackButton artist={artist} />
            {artist.url && <a className="artist-profile__spotify" href={artist.url} target="_blank" rel="noopener noreferrer">Spotify ↗</a>}
          </div>
        </div>
      </div>

      <div className="artist-profile__section-title">Reviewed albums</div>
      {reviews.length === 0 ? (
        <p className="artist-profile__empty">No albums from {artist.name} reviewed yet.</p>
      ) : (
        <div className="top-albums-list">
          {reviews.map(r => {
            const color = r.myRating ? ratingColor(r.myRating) : undefined
            return (
              <Link key={r.slug} to={`/posts/${r.slug}`} className="top-album-row">
                <div className="top-album-img">
                  <img src={`/${r.image}`} alt={r.title}
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png' }} />
                </div>
                <span className="top-album-title">{r.title}</span>
                <span className="top-album-score" style={{ color }}>
                  {r.myRating ? `${formatRating(r.myRating)}/10` : '—'}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <div className="artist-profile__section-title">Upcoming</div>
      {releases === null ? (
        <p className="artist-profile__empty">Loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="artist-profile__empty">Nothing announced yet. Track {artist.name} to get notified when they announce something.</p>
      ) : (
        <div className="release-list">
          {upcoming.map(r => <ReleaseRow key={r.release_key} release={r} showArtist={false} tag={{ label: 'Upcoming', tone: 'upcoming' }} />)}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <div className="artist-profile__section-title">Recent releases</div>
          <div className="release-list">
            {recent.map(r => <ReleaseRow key={r.release_key} release={r} showArtist={false} />)}
          </div>
        </>
      )}
    </div>
  )
}
