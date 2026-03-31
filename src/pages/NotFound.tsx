import React, { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Ballpit from '../components/Ballpit'
import SEO from '../components/SEO'

export default function NotFound() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', background: '#03020f'
    }}>
      <SEO title="404 — Page Not Found" description="This page doesn't exist." />

      {/* Ballpit fills full screen */}
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

      {/* Text overlay */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem', gap: '1rem',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: 'clamp(6rem, 20vw, 14rem)',
          fontWeight: 900, lineHeight: 1,
          color: 'rgba(255,255,255,0.08)',
          userSelect: 'none',
          letterSpacing: '-0.02em',
        }}>
          404
        </div>

        <h1 style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: 'clamp(1.2rem, 4vw, 2.5rem)',
          fontWeight: 700, color: '#ffffff',
          margin: 0, letterSpacing: '0.02em',
          textShadow: '0 0 40px rgba(0,245,255,0.4)',
        }}>
          uhhh this is awkward
        </h1>

        <p style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: 'clamp(0.65rem, 2vw, 0.85rem)',
          color: 'rgba(200,200,255,0.5)',
          letterSpacing: '0.1em', margin: 0,
        }}>
          the page you're looking for doesn't exist
        </p>

        <Link to="/" style={{
          marginTop: '1rem',
          padding: '0.7rem 2rem',
          borderRadius: '2rem',
          border: '1px solid rgba(0,245,255,0.4)',
          background: 'rgba(0,245,255,0.08)',
          color: '#00f5ff',
          fontFamily: 'Space Mono, monospace',
          fontSize: '0.8rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          pointerEvents: 'auto',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.background = 'rgba(0,245,255,0.18)'
            ;(e.target as HTMLElement).style.borderColor = 'rgba(0,245,255,0.7)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.background = 'rgba(0,245,255,0.08)'
            ;(e.target as HTMLElement).style.borderColor = 'rgba(0,245,255,0.4)'
          }}
        >
          take me home
        </Link>
      </div>
    </div>
  )
}
