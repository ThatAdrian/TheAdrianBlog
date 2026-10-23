import React, { useEffect, useRef } from 'react'
import { ReleasesState } from '../../lib/releases'
import { EventsState } from '../../lib/events'
import ReleaseRow from './ReleaseRow'
import EventRow from './EventRow'

export default function Notifications({ releases, events, hasTracked, onFindArtists }: {
  releases: ReleasesState
  events: EventsState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { seenAt, markAllSeen } = releases
  const loading = releases.loading || events.loading
  // Releases and shows in your areas, newest first
  const notifications = [
    ...releases.notifications.map(n => ({ ...n, type: 'release' as const })),
    ...events.notifications.map(n => ({ ...n, type: 'event' as const })),
  ].sort((a, b) => b.at.localeCompare(a.at))
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
    return <div className="no-posts"><p>Nothing new from your tracked artists yet. New releases, announcements and shows in your areas will land here.</p></div>
  }

  return (
    <div className="release-list">
      {notifications.map(n => n.type === 'event' ? (
        <div key={n.key} className={`notif-event ${n.at > seenOnOpen.current ? 'release-row--unread' : ''}`}>
          <span className="release-tag release-tag--show">New show</span>
          <EventRow e={n.event} />
        </div>
      ) : (
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
