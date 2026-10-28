import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAlbum, getDeezerPreview, SpotifyAlbum } from '../../lib/spotify'
import { ReviewIndex } from '../../hooks/useReviewIndex'
import TrackPlayer from '../TrackPlayer'
import ScorePill from './ScorePill'

const fmtDuration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

const TYPE_LABEL: Record<string, string> = { album: 'Album', single: 'Single', compilation: 'Compilation' }

// Any Spotify album, reviewed or not: header, scores and a tracklist where every
// song gets the same Deezer preview player as a review page.
export default function AlbumView({ albumId, index, onOpenArtist, onClose }: {
  albumId: string
  index: ReviewIndex
  onOpenArtist: (artist: { id: string; name: string }) => void
  onClose: () => void
}) {
  const [album, setAlbum] = useState<SpotifyAlbum | null | undefined>(undefined)
  // undefined = still looking, null = no preview on Deezer
  const [previews, setPreviews] = useState<Record<string, string | null>>({})

  useEffect(() => {
    let live = true
    setAlbum(undefined)
    setPreviews({})
    getAlbum(albumId).then(async a => {
      if (!live) return
      setAlbum(a)
      if (!a) return
      const artistName = a.artists[0]?.name ?? ''
      // One at a time (Deezer rate limits), filling rows in as they arrive
      for (const t of a.tracks.items) {
        const url = await getDeezerPreview(t.name, artistName)
        if (!live) return
        setPreviews(p => ({ ...p, [t.id]: url }))
        await new Promise(r => setTimeout(r, 80))
      }
    })
    return () => { live = false }
  }, [albumId])

  if (album === undefined) return <div className="no-posts"><p>Loading album…</p></div>
  if (album === null) return <div className="no-posts"><p>Couldn't load this album from Spotify.</p></div>

  const artistNames = album.artists.map(a => a.name)
  const scores = index.albumScores(album.id, album.name, artistNames)
  const tracks = album.tracks.items
  const discs = new Set(tracks.map(t => t.disc_number ?? 1)).size > 1
  const runtime = tracks.reduce((s, t) => s + (t.duration_ms ?? 0), 0)
  const type = album.album_type === 'single' && (album.total_tracks ?? tracks.length) >= 4 ? 'EP' : TYPE_LABEL[album.album_type ?? ''] ?? 'Album'
  const cover = album.images.find(i => i.width >= 300)?.url ?? album.images[0]?.url ?? ''

  return (
    <div className="artist-profile album-view">
      <button type="button" className="artist-profile__close" onClick={onClose} aria-label="Close album">×</button>

      <div className="artist-profile__head">
        <div className="album-view__cover">
          {cover ? <img src={cover} alt={album.name} /> : <span>{album.name[0]}</span>}
        </div>
        <div className="artist-profile__meta">
          <span className="album-view__type">{type} · {album.release_date?.slice(0, 4)}</span>
          <h2 className="artist-profile__name">{album.name}</h2>
          <p className="album-view__artists">
            {album.artists.map((a, i) => (
              <React.Fragment key={a.id ?? a.name}>
                {i > 0 && ', '}
                {a.id ? <button type="button" className="album-view__artist" onClick={() => onOpenArtist({ id: a.id!, name: a.name })}>{a.name}</button> : a.name}
              </React.Fragment>
            ))}
          </p>
          <p className="artist-profile__genres">
            {tracks.length} song{tracks.length === 1 ? '' : 's'} · {Math.round(runtime / 60000)} min{album.label ? ` · ${album.label}` : ''}
          </p>
          <div className="artist-profile__scores">
            <ScorePill label="Audience" value={scores.audience} />
            <ScorePill label="Adrian" value={scores.mine} />
          </div>
          <div className="artist-profile__actions">
            {scores.slug && <Link className="track-btn" to={`/posts/${scores.slug}`}>Read the review</Link>}
            {album.external_urls?.spotify && <a className="artist-profile__spotify" href={album.external_urls.spotify} target="_blank" rel="noopener noreferrer">Spotify ↗</a>}
          </div>
        </div>
      </div>

      <div className="artist-profile__section-title">Tracklist</div>
      <div className="album-view__tracks">
        {tracks.map((t, i) => {
          const preview = previews[t.id]
          const mine = scores.slug ? index.trackScores(t.name, album.id, album.name, artistNames).mine : null
          const features = (t.artists ?? []).filter(a => !artistNames.includes(a.name)).map(a => a.name)
          const newDisc = discs && (i === 0 || (tracks[i - 1].disc_number ?? 1) !== (t.disc_number ?? 1))
          return (
            <React.Fragment key={t.id}>
              {newDisc && <div className="music-search__group-label">Disc {t.disc_number ?? 1}</div>}
              <div className="track-rating-row album-view__track">
                <TrackPlayer
                  previewUrl={preview ?? ''}
                  trackName={t.name}
                  rating={mine ?? 0}
                  loading={preview === undefined}
                  unavailable={preview === null}
                />
                <span className="album-view__num">{t.track_number}</span>
                <div className="album-view__info">
                  <span className="album-view__name">
                    {t.name}
                    {t.explicit && <span className="album-view__explicit" title="Explicit">E</span>}
                  </span>
                  {features.length > 0 && <span className="album-view__feat">with {features.join(', ')}</span>}
                </div>
                {scores.slug && <ScorePill label="ADR" value={mine} />}
                <span className="album-view__time">{fmtDuration(t.duration_ms)}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      {(album.total_tracks ?? 0) > tracks.length && (
        <p className="artist-profile__empty">Showing the first {tracks.length} of {album.total_tracks} songs.</p>
      )}
    </div>
  )
}
