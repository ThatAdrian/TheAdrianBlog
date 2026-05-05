import React, { useState, useRef, useEffect } from 'react'
import { listPostFiles, getFileContent } from './github'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Track { name: string; rating: number }
interface ReviewData {
  title: string
  artist: string
  albumName: string
  rating: number
  tracks: Track[]
  verdict: string
  imageUrl: string
  slug: string
}

type Ratio = '9:16' | '1:1'
type FrameIndex = 0 | 1 | 2

const FRAME_LABELS = ['Intro', 'Tracks', 'Verdict']

// ── Parse helpers ─────────────────────────────────────────────────────────────
function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  })
  const tl = match[1].match(/tracklist:\s*(.+)/)
  if (tl) fm.tracklist = tl[1].trim()
  return fm
}

function parseTracks(raw: string): Track[] {
  if (!raw) return []
  return raw.split('|').map(e => {
    const p = e.trim().split('~')
    return { name: p[0]?.trim() ?? '', rating: parseFloat(p[1]?.trim() ?? '3') }
  })
}

function extractVerdict(body: string): string {
  const m = body.match(/## Verdict\s*\n([\s\S]*?)(?=\n## |$)/)
  return m ? m[1].trim() : ''
}

// ── Star string ───────────────────────────────────────────────────────────────
function starsFor(rating: number): string {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0))
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function drawFrame(
  canvas: HTMLCanvasElement,
  review: ReviewData,
  frameIdx: FrameIndex,
  ratio: Ratio
) {
  const W = ratio === '9:16' ? 1080 : 1080
  const H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#07051a')
  bg.addColorStop(1, '#0d0826')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  const PAD = ratio === '9:16' ? 80 : 70

  // ── FRAME 0: Intro ─────────────────────────────────────────────────────────
  if (frameIdx === 0) {
    // Album art
    const artSize = ratio === '9:16' ? 700 : 500
    const artX = (W - artSize) / 2
    const artY = ratio === '9:16' ? 220 : 140

    // Glow behind art
    const glow = ctx.createRadialGradient(W/2, artY + artSize/2, 0, W/2, artY + artSize/2, artSize * 0.8)
    glow.addColorStop(0, 'rgba(0,245,255,0.12)')
    glow.addColorStop(1, 'rgba(0,245,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    const img = await loadImage(review.imageUrl)
    if (img) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,245,255,0.3)'
      ctx.shadowBlur = 60
      roundRect(ctx, artX, artY, artSize, artSize, 32)
      ctx.clip()
      ctx.drawImage(img, artX, artY, artSize, artSize)
      ctx.restore()
    }

    const textY = artY + artSize + (ratio === '9:16' ? 80 : 60)

    // Artist name
    ctx.fillStyle = 'rgba(0,245,255,0.8)'
    ctx.font = `500 ${ratio === '9:16' ? '52px' : '36px'} Arial`
    ctx.textAlign = 'center'
    ctx.fillText(review.artist.toUpperCase(), W / 2, textY)

    // Album name
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `bold ${ratio === '9:16' ? '72px' : '52px'} Arial`
    wrapText(ctx, review.albumName, W/2, textY + (ratio === '9:16' ? 90 : 65), W - PAD*2, ratio === '9:16' ? 85 : 62)

    // Rating
    const ratingY = ratio === '9:16' ? textY + 260 : textY + 180
    ctx.fillStyle = '#ffd700'
    ctx.font = `bold ${ratio === '9:16' ? '80px' : '58px'} Arial`
    ctx.fillText(`${review.rating} / 5`, W / 2, ratingY)

    ctx.fillStyle = 'rgba(255,215,0,0.6)'
    ctx.font = `${ratio === '9:16' ? '48px' : '34px'} Arial`
    ctx.fillText(starsFor(review.rating), W / 2, ratingY + (ratio === '9:16' ? 65 : 48))

    // Blog watermark
    drawWatermark(ctx, W, H, PAD)
  }

  // ── FRAME 1: Tracks ────────────────────────────────────────────────────────
  if (frameIdx === 1) {
    const topTracks = [...review.tracks].sort((a, b) => b.rating - a.rating).slice(0, 6)

    // Small album art top left
    const thumbSize = ratio === '9:16' ? 180 : 140
    const img = await loadImage(review.imageUrl)
    if (img) {
      ctx.save()
      roundRect(ctx, PAD, PAD, thumbSize, thumbSize, 16)
      ctx.clip()
      ctx.drawImage(img, PAD, PAD, thumbSize, thumbSize)
      ctx.restore()
    }

    // Title
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `bold ${ratio === '9:16' ? '52px' : '38px'} Arial`
    ctx.textAlign = 'left'
    ctx.fillText(review.albumName, PAD + thumbSize + 30, PAD + (ratio === '9:16' ? 65 : 50))
    ctx.fillStyle = 'rgba(0,245,255,0.7)'
    ctx.font = `${ratio === '9:16' ? '38px' : '28px'} Arial`
    ctx.fillText(review.artist, PAD + thumbSize + 30, PAD + (ratio === '9:16' ? 120 : 90))

    // Section label
    const sectionY = PAD + thumbSize + (ratio === '9:16' ? 80 : 60)
    ctx.fillStyle = 'rgba(0,245,255,0.5)'
    ctx.font = `${ratio === '9:16' ? '36px' : '26px'} Arial`
    ctx.textAlign = 'left'
    ctx.fillText('TOP TRACKS', PAD, sectionY)

    // Divider
    ctx.strokeStyle = 'rgba(0,245,255,0.2)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(PAD, sectionY + 20)
    ctx.lineTo(W - PAD, sectionY + 20)
    ctx.stroke()

    // Track rows
    const rowH = ratio === '9:16' ? 180 : 110
    const startY = sectionY + (ratio === '9:16' ? 60 : 45)

    topTracks.forEach((track, i) => {
      const y = startY + i * rowH
      const ratingColor = ratingToColor(track.rating)

      // Row bg
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      roundRect(ctx, PAD, y - (ratio === '9:16' ? 42 : 30), W - PAD*2, ratio === '9:16' ? 135 : 88, 16)
      ctx.fill()

      // Track number
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = `${ratio === '9:16' ? '36px' : '26px'} Arial`
      ctx.textAlign = 'left'
      ctx.fillText(`${String(i + 1).padStart(2, '0')}`, PAD + 20, y + (ratio === '9:16' ? 18 : 12))

      // Track name
      ctx.fillStyle = 'rgba(240,240,255,0.9)'
      ctx.font = `bold ${ratio === '9:16' ? '44px' : '32px'} Arial`
      const maxNameW = W - PAD*2 - (ratio === '9:16' ? 300 : 220)
      const name = truncateText(ctx, track.name, maxNameW)
      ctx.fillText(name, PAD + (ratio === '9:16' ? 90 : 70), y + (ratio === '9:16' ? 18 : 12))

      // Rating pill
      ctx.fillStyle = ratingColor + '22'
      const pillW = ratio === '9:16' ? 130 : 95
      const pillH = ratio === '9:16' ? 60 : 44
      roundRect(ctx, W - PAD - pillW, y - pillH/2 + (ratio === '9:16' ? 0 : -2), pillW, pillH, pillH/2)
      ctx.fill()
      ctx.fillStyle = ratingColor
      ctx.font = `bold ${ratio === '9:16' ? '38px' : '28px'} Arial`
      ctx.textAlign = 'center'
      ctx.fillText(`${track.rating}`, W - PAD - pillW/2, y + (ratio === '9:16' ? 15 : 11))
    })

    drawWatermark(ctx, W, H, PAD)
  }

  // ── FRAME 2: Verdict ───────────────────────────────────────────────────────
  if (frameIdx === 2) {
    const img = await loadImage(review.imageUrl)

    // Blurred background art
    if (img) {
      ctx.save()
      ctx.filter = 'blur(40px)'
      ctx.globalAlpha = 0.15
      ctx.drawImage(img, -100, -100, W + 200, H + 200)
      ctx.restore()
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(7,5,26,0.75)'
    ctx.fillRect(0, 0, W, H)

    // Decorative cyan line top
    const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(0.3, 'rgba(0,245,255,0.6)')
    grad.addColorStop(0.7, 'rgba(180,0,255,0.6)')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(PAD, ratio === '9:16' ? 160 : 120, W - PAD*2, 3)

    // VERDICT label
    const labelY = ratio === '9:16' ? 260 : 190
    ctx.fillStyle = 'rgba(0,245,255,0.6)'
    ctx.font = `500 ${ratio === '9:16' ? '44px' : '32px'} Arial`
    ctx.textAlign = 'center'
    ctx.fillText('VERDICT', W / 2, labelY)

    // Verdict text
    const verdictY = labelY + (ratio === '9:16' ? 80 : 58)
    ctx.fillStyle = 'rgba(230,230,255,0.88)'
    ctx.font = `${ratio === '9:16' ? '48px' : '34px'} Arial`
    const maxChars = 280
    const snippet = review.verdict.length > maxChars ? review.verdict.slice(0, maxChars).trim() + '...' : review.verdict
    wrapTextLeft(ctx, `"${snippet}"`, PAD, verdictY, W - PAD*2, ratio === '9:16' ? 65 : 48)

    // Rating bottom
    const ratingY = ratio === '9:16' ? H - 320 : H - 220
    ctx.fillStyle = '#ffd700'
    ctx.font = `bold ${ratio === '9:16' ? '90px' : '64px'} Arial`
    ctx.textAlign = 'center'
    ctx.fillText(`${review.rating} / 5`, W / 2, ratingY)

    ctx.fillStyle = 'rgba(255,215,0,0.55)'
    ctx.font = `${ratio === '9:16' ? '52px' : '38px'} Arial`
    ctx.fillText(starsFor(review.rating), W / 2, ratingY + (ratio === '9:16' ? 72 : 52))

    // Bottom line
    ctx.fillStyle = grad
    ctx.fillRect(PAD, ratio === '9:16' ? H - 180 : H - 140, W - PAD*2, 3)

    drawWatermark(ctx, W, H, PAD)
  }
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), cx, y)
      line = word + ' '
      y += lineH
    } else { line = test }
  }
  ctx.fillText(line.trim(), cx, y)
}

function wrapTextLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  ctx.textAlign = 'left'
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y)
      line = word + ' '
      y += lineH
    } else { line = test }
  }
  ctx.fillText(line.trim(), x, y)
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (ctx.measureText(t + '...').width > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '...'
}

function ratingToColor(r: number): string {
  if (r >= 5)   return '#ff00ff'
  if (r >= 4.5) return '#dd00ff'
  if (r >= 4)   return '#00f5ff'
  if (r >= 3.5) return '#00cc88'
  if (r >= 3)   return '#88dd00'
  if (r >= 2)   return '#ffd700'
  return '#ff4466'
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, PAD: number) {
  ctx.fillStyle = 'rgba(0,245,255,0.35)'
  ctx.font = `500 ${W > 1000 ? '32px' : '28px'} Arial`
  ctx.textAlign = 'right'
  ctx.fillText('theadrianblog.com', W - PAD, H - PAD)
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FrameCreator() {
  const [posts, setPosts] = useState<{ path: string; title: string }[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [review, setReview] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [ratio, setRatio] = useState<Ratio>('9:16')
  const [activeFrame, setActiveFrame] = useState<FrameIndex>(0)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load post list
  useEffect(() => {
    async function load() {
      setPostsLoading(true)
      const files = await listPostFiles()
      const entries = []
      for (const f of files) {
        const raw = await getFileContent(f.path)
        if (!raw || !raw.includes('Music Reviews')) continue
        const fm = parseFrontmatter(raw)
        if (fm.draft === 'true') continue
        entries.push({ path: f.path, title: (fm.title || f.name).replace(/^"|"$/g, '') })
      }
      setPosts(entries)
      setPostsLoading(false)
    }
    load()
  }, [])

  async function loadReview(path: string) {
    setLoading(true)
    const raw = await getFileContent(path)
    if (!raw) { setLoading(false); return }
    const fm = parseFrontmatter(raw)
    const body = raw.replace(/^---[\s\S]*?---\n/, '').trim()
    const tracks = parseTracks(fm.tracklist || '')
    const verdict = extractVerdict(body)
    const slug = path.replace('content/posts/', '').replace('.md', '')
    const title = fm.title?.replace(/^"|"$/g, '') || ''
    const parts = title.split(' - ')
    const albumName = parts[0]?.trim() || title
    const artist = parts[1]?.replace(/ Review$/, '').trim() || ''

    setReview({
      title, albumName, artist,
      rating: parseFloat(fm.rating || '0'),
      tracks, verdict,
      imageUrl: `https://www.theadrianblog.com/posts/${slug}.jpg`,
      slug,
    })
    setActiveFrame(0)
    setLoading(false)
  }

  // Render frame whenever review, ratio or activeFrame changes
  useEffect(() => {
    if (!review || !canvasRef.current) return
    setRendering(true)
    drawFrame(canvasRef.current, review, activeFrame, ratio).then(() => setRendering(false))
  }, [review, activeFrame, ratio])

  function download() {
    if (!canvasRef.current || !review) return
    const link = document.createElement('a')
    link.download = `${review.slug}-frame${activeFrame + 1}-${ratio.replace(':', 'x')}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  function downloadAll() {
    if (!canvasRef.current || !review) return
    ;([0, 1, 2] as FrameIndex[]).forEach((fi, i) => {
      setTimeout(async () => {
        await drawFrame(canvasRef.current!, review!, fi, ratio)
        const link = document.createElement('a')
        link.download = `${review!.slug}-frame${fi + 1}-${ratio.replace(':', 'x')}.png`
        link.href = canvasRef.current!.toDataURL('image/png')
        link.click()
        // Redraw current frame after last download
        if (fi === 2) drawFrame(canvasRef.current!, review!, activeFrame, ratio)
      }, i * 400)
    })
  }

  return (
    <div className="db-section">
      <h2 className="db-section-title">Frame Creator</h2>

      {/* Post selector */}
      <div className="db-card">
        <label className="db-label">Select Review</label>
        {postsLoading ? (
          <p className="db-hint">Loading reviews from GitHub...</p>
        ) : (
          <select className="db-select" value={selectedPath}
            onChange={e => { setSelectedPath(e.target.value); if (e.target.value) loadReview(e.target.value) }}>
            <option value="">— Choose a review —</option>
            {posts.map(p => <option key={p.path} value={p.path}>{p.title}</option>)}
          </select>
        )}
        {loading && <p className="db-hint" style={{ marginTop: '0.5rem' }}>Loading review data...</p>}
      </div>

      {review && (
        <>
          {/* Controls */}
          <div className="db-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <label className="db-label" style={{ marginBottom: '6px' }}>Ratio</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['9:16', '1:1'] as Ratio[]).map(r => (
                    <button key={r} className={`db-btn db-btn--sm ${ratio === r ? 'db-btn--active' : ''}`}
                      onClick={() => setRatio(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="db-label" style={{ marginBottom: '6px' }}>Frame</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {FRAME_LABELS.map((label, i) => (
                    <button key={i} className={`db-btn db-btn--sm ${activeFrame === i ? 'db-btn--active' : ''}`}
                      onClick={() => setActiveFrame(i as FrameIndex)}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button className="db-btn db-btn--sm" onClick={download} disabled={rendering}>
                  ↓ This frame
                </button>
                <button className="db-btn db-btn--publish" onClick={downloadAll} disabled={rendering}>
                  ↓ All 3 frames
                </button>
              </div>
            </div>
          </div>

          {/* Canvas preview */}
          <div className="db-card" style={{ padding: '1rem' }}>
            <div className="fc-preview-wrap" style={{ aspectRatio: ratio === '9:16' ? '9/16' : '1/1' }}>
              {rendering && <div className="fc-rendering">Rendering...</div>}
              <canvas ref={canvasRef} className="fc-canvas" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
