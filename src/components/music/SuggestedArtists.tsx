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
      ...tracked.slice(0, 5).map(t => ({ id: t.artist_id, name: t.artist_name })),
      ...index.reviewedArtists.filter(a => (a.scores.mine ?? 0) >= FAVOURITE).map(a => ({ id: a.id, name: a.name })),
    ]
    return list.filter((s, i) => list.findIndex(x => x.id === s.id) === i).slice(0, MAX_SEEDS)
  }, [seedArtist, tracked, index.reviewedArtists])

  // Fetch once per page (artist) so tracking a suggestion doesn't reshuffle the list
  const [frozen, setFrozen] = useState<{ for: string; seeds: typeof seeds } | null>(null)
  const pageKey = seedArtist?.id ?? 'taste'
  useEffect(() => {
    if (frozen?.for === pageKey || !seeds.length || (!seedArtist && index.loading)) return
    setFrozen({ for: pageKey, seeds })
  }, [pageKey, seeds, seedArtist, index.loading, frozen])

  useEffect(() => {
    if (!frozen || frozen.for !== pageKey) return
    let live = true
    setResults(null)
    getSimilarArtists(frozen.seeds, tracked.map(t => t.artist_id)).then(r => { if (live) setResults(r) })
    return () => { live = false }
  }, [frozen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!seeds.length || (results !== null && results.length === 0)) return null

  return (
    <div className="suggested-artists">
      <div className="artist-profile__section-title">{seedArtist ? `Similar to ${seedArtist.name}` : 'Discover artists'}</div>
      {!seedArtist && <p className="suggested-artists__sub">Based on the artists you track and Adrian's favourites.</p>}
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
