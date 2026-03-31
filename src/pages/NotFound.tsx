import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import Ballpit from '../components/Ballpit'
import VariableProximity from '../components/VariableProximity'
import SEO from '../components/SEO'

export default function NotFound() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="not-found-page">
      <SEO title="404 — Page Not Found" description="This page doesn't exist." />

      {/* Ballpit fills the whole screen */}
      <div className="not-found-ballpit">
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

      {/* Centered text overlay */}
      <div className="not-found-content" ref={containerRef}>

        <div className="not-found-code">404</div>

        <VariableProximity
          label="uhhh this is awkward"
          fromFontVariationSettings="'wght' 300, 'opsz' 9"
          toFontVariationSettings="'wght' 900, 'opsz' 40"
          containerRef={containerRef as React.RefObject<HTMLElement>}
          radius={120}
          falloff="linear"
          className="not-found-heading"
        />

        <p className="not-found-sub">
          the page you're looking for doesn't exist
        </p>

        <Link to="/" className="not-found-btn">
          take me home
        </Link>

      </div>
    </div>
  )
}
