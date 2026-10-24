import React, { useEffect, useMemo, useState } from 'react'
import { getSimilarArtists, SearchArtist, SimilarArtist } from '../../lib/spotify'
import { useTrackedArtists } from '../../lib/trackedArtists'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import ScorePill from './ScorePill'
import { TrackButton } from './ArtistProfile'

const MAX_SEEDS = 8
const FAVOURITE = 8   // Adrian's albums rated this or higher count as "taste"

// Discovery: artists similar to the ones you track plus Adrian's favourites,
// or to the artist whose page you're on.
export default function SuggestedArtists({ index, seedArtist, onOpenArtist }: {
  index: ReviewIndex
  seedArtist: SearchArtist | null
  onOpenArtist: (artist: SearchArtist) => void
}) {
  const { artists: tracked } = useTrackedArtists()
  const [results, setResults] = useState<SimilarArtist[] | null>(null)

  const seeds = useMemo(() => {
    if (seedArtist) return [{ id: seedArtist.id, name: seedArtist.name }]
    const list = [
      ...tracked.slice(0, 6).map(t => ({ id: t.artist_id, name: t.artist_name })),
      ...index.reviewedArtists.filter(a => (a.scores.mine ?? 0) >= FAVOURITE).map(a => ({ id: a.id, name: a.name })),
    ]
    return list.filter((s, i) => list.findIndex(x => x.id === s.id) === i).slice(0, MAX_SEEDS)
  }, [seedArtist, tracked, index.reviewedArtists])

  // Fetch once per page (artist) so tracking a suggestion doesn't reshuffle the
  // list; Refresh re-reads your tracked artists and asks again
  const [frozen, setFrozen] = useState<{ for: string; seeds: typeof seeds; round: number } | null>(null)
  const [shown, setShown] = useState<string[]>([])
  const pageKey = seedArtist?.id ?? 'taste'
  useEffect(() => {
    if (frozen?.for === pageKey || !seeds.length || (!seedArtist && index.loading)) return
    setShown([])
    setFrozen({ for: pageKey, seeds, round: 0 })
  }, [pageKey, seeds, seedArtist, index.loading, frozen])

  useEffect(() => {
    if (!frozen || frozen.for !== pageKey) return
    let live = true
    const trackedIds = tracked.map(t => t.artist_id)
    const fresh = frozen.round > 0
    setResults(null)
    // A refresh skips what you've already been shown, unless that leaves nothing
    getSimilarArtists(frozen.seeds, fresh ? [...trackedIds, ...shown] : trackedIds, 12, fresh)
      .then(r => (fresh && !r.length ? getSimilarArtists(frozen.seeds, trackedIds, 12, true) : r))
      .then(r => {
        if (!live) return
        setResults(r)
        setShown(prev => [...new Set([...prev, ...r.map(a => a.id)])].slice(-200))
      })
    return () => { live = false }
  }, [frozen]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => setFrozen(f => ({ for: pageKey, seeds, round: (f?.round ?? 0) + 1 }))

  if (!seeds.length || (results !== null && results.length === 0)) return null

  return (
    <div className="suggested-artists">
      <div className="suggested-artists__head">
        <div className="artist-profile__section-title">{seedArtist ? `Similar to ${seedArtist.name}` : 'Discover artists'}</div>
        <button
          type="button"
          className={`suggested-refresh ${results === null ? 'suggested-refresh--spin' : ''}`}
          onClick={refresh}
          disabled={results === null}
          title="Get a new list based on the artists you track now"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
          </svg>
          Refresh
        </button>
      </div>
      {!seedArtist && <p className="suggested-artists__sub">Based on the artists you track and Adrian's favourites. Track a few, then hit Refresh for a new list.</p>}
      {results === null ? (
        <p className="artist-profile__empty">Finding artists…</p>
      ) : (
        <div className="tracked-grid">
          {results.map(a => {
            const scores = index.artistScores(a.id, a.name)
            return (
              <div
                key={a.id}
                className="tracked-card suggested-card"
                role="link"
                tabIndex={0}
                onClick={() => onOpenArtist(a)}
                onKeyDown={e => { if (e.key === 'Enter') onOpenArtist(a) }}
              >
                <div className="suggested-card__track"><TrackButton artist={a} compact /></div>
                <div className="tracked-card__img">
                  {a.image ? <img src={a.image} alt="" /> : <span>{a.name[0]}</span>}
                </div>
                <span className="tracked-card__name">{a.name}</span>
                {!seedArtist && a.because.length > 0 && (
                  <span className="suggested-card__because">Like {a.because.slice(0, 2).join(', ')}</span>
                )}
                <div className="music-search__scores">
                  <ScorePill label="AUD" value={scores.audience} />
                  <ScorePill label="ADR" value={scores.mine} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
