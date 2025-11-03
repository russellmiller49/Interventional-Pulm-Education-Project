'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

export type XRViewerProps = {
  glbSrc: string
  usdzSrc?: string
  title?: string
}

export default function XRViewer({ glbSrc, usdzSrc, title = 'Enter Spatial' }: XRViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100)
    camera.position.set(0, 1.6, 2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.xr.enabled = true
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.8)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(1, 2, 3)
    scene.add(dir)

    const grid = new THREE.GridHelper(8, 8, 0x444444, 0x222222)
    grid.position.y = 0
    scene.add(grid)

    const loader = new GLTFLoader()
    loader.load(glbSrc, (gltf) => {
      const root = gltf.scene
      root.position.set(0, 1.4, -1.2)
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true
          object.receiveShadow = true
        }
      })
      scene.add(root)
    })

    const onSelect = () => {
      // reserved for future interactions
    }

    renderer.xr.addEventListener('sessionstart', () => {
      const session = renderer.xr.getSession()
      session?.addEventListener('select', onSelect)
    })

    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera)
    })

    const button = VRButton.createButton(renderer, {
      optionalFeatures: ['local-floor', 'hand-tracking'],
    })
    button.id = 'enter-spatial'
    button.textContent = title
    container.appendChild(button)

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h || 1
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      window.removeEventListener('resize', onResize)
      renderer.setAnimationLoop(null)
      const session = renderer.xr.getSession()
      session?.removeEventListener('select', onSelect)
      session?.end().catch(() => {})
      container.querySelector('#enter-spatial')?.remove()
      container.removeChild(renderer.domElement)
    }
  }, [glbSrc, title])

  return (
    <div ref={containerRef} className="relative h-screen w-screen">
      <div className="absolute left-4 bottom-4 z-10 flex gap-2">
        {usdzSrc && (
          <a
            className="rounded bg-white/10 px-3 py-2 text-sm backdrop-blur"
            rel="ar"
            href={usdzSrc}
          >
            View in AR (iPhone/iPad)
          </a>
        )}
        <a className="rounded bg-white/10 px-3 py-2 text-sm backdrop-blur" href={glbSrc} download>
          Download GLB
        </a>
      </div>
    </div>
  )
}
