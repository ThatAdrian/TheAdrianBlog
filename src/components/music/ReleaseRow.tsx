import React, { useState } from 'react'
import { Release, formatReleaseDate } from '../../lib/releases'

export default function ReleaseRow({ release, tag, unread = false, showArtist = true }: {
  release: Release
  tag?: { label: string; tone: 'announced' | 'released' | 'upcoming' }
  unread?: boolean
  showArtist?: boolean
}) {
  const [imgOk, setImgOk] = useState(!!release.image)
  const Wrap: React.ElementType = release.url ? 'a' : 'div'
  return (
    <Wrap
      className={`release-row ${unread ? 'release-row--unread' : ''}`}
      {...(release.url ? { href: release.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <div className="release-row__img">
        {imgOk ? <img src={release.image} alt="" onError={() => setImgOk(false)} /> : <span>{release.title[0]}</span>}
      </div>
      <div className="release-row__info">
        <span className="release-row__title">{release.title}</span>
        <span className="release-row__sub">
          {showArtist && <>{release.artist_name} · </>}
          <span className="release-row__type">{release.release_type === 'ep' ? 'EP' : release.release_type}</span> · {formatReleaseDate(release)}
        </span>
      </div>
      {tag && <span className={`release-tag release-tag--${tag.tone}`}>{tag.label}</span>}
    </Wrap>
  )
}
