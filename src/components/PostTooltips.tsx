import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import GlassSurface from './GlassSurface'
import './PostTooltips.css'

const STORAGE_KEY = 'tab_post_tooltips_seen'

interface TooltipStep {
  id: string
  title: string
  text: string
  selector: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS: TooltipStep[] = [
  {
    id: 'community-rating',
    title: 'Community Rating',
    text: 'Tap the stars to rate this album. Your rating contributes to the community score shown below the title.',
    selector: '.album-rating, .star-rating, [class*="rating"]',
    position: 'bottom',
  },
  {
    id: 'track-preview',
    title: 'Track Previews',
    text: 'Hit the play button next to any track to hear a 30-second preview. Use the volume icon bottom right to adjust.',
    selector: '.track-player-btn',
    position: 'right',
  },
  {
    id: 'track-comment',
    title: 'Track Comments',
    text: 'Tap the chat icon next to a track to leave a comment specifically about that track.',
    selector: '.track-comment-btn',
    position: 'left',
  },
  {
    id: 'text-comment',
    title: 'Inline Comments',
    text: 'Select any text in the article to leave a comment on that specific passage. Your comment appears as an avatar in the margin.',
    selector: '.post-content-with-comments',
    position: 'bottom',
  },
]

const TEXT_ONLY_STEPS = STEPS.filter(s => s.id === 'text-comment')

interface BubblePos {
  top: number
  left: number
  arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

const BUBBLE_W = 268
const BUBBLE_H = 150

function getPos(selector: string, position: string): { pos: BubblePos; targetTop: number } | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const scrollY = window.scrollY
  const W = window.innerWidth
  const gap = 14
  let top = 0, left = 0
  let arrowSide: BubblePos['arrowSide'] = 'top'

  switch (position) {
    case 'bottom':
      top = rect.bottom + scrollY + gap
      left = rect.left + rect.width / 2 - BUBBLE_W / 2
      arrowSide = 'top'
      break
    case 'top':
      top = rect.top + scrollY - BUBBLE_H - gap
      left = rect.left + rect.width / 2 - BUBBLE_W / 2
      arrowSide = 'bottom'
      break
    case 'right':
      top = rect.top + scrollY + rect.height / 2 - BUBBLE_H / 2
      left = rect.right + gap
      arrowSide = 'left'
      break
    case 'left':
      top = rect.top + scrollY + rect.height / 2 - BUBBLE_H / 2
      left = rect.left - BUBBLE_W - gap
      arrowSide = 'right'
      break
  }

  left = Math.max(12, Math.min(left, W - BUBBLE_W - 12))
  return { pos: { top, left, arrowSide }, targetTop: rect.top + scrollY }
}

export default function PostTooltips({ isMusicReview }: { isMusicReview: boolean }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<BubblePos | null>(null)

  const steps = isMusicReview ? STEPS : TEXT_ONLY_STEPS

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => { setVisible(true); setStep(0) }, 1200)
      return () => clearTimeout(t)
    }
  }, [])

  // Scroll to element then update position
  function scrollToAndPosition(stepIndex: number) {
    const s = steps[stepIndex]
    if (!s) return
    const el = document.querySelector(s.selector)
    if (el) {
      const rect = el.getBoundingClientRect()
      // For large containers like post-content, scroll to show the top portion
      // For smaller elements, centre them in the viewport
      const isLargeContainer = rect.height > window.innerHeight * 0.8
      const targetScrollY = isLargeContainer
        ? window.scrollY + rect.top - 120
        : window.scrollY + rect.top - window.innerHeight * 0.55
      window.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' })
      setTimeout(() => {
        const result = getPos(s.selector, s.position)
        if (result) setPos(result.pos)
        else setPos({ top: window.scrollY + window.innerHeight * 0.4, left: window.innerWidth / 2 - BUBBLE_W / 2, arrowSide: 'top' })
      }, 450)
    } else {
      setPos({ top: window.scrollY + window.innerHeight * 0.4, left: window.innerWidth / 2 - BUBBLE_W / 2, arrowSide: 'top' })
    }
  }

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!visible) return
    const current = steps[step]
    if (!current) return

    function update() {
      const result = getPos(current.selector, current.position)
      if (result) setPos(result.pos)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [visible, step, steps])

  // Scroll to element when step changes
  useEffect(() => {
    if (!visible) return
    scrollToAndPosition(step)
  }, [step, visible])

  function next() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function goTo(i: number) {
    setStep(i)
  }

  function dismiss() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  function reopen() {
    localStorage.removeItem(STORAGE_KEY)
    setStep(0)
    setVisible(true)
  }

  const current = steps[step]

  return (
    <>
      {visible && pos && current && createPortal(
        <div
          className={`pt-bubble-wrap pt-arrow-${pos.arrowSide}`}
          style={{ top: pos.top, left: pos.left, width: BUBBLE_W }}
        >
          <GlassSurface
            width="100%"
            height="auto"
            borderRadius={14}
            brightness={4}
            opacity={0.38}
            blur={6}
          >
            <div className="pt-bubble-inner">
              <div className="pt-bubble-header">
                <span className="pt-step">{step + 1} / {steps.length}</span>
                <button className="pt-skip" onClick={dismiss}>Skip all</button>
              </div>
              <p className="pt-title">{current.title}</p>
              <p className="pt-text">{current.text}</p>
              <div className="pt-actions">
                <div className="pt-dots">
                  {steps.map((_, i) => (
                    <span key={i} className={`pt-dot ${i === step ? 'active' : ''}`} onClick={() => goTo(i)} />
                  ))}
                </div>
                <button className="pt-next" onClick={next}>
                  {step === steps.length - 1 ? 'Got it' : 'Next →'}
                </button>
              </div>
            </div>
          </GlassSurface>
        </div>,
        document.body
      )}

      {!visible && (
        <button className="pt-helper" onClick={reopen} title="How to use this page">
          ?
        </button>
      )}
    </>
  )
}
