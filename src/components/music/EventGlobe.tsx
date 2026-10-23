import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CityRegion, distanceKm } from '../../lib/events'

// Rotatable 3D globe. Countries are painted onto an equirectangular canvas
// texture (cheap to repaint when the selection changes); clicks are raycast to
// a lat/lng, then matched to a country polygon or the nearest city.

export interface CountryFeature {
  properties: { iso: string; name: string }
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any }
}
export interface CityPoint { name: string; country: string; lat: number; lng: number }
export interface GlobeMarker { lat: number; lng: number }

const TEX_W = 2048
const TEX_H = 1024
const RADIUS = 1
const COLORS = {
  ocean: '#05040f',
  land: '#1b1733',
  landHover: '#2e2757',
  border: 'rgba(0,245,255,0.35)',
  selected: 'rgba(180,0,255,0.75)',
  selectedBorder: '#e08bff',
}

function toVec(lat: number, lng: number, r = RADIUS): THREE.Vector3 {
  // Matches SphereGeometry's UV layout so markers line up with the texture
  const phi = ((lng + 180) / 360) * Math.PI * 2
  const theta = ((90 - lat) / 180) * Math.PI
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta))
}

function polygons(f: CountryFeature): number[][][][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
}

function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function countryAt(lat: number, lng: number, features: CountryFeature[]): CountryFeature | null {
  for (const f of features) {
    for (const poly of polygons(f)) {
      if (inRing(lng, lat, poly[0]) && !poly.slice(1).some(hole => inRing(lng, lat, hole))) return f
    }
  }
  return null
}

function paint(ctx: CanvasRenderingContext2D, features: CountryFeature[], selected: Set<string>, hovered: string | null) {
  ctx.fillStyle = COLORS.ocean
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  const x = (lng: number) => ((lng + 180) / 360) * TEX_W
  const y = (lat: number) => ((90 - lat) / 180) * TEX_H
  for (const f of features) {
    const iso = f.properties.iso
    const isSel = selected.has(iso)
    ctx.beginPath()
    for (const poly of polygons(f)) {
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(x(lng), y(lat)) : ctx.moveTo(x(lng), y(lat))))
        ctx.closePath()
      }
    }
    ctx.fillStyle = isSel ? COLORS.selected : iso === hovered ? COLORS.landHover : COLORS.land
    ctx.fill('evenodd')
    ctx.strokeStyle = isSel ? COLORS.selectedBorder : COLORS.border
    ctx.lineWidth = isSel ? 2 : 1
    ctx.stroke()
  }
}

function circleOnSphere(lat: number, lng: number, km: number): THREE.Vector3[] {
  // Ring of points `km` away from the centre, lifted just off the surface
  const center = toVec(lat, lng).normalize()
  const ang = km / 6371
  const axis = new THREE.Vector3(0, 1, 0).cross(center).normalize()
  if (axis.lengthSq() === 0) axis.set(1, 0, 0)
  const start = center.clone().applyAxisAngle(axis, ang)
  return Array.from({ length: 65 }, (_, i) =>
    start.clone().applyAxisAngle(center, (i / 64) * Math.PI * 2).multiplyScalar(RADIUS * 1.003))
}

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export default function EventGlobe({
  mode, countries, cities, selectedCountries, selectedCities, markers, focus, onCountryClick, onCityClick,
}: {
  mode: 'countries' | 'cities'
  countries: CountryFeature[]
  cities: CityPoint[]
  selectedCountries: string[]
  selectedCities: CityRegion[]
  markers: GlobeMarker[]
  focus: { lat: number; lng: number }
  onCountryClick: (iso: string) => void
  onCityClick: (city: CityPoint) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<{ text: string; x: number; y: number } | null>(null)

  // Mutable scene state shared between the setup effect and the update effects
  const sceneRef = useRef<{
    ctx: CanvasRenderingContext2D
    texture: THREE.CanvasTexture
    globe: THREE.Mesh
    overlay: THREE.Group
    dot: THREE.Texture
    hovered: string | null
    repaint: () => void
  } | null>(null)
  const propsRef = useRef({ mode, countries, cities, selectedCountries, onCountryClick, onCityClick })
  propsRef.current = { mode, countries, cities, selectedCountries, onCountryClick, onCityClick }

  // ── One-time scene setup ───────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.copy(toVec(focus.lat, focus.lng, 2.7))

    const canvas = document.createElement('canvas')
    canvas.width = TEX_W
    canvas.height = TEX_H
    const ctx = canvas.getContext('2d')!
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

    const globe = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 64), new THREE.MeshBasicMaterial({ map: texture }))
    scene.add(globe)

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.06, 64, 32),
      new THREE.MeshBasicMaterial({ color: 0x7a2bff, transparent: true, opacity: 0.08, side: THREE.BackSide }),
    )
    scene.add(glow)

    const overlay = new THREE.Group()
    scene.add(overlay)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableDamping = true
    controls.rotateSpeed = 0.5
    controls.minDistance = 1.3
    controls.maxDistance = 5
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 0.35
    controls.addEventListener('start', () => { controls.autoRotate = false })

    const repaint = () => {
      const s = sceneRef.current!
      const p = propsRef.current
      const countryMode = p.mode === 'countries'
      paint(s.ctx, p.countries, new Set(countryMode ? p.selectedCountries : []), countryMode ? s.hovered : null)
      s.texture.needsUpdate = true
    }
    sceneRef.current = { ctx, texture, globe, overlay, dot: dotTexture(), hovered: null, repaint }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const latLngAt = (ev: PointerEvent): { lat: number; lng: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(globe)[0]
      if (!hit?.uv) return null
      return { lat: hit.uv.y * 180 - 90, lng: hit.uv.x * 360 - 180 }
    }
    const nearestCity = (lat: number, lng: number): CityPoint | null => {
      // Click tolerance grows as you zoom out
      const maxKm = 60 * camera.position.length()
      let best: CityPoint | null = null
      let bestKm = maxKm
      for (const c of propsRef.current.cities) {
        const d = distanceKm(lat, lng, c.lat, c.lng)
        if (d < bestKm) { best = c; bestKm = d }
      }
      return best
    }

    let down: { x: number; y: number } | null = null
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY } }
    const onUp = (ev: PointerEvent) => {
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) { down = null; return }
      down = null
      const at = latLngAt(ev)
      if (!at) return
      const p = propsRef.current
      if (p.mode === 'countries') {
        const f = countryAt(at.lat, at.lng, p.countries)
        if (f) p.onCountryClick(f.properties.iso)
      } else {
        const c = nearestCity(at.lat, at.lng)
        if (c) p.onCityClick(c)
      }
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.buttons) { setLabel(null); return }
      const at = latLngAt(ev)
      const p = propsRef.current
      const s = sceneRef.current!
      const rect = host.getBoundingClientRect()
      const pos = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
      if (!at) {
        if (s.hovered) { s.hovered = null; repaint() }
        setLabel(null)
        return
      }
      if (p.mode === 'countries') {
        const f = countryAt(at.lat, at.lng, p.countries)
        const iso = f?.properties.iso ?? null
        if (iso !== s.hovered) { s.hovered = iso; repaint() }
        setLabel(f ? { text: f.properties.name, ...pos } : null)
      } else {
        const c = nearestCity(at.lat, at.lng)
        setLabel(c ? { text: c.name, ...pos } : null)
      }
      renderer.domElement.style.cursor = s.hovered || p.mode === 'cities' ? 'pointer' : 'grab'
    }
    const onLeave = () => {
      const s = sceneRef.current!
      if (s.hovered) { s.hovered = null; repaint() }
      setLabel(null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerleave', onLeave)

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    const loop = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerleave', onLeave)
      scene.traverse(o => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | undefined
        mat?.dispose()
      })
      texture.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Repaint countries when data / selection / mode changes ─────────────────
  useEffect(() => {
    sceneRef.current?.repaint()
  }, [countries, selectedCountries, mode])

  // ── Rebuild point overlays (cities, selected cities + radius, events) ──────
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.overlay.children.slice().forEach(o => {
      s.overlay.remove(o)
      ;(o as THREE.Points).geometry?.dispose()
      ;((o as THREE.Points).material as THREE.Material)?.dispose()
    })

    const points = (list: { lat: number; lng: number }[], color: number, size: number, r: number, opacity = 1) => {
      if (!list.length) return
      const geo = new THREE.BufferGeometry().setFromPoints(list.map(p => toVec(p.lat, p.lng, r)))
      s.overlay.add(new THREE.Points(geo, new THREE.PointsMaterial({
        color, size, map: s.dot, transparent: true, opacity, depthWrite: false, sizeAttenuation: true,
      })))
    }

    if (mode === 'cities') {
      points(cities, 0xc8c8ff, 0.018, RADIUS * 1.002, 0.55)
      points(selectedCities, 0xff3fa4, 0.045, RADIUS * 1.004)
      selectedCities.forEach(c => {
        const geo = new THREE.BufferGeometry().setFromPoints(circleOnSphere(c.lat, c.lng, c.radiusKm))
        s.overlay.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff3fa4, transparent: true, opacity: 0.8 })))
      })
    }
    points(markers, 0x00f5ff, 0.07, RADIUS * 1.008)
  }, [mode, cities, selectedCities, markers])

  return (
    <div className="event-globe" ref={hostRef}>
      {label && <div className="event-globe__label" style={{ left: label.x, top: label.y }}>{label.text}</div>}
    </div>
  )
}
