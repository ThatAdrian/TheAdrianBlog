import React, { useState, useRef, useEffect, useCallback } from 'react'
import './TrackPlayer.css'

// ── Global audio manager ──────────────────────────────────────────────────────
const audioManager = {
  current: null as HTMLAudioElement | null,
  stop() {
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
      this.current.dispatchEvent(new Event('externalpause'))
    }
    this.current = null
  }
}

// ── Global volume ─────────────────────────────────────────────────────────────
let globalVolume = 0.8
const volumeListeners = new Set<(v: number) => void>()
function setGlobalVolume(v: number) {
  globalVolume = v
  volumeListeners.forEach(fn => fn(v))
  if (audioManager.current) audioManager.current.volume = v
}

// ── Rating colour ─────────────────────────────────────────────────────────────
function getRatingColor(r: number): string {
  if (r >= 5)   return '#ff00ff'
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

const BAR_COUNT = 40

// Seeded pseudo-random for consistent bar shapes per track
function seededRand(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

interface TrackPlayerProps {
  previewUrl: string
  trackName: string
  rating?: number
}

export default function TrackPlayer({ previewUrl, trackName, rating = 0 }: TrackPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const barsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.04))
  const targetBarsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.04))
  const phaseRef = useRef<number>(0)
  const color = rating > 0 ? getRatingColor(rating) : 'rgba(200,200,255,0.35)'

  // Build idle bar shape from seed (track-specific, consistent)
  const idleBars = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.04))

  const drawBars = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const barW = W / BAR_COUNT
    ctx.fillStyle = color

    for (let i = 0; i < BAR_COUNT; i++) {
      const h = Math.max(2, barsRef.current[i] * H)
      ctx.globalAlpha = playing ? 0.9 : 0.2
      ctx.fillRect(i * barW + 0.5, H - h, barW - 1, h)
    }
    ctx.globalAlpha = 1
  }, [color, playing])

  function animatePlaying() {
    phaseRef.current += 0.04
    const phase = phaseRef.current
    const rand = seededRand(Math.floor(phase * 100))

    for (let i = 0; i < BAR_COUNT; i++) {
      // Combine sine waves at different frequencies for natural-looking bounce
      const wave =
        0.3 * Math.sin(phase * 2.1 + i * 0.4) +
        0.2 * Math.sin(phase * 3.7 + i * 0.7) +
        0.15 * Math.sin(phase * 1.3 + i * 1.1) +
        0.1 * (rand() - 0.5)
      targetBarsRef.current[i] = 0.25 + Math.abs(wave) * 0.55
    }

    // Smooth towards target
    for (let i = 0; i < BAR_COUNT; i++) {
      barsRef.current[i] = barsRef.current[i] * 0.65 + targetBarsRef.current[i] * 0.35
    }

    drawBars()
    rafRef.current = requestAnimationFrame(animatePlaying)
  }

  function animateDecay() {
    let allDone = true
    for (let i = 0; i < BAR_COUNT; i++) {
      barsRef.current[i] = barsRef.current[i] * 0.88 + idleBars.current[i] * 0.12
      if (Math.abs(barsRef.current[i] - idleBars.current[i]) > 0.002) allDone = false
    }
    drawBars()
    if (!allDone) rafRef.current = requestAnimationFrame(animateDecay)
  }

  useEffect(() => {
    // crossOrigin must be set BEFORE src for Web Audio API to work with cross-origin URLs
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.src = previewUrl
    audio.preload = 'none'
    audio.volume = globalVolume
    audioRef.current = audio

    audio.addEventListener('ended', () => {
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
      animateDecay()
    })
    audio.addEventListener('externalpause', () => {
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
      animateDecay()
    })

    return () => {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
    }
  }, [previewUrl])

  useEffect(() => {
    const fn = (v: number) => { if (audioRef.current) audioRef.current.volume = v }
    volumeListeners.add(fn)
    return () => { volumeListeners.delete(fn) }
  }, [])

  // Draw idle bars on mount
  useEffect(() => {
    for (let i = 0; i < BAR_COUNT; i++) barsRef.current[i] = idleBars.current[i]
    drawBars()
  }, [drawBars])

  async function toggle() {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
      animateDecay()
    } else {
      if (audioManager.current && audioManager.current !== audio) {
        audioManager.stop()
      }
      audioManager.current = audio
      try {
        await audio.play()
        setPlaying(true)
        cancelAnimationFrame(rafRef.current)
        animatePlaying()
      } catch (err) {
        console.error('Play failed:', err)
      }
    }
  }

  // Redraw when playing state changes
  useEffect(() => { drawBars() }, [playing, drawBars])

  return (
    <div className="track-player">
      <button
        className={`track-player-btn ${playing ? 'playing' : ''}`}
        onClick={toggle}
        style={{ '--player-color': color } as React.CSSProperties}
        aria-label={playing ? `Pause ${trackName}` : `Play preview of ${trackName}`}
      >
        {playing ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        )}
      </button>

      <canvas
        ref={canvasRef}
        className="track-player-waveform"
        width={200}
        height={28}
        aria-hidden="true"
      />
    </div>
  )
}

// ── Global volume control (desktop only) ──────────────────────────────────────
export function VolumeControl() {
  const [volume, setVolume] = useState(globalVolume)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const fn = (v: number) => setVolume(v)
    volumeListeners.add(fn)
    return () => { volumeListeners.delete(fn) }
  }, [])

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setGlobalVolume(parseFloat(e.target.value))
  }

  const icon = volume === 0
    ? <><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
    : volume < 0.5
    ? <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
    : <><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>

  return (
    <div className="volume-control">
      <button className="volume-btn" onClick={() => setVisible(v => !v)} aria-label="Volume">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </button>
      {visible && (
        <div className="volume-slider-wrap">
          <input
            type="range" min="0" max="1" step="0.01"
            value={volume} onChange={onChange}
            className="volume-slider" aria-label="Volume"
          />
          <span className="volume-label">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  )
}
