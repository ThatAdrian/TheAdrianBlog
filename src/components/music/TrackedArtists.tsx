import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrackedArtists, TrackedArtist } from '../../lib/trackedArtists'
import { useAuth, loginHref } from '../../lib/auth'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import { SearchArtist } from '../../lib/spotify'
import ScorePill from './ScorePill'

const toSearchArtist = (a: TrackedArtist): SearchArtist => ({
  id: a.artist_id, name: a.artist_name, image: a.artist_image, genres: [],
  url: `https://open.spotify.com/artist/${a.artist_id}`,
})

type SortId = 'recent' | 'oldest' | 'name' | 'adrian' | 'audience'
const SORTS: { id: SortId; label: string }[] = [
  { id: 'recent', label: 'Recently added' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'A–Z' },
  { id: 'adrian', label: "Adrian's score" },
  { id: 'audience', label: 'Audience score' },
]
const SORT_KEY = 'tab_tracked_sort'

function readSort(): SortId {
  try {
    const v = localStorage.getItem(SORT_KEY)
    return SORTS.some(s => s.id === v) ? v as SortId : 'recent'
  } catch { return 'recent' }
}

export default function TrackedArtists({ index, onOpenArtist, onFindArtists }: {
  index: ReviewIndex
  onOpenArtist: (artist: SearchArtist) => void
  onFindArtists: () => void
}) {
  const { artists, toggle } = useTrackedArtists()
  const { ready, user } = useAuth()
  const [sort, setSortState] = useState<SortId>(readSort)
  const setSort = (id: SortId) => {
    setSortState(id)
    try { localStorage.setItem(SORT_KEY, id) } catch { /* ignore */ }
  }

  // Unscored artists always sink to the bottom of the score sorts
  const sorted = useMemo(() => {
    const rows = artists.map(a => ({ a, scores: index.artistScores(a.artist_id, a.artist_name) }))
    const added = (x: TrackedArtist) => x.created_at ?? ''
    const byScore = (v: number | null) => v ?? -1
    return rows.sort((x, y) => {
      switch (sort) {
        case 'oldest': return added(x.a).localeCompare(added(y.a))
        case 'name': return x.a.artist_name.localeCompare(y.a.artist_name, undefined, { sensitivity: 'base' })
        case 'adrian': return byScore(y.scores.mine) - byScore(x.scores.mine) || x.a.artist_name.localeCompare(y.a.artist_name)
        case 'audience': return byScore(y.scores.audience) - byScore(x.scores.audience) || x.a.artist_name.localeCompare(y.a.artist_name)
        default: return added(y.a).localeCompare(added(x.a))
      }
    })
  }, [artists, index, sort])

  // Tracking needs an account (synced across devices)
  const signInBanner = ready && !user && (
    <div className="tracked-signin">
      <p>
        {artists.length
          ? 'These are the artists you tracked on this device. Log in or create an account to keep them, and they’ll move into your account and sync to all your devices.'
          : 'Create a free account to track artists and get their new releases and concerts on every device.'}
      </p>
      <div className="tracked-signin__actions">
        <Link className="music-filter-btn active" to={loginHref('/music?tab=tracked', 'register')}>Create account</Link>
        <Link className="music-filter-btn" to={loginHref('/music?tab=tracked')}>Log in</Link>
      </div>
    </div>
  )

  if (artists.length === 0) {
    if (signInBanner) return signInBanner
    return (
      <div className="no-posts tracked-empty">
        <p>You're not tracking any artists yet.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  return (
    <>
      {signInBanner}
      <div className="tracked-sort" role="group" aria-label="Sort tracked artists">
        <span className="tracked-sort__label">Sort</span>
        {SORTS.map(o => (
          <button
            key={o.id}
            type="button"
            className={`music-filter-btn ${sort === o.id ? 'active' : ''}`}
            aria-pressed={sort === o.id}
            onClick={() => setSort(o.id)}
          >{o.label}</button>
        ))}
      </div>
      <div className="tracked-grid">
        {sorted.map(({ a, scores }) => {
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
    </>
  )
}
