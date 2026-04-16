import React, { useState, useEffect } from 'react'
import './NowPlaying.css'

const LASTFM_KEY  = 'b25b959554ed76058ac220b7b2e0a026'
const LASTFM_USER = 'agamez123'

interface Track {
  name: string
  artist: string
  album: string
  image: string
  url: string
  nowPlaying: boolean
  date?: string
}

async function fetchTracks(): Promise<Track[]> {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${LASTFM_KEY}&format=json&limit=6`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  const items = data?.recenttracks?.track ?? []
  return items.map((t: any) => ({
    name: t.name,
    artist: t.artist['#text'],
    album: t.album['#text'],
    image: t.image?.find((i: any) => i.size === 'medium')?.['#text'] || '',
    url: t.url,
    nowPlaying: !!t['@attr']?.nowplaying,
    date: t.date?.['#text'],
  }))
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + ' UTC')
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NowPlaying() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTracks()
      .then(t => { setTracks(t); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })

    // Refresh every 30 seconds to catch now playing updates
    const interval = setInterval(() => {
      fetchTracks().then(setTracks).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="np-wrap">
      <div className="np-header">
        <span className="np-title">Listening</span>
      </div>
      <div className="np-loading">Loading...</div>
    </div>
  )

  if (error || tracks.length === 0) return null

  const nowPlaying = tracks.find(t => t.nowPlaying)
  const recent = tracks.filter(t => !t.nowPlaying).slice(0, 5)

  return (
    <div className="np-wrap">
      <div className="np-header">
        <span className="np-title">
          {nowPlaying ? (
            <><span className="np-dot" />Now Playing</>
          ) : 'Recently Listened'}
        </span>
        <a
          href={`https://www.last.fm/user/${LASTFM_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="np-lastfm-link"
        >
          Last.fm ↗
        </a>
      </div>

      {nowPlaying && (
        <a href={nowPlaying.url} target="_blank" rel="noopener noreferrer" className="np-current">
          {nowPlaying.image && (
            <img src={nowPlaying.image} alt={nowPlaying.album} className="np-current-art" />
          )}
          <div className="np-current-info">
            <span className="np-current-track">{nowPlaying.name}</span>
            <span className="np-current-artist">{nowPlaying.artist}</span>
            <span className="np-current-album">{nowPlaying.album}</span>
          </div>
          <div className="np-bars">
            <span /><span /><span /><span />
          </div>
        </a>
      )}

      <div className="np-recent">
        {(nowPlaying ? recent : tracks.slice(0, 5)).map((t, i) => (
          <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="np-track">
            {t.image && <img src={t.image} alt={t.album} className="np-track-art" />}
            <div className="np-track-info">
              <span className="np-track-name">{t.name}</span>
              <span className="np-track-artist">{t.artist}</span>
            </div>
            {t.date && <span className="np-track-time">{timeAgo(t.date)}</span>}
          </a>
        ))}
      </div>
    </div>
  )
}
