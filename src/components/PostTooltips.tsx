import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './PostTooltips.css'

const STORAGE_KEY = 'tab_post_tooltips_seen'

interface TooltipStep {
  id: string
  title: string
  text: string
  selector: string  // CSS selector to point at
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS: TooltipStep[] = [
  {
    id: 'community-rating',
    title: 'Community Rating',
    text: 'Tap the stars to rate this album. Your rating is added to the community score.',
    selector: '.album-rating-wrap, .star-rating-wrap, [class*="AlbumRating"], [class*="album-rating"]',
    position: 'bottom',
  },
  {
    id: 'track-preview',
    title: 'Track Previews',
    text: 'Hit the play button next to any track to hear a 30-second preview. Use the volume icon in the bottom right to adjust.',
    selector: '.track-player-btn',
    position: 'right',
  },
  {
    id: 'track-rating',
    title: 'Rate Tracks',
    text: 'Hover over the stars next to each track to leave your own rating.',
    selector: '.track-rating, .track-list',
    position: 'right',
  },
  {
    id: 'track-comment',
    title: 'Track Comments',
    text: 'Tap the chat icon next to a track to leave a comment about it specifically.',
    selector: '.track-comment-btn',
    position: 'left',
  },
  {
    id: 'text-comment',
    title: 'Inline Comments',
    text: 'Select any text in the article to leave a comment on that specific passage.',
    selector: '.prose-custom, .post-content-with-comments',
    position: 'bottom',
  },
]

function getElementRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  return el.getBoundingClientRect()
}

interface BubblePos {
  top: number
  left: number
  arrowSide: 'top' | 'bottom' | 'left' | 'right'
}

function calcPosition(rect: DOMRect, position: string, bubbleW = 260, bubbleH = 100): BubblePos {
  const gap = 12
  const scrollY = window.scrollY
  let top = 0, left = 0, arrowSide: BubblePos['arrowSide'] = 'top'

  switch (position) {
    case 'bottom':
      top = rect.bottom + scrollY + gap
      left = rect.left + rect.width / 2 - bubbleW / 2
      arrowSide = 'top'
      break
    case 'top':
      top = rect.top + scrollY - bubbleH - gap
      left = rect.left + rect.width / 2 - bubbleW / 2
      arrowSide = 'bottom'
      break
    case 'right':
      top = rect.top + scrollY + rect.height / 2 - bubbleH / 2
      left = rect.right + gap
      arrowSide = 'left'
      break
    case 'left':
      top = rect.top + scrollY + rect.height / 2 - bubbleH / 2
      left = rect.left - bubbleW - gap
      arrowSide = 'right'
      break
  }

  // Keep within viewport horizontally
  left = Math.max(12, Math.min(left, window.innerWidth - bubbleW - 12))

  return { top, left, arrowSide }
}

export default function PostTooltips({ isMusicReview }: { isMusicReview: boolean }) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<BubblePos | null>(null)
  const [showHelper, setShowHelper] = useState(false)

  const steps = isMusicReview ? STEPS : STEPS.filter(s => s.id === 'text-comment')

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so post content renders first
      const t = setTimeout(() => {
        setVisible(true)
        setStep(0)
      }, 1200)
      return () => clearTimeout(t)
    } else {
      setShowHelper(true)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const current = steps[step]
    if (!current) return

    function updatePos() {
      const rect = getElementRect(current.selector)
      if (rect) {
        setPos(calcPosition(rect, current.position))
      }
    }

    updatePos()
    window.addEventListener('scroll', updatePos, { passive: true })
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos)
      window.removeEventListener('resize', updatePos)
    }
  }, [visible, step, steps])

  function next() {
    if (step < steps.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function dismiss() {
    setVisible(false)
    setShowHelper(true)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  function reopen() {
    setStep(0)
    setVisible(true)
    setShowHelper(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const current = steps[step]

  return (
    <>
      {/* Tooltip bubble */}
      {visible && pos && current && createPortal(
        <div
          className={`pt-bubble pt-arrow-${pos.arrowSide}`}
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="pt-bubble-header">
            <span className="pt-step">{step + 1} / {steps.length}</span>
            <button className="pt-skip" onClick={dismiss}>Skip</button>
          </div>
          <p className="pt-title">{current.title}</p>
          <p className="pt-text">{current.text}</p>
          <div className="pt-actions">
            <div className="pt-dots">
              {steps.map((_, i) => (
                <span key={i} className={`pt-dot ${i === step ? 'active' : ''}`} onClick={() => setStep(i)} />
              ))}
            </div>
            <button className="pt-next" onClick={next}>
              {step === steps.length - 1 ? 'Got it' : 'Next →'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Helper button (bottom left) */}
      {showHelper && (
        <button className="pt-helper" onClick={reopen} title="Show feature guide">
          ?
        </button>
      )}
    </>
  )
}
