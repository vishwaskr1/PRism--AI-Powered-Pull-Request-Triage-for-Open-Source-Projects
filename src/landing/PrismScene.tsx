import { useEffect, useRef } from "react"
import * as THREE from "three"

function motionReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function lowPowerDevice() {
  const device = navigator as Navigator & { deviceMemory?: number }
  return (
    (device.deviceMemory !== undefined && device.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency !== undefined &&
      navigator.hardwareConcurrency <= 2)
  )
}

export default function PrismScene() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const hero = host?.parentElement
    if (!host || !hero || lowPowerDevice()) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      })
    } catch {
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 9)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.setAttribute("aria-hidden", "true")
    host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xc8bbff, 2.1))
    const key = new THREE.DirectionalLight(0xe8e2ff, 3.2)
    key.position.set(-3, 5, 7)
    scene.add(key)
    const rim = new THREE.PointLight(0x8272ff, 18, 18)
    rim.position.set(3, -1, 3)
    scene.add(rim)

    const prismShape = new THREE.Shape()
    prismShape.moveTo(0, 1.55)
    prismShape.lineTo(-1.4, -1.15)
    prismShape.lineTo(1.4, -1.15)
    prismShape.closePath()
    const prismGeometry = new THREE.ExtrudeGeometry(prismShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.06,
    })
    prismGeometry.center()
    const prismMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xaaa0ef,
      metalness: 0.04,
      roughness: 0.12,
      transmission: 0.78,
      thickness: 1.2,
      ior: 1.4,
      transparent: true,
      opacity: 0.8,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    })
    const prism = new THREE.Mesh(prismGeometry, prismMaterial)
    prism.position.set(1.65, 0.15, 0)
    scene.add(prism)
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(prismGeometry),
      new THREE.LineBasicMaterial({
        color: 0xd8d0ff,
        transparent: true,
        opacity: 0.4,
      }),
    )
    prism.add(edges)

    const line = (
      points: THREE.Vector3[],
      color: number,
      opacity: number,
      width = 0.012,
    ) => {
      const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        32,
        width,
        5,
        false,
      )
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)
      return mesh
    }
    const spectrum = [0x9c79ff, 0x668dff, 0x54d0c4]
    spectrum.forEach((color, index) => {
      const y = 0.25 - index * 0.08
      line(
        [
          new THREE.Vector3(0.45, y, 0.15),
          new THREE.Vector3(1.0, y - 0.15, 0.12),
          new THREE.Vector3(3.8, y - 0.85 - index * 0.48, 0),
        ],
        color,
        0.23,
        0.009,
      )
    })

    const particleCount = 72
    const particlePositions = new Float32Array(particleCount * 3)
    const particleDrift = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i += 1) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 8
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.5
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.8 - 0.8
      particleDrift[i] = Math.random() * Math.PI * 2
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    )
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xa99aff,
      size: 0.022,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(particleGeometry, particleMaterial))

    const pointer = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    let inView = false
    let pageVisible = !document.hidden
    let frame = 0
    let elapsed = 0
    const reduced = motionReduced()
    const resize = () => {
      if (window.innerWidth < 768) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        return
      }
      const rect = host.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height, false)
      camera.aspect = rect.width / Math.max(rect.height, 1)
      camera.updateProjectionMatrix()
      if (inView && pageVisible && !frame) frame = requestAnimationFrame(tick)
    }
    const onPointer = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect()
      target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }
    const tick = () => {
      frame = 0
      if (!inView || !pageVisible) return
      elapsed += 0.016
      pointer.x += (target.x - pointer.x) * 0.035
      pointer.y += (target.y - pointer.y) * 0.035
      // Cursor influence stays below ten degrees; idle drift remains deliberately slow.
      prism.rotation.y = Math.sin(elapsed * 0.18) * 0.08 + pointer.x * 0.12
      prism.rotation.x = Math.cos(elapsed * 0.14) * 0.04 - pointer.y * 0.12
      prism.rotation.z = Math.sin(elapsed * 0.12) * 0.025 + pointer.x * 0.035
      const positions = particleGeometry.attributes
        .position as THREE.BufferAttribute
      for (let i = 0; i < particleCount; i += 1) {
        const y =
          positions.getY(i) +
          Math.sin(elapsed * 0.14 + particleDrift[i]) * 0.0008
        positions.setY(i, y > 2.5 ? -2.5 : y)
      }
      positions.needsUpdate = true
      renderer.render(scene, camera)
      if (!reduced) frame = window.requestAnimationFrame(tick)
    }
    const visibility = () => {
      pageVisible = !document.hidden
      if (pageVisible && inView && !frame) frame = requestAnimationFrame(tick)
      if (!pageVisible && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && window.innerWidth >= 768
        if (inView && pageVisible) {
          resize()
          if (!frame) frame = requestAnimationFrame(tick)
        } else if (frame) {
          cancelAnimationFrame(frame)
          frame = 0
        }
      },
      { threshold: 0.01 },
    )
    observer.observe(hero)
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    hero.addEventListener("pointermove", onPointer, { passive: true })
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("resize", resize, { passive: true })
    resize()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      hero.removeEventListener("pointermove", onPointer)
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("resize", resize)
      prismGeometry.dispose()
      prismMaterial.dispose()
      edges.geometry.dispose()
      ;(edges.material as THREE.Material).dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object !== prism) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material))
            material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div className="prism-scene" ref={hostRef} aria-hidden="true" />
}
