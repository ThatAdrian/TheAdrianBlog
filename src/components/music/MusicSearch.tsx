import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchSpotify, SearchResults, SearchArtist } from '../../lib/spotify'
import { ReviewIndex, Scores } from '../../hooks/useReviewIndex'
import ScorePill from './ScorePill'
import ArtistProfile, { TrackButton } from './ArtistProfile'
import SuggestedArtists from './SuggestedArtists'

type Row =
  | { kind: 'artist'; key: string; title: string; sub: string; image: string; scores: Scores; artist: SearchArtist; url: string }
  | { kind: 'album' | 'track'; key: string; title: string; sub: string; image: string; scores: Scores; url: string }

const EMPTY: SearchResults = { artists: [], albums: [], tracks: [] }

export default function MusicSearch({ index, artist, onOpenArtist }: {
  index: ReviewIndex
  artist: SearchArtist | null
  onOpenArtist: (artist: SearchArtist | null) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults(EMPTY); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const id = ++requestRef.current
      setLoading(true)
      const r = await searchSpotify(q)
      if (id !== requestRef.current) return
      setResults(r)
      setOpen(true)
      setHighlighted(-1)
      setLoading(false)
    }, 300)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const groups: { label: string; rows: Row[] }[] = [
    {
      label: 'Artists',
      rows: results.artists.map(a => ({
        kind: 'artist' as const, key: `ar-${a.id}`, title: a.name,
        sub: a.genres.slice(0, 2).join(' · ') || 'Artist', image: a.image,
        scores: index.artistScores(a.id, a.name), artist: a, url: a.url,
      })),
    },
    {
      label: 'Albums',
      rows: results.albums.map(a => ({
        kind: 'album' as const, key: `al-${a.id}`, title: a.name,
        sub: [a.artists.map(x => x.name).join(', '), a.year].filter(Boolean).join(' · '), image: a.image,
        scores: index.albumScores(a.id, a.name, a.artists.map(x => x.name)), url: a.url,
      })),
    },
    {
      label: 'Songs',
      rows: results.tracks.map(t => ({
        kind: 'track' as const, key: `tr-${t.id}`, title: t.name,
        sub: `${t.artists.map(x => x.name).join(', ')} · ${t.albumName}`, image: t.image,
        scores: index.trackScores(t.name, t.albumId, t.albumName, t.artists.map(x => x.name)), url: t.url,
      })),
    },
  ].filter(g => g.rows.length > 0)

  const flat = groups.flatMap(g => g.rows)

  function choose(row: Row) {
    setOpen(false)
    if (row.kind === 'artist') {
      onOpenArtist(row.artist)
    } else if (row.scores.slug) {
      navigate(`/posts/${row.scores.slug}`, { state: { from: '/music?tab=search' } })
    } else if (row.url) {
      window.open(row.url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || !flat.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); choose(flat[highlighted]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="music-search">
      <div className="music-search__wrap" ref={wrapRef}>
        <div className="music-search__input-row">
          <svg className="music-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            className="music-search__input"
            type="text"
            placeholder="Search songs, artists, albums..."
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value) }}
            onFocus={() => flat.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="music-search__spinner" />}
        </div>

        {open && (
          <div className="music-search__dropdown">
            <div className="music-search__legend">
              <span>Audience</span><span>Adrian</span>
            </div>
            {flat.length === 0 && !loading && <div className="music-search__none">No results</div>}
            {groups.map(g => (
              <div key={g.label} className="music-search__group">
                <div className="music-search__group-label">{g.label}</div>
                {g.rows.map(row => {
                  const i = flat.indexOf(row)
                  return (
                    <div
                      key={row.key}
                      role="option"
                      aria-selected={i === highlighted}
                      className={`music-search__row ${i === highlighted ? 'music-search__row--hl' : ''}`}
                      onMouseDown={e => { e.preventDefault(); choose(row) }}
                      onMouseEnter={() => setHighlighted(i)}
                    >
                      <div className={`music-search__thumb ${row.kind === 'artist' ? 'music-search__thumb--round' : ''}`}>
                        {row.image ? <img src={row.image} alt="" /> : <span>{row.title[0]}</span>}
                      </div>
                      <div className="music-search__info">
                        <span className="music-search__title">{row.title}</span>
                        <span className="music-search__sub">{row.sub}</span>
                      </div>
                      {row.kind === 'artist' && <TrackButton artist={row.artist} compact />}
                      <div className="music-search__scores">
                        <ScorePill label="AUD" value={row.scores.audience} title={row.kind === 'track' && row.scores.audience === null ? 'Audience: songs are not rated by the community yet' : undefined} />
                        <ScorePill label="ADR" value={row.scores.mine} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {artist ? (
        <ArtistProfile artist={artist} index={index} onClose={() => onOpenArtist(null)} />
      ) : (
        <p className="music-search__hint">
          Every result shows the audience score next to Adrian's. Greyed-out dashes mean it hasn't been reviewed yet.
          Artist scores are the average of their reviewed albums.
        </p>
      )}

      <SuggestedArtists index={index} seedArtist={artist} onOpenArtist={onOpenArtist} />
    </div>
  )
}
