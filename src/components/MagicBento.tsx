import React, { useRef, useEffect, useCallback, useState } from 'react'
import { gsap } from 'gsap'
import './MagicBento.css'

export interface BentoCardData {
  color?: string
  title: string
  description: string
  label: string
  emoji?: string
}

export interface BentoProps {
  cards?: BentoCardData[]
  textAutoHide?: boolean
  enableStars?: boolean
  enableSpotlight?: boolean
  enableBorderGlow?: boolean
  disableAnimations?: boolean
  spotlightRadius?: number
  particleCount?: number
  enableTilt?: boolean
  glowColor?: string
  clickEffect?: boolean
  enableMagnetism?: boolean
}

const DEFAULT_PARTICLE_COUNT = 8
const DEFAULT_SPOTLIGHT_RADIUS = 300
const DEFAULT_GLOW_COLOR = '0, 245, 255'
const MOBILE_BREAKPOINT = 768

const DEFAULT_CARDS: BentoCardData[] = [
  { title: 'Music & Art', description: 'Always listening, always creating', label: 'Passion', emoji: '🎵' },
  { title: 'Skating', description: 'Any kind, any surface', label: 'Sport', emoji: '🛹' },
  { title: 'Gaming', description: 'PC, console, and building games', label: 'Hobby', emoji: '🎮' },
  { title: 'Collecting', description: 'Things worth keeping', label: 'Habit', emoji: '📦' },
  { title: 'Concerts', description: 'Live music is another level', label: 'Experience', emoji: '🎤' },
  { title: 'Productivity', description: 'Always building something', label: 'Drive', emoji: '⚡' },
]

const createParticle = (x: number, y: number, color: string): HTMLDivElement => {
  const el = document.createElement('div')
  el.className = 'mb-particle'
  el.style.cssText = `position:absolute;width:4px;height:4px;border-radius:50%;background:rgba(${color},1);box-shadow:0 0 6px rgba(${color},0.6);pointer-events:none;z-index:100;left:${x}px;top:${y}px;`
  return el
}

const ParticleCard: React.FC<{
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  disableAnimations?: boolean
  particleCount?: number
  glowColor?: string
  enableTilt?: boolean
  clickEffect?: boolean
  enableMagnetism?: boolean
}> = ({ children, className = '', style, disableAnimations = false, particleCount = DEFAULT_PARTICLE_COUNT, glowColor = DEFAULT_GLOW_COLOR, enableTilt = false, clickEffect = false, enableMagnetism = false }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement[]>([])
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const isHoveredRef = useRef(false)
  const magnetRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return
    const el = cardRef.current

    const onEnter = () => {
      isHoveredRef.current = true
      const { width, height } = el.getBoundingClientRect()
      Array.from({ length: particleCount }).forEach((_, i) => {
        const t = setTimeout(() => {
          if (!isHoveredRef.current || !cardRef.current) return
          const clone = createParticle(Math.random() * width, Math.random() * height, glowColor)
          el.appendChild(clone)
          particlesRef.current.push(clone)
          gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' })
          gsap.to(clone, { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80, duration: 2 + Math.random() * 2, ease: 'none', repeat: -1, yoyo: true })
          gsap.to(clone, { opacity: 0.3, duration: 1.5, ease: 'power2.inOut', repeat: -1, yoyo: true })
        }, i * 80)
        timeoutsRef.current.push(t)
      })
    }

    const onLeave = () => {
      isHoveredRef.current = false
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
      magnetRef.current?.kill()
      particlesRef.current.forEach(p => {
        gsap.to(p, { scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)', onComplete: () => p.parentNode?.removeChild(p) })
      })
      particlesRef.current = []
      if (enableTilt) gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.3, ease: 'power2.out' })
      if (enableMagnetism) gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' })
    }

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      const cx = rect.width / 2, cy = rect.height / 2
      if (enableTilt) gsap.to(el, { rotateX: ((y - cy) / cy) * -8, rotateY: ((x - cx) / cx) * 8, duration: 0.1, ease: 'power2.out', transformPerspective: 1000 })
      if (enableMagnetism) magnetRef.current = gsap.to(el, { x: (x - cx) * 0.04, y: (y - cy) * 0.04, duration: 0.3, ease: 'power2.out' })
    }

    const onClick = (e: MouseEvent) => {
      if (!clickEffect) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      const maxD = Math.max(Math.hypot(x, y), Math.hypot(x - rect.width, y), Math.hypot(x, y - rect.height), Math.hypot(x - rect.width, y - rect.height))
      const ripple = document.createElement('div')
      ripple.style.cssText = `position:absolute;width:${maxD * 2}px;height:${maxD * 2}px;border-radius:50%;background:radial-gradient(circle,rgba(${glowColor},0.35) 0%,rgba(${glowColor},0.15) 30%,transparent 70%);left:${x - maxD}px;top:${y - maxD}px;pointer-events:none;z-index:1000;`
      el.appendChild(ripple)
      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ripple.remove() })
    }

    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('click', onClick)
    return () => {
      isHoveredRef.current = false
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('click', onClick)
    }
  }, [disableAnimations, particleCount, glowColor, enableTilt, enableMagnetism, clickEffect])

  return <div ref={cardRef} className={`${className} mb-particle-container`} style={{ ...style, position: 'relative', overflow: 'hidden' }}>{children}</div>
}

const useMobile = () => {
  const [m, setM] = useState(false)
  useEffect(() => {
    const check = () => setM(window.innerWidth <= MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return m
}

const MagicBento: React.FC<BentoProps> = ({
  cards = DEFAULT_CARDS,
  textAutoHide = true,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
}) => {
  const gridRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement | null>(null)
  const isMobile = useMobile()
  const noAnim = disableAnimations || isMobile

  useEffect(() => {
    if (noAnim || !gridRef.current || !enableSpotlight) return
    const sp = document.createElement('div')
    sp.style.cssText = `position:fixed;width:700px;height:700px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(${glowColor},0.12) 0%,rgba(${glowColor},0.06) 20%,rgba(${glowColor},0.03) 35%,transparent 60%);z-index:200;opacity:0;transform:translate(-50%,-50%);mix-blend-mode:screen;`
    document.body.appendChild(sp)
    spotlightRef.current = sp

    const onMove = (e: MouseEvent) => {
      if (!gridRef.current || !sp) return
      const rect = gridRef.current.getBoundingClientRect()
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
      if (!inside) { gsap.to(sp, { opacity: 0, duration: 0.3 }); return }
      gsap.to(sp, { left: e.clientX, top: e.clientY, duration: 0.1, ease: 'power2.out' })
      gsap.to(sp, { opacity: 0.8, duration: 0.2 })
    }

    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('mousemove', onMove)
      sp.parentNode?.removeChild(sp)
    }
  }, [noAnim, enableSpotlight, glowColor])

  const baseClass = `mb-card ${textAutoHide ? 'mb-card--autohide' : ''} ${enableBorderGlow ? 'mb-card--glow' : ''}`

  return (
    <div ref={gridRef} className="mb-grid bento-section">
      {cards.map((card, i) => {
        const cardStyle = { backgroundColor: card.color || '#0a0814', '--glow-color': glowColor } as React.CSSProperties
        const content = (
          <>
            <div className="mb-card-header">
              {card.emoji && <span className="mb-card-emoji">{card.emoji}</span>}
              <div className="mb-card-label">{card.label}</div>
            </div>
            <div className="mb-card-content">
              <h2 className="mb-card-title">{card.title}</h2>
              <p className="mb-card-desc">{card.description}</p>
            </div>
          </>
        )
        if (enableStars) return (
          <ParticleCard key={i} className={baseClass} style={cardStyle} disableAnimations={noAnim} particleCount={particleCount} glowColor={glowColor} enableTilt={enableTilt} clickEffect={clickEffect} enableMagnetism={enableMagnetism}>
            {content}
          </ParticleCard>
        )
        return <div key={i} className={baseClass} style={cardStyle}>{content}</div>
      })}
    </div>
  )
}

export default MagicBento
