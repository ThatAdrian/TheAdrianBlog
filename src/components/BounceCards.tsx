import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import './BounceCards.css'

interface BounceCardsProps {
  className?: string
  images?: string[]
  containerWidth?: number
  containerHeight?: number
  animationDelay?: number
  animationStagger?: number
  easeType?: string
  transformStyles?: string[]
  enableHover?: boolean
}

export default function BounceCards({
  className = '',
  images = [],
  containerWidth = 500,
  containerHeight = 260,
  animationDelay = 0.5,
  animationStagger = 0.08,
  easeType = 'elastic.out(1, 0.8)',
  transformStyles = [
    'rotate(10deg) translate(-170px)',
    'rotate(5deg) translate(-85px)',
    'rotate(-3deg)',
    'rotate(-10deg) translate(85px)',
    'rotate(2deg) translate(170px)',
  ],
  enableHover = true,
}: BounceCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.bounce-card', { scale: 0 }, { scale: 1, stagger: animationStagger, ease: easeType, delay: animationDelay })
    }, containerRef)
    return () => ctx.revert()
  }, [animationStagger, easeType, animationDelay])

  const getNoRotation = (t: string) =>
    /rotate\([\s\S]*?\)/.test(t) ? t.replace(/rotate\([\s\S]*?\)/, 'rotate(0deg)') : `${t} rotate(0deg)`

  const getPushed = (t: string, offsetX: number) => {
    const m = t.match(/translate\(([-0-9.]+)px\)/)
    return m
      ? t.replace(/translate\(([-0-9.]+)px\)/, `translate(${parseFloat(m[1]) + offsetX}px)`)
      : `${t} translate(${offsetX}px)`
  }

  const pushSiblings = (idx: number) => {
    if (!enableHover || !containerRef.current) return
    const q = gsap.utils.selector(containerRef)
    images.forEach((_, i) => {
      const sel = q(`.bounce-card-${i}`)
      gsap.killTweensOf(sel)
      const base = transformStyles[i] || 'none'
      if (i === idx) {
        gsap.to(sel, { transform: getNoRotation(base), duration: 0.4, ease: 'back.out(1.4)', overwrite: 'auto' })
      } else {
        gsap.to(sel, { transform: getPushed(base, i < idx ? -120 : 120), duration: 0.4, ease: 'back.out(1.4)', delay: Math.abs(idx - i) * 0.05, overwrite: 'auto' })
      }
    })
  }

  const resetSiblings = () => {
    if (!enableHover || !containerRef.current) return
    const q = gsap.utils.selector(containerRef)
    images.forEach((_, i) => {
      gsap.killTweensOf(q(`.bounce-card-${i}`))
      gsap.to(q(`.bounce-card-${i}`), { transform: transformStyles[i] || 'none', duration: 0.4, ease: 'back.out(1.4)', overwrite: 'auto' })
    })
  }

  return (
    <div ref={containerRef} className={`bounceCardsContainer ${className}`} style={{ width: containerWidth, height: containerHeight }}>
      {images.map((src, idx) => (
        <div key={idx} className={`bounce-card bounce-card-${idx}`}
          style={{ transform: transformStyles[idx] ?? 'none' }}
          onMouseEnter={() => pushSiblings(idx)}
          onMouseLeave={resetSiblings}
        >
          <img className="bounce-image" src={src} alt={`skill-${idx}`} />
        </div>
      ))}
    </div>
  )
}
