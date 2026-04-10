import React, { useState, useRef, useEffect } from 'react'
import './TrackPlayer.css'

interface TrackPlayerProps {
  previewUrl: string
  trackName: string
  rating?: number
}

// Global audio manager — only one track plays at a time
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

// Global volume state shared across all players
let globalVolume = 0.8
const volumeListeners = new Set<(v: number) => void>()
function setGlobalVolume(v: number) {
  globalVolume = v
  volumeListeners.forEach(fn => fn(v))
  if (audioManager.current) audioManager.current.volume = v
}

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

export default function TrackPlayer({ previewUrl, trackName, rating = 0 }: TrackPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const barsRef = useRef<Float32Array>(new Float32Array(BAR_COUNT).fill(0.05))
  const color = rating > 0 ? getRatingColor(rating) : 'rgba(200,200,255,0.4)'

  useEffect(() => {
    const audio = new Audio(previewUrl)
    audio.preload = 'none'
    audio.volume = globalVolume
    audioRef.current = audio

    audio.addEventListener('ended', () => {
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
      drawIdleBars()
    })
    audio.addEventListener('externalpause', () => {
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
      drawIdleBars()
    })

    return () => {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
      ctxRef.current?.close()
    }
  }, [previewUrl])

  // Subscribe to global volume changes
  useEffect(() => {
    const fn = (v: number) => { if (audioRef.current) audioRef.current.volume = v }
    volumeListeners.add(fn)
    return () => { volumeListeners.delete(fn) }
  }, [])

  function setupAnalyser(audio: HTMLAudioElement) {
    if (analyserRef.current) return // already set up
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaElementSource(audio)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    source.connect(analyser)
    analyser.connect(ctx.destination)
    sourceRef.current = source
    analyserRef.current = analyser
  }

  function drawBars(active: boolean) {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    if (active && analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      const step = Math.floor(data.length / BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        const raw = data[i * step] / 255
        // Smooth bars
        barsRef.current[i] = barsRef.current[i] * 0.7 + raw * 0.3
      }
    } else {
      // Decay to idle
      for (let i = 0; i < BAR_COUNT; i++) {
        barsRef.current[i] = Math.max(0.03, barsRef.current[i] * 0.85)
      }
    }

    const barW = W / BAR_COUNT
    const hex = color.startsWith('#') ? color : color
    ctx.fillStyle = hex

    for (let i = 0; i < BAR_COUNT; i++) {
      const h = Math.max(2, barsRef.current[i] * H)
      const x = i * barW
      ctx.globalAlpha = active ? 0.85 : 0.25
      ctx.fillRect(x + 1, H - h, barW - 2, h)
    }
    ctx.globalAlpha = 1
  }

  function drawIdleBars() {
    function decay() {
      const allIdle = barsRef.current.every(v => v <= 0.031)
      drawBars(false)
      if (!allIdle) rafRef.current = requestAnimationFrame(decay)
    }
    decay()
  }

  function animate() {
    drawBars(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
      drawIdleBars()
    } else {
      if (audioManager.current && audioManager.current !== audio) {
        audioManager.stop()
      }
      setupAnalyser(audio)
      ctxRef.current?.resume()
      audioManager.current = audio
      audio.play()
      setPlaying(true)
      animate()
    }
  }

  // Draw idle bars on mount
  useEffect(() => {
    drawBars(false)
  }, [color])

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
    const v = parseFloat(e.target.value)
    setGlobalVolume(v)
  }

  const icon = volume === 0
    ? <path d="M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6M17 9l6 6"/>
    : volume < 0.5
    ? <path d="M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07"/>
    : <path d="M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>

  return (
    <div className="volume-control">
      <button
        className="volume-btn"
        onClick={() => setVisible(v => !v)}
        aria-label="Volume"
        title="Volume"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </button>
      {visible && (
        <div className="volume-slider-wrap">
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={volume}
            onChange={onChange}
            className="volume-slider"
            aria-label="Volume"
          />
          <span className="volume-label">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  )
}
