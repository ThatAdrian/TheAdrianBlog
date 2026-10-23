import React from 'react'
import { ratingColor, formatRating } from '../../lib/ratings'

// Compact score chip. Unreviewed (null) renders greyed out with a dash.
export default function ScorePill({ label, value, title }: { label: string; value: number | null; title?: string }) {
  const reviewed = value !== null && value > 0
  const color = reviewed ? ratingColor(value!) : undefined
  return (
    <span
      className={`score-pill ${reviewed ? '' : 'score-pill--empty'}`}
      style={color ? ({ '--pill-color': color } as React.CSSProperties) : undefined}
      title={title ?? (reviewed ? `${label}: ${formatRating(value!)}/10` : `${label}: not reviewed`)}
    >
      <span className="score-pill__label">{label}</span>
      <span className="score-pill__value">{reviewed ? formatRating(value!) : '—'}</span>
    </span>
  )
}
