import React, { useEffect, useMemo, useState } from 'react'
import EventGlobe, { CountryFeature, CityPoint } from './EventGlobe'
import { EventsState, ArtistEvent, useRegions, inRegions, distanceKm } from '../../lib/events'
import EventRow, { flag } from './EventRow'

const RADII = [25, 50, 100, 200]

export default function EventTracker({ events, hasTracked, onFindArtists }: {
  events: EventsState
  hasTracked: boolean
  onFindArtists: () => void
}) {
  const { regions, hasRegions, toggleCountry, toggleCity, setCityRadius } = useRegions()
  const [mode, setMode] = useState<'countries' | 'cities'>(() => (regions.cities.length && !regions.countries.length ? 'cities' : 'countries'))
  const [radius, setRadius] = useState(50)
  const [query, setQuery] = useState('')
  const [everywhere, setEverywhere] = useState(false)
  const [countries, setCountries] = useState<CountryFeature[]>([])
  const [baseCities, setBaseCities] = useState<CityPoint[]>([])

  useEffect(() => {
    fetch('/geo/countries.json').then(r => r.json()).then(d => setCountries(d.features)).catch(() => {})
    fetch('/geo/cities.json').then(r => r.json())
      .then((rows: [string, string, number, number, number][]) =>
        setBaseCities(rows.map(([name, country, lat, lng]) => ({ name, country, lat, lng }))))
      .catch(() => {})
  }, [])

  // Venue towns from real events join the city list, so small scenes are pickable too
  const cities = useMemo(() => {
    const list = [...baseCities]
    events.events.forEach(e => {
      if (e.lat === null || e.lng === null || !e.city) return
      const dup = list.some(c => c.name.toLowerCase() === e.city.toLowerCase() && distanceKm(c.lat, c.lng, e.lat!, e.lng!) < 30)
      if (!dup) list.push({ name: e.city, country: e.country_code, lat: e.lat, lng: e.lng })
    })
    return list
  }, [baseCities, events.events])

  const countryName = useMemo(() => new Map(countries.map(f => [f.properties.iso, f.properties.name])), [countries])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    if (mode === 'countries') {
      return countries
        .filter(f => f.properties.name.toLowerCase().includes(q))
        .slice(0, 6)
        .map(f => ({ key: f.properties.iso, label: `${flag(f.properties.iso)} ${f.properties.name}`, pick: () => toggleCountry(f.properties.iso) }))
    }
    return cities
      .filter(c => c.name.toLowerCase().startsWith(q))
      .slice(0, 6)
      .map(c => ({
        key: `${c.name}-${c.country}-${c.lat}`,
        label: `${c.name} ${flag(c.country)} ${countryName.get(c.country) ?? ''}`,
        pick: () => toggleCity(c, radius),
      }))
  }, [query, mode, countries, cities, countryName, toggleCountry, toggleCity, radius])

  const shown = everywhere ? events.events : events.nearby
  const outside = events.events.filter(e => !inRegions(e, regions)).length
  const markers = useMemo(
    () => events.events.filter(e => e.lat !== null && e.lng !== null).map(e => ({ lat: e.lat!, lng: e.lng! })),
    [events.events],
  )

  const byMonth = useMemo(() => {
    const g = new Map<string, ArtistEvent[]>()
    shown.forEach(e => {
      const label = new Date(`${e.event_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      g.set(label, [...(g.get(label) ?? []), e])
    })
    return [...g.entries()]
  }, [shown])

  if (!hasTracked) {
    return (
      <div className="no-posts tracked-empty">
        <p>Track some artists, then pick the places you care about to see their shows.</p>
        <button type="button" className="music-filter-btn active" onClick={onFindArtists}>Find artists</button>
      </div>
    )
  }

  return (
    <div className="event-tracker">
      <div className="event-tracker__controls">
        <div className="music-filter-tabs">
          <button type="button" className={`music-filter-btn ${mode === 'countries' ? 'active' : ''}`} onClick={() => { setMode('countries'); setQuery('') }}>Countries</button>
          <button type="button" className={`music-filter-btn ${mode === 'cities' ? 'active' : ''}`} onClick={() => { setMode('cities'); setQuery('') }}>Cities</button>
        </div>
        {mode === 'cities' && (
          <label className="event-tracker__radius">
            Radius
            <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
              {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="music-search__wrap event-tracker__search">
        <div className="music-search__input-row">
          <input
            className="music-search__input"
            type="text"
            placeholder={mode === 'countries' ? 'Find a country…' : 'Find a city…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="music-search__dropdown">
            {suggestions.map(s => (
              <div key={s.key} className="music-search__row" onMouseDown={e => { e.preventDefault(); s.pick(); setQuery('') }}>
                <span className="music-search__title">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <EventGlobe
        mode={mode}
        countries={countries}
        cities={cities}
        selectedCountries={regions.countries}
        selectedCities={regions.cities}
        markers={markers}
        focus={{ lat: 52, lng: -2 }}
        onCountryClick={toggleCountry}
        onCityClick={c => toggleCity(c, radius)}
      />
      <p className="event-tracker__hint">
        Drag to spin, scroll or pinch to zoom, and click {mode === 'countries' ? 'a country' : 'a city dot'} to add or remove it.
        Cyan dots are shows from your tracked artists.
      </p>

      {hasRegions && (
        <div className="event-tracker__chips">
          {regions.countries.map(iso => (
            <button type="button" key={iso} className="region-chip" onClick={() => toggleCountry(iso)}>
              {flag(iso)} {countryName.get(iso) ?? iso} <span aria-hidden>×</span>
            </button>
          ))}
          {regions.cities.map(c => (
            <span key={`${c.name}-${c.country}`} className="region-chip region-chip--city">
              {c.name} {flag(c.country)}
              <select value={c.radiusKm} onChange={e => setCityRadius(c, Number(e.target.value))} aria-label={`Radius around ${c.name}`}>
                {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
              </select>
              <button type="button" onClick={() => toggleCity(c, c.radiusKm)} aria-label={`Remove ${c.name}`}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="artist-profile__section-title">
        {everywhere ? 'All upcoming shows' : 'Shows in your areas'}
        {(outside > 0 || everywhere) && (
          <> · <button type="button" className="release-cal__clear" onClick={() => setEverywhere(v => !v)}>
            {everywhere ? 'only my areas' : `${outside} more elsewhere`}
          </button></>
        )}
      </div>

      {events.loading ? (
        <p className="artist-profile__empty">Loading shows…</p>
      ) : !hasRegions && !everywhere ? (
        <p className="artist-profile__empty">Pick some countries or cities on the globe to see shows near you.</p>
      ) : byMonth.length === 0 ? (
        <p className="artist-profile__empty">No upcoming shows from your tracked artists {everywhere ? 'yet' : 'in these areas yet'}.</p>
      ) : (
        byMonth.map(([label, list]) => (
          <div key={label} className="release-cal__group">
            <div className="music-search__group-label">{label}</div>
            <div className="release-list">
              {list.map(e => <EventRow key={e.event_key} e={e} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
