import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getArtistDiscography, ArtistRelease, SearchArtist } from '../../lib/spotify'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import ScorePill from './ScorePill'

type Filter = 'all' | 'album' | 'single' | 'compilation'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'album', label: 'Albums' },
  { id: 'single', label: 'Singles & EPs' },
  { id: 'compilation', label: 'Compilations' },
]
const TYPE_LABEL: Record<ArtistRelease['type'], string> = { album: 'Album', single: 'Single', ep: 'EP', compilation: 'Compilation' }
const PAGE = 18

// Everything the artist has put out on Spotify. Reviewed releases open the
// review; the rest open the album page with previews.
export default function ArtistDiscography({ artist, index }: { artist: SearchArtist; index: ReviewIndex }) {
  const [releases, setReleases] = useState<ArtistRelease[] | null | undefined>(undefined)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let live = true
    setReleases(undefined)
    setFilter('all')
    setShown(PAGE)
    getArtistDiscography(artist.id).then(r => { if (live) setReleases(r) })
    return () => { live = false }
  }, [artist.id])

  const list = useMemo(() => (releases ?? []).filter(r =>
    filter === 'all' || r.type === filter || (filter === 'single' && r.type === 'ep')), [releases, filter])
  const present = useMemo(() => new Set((releases ?? []).map(r => (r.type === 'ep' ? 'single' : r.type))), [releases])

  return (
    <>
      <div className="artist-profile__section-title">Discography</div>
      {releases === undefined ? (
        <p className="artist-profile__empty">Loading releases…</p>
      ) : !releases || releases.length === 0 ? (
        <p className="artist-profile__empty">Couldn't find {artist.name}'s releases on Spotify.</p>
      ) : (
        <>
          {present.size > 1 && (
            <div className="tracked-sort">
              {FILTERS.filter(f => f.id === 'all' || present.has(f.id)).map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`music-filter-btn ${filter === f.id ? 'active' : ''}`}
                  aria-pressed={filter === f.id}
                  onClick={() => { setFilter(f.id); setShown(PAGE) }}
                >{f.label}</button>
              ))}
            </div>
          )}
          <div className="disco-grid">
            {list.slice(0, shown).map(r => {
              const scores = index.albumScores(r.id, r.name, [artist.name])
              return (
                <Link
                  key={r.id}
                  className="disco-card"
                  to={scores.slug ? `/posts/${scores.slug}` : `/music/album/${r.id}`}
                  state={scores.slug ? { from: `/music/artist/${artist.id}` } : undefined}
                >
                  <div className="disco-card__cover">
                    {r.image ? <img src={r.image} alt="" loading="lazy" /> : <span>{r.name[0]}</span>}
                    {scores.slug && <span className="disco-card__reviewed">Reviewed</span>}
                  </div>
                  <span className="disco-card__title">{r.name}</span>
                  <span className="disco-card__meta">{r.year} · {TYPE_LABEL[r.type]}</span>
                  {scores.slug && (
                    <div className="music-search__scores">
                      <ScorePill label="AUD" value={scores.audience} />
                      <ScorePill label="ADR" value={scores.mine} />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
          {list.length > shown && (
            <button type="button" className="music-filter-btn disco-more" onClick={() => setShown(s => s + PAGE)}>
              Show more ({list.length - shown})
            </button>
          )}
        </>
      )}
    </>
  )
}
