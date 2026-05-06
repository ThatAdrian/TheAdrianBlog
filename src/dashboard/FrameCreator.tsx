import React, { useState, useRef, useEffect, useCallback } from 'react'
import { listPostFiles, getFileContent } from './github'

interface Track { name: string; rating: number }
interface ReviewData {
  title: string; artist: string; albumName: string; rating: number
  tracks: Track[]; verdict: string; summary: string
  imageUrl: string; slug: string
}
type Ratio = '9:16' | '1:1'

// ── Exact rating colors from Music.tsx — 5 star overridden to neon white ──────
function ratingColor(r: number): string {
  if (r >= 5)   return '#ffffff'  // neon white (overrides #ff00ff)
  if (r >= 4.5) return '#dd00ff'
  if (r >= 4)   return '#0088ff'
  if (r >= 3.5) return '#00bbaa'
  if (r >= 3)   return '#00cc44'
  if (r >= 2.5) return '#aadd00'
  if (r >= 2)   return '#ffd000'
  if (r >= 1.5) return '#ff8c00'
  if (r >= 1)   return '#ff6600'
  return '#e63333'
}

// ── Blog exact palette ────────────────────────────────────────────────────────
const BG        = '#07051a'
const CYAN      = '#00f5ff'
const TEXT_PRI  = 'rgba(220,220,255,0.92)'
const TEXT_MUT  = 'rgba(200,200,255,0.42)'
const CARD_BG   = 'rgba(255,255,255,0.025)'
const CARD_BDR  = 'rgba(255,255,255,0.08)'
const SEPARATOR = 'rgba(255,255,255,0.07)'

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
let fontsReady = false
async function loadFonts() {
  if (fontsReady) return
  try {
    const load = (name: string, url: string, opts?: object) =>
      new FontFace(name, `url(${url})`, opts).load().then(f => { document.fonts.add(f) })
    await Promise.all([
      load('Space Grotesk', 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFRntYZgAmQ.woff2'),
      load('Space Grotesk', 'https://fonts.gstatic.com/s/spacegrotesk/v16/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gowFRntYZgAmQ.woff2', { weight: '700' }),
      load('Orbitron',      'https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6xpmIyXjU1pg.woff2', { weight: '700' }),
      load('Space Mono',    'https://fonts.gstatic.com/s/spacemono/v13/i7dPIFZifjKcF5UAWdDRYE98RXi4EwSsbg.woff2'),
    ])
  } catch { /* fonts fall back to system */ }
  fontsReady = true
}

async function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(r => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => r(i); i.onerror = () => r(null); i.src = url
  })
}

// ── Canvas primitives ─────────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, align: CanvasTextAlign = 'left'): number {
  ctx.textAlign = align
  const words = text.split(' '); let line = ''
  for (const word of words) {
    const t = line + word + ' '
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, y); line = word + ' '; y += lineH }
    else line = t
  }
  if (line.trim()) { ctx.fillText(line.trim(), x, y); y += lineH }
  return y
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (ctx.measureText(t + '…').width > maxW && t.length) t = t.slice(0,-1)
  return t + '…'
}

// ── Shared background — matches blog DotGrid ──────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  // Dot grid — same as blog's DotGrid component
  ctx.fillStyle = 'rgba(50,40,80,0.55)'
  const gap = 56
  for (let x = gap; x < W; x += gap)
    for (let y = gap; y < H; y += gap) {
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI*2); ctx.fill()
    }
  // Active dots (bright) — sparse
  ctx.fillStyle = 'rgba(155,40,123,0.5)'
  for (let x = gap*3; x < W; x += gap*7)
    for (let y = gap*3; y < H; y += gap*7) {
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI*2); ctx.fill()
    }
}

// ── Card — matches blog .db-card / GlassSurface ───────────────────────────────
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = 16) {
  rrect(ctx, x, y, w, h, radius)
  ctx.fillStyle = CARD_BG; ctx.fill()
  ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke()
}

// ── Separator — blog's card border style ─────────────────────────────────────
function drawSep(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = SEPARATOR; ctx.fillRect(x, y, w, 1)
}

// ── Watermark ─────────────────────────────────────────────────────────────────
function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, sz: number) {
  ctx.font = `500 ${sz}px 'Space Mono', monospace`
  ctx.fillStyle = 'rgba(0,245,255,0.28)'
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W/2, H - sz * 1.2)
}

// ── Rating pill — same visual language as blog's top-albums row ───────────────
function drawRatingPill(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, pillW: number, pillH: number) {
  const col = ratingColor(rating)
  // Pill bg
  rrect(ctx, cx - pillW/2, cy - pillH/2, pillW, pillH, pillH/2)
  ctx.fillStyle = col + '1a'; ctx.fill()
  ctx.strokeStyle = col + '55'; ctx.lineWidth = 1.2; ctx.stroke()
  // Number
  ctx.save()
  if (rating >= 5) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 18 }
  ctx.fillStyle = col
  ctx.font = `bold ${pillH * 0.58}px 'Space Mono', monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${rating}`, cx, cy + 1)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
}

// ── Stars row ─────────────────────────────────────────────────────────────────
function drawStars(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, size: number) {
  const count = 5
  const gap = size * 0.3
  const total = count * size * 2 + (count-1) * gap
  let x = cx - total/2 + size
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.font = `${size * 2}px Arial`
  for (let i = 0; i < count; i++) {
    const filled = rating >= i + 1
    const half   = !filled && rating >= i + 0.5
    const col = filled || half ? ratingColor(Math.min(rating, i + 1)) : 'rgba(255,255,255,0.1)'
    ctx.save()
    if ((filled || half) && rating >= 5 && i < 5) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 16 }
    ctx.fillStyle = col
    ctx.fillText(filled ? '★' : half ? '⭐' : '☆', x, cy)
    ctx.restore()
    x += size * 2 + gap
  }
  ctx.textBaseline = 'alphabetic'
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 0 — INTRO
// Full-bleed album art with cinematic bottom fade, text section below
// ─────────────────────────────────────────────────────────────────────────────
async function drawIntro(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is = ratio === '9:16'
  const PAD = is ? 72 : 64
  // TikTok safe zone
  const SAFE_TOP    = is ? 160 : 0
  const SAFE_BOTTOM = is ? 1570 : H
  const SAFE_RIGHT  = is ? 940 : W
  const SAFE_H      = SAFE_BOTTOM - SAFE_TOP

  drawBackground(ctx, W, H)

  // Album art — full-bleed top portion
  const artH = is ? 1080 : 620
  const img = await loadImg(review.imageUrl)
  if (img) {
    ctx.save()
    // Clip to top section
    ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
    ctx.drawImage(img, 0, 0, W, artH)
    ctx.restore()
    // Cinematic fade — bottom of art bleeds into background
    const fadeH = is ? 380 : 280
    const fade = ctx.createLinearGradient(0, artH - fadeH, 0, artH)
    fade.addColorStop(0, 'rgba(7,5,26,0)')
    fade.addColorStop(0.5, 'rgba(7,5,26,0.6)')
    fade.addColorStop(1, BG)
    ctx.fillStyle = fade; ctx.fillRect(0, artH - fadeH, W, fadeH)
    // Top vignette
    const topFade = ctx.createLinearGradient(0, 0, 0, is ? 200 : 120)
    topFade.addColorStop(0, 'rgba(7,5,26,0.5)')
    topFade.addColorStop(1, 'rgba(7,5,26,0)')
    ctx.fillStyle = topFade; ctx.fillRect(0, 0, W, is ? 200 : 120)
  }

  // Text section
  const textY = artH - (is ? 80 : 50)

  // Artist — Orbitron cyan, small caps
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `700 ${is ? 36 : 26}px 'Orbitron', monospace`
  ctx.textAlign = 'center'
  ctx.letterSpacing = '5px'
  ctx.fillText(review.artist.toUpperCase(), W/2, textY)
  ctx.letterSpacing = '0px'

  // Album name — Space Grotesk bold, large white
  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 72 : 52}px 'Space Grotesk', sans-serif`
  const nameEndY = wrapText(ctx, review.albumName, W/2, textY + (is ? 72 : 52), W - PAD*2, is ? 82 : 60, 'center')

  // Thin separator
  drawSep(ctx, PAD, nameEndY + (is ? 18 : 14), W - PAD*2)

  // Summary
  if (review.summary) {
    ctx.fillStyle = TEXT_MUT
    ctx.font = `${is ? 36 : 26}px 'Space Grotesk', sans-serif`
    wrapText(ctx, `"${review.summary}"`, W/2, nameEndY + (is ? 56 : 42), W - PAD*2.2, is ? 50 : 38, 'center')
  }

  drawWatermark(ctx, W, H, is ? 26 : 20)
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 1+ — TRACKS
// 10 per page, clean list matching blog's top-albums visual style
// ─────────────────────────────────────────────────────────────────────────────
async function drawTracks(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio, page: number) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is = ratio === '9:16'
  const PAD = is ? 72 : 64
  // TikTok safe zone
  const SAFE_TOP    = is ? 160 : 0
  const SAFE_BOTTOM = is ? 1570 : H
  const SAFE_RIGHT  = is ? 940 : W
  const SAFE_H      = SAFE_BOTTOM - SAFE_TOP

  drawBackground(ctx, W, H)

  // Header card
  const cardPad  = is ? 32 : 24
  const thumbSz  = is ? 110 : 86
  const headerH  = thumbSz + cardPad * 2
  const headerY  = is ? 72 : 58
  drawCard(ctx, PAD, headerY, W - PAD*2, headerH)

  const img = await loadImg(review.imageUrl)
  if (img) {
    ctx.save()
    rrect(ctx, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz, 10); ctx.clip()
    ctx.drawImage(img, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz)
    ctx.restore()
    ctx.save()
    rrect(ctx, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz, 10)
    ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke(); ctx.restore()
  }

  const hx = PAD + cardPad + thumbSz + (is ? 24 : 18)
  const hmid = headerY + headerH/2
  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 44 : 32}px 'Space Grotesk', sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(clip(ctx, review.albumName, W - hx - PAD - cardPad), hx, hmid - (is ? 14 : 10))
  ctx.fillStyle = CYAN + 'bb'
  ctx.font = `700 ${is ? 28 : 20}px 'Orbitron', monospace`
  ctx.letterSpacing = '2px'
  ctx.fillText(clip(ctx, review.artist.toUpperCase(), W - hx - PAD - cardPad), hx, hmid + (is ? 26 : 18))
  ctx.letterSpacing = '0px'

  // Tracks section label
  const totalPages = Math.ceil(review.tracks.length / 10)
  const labelY = headerY + headerH + (is ? 44 : 32)
  ctx.fillStyle = CYAN + '88'
  ctx.font = `700 ${is ? 24 : 18}px 'Orbitron', monospace`
  ctx.letterSpacing = '4px'; ctx.textAlign = 'left'
  ctx.fillText(totalPages > 1 ? `TRACKS  ${page+1} / ${totalPages}` : 'TRACKS', PAD, labelY)
  ctx.letterSpacing = '0px'

  // Track list card
  const PER = Math.ceil(review.tracks.length / totalPages)
  const pageTracks = review.tracks.slice(page * PER, (page+1) * PER)
  const listY = labelY + (is ? 20 : 16)
  const listH = (is ? SAFE_BOTTOM : H) - listY - (is ? 32 : 76)
  drawCard(ctx, PAD, listY, W - PAD*2, listH, 16)

  const rowH = listH / pageTracks.length
  pageTracks.forEach((track, i) => {
    const ry    = listY + i * rowH
    const midY  = ry + rowH / 2
    const col   = ratingColor(track.rating)
    const isFive = track.rating >= 5

    // Separator between rows (not before first)
    if (i > 0) drawSep(ctx, PAD + 16, ry, W - PAD*2 - 32)

    // Left colored bar
    ctx.fillStyle = col + '70'
    ctx.fillRect(PAD, ry + (i === 0 ? 1 : 0), 3, rowH - (i === 0 ? 1 : 0) - (i === pageTracks.length-1 ? 1 : 0))

    // Track number
    ctx.fillStyle = TEXT_MUT
    ctx.font = `${is ? 24 : 18}px 'Space Mono', monospace`
    ctx.textAlign = 'left'
    ctx.fillText(String(page * PER + i + 1).padStart(2, '0'), PAD + (is ? 18 : 14), midY + (is ? 8 : 6))

    // Track name — brighter for high-rated tracks
    const numW   = is ? 58 : 44
    const pillW  = is ? 100 : 76
    const nameW  = W - PAD*2 - numW - pillW - (is ? 36 : 28) - 16
    ctx.fillStyle = isFive ? '#ffffff' : track.rating >= 4.5 ? TEXT_PRI : 'rgba(200,200,230,0.75)'
    ctx.font = `${isFive ? 'bold ' : ''}${is ? 34 : 25}px 'Space Grotesk', sans-serif`
    ctx.fillText(clip(ctx, track.name, nameW), PAD + numW + (is ? 16 : 12), midY + (is ? 10 : 8))

    // Rating pill — blog's top-albums style
    drawRatingPill(ctx, track.rating, W - PAD - pillW/2 - (is ? 4 : 3), midY, pillW, is ? 46 : 34)
  })

  ctx.font = `500 ${is ? 24 : 19}px 'Space Mono', monospace`
  ctx.fillStyle = 'rgba(0,245,255,0.28)'
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W/2, is ? SAFE_BOTTOM - 20 : H - 28)
}

// ─────────────────────────────────────────────────────────────────────────────
// LAST FRAME — VERDICT
// Album art header, verdict text, rating card with stars
// ─────────────────────────────────────────────────────────────────────────────
async function drawVerdict(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 72 : 64
  // TikTok safe zone — keep content inside these bounds
  const SAFE_TOP    = is ? 160 : 0
  const SAFE_BOTTOM = is ? 1570 : H   // 350px clear at bottom
  const SAFE_RIGHT  = is ? 940 : W    // 140px clear on right
  const SAFE_H      = SAFE_BOTTOM - SAFE_TOP

  drawBackground(ctx, W, H)

  // ── Album art — full-bleed cinematic, same as intro frame ──────────────────
  const artH = is ? SAFE_TOP + 820 : 460
  const img  = await loadImg(review.imageUrl)
  if (img) {
    ctx.save()
    ctx.beginPath(); ctx.rect(0, SAFE_TOP, W, artH - SAFE_TOP); ctx.clip()
    ctx.drawImage(img, 0, SAFE_TOP, W, artH - SAFE_TOP)
    ctx.restore()
    // Bottom fade into background
    const fadeH = is ? 380 : 240
    const fade  = ctx.createLinearGradient(0, artH - fadeH, 0, artH)
    fade.addColorStop(0, 'rgba(7,5,26,0)')
    fade.addColorStop(0.55, 'rgba(7,5,26,0.65)')
    fade.addColorStop(1, BG)
    ctx.fillStyle = fade; ctx.fillRect(0, artH - fadeH, W, fadeH)
    // Top vignette
    const topF = ctx.createLinearGradient(0, 0, 0, is ? 180 : 100)
    topF.addColorStop(0, 'rgba(7,5,26,0.45)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
    ctx.fillStyle = topF; ctx.fillRect(0, 0, W, is ? 180 : 100)
  }

  // ── Artist + album name — sits over the fade zone ─────────────────────────
  const nameBaseY = is ? Math.min(artH - 60, SAFE_BOTTOM - 240) : artH - 40

  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `700 ${is ? 34 : 24}px 'Orbitron', monospace`
  ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
  ctx.fillText(review.artist.toUpperCase(), W/2, nameBaseY - (is ? 76 : 52))
  ctx.letterSpacing = '0px'

  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 68 : 48}px 'Space Grotesk', sans-serif`
  ctx.fillText(clip(ctx, review.albumName, W - PAD * 2.2), W/2, nameBaseY)

  // ── Anchor bottom elements first so nothing overflows ─────────────────────
  // Watermark
  const wmH    = is ? 50 : 38
  // CTA box — anchored inside safe zone
  const ctaH   = is ? 76 : 56
  const ctaY   = (is ? SAFE_BOTTOM : H) - wmH - ctaH - (is ? 24 : 18)
  // Rating card — fixed height, above CTA
  const rcardH = is ? 230 : 168
  const rcardY = ctaY - (is ? 22 : 16) - rcardH
  // Separator above rating card
  const sepY   = rcardY - (is ? 22 : 16)

  // ── VERDICT label — sits just below art ───────────────────────────────────
  const vLabelY = artH + (is ? 40 : 38)
  ctx.fillStyle = 'rgba(0,245,255,0.48)'
  ctx.font = `700 ${is ? 26 : 19}px 'Orbitron', monospace`
  ctx.letterSpacing = '5px'; ctx.textAlign = 'center'
  ctx.fillText('VERDICT', W/2, vLabelY); ctx.letterSpacing = '0px'
  drawSep(ctx, PAD, vLabelY + (is ? 16 : 12), W - PAD * 2)

  // ── Verdict card — fills space between label and rating card ──────────────
  const vcardY   = vLabelY + (is ? 32 : 24)
  const vcardH   = sepY - vcardY - (is ? 8 : 6)
  const textPad  = is ? 32 : 26
  const lineH    = is ? 56 : 40
  const maxTextW = W - PAD * 2 - textPad * 2

  // Trim verdict to fit card height
  ctx.font = `${is ? 38 : 28}px 'Space Grotesk', sans-serif`
  const maxLines = Math.floor((vcardH - textPad * 2) / lineH)
  let words = review.verdict.split(' ')
  let lines: string[] = []; let line = ''
  for (const w of words) {
    const t = line + w + ' '
    if (ctx.measureText(t).width > maxTextW && line) { lines.push(line.trim()); line = w + ' ' }
    else line = t
  }
  if (line.trim()) lines.push(line.trim())
  if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines[maxLines - 1].replace(/\s*\w+$/, '…')]
  const snippet = lines.join(' ')

  drawCard(ctx, PAD, vcardY, W - PAD * 2, vcardH, 14)
  ctx.fillStyle = 'rgba(210,210,235,0.82)'
  wrapText(ctx, snippet, PAD + textPad, vcardY + textPad + lineH * 0.72, maxTextW, lineH, 'left')

  // ── Separator ─────────────────────────────────────────────────────────────
  drawSep(ctx, PAD, sepY, W - PAD * 2)

  // ── Rating card ───────────────────────────────────────────────────────────
  drawCard(ctx, PAD, rcardY, W - PAD * 2, rcardH, 16)
  ctx.fillStyle = 'rgba(0,245,255,0.16)'
  ctx.fillRect(PAD + 2, rcardY, W - PAD * 2 - 4, 1)

  const rmid = rcardY + rcardH / 2
  const col  = ratingColor(review.rating)

  ctx.save()
  if (review.rating >= 5) { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40 }
  ctx.fillStyle = col
  ctx.font = `bold ${is ? 82 : 58}px 'Orbitron', monospace`
  ctx.textAlign = 'center'
  ctx.fillText(`${review.rating} / 5`, W/2, rmid + (is ? 18 : 12))
  ctx.restore()

  drawStars(ctx, review.rating, W/2, rmid + (is ? 82 : 58), is ? 22 : 16)

  // ── CTA box — anchored to bottom ──────────────────────────────────────────
  drawCard(ctx, PAD, ctaY, W - PAD * 2, ctaH, ctaH / 2)
  ctx.fillStyle = 'rgba(0,245,255,0.18)'
  ctx.fillRect(PAD + 2, ctaY, W - PAD * 2 - 4, 1)
  ctx.fillStyle = 'rgba(200,200,255,0.48)'
  ctx.font = `${is ? 24 : 18}px 'Space Grotesk', sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('for more reviews visit', W/2, ctaY + ctaH * 0.4)
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `bold ${is ? 28 : 21}px 'Orbitron', monospace`
  ctx.letterSpacing = '1px'
  ctx.fillText('TheAdrianBlog.com', W/2, ctaY + ctaH * 0.8)
  ctx.letterSpacing = '0px'

  // Watermark inside safe zone
  ctx.font = `500 ${is ? 24 : 19}px 'Space Mono', monospace`
  ctx.fillStyle = 'rgba(0,245,255,0.28)'
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W/2, is ? SAFE_BOTTOM - 20 : H - 28)
}

// ── Frame list ────────────────────────────────────────────────────────────────
function getFrames(r: ReviewData) {
  const f: { label: string; type: 'intro'|'tracks'|'verdict'; page?: number }[] = [{ label: 'Intro', type: 'intro' }]
  const pages = Math.ceil(r.tracks.length / 10)
  for (let i = 0; i < pages; i++) f.push({ label: pages > 1 ? `Tracks ${i+1}/${pages}` : 'Tracks', type: 'tracks', page: i })
  f.push({ label: 'Verdict', type: 'verdict' })
  return f
}

async function renderFrame(canvas: HTMLCanvasElement, review: ReviewData, idx: number, ratio: Ratio) {
  const f = getFrames(review)[idx]; if (!f) return
  if (f.type === 'intro')   return drawIntro(canvas, review, ratio)
  if (f.type === 'tracks')  return drawTracks(canvas, review, ratio, f.page ?? 0)
  return drawVerdict(canvas, review, ratio)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FrameCreator() {
  const [posts, setPosts]     = useState<{path:string;title:string}[]>([])
  const [postsLoading, setPL] = useState(false)
  const [selectedPath, setSP] = useState('')
  const [review, setReview]   = useState<ReviewData | null>(null)
  const [loading, setL]       = useState(false)
  const [ratio, setRatio]     = useState<Ratio>('9:16')
  const [activeFrame, setAF]  = useState(0)
  const [rendering, setRend]  = useState(false)
  const [caption, setCaption]   = useState('')
  const [copied, setCopied]     = useState(false)
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
    setL(true)
    const raw = await getFileContent(path); if (!raw) { setL(false); return }
    const fm = parseFrontmatter(raw)
    const body = raw.replace(/^---[\s\S]*?---\n/,'').trim()
    const tracks = parseTracks(fm.tracklist||'')
    const verdict = extractSection(body,'Verdict')
    const slug = path.replace('content/posts/','').replace('.md','')
    const title = fm.title?.replace(/^"|"$/g,'')||''
    const di = title.lastIndexOf(' - ')
    setReview({
      title, albumName: di>-1 ? title.slice(0,di).trim() : title,
      artist: di>-1 ? title.slice(di+3).replace(/ Review$/,'').trim() : '',
      rating: parseFloat(fm.rating||'0'), tracks, verdict,
      summary: fm.summary||'',
      imageUrl: fm.image ? `https://www.theadrianblog.com/${fm.image}` : `https://www.theadrianblog.com/posts/${slug}.jpg`, slug,
    })
    setAF(0); setL(false)
  }


  function generateCaption(r: ReviewData): string {
    const topTracks = [...r.tracks].sort((a, b) => b.rating - a.rating).slice(0, 3).map(t => t.name)
    const ratingLabel =
      r.rating >= 5   ? 'a perfect score' :
      r.rating >= 4.5 ? 'an incredibly strong album' :
      r.rating >= 4   ? 'a solid listen' :
      r.rating >= 3.5 ? 'a decent album' :
      r.rating >= 3   ? 'an ok record' : 'a mixed bag'
    const trackMention = topTracks.length > 0
      ? `Standout tracks include ${topTracks.slice(0,-1).join(', ')}${topTracks.length > 1 ? ` and ${topTracks[topTracks.length-1]}` : ''}.`
      : ''
    const verdict = r.verdict ? r.verdict.split('.')[0].trim() + '.' : ''
    return `${r.albumName} by ${r.artist} — ${ratingLabel} at ${r.rating}/5. ${verdict} ${trackMention}

Full review on TheAdrianBlog.com

#${r.artist.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()} #${r.albumName.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()} #musicreview #albumreview #newmusic #music #indiemusic #musicblog #albumoftheweek #musictok #theadrianblog`.trim()
  }

  const render = useCallback(async () => {
    if (!review || !canvasRef.current) return
    setRend(true)
    await renderFrame(canvasRef.current, review, activeFrame, ratio)
    setRend(false)
  }, [review, activeFrame, ratio])

  useEffect(() => { render() }, [render])
  useEffect(() => { if (review) setCaption(generateCaption(review)) }, [review])

  function download() {
    if (!canvasRef.current || !review) return
    const label = getFrames(review)[activeFrame]?.label.toLowerCase().replace(/[^a-z0-9]/g,'-')||activeFrame
    const a = document.createElement('a')
    a.download = `${review.slug}-${label}-${ratio.replace(':','x')}.png`
    a.href = canvasRef.current.toDataURL('image/png'); a.click()
  }

  async function downloadAll() {
    if (!canvasRef.current || !review) return
    const frames = getFrames(review)
    for (let i = 0; i < frames.length; i++) {
      await renderFrame(canvasRef.current, review, i, ratio)
      const a = document.createElement('a')
      a.download = `${review.slug}-${String(i+1).padStart(2,'0')}-${frames[i].label.toLowerCase().replace(/[^a-z0-9]/g,'-')}-${ratio.replace(':','x')}.png`
      a.href = canvasRef.current.toDataURL('image/png'); a.click()
      await new Promise(r => setTimeout(r,350))
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
        {loading && <p className="db-hint" style={{marginTop:'0.5rem'}}>Loading...</p>}
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
            {frames.length} frames · {review.tracks.length} tracks{review.tracks.length > 10 ? ` · ${Math.ceil(review.tracks.length/10)} track pages` : ''}
          </p>
          <div className="fc-preview-wrap" style={{aspectRatio:ratio==='9:16'?'9/16':'1/1'}}>
            {rendering && <div className="fc-rendering">Rendering...</div>}
            <canvas ref={canvasRef} className="fc-canvas" />
          </div>
        </div>
        <div className="db-card" style={{marginTop:'1rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <label className="db-label" style={{marginBottom:0}}>Caption & Hashtags</label>
            <button
              className="db-btn db-btn--sm"
              onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            className="db-textarea"
            rows={8}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{fontFamily:"'Space Grotesk', sans-serif", fontSize:'0.82rem', lineHeight:1.6}}
          />
          <p className="db-hint" style={{marginTop:'0.5rem'}}>Edit before copying — this is auto-generated from your review.</p>
        </div>

      </>)}
    </div>
  )
}
