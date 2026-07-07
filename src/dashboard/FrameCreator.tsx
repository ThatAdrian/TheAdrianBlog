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
  if (r >= 10)  return '#ffffff'
  if (r >= 9)   return '#dd00ff'
  if (r >= 8)   return '#0088ff'
  if (r >= 7)   return '#00bbaa'
  if (r >= 6)   return '#00cc44'
  if (r >= 5)   return '#aadd00'
  if (r >= 4)   return '#ffd000'
  if (r >= 3)   return '#ff8c00'
  if (r >= 2)   return '#ff6600'
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

// Draw image cover-fit — maintains aspect ratio, crops to fill target area
function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  const iRatio = iw / ih
  const tRatio = w / h
  let sx = 0, sy = 0, sw = iw, sh = ih
  if (iRatio > tRatio) { sw = ih * tRatio; sx = (iw - sw) / 2 }
  else                  { sh = iw / tRatio; sy = (ih - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
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
// 9:16: Full-bleed cinematic art, text in fade zone at bottom
// 1:1:  Full-bleed art covers entire frame, bold text overlay bottom third
// ─────────────────────────────────────────────────────────────────────────────
async function drawIntro(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 80 : 72
  const RW  = is ? W - TT_RPAD : W

  drawBg(ctx, W, H)

  const img = await loadImg(review.imageUrl)

  if (is) {
    // ── 9:16: Cinematic top portion ──────────────────────────────────────────
    const artH = 1020
    if (img) {
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
      coverDraw(ctx, img, 0, 0, W, artH)
      ctx.restore()
      const fadeH = 420
      const fade  = ctx.createLinearGradient(0, artH - fadeH, 0, artH)
      fade.addColorStop(0, 'rgba(7,5,26,0)'); fade.addColorStop(0.45, 'rgba(7,5,26,0.65)'); fade.addColorStop(1, BG)
      ctx.fillStyle = fade; ctx.fillRect(0, artH - fadeH, W, fadeH)
      const topF = ctx.createLinearGradient(0, 0, 0, 220)
      topF.addColorStop(0, 'rgba(7,5,26,0.5)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
      ctx.fillStyle = topF; ctx.fillRect(0, 0, W, 220)
    }
    const artistY = artH - 120
    ctx.fillStyle = CYAN + 'cc'
    ctx.font = `700 38px 'Orbitron', monospace`
    ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
    ctx.fillText(review.artist.toUpperCase(), RW/2, artistY)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = TEXT_PRI
    ctx.font = `bold 76px 'Space Grotesk', sans-serif`
    wrapText(ctx, review.albumName, RW/2, artistY + 76, RW - PAD*2, 86, 'center')
    if (review.summary) {
      drawSep(ctx, PAD, artistY + 200, RW - PAD*2)
      ctx.fillStyle = TEXT_MUT
      ctx.font = `38px 'Space Grotesk', sans-serif`
      wrapText(ctx, `"${review.summary}"`, RW/2, artistY + 240, RW - PAD*2.2, 54, 'center')
    }
    drawWM(ctx, W, TT_BOT - 28, 27)
  } else {
    // ── 1:1: Full-frame art with strong bottom overlay — poster style ─────────
    if (img) {
      coverDraw(ctx, img, 0, 0, W, H)
      // Dark gradient — bottom 52% of frame
      const fade = ctx.createLinearGradient(0, H * 0.38, 0, H)
      fade.addColorStop(0, 'rgba(7,5,26,0)')
      fade.addColorStop(0.3, 'rgba(7,5,26,0.82)')
      fade.addColorStop(1, 'rgba(7,5,26,0.98)')
      ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H)
      const topF = ctx.createLinearGradient(0, 0, 0, 130)
      topF.addColorStop(0, 'rgba(7,5,26,0.5)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
      ctx.fillStyle = topF; ctx.fillRect(0, 0, W, 130)
    }
    // Anchor all text from bottom up with fixed gaps
    // Watermark
    const wmY1 = H - 28
    drawWM(ctx, W, wmY1, 20)
    // Summary
    const summaryLineH = 40
    const summaryLines: string[] = []
    if (review.summary) {
      ctx.font = `28px 'Space Grotesk', sans-serif`
      const sumWords = review.summary.split(' '); let sumLine = ''
      for (const w of sumWords) {
        const t = sumLine + w + ' '
        if (ctx.measureText(t).width > W - PAD*2.4 && sumLine) { summaryLines.push(sumLine.trim()); sumLine = w + ' ' }
        else sumLine = t
      }
      if (sumLine.trim()) summaryLines.push(sumLine.trim())
    }
    const summaryH = summaryLines.length > 0 ? summaryLines.length * summaryLineH + 12 : 0
    const summaryBottom = wmY1 - 16
    const summaryTop = summaryBottom - summaryH
    if (summaryLines.length > 0) {
      ctx.fillStyle = 'rgba(195,195,225,0.58)'
      ctx.font = `28px 'Space Grotesk', sans-serif`
      ctx.textAlign = 'center'
      summaryLines.forEach((line, i) => ctx.fillText(line, W/2, summaryTop + i * summaryLineH + summaryLineH))
    }
    // Separator — 28px gap above summary
    const sepY1 = (summaryLines.length > 0 ? summaryTop : wmY1 - 16) - 28
    drawSep(ctx, PAD, sepY1, W - PAD*2)
    // Album name — measure how many lines, then position above sep
    ctx.font = `bold 68px 'Space Grotesk', sans-serif`
    const albumLineH = 78
    const albumWords = review.albumName.split(' ')
    const aLines: string[] = []; let aCur = ''
    for (const w of albumWords) {
      const t = aCur + w + ' '
      if (ctx.measureText(t).width > W - PAD*2.2 && aCur) { aLines.push(aCur.trim()); aCur = w + ' ' }
      else aCur = t
    }
    if (aCur.trim()) aLines.push(aCur.trim())
    const albumBlockH = aLines.length * albumLineH
    // Artist sits above album name with a 14px gap
    const artistH = 40  // height of artist text
    const artistGap = 14
    const totalTextH = artistH + artistGap + albumBlockH
    const albumStartY = sepY1 - 40 - albumBlockH  // 40px gap above sep
    // Artist sits clearly above album — 72px above album baseline guarantees no overlap
    const artistBaseY = albumStartY - 72
    ctx.fillStyle = CYAN + 'dd'
    ctx.font = `700 32px 'Orbitron', monospace`
    ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
    ctx.fillText(clip(ctx, review.artist.toUpperCase(), W - PAD*2), W/2, artistBaseY)
    ctx.letterSpacing = '0px'
    // Draw album lines
    aLines.forEach((line, i) => {
      ctx.fillStyle = 'rgba(248,248,255,0.97)'
      ctx.font = `bold 68px 'Space Grotesk', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(line, W/2, albumStartY + i * albumLineH)
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME 1+ — TRACKS
// 9:16: Compact header card, full list fills safe zone
// 1:1:  Split layout — art strip top, clean track list below, max 8/page
// ─────────────────────────────────────────────────────────────────────────────
async function drawTracks(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio, page: number) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 80 : 64

  drawBg(ctx, W, H)

  const PER_PAGE = is ? Math.ceil(review.tracks.length / Math.ceil(review.tracks.length / 10)) : Math.min(8, Math.ceil(review.tracks.length / Math.ceil(review.tracks.length / 8)))
  const totalPages = Math.ceil(review.tracks.length / PER_PAGE)
  const pageTracks = review.tracks.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const img = await loadImg(review.imageUrl)

  if (is) {
    // ── 9:16 layout ────────────────────────────────────────────────────────────
    const RW = W - TT_RPAD
    const TOP = TT_TOP, BOT = TT_BOT
    const cardPad = 28, thumbSz = 108
    const headerH = thumbSz + cardPad * 2
    const headerY = TOP + 100
    drawCard(ctx, PAD, headerY, RW - PAD*2, headerH)
    if (img) {
      ctx.save(); rrect(ctx, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz, 10); ctx.clip()
      coverDraw(ctx, img, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz)
      ctx.restore()
      ctx.save(); rrect(ctx, PAD + cardPad, headerY + cardPad, thumbSz, thumbSz, 10)
      ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke(); ctx.restore()
    }
    const hx = PAD + cardPad + thumbSz + 22, hmid = headerY + headerH/2
    ctx.fillStyle = CYAN + 'cc'; ctx.font = `700 26px 'Orbitron', monospace`
    ctx.textAlign = 'left'; ctx.letterSpacing = '2px'
    ctx.fillText(clip(ctx, review.artist.toUpperCase(), RW - hx - PAD - cardPad), hx, hmid - 20)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = TEXT_PRI; ctx.font = `bold 46px 'Space Grotesk', sans-serif`
    ctx.fillText(clip(ctx, review.albumName, RW - hx - PAD - cardPad), hx, hmid + 22)
    const labelText = totalPages > 1 ? `TRACKS  ${page+1} / ${totalPages}` : 'TRACKS'
    const labelY = headerY + headerH + 36
    ctx.font = `700 22px 'Orbitron', monospace`; ctx.letterSpacing = '4px'
    const labelW = ctx.measureText(labelText).width + 36
    rrect(ctx, PAD, labelY - 28, labelW, 38, 10)
    ctx.fillStyle = 'rgba(0,245,255,0.08)'; ctx.fill()
    ctx.strokeStyle = 'rgba(0,245,255,0.2)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = CYAN + 'cc'; ctx.textAlign = 'left'; ctx.fillText(labelText, PAD + 18, labelY); ctx.letterSpacing = '0px'
    const listY = labelY + 18, listH = BOT - listY - 60
    drawCard(ctx, PAD, listY, RW - PAD*2, listH, 14)
    const rowH = listH / pageTracks.length
    pageTracks.forEach((track, i) => {
      const ry = listY + i * rowH, midY = ry + rowH/2, col = ratingColor(track.rating)
      if (i > 0) drawSep(ctx, PAD + 14, ry, RW - PAD*2 - 28)
      if (track.rating >= 4.5) {
        const rowGlow = ctx.createLinearGradient(PAD, 0, PAD + 320, 0)
        rowGlow.addColorStop(0, col + '12'); rowGlow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = rowGlow; rrect(ctx, PAD, ry + (i===0?1:0), RW - PAD*2, rowH - (i===0?1:0) - (i===pageTracks.length-1?1:0), 10); ctx.fill()
      }
      const barW = track.rating >= 5 ? 5 : track.rating >= 4 ? 4 : 3
      ctx.save(); if (track.rating >= 5) { ctx.shadowColor = col; ctx.shadowBlur = 12 }
      ctx.fillStyle = col + (track.rating >= 4 ? 'cc' : '65')
      ctx.fillRect(PAD, ry + (i===0?1:0), barW, rowH - (i===0?1:0) - (i===pageTracks.length-1?1:0)); ctx.restore()
      ctx.fillStyle = col + '80'; ctx.font = `bold 28px 'Space Mono', monospace`; ctx.textAlign = 'left'
      ctx.fillText(String(page * PER_PAGE + i + 1).padStart(2, '0'), PAD + 16, midY + 10)
      const numW = 62, pillW = 110, pillH = 54
      const nameW = RW - PAD*2 - numW - pillW - 36
      ctx.fillStyle = track.rating >= 5 ? '#fff' : track.rating >= 4.5 ? TEXT_PRI : 'rgba(205,205,235,0.82)'
      ctx.font = `${track.rating >= 5 ? 'bold ' : ''}40px 'Space Grotesk', sans-serif`
      ctx.fillText(clip(ctx, track.name, nameW), PAD + numW + 16, midY + 13)
      drawRatingPill(ctx, track.rating, RW - PAD - pillW/2 - 4, midY, pillW, pillH)
    })
    drawWM(ctx, W, TT_BOT - 16, 24)
  } else {
    // ── 1:1 layout: art banner top, clean list below ───────────────────────────
    const artH = 220  // compact art banner
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
      coverDraw(ctx, img, 0, 0, W, artH); ctx.restore()
      const fade = ctx.createLinearGradient(0, artH * 0.5, 0, artH)
      fade.addColorStop(0, 'rgba(7,5,26,0)'); fade.addColorStop(1, BG)
      ctx.fillStyle = fade; ctx.fillRect(0, 0, W, artH)
    }
    // Album + artist over banner
    const hx = PAD + 130 + 20
    if (img) {
      ctx.save(); rrect(ctx, PAD, artH/2 - 50, 120, 120, 12); ctx.clip()
      coverDraw(ctx, img, PAD, artH/2 - 50, 120, 120); ctx.restore()
      ctx.save(); rrect(ctx, PAD, artH/2 - 50, 120, 120, 12)
      ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke(); ctx.restore()
    }
    ctx.fillStyle = CYAN + 'dd'; ctx.font = `700 22px 'Orbitron', monospace`
    ctx.textAlign = 'left'; ctx.letterSpacing = '2px'
    ctx.fillText(clip(ctx, review.artist.toUpperCase(), W - hx - PAD), hx, artH/2 - 18)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = TEXT_PRI; ctx.font = `bold 38px 'Space Grotesk', sans-serif`
    ctx.fillText(clip(ctx, review.albumName, W - hx - PAD - 10), hx, artH/2 + 26)
    // Page indicator pill top right
    if (totalPages > 1) {
      const pill = `${page+1} / ${totalPages}`
      ctx.font = `700 20px 'Space Mono', monospace`
      const pillW2 = ctx.measureText(pill).width + 28
      rrect(ctx, W - PAD - pillW2, 16, pillW2, 32, 16)
      ctx.fillStyle = 'rgba(0,245,255,0.1)'; ctx.fill()
      ctx.strokeStyle = 'rgba(0,245,255,0.25)'; ctx.lineWidth = 1; ctx.stroke()
      ctx.fillStyle = CYAN + 'cc'; ctx.textAlign = 'center'
      ctx.fillText(pill, W - PAD - pillW2/2, 37)
    }
    // Track list card fills rest
    const listY = artH + 16
    const listH = H - listY - 60
    drawCard(ctx, PAD, listY, W - PAD*2, listH, 14)
    const rowH = listH / pageTracks.length
    pageTracks.forEach((track, i) => {
      const ry = listY + i * rowH, midY = ry + rowH/2, col = ratingColor(track.rating)
      if (i > 0) drawSep(ctx, PAD + 12, ry, W - PAD*2 - 24)
      if (track.rating >= 4.5) {
        const rowGlow = ctx.createLinearGradient(PAD, 0, PAD + 280, 0)
        rowGlow.addColorStop(0, col + '12'); rowGlow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = rowGlow; rrect(ctx, PAD, ry, W - PAD*2, rowH, i===0?14:i===pageTracks.length-1?14:0); ctx.fill()
      }
      const barW = track.rating >= 5 ? 4 : track.rating >= 4 ? 3 : 2
      ctx.save(); if (track.rating >= 5) { ctx.shadowColor = col; ctx.shadowBlur = 10 }
      ctx.fillStyle = col + (track.rating >= 4 ? 'cc' : '55')
      ctx.fillRect(PAD, ry + (i===0?1:0), barW, rowH - (i===0?1:0) - (i===pageTracks.length-1?1:0)); ctx.restore()
      ctx.fillStyle = col + '80'; ctx.font = `bold 24px 'Space Mono', monospace`; ctx.textAlign = 'left'
      ctx.fillText(String(page * PER_PAGE + i + 1).padStart(2, '0'), PAD + 14, midY + 8)
      const numW = 52, pillW = 86, pillH = 40
      const nameW = W - PAD*2 - numW - pillW - 28
      ctx.fillStyle = track.rating >= 5 ? '#fff' : track.rating >= 4.5 ? TEXT_PRI : 'rgba(205,205,235,0.8)'
      ctx.font = `${track.rating >= 5 ? 'bold ' : ''}33px 'Space Grotesk', sans-serif`
      ctx.fillText(clip(ctx, track.name, nameW), PAD + numW + 12, midY + 11)
      drawRatingPill(ctx, track.rating, W - PAD - pillW/2 - 3, midY, pillW, pillH)
    })
    // TRACKS label bottom left inside card
    ctx.fillStyle = CYAN + '55'; ctx.font = `700 18px 'Orbitron', monospace`
    ctx.letterSpacing = '4px'; ctx.textAlign = 'left'
    const trackLabel = totalPages > 1 ? `TRACKS ${page+1}/${totalPages}` : 'TRACKS'
    ctx.fillText(trackLabel, PAD + 16, H - 28); ctx.letterSpacing = '0px'
    drawWM(ctx, W, H - 14, 0)  // hide watermark — label is enough
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAST FRAME — VERDICT
// 9:16: Full-bleed art, anchored bottom cards
// 1:1:  Left half = art, Right half = content (split layout)
// ─────────────────────────────────────────────────────────────────────────────
async function drawVerdict(canvas: HTMLCanvasElement, review: ReviewData, ratio: Ratio) {
  await loadFonts()
  const W = 1080, H = ratio === '9:16' ? 1920 : 1080
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const is  = ratio === '9:16'
  const PAD = is ? 80 : 56
  const RW  = is ? W - TT_RPAD : W
  const TOP = is ? TT_TOP : 0
  const BOT = is ? TT_BOT : H

  drawBg(ctx, W, H)
  const img = await loadImg(review.imageUrl)

  if (is) {
    // ── 9:16: Full-bleed cinematic (unchanged) ─────────────────────────────────
    const artH = 880
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip()
      coverDraw(ctx, img, 0, 0, W, artH); ctx.restore()
      const fade = ctx.createLinearGradient(0, artH - 420, 0, artH)
      fade.addColorStop(0, 'rgba(7,5,26,0)'); fade.addColorStop(0.45, 'rgba(7,5,26,0.65)'); fade.addColorStop(1, BG)
      ctx.fillStyle = fade; ctx.fillRect(0, artH - 420, W, 420)
      const topF = ctx.createLinearGradient(0, 0, 0, 220)
      topF.addColorStop(0, 'rgba(7,5,26,0.5)'); topF.addColorStop(1, 'rgba(7,5,26,0)')
      ctx.fillStyle = topF; ctx.fillRect(0, 0, W, 220)
    }
    const artistY = artH - 120
    ctx.fillStyle = CYAN + 'cc'; ctx.font = `700 34px 'Orbitron', monospace`
    ctx.textAlign = 'center'; ctx.letterSpacing = '4px'
    ctx.fillText(clip(ctx, review.artist.toUpperCase(), RW - PAD*2), RW/2, artistY)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = TEXT_PRI; ctx.font = `bold 62px 'Space Grotesk', sans-serif`
    ctx.fillText(clip(ctx, review.albumName, RW - PAD*2), RW/2, artistY + 68)
    const wmY = BOT - 28
    const ctaH = 78, ctaY = wmY - 36 - ctaH
    const rcardH = 222, rcardY = ctaY - 18 - rcardH
    const sepY = rcardY - 18
    const vLabelY = artH + 36
    ctx.fillStyle = 'rgba(0,245,255,0.5)'; ctx.font = `700 24px 'Orbitron', monospace`
    ctx.letterSpacing = '6px'; ctx.textAlign = 'center'
    ctx.fillText('VERDICT', RW/2, vLabelY); ctx.letterSpacing = '0px'
    drawSep(ctx, PAD, vLabelY + 14, RW - PAD*2)
    const vcardY = vLabelY + 30
    const vcardH = Math.max(200, sepY - vcardY - 10)
    const tPad = 30, lineH = 56, maxW = RW - PAD*2 - tPad*2
    let fontSize = 38
    let fittedLines: string[] = []
    while (fontSize >= 24) {
      ctx.font = `${fontSize}px 'Space Grotesk', sans-serif`
      const lH = Math.round(fontSize * 1.45)
      const avail = Math.floor((vcardH - tPad * 2) / lH)
      const words = (review.verdict || 'No verdict written yet.').split(' ')
      const lines: string[] = []; let cur = ''
      for (const w of words) {
        const t = cur + w + ' '
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur.trim()); cur = w + ' ' } else cur = t
      }
      if (cur.trim()) lines.push(cur.trim())
      if (lines.length <= avail) { fittedLines = lines; break }
      if (fontSize === 24) { fittedLines = lines.slice(0, avail); break }
      fontSize -= 2
    }
    const lineHFinal = Math.round(fontSize * 1.45)
    rrect(ctx, PAD, vcardY, RW - PAD*2, vcardH, 14)
    ctx.fillStyle = CARD_BG; ctx.fill(); ctx.strokeStyle = CARD_BDR; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = CYAN + '30'; ctx.fillRect(PAD + 2, vcardY, RW - PAD*2 - 4, 1.5)
    ctx.fillStyle = 'rgba(212,212,238,0.87)'; ctx.font = `${fontSize}px 'Space Grotesk', sans-serif`
    ctx.textAlign = 'left'; let ty = vcardY + tPad + lineHFinal * 0.72
    for (const line of fittedLines) { ctx.fillText(line, PAD + tPad, ty); ty += lineHFinal }
    drawSep(ctx, PAD, sepY, RW - PAD*2)
    drawCard(ctx, PAD, rcardY, RW - PAD*2, rcardH, 16)
    ctx.fillStyle = 'rgba(0,245,255,0.15)'; ctx.fillRect(PAD + 2, rcardY, RW - PAD*2 - 4, 1)
    const rmid = rcardY + rcardH/2
    const col9 = ratingColor(review.rating)
    ctx.save(); if (review.rating >= 5) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 40 }
    ctx.fillStyle = col9; ctx.font = `bold 88px 'Orbitron', monospace`; ctx.textAlign = 'center'
    ctx.fillText(`${review.rating} / 10`, RW/2, rmid + 18); ctx.restore()
    drawStars(ctx, review.rating / 2, RW/2, rmid + 84, 23)
    drawCard(ctx, PAD, ctaY, RW - PAD*2, ctaH, ctaH/2)
    ctx.fillStyle = 'rgba(0,245,255,0.16)'; ctx.fillRect(PAD + 2, ctaY, RW - PAD*2 - 4, 1)
    ctx.fillStyle = 'rgba(200,200,255,0.44)'; ctx.font = `24px 'Space Grotesk', sans-serif`
    ctx.textAlign = 'center'; ctx.fillText('for more reviews visit', RW/2, ctaY + ctaH * 0.37)
    ctx.fillStyle = CYAN + 'cc'; ctx.font = `bold 28px 'Orbitron', monospace`
    ctx.letterSpacing = '1px'; ctx.fillText('TheAdrianBlog.com', RW/2, ctaY + ctaH * 0.77); ctx.letterSpacing = '0px'
    drawWM(ctx, W, wmY, 23)
  } else {
    // ── 1:1: Left/right split — art left, content right ───────────────────────
    const splitX = 480  // art takes left 480px, content gets right 600px
    const contentX = splitX + 32
    const contentW = W - contentX - PAD

    // Left: square album art full height
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, splitX, H); ctx.clip()
      coverDraw(ctx, img, 0, 0, splitX, H); ctx.restore()
      // Right-edge fade into background
      const fade = ctx.createLinearGradient(splitX - 200, 0, splitX, 0)
      fade.addColorStop(0, 'rgba(7,5,26,0)'); fade.addColorStop(1, BG)
      ctx.fillStyle = fade; ctx.fillRect(splitX - 200, 0, 200, H)
    }

    // Right side content
    // Artist
    ctx.fillStyle = CYAN + 'cc'; ctx.font = `700 22px 'Orbitron', monospace`
    ctx.textAlign = 'left'; ctx.letterSpacing = '3px'
    ctx.fillText(clip(ctx, review.artist.toUpperCase(), contentW), contentX, 80)
    ctx.letterSpacing = '0px'
    // Album name
    ctx.fillStyle = TEXT_PRI; ctx.font = `bold 44px 'Space Grotesk', sans-serif`
    let nameY = wrapText(ctx, review.albumName, contentX, 118, contentW, 52, 'left')
    // Divider
    drawSep(ctx, contentX, nameY, contentW)
    // VERDICT label
    const vLY = nameY + 28
    ctx.fillStyle = 'rgba(0,245,255,0.5)'; ctx.font = `700 18px 'Orbitron', monospace`
    ctx.letterSpacing = '5px'; ctx.fillText('VERDICT', contentX, vLY); ctx.letterSpacing = '0px'
    // Verdict text — fills available space
    const verdictTop = vLY + 22
    // CTA at bottom
    const ctaH2 = 68, ctaY2 = H - PAD - ctaH2
    // Rating card
    const rcH2 = 150, rcY2 = ctaY2 - 16 - rcH2
    const sepY2 = rcY2 - 16
    const vcH2  = Math.max(80, sepY2 - verdictTop - 12)
    const tPad2 = 0, lH2 = 42, maxW2 = contentW
    let fs2 = 30
    let fl2: string[] = []
    while (fs2 >= 20) {
      ctx.font = `${fs2}px 'Space Grotesk', sans-serif`
      const lh = Math.round(fs2 * 1.45)
      const avail = Math.floor((vcH2 - 8) / lh)
      const words = (review.verdict || '').split(' ')
      const lines: string[] = []; let cur = ''
      for (const w of words) {
        const t = cur + w + ' '
        if (ctx.measureText(t).width > maxW2 && cur) { lines.push(cur.trim()); cur = w + ' ' } else cur = t
      }
      if (cur.trim()) lines.push(cur.trim())
      if (lines.length <= avail) { fl2 = lines; break }
      if (fs2 === 20) { fl2 = lines.slice(0, avail); break }
      fs2 -= 2
    }
    ctx.fillStyle = 'rgba(210,210,235,0.82)'; ctx.font = `${fs2}px 'Space Grotesk', sans-serif`
    ctx.textAlign = 'left'
    const lhFinal = Math.round(fs2 * 1.45)
    let ty2 = verdictTop + lhFinal * 0.75
    for (const line of fl2) { ctx.fillText(line, contentX, ty2); ty2 += lhFinal }
    // Separator
    drawSep(ctx, contentX, sepY2, contentW)
    // Rating card
    drawCard(ctx, contentX, rcY2, contentW, rcH2, 14)
    ctx.fillStyle = 'rgba(0,245,255,0.12)'; ctx.fillRect(contentX + 2, rcY2, contentW - 4, 1)
    const rMid = rcY2 + rcH2/2
    const col1 = ratingColor(review.rating)
    ctx.save(); if (review.rating >= 5) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 30 }
    ctx.fillStyle = col1; ctx.font = `bold 58px 'Orbitron', monospace`; ctx.textAlign = 'center'
    ctx.fillText(`${review.rating} / 10`, contentX + contentW/2, rMid + 10); ctx.restore()
    drawStars(ctx, review.rating / 2, contentX + contentW/2, rMid + 54, 17)
    // CTA box
    drawCard(ctx, contentX, ctaY2, contentW, ctaH2, ctaH2/2)
    ctx.fillStyle = 'rgba(0,245,255,0.14)'; ctx.fillRect(contentX + 2, ctaY2, contentW - 4, 1)
    ctx.fillStyle = 'rgba(200,200,255,0.4)'; ctx.font = `18px 'Space Grotesk', sans-serif`
    ctx.textAlign = 'center'; ctx.fillText('for more reviews visit', contentX + contentW/2, ctaY2 + ctaH2 * 0.38)
    ctx.fillStyle = CYAN + 'cc'; ctx.font = `bold 20px 'Orbitron', monospace`
    ctx.letterSpacing = '1px'; ctx.fillText('TheAdrianBlog.com', contentX + contentW/2, ctaY2 + ctaH2 * 0.77); ctx.letterSpacing = '0px'
    drawWM(ctx, W, H - 12, 0) // hide - CTA is enough
  }
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

// ── Minimal ZIP writer (STORE method — PNGs are already compressed) ──────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let x = n
    for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1
    t[n] = x >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function buildZipSync(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nameB = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new Uint8Array(30 + nameB.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)   // local file header sig
    lv.setUint16(4, 20, true)           // version needed
    lv.setUint16(8, 0, true)            // method: STORE
    lv.setUint32(14, crc, true)
    lv.setUint32(18, f.data.length, true)
    lv.setUint32(22, f.data.length, true)
    lv.setUint16(26, nameB.length, true)
    local.set(nameB, 30)
    parts.push(local, f.data)

    const cd = new Uint8Array(46 + nameB.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)   // central dir sig
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(10, 0, true)           // STORE
    cv.setUint32(16, crc, true)
    cv.setUint32(20, f.data.length, true)
    cv.setUint32(24, f.data.length, true)
    cv.setUint16(28, nameB.length, true)
    cv.setUint32(42, offset, true)      // local header offset
    cd.set(nameB, 46)
    central.push(cd)
    offset += local.length + f.data.length
  }

  const cdSize = central.reduce((s, c2) => s + c2.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  return new Blob([...parts, ...central, eocd], { type: 'application/zip' })
}

async function buildZipAsync(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const files: { name: string; data: Uint8Array }[] = []
  for (const e of entries) files.push({ name: e.name, data: new Uint8Array(await e.blob.arrayBuffer()) })
  return buildZipSync(files)
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
    const rLabel =
      r.rating >= 10 ? 'a perfect score' :
      r.rating >= 9  ? 'an incredibly strong album' :
      r.rating >= 8  ? 'a great listen' :
      r.rating >= 7  ? 'a solid album' :
      r.rating >= 6  ? 'a decent album' :
      r.rating >= 5  ? 'a mixed bag' :
      'a rough one'
    const trackMention = top3.length > 0 ? `Standout tracks include ${top3.slice(0,-1).join(', ')}${top3.length>1?` and ${top3[top3.length-1]}`:''}. ` : ''
    const firstSentence = r.verdict ? r.verdict.split('.')[0].trim() + '.' : ''
    // 5 hashtags max — artist tag, then the highest-value discovery tags
    const artistTag = r.artist.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()
    setCaption(`${r.albumName} by ${r.artist} — ${rLabel} at ${r.rating}/10. ${firstSentence} ${trackMention}\nFull review on TheAdrianBlog.com\n\n#${artistTag} #musicreview #albumreview #newmusic #musictok`.trim())
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
    // Render every frame and collect blobs — single canvas reused per frame
    const entries: { name: string; blob: Blob }[] = []
    for (let i = 0; i < frames.length; i++) {
      await renderFrame(canvasRef.current, review, i, ratio)
      const blob = await new Promise<Blob | null>(res => canvasRef.current!.toBlob(res, 'image/png'))
      if (blob) {
        entries.push({
          name: `${review.slug}-${String(i+1).padStart(2,'0')}-${frames[i].label.toLowerCase().replace(/[^a-z0-9]/g,'-')}-${ratio.replace(':','x')}.png`,
          blob,
        })
      }
    }
    // Restore preview before any share sheet opens
    await renderFrame(canvasRef.current, review, activeFrame, ratio)

    // Mobile: Web Share API with image files — iOS/Android share sheet offers
    // "Save Images" which puts all frames straight into the photo gallery in one tap
    const files = entries.map(e => new File([e.blob], e.name, { type: 'image/png' }))
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: review.albumName })
        return
      } catch (err: any) {
        // User cancelled the sheet → do nothing. Real failure → fall through to ZIP
        if (err?.name === 'AbortError') return
      }
    }

    // Desktop fallback: bundle everything into ONE zip download —
    // sequential anchor clicks get blocked by browsers, so a single file is the fix
    const zip = await buildZipAsync(entries)
    const url = URL.createObjectURL(zip)
    const a = document.createElement('a')
    a.download = `${review.slug}-frames-${ratio.replace(':','x')}.zip`
    a.href = url
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
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
