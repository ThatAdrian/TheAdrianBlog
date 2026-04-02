import React, { useEffect, useRef } from 'react'
import {
  ACESFilmicToneMapping, AmbientLight, Clock, Color, InstancedMesh,
  MathUtils, MeshStandardMaterial, Object3D, PerspectiveCamera,
  Plane, PointLight, Raycaster, Scene, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from 'three'

interface BallpitProps {
  count?: number
  gravity?: number
  friction?: number
  wallBounce?: number
  followCursor?: boolean
  colors?: number[]
  minSize?: number
  maxSize?: number
  className?: string
}

const dummy = new Object3D()

function rand(min: number, max: number) { return Math.random() * (max - min) + min }

export default function Ballpit({
  count = 80, gravity = 0.4, friction = 0.9975, wallBounce = 0.95,
  followCursor = true, colors = [0x00f5ff, 0xb400ff, 0x00ff88],
  minSize = 0.3, maxSize = 0.9, className = ''
}: BallpitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.setClearColor(0x000000, 0)

    const scene = new Scene()
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000)
    camera.position.set(0, 0, 20)

    const ambient = new AmbientLight(0xffffff, 0.3)
    scene.add(ambient)
    const light1 = new PointLight(0xffffff, 400)
    light1.position.set(10, 10, 15)
    scene.add(light1)
    const light2 = new PointLight(0x8888ff, 150)
    light2.position.set(-8, -5, 10)
    scene.add(light2)
    const light3 = new PointLight(0xffffff, 100)
    light3.position.set(0, -10, 5)
    scene.add(light3)

    // Build instanced mesh
    const geo = new SphereGeometry(1, 16, 16)
    const mat = new MeshStandardMaterial({ metalness: 0.9, roughness: 0.1 })
    const mesh = new InstancedMesh(geo, mat, count)
    mesh.instanceMatrix.setUsage(35048)
    scene.add(mesh)

    // Set per-instance colours
    const colorObjs = colors.map(c => new Color(c))
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, colorObjs[i % colorObjs.length])
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Physics state
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    let maxX = 8, maxY = 8

    function resetPhysics() {
      const fov = camera.fov * (Math.PI / 180)
      const dist = camera.position.z
      maxY = Math.tan(fov / 2) * dist
      maxX = maxY * camera.aspect
      for (let i = 0; i < count; i++) {
        sizes[i] = rand(minSize, maxSize)
        pos[i*3]   = rand(-maxX, maxX)
        pos[i*3+1] = rand(-maxY, maxY)
        pos[i*3+2] = rand(-1, 1)
        vel[i*3]   = 0; vel[i*3+1] = 0; vel[i*3+2] = 0
      }
    }

    function resize() {
      const w = parent.offsetWidth, h = parent.offsetHeight
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const fov = camera.fov * (Math.PI / 180)
      const dist = camera.position.z
      maxY = Math.tan(fov / 2) * dist
      maxX = maxY * camera.aspect
    }

    resize()
    resetPhysics()

    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    // Cursor tracking
    const cursor = new Vector2(9999, 9999)
    const raycaster = new Raycaster()
    const plane = new Plane(new Vector3(0, 0, 1), 0)
    const ip = new Vector3()

    function onMove(e: MouseEvent | TouchEvent) {
      if (!followCursor) return
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      cursor.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(cursor, camera)
      camera.getWorldDirection(plane.normal)
      raycaster.ray.intersectPlane(plane, ip)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove)

    let rafId: number
    const clock = new Clock()

    function animate() {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)

      for (let i = 0; i < count; i++) {
        const b = i * 3
        vel[b+1] -= gravity * sizes[i] * dt * 60
        vel[b]   *= friction; vel[b+1] *= friction; vel[b+2] *= friction
        pos[b]   += vel[b]; pos[b+1] += vel[b+1]; pos[b+2] += vel[b+2]

        // Cursor repulsion
        if (followCursor && ip.x !== 0) {
          const dx = pos[b] - ip.x, dy = pos[b+1] - ip.y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d < 2.5) {
            const f = (2.5 - d) / 2.5 * 0.3
            vel[b]   += dx / d * f
            vel[b+1] += dy / d * f
          }
        }

        // Wall bounce
        const r = sizes[i]
        if (pos[b] + r > maxX)   { pos[b]   = maxX - r;   vel[b]   = -Math.abs(vel[b])   * wallBounce }
        if (pos[b] - r < -maxX)  { pos[b]   = -maxX + r;  vel[b]   =  Math.abs(vel[b])   * wallBounce }
        if (pos[b+1] + r > maxY) { pos[b+1] = maxY - r;   vel[b+1] = -Math.abs(vel[b+1]) * wallBounce }
        if (pos[b+1] - r < -maxY){ pos[b+1] = -maxY + r;  vel[b+1] =  Math.abs(vel[b+1]) * wallBounce }

        dummy.position.set(pos[b], pos[b+1], pos[b+2])
        dummy.scale.setScalar(r)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
