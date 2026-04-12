import React, { useState, useRef } from 'react'
import { getAlbum, parseSpotifyAlbumId } from '../lib/spotify'
import { commitFile, uploadImage, slugify } from './github'

interface Track { name: string; rating: number }

interface AlbumData {
  id: string
  name: string
  artist: string
  image: string
  tracks: Track[]
  releaseDate: string
}

const RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

export default function MusicReviewCreator() {
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [album, setAlbum] = useState<AlbumData | null>(null)
  const [loading, setLoading] = useState(false)
  const [albumRating, setAlbumRating] = useState(0)
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchAlbum() {
    if (!spotifyUrl.trim()) return
    setLoading(true)
    setError('')
    setAlbum(null)
    try {
      const id = parseSpotifyAlbumId(spotifyUrl)
      const data = await getAlbum(id)
      if (!data) { setError('Could not fetch album — check the URL.'); setLoading(false); return }
      setAlbum({
        id,
        name: data.name,
        artist: data.artists[0]?.name ?? '',
        image: data.images[0]?.url ?? '',
        releaseDate: data.release_date,
        tracks: data.tracks.items.map(t => ({ name: t.name, rating: 3 })),
      })
      setCoverPreview(data.images[0]?.url ?? '')
      setCoverFile(null)
      setPublished(false)
    } catch {
      setError('Failed to fetch album data.')
    }
    setLoading(false)
  }

  function updateRating(i: number, v: number) {
    if (!album) return
    const tracks = [...album.tracks]
    tracks[i] = { ...tracks[i], rating: v }
    setAlbum({ ...album, tracks })
  }

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function generateMarkdown(): string {
    if (!album) return ''
    const today = new Date()
    const date = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`
    const postSlug = slugify(`${album.name} ${album.artist} Review`)
    const tracklist = album.tracks.map(t => `${t.name}~${t.rating}`).join(' | ')
    return `---
date: ${date}
title: "${album.name} - ${album.artist} Review"
summary: '${summary || `${album.artist}'s ${album.name} reviewed`}'
categories:
  - Music Reviews
image: posts/${postSlug}.jpg
rating: ${albumRating}
draft: false
spotifyAlbum: "${spotifyUrl}"
tracklist: ${tracklist}
---

## The Sound

[Write your review here]

[TRACK_RATINGS]

## Standout Tracks

[List standout tracks]

## Verdict

[Your verdict]
`
  }

  async function publish() {
    if (!album) return
    if (albumRating === 0) { setError('Set an album rating before publishing.'); return }
    setPublishing(true)
    setError('')
    try {
      const postSlug = slugify(`${album.name} ${album.artist} Review`)

      if (coverFile) {
        const reader = new FileReader()
        const base64 = await new Promise<string>(res => {
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.readAsDataURL(coverFile)
        })
        await uploadImage(`public/posts/${postSlug}.jpg`, base64)
      }

      const ok = await commitFile(
        `content/posts/${postSlug}.md`,
        generateMarkdown(),
        `Add review: ${album.name} - ${album.artist}`
      )
      if (ok) setPublished(true)
      else setError('GitHub commit failed — check your token has repo write access.')
    } catch {
      setError('Publish failed.')
    }
    setPublishing(false)
  }

  return (
    <div className="db-section">
      <h2 className="db-section-title">Music Review</h2>

      <div className="db-card">
        <label className="db-label">Spotify Album URL</label>
        <div className="db-row">
          <input
            className="db-input"
            placeholder="https://open.spotify.com/album/..."
            value={spotifyUrl}
            onChange={e => setSpotifyUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchAlbum()}
          />
          <button className="db-btn db-btn--primary" onClick={fetchAlbum} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Album'}
          </button>
        </div>
        {error && <p className="db-error">{error}</p>}
      </div>

      {album && (
        <>
          <div className="db-card db-album-header">
            <div className="db-album-art-wrap">
              <img src={coverPreview || album.image} alt={album.name} className="db-album-art" />
              <button className="db-art-change" onClick={() => fileRef.current?.click()}>Change cover</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onCoverChange} style={{display:'none'}} />
            </div>
            <div className="db-album-meta">
              <p className="db-album-name">{album.name}</p>
              <p className="db-album-artist">{album.artist}</p>
              <p className="db-album-date">{album.releaseDate}</p>
              <div className="db-field">
                <label className="db-label">Your Album Rating</label>
                <div className="db-rating-row">
                  {RATINGS.map(v => (
                    <button key={v} className={`db-rating-pip ${albumRating === v ? 'active' : ''}`} onClick={() => setAlbumRating(v)}>{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="db-card">
            <label className="db-label">Track Ratings</label>
            <div className="db-tracks">
              {album.tracks.map((t, i) => (
                <div key={i} className="db-track-row">
                  <span className="db-track-num">{i + 1}</span>
                  <span className="db-track-name">{t.name}</span>
                  <div className="db-rating-row">
                    {RATINGS.map(v => (
                      <button key={v} className={`db-rating-pip ${t.rating === v ? 'active' : ''}`} onClick={() => updateRating(i, v)}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="db-card">
            <label className="db-label">Summary</label>
            <input className="db-input" value={summary} onChange={e => setSummary(e.target.value)}
              placeholder={`${album.artist}'s ${album.name} reviewed`} />
          </div>

          <div className="db-card">
            <label className="db-label">Review Content (Markdown — optional, you can edit on GitHub after)</label>
            <p className="db-hint">Use [TRACK_RATINGS] to position the track list</p>
            <textarea className="db-textarea db-textarea--tall" value={content} onChange={e => setContent(e.target.value)}
              placeholder={`## The Sound\n\n[Write your review here]\n\n[TRACK_RATINGS]\n\n## Standout Tracks\n\n## Verdict`} />
          </div>

          <div className="db-card">
            <label className="db-label">Generated Markdown</label>
            <pre className="db-preview">{generateMarkdown()}</pre>
          </div>

          <div className="db-publish-row">
            {published ? (
              <div className="db-success">✓ Published! GitHub Actions will deploy in ~1 minute.</div>
            ) : (
              <button className="db-btn db-btn--publish" onClick={publish} disabled={publishing || albumRating === 0}>
                {publishing ? 'Publishing...' : 'Publish Review'}
              </button>
            )}
            {error && <p className="db-error">{error}</p>}
          </div>
        </>
      )}
    </div>
  )
}
