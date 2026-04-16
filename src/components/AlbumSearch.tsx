import React, { useState, useRef, useEffect, useCallback } from 'react'
import { getSpotifyToken } from '../lib/spotify'
import './AlbumSearch.css'

export interface AlbumResult {
  id: string
  name: string
  artist: string
  image: string
  year: string
}

interface AlbumSearchProps {
  placeholder?: string
  onSelect: (album: AlbumResult) => void
  value?: string
  onChange?: (val: string) => void
  className?: string
  autoFocus?: boolean
}

async function searchAlbums(query: string): Promise<AlbumResult[]> {
  if (!query.trim()) return []
  try {
    const token = await getSpotifyToken()
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=6`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.albums?.items ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      artist: a.artists[0]?.name ?? '',
      image: a.images?.find((i: any) => i.width >= 60)?.url ?? a.images?.[0]?.url ?? '',
      year: a.release_date?.slice(0, 4) ?? '',
    }))
  } catch {
    return []
  }
}

export default function AlbumSearch({
  placeholder = 'Search albums...',
  onSelect,
  value,
  onChange,
  className = '',
  autoFocus = false,
}: AlbumSearchProps) {
  const [query, setQuery] = useState(value ?? '')
  const [results, setResults] = useState<AlbumResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Sync external value
  useEffect(() => {
    if (value !== undefined) setQuery(value)
  }, [value])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const r = await searchAlbums(q)
      setResults(r)
      setOpen(r.length > 0)
      setHighlighted(-1)
      setLoading(false)
    }, 300)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    onChange?.(val)
    search(val)
  }

  function handleSelect(album: AlbumResult) {
    setQuery(`${album.name} — ${album.artist}`)
    onChange?.(`${album.name} — ${album.artist}`)
    setOpen(false)
    setResults([])
    onSelect(album)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); handleSelect(results[highlighted]) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={wrapRef} className={`as-search-wrap ${className}`}>
      <div className="as-search-input-wrap">
        <input
          className="as-search-input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoFocus={autoFocus}
          autoComplete="off"
        />
        {loading && <span className="as-search-spinner" />}
      </div>

      {open && results.length > 0 && (
        <div className="as-search-dropdown">
          {results.map((album, i) => (
            <button
              key={album.id}
              className={`as-search-item ${i === highlighted ? 'highlighted' : ''}`}
              onClick={() => handleSelect(album)}
              onMouseEnter={() => setHighlighted(i)}
            >
              {album.image ? (
                <img src={album.image} alt={album.name} className="as-search-art" />
              ) : (
                <div className="as-search-art as-search-art--empty" />
              )}
              <div className="as-search-item-info">
                <span className="as-search-item-name">{album.name}</span>
                <span className="as-search-item-artist">{album.artist}</span>
              </div>
              {album.year && <span className="as-search-item-year">{album.year}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
