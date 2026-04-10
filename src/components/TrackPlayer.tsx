import React, { useState, useRef, useEffect } from 'react'
import './TrackPlayer.css'

interface TrackPlayerProps {
  previewUrl: string
  trackName: string
}

// Global audio manager — only one track plays at a time
const audioManager = {
  current: null as HTMLAudioElement | null,
  stop() {
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
    }
    this.current = null
  }
}

export default function TrackPlayer({ previewUrl, trackName }: TrackPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(30)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const audio = new Audio(previewUrl)
    audio.preload = 'none'
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('ended', () => {
      setPlaying(false)
      setProgress(0)
    })

    return () => {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
    }
  }, [previewUrl])

  function updateProgress() {
    const audio = audioRef.current
    if (!audio) return
    setProgress(audio.currentTime / audio.duration)
    rafRef.current = requestAnimationFrame(updateProgress)
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      cancelAnimationFrame(rafRef.current)
      setPlaying(false)
    } else {
      // Stop any other playing track
      if (audioManager.current && audioManager.current !== audio) {
        audioManager.current.pause()
        audioManager.current.currentTime = 0
        // Dispatch event so other players update their state
        audioManager.current.dispatchEvent(new Event('externalpause'))
      }
      audioManager.current = audio
      audio.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(updateProgress)
    }
  }

  // Listen for external pause (another track started)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function onExternal() {
      setPlaying(false)
      setProgress(0)
      cancelAnimationFrame(rafRef.current)
    }
    audio.addEventListener('externalpause', onExternal)
    return () => audio.removeEventListener('externalpause', onExternal)
  }, [])

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  const elapsed = Math.floor(progress * duration)
  const remaining = Math.floor(duration - elapsed)

  return (
    <div className="track-player">
      <button
        className={`track-player-btn ${playing ? 'playing' : ''}`}
        onClick={toggle}
        aria-label={playing ? `Pause ${trackName}` : `Play 30s preview of ${trackName}`}
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

      <div className="track-player-bar" onClick={seek}>
        <div className="track-player-fill" style={{ width: `${progress * 100}%` }}/>
        <div className="track-player-thumb" style={{ left: `${progress * 100}%` }}/>
      </div>

      <span className="track-player-time">
        {playing ? `−${remaining}s` : '30s'}
      </span>
    </div>
  )
}
