'use client'

import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { usePathname } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'
import { applySegmentColors, computePlaneConstant, useAnatomyAsset } from '@/lib/3d-utils'
import { AxesHelper, Box3, MeshStandardMaterial, Plane, SRGBColorSpace, Vector3 } from 'three'
import type { WebGLRenderer } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface AnatomyViewerProps {
  model: AnatomyModel
  visibleSegments: Record<string, boolean>
  crossSection: number
  showAnnotations: boolean
  resetSignal: number
  showDebugHelpers?: boolean
  rotation?: { x: number; y: number; z: number }
  onScreenshot?: (dataUrl: string) => void
  onError?: (message: string) => void
  onSegmentsChanged?: (segments: AnatomySegment[]) => void
}

export function AnatomyViewer({
  model,
  visibleSegments,
  crossSection,
  showAnnotations,
  resetSignal,
  showDebugHelpers = false,
  rotation = { x: 0, y: 0, z: 0 },
  onScreenshot,
  onError,
  onSegmentsChanged,
}: AnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const assetState = useAnatomyAsset(model)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [debugCoords, setDebugCoords] = useState({
    position: [0, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  })
  const pathname = usePathname()
  const prevSegmentsRef = useRef<AnatomySegment[] | null>(null)

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches)
    }
    handler()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    const listener = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', listener)
    return () => document.removeEventListener('fullscreenchange', listener)
  }, [])

  useEffect(() => {
    if (assetState.status === 'error' && onError) {
      onError(assetState.error)
    }
  }, [assetState, onError])
  const preparedScene = useMemo(() => {
    if (assetState.status !== 'success') {
      return null
    }
    const groupClone = assetState.group.clone(true)
    const rotationRadians = {
      x: (rotation.x * Math.PI) / 180,
      y: (rotation.y * Math.PI) / 180,
      z: (rotation.z * Math.PI) / 180,
    }
    groupClone.rotation.x += rotationRadians.x
    groupClone.rotation.y += rotationRadians.y
    groupClone.rotation.z += rotationRadians.z
    groupClone.updateMatrixWorld(true)
    const segmentSeed =
      assetState.segments && assetState.segments.length ? assetState.segments : model.segments
    const effectiveModel: AnatomyModel =
      segmentSeed === model.segments ? model : { ...model, segments: segmentSeed }
    const { meshesBySegment, segments: hydratedSegments } = applySegmentColors(
      groupClone,
      effectiveModel,
    )
    const boundingBox = new Box3().setFromObject(groupClone)
    return {
      group: groupClone,
      segmentMeshes: meshesBySegment,
      boundingBox,
      segments: hydratedSegments,
    }
  }, [assetState, model, rotation])

  useEffect(() => {
    if (!preparedScene || !onSegmentsChanged) {
      return
    }
    const prev = prevSegmentsRef.current
    const next = preparedScene.segments
    const hasChanged =
      !prev ||
      prev.length !== next.length ||
      prev.some((prevSegment, index) => {
        const segment = next[index]
        return (
          !segment ||
          prevSegment.id !== segment.id ||
          prevSegment.color !== segment.color ||
          prevSegment.visibleByDefault !== segment.visibleByDefault
        )
      })

    if (hasChanged) {
      prevSegmentsRef.current = next.map((segment) => ({ ...segment }))
      onSegmentsChanged(next.map((segment) => ({ ...segment })))
    }
  }, [preparedScene, onSegmentsChanged])

  const boundingSize = useMemo(() => {
    if (!preparedScene) {
      return null
    }
    return preparedScene.boundingBox.getSize(new Vector3())
  }, [preparedScene])

  const radius = useMemo(() => {
    if (!boundingSize) {
      return 1
    }
    return boundingSize.length() / 2
  }, [boundingSize])

  const cameraTarget = useMemo<[number, number, number]>(() => {
    if (model.defaultCamera?.target) {
      return model.defaultCamera.target
    }
    if (!boundingSize) {
      return [0, 0, 0]
    }
    return [0, boundingSize.y * 0.05, 0]
  }, [model.defaultCamera, boundingSize])

  const cameraPosition = useMemo<[number, number, number]>(() => {
    if (model.defaultCamera?.position) {
      return model.defaultCamera.position
    }
    if (!boundingSize) {
      return [0, 1.5, 6]
    }
    return [0, boundingSize.y * 0.1, radius * 2.8]
  }, [model.defaultCamera, boundingSize, radius])

  const maxDistance = useMemo(() => {
    // For GLB models, use larger max distance
    if (model.downloads.some((d) => d.format === 'glb')) {
      return Math.max(radius * 10, 20)
    }
    return Math.max(radius * 3.5, 10)
  }, [radius, model.downloads])

  const minDistance = useMemo(() => {
    // For GLB models, allow much closer viewing
    if (model.downloads.some((d) => d.format === 'glb')) {
      return Math.max(radius * 0.1, 0.1)
    }
    return Math.max(Math.min(radius * 0.25, 2.5), 1.2)
  }, [radius, model.downloads])

  const axesHelper = useMemo(() => new AxesHelper(2.5), [])

  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.target && model.defaultCamera?.position) {
      controlsRef.current.target.set(...model.defaultCamera.target)
      controlsRef.current.object.position.set(...model.defaultCamera.position)
      controlsRef.current.update()
    }
  }, [model.defaultCamera])

  // Ensure camera position is set after OrbitControls initializes
  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.position) {
      const timer = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.object.position.set(...model.defaultCamera.position)
          controlsRef.current.update()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [model.defaultCamera, model.downloads, preparedScene])

  // Force camera position on initial load
  useEffect(() => {
    if (controlsRef.current && model.defaultCamera?.position && preparedScene) {
      const timer = setTimeout(() => {
        if (controlsRef.current) {
          // For GLB models, auto-fit to bounding box
          if (model.downloads.some((d) => d.format === 'glb') && preparedScene.boundingBox) {
            const size = preparedScene.boundingBox.getSize(new Vector3())
            const center = preparedScene.boundingBox.getCenter(new Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const distance = Math.max(maxDim * 4.5, maxDim + 1.5)

            controlsRef.current.object.position.set(distance, distance, distance)
            controlsRef.current.target.set(center.x, center.y, center.z)

            console.log('Auto-positioned camera for GLB:', {
              position: [distance, distance, distance],
              target: center,
              modelSize: size,
              maxDim: maxDim,
            })
          } else {
            controlsRef.current.object.position.set(...model.defaultCamera.position)
            controlsRef.current.target.set(...model.defaultCamera.target)
          }
          controlsRef.current.update()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [preparedScene, model.defaultCamera, model.downloads])

  useEffect(() => {
    if (!showDebugHelpers) {
      return
    }

    let cleanup: (() => void) | undefined
    let frameId: number | undefined

    const attach = () => {
      const controls = controlsRef.current
      if (!controls) {
        frameId = requestAnimationFrame(attach)
        return
      }

      const update = () => {
        const { x: px, y: py, z: pz } = controls.object.position
        const { x: tx, y: ty, z: tz } = controls.target
        setDebugCoords({ position: [px, py, pz], target: [tx, ty, tz] })
      }

      update()
      controls.addEventListener('change', update)
      cleanup = () => controls.removeEventListener('change', update)
    }

    attach()

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
      if (cleanup) {
        cleanup()
      }
    }
  }, [showDebugHelpers, resetSignal, preparedScene])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
      controlsRef.current.update()
    }
  }, [cameraTarget])

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset()
      controlsRef.current.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2])
      if (model.defaultCamera?.position) {
        controlsRef.current.object.position.set(...model.defaultCamera.position)
      }
      controlsRef.current.update()
    }
  }, [resetSignal, pathname, cameraTarget, model.defaultCamera])

  useEffect(() => {
    if (!preparedScene) {
      return
    }
    Object.entries(preparedScene.segmentMeshes).forEach(([segmentId, meshes]) => {
      const visible = visibleSegments[segmentId] ?? true
      meshes.forEach((mesh) => {
        mesh.visible = visible
        if (mesh.material && mesh.material instanceof MeshStandardMaterial) {
          mesh.material.opacity = visible ? 0.9 : 0.15
          mesh.material.transparent = true
          mesh.material.needsUpdate = true
        }
      })
    })
  }, [preparedScene, visibleSegments])

  useEffect(() => {
    if (!preparedScene || !glRef.current) {
      return
    }
    const clippingEnabled = crossSection > 0
    const gl = glRef.current
    gl.localClippingEnabled = clippingEnabled
    const planeConstant = computePlaneConstant(preparedScene.boundingBox, crossSection)
    const plane = new Plane(new Vector3(0, -1, 0), planeConstant)
    Object.values(preparedScene.segmentMeshes).forEach((meshes) => {
      meshes.forEach((mesh) => {
        const material = mesh.material as MeshStandardMaterial
        material.clippingPlanes = clippingEnabled ? [plane] : []
        material.needsUpdate = true
      })
    })
  }, [preparedScene, crossSection])

  const handleFullscreenToggle = () => {
    const element = containerRef.current
    if (!element) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void element.requestFullscreen?.()
    }
  }

  const handleScreenshot = () => {
    if (!glRef.current) {
      return
    }
    const dataUrl = glRef.current.domElement.toDataURL('image/png')
    if (onScreenshot) {
      onScreenshot(dataUrl)
    }
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${model.slug}-viewer.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (assetState.status === 'error') {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-3xl border border-border/60 bg-muted/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Unable to load the 3D model. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border/60 bg-background/60"
    >
      {assetState.status === 'loading' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <span className="text-sm text-muted-foreground">Loading 3D anatomy…</span>
        </div>
      ) : null}
      <Canvas
        shadows
        dpr={[1, isMobile ? 1 : 1.5]}
        onCreated={({ gl }) => {
          glRef.current = gl
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMappingExposure = 1.2
          gl.setClearColor('#0b172b')
          // Handle context loss
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            console.warn('WebGL context lost')
            event.preventDefault()
          })
          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored')
            // Force re-render
            if (preparedScene) {
              // Trigger re-render
            }
          })
        }}
      >
        <color attach="background" args={['#0b172b']} />
        <AdaptiveDpr pixelated />
        <PerspectiveCamera position={cameraPosition} fov={45} />
        <ambientLight intensity={0.85} />
        <hemisphereLight color="#f8fafc" groundColor="#111827" intensity={0.85} />
        <directionalLight position={[6, 7, 6]} intensity={1.0} castShadow />
        <directionalLight position={[-5, -3, -6]} intensity={0.5} />
        <spotLight position={[0, 9, 5]} intensity={0.75} angle={0.8} penumbra={0.55} castShadow />
        {showDebugHelpers ? <primitive object={axesHelper} /> : null}
        {/* Always show debug helpers for GLB models */}
        {model.downloads.some((d) => d.format === 'glb') ? <primitive object={axesHelper} /> : null}
        {preparedScene ? (
          <Suspense
            fallback={
              <Html center className="text-xs text-muted-foreground">
                Preparing anatomy…
              </Html>
            }
          >
            <primitive object={preparedScene.group} />
          </Suspense>
        ) : null}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={!isMobile}
          minDistance={minDistance}
          maxDistance={maxDistance}
          target={cameraTarget}
          autoRotate={false}
          enableDamping={false}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-center justify-between">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            {showAnnotations
              ? model.segments.slice(0, 8).map((segment) => (
                  <span key={segment.id} className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.name}
                  </span>
                ))
              : 'Annotations hidden'}
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => controlsRef.current?.reset()}
              className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={handleScreenshot}
              className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Screenshot
            </button>
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>
        <div className="pointer-events-auto ml-auto inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
          <span>{crossSection}% cross-section</span>
        </div>
        {showDebugHelpers ? (
          <div className="pointer-events-auto mt-3 inline-flex max-w-xs flex-col gap-1 self-start rounded-lg bg-background/85 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
            <span className="font-semibold uppercase tracking-[0.3em] text-muted-foreground/80">
              Camera
            </span>
            <span>Pos: {debugCoords.position.map((value) => value.toFixed(2)).join(', ')}</span>
            <span>Target: {debugCoords.target.map((value) => value.toFixed(2)).join(', ')}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
