import React, { useState, useRef, useEffect, useCallback } from 'react'
import { listPostFiles, getFileContent } from './github'

interface Track { name: string; rating: number }
interface ReviewData {
  title: string; artist: string; albumName: string; rating: number
  tracks: Track[]; verdict: string; summary: string
  imageUrl: string; slug: string
}
type Ratio = '9:16' | '1:1'

// ── Exact rating colors from Music.tsx — 5 star = neon white ─────────────────
function ratingColor(r: number): string {
  if (r >= 5)   return '#ffffff'
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

const BG       = '#07051a'
const CYAN     = '#00f5ff'
const TEXT_PRI = 'rgba(220,220,255,0.92)'
const TEXT_MUT = 'rgba(200,200,255,0.42)'
const CARD_BG  = 'rgba(255,255,255,0.028)'
const CARD_BDR = 'rgba(255,255,255,0.09)'
const SEP_COL  = 'rgba(255,255,255,0.07)'

// TikTok safe zone constants for 1080x1920
// Top 160px: Following/For You tabs
// Bottom 350px: caption, username, sound (safe bottom = 1570)
// Right 140px: like/comment/share buttons (safe right = 940)
const TT_TOP  = 160
const TT_BOT  = 1630
const TT_RPAD = 140   // extra right padding on 9:16

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
  } catch { /* fallback to system fonts */ }
  fontsReady = true
}

async function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise(r => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => r(i); i.onerror = () => r(null); i.src = url
  })
}

// ── Canvas utils ──────────────────────────────────────────────────────────────
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
  for (const w of words) {
    const t = line + w + ' '
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line.trim(), x, y); line = w + ' '; y += lineH }
    else line = t
  }
  if (line.trim()) { ctx.fillText(line.trim(), x, y); y += lineH }
  return y
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (ctx.measureText(t + '…').width > maxW && t.length) t = t.slice(0, -1)
  return t + '…'
}

function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(50,40,80,0.5)'
  const gap = 56
  for (let x = gap; x < W; x += gap)
    for (let y = gap; y < H; y += gap) {
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI*2); ctx.fill()
    }
  const g1 = ctx.createRadialGradient(W*0.75, H*0.2, 0, W*0.75, H*0.2, W*0.55)
  g1.addColorStop(0, 'rgba(0,245,255,0.055)'); g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)
  const g2 = ctx.createRadialGradient(W*0.25, H*0.8, 0, W*0.25, H*0.8, W*0.5)
  g2.addColorStop(0, 'rgba(180,0,255,0.05)'); g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)
}

function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 16) {
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = CARD_BG; ctx.fill()
  ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke()
}

function drawSep(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = SEP_COL; ctx.fillRect(x, y, w, 1)
}

function drawWM(ctx: CanvasRenderingContext2D, W: number, y: number, sz: number) {
  ctx.font = `500 ${sz}px 'Space Mono', monospace`
  ctx.fillStyle = 'rgba(0,245,255,0.25)'
  ctx.textAlign = 'center'
  ctx.fillText('theadrianblog.com', W/2, y)
}

function drawStars(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, sz: number) {
  const sw = sz * 2.2, gap = sz * 0.4
  const total = 5 * sw + 4 * gap
  let x = cx - total/2 + sw/2
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < 5; i++) {
    const filled = rating >= i+1, half = !filled && rating >= i+0.5
    if (filled || half) {
      const col = ratingColor(Math.min(rating, i+1))
      ctx.save()
      if (rating >= 5) { ctx.shadowColor = '#fff'; ctx.shadowBlur = sz }
      ctx.fillStyle = col; ctx.font = `${sz*2}px Arial`
      ctx.fillText(filled ? '★' : '⭐', x, cy); ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.font = `${sz*2}px Arial`
      ctx.fillText('☆', x, cy)
    }
    x += sw + gap
  }
  ctx.textBaseline = 'alphabetic'
}

function drawRatingPill(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number, pw: number, ph: number) {
  const col = ratingColor(rating)
  rrect(ctx, cx - pw/2, cy - ph/2, pw, ph, ph/2)
  ctx.fillStyle = col + '1a'; ctx.fill()
  ctx.strokeStyle = col + '60'; ctx.lineWidth = 1.2; ctx.stroke()
  ctx.save()
  if (rating >= 5) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 14 }
  ctx.fillStyle = col
  ctx.font = `bold ${ph * 0.55}px 'Space Mono', monospace`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${rating}`, cx, cy + 1)
  ctx.restore(); ctx.textBaseline = 'alphabetic'
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 0 — INTRO
// Layout: Full-bleed art top 55%, text bottom 45%
// Safe zone respected: text starts well below TT_TOP
// ─────────────────────────────────────────────────────────────────────────────
async function drawIntro(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is = ratio === '9:16'
  const PAD = is ? 80 : 68
  // Effective right edge (avoid TikTok buttons on 9:16)
  const RW = is ? W - TT_RPAD : W

  drawBg(ctx, W, H)

  // Art fills top portion — starts at 0 (background, not critical content)
  const artH = is ? 1020 : 560
  const img  = await loadImg(review.imageUrl)
  if (img) {
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
    ctx.drawImage(img, 0, 0, W, artH)
    ctx.restore()
    const fadeH = is ? 420 : 260
    const fade  = ctx.createLinearGradient(0, artH - fadeH, 0, artH)
    fade.addColorStop(0, 'rgba(7,5,26,0)')
    fade.addColorStop(0.45, 'rgba(7,5,26,0.55)')
    fade.addColorStop(1, BG)
    ctx.fillStyle = fade; ctx.fillRect(0, artH - fadeH, W, fadeH)
    const topF = ctx.createLinearGradient(0, 0, 0, is ? 220 : 120)
    topF.addColorStop(0, 'rgba(7,5,26,0.5)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
    ctx.fillStyle = topF; ctx.fillRect(0, 0, W, is ? 220 : 120)
  }

  // Text section — starts inside art fade zone, all critical content below TT_TOP
  // Artist name
  const artistY = is ? artH - 120 : artH - 70
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `700 ${is ? 38 : 26}px 'Orbitron', monospace`
  ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
  ctx.fillText(review.artist.toUpperCase(), RW/2, artistY)
  ctx.letterSpacing = '0px'

  // Album name
  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 76 : 52}px 'Space Grotesk', sans-serif`
  const albumEndY = wrapText(ctx, review.albumName, RW/2, artistY + (is ? 72 : 50), RW - PAD*2, is ? 86 : 60, 'center')

  // Separator
  drawSep(ctx, PAD, albumEndY + (is ? 16 : 12), RW - PAD*2)

  // Summary
  if (review.summary) {
    ctx.fillStyle = TEXT_MUT
    ctx.font = `${is ? 38 : 26}px 'Space Grotesk', sans-serif`
    wrapText(ctx, `"${review.summary}"`, RW/2, albumEndY + (is ? 52 : 38), RW - PAD*2.2, is ? 54 : 38, 'center')
  }

  // Watermark — inside TT_BOT
  drawWM(ctx, W, is ? TT_BOT - 28 : H - 24, is ? 27 : 20)
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 1+ — TRACKS
// Header starts at TT_TOP, list fills to TT_BOT
// ─────────────────────────────────────────────────────────────────────────────
async function drawTracks(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio, page: number) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 80 : 68
  const RW  = is ? W - TT_RPAD : W
  const TOP = is ? TT_TOP : 0
  const BOT = is ? TT_BOT : H

  drawBg(ctx, W, H)

  // Header card — starts at safe top
  const cardPad = is ? 28 : 22
  const thumbSz = is ? 108 : 84
  const headerH = thumbSz + cardPad * 2
  const headerY = TOP + (is ? 100 : 14)
  drawCard(ctx, PAD, headerY, RW - PAD*2, headerH)

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

  const hx   = PAD + cardPad + thumbSz + (is ? 22 : 16)
  const hmid = headerY + headerH/2
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `700 ${is ? 26 : 18}px 'Orbitron', monospace`
  ctx.textAlign = 'left'; ctx.letterSpacing = '2px'
  ctx.fillText(clip(ctx, review.artist.toUpperCase(), RW - hx - PAD - cardPad), hx, hmid - (is ? 20 : 14))
  ctx.letterSpacing = '0px'
  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 46 : 32}px 'Space Grotesk', sans-serif`
  ctx.fillText(clip(ctx, review.albumName, RW - hx - PAD - cardPad), hx, hmid + (is ? 22 : 16))

  // Label
  const totalPages = Math.ceil(review.tracks.length / 10)
  const PER        = Math.ceil(review.tracks.length / totalPages)
  const pageTracks = review.tracks.slice(page * PER, (page+1) * PER)
  const labelY     = headerY + headerH + (is ? 36 : 26)
  // Label pill background
  const labelText = totalPages > 1 ? `TRACKS  ${page+1} / ${totalPages}` : 'TRACKS'
  ctx.font = `700 ${is ? 22 : 16}px 'Orbitron', monospace`
  ctx.letterSpacing = '4px'
  const labelW = ctx.measureText(labelText).width + (is ? 36 : 28)
  rrect(ctx, PAD, labelY - (is ? 28 : 20), labelW, is ? 38 : 28, is ? 10 : 8)
  ctx.fillStyle = 'rgba(0,245,255,0.08)'; ctx.fill()
  ctx.strokeStyle = 'rgba(0,245,255,0.2)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = CYAN + 'cc'
  ctx.textAlign = 'left'
  ctx.fillText(labelText, PAD + (is ? 18 : 14), labelY)
  ctx.letterSpacing = '0px'

  // Track list card
  const listY = labelY + (is ? 18 : 14)
  const listH = BOT - listY - (is ? 60 : 40)
  drawCard(ctx, PAD, listY, RW - PAD*2, listH, 14)

  const rowH = listH / pageTracks.length
  pageTracks.forEach((track, i) => {
    const ry   = listY + i * rowH
    const midY = ry + rowH / 2
    const col  = ratingColor(track.rating)

    if (i > 0) drawSep(ctx, PAD + 14, ry, RW - PAD*2 - 28)

    // Row glow for high-rated tracks
    if (track.rating >= 4.5) {
      const rowGlow = ctx.createLinearGradient(PAD, 0, PAD + (is ? 320 : 240), 0)
      rowGlow.addColorStop(0, col + '12')
      rowGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rowGlow
      rrect(ctx, PAD, ry + (i===0?1:0), RW - PAD*2, rowH - (i===0?1:0) - (i===pageTracks.length-1?1:0), 10)
      ctx.fill()
    }
    // Left accent bar — thicker for high rated
    const barW = track.rating >= 5 ? 5 : track.rating >= 4 ? 4 : 3
    ctx.save()
    if (track.rating >= 5) { ctx.shadowColor = col; ctx.shadowBlur = 12 }
    ctx.fillStyle = col + (track.rating >= 4 ? 'cc' : '65')
    ctx.fillRect(PAD, ry + (i===0?1:0), barW, rowH - (i===0?1:0) - (i===pageTracks.length-1?1:0))
    ctx.restore()

    // Track number
    ctx.fillStyle = col + '80'
    ctx.font = `bold ${is ? 28 : 20}px 'Space Mono', monospace`
    ctx.textAlign = 'left'
    ctx.fillText(String(page * PER + i + 1).padStart(2, '0'), PAD + (is ? 16 : 12), midY + (is ? 10 : 7))

    // Track name
    const numW  = is ? 62 : 46
    const pillW = is ? 110 : 80
    const pillH = is ? 54 : 38
    const nameW = RW - PAD*2 - numW - pillW - (is ? 36 : 26)
    const isFive = track.rating >= 5
    ctx.fillStyle = isFive ? '#ffffff' : track.rating >= 4.5 ? TEXT_PRI : 'rgba(205,205,235,0.82)'
    ctx.font = `${isFive ? 'bold ' : ''}${is ? 40 : 27}px 'Space Grotesk', sans-serif`
    ctx.fillText(clip(ctx, track.name, nameW), PAD + numW + (is ? 16 : 11), midY + (is ? 13 : 9))

    drawRatingPill(ctx, track.rating, RW - PAD - pillW/2 - (is ? 4 : 3), midY, pillW, pillH)
  })

  drawWM(ctx, W, is ? TT_BOT - 16 : H - 18, is ? 24 : 19)
}

// ─────────────────────────────────────────────────────────────────────────────
// LAST FRAME — VERDICT
// Art: cinematic full-bleed top (same as intro), compact 380px
// Everything else: fills the remaining safe zone
// Font auto-scales so full verdict always fits
// ─────────────────────────────────────────────────────────────────────────────
async function drawVerdict(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 80 : 68
  const RW  = is ? W - TT_RPAD : W
  const TOP = is ? TT_TOP : 0
  const BOT = is ? TT_BOT : H

  drawBg(ctx, W, H)

  // ── Full-bleed cinematic art — identical to intro frame ─────────────────────
  const artH = is ? 880 : 480
  const img  = await loadImg(review.imageUrl)
  if (img) {
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
    ctx.drawImage(img, 0, 0, W, artH)
    ctx.restore()
    // Same cinematic bottom fade as intro
    const fadeH = is ? 420 : 260
    const fade  = ctx.createLinearGradient(0, artH - fadeH, 0, artH)
    fade.addColorStop(0, 'rgba(7,5,26,0)')
    fade.addColorStop(0.45, 'rgba(7,5,26,0.65)')
    fade.addColorStop(1, BG)
    ctx.fillStyle = fade; ctx.fillRect(0, artH - fadeH, W, fadeH)
    // Top vignette
    const topF = ctx.createLinearGradient(0, 0, 0, is ? 220 : 120)
    topF.addColorStop(0, 'rgba(7,5,26,0.5)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
    ctx.fillStyle = topF; ctx.fillRect(0, 0, W, is ? 220 : 120)
  }

  // ── Artist + album name — same position as intro, over fade zone ──────────
  const artistY = artH - (is ? 120 : 72)
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `700 ${is ? 34 : 23}px 'Orbitron', monospace`
  ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
  ctx.fillText(clip(ctx, review.artist.toUpperCase(), RW - PAD*2), RW/2, artistY)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = TEXT_PRI
  ctx.font = `bold ${is ? 72 : 50}px 'Space Grotesk', sans-serif`
  const albumEndY2 = wrapText(ctx, review.albumName, RW/2, artistY + (is ? 72 : 50), RW - PAD*2, is ? 82 : 58, 'center')

  // ── Fixed bottom elements — anchored from BOT upward ─────────────────────
  const wmY    = BOT - (is ? 28 : 22)
  const ctaH   = is ? 78 : 56
  const ctaY   = wmY - (is ? 36 : 28) - ctaH
  const rcardH = is ? 222 : 162
  const rcardY = ctaY - (is ? 24 : 16) - rcardH
  const sepY   = rcardY - (is ? 24 : 16)

  // ── VERDICT label ─────────────────────────────────────────────────────────
  const vLabelY = artH + (is ? 36 : 24)
  ctx.fillStyle = 'rgba(0,245,255,0.5)'
  ctx.font = `700 ${is ? 24 : 17}px 'Orbitron', monospace`
  ctx.letterSpacing = '6px'; ctx.textAlign = 'center'
  ctx.fillText('VERDICT', RW/2, vLabelY); ctx.letterSpacing = '0px'
  drawSep(ctx, PAD, vLabelY + (is ? 14 : 10), RW - PAD*2)

  // ── Verdict card — ALL remaining space ────────────────────────────────────
  const vcardY = vLabelY + (is ? 32 : 22)
  const vcardH = Math.max(is ? 200 : 140, sepY - vcardY - (is ? 10 : 8))
  const tPad   = is ? 28 : 22
  const maxW   = RW - PAD*2 - tPad*2
  const verdictText = (review.verdict || 'No verdict written yet.').trim()

  // Auto-scale font to fit full verdict text
  let fontSize = is ? 38 : 27
  let lineH    = is ? 54 : 40
  let fittedLines: string[] = []

  while (fontSize >= (is ? 24 : 18)) {
    ctx.font = `${fontSize}px 'Space Grotesk', sans-serif`
    lineH = Math.round(fontSize * 1.45)
    const avail = Math.floor((vcardH - tPad * 2) / lineH)
    // Wrap all text
    const words  = verdictText.split(' ')
    const lines: string[] = []; let cur = ''
    for (const w of words) {
      const t = cur + w + ' '
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur.trim()); cur = w + ' ' } else cur = t
    }
    if (cur.trim()) lines.push(cur.trim())
    if (lines.length <= avail) { fittedLines = lines; break }
    if (fontSize === (is ? 24 : 18)) { fittedLines = lines.slice(0, avail); break }
    fontSize -= (is ? 2 : 2)
  }

  // Verdict card with cyan top accent
  ctx.save()
  rrect(ctx, PAD, vcardY, RW - PAD*2, vcardH, 14)
  ctx.fillStyle = CARD_BG; ctx.fill()
  ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()
  // Cyan top line accent
  ctx.fillStyle = CYAN + '30'
  ctx.fillRect(PAD + 2, vcardY, RW - PAD*2 - 4, 1.5)
  ctx.fillStyle = 'rgba(212,212,238,0.87)'
  ctx.font = `${fontSize}px 'Space Grotesk', sans-serif`
  ctx.textAlign = 'left'
  let ty = vcardY + tPad + lineH * 0.72
  for (const line of fittedLines) { ctx.fillText(line, PAD + tPad, ty); ty += lineH }

  // ── Separator ─────────────────────────────────────────────────────────────
  drawSep(ctx, PAD, sepY, RW - PAD*2)

  // ── Rating card ───────────────────────────────────────────────────────────
  drawCard(ctx, PAD, rcardY, RW - PAD*2, rcardH, 16)
  ctx.fillStyle = 'rgba(0,245,255,0.15)'
  ctx.fillRect(PAD + 2, rcardY, RW - PAD*2 - 4, 1)
  const rmid = rcardY + rcardH / 2
  const col  = ratingColor(review.rating)
  ctx.save()
  if (review.rating >= 5) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 40 }
  ctx.fillStyle = col
  ctx.font = `bold ${is ? 88 : 60}px 'Orbitron', monospace`
  ctx.textAlign = 'center'
  ctx.fillText(`${review.rating} / 5`, RW/2, rmid + (is ? 18 : 12))
  ctx.restore()
  drawStars(ctx, review.rating, RW/2, rmid + (is ? 84 : 58), is ? 23 : 16)

  // ── CTA ───────────────────────────────────────────────────────────────────
  drawCard(ctx, PAD, ctaY, RW - PAD*2, ctaH, ctaH/2)
  ctx.fillStyle = 'rgba(0,245,255,0.15)'
  ctx.fillRect(PAD + 2, ctaY, RW - PAD*2 - 4, 1)
  ctx.fillStyle = 'rgba(200,200,255,0.44)'
  ctx.font = `${is ? 23 : 16}px 'Space Grotesk', sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('for more reviews visit', RW/2, ctaY + ctaH * 0.37)
  ctx.fillStyle = CYAN + 'cc'
  ctx.font = `bold ${is ? 27 : 19}px 'Orbitron', monospace`
  ctx.letterSpacing = '1px'
  ctx.fillText('TheAdrianBlog.com', RW/2, ctaY + ctaH * 0.77)
  ctx.letterSpacing = '0px'

  drawWM(ctx, W, wmY, is ? 23 : 18)
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
  const [caption, setCaption] = useState('')
  const [copied, setCopied]   = useState(false)
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
    const fm   = parseFrontmatter(raw)
    const body = raw.replace(/^---[\s\S]*?---\n/,'').trim()
    const tracks  = parseTracks(fm.tracklist||'')
    const verdict = extractSection(body,'Verdict')
    const slug    = path.replace('content/posts/','').replace('.md','')
    const title   = fm.title?.replace(/^"|"$/g,'')||''
    const di      = title.lastIndexOf(' - ')
    const r: ReviewData = {
      title, albumName: di>-1 ? title.slice(0,di).trim() : title,
      artist: di>-1 ? title.slice(di+3).replace(/ Review$/,'').trim() : '',
      rating: parseFloat(fm.rating||'0'), tracks, verdict,
      summary: fm.summary||'',
      imageUrl: fm.image ? `https://www.theadrianblog.com/${fm.image}` : `https://www.theadrianblog.com/posts/${slug}.jpg`,
      slug,
    }
    setReview(r); setAF(0)
    // Generate caption
    const top3 = [...r.tracks].sort((a,b) => b.rating-a.rating).slice(0,3).map(t => t.name)
    const rLabel = r.rating>=5?'a perfect score':r.rating>=4.5?'an incredibly strong album':r.rating>=4?'a solid listen':r.rating>=3.5?'a decent album':'a mixed bag'
    const trackMention = top3.length > 0 ? `Standout tracks include ${top3.slice(0,-1).join(', ')}${top3.length>1?` and ${top3[top3.length-1]}`:''}. ` : ''
    const firstSentence = r.verdict ? r.verdict.split('.')[0].trim() + '.' : ''
    setCaption(`${r.albumName} by ${r.artist} — ${rLabel} at ${r.rating}/5. ${firstSentence} ${trackMention}\nFull review on TheAdrianBlog.com\n\n#${r.artist.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()} #${r.albumName.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()} #musicreview #albumreview #newmusic #music #indiemusic #musicblog #albumoftheweek #musictok #theadrianblog`.trim())
    setL(false)
  }

  const render = useCallback(async () => {
    if (!review || !canvasRef.current) return
    setRend(true)
    await renderFrame(canvasRef.current, review, activeFrame, ratio)
    setRend(false)
  }, [review, activeFrame, ratio])

  useEffect(() => { render() }, [render])

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

        <div className="db-card" style={{marginTop:'0.5rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <label className="db-label" style={{marginBottom:0}}>Caption & Hashtags</label>
            <button className="db-btn db-btn--sm" onClick={() => { navigator.clipboard.writeText(caption); setCopied(true); setTimeout(()=>setCopied(false),2000) }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <textarea className="db-textarea" rows={8} value={caption} onChange={e=>setCaption(e.target.value)}
            style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:'0.82rem',lineHeight:1.6}} />
          <p className="db-hint" style={{marginTop:'0.5rem'}}>Edit before copying — auto-generated from your review.</p>
        </div>
      </>)}
    </div>
  )
}
