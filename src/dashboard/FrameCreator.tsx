import React, { useState, useRef, useEffect, useCallback } from 'react'
import { listPostFiles, getFileContent } from './github'

interface Track { name: string; rating: number }
interface ReviewData {
  title: string; artist: string; albumName: string; rating: number
  tracks: Track[]; verdict: string; summary: string
  imageUrl: string; slug: string
}
type Ratio = '9:16' | '1:1'

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
function extractSection(body: string, heading: string): string {
  const m = body.match(new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |\\[TRACK_RATINGS\\]|$)`))
  return m ? m[1].trim() : ''
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, align: CanvasTextAlign = 'center'): number {
  ctx.textAlign = align
  const words = text.split(' '); let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y); line = word + ' '; y += lineH
    } else line = test
  }
  ctx.fillText(line.trim(), x, y); return y
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (ctx.measureText(t + '…').width > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '…'
}

function ratingColor(r: number): string {
  if (r >= 5)   return '#ff00ff'
  if (r >= 4.5) return '#cc00ff'
  if (r >= 4)   return '#00f5ff'
  if (r >= 3.5) return '#00ff88'
  if (r >= 3)   return '#aadd00'
  if (r >= 2)   return '#ffd700'
  return '#ff4466'
}

// Draw background matching blog aesthetic
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#07051a')
  bg.addColorStop(0.5, '#0a0720')
  bg.addColorStop(1, '#080516')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  const gap = W > 1000 ? 54 : 40
  for (let x = gap; x < W; x += gap) {
    for (let y = gap; y < H; y += gap) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  // Radial glow top right
  const gr = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, W * 0.5)
  gr.addColorStop(0, 'rgba(0,245,255,0.05)')
  gr.addColorStop(1, 'rgba(0,245,255,0)')
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H)

  // Radial glow bottom left
  const gb = ctx.createRadialGradient(W * 0.2, H * 0.9, 0, W * 0.2, H * 0.9, W * 0.5)
  gb.addColorStop(0, 'rgba(180,0,255,0.05)')
  gb.addColorStop(1, 'rgba(180,0,255,0)')
  ctx.fillStyle = gb; ctx.fillRect(0, 0, W, H)
}

function drawTopBar(ctx: CanvasRenderingContext2D, W: number, PAD: number, topY: number) {
  const grad = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.3, 'rgba(0,245,255,0.5)')
  grad.addColorStop(0.7, 'rgba(180,0,255,0.5)')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(PAD, topY, W - PAD * 2, 2)
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, PAD: number, sz: number) {
  ctx.fillStyle = 'rgba(0,245,255,0.3)'
  ctx.font = `500 ${sz}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W / 2, H - PAD * 0.6)
}

// Rainbow stars - static gradient across 5 stars
function drawRainbowStars(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, starSz: number, gap: number) {
  const RAINBOW = ['#ff0055','#ff6600','#ffd700','#00ff88','#00f5ff','#b400ff']
  const totalW = 5 * (starSz * 2 + gap) - gap
  let x = cx - totalW / 2 + starSz
  for (let i = 0; i < 5; i++) {
    const filled = rating >= i + 1
    const half = !filled && rating >= i + 0.5
    const color = RAINBOW[Math.floor((i / 4) * (RAINBOW.length - 1))]
    ctx.save()
    ctx.font = `${starSz * 2}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (filled || half) {
      ctx.fillStyle = color
      ctx.globalAlpha = 0.9
      ctx.fillText(half ? '⯨' : '★', x, cy)
    }
    // Empty star outline
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.globalAlpha = filled || half ? 0 : 1
    ctx.fillText('☆', x, cy)
    ctx.restore()
    x += starSz * 2 + gap
  }
}

// ── FRAME 0: Intro ────────────────────────────────────────────────────────────
async function drawIntro(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  const W = 1080; const H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 90 : 80
  const is916 = ratio === '9:16'

  drawBg(ctx, W, H)
  drawTopBar(ctx, W, PAD, is916 ? 70 : 55)

  // Album art
  const artSize = is916 ? 720 : 460
  const artX = (W - artSize) / 2
  const artY = is916 ? 130 : 100

  // Glow
  const glow = ctx.createRadialGradient(W/2, artY + artSize/2, artSize * 0.1, W/2, artY + artSize/2, artSize * 0.75)
  glow.addColorStop(0, 'rgba(0,245,255,0.08)')
  glow.addColorStop(0.5, 'rgba(180,0,255,0.06)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)

  const img = await loadImage(review.imageUrl)
  if (img) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,245,255,0.2)'; ctx.shadowBlur = 80
    roundRect(ctx, artX, artY, artSize, artSize, 28); ctx.clip()
    ctx.drawImage(img, artX, artY, artSize, artSize)
    ctx.restore()
    // Subtle border
    ctx.save()
    roundRect(ctx, artX, artY, artSize, artSize, 28)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  }

  const textStart = artY + artSize + (is916 ? 72 : 50)

  // Artist
  ctx.fillStyle = 'rgba(0,245,255,0.75)'
  ctx.font = `600 ${is916 ? 46 : 32}px Arial`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '3px'
  ctx.fillText(review.artist.toUpperCase(), W/2, textStart)

  // Album title
  ctx.fillStyle = 'rgba(245,245,255,0.97)'
  ctx.font = `bold ${is916 ? 76 : 54}px Arial`
  wrapText(ctx, review.albumName, W/2, textStart + (is916 ? 85 : 60), W - PAD * 2.5, is916 ? 90 : 65)

  // Divider line
  const divY = textStart + (is916 ? 210 : 150)
  const dg = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  dg.addColorStop(0, 'transparent')
  dg.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  dg.addColorStop(1, 'transparent')
  ctx.fillStyle = dg; ctx.fillRect(PAD, divY, W - PAD * 2, 1)

  // Summary
  if (review.summary) {
    ctx.fillStyle = 'rgba(200,200,255,0.6)'
    ctx.font = `${is916 ? 40 : 28}px Arial`
    wrapText(ctx, `"${review.summary}"`, W/2, divY + (is916 ? 60 : 44), W - PAD * 2.2, is916 ? 56 : 40)
  }

  drawTopBar(ctx, W, PAD, H - (is916 ? 90 : 70))
  drawWatermark(ctx, W, H, PAD, is916 ? 30 : 24)
}

// ── FRAME 1+: Tracks (10 per page) ───────────────────────────────────────────
async function drawTracks(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio, page: number) {
  const W = 1080; const H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 90 : 80
  const is916 = ratio === '9:16'

  drawBg(ctx, W, H)
  drawTopBar(ctx, W, PAD, is916 ? 70 : 55)

  // Small header
  const img = await loadImage(review.imageUrl)
  const thumbSz = is916 ? 130 : 100
  const headerY = is916 ? 110 : 90

  if (img) {
    ctx.save()
    roundRect(ctx, PAD, headerY, thumbSz, thumbSz, 12); ctx.clip()
    ctx.drawImage(img, PAD, headerY, thumbSz, thumbSz)
    ctx.restore()
    ctx.save()
    roundRect(ctx, PAD, headerY, thumbSz, thumbSz, 12)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.restore()
  }

  const hx = PAD + thumbSz + (is916 ? 32 : 24)
  ctx.fillStyle = 'rgba(245,245,255,0.95)'
  ctx.font = `bold ${is916 ? 50 : 36}px Arial`
  ctx.textAlign = 'left'
  ctx.fillText(truncate(ctx, review.albumName, W - hx - PAD), hx, headerY + (is916 ? 52 : 40))
  ctx.fillStyle = 'rgba(0,245,255,0.65)'
  ctx.font = `500 ${is916 ? 36 : 26}px Arial`
  ctx.fillText(review.artist, hx, headerY + (is916 ? 100 : 74))

  // Tracks label + page indicator
  const labelY = headerY + thumbSz + (is916 ? 52 : 38)
  ctx.fillStyle = 'rgba(0,245,255,0.5)'
  ctx.font = `500 ${is916 ? 32 : 24}px Arial`
  ctx.textAlign = 'left'
  const totalPages = Math.ceil(review.tracks.length / 10)
  ctx.fillText(`TRACK RATINGS${totalPages > 1 ? ` (${page + 1}/${totalPages})` : ''}`, PAD, labelY)

  // Thin line
  ctx.fillStyle = 'rgba(0,245,255,0.15)'
  ctx.fillRect(PAD, labelY + (is916 ? 16 : 12), W - PAD * 2, 1)

  // Track rows
  const PER_PAGE = 10
  const pageTracks = review.tracks.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const availH = H - labelY - (is916 ? 180 : 130) - (is916 ? 60 : 45)
  const rowH = availH / Math.max(pageTracks.length, 1)
  const rowStart = labelY + (is916 ? 36 : 26)

  pageTracks.forEach((track, i) => {
    const ry = rowStart + i * rowH
    const rc = ratingColor(track.rating)

    // Row bg alternating
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.015)'
    roundRect(ctx, PAD, ry, W - PAD * 2, rowH - (is916 ? 8 : 5), 10)
    ctx.fill()

    const innerY = ry + rowH * 0.52

    // Track number
    ctx.fillStyle = 'rgba(0,245,255,0.35)'
    ctx.font = `500 ${is916 ? 30 : 22}px Arial`
    ctx.textAlign = 'left'
    ctx.fillText(`${String(page * PER_PAGE + i + 1).padStart(2, '0')}`, PAD + (is916 ? 20 : 16), innerY)

    // Track name
    const numW = is916 ? 72 : 54
    const pillW = is916 ? 110 : 82
    const nameMaxW = W - PAD * 2 - numW - pillW - (is916 ? 36 : 26)
    ctx.fillStyle = 'rgba(235,235,255,0.9)'
    ctx.font = `${is916 ? 36 : 26}px Arial`
    ctx.textAlign = 'left'
    ctx.fillText(truncate(ctx, track.name, nameMaxW), PAD + numW, innerY)

    // Rating pill
    const px = W - PAD - pillW
    const ph = is916 ? 54 : 40
    const py = ry + (rowH - ph) / 2 - (is916 ? 2 : 1)
    ctx.fillStyle = rc + '20'
    roundRect(ctx, px, py, pillW, ph, ph / 2); ctx.fill()
    ctx.strokeStyle = rc + '60'; ctx.lineWidth = 1
    roundRect(ctx, px, py, pillW, ph, ph / 2); ctx.stroke()
    ctx.fillStyle = rc
    ctx.font = `bold ${is916 ? 32 : 24}px Arial`
    ctx.textAlign = 'center'
    ctx.fillText(`${track.rating}`, px + pillW / 2, py + ph * 0.67)
  })

  drawTopBar(ctx, W, PAD, H - (is916 ? 90 : 70))
  drawWatermark(ctx, W, H, PAD, is916 ? 28 : 22)
}

// ── LAST FRAME: Verdict ───────────────────────────────────────────────────────
async function drawVerdict(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  const W = 1080; const H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 90 : 80
  const is916 = ratio === '9:16'

  drawBg(ctx, W, H)

  // Blurred art background
  const img = await loadImage(review.imageUrl)
  if (img) {
    ctx.save(); ctx.filter = 'blur(60px)'; ctx.globalAlpha = 0.1
    ctx.drawImage(img, -150, -150, W + 300, H + 300)
    ctx.restore()
  }

  drawTopBar(ctx, W, PAD, is916 ? 70 : 55)

  // VERDICT heading
  const headY = is916 ? 160 : 120
  ctx.fillStyle = 'rgba(0,245,255,0.55)'
  ctx.font = `600 ${is916 ? 42 : 30}px Arial`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '6px'
  ctx.fillText('VERDICT', W / 2, headY)
  ctx.letterSpacing = '0px'

  // Thin decorative line
  const lg = ctx.createLinearGradient(PAD, 0, W - PAD, 0)
  lg.addColorStop(0, 'transparent')
  lg.addColorStop(0.3, 'rgba(0,245,255,0.3)')
  lg.addColorStop(0.7, 'rgba(180,0,255,0.3)')
  lg.addColorStop(1, 'transparent')
  ctx.fillStyle = lg; ctx.fillRect(PAD, headY + (is916 ? 22 : 16), W - PAD * 2, 1.5)

  // Verdict text
  const verdictY = headY + (is916 ? 80 : 56)
  const maxChars = is916 ? 380 : 320
  const snippet = review.verdict.length > maxChars ? review.verdict.slice(0, maxChars).trim() + '...' : review.verdict
  ctx.fillStyle = 'rgba(215,215,240,0.85)'
  ctx.font = `${is916 ? 44 : 32}px Arial`
  const verdictEndY = wrapText(ctx, `"${snippet}"`, W / 2, verdictY, W - PAD * 2.2, is916 ? 62 : 46)

  // Glass card for rating
  const cardY = verdictEndY + (is916 ? 90 : 65)
  const cardH = is916 ? 280 : 200
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  roundRect(ctx, PAD, cardY, W - PAD * 2, cardH, 20); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  roundRect(ctx, PAD, cardY, W - PAD * 2, cardH, 20); ctx.stroke()

  // Album info inside card
  const cardMid = cardY + cardH / 2
  ctx.fillStyle = 'rgba(0,245,255,0.6)'
  ctx.font = `500 ${is916 ? 36 : 26}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText(review.artist.toUpperCase(), W / 2, cardMid - (is916 ? 80 : 55))
  ctx.fillStyle = 'rgba(245,245,255,0.9)'
  ctx.font = `bold ${is916 ? 50 : 36}px Arial`
  ctx.fillText(truncate(ctx, review.albumName, W - PAD * 3), W / 2, cardMid - (is916 ? 22 : 14))

  // Rating number
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${is916 ? 68 : 48}px Arial`
  ctx.fillText(`${review.rating} / 5`, W / 2, cardMid + (is916 ? 52 : 36))

  // Rainbow stars
  drawRainbowStars(ctx, review.rating, W / 2, cardMid + (is916 ? 115 : 80), is916 ? 28 : 20, is916 ? 12 : 8)

  drawTopBar(ctx, W, PAD, H - (is916 ? 90 : 70))
  drawWatermark(ctx, W, H, PAD, is916 ? 28 : 22)
}

// ── Build frame list ──────────────────────────────────────────────────────────
function getFrameList(review: ReviewData): { label: string; type: 'intro' | 'tracks' | 'verdict'; page?: number }[] {
  const frames: { label: string; type: 'intro' | 'tracks' | 'verdict'; page?: number }[] = []
  frames.push({ label: 'Intro', type: 'intro' })
  const trackPages = Math.ceil(review.tracks.length / 10)
  for (let i = 0; i < trackPages; i++) {
    frames.push({ label: trackPages > 1 ? `Tracks ${i + 1}/${trackPages}` : 'Tracks', type: 'tracks', page: i })
  }
  frames.push({ label: 'Verdict', type: 'verdict' })
  return frames
}

async function renderFrame(canvas: HTMLCanvasElement, review: ReviewData, frameIdx: number, ratio: Ratio) {
  const frames = getFrameList(review)
  const frame = frames[frameIdx]
  if (!frame) return
  if (frame.type === 'intro') await drawIntro(canvas, review, ratio)
  else if (frame.type === 'tracks') await drawTracks(canvas, review, ratio, frame.page ?? 0)
  else await drawVerdict(canvas, review, ratio)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FrameCreator() {
  const [posts, setPosts] = useState<{ path: string; title: string }[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [review, setReview] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [ratio, setRatio] = useState<Ratio>('9:16')
  const [activeFrame, setActiveFrame] = useState(0)
  const [rendering, setRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      setPostsLoading(true)
      const files = await listPostFiles()
      const entries: { path: string; title: string }[] = []
      for (const f of files) {
        const raw = await getFileContent(f.path)
        if (!raw || !raw.includes('Music Reviews')) continue
        const fm = parseFrontmatter(raw)
        if (fm.draft === 'true') continue
        entries.push({ path: f.path, title: (fm.title || f.name).replace(/^"|"$/g, '') })
      }
      setPosts(entries); setPostsLoading(false)
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
    const verdict = extractSection(body, 'Verdict')
    const slug = path.replace('content/posts/', '').replace('.md', '')
    const title = fm.title?.replace(/^"|"$/g, '') || ''
    const dashIdx = title.lastIndexOf(' - ')
    const albumName = dashIdx > -1 ? title.slice(0, dashIdx).trim() : title
    const artist = dashIdx > -1 ? title.slice(dashIdx + 3).replace(/ Review$/, '').trim() : ''
    setReview({
      title, albumName, artist,
      rating: parseFloat(fm.rating || '0'),
      tracks, verdict,
      summary: fm.summary || '',
      imageUrl: `https://www.theadrianblog.com/posts/${slug}.jpg`,
      slug,
    })
    setActiveFrame(0)
    setLoading(false)
  }

  const render = useCallback(async () => {
    if (!review || !canvasRef.current) return
    setRendering(true)
    await renderFrame(canvasRef.current, review, activeFrame, ratio)
    setRendering(false)
  }, [review, activeFrame, ratio])

  useEffect(() => { render() }, [render])

  function download() {
    if (!canvasRef.current || !review) return
    const frames = getFrameList(review)
    const label = frames[activeFrame]?.label.toLowerCase().replace(/[^a-z0-9]/g, '-') || activeFrame
    const link = document.createElement('a')
    link.download = `${review.slug}-${label}-${ratio.replace(':', 'x')}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  async function downloadAll() {
    if (!canvasRef.current || !review) return
    const frames = getFrameList(review)
    for (let i = 0; i < frames.length; i++) {
      await renderFrame(canvasRef.current, review, i, ratio)
      const label = frames[i].label.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const link = document.createElement('a')
      link.download = `${review.slug}-${String(i + 1).padStart(2,'0')}-${label}-${ratio.replace(':', 'x')}.png`
      link.href = canvasRef.current.toDataURL('image/png')
      link.click()
      await new Promise(r => setTimeout(r, 300))
    }
    await renderFrame(canvasRef.current, review, activeFrame, ratio)
  }

  const frames = review ? getFrameList(review) : []

  return (
    <div className="db-section">
      <h2 className="db-section-title">Frame Creator</h2>

      <div className="db-card">
        <label className="db-label">Select Review</label>
        {postsLoading ? <p className="db-hint">Loading reviews from GitHub...</p> : (
          <select className="db-select" value={selectedPath}
            onChange={e => { setSelectedPath(e.target.value); if (e.target.value) loadReview(e.target.value) }}>
            <option value="">— Choose a review —</option>
            {posts.map(p => <option key={p.path} value={p.path}>{p.title}</option>)}
          </select>
        )}
        {loading && <p className="db-hint" style={{ marginTop: '0.5rem' }}>Loading...</p>}
      </div>

      {review && (
        <>
          <div className="db-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <label className="db-label" style={{ marginBottom: '6px' }}>Ratio</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['9:16','1:1'] as Ratio[]).map(r => (
                    <button key={r} className={`db-btn db-btn--sm ${ratio === r ? 'db-btn--active' : ''}`} onClick={() => setRatio(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="db-label" style={{ marginBottom: '6px' }}>Frame</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {frames.map((f, i) => (
                    <button key={i} className={`db-btn db-btn--sm ${activeFrame === i ? 'db-btn--active' : ''}`} onClick={() => setActiveFrame(i)}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className="db-btn db-btn--sm" onClick={download} disabled={rendering}>↓ Frame</button>
                <button className="db-btn db-btn--publish" onClick={downloadAll} disabled={rendering}>↓ All {frames.length}</button>
              </div>
            </div>
          </div>

          <div className="db-card" style={{ padding: '1rem' }}>
            <p className="db-hint" style={{ marginBottom: '0.75rem' }}>
              {frames.length} frame{frames.length > 1 ? 's' : ''} total
              {review.tracks.length > 10 ? ` · ${Math.ceil(review.tracks.length / 10)} track page${Math.ceil(review.tracks.length / 10) > 1 ? 's' : ''}` : ''}
            </p>
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
