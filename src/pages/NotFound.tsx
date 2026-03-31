import React, { useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Ballpit from '../components/Ballpit'
import SEO from '../components/SEO'

function VariableText({ text, fontSize }: { text: string; fontSize: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([])

  const letters = text.split('')

  const onMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    spanRefs.current.forEach(span => {
      if (!span) return
      const sr = span.getBoundingClientRect()
      const cx = sr.left + sr.width / 2 - rect.left
      const cy = sr.top + sr.height / 2 - rect.top
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2)
      const proximity = Math.max(0, 1 - dist / 120)
      const weight = Math.round(300 + proximity * 600)
      span.style.fontWeight = String(weight)
      span.style.letterSpacing = `${proximity * 0.04}em`
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [onMouseMove])

  return (
    <div ref={containerRef} style={{ display: 'inline-block' }}>
      {letters.map((l, i) =>
        l === ' ' ? (
          <span key={i} style={{ display: 'inline-block', width: '0.35em' }} />
        ) : (
          <span
            key={i}
            ref={el => { spanRefs.current[i] = el }}
            style={{
              display: 'inline-block',
              fontSize,
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 300,
              color: '#ffffff',
              transition: 'font-weight 0.1s, letter-spacing 0.1s',
              textShadow: '0 0 30px rgba(0,245,255,0.3)',
            }}
          >
            {l}
          </span>
        )
      )}
    </div>
  )
}

export default function NotFound() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', background: '#03020f',
    }}>
      <SEO title="404 — Page Not Found" description="This page doesn't exist." />

      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Ballpit
          count={80}
          gravity={0.4}
          friction={0.9975}
          wallBounce={0.95}
          followCursor={true}
          colors={[0x00f5ff, 0xb400ff, 0x00ff88, 0xff006e, 0x0080ff]}
          minSize={0.3}
          maxSize={0.9}
        />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        padding: '2rem', gap: '0.75rem',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: 'clamp(5rem, 18vw, 13rem)',
          fontWeight: 900, lineHeight: 1,
          color: 'rgba(255,255,255,0.06)',
          userSelect: 'none',
          marginBottom: '0.25rem',
        }}>
          404
        </div>

        <VariableText
          text="uhhh this is awkward"
          fontSize="clamp(1.2rem, 4vw, 2.8rem)"
        />

        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 'clamp(0.65rem, 2vw, 0.82rem)',
          color: 'rgba(200,200,255,0.45)',
          letterSpacing: '0.1em',
          margin: 0,
        }}>
          the page you're looking for doesn't exist
        </p>

        <Link to="/" style={{
          marginTop: '1.25rem',
          padding: '0.65rem 2rem',
          borderRadius: '2rem',
          border: '1px solid rgba(0,245,255,0.4)',
          background: 'rgba(0,245,255,0.08)',
          color: '#00f5ff',
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.75rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          pointerEvents: 'auto',
        }}>
          take me home
        </Link>
      </div>
    </div>
  )
}
