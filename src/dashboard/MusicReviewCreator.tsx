import React, { useState, useRef } from 'react'
import { getAlbum, parseSpotifyAlbumId } from '../lib/spotify'
import { commitFile, uploadImage, slugify, listPostFiles, getFileContent } from './github'

interface Track { name: string; rating: number }

interface AlbumData {
  id: string
  name: string
  artist: string
  image: string
  tracks: Track[]
  releaseDate: string
}

interface PostEntry {
  filename: string
  path: string
  title: string
  isDraft: boolean
}

const RATINGS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    fm[key] = val
  })
  const trackMatch = match[1].match(/tracklist:\s*(.+)/)
  if (trackMatch) fm.tracklist = trackMatch[1].trim()
  return fm
}

function parseTracklist(raw: string): Track[] {
  if (!raw) return []
  return raw.split('|').map(entry => {
    const parts = entry.trim().split('~')
    return { name: parts[0]?.trim() ?? '', rating: parseFloat(parts[1]?.trim() ?? '3') }
  })
}

function extractSection(body: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n\\[TRACK_RATINGS\\]|$)`)
  const match = body.match(regex)
  return match ? match[1].trim() : ''
}

export default function MusicReviewCreator() {
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [album, setAlbum] = useState<AlbumData | null>(null)
  const [loading, setLoading] = useState(false)
  const [albumRating, setAlbumRating] = useState(0)
  const [summary, setSummary] = useState('')
  const [soundReview, setSoundReview] = useState('')
  const [standoutTracks, setStandoutTracks] = useState('')
  const [verdict, setVerdict] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [error, setError] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [editingPath, setEditingPath] = useState<string | null>(null)

  const [posts, setPosts] = useState<PostEntry[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsLoaded, setPostsLoaded] = useState(false)
  const [activePanel, setActivePanel] = useState<'drafts' | 'published' | null>(null)
  const [loadingPost, setLoadingPost] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  async function fetchPosts() {
    setPostsLoading(true)
    const files = await listPostFiles()
    const entries: PostEntry[] = []
    for (const f of files) {
      const raw = await getFileContent(f.path)
      if (!raw || !raw.includes('Music Reviews')) continue
      const fm = parseFrontmatter(raw)
      entries.push({
        filename: f.name,
        path: f.path,
        title: fm.title || f.name.replace('.md', ''),
        isDraft: fm.draft === 'true',
      })
    }
    setPosts(entries)
    setPostsLoaded(true)
    setPostsLoading(false)
  }

  function togglePanel(panel: 'drafts' | 'published') {
    if (activePanel === panel) { setActivePanel(null); return }
    setActivePanel(panel)
    if (!postsLoaded) fetchPosts()
  }

  async function loadPost(path: string) {
    setLoadingPost(path)
    setError('')
    const raw = await getFileContent(path)
    if (!raw) { setError('Could not load post from GitHub.'); setLoadingPost(null); return }
    const fm = parseFrontmatter(raw)
    const body = raw.replace(/^---[\s\S]*?---\n/, '').trim()
    const spotUrl = fm.spotifyAlbum || ''
    setSpotifyUrl(spotUrl)
    setAlbumRating(parseFloat(fm.rating || '0'))
    setSummary(fm.summary || '')
    setEditingPath(path)
    setPublished(false)
    setDraftSaved(false)
    setActivePanel(null)
    setSoundReview(extractSection(body, 'The Sound'))
    setStandoutTracks(extractSection(body, 'Standout Tracks'))
    setVerdict(extractSection(body, 'Verdict'))
    if (spotUrl) {
      setLoading(true)
      try {
        const id = parseSpotifyAlbumId(spotUrl)
        const data = await getAlbum(id)
        if (data) {
          const tracklist = parseTracklist(fm.tracklist || '')
          const tracks = data.tracks.items.map(t => {
            const saved = tracklist.find(tr => tr.name.toLowerCase() === t.name.toLowerCase())
            return { name: t.name, rating: saved?.rating ?? 3 }
          })
          setAlbum({ id, name: data.name, artist: data.artists[0]?.name ?? '', image: data.images[0]?.url ?? '', releaseDate: data.release_date, tracks })
          setCoverPreview(data.images[0]?.url ?? '')
        }
      } catch {}
      setLoading(false)
    }
    setLoadingPost(null)
  }

  function clearForm() {
    setSpotifyUrl(''); setAlbum(null); setAlbumRating(0); setSummary('')
    setSoundReview(''); setStandoutTracks(''); setVerdict('')
    setCoverFile(null); setCoverPreview(''); setPublished(false)
    setError(''); setEditingPath(null); setDraftSaved(false)
  }

  async function fetchAlbum() {
    if (!spotifyUrl.trim()) return
    setLoading(true); setError('')
    try {
      const id = parseSpotifyAlbumId(spotifyUrl)
      const data = await getAlbum(id)
      if (!data) { setError('Could not fetch album.'); setLoading(false); return }
      setAlbum({ id, name: data.name, artist: data.artists[0]?.name ?? '', image: data.images[0]?.url ?? '', releaseDate: data.release_date, tracks: data.tracks.items.map(t => ({ name: t.name, rating: 3 })) })
      setCoverPreview(data.images[0]?.url ?? '')
      setCoverFile(null); setPublished(false)
    } catch { setError('Failed to fetch album data.') }
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
    setCoverFile(file); setCoverPreview(URL.createObjectURL(file))
  }

  function buildContent(): string {
    const parts = []
    if (soundReview.trim()) parts.push(`## The Sound\n\n${soundReview.trim()}`)
    parts.push('[TRACK_RATINGS]')
    if (standoutTracks.trim()) parts.push(`## Standout Tracks\n\n${standoutTracks.trim()}`)
    if (verdict.trim()) parts.push(`## Verdict\n\n${verdict.trim()}`)
    return parts.join('\n\n')
  }

  function generateMarkdown(isDraft = false): string {
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
draft: ${isDraft}
spotifyAlbum: "${spotifyUrl}"
tracklist: ${tracklist}
---

${buildContent()}
`
  }

  async function publish(asDraft = false) {
    if (!album) return
    if (!asDraft && albumRating === 0) { setError('Set an album rating before publishing.'); return }
    setPublishing(true); setError('')
    try {
      const postSlug = slugify(`${album.name} ${album.artist} Review`)
      if (coverFile) {
        // User picked a custom cover
        const reader = new FileReader()
        const b64 = await new Promise<string>(res => {
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.readAsDataURL(coverFile)
        })
        await uploadImage(`public/posts/${postSlug}.jpg`, b64)
      } else if (album.image) {
        // Auto-upload the Spotify album art
        const imgRes = await fetch(album.image)
        const blob = await imgRes.blob()
        const b64 = await new Promise<string>(res => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
        await uploadImage(`public/posts/${postSlug}.jpg`, b64)
      }
      const filePath = editingPath ?? `content/posts/${postSlug}.md`
      const action = editingPath ? 'Update' : (asDraft ? 'Save draft' : 'Add review')
      const ok = await commitFile(filePath, generateMarkdown(asDraft), `${action}: ${album.name} - ${album.artist}`)
      if (ok) {
        asDraft ? (setDraftSaved(true), setTimeout(() => setDraftSaved(false), 2500)) : setPublished(true)
        setPostsLoaded(false)
      } else {
        setError('GitHub commit failed — check token has repo write access.')
      }
    } catch { setError('Publish failed.') }
    setPublishing(false)
  }

  const drafts = posts.filter(p => p.isDraft)
  const publishedPosts = posts.filter(p => !p.isDraft)

  return (
    <div className="db-section">
      <div className="db-section-titlebar">
        <h2 className="db-section-title">{editingPath ? '✎ Editing' : 'Music Review'}</h2>
        <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
          <button className={`db-btn db-btn--sm ${activePanel === 'drafts' ? 'db-btn--active' : ''}`} onClick={() => togglePanel('drafts')}>
            Drafts{postsLoaded ? ` (${drafts.length})` : ''}
          </button>
          <button className={`db-btn db-btn--sm ${activePanel === 'published' ? 'db-btn--active' : ''}`} onClick={() => togglePanel('published')}>
            Published{postsLoaded ? ` (${publishedPosts.length})` : ''}
          </button>
          {editingPath && <button className="db-btn db-btn--sm" onClick={clearForm}>+ New</button>}
        </div>
      </div>

      {activePanel && (
        <div className="db-card">
          <label className="db-label">{activePanel === 'drafts' ? 'Drafts' : 'Published Reviews'}</label>
          {postsLoading ? (
            <p className="db-hint">Loading from GitHub...</p>
          ) : (activePanel === 'drafts' ? drafts : publishedPosts).length === 0 ? (
            <p className="db-hint">No {activePanel === 'drafts' ? 'drafts' : 'published reviews'} found.</p>
          ) : (
            <div className="db-drafts-list">
              {(activePanel === 'drafts' ? drafts : publishedPosts).map(post => (
                <div key={post.path} className="db-draft-row">
                  <div className="db-draft-info">
                    <span className="db-draft-title">{post.title.replace(/^"|"$/g, '')}</span>
                    <span className="db-draft-date">{post.filename}</span>
                  </div>
                  <button className="db-btn db-btn--sm db-btn--primary" onClick={() => loadPost(post.path)} disabled={loadingPost === post.path}>
                    {loadingPost === post.path ? 'Loading...' : 'Edit'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="db-card">
        <label className="db-label">Spotify Album URL</label>
        <div className="db-row">
          <input className="db-input" placeholder="https://open.spotify.com/album/..." value={spotifyUrl}
            onChange={e => setSpotifyUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchAlbum()} />
          <button className="db-btn db-btn--primary" onClick={fetchAlbum} disabled={loading}>
            {loading ? 'Fetching...' : 'Fetch Album'}
          </button>
        </div>
        {error && <p className="db-error">{error}</p>}
      </div>

      {album && (<>
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
          <input className="db-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder={`${album.artist}'s ${album.name} reviewed`} />
        </div>

        <div className="db-card">
          <label className="db-label">The Sound</label>
          <p className="db-hint">Your thoughts on the overall sound and feel of the album</p>
          <textarea className="db-textarea db-textarea--tall" value={soundReview} onChange={e => setSoundReview(e.target.value)} placeholder="Describe the sound, production, vibe, how you discovered it..." />
        </div>

        <div className="db-card">
          <label className="db-label">Standout Tracks</label>
          <p className="db-hint">Which tracks stood out and why</p>
          <textarea className="db-textarea" rows={4} value={standoutTracks} onChange={e => setStandoutTracks(e.target.value)} placeholder="e.g. AMERICAN GIRL, DOIT4ME — describe why these hit different..." />
        </div>

        <div className="db-card">
          <label className="db-label">Verdict</label>
          <p className="db-hint">Final thoughts and overall impression</p>
          <textarea className="db-textarea" rows={4} value={verdict} onChange={e => setVerdict(e.target.value)} placeholder="Wrap up your review with a verdict..." />
        </div>

        <div className="db-card">
          <label className="db-label">Generated Markdown</label>
          <pre className="db-preview">{generateMarkdown()}</pre>
        </div>

        <div className="db-publish-row">
          {published ? (
            <div className="db-success">✓ {editingPath ? 'Updated!' : 'Published!'} Deploying in ~1 minute.</div>
          ) : (
            <div className="db-publish-btns">
              <button className="db-btn db-btn--secondary" onClick={() => publish(true)} disabled={publishing}>
                {publishing ? 'Saving...' : draftSaved ? '✓ Draft saved' : 'Save Draft'}
              </button>
              <button className="db-btn db-btn--publish" onClick={() => publish(false)} disabled={publishing || albumRating === 0}>
                {publishing ? 'Publishing...' : editingPath ? 'Update & Publish' : 'Publish'}
              </button>
            </div>
          )}
          {error && <p className="db-error">{error}</p>}
        </div>
      </>)}
    </div>
  )
}
