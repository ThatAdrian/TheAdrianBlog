import React, { useState } from 'react'
import { listPostFiles, getFileContent, commitFile } from './github'

interface MigrationResult {
  file: string
  status: 'skipped' | 'updated' | 'error'
  detail: string
}

// Double rating value in frontmatter
function migrateRating(raw: string): { content: string; changed: boolean } {
  let changed = false
  let content = raw

  // Double the album rating field: rating: 4.5 → rating: 9
  content = content.replace(/^(rating:\s*)([\d.]+)/m, (_, prefix, val) => {
    const num = parseFloat(val)
    if (isNaN(num) || num > 5) return _ // already migrated or invalid
    changed = true
    const doubled = num * 2
    return `${prefix}${doubled % 1 === 0 ? doubled.toString() : doubled.toFixed(1)}`
  })

  // Double all track ratings in tracklist: name~2.5|name~4 → name~5|name~8
  content = content.replace(
    /^(tracklist:\s*)(.+)$/m,
    (_, prefix, tracks) => {
      const migrated = tracks.replace(/~([\d.]+)/g, (_: string, val: string) => {
        const num = parseFloat(val)
        if (isNaN(num) || num > 5) return `~${val}` // already migrated
        changed = true
        const doubled = num * 2
        return `~${doubled % 1 === 0 ? doubled.toString() : doubled.toFixed(1)}`
      })
      return `${prefix}${migrated}`
    }
  )

  return { content, changed }
}

export default function RatingMigrator() {
  const [running, setRunning]     = useState(false)
  const [done, setDone]           = useState(false)
  const [results, setResults]     = useState<MigrationResult[]>([])
  const [progress, setProgress]   = useState('')

  async function run() {
    setRunning(true); setDone(false); setResults([])
    const out: MigrationResult[] = []

    try {
      setProgress('Loading post list...')
      const files = await listPostFiles()
      const musicFiles = []

      for (const f of files) {
        const raw = await getFileContent(f.path)
        if (raw && raw.includes('Music Reviews')) musicFiles.push({ ...f, raw })
      }

      setProgress(`Found ${musicFiles.length} music review(s). Migrating...`)

      for (const f of musicFiles) {
        try {
          const { content, changed } = migrateRating(f.raw)
          if (!changed) {
            out.push({ file: f.name, status: 'skipped', detail: 'Already on 1–10 scale or no rating found' })
            continue
          }
          const ok = await commitFile(f.path, content, `Migrate ratings to 1-10 scale: ${f.name}`)
          out.push({
            file: f.name,
            status: ok ? 'updated' : 'error',
            detail: ok ? 'Album + track ratings doubled' : 'Commit failed',
          })
          setProgress(`Migrated ${out.length}/${musicFiles.length}...`)
        } catch (e: any) {
          out.push({ file: f.name, status: 'error', detail: e?.message || 'Unknown error' })
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 400))
      }
    } catch (e: any) {
      out.push({ file: 'ALL', status: 'error', detail: e?.message || 'Failed to load posts' })
    }

    setResults(out)
    setProgress('')
    setRunning(false)
    setDone(true)
  }

  const updated = results.filter(r => r.status === 'updated').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status === 'error').length

  return (
    <div className="db-section">
      <h2 className="db-section-title">Rating Migration</h2>

      <div className="db-card">
        <p className="db-hint" style={{ marginBottom: '1rem', lineHeight: 1.7 }}>
          This tool converts all existing music review ratings from the <strong>1–5 scale</strong> to the new <strong>1–10 scale</strong> by doubling every value.
          Both the album rating and all individual track ratings will be updated.
          <br /><br />
          <strong style={{ color: '#ff4466' }}>Run this once only.</strong> It skips any post that already has ratings above 5, so it is safe to re-run if something went wrong.
        </p>

        {!done && (
          <button
            className="db-btn db-btn--publish"
            onClick={run}
            disabled={running}
            style={{ width: '100%' }}
          >
            {running ? progress || 'Running...' : 'Migrate All Ratings to 1–10'}
          </button>
        )}

        {done && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span className="db-success" style={{ padding: '0.4rem 0.8rem', borderRadius: 8 }}>✓ {updated} updated</span>
              {skipped > 0 && <span className="db-hint" style={{ padding: '0.4rem 0.8rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>— {skipped} skipped</span>}
              {errors > 0 && <span className="db-error" style={{ padding: '0.4rem 0.8rem', borderRadius: 8 }}>✗ {errors} errors</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto' }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '6px 10px', borderRadius: 8,
                  background: r.status === 'updated' ? 'rgba(0,255,136,0.05)' : r.status === 'error' ? 'rgba(255,68,102,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${r.status === 'updated' ? 'rgba(0,255,136,0.15)' : r.status === 'error' ? 'rgba(255,68,102,0.15)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                    {r.status === 'updated' ? '✓' : r.status === 'error' ? '✗' : '—'}
                  </span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', color: 'rgba(220,220,255,0.8)', flex: 1 }}>
                    {r.file.replace('.md', '')}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(200,200,255,0.4)' }}>{r.detail}</span>
                </div>
              ))}
            </div>

            {updated > 0 && (
              <p className="db-hint" style={{ marginTop: '0.5rem' }}>
                Site will redeploy automatically. Allow ~1 minute for changes to go live.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
