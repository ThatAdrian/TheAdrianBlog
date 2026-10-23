import React, { useEffect, useRef } from 'react'
import { ReleasesState } from '../../lib/releases'
import ReleaseRow from './ReleaseRow'

export default function Notifications({ releases, hasTracked, onFindArtists }: {
  releases: ReleasesState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { notifications, seenAt, markAllSeen, loading } = releases
  // Keep the unread highlight for this visit, then clear the dock badge
  const seenOnOpen = useRef(seenAt)
  useEffect(() => {
    if (!loading) markAllSeen()
  }, [loading, notifications.length, markAllSeen])

  if (!hasTracked) {
    return (
      <div className="no-posts tracked-empty">
        <p>Track some artists to get notified about new releases and announcements.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  if (loading) return <div className="no-posts"><p>Checking for new releases…</p></div>

  if (!notifications.length) {
    return <div className="no-posts"><p>Nothing new from your tracked artists yet. New releases and announcements will land here.</p></div>
  }

  return (
    <div className="release-list">
      {notifications.map(n => (
        <ReleaseRow
          key={n.key}
          release={n.release}
          unread={n.at > seenOnOpen.current}
          tag={n.kind === 'announced' ? { label: 'Announced', tone: 'announced' } : { label: 'Out now', tone: 'released' }}
        />
      ))}
    </div>
  )
}
