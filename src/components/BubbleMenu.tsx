import React, { type CSSProperties, type ReactNode } from 'react'
import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import GlassSurface from './GlassSurface'
import './BubbleMenu.css'

type MenuItem = {
  label: string
  href: string
  ariaLabel?: string
  rotation?: number
  hoverStyles?: { bgColor?: string; textColor?: string }
}

export type BubbleMenuProps = {
  logo: ReactNode | string
  onMenuClick?: (open: boolean) => void
  className?: string
  style?: CSSProperties
  menuAriaLabel?: string
  menuBg?: string
  menuContentColor?: string
  useFixedPosition?: boolean
  items?: MenuItem[]
  animationEase?: string
  animationDuration?: number
  staggerDelay?: number
}

export default function BubbleMenu({
  logo, onMenuClick, className, style,
  menuAriaLabel = 'Toggle menu',
  menuBg = 'rgba(7,5,25,0.9)',
  menuContentColor = '#00f5ff',
  useFixedPosition = false,
  items = [],
  animationEase = 'back.out(1.5)',
  animationDuration = 0.5,
  staggerDelay = 0.12,
}: BubbleMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<HTMLAnchorElement[]>([])
  const labelRefs = useRef<HTMLSpanElement[]>([])

  const containerClassName = [
    'bubble-menu',
    useFixedPosition ? 'fixed' : 'absolute',
    className,
  ].filter(Boolean).join(' ')

  const handleToggle = () => {
    const next = !isMenuOpen
    if (next) setShowOverlay(true)
    setIsMenuOpen(next)
    onMenuClick?.(next)
  }

  useEffect(() => {
    const overlay = overlayRef.current
    const bubbles = bubblesRef.current.filter(Boolean)
    const labels = labelRefs.current.filter(Boolean)
    if (!overlay || !bubbles.length) return

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' })
      gsap.killTweensOf([...bubbles, ...labels])
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' })
      gsap.set(labels, { y: 24, autoAlpha: 0 })
      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05)
        const tl = gsap.timeline({ delay })
        tl.to(bubble, { scale: 1, duration: animationDuration, ease: animationEase })
        if (labels[i]) {
          tl.to(labels[i], { y: 0, autoAlpha: 1, duration: animationDuration, ease: 'power3.out' }, `-=${animationDuration * 0.9}`)
        }
      })
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels])
      gsap.to(labels, { y: 24, autoAlpha: 0, duration: 0.2, ease: 'power3.in' })
      gsap.to(bubbles, {
        scale: 0, duration: 0.2, ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' })
          setShowOverlay(false)
        },
      })
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay])

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main navigation">

        {/* Logo bubble — GlassSurface */}
        <GlassSurface
          width="auto"
          height={48}
          borderRadius={24}
          brightness={40}
          opacity={0.9}
          blur={14}
          distortionScale={-120}
          className="bubble-glass logo-bubble-glass"
        >
          <div className="logo-bubble-inner">
            {typeof logo === 'string'
              ? <img src={logo} alt="Logo" className="bubble-logo" />
              : logo}
          </div>
        </GlassSurface>

        {/* Toggle bubble — GlassSurface */}
        <GlassSurface
          width={48}
          height={48}
          borderRadius={24}
          brightness={40}
          opacity={0.9}
          blur={14}
          distortionScale={-120}
          className="bubble-glass toggle-bubble-glass"
        >
          <button
            type="button"
            className={`menu-btn ${isMenuOpen ? 'open' : ''}`}
            onClick={handleToggle}
            aria-label={menuAriaLabel}
            aria-pressed={isMenuOpen}
          >
            <span className="menu-line" style={{ background: menuContentColor }} />
            <span className="menu-line" style={{ background: menuContentColor }} />
          </button>
        </GlassSurface>

      </nav>

      {showOverlay && (
        <div
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'}`}
          aria-hidden={!isMenuOpen}
        >
          <ul className="pill-list" role="menu">
            {items.map((item, idx) => (
              <li key={idx} role="none" className="pill-col">
                <a
                  role="menuitem"
                  href={item.href}
                  aria-label={item.ariaLabel || item.label}
                  className="pill-link"
                  style={{
                    '--item-rot': `${item.rotation ?? 0}deg`,
                    '--pill-bg': menuBg,
                    '--pill-color': menuContentColor,
                    '--hover-bg': item.hoverStyles?.bgColor ?? '#f3f4f6',
                    '--hover-color': item.hoverStyles?.textColor ?? menuContentColor,
                  } as CSSProperties}
                  ref={el => { if (el) bubblesRef.current[idx] = el }}
                >
                  <span
                    className="pill-label"
                    ref={el => { if (el) labelRefs.current[idx] = el }}
                  >
                    {item.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
