'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, Html, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { usePathname } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AnatomyModel, AnatomySegment } from '@/lib/types'
import {
  applySegmentColors,
  computePlaneConstant,
  useAnatomyAsset,
  useVolumeAsset,
} from '@/lib/3d-utils'
import {
  AxesHelper,
  Box3,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Matrix4,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { Group, Mesh, Object3D } from 'three'
import type { WebGLRenderer } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type VolumeSlice from 'three/examples/jsm/misc/VolumeSlice.js'

const AXIS_LABELS: Record<'x' | 'y' | 'z', string> = {
  x: 'Sagittal',
  y: 'Coronal',
  z: 'Axial',
}

type WindowPresetKey = 'default' | 'soft-tissue' | 'lung' | 'bone' | 'custom'
type ImmersiveXRMode = 'immersive-ar' | 'immersive-vr'

interface XRCapabilities {
  checked: boolean
  hasWebXR: boolean
  immersiveAR: boolean
  immersiveVR: boolean
}

interface SpatialPlacement {
  position: [number, number, number]
  scale: number
}

interface ActiveGrab {
  controller: Group
  offset: Vector3
  inverseStartControllerQuaternion: Quaternion
  startModelQuaternion: Quaternion
}

const WINDOW_PRESET_MAP: Record<
  Exclude<WindowPresetKey, 'default' | 'custom'>,
  { low: number; high: number; label: string }
> = {
  'soft-tissue': { label: 'Soft Tissue', low: -160, high: 240 },
  lung: { label: 'Lung', low: -1000, high: -300 },
  bone: { label: 'Bone', low: 200, high: 2000 },
}

function getSliceTransform(axis: 'x' | 'y' | 'z'): string {
  if (axis === 'y') {
    return 'rotate(180deg)'
  }
  if (axis === 'x') {
    return 'rotate(90deg)'
  }
  // Axial slices: flip left/right
  return 'scaleX(-1)'
}

function isRenderableVolumeSlice(slice: VolumeSlice | null): slice is VolumeSlice {
  const candidate = slice as (VolumeSlice & { iLength?: number; jLength?: number }) | null
  return Boolean(
    candidate?.canvas &&
    candidate.canvas.width > 0 &&
    candidate.canvas.height > 0 &&
    (candidate.iLength ?? 0) > 0 &&
    (candidate.jLength ?? 0) > 0,
  )
}

function computeSpatialPlacement(boundingBox: Box3): SpatialPlacement {
  const size = boundingBox.getSize(new Vector3())
  const center = boundingBox.getCenter(new Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
  const scale = Math.min(Math.max(1.05 / maxDimension, 0.001), 12)

  return {
    position: [-center.x * scale, 1.28 - center.y * scale, -1.35 - center.z * scale],
    scale,
  }
}

function applySpatialPlacement(group: Group, placement: SpatialPlacement) {
  group.position.set(...placement.position)
  group.scale.setScalar(placement.scale)
  group.quaternion.identity()
}

function resetDesktopPlacement(group: Group) {
  group.position.set(0, 0, 0)
  group.scale.setScalar(1)
  group.quaternion.identity()
}

function createControllerRay() {
  const geometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, -1)])
  const material = new LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  })
  const ray = new Line(geometry, material)
  ray.name = 'XR select ray'
  ray.scale.z = 1.6
  return ray
}

function getControllerTransform(controller: Group) {
  controller.updateMatrixWorld(true)
  const position = new Vector3().setFromMatrixPosition(controller.matrixWorld)
  const rotation = new Matrix4().extractRotation(controller.matrixWorld)
  const quaternion = new Quaternion().setFromRotationMatrix(rotation)
  return { position, quaternion, rotation }
}

function collectVisibleMeshes(root: Group) {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh && object.visible) {
      meshes.push(object as Mesh)
    }
  })
  return meshes
}

function getSegmentLabel(object: Object3D) {
  let current: Object3D | null = object
  while (current) {
    if (typeof current.userData.segmentLabel === 'string') {
      return current.userData.segmentLabel
    }
    if (typeof current.userData.segmentId === 'string') {
      return current.userData.segmentId
    }
    current = current.parent
  }
  return object.name || 'Anatomy segment'
}

function XRSpatialControllers({
  enabled,
  targetRef,
  placement,
  onSelectSegment,
}: {
  enabled: boolean
  targetRef: RefObject<Group | null>
  placement: SpatialPlacement | null
  onSelectSegment: (label: string | null) => void
}) {
  const { gl, scene } = useThree()
  const activeGrabRef = useRef<ActiveGrab | null>(null)
  const raycasterRef = useRef(new Raycaster())

  useEffect(() => {
    if (!enabled) {
      activeGrabRef.current = null
      return
    }

    const controllers = [gl.xr.getController(0), gl.xr.getController(1)]
    const rays = controllers.map(() => createControllerRay())

    const beginGrab = (controller: Group) => {
      const target = targetRef.current
      if (!target) {
        return
      }

      const { position, quaternion, rotation } = getControllerTransform(controller)
      const raycaster = raycasterRef.current
      raycaster.ray.origin.copy(position)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation)

      const intersections = raycaster.intersectObjects(collectVisibleMeshes(target), false)
      if (!intersections.length) {
        return
      }

      onSelectSegment(getSegmentLabel(intersections[0].object))
      activeGrabRef.current = {
        controller,
        offset: target.position.clone().sub(position),
        inverseStartControllerQuaternion: quaternion.clone().invert(),
        startModelQuaternion: target.quaternion.clone(),
      }
    }

    const endGrab = (controller: Group) => {
      if (activeGrabRef.current?.controller === controller) {
        activeGrabRef.current = null
      }
    }

    const resetPlacement = () => {
      const target = targetRef.current
      if (!target || !placement) {
        return
      }
      applySpatialPlacement(target, placement)
      activeGrabRef.current = null
      onSelectSegment('Spatial placement reset')
    }

    const cleanupHandlers: Array<() => void> = []

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
        ;(ray.material as LineBasicMaterial).dispose()
      })
    })

    return () => {
      activeGrabRef.current = null
      cleanupHandlers.forEach((cleanup) => cleanup())
    }
  }, [enabled, gl, onSelectSegment, placement, scene, targetRef])

  useFrame(() => {
    if (!enabled) {
      return
    }

    const grab = activeGrabRef.current
    const target = targetRef.current
    if (!grab || !target) {
      return
    }

    const { position, quaternion } = getControllerTransform(grab.controller)
    target.position.copy(position).add(grab.offset)
    const controllerDelta = quaternion.multiply(grab.inverseStartControllerQuaternion)
    target.quaternion.copy(controllerDelta.multiply(grab.startModelQuaternion))
  })

  return null
}

interface AnatomyViewerProps {
  model: AnatomyModel
  visibleSegments: Record<string, boolean>
  crossSection: number
  volumeSlice: number
  showAnnotations: boolean
  resetSignal: number
  showDebugHelpers?: boolean
  rotation?: { x: number; y: number; z: number }
  onScreenshot?: (dataUrl: string) => void
  onError?: (message: string) => void
  onSegmentsChanged?: (segments: AnatomySegment[]) => void
  onVolumeSliceChange?: (value: number) => void
}

export function AnatomyViewer({
  model,
  visibleSegments,
  crossSection,
  volumeSlice,
  showAnnotations,
  resetSignal,
  showDebugHelpers = false,
  rotation = { x: 0, y: 0, z: 0 },
  onScreenshot,
  onError,
  onSegmentsChanged,
  onVolumeSliceChange,
}: AnatomyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const spatialRootRef = useRef<Group | null>(null)
  const assetState = useAnatomyAsset(model)
  const volumeState = useVolumeAsset(model)
  const ctContainerRef = useRef<HTMLDivElement | null>(null)
  const ctSliceRef = useRef<VolumeSlice | null>(null)
  const xrSessionRef = useRef<XRSession | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [xrCapabilities, setXrCapabilities] = useState<XRCapabilities>({
    checked: false,
    hasWebXR: false,
    immersiveAR: false,
    immersiveVR: false,
  })
  const [xrSessionActive, setXrSessionActive] = useState(false)
  const [xrSessionMode, setXrSessionMode] = useState<ImmersiveXRMode>('immersive-vr')
  const [spatialSelection, setSpatialSelection] = useState<string | null>(null)
  const [debugCoords, setDebugCoords] = useState({
    position: [0, 0, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  })
  const [volumeAxis, setVolumeAxis] = useState<'x' | 'y' | 'z'>(model.volume?.axis ?? 'z')
  const [volumeInfo, setVolumeInfo] = useState({ index: 0, total: 0 })
  const sliceStep = useMemo(
    () => (volumeInfo.total > 1 ? 100 / (volumeInfo.total - 1) : 100),
    [volumeInfo.total],
  )
  const initialWindow = useMemo(
    () => ({
      low: model.volume?.window?.low ?? -1000,
      high: model.volume?.window?.high ?? 500,
    }),
    [model.volume?.window?.high, model.volume?.window?.low],
  )
  const [windowPreset, setWindowPreset] = useState<WindowPresetKey>('default')
  const [windowValues, setWindowValues] = useState(initialWindow)
  const appliedWindow = useMemo(() => {
    if (windowPreset === 'default') {
      return initialWindow
    }
    if (windowPreset === 'custom') {
      return windowValues
    }
    const preset = WINDOW_PRESET_MAP[windowPreset]
    return { low: preset.low, high: preset.high }
  }, [initialWindow, windowPreset, windowValues])
  const presetButtons = useMemo<WindowPresetKey[]>(
    () => ['default', 'soft-tissue', 'lung', 'bone', 'custom'],
    [],
  )
  const pathname = usePathname()
  const prevSegmentsRef = useRef<AnatomySegment[] | null>(null)

  useEffect(() => {
    setVolumeAxis(model.volume?.axis ?? 'z')
    setVolumeInfo({ index: 0, total: 0 })
    ctSliceRef.current = null
  }, [model.id, model.volume?.axis])

  useEffect(() => {
    setWindowPreset('default')
    setWindowValues(initialWindow)
  }, [initialWindow])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) {
      setXrCapabilities({
        checked: true,
        hasWebXR: false,
        immersiveAR: false,
        immersiveVR: false,
      })
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
        if (!xrSystem) {
          if (!cancelled) {
            setXrCapabilities({
              checked: true,
              hasWebXR: false,
              immersiveAR: false,
              immersiveVR: false,
            })
          }
          return
        }

        if (!xrSystem.isSessionSupported) {
          if (!cancelled) {
            setXrCapabilities({
              checked: true,
              hasWebXR: true,
              immersiveAR: false,
              immersiveVR: false,
            })
          }
          return
        }

        const [arSupported, vrSupported] = await Promise.all([
          xrSystem.isSessionSupported('immersive-ar').catch(() => false),
          xrSystem.isSessionSupported('immersive-vr').catch(() => false),
        ])
        if (cancelled) return
        setXrCapabilities({
          checked: true,
          hasWebXR: true,
          immersiveAR: arSupported,
          immersiveVR: vrSupported,
        })
        setXrSessionMode(arSupported ? 'immersive-ar' : 'immersive-vr')
      } catch (error) {
        console.warn('WebXR session support check failed', error)
        if (!cancelled) {
          setXrCapabilities({
            checked: true,
            hasWebXR: false,
            immersiveAR: false,
            immersiveVR: false,
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleWindowPresetChange = useCallback(
    (key: WindowPresetKey) => {
      setWindowPreset(key)
      if (key === 'custom') {
        return
      }
      if (key === 'default') {
        setWindowValues(initialWindow)
        return
      }
      const preset = WINDOW_PRESET_MAP[key]
      setWindowValues({ low: preset.low, high: preset.high })
    },
    [initialWindow],
  )

  const handleCustomWindowChange = useCallback((field: 'low' | 'high', value: number) => {
    if (!Number.isFinite(value)) {
      return
    }
    setWindowPreset('custom')
    setWindowValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleEnterXR = useCallback(
    async (mode: ImmersiveXRMode) => {
      if (typeof navigator === 'undefined' || !('xr' in navigator)) {
        return
      }
      if (!glRef.current) {
        return
      }

      try {
        const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
        if (!xrSystem?.requestSession) {
          return
        }

        glRef.current.xr.enabled = true
        glRef.current.xr.setReferenceSpaceType?.('local-floor')
        glRef.current.setClearAlpha(mode === 'immersive-ar' ? 0 : 1)

        const optionalFeatures: XRSessionInit['optionalFeatures'] = ['local-floor', 'hand-tracking']
        if (mode === 'immersive-ar') {
          optionalFeatures.push('hit-test')
        } else {
          optionalFeatures.push('bounded-floor')
        }

        const sessionInit: XRSessionInit = {
          optionalFeatures,
        }

        const session = await xrSystem.requestSession(mode, sessionInit)

        if (!session) {
          return
        }

        setXrSessionMode(mode)
        xrSessionRef.current = session
        session.addEventListener('end', () => {
          xrSessionRef.current = null
          setXrSessionActive(false)
          setSpatialSelection(null)
          glRef.current?.setClearAlpha(1)
        })

        await glRef.current.xr.setSession(session)
        setXrSessionActive(true)
        setSpatialSelection(
          mode === 'immersive-ar'
            ? 'Pinch/select a visible segment to move it in space.'
            : 'Select and hold a visible segment to move it. Squeeze to recenter.',
        )
      } catch (error) {
        console.error('Failed to start WebXR session', error)
        onError?.(
          'Unable to start immersive session. Please check browser settings and permissions.',
        )
        glRef.current?.setClearAlpha(1)
      }
    },
    [onError],
  )

  const handleExitXR = useCallback(async () => {
    try {
      if (xrSessionRef.current) {
        await xrSessionRef.current.end()
      }
    } catch (error) {
      console.warn('Failed to end XR session', error)
    } finally {
      xrSessionRef.current = null
      setXrSessionActive(false)
      setSpatialSelection(null)
      glRef.current?.setClearAlpha(1)
    }
  }, [])

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

  const spatialPlacement = useMemo(() => {
    if (!preparedScene) {
      return null
    }
    return computeSpatialPlacement(preparedScene.boundingBox)
  }, [preparedScene])

  useEffect(() => {
    const root = spatialRootRef.current
    if (!root) {
      return
    }

    if (xrSessionActive && spatialPlacement) {
      applySpatialPlacement(root, spatialPlacement)
      return
    }

    resetDesktopPlacement(root)
  }, [preparedScene, spatialPlacement, xrSessionActive])

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
          const shouldAutoFit =
            model.downloads.some((d) => d.format === 'glb') &&
            preparedScene.boundingBox &&
            model.defaultCamera?.autoFit !== false

          if (shouldAutoFit) {
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

  useEffect(() => {
    if (volumeState.status !== 'success' || !ctContainerRef.current) {
      if (ctContainerRef.current) {
        ctContainerRef.current.replaceChildren()
      }
      ctSliceRef.current = null
      return
    }

    const axis = volumeAxis
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
    const { volume, dimensions } = volumeState

    let windowLow = appliedWindow.low
    let windowHigh = appliedWindow.high
    if (!Number.isFinite(windowLow)) {
      windowLow = -1000
    }
    if (!Number.isFinite(windowHigh)) {
      windowHigh = 500
    }
    if (windowHigh <= windowLow) {
      const midpoint = (windowHigh + windowLow) / 2
      windowLow = midpoint - 1
      windowHigh = midpoint + 1
    }

    volume.windowLow = windowLow
    volume.windowHigh = windowHigh
    volume.lowerThreshold = Number.NEGATIVE_INFINITY
    volume.upperThreshold = Number.POSITIVE_INFINITY

    // Validate dimensions before proceeding
    if (!dimensions || dimensions.some((dim) => !dim || dim <= 0)) {
      console.warn('Invalid volume dimensions:', dimensions)
      return
    }

    const totalSlices = Math.max(1, Math.floor(dimensions[axisIndex] ?? 1))
    const targetIndex = Math.min(
      totalSlices - 1,
      Math.max(0, Math.round((volumeSlice / 100) * (totalSlices - 1))),
    )

    let slice = ctSliceRef.current
    if (!slice || slice.volume !== volume || slice.axis !== axis) {
      try {
        slice = volume.extractSlice(axis, targetIndex)

        // Validate the slice canvas before using it
        if (!slice.canvas || slice.canvas.width === 0 || slice.canvas.height === 0) {
          console.warn('Invalid slice canvas dimensions:', {
            width: slice.canvas?.width,
            height: slice.canvas?.height,
            axis,
            targetIndex,
            totalSlices,
          })
          return
        }

        slice.canvas.style.width = '100%'
        slice.canvas.style.height = '100%'
        slice.canvas.style.display = 'block'
        slice.canvas.style.maxWidth = '100%'
        slice.canvas.style.maxHeight = '100%'
        slice.canvas.style.background = '#000'
        slice.canvas.style.transformOrigin = 'center center'
        slice.canvas.style.transform = getSliceTransform(axis)
        ctContainerRef.current.replaceChildren(slice.canvas)
        ctSliceRef.current = slice
      } catch (error) {
        console.error('Error extracting volume slice:', error)
        return
      }
    } else if (slice.index !== targetIndex) {
      slice.index = targetIndex
    }

    if (isRenderableVolumeSlice(ctSliceRef.current)) {
      try {
        ctSliceRef.current.repaint()
        if (ctSliceRef.current.canvas) {
          ctSliceRef.current.canvas.style.transformOrigin = 'center center'
          ctSliceRef.current.canvas.style.transform = getSliceTransform(axis)
        }
      } catch (error) {
        console.error('Error repainting volume slice:', error)
      }
    }

    setVolumeInfo({ index: targetIndex, total: totalSlices })
  }, [volumeState, volumeSlice, volumeAxis, appliedWindow])

  useEffect(() => {
    const container = ctContainerRef.current
    return () => {
      if (container) {
        container.replaceChildren()
      }
      ctSliceRef.current = null
      if (xrSessionRef.current) {
        xrSessionRef.current.end().catch(() => {})
        xrSessionRef.current = null
      }
      setXrSessionActive(false)
    }
  }, [])

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

  const xrStatusMessage = useMemo(() => {
    if (!xrCapabilities.checked) {
      return 'Checking headset support...'
    }
    if (!xrCapabilities.hasWebXR) {
      return 'Open in a WebXR headset browser to enter spatial view.'
    }
    if (!xrCapabilities.immersiveAR && !xrCapabilities.immersiveVR) {
      return 'WebXR is present, but no immersive headset session is available here.'
    }
    return null
  }, [xrCapabilities])

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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)]">
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
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            glRef.current = gl
            gl.outputColorSpace = SRGBColorSpace
            gl.toneMappingExposure = 1.2
            gl.setClearColor('#0b172b', 1)
            gl.xr.enabled = true
            gl.domElement.addEventListener('webglcontextlost', (event) => {
              console.debug('WebGL context lost')
              event.preventDefault()
            })
            gl.domElement.addEventListener('webglcontextrestored', () => {
              console.debug('WebGL context restored')
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
          {xrSessionActive && xrSessionMode === 'immersive-vr' ? (
            <gridHelper args={[4, 8, '#38bdf8', '#1e293b']} position={[0, 0.02, -1.35]} />
          ) : null}
          {preparedScene ? (
            <Suspense
              fallback={
                <Html center className="text-xs text-muted-foreground">
                  Preparing anatomy…
                </Html>
              }
            >
              <group ref={spatialRootRef}>
                <primitive object={preparedScene.group} />
              </group>
              <XRSpatialControllers
                enabled={xrSessionActive}
                targetRef={spatialRootRef}
                placement={spatialPlacement}
                onSelectSegment={setSpatialSelection}
              />
            </Suspense>
          ) : null}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={!xrSessionActive}
            enablePan={!isMobile}
            minDistance={minDistance}
            maxDistance={maxDistance}
            target={cameraTarget}
            autoRotate={false}
            enableDamping={false}
          />
        </Canvas>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto inline-flex max-w-[58%] flex-wrap items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
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
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
              {xrSessionActive ? (
                <button
                  type="button"
                  onClick={handleExitXR}
                  className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
                >
                  Exit spatial view
                </button>
              ) : null}
              {!xrSessionActive && xrCapabilities.immersiveVR ? (
                <button
                  type="button"
                  onClick={() => handleEnterXR('immersive-vr')}
                  className="rounded-full bg-primary/85 px-3 py-1 text-xs font-medium text-primary-foreground transition hover:bg-primary"
                >
                  Enter VR
                </button>
              ) : null}
              {!xrSessionActive && xrCapabilities.immersiveAR ? (
                <button
                  type="button"
                  onClick={() => handleEnterXR('immersive-ar')}
                  className="rounded-full bg-cyan-500/85 px-3 py-1 text-xs font-medium text-white transition hover:bg-cyan-500"
                >
                  Enter AR
                </button>
              ) : null}
              {xrStatusMessage ? (
                <span className="max-w-40 text-right text-[11px] text-muted-foreground">
                  {xrStatusMessage}
                </span>
              ) : null}
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
          {xrSessionActive && spatialSelection ? (
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-cyan-400/30 bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
              <span className="font-semibold text-foreground">Spatial mode: </span>
              {spatialSelection}
            </div>
          ) : null}
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

      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full">
          <div
            ref={ctContainerRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-3xl border border-border/60 bg-black/80"
          />
          {volumeState.status === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/80">
              <span className="text-sm text-muted-foreground">Loading CT volume…</span>
            </div>
          ) : null}
          {volumeState.status === 'error' ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/80 p-4 text-center">
              <span className="text-xs text-muted-foreground">
                Unable to load CT volume: {volumeState.error}
              </span>
            </div>
          ) : null}
          {volumeState.status === 'idle' ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/80 p-4 text-center">
              <span className="text-xs text-muted-foreground">
                CT volume not available for this model.
              </span>
            </div>
          ) : null}
        </div>
        {volumeState.status === 'success' ? (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {AXIS_LABELS[volumeAxis]} CT slice
              </span>
              <span>
                Slice {volumeInfo.total > 0 ? volumeInfo.index + 1 : 0}/{volumeInfo.total}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={Math.max(sliceStep, 0.01)}
              value={volumeSlice}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && onVolumeSliceChange) {
                  onVolumeSliceChange(value)
                }
              }}
              className="w-full accent-primary"
              aria-label="CT slice position"
              disabled={!onVolumeSliceChange}
            />
            <div className="flex flex-wrap gap-1 text-xs">
              {presetButtons.map((key) => {
                const isActive = windowPreset === key
                const label =
                  key === 'default'
                    ? `Default (${initialWindow.low.toFixed(0)}/${initialWindow.high.toFixed(0)})`
                    : key === 'custom'
                      ? 'Custom'
                      : WINDOW_PRESET_MAP[key].label
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleWindowPresetChange(key)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {windowPreset === 'custom' ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <label className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.3em]">Low (HU)</span>
                  <input
                    type="number"
                    value={windowValues.low}
                    step={25}
                    onChange={(event) =>
                      handleCustomWindowChange('low', Number(event.target.value))
                    }
                    className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="uppercase tracking-[0.3em]">High (HU)</span>
                  <input
                    type="number"
                    value={windowValues.high}
                    step={25}
                    onChange={(event) =>
                      handleCustomWindowChange('high', Number(event.target.value))
                    }
                    className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs text-foreground"
                  />
                </label>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              Window: {appliedWindow.low.toFixed(0)} / {appliedWindow.high.toFixed(0)} HU
            </div>
            <div className="inline-flex gap-1 rounded-full border border-border/60 bg-background/80 p-1 text-xs">
              {(['z', 'y', 'x'] as Array<'x' | 'y' | 'z'>).map((axis) => (
                <button
                  key={axis}
                  type="button"
                  onClick={() => setVolumeAxis(axis)}
                  className={`rounded-full px-3 py-1 font-medium transition ${
                    volumeAxis === axis
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {AXIS_LABELS[axis]}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
