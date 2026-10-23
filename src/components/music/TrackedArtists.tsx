import React from 'react'
import { useTrackedArtists, TrackedArtist } from '../../lib/trackedArtists'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import { SearchArtist } from '../../lib/spotify'
import ScorePill from './ScorePill'

const toSearchArtist = (a: TrackedArtist): SearchArtist => ({
  id: a.artist_id, name: a.artist_name, image: a.artist_image, genres: [],
  url: `https://open.spotify.com/artist/${a.artist_id}`,
})

export default function TrackedArtists({ index, onOpenArtist, onFindArtists }: {
  index: ReviewIndex
  onOpenArtist: (artist: SearchArtist) => void
  onFindArtists: () => void
}) {
  const { artists, toggle } = useTrackedArtists()

  if (artists.length === 0) {
    return (
      <div className="no-posts tracked-empty">
        <p>You're not tracking any artists yet.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  return (
    <div className="tracked-grid">
      {artists.map(a => {
        const scores = index.artistScores(a.artist_id, a.artist_name)
        return (
          <div key={a.artist_id} className="tracked-card" onClick={() => onOpenArtist(toSearchArtist(a))}>
            <div className="tracked-card__img">
              {a.artist_image ? <img src={a.artist_image} alt={a.artist_name} /> : <span>{a.artist_name[0]}</span>}
            </div>
            <span className="tracked-card__name">{a.artist_name}</span>
            <div className="music-search__scores">
              <ScorePill label="AUD" value={scores.audience} />
              <ScorePill label="ADR" value={scores.mine} />
            </div>
            <button
              type="button"
              className="tracked-card__remove"
              onClick={e => { e.stopPropagation(); toggle(a) }}
            >Untrack</button>
          </div>
        )
      })}
    </div>
  )
}
