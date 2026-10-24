import React, { useEffect, useMemo, useState } from 'react'
import { getArtistsCached, SearchArtist } from '../../lib/spotify'
import { useTrackedArtists } from '../../lib/trackedArtists'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import ScorePill from './ScorePill'
import { TrackButton } from './ArtistProfile'

const LIMIT = 8

// Artists from Adrian's reviews that the visitor isn't tracking yet, best-rated first.
// (Spotify's related-artists endpoint is closed to new apps, so reviews are the source.)
export default function SuggestedArtists({ index, onOpenArtist }: {
  index: ReviewIndex
  onOpenArtist: (artist: SearchArtist) => void
}) {
  const { isTracked } = useTrackedArtists()
  const [details, setDetails] = useState<Record<string, SearchArtist>>({})

  // Keep a just-tracked artist on screen (it flips to ✓) until the next visit
  const [pool] = useState(() => new Set<string>())
  const picks = useMemo(() => {
    const list = index.reviewedArtists.filter(a => pool.has(a.id) || !isTracked(a.id)).slice(0, LIMIT)
    list.forEach(a => pool.add(a.id))
    return list
  }, [index.reviewedArtists, isTracked, pool])

  const ids = picks.map(a => a.id).join(',')
  useEffect(() => {
    if (!ids) return
    let live = true
    getArtistsCached(ids.split(',')).then(d => { if (live) setDetails(d) })
    return () => { live = false }
  }, [ids])

  if (!picks.length) return null

  return (
    <div className="suggested-artists">
      <div className="artist-profile__section-title">Suggested artists</div>
      <div className="tracked-grid">
        {picks.map(p => {
          const artist: SearchArtist = details[p.id] ?? {
            id: p.id, name: p.name, image: '', genres: [], url: `https://open.spotify.com/artist/${p.id}`,
          }
          return (
            <div
              key={p.id}
              className="tracked-card suggested-card"
              role="link"
              tabIndex={0}
              onClick={() => onOpenArtist(artist)}
              onKeyDown={e => { if (e.key === 'Enter') onOpenArtist(artist) }}
            >
              <div className="suggested-card__track"><TrackButton artist={artist} compact /></div>
              <div className="tracked-card__img">
                {artist.image ? <img src={artist.image} alt={artist.name} /> : <span>{artist.name[0]}</span>}
              </div>
              <span className="tracked-card__name">{artist.name}</span>
              <div className="music-search__scores">
                <ScorePill label="AUD" value={p.scores.audience} />
                <ScorePill label="ADR" value={p.scores.mine} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
