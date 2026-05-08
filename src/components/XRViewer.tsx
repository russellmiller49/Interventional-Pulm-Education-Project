'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

export type XRViewerProps = {
  glbSrc: string
  usdzSrc?: string
  title?: string
}

type SpatialPlacement = {
  position: THREE.Vector3
  scale: number
}

type ActiveGrab = {
  controller: THREE.Group
  offset: THREE.Vector3
  inverseStartControllerQuaternion: THREE.Quaternion
  startModelQuaternion: THREE.Quaternion
}

function createControllerRay() {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])
  const material = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  })
  const ray = new THREE.Line(geometry, material)
  ray.name = 'XR select ray'
  ray.scale.z = 1.6
  ray.visible = false
  return ray
}

function getControllerTransform(controller: THREE.Group) {
  controller.updateMatrixWorld(true)
  const position = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  const rotation = new THREE.Matrix4().extractRotation(controller.matrixWorld)
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotation)
  return { position, quaternion, rotation }
}

function collectVisibleMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh && object.visible) {
      meshes.push(object as THREE.Mesh)
    }
  })
  return meshes
}

function fitModelForSpatialView(root: THREE.Group): SpatialPlacement {
  root.rotation.y += Math.PI
  root.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.sub(center)
  root.updateMatrixWorld(true)

  const centeredBox = new THREE.Box3().setFromObject(root)
  const size = centeredBox.getSize(new THREE.Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
  const scale = Math.min(Math.max(1.05 / maxDimension, 0.001), 12)

  return {
    position: new THREE.Vector3(0, 1.28, -1.35),
    scale,
  }
}

function applySpatialPlacement(group: THREE.Group, placement: SpatialPlacement) {
  group.position.copy(placement.position)
  group.scale.setScalar(placement.scale)
  group.quaternion.identity()
  group.updateMatrixWorld(true)

  const placedBox = new THREE.Box3().setFromObject(group)
  if (!placedBox.isEmpty()) {
    const placedCenter = placedBox.getCenter(new THREE.Vector3())
    group.position.add(placement.position.clone().sub(placedCenter))
  }
}

function styleXRButton(button: HTMLElement) {
  Object.assign(button.style, {
    position: 'static',
    bottom: 'auto',
    left: 'auto',
    right: 'auto',
    transform: 'none',
    minWidth: '8rem',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#f8fafc',
    font: '600 12px system-ui, sans-serif',
    padding: '10px 14px',
  })
}

export default function XRViewer({
  glbSrc,
  usdzSrc,
  title = 'Spatial anatomy viewer',
}: XRViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100)
    camera.position.set(0, 1.6, 2)
    camera.lookAt(0, 1.28, -1.35)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType?.('local-floor')
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.85)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.0)
    dir.position.set(1, 2, 3)
    scene.add(dir)
    const fill = new THREE.DirectionalLight(0x8ec5ff, 0.35)
    fill.position.set(-2, 1, -2)
    scene.add(fill)

    const grid = new THREE.GridHelper(4, 8, 0x38bdf8, 0x1e293b)
    grid.position.y = 0.02
    scene.add(grid)

    const modelGroup = new THREE.Group()
    scene.add(modelGroup)

    const loader = new GLTFLoader()
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    loader.setDRACOLoader(dracoLoader)
    let loadCancelled = false
    let basePlacement: SpatialPlacement | null = null
    let activeGrab: ActiveGrab | null = null

    loader.load(
      glbSrc,
      (gltf) => {
        if (loadCancelled) {
          return
        }

        const root = gltf.scene
        root.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true
            object.receiveShadow = true
          }
        })

        modelGroup.clear()
        modelGroup.add(root)
        basePlacement = fitModelForSpatialView(root)
        applySpatialPlacement(modelGroup, basePlacement)
        setModelStatus('ready')
      },
      undefined,
      (error) => {
        console.error('Failed to load spatial model', error)
        if (!loadCancelled) {
          setModelStatus('error')
        }
      },
    )

    const raycaster = new THREE.Raycaster()
    const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)]
    const rays = controllers.map(() => createControllerRay())
    const cleanupHandlers: Array<() => void> = []

    const beginGrab = (controller: THREE.Group) => {
      if (!modelGroup.children.length) {
        return
      }

      const { position, quaternion, rotation } = getControllerTransform(controller)
      raycaster.ray.origin.copy(position)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation)

      const intersections = raycaster.intersectObjects(collectVisibleMeshes(modelGroup), false)
      if (!intersections.length) {
        return
      }

      activeGrab = {
        controller,
        offset: modelGroup.position.clone().sub(position),
        inverseStartControllerQuaternion: quaternion.clone().invert(),
        startModelQuaternion: modelGroup.quaternion.clone(),
      }
    }

    const endGrab = (controller: THREE.Group) => {
      if (activeGrab?.controller === controller) {
        activeGrab = null
      }
    }

    const resetPlacement = () => {
      if (basePlacement) {
        applySpatialPlacement(modelGroup, basePlacement)
      }
      activeGrab = null
    }

    controllers.forEach((controller, index) => {
      const ray = rays[index]
      controller.add(ray)
      scene.add(controller)

      const handleSelectStart = () => beginGrab(controller)
      const handleSelectEnd = () => endGrab(controller)
      const handleSqueezeStart = () => resetPlacement()

      controller.addEventListener('selectstart', handleSelectStart)
      controller.addEventListener('selectend', handleSelectEnd)
      controller.addEventListener('squeezestart', handleSqueezeStart)

      cleanupHandlers.push(() => {
        controller.removeEventListener('selectstart', handleSelectStart)
        controller.removeEventListener('selectend', handleSelectEnd)
        controller.removeEventListener('squeezestart', handleSqueezeStart)
        controller.remove(ray)
        scene.remove(controller)
        ray.geometry.dispose()
        ;(ray.material as THREE.LineBasicMaterial).dispose()
      })
    })

    const handleSessionStart = () => {
      rays.forEach((ray) => {
        ray.visible = true
      })
      const session = renderer.xr.getSession()
      if (session?.environmentBlendMode && session.environmentBlendMode !== 'opaque') {
        scene.background = null
      }
      session?.addEventListener(
        'end',
        () => {
          scene.background = new THREE.Color(0x000000)
          rays.forEach((ray) => {
            ray.visible = false
          })
          resetPlacement()
        },
        { once: true },
      )
    }
    renderer.xr.addEventListener('sessionstart', handleSessionStart)

    renderer.setAnimationLoop(() => {
      if (activeGrab) {
        const { position, quaternion } = getControllerTransform(activeGrab.controller)
        modelGroup.position.copy(position).add(activeGrab.offset)
        const delta = quaternion.multiply(activeGrab.inverseStartControllerQuaternion)
        modelGroup.quaternion.copy(delta.multiply(activeGrab.startModelQuaternion))
      }

      renderer.render(scene, camera)
    })

    const buttonBar = document.createElement('div')
    buttonBar.className = 'absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2'
    const vrButton = VRButton.createButton(renderer, {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    })
    const arButton = ARButton.createButton(renderer, {
      optionalFeatures: ['local-floor', 'hit-test', 'hand-tracking'],
    })
    styleXRButton(vrButton)
    styleXRButton(arButton)
    buttonBar.append(vrButton, arButton)
    container.appendChild(buttonBar)

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h || 1
      camera.lookAt(0, 1.28, -1.35)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    onResize()

    return () => {
      loadCancelled = true
      window.removeEventListener('resize', onResize)
      renderer.xr.removeEventListener('sessionstart', handleSessionStart)
      cleanupHandlers.forEach((cleanup) => cleanup())
      renderer.setAnimationLoop(null)
      const session = renderer.xr.getSession()
      session?.end().catch(() => {})
      buttonBar.remove()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      dracoLoader.dispose()
      renderer.dispose()
    }
  }, [glbSrc])

  return (
    <div
      ref={containerRef}
      data-model-status={modelStatus}
      className="relative h-screen w-screen overflow-hidden bg-black"
    >
      <div className="pointer-events-none absolute left-4 top-28 z-10 max-w-sm rounded-2xl border border-white/10 bg-black/45 p-4 text-white shadow-2xl backdrop-blur sm:top-4">
        <h1 className="text-sm font-semibold">{title}</h1>
        <p className="mt-1 text-xs text-white/70">
          Select or pinch a visible part of the model to grab it. Squeeze recenters the anatomy.
        </p>
      </div>
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
        {usdzSrc ? (
          <a
            className="rounded-full bg-white/10 px-3 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
            rel="ar"
            href={usdzSrc}
          >
            View in AR
          </a>
        ) : null}
        <a
          className="rounded-full bg-white/10 px-3 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
          href={glbSrc}
          download
        >
          Download GLB
        </a>
      </div>
    </div>
  )
}
