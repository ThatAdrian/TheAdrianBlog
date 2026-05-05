import React, { useState, useRef, useEffect, useCallback } from 'react'
import { listPostFiles, getFileContent } from './github'

interface Track { name: string; rating: number }
interface ReviewData {
  title: string; artist: string; albumName: string; rating: number
  tracks: Track[]; verdict: string; summary: string
  imageUrl: string; slug: string
}
type Ratio = '9:16' | '1:1'

// ── Parse helpers ─────────────────────────────────────────────────────────────
function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':'); if (idx === -1) return
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

// ── Font loader ───────────────────────────────────────────────────────────────
let fontsLoaded = false
async function ensureFonts() {
  if (fontsLoaded) return
  try {
    await Promise.all([
      new FontFace('Space Grotesk', 'url(https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFRntYZgAmQ.woff2)').load().then(f => { document.fonts.add(f); return f }),
      new FontFace('Space Grotesk', 'url(https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gowFRntYZgAmQ.woff2)', { weight: '700' }).load().then(f => { document.fonts.add(f); return f }),
      new FontFace('Orbitron', 'url(https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6xpmIyXjU1pg.woff2)', { weight: '700' }).load().then(f => { document.fonts.add(f); return f }),
    ])
    fontsLoaded = true
  } catch { fontsLoaded = true }
}

// ── Image loader ──────────────────────────────────────────────────────────────
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = url
  })
}

// ── Canvas utils ──────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, align: CanvasTextAlign = 'left'): number {
  ctx.textAlign = align
  const baseX = align === 'center' ? x : x
  const words = text.split(' '); let line = ''
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), baseX, y); line = word + ' '; y += lineH
    } else line = test
  }
  ctx.fillText(line.trim(), baseX, y)
  return y + lineH
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (ctx.measureText(t + '…').width > maxW && t.length > 0) t = t.slice(0, -1)
  return t + '…'
}

// ── Rating colors — clear distinction, 5-star is neon white ──────────────────
function rc(r: number): { fill: string; glow: string } {
  if (r >= 5)   return { fill: '#ffffff', glow: 'rgba(255,255,255,0.8)' }
  if (r >= 4.5) return { fill: '#00f5ff', glow: 'rgba(0,245,255,0.6)' }
  if (r >= 4)   return { fill: '#00ccdd', glow: 'rgba(0,204,221,0.5)' }
  if (r >= 3.5) return { fill: '#00ff88', glow: 'rgba(0,255,136,0.5)' }
  if (r >= 3)   return { fill: '#aadd00', glow: 'rgba(170,221,0,0.4)' }
  if (r >= 2)   return { fill: '#ffd700', glow: 'rgba(255,215,0,0.4)' }
  return         { fill: '#ff4466', glow: 'rgba(255,68,102,0.4)' }
}

// ── Refined divider ───────────────────────────────────────────────────────────
function drawDivider(ctx: CanvasRenderingContext2D, cx: number, y: number, halfW: number, color = 'rgba(255,255,255,0.12)') {
  const gr = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0)
  gr.addColorStop(0, 'transparent')
  gr.addColorStop(0.35, color)
  gr.addColorStop(0.5, color)
  gr.addColorStop(0.65, color)
  gr.addColorStop(1, 'transparent')
  ctx.fillStyle = gr; ctx.fillRect(cx - halfW, y, halfW * 2, 1)
  // Centre diamond
  ctx.save()
  ctx.fillStyle = color
  ctx.translate(cx, y + 0.5)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-4, -4, 8, 8)
  ctx.restore()
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#06041a'; ctx.fillRect(0, 0, W, H)
  // Subtle noise-like grain effect via very small dots
  ctx.fillStyle = 'rgba(255,255,255,0.018)'
  const step = 44
  for (let x = step/2; x < W; x += step)
    for (let y = step/2; y < H; y += step) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill()
    }
  // Atmospheric glows
  ;[[W*0.75, H*0.15, W*0.6, '0,245,255', 0.06], [W*0.25, H*0.85, W*0.55, '180,0,255', 0.05]].forEach(([gx, gy, gr2, col, op]) => {
    const g = ctx.createRadialGradient(gx as number, gy as number, 0, gx as number, gy as number, gr2 as number)
    g.addColorStop(0, `rgba(${col},${op})`); g.addColorStop(1, 'transparent')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  })
}

// ── Top accent bar ────────────────────────────────────────────────────────────
function drawAccentBar(ctx: CanvasRenderingContext2D, W: number, y: number, PAD: number) {
  const g = ctx.createLinearGradient(PAD, 0, W-PAD, 0)
  g.addColorStop(0, 'transparent')
  g.addColorStop(0.2, 'rgba(0,245,255,0.7)')
  g.addColorStop(0.8, 'rgba(180,0,255,0.7)')
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g; ctx.fillRect(PAD, y, W-PAD*2, 2)
}

// ── Star row — neon white for 5, color scale below ───────────────────────────
function drawStars(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, sz: number) {
  const starW = sz * 2.2
  const gap = sz * 0.5
  const total = 5 * starW + 4 * gap
  let x = cx - total / 2 + starW / 2
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < 5; i++) {
    const filled = rating >= i + 1
    const half   = !filled && rating >= i + 0.5
    if (filled || half) {
      const { fill, glow } = rc(i < rating ? Math.min(5, rating) : i + 0.5)
      ctx.save()
      ctx.shadowColor = glow; ctx.shadowBlur = sz * 0.8
      ctx.fillStyle = fill
      ctx.font = `${sz * 2}px Arial`
      ctx.fillText(half ? '⭐' : '★', x, cy)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.font = `${sz * 2}px Arial`
      ctx.fillText('☆', x, cy)
    }
    x += starW + gap
  }
  ctx.textBaseline = 'alphabetic'
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, PAD: number, sz: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = `500 ${sz}px 'Space Grotesk', Arial`
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W/2, H - PAD*0.55)
}

// ── FRAME 0: Intro ────────────────────────────────────────────────────────────
async function drawIntro(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 88 : 76
  const is = ratio === '9:16'
  await ensureFonts()
  drawBg(ctx, W, H)
  drawAccentBar(ctx, W, is ? 56 : 44, PAD)

  // Album art — large, centred
  const artSz = is ? 740 : 480
  const artX = (W - artSz) / 2
  const artY = is ? 108 : 88
  const img = await loadImage(review.imageUrl)
  if (img) {
    // Shadow glow
    ctx.save()
    ctx.shadowColor = 'rgba(0,245,255,0.18)'; ctx.shadowBlur = 100
    rr(ctx, artX, artY, artSz, artSz, 24); ctx.clip()
    ctx.drawImage(img, artX, artY, artSz, artSz)
    ctx.restore()
    // Frame border
    ctx.save(); rr(ctx, artX, artY, artSz, artSz, 24)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore()
  }

  const ty = artY + artSz + (is ? 68 : 50)

  // Artist — small allcaps cyan
  ctx.fillStyle = 'rgba(0,245,255,0.7)'
  ctx.font = `600 ${is ? 44 : 30}px 'Orbitron', Arial`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '4px'
  ctx.fillText(review.artist.toUpperCase(), W/2, ty)
  ctx.letterSpacing = '0px'

  // Album name — big, white
  ctx.fillStyle = 'rgba(248,248,255,0.97)'
  ctx.font = `bold ${is ? 78 : 54}px 'Space Grotesk', Arial`
  const nameEndY = wrapText(ctx, review.albumName, W/2, ty + (is ? 86 : 60), W - PAD*2.4, is ? 90 : 64, 'center')

  // Refined divider
  drawDivider(ctx, W/2, nameEndY + (is ? 24 : 18), W/2 - PAD * 1.2, 'rgba(255,255,255,0.18)')

  // Summary — italic feel, lighter weight
  if (review.summary) {
    ctx.fillStyle = 'rgba(195,195,225,0.65)'
    ctx.font = `${is ? 40 : 28}px 'Space Grotesk', Arial`
    wrapText(ctx, `"${review.summary}"`, W/2, nameEndY + (is ? 80 : 58), W - PAD*2.2, is ? 56 : 40, 'center')
  }

  drawAccentBar(ctx, W, H - (is ? 76 : 58), PAD)
  drawWatermark(ctx, W, H, PAD, is ? 28 : 22)
}

// ── FRAME 1+: Tracks ──────────────────────────────────────────────────────────
async function drawTracks(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio, page: number) {
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 88 : 76
  const is = ratio === '9:16'
  await ensureFonts()
  drawBg(ctx, W, H)
  drawAccentBar(ctx, W, is ? 56 : 44, PAD)

  // Header — thumb + info
  const thumbSz = is ? 120 : 96
  const headerY  = is ? 96 : 78
  const img = await loadImage(review.imageUrl)
  if (img) {
    ctx.save(); rr(ctx, PAD, headerY, thumbSz, thumbSz, 12); ctx.clip()
    ctx.drawImage(img, PAD, headerY, thumbSz, thumbSz); ctx.restore()
    ctx.save(); rr(ctx, PAD, headerY, thumbSz, thumbSz, 12)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore()
  }

  const hx = PAD + thumbSz + (is ? 28 : 22)
  ctx.fillStyle = 'rgba(248,248,255,0.95)'
  ctx.font = `bold ${is ? 48 : 34}px 'Space Grotesk', Arial`
  ctx.textAlign = 'left'
  ctx.fillText(clip(ctx, review.albumName, W - hx - PAD), hx, headerY + (is ? 50 : 38))
  ctx.fillStyle = 'rgba(0,245,255,0.65)'
  ctx.font = `500 ${is ? 34 : 24}px 'Orbitron', Arial`
  ctx.fillText(clip(ctx, review.artist, W - hx - PAD - 20), hx, headerY + (is ? 100 : 74))

  // Section label
  const labelY = headerY + thumbSz + (is ? 48 : 36)
  const totalPages = Math.ceil(review.tracks.length / 10)
  ctx.fillStyle = 'rgba(0,245,255,0.45)'
  ctx.font = `600 ${is ? 28 : 20}px 'Orbitron', Arial`
  ctx.letterSpacing = '3px'
  ctx.fillText(`TRACKS${totalPages > 1 ? `  ${page+1} / ${totalPages}` : ''}`, PAD, labelY)
  ctx.letterSpacing = '0px'

  drawDivider(ctx, PAD + (W - PAD*2)/2, labelY + (is ? 18 : 14), (W - PAD*2)/2, 'rgba(0,245,255,0.15)')

  // Track list
  const PER = 10
  const pageTracks = review.tracks.slice(page * PER, (page+1) * PER)
  const listStart = labelY + (is ? 42 : 32)
  const listEnd   = H - (is ? 120 : 88)
  const rowH      = (listEnd - listStart) / Math.max(pageTracks.length, 1)

  pageTracks.forEach((track, i) => {
    const ry = listStart + i * rowH
    const midY = ry + rowH * 0.5
    const { fill, glow } = rc(track.rating)

    // Row bg — very subtle
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(255,255,255,0.012)'
    rr(ctx, PAD, ry + 2, W - PAD*2, rowH - 4, 10); ctx.fill()

    // Left accent line — colored by rating
    ctx.fillStyle = fill + '60'
    ctx.fillRect(PAD, ry + 2, 3, rowH - 4)

    // Track index
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font = `${is ? 26 : 19}px 'Space Mono', monospace`
    ctx.textAlign = 'left'
    ctx.fillText(String(page * PER + i + 1).padStart(2, '0'), PAD + (is ? 18 : 14), midY + (is ? 9 : 7))

    // Track name
    const numW  = is ? 64 : 50
    const pillW = is ? 108 : 82
    const nameMaxW = W - PAD*2 - numW - pillW - (is ? 32 : 24)
    ctx.fillStyle = track.rating >= 4.5 ? 'rgba(255,255,255,0.97)' : 'rgba(225,225,245,0.82)'
    ctx.font = `${track.rating >= 4.5 ? 'bold ' : ''}${is ? 36 : 26}px 'Space Grotesk', Arial`
    ctx.fillText(clip(ctx, track.name, nameMaxW), PAD + numW, midY + (is ? 11 : 8))

    // Rating pill
    const px = W - PAD - pillW
    const ph = is ? 52 : 38
    const py = midY - ph / 2
    // Pill bg
    ctx.fillStyle = fill + '18'
    rr(ctx, px, py, pillW, ph, ph/2); ctx.fill()
    // Pill border
    ctx.strokeStyle = fill + '70'; ctx.lineWidth = 1.2
    rr(ctx, px, py, pillW, ph, ph/2); ctx.stroke()
    // Rating number — glow on 5-star
    ctx.save()
    if (track.rating >= 5) { ctx.shadowColor = glow; ctx.shadowBlur = 20 }
    ctx.fillStyle = fill
    ctx.font = `bold ${is ? 30 : 22}px 'Space Mono', monospace`
    ctx.textAlign = 'center'
    ctx.fillText(`${track.rating}`, px + pillW/2, py + ph * 0.68)
    ctx.restore()

    // Subtle row separator
    if (i < pageTracks.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      ctx.fillRect(PAD + 16, ry + rowH - 2, W - PAD*2 - 32, 1)
    }
  })

  drawAccentBar(ctx, W, H - (is ? 76 : 58), PAD)
  drawWatermark(ctx, W, H, PAD, is ? 26 : 20)
}

// ── LAST FRAME: Verdict ───────────────────────────────────────────────────────
async function drawVerdict(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const PAD = ratio === '9:16' ? 88 : 76
  const is = ratio === '9:16'
  await ensureFonts()
  drawBg(ctx, W, H)

  // Blurred art in background
  const img = await loadImage(review.imageUrl)
  if (img) {
    ctx.save(); ctx.filter = 'blur(70px)'; ctx.globalAlpha = 0.08
    ctx.drawImage(img, -200, -200, W+400, H+400); ctx.restore()
  }

  drawAccentBar(ctx, W, is ? 56 : 44, PAD)

  // VERDICT label
  const headY = is ? 140 : 108
  ctx.fillStyle = 'rgba(0,245,255,0.5)'
  ctx.font = `700 ${is ? 38 : 26}px 'Orbitron', Arial`
  ctx.textAlign = 'center'; ctx.letterSpacing = '8px'
  ctx.fillText('VERDICT', W/2, headY); ctx.letterSpacing = '0px'

  drawDivider(ctx, W/2, headY + (is ? 24 : 18), W/2 - PAD, 'rgba(0,245,255,0.2)')

  // Opening quote mark
  ctx.fillStyle = 'rgba(0,245,255,0.12)'
  ctx.font = `bold ${is ? 200 : 140}px Georgia, serif`
  ctx.textAlign = 'left'
  ctx.fillText('"', PAD - (is ? 10 : 8), headY + (is ? 130 : 96))

  // Verdict text — serif feel
  const maxChars = is ? 420 : 340
  const snippet  = review.verdict.length > maxChars ? review.verdict.slice(0, maxChars).trim() + '...' : review.verdict
  ctx.fillStyle = 'rgba(218,218,240,0.88)'
  ctx.font = `${is ? 44 : 32}px 'Space Grotesk', Arial`
  const verdictEndY = wrapText(ctx, snippet, PAD, headY + (is ? 110 : 82), W - PAD*2, is ? 64 : 48, 'left')

  // Refined divider
  drawDivider(ctx, W/2, verdictEndY + (is ? 32 : 24), W/2 - PAD, 'rgba(255,255,255,0.1)')

  // Rating card
  const cardY  = verdictEndY + (is ? 72 : 54)
  const cardH  = is ? 320 : 226
  // Card bg
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  rr(ctx, PAD, cardY, W - PAD*2, cardH, 20); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1.5
  rr(ctx, PAD, cardY, W - PAD*2, cardH, 20); ctx.stroke()
  // Top accent on card
  const cg = ctx.createLinearGradient(PAD, 0, W-PAD, 0)
  cg.addColorStop(0, 'transparent')
  cg.addColorStop(0.3, 'rgba(0,245,255,0.4)')
  cg.addColorStop(0.7, 'rgba(180,0,255,0.4)')
  cg.addColorStop(1, 'transparent')
  ctx.fillStyle = cg; ctx.fillRect(PAD + 20, cardY, W - PAD*2 - 40, 2)

  const mid = cardY + cardH / 2
  ctx.fillStyle = 'rgba(0,245,255,0.55)'
  ctx.font = `600 ${is ? 32 : 22}px 'Orbitron', Arial`
  ctx.textAlign = 'center'; ctx.letterSpacing = '3px'
  ctx.fillText(review.artist.toUpperCase(), W/2, mid - (is ? 95 : 68)); ctx.letterSpacing = '0px'

  ctx.fillStyle = 'rgba(248,248,255,0.95)'
  ctx.font = `bold ${is ? 58 : 40}px 'Space Grotesk', Arial`
  ctx.fillText(clip(ctx, review.albumName, W - PAD*3), W/2, mid - (is ? 28 : 18))

  // Rating number — big, neon white if perfect
  const { fill, glow } = rc(review.rating)
  ctx.save()
  if (review.rating >= 5) { ctx.shadowColor = glow; ctx.shadowBlur = 50 }
  ctx.fillStyle = fill
  ctx.font = `bold ${is ? 80 : 56}px 'Orbitron', Arial`
  ctx.textAlign = 'center'
  ctx.fillText(`${review.rating} / 5`, W/2, mid + (is ? 56 : 40))
  ctx.restore()

  // Stars
  drawStars(ctx, review.rating, W/2, mid + (is ? 120 : 88), is ? 26 : 18)

  drawAccentBar(ctx, W, H - (is ? 76 : 58), PAD)
  drawWatermark(ctx, W, H, PAD, is ? 26 : 20)
}

// ── Frame list ────────────────────────────────────────────────────────────────
function getFrames(review: ReviewData) {
  const f: { label: string; type: 'intro'|'tracks'|'verdict'; page?: number }[] = []
  f.push({ label: 'Intro', type: 'intro' })
  const pages = Math.ceil(review.tracks.length / 10)
  for (let i = 0; i < pages; i++) f.push({ label: pages > 1 ? `Tracks ${i+1}/${pages}` : 'Tracks', type: 'tracks', page: i })
  f.push({ label: 'Verdict', type: 'verdict' })
  return f
}

async function renderFrame(canvas: HTMLCanvasElement, review: ReviewData, idx: number, ratio: Ratio) {
  const frames = getFrames(review)
  const f = frames[idx]; if (!f) return
  if (f.type === 'intro')   await drawIntro(canvas, review, ratio)
  else if (f.type === 'tracks') await drawTracks(canvas, review, ratio, f.page ?? 0)
  else                          await drawVerdict(canvas, review, ratio)
}

// ── Dashboard component ───────────────────────────────────────────────────────
export default function FrameCreator() {
  const [posts, setPosts]           = useState<{path:string;title:string}[]>([])
  const [postsLoading, setPL]       = useState(false)
  const [selectedPath, setSP]       = useState('')
  const [review, setReview]         = useState<ReviewData | null>(null)
  const [loading, setLoading]       = useState(false)
  const [ratio, setRatio]           = useState<Ratio>('9:16')
  const [activeFrame, setAF]        = useState(0)
  const [rendering, setRendering]   = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      setPL(true)
      const files = await listPostFiles()
      const entries: {path:string;title:string}[] = []
      for (const f of files) {
        const raw = await getFileContent(f.path)
        if (!raw || !raw.includes('Music Reviews')) continue
        const fm = parseFrontmatter(raw)
        if (fm.draft === 'true') continue
        entries.push({ path: f.path, title: (fm.title||f.name).replace(/^"|"$/g,'') })
      }
      setPosts(entries); setPL(false)
    }
    load()
  }, [])

  async function loadReview(path: string) {
    setLoading(true)
    const raw = await getFileContent(path)
    if (!raw) { setLoading(false); return }
    const fm   = parseFrontmatter(raw)
    const body = raw.replace(/^---[\s\S]*?---\n/,'').trim()
    const tracks  = parseTracks(fm.tracklist || '')
    const verdict = extractSection(body,'Verdict')
    const slug    = path.replace('content/posts/','').replace('.md','')
    const title   = fm.title?.replace(/^"|"$/g,'') || ''
    const di      = title.lastIndexOf(' - ')
    setReview({
      title, albumName: di>-1 ? title.slice(0,di).trim() : title,
      artist: di>-1 ? title.slice(di+3).replace(/ Review$/,'').trim() : '',
      rating: parseFloat(fm.rating||'0'), tracks, verdict,
      summary: fm.summary||'', imageUrl:`https://www.theadrianblog.com/posts/${slug}.jpg`, slug,
    })
    setAF(0); setLoading(false)
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
    const frames = getFrames(review)
    const label  = frames[activeFrame]?.label.toLowerCase().replace(/[^a-z0-9]/g,'-') || activeFrame
    const a = document.createElement('a')
    a.download = `${review.slug}-${label}-${ratio.replace(':','x')}.png`
    a.href = canvasRef.current.toDataURL('image/png'); a.click()
  }

  async function downloadAll() {
    if (!canvasRef.current || !review) return
    const frames = getFrames(review)
    for (let i = 0; i < frames.length; i++) {
      await renderFrame(canvasRef.current, review, i, ratio)
      const label = frames[i].label.toLowerCase().replace(/[^a-z0-9]/g,'-')
      const a = document.createElement('a')
      a.download = `${review.slug}-${String(i+1).padStart(2,'0')}-${label}-${ratio.replace(':','x')}.png`
      a.href = canvasRef.current.toDataURL('image/png'); a.click()
      await new Promise(r => setTimeout(r, 350))
    }
    await renderFrame(canvasRef.current, review, activeFrame, ratio)
  }

  const frames = review ? getFrames(review) : []

  return (
    <div className="db-section">
      <h2 className="db-section-title">Frame Creator</h2>
      <div className="db-card">
        <label className="db-label">Select Review</label>
        {postsLoading ? <p className="db-hint">Loading from GitHub...</p> : (
          <select className="db-select" value={selectedPath}
            onChange={e => { setSP(e.target.value); if (e.target.value) loadReview(e.target.value) }}>
            <option value="">— Choose a review —</option>
            {posts.map(p => <option key={p.path} value={p.path}>{p.title}</option>)}
          </select>
        )}
        {loading && <p className="db-hint" style={{marginTop:'0.5rem'}}>Loading review...</p>}
      </div>

      {review && (<>
        <div className="db-card">
          <div style={{display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap'}}>
            <div>
              <label className="db-label" style={{marginBottom:'6px'}}>Ratio</label>
              <div style={{display:'flex',gap:'6px'}}>
                {(['9:16','1:1'] as Ratio[]).map(r => (
                  <button key={r} className={`db-btn db-btn--sm ${ratio===r?'db-btn--active':''}`} onClick={()=>setRatio(r)}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{flex:1}}>
              <label className="db-label" style={{marginBottom:'6px'}}>Frame</label>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {frames.map((f,i) => (
                  <button key={i} className={`db-btn db-btn--sm ${activeFrame===i?'db-btn--active':''}`} onClick={()=>setAF(i)}>{f.label}</button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',flexShrink:0}}>
              <button className="db-btn db-btn--sm" onClick={download} disabled={rendering}>↓ Frame</button>
              <button className="db-btn db-btn--publish" onClick={downloadAll} disabled={rendering}>↓ All {frames.length}</button>
            </div>
          </div>
        </div>

        <div className="db-card" style={{padding:'1rem'}}>
          <p className="db-hint" style={{marginBottom:'0.75rem'}}>
            {frames.length} frames · {review.tracks.length} tracks
            {review.tracks.length > 10 ? ` · splits across ${Math.ceil(review.tracks.length/10)} track pages` : ''}
          </p>
          <div className="fc-preview-wrap" style={{aspectRatio:ratio==='9:16'?'9/16':'1/1'}}>
            {rendering && <div className="fc-rendering">Rendering...</div>}
            <canvas ref={canvasRef} className="fc-canvas" />
          </div>
        </div>
      </>)}
    </div>
  )
}
