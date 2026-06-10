'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useFBO } from '@react-three/drei'
import * as THREE from 'three'
import { XR } from '@react-three/xr'

import { createAnatomyXRStore } from '@/components/3d/xr/xrStore'
import { resolveModuleAssetPath } from '@/lib/module-assets'
import { ctIndexToLps, lpsToCtIndex, normalize, subtract } from '@/lib/airway-anatomy/geometry'
import { buildScopePathLps, computeViewBasis } from '@/lib/airway-anatomy/scope-state'
import {
  createBronchoscopyMaterial,
  loadAirwayStlGeometry,
  paintCtSliceGrayscale,
} from '@/lib/airway-anatomy/airway-render'
import type {
  AirwayAnatomyCaseManifest,
  AirwayGraph,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'

// LPS millimetres -> metres of headset world space. The airway tree is ~360 mm tall; we shrink it
// to ~0.36 m so it sits comfortably at arm's length, then place it front-and-centre at eye level
// (matching the anatomy XR viewer's "world-fixed model" placement convention).
const TARGET_RADIUS_M = 0.2
const WORLD_POSITION: Vec3 = [0, 1.35, -0.85]
const FBO_WIDTH = 1024
const FBO_HEIGHT = 768
const BRONCH_FOV_DEG = 88
const STEER_STEP_DEG = 3

export interface AirwayXRSceneProps {
  manifest: AirwayAnatomyCaseManifest
  graph: AirwayGraph
  pose: ScopePoseSnapshot
  ctVolume: Int16Array
  windowLow: number
  windowHigh: number
  ctPlaneOpacity: number
  stepMm: number
  onMove: (deltaMm: number) => void
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
}

interface GraphBounds {
  center: Vec3
  radius: number
}

function boundsForGraph(graph: AirwayGraph): GraphBounds {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const node of graph.nodes) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], node.lps[axis])
      max[axis] = Math.max(max[axis], node.lps[axis])
    }
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const radius = Math.max(120, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.5)
  return { center, radius }
}

export function AirwayXRScene(props: AirwayXRSceneProps) {
  const xrStore = useMemo(() => createAnatomyXRStore(), [])
  const [xrSupported, setXrSupported] = useState(false)
  const [xrActive, setXrActive] = useState(false)
  const [xrError, setXrError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const xrSystem = (navigator as Navigator & { xr?: XRSystem }).xr
    if (!xrSystem?.isSessionSupported) {
      return
    }
    xrSystem
      .isSessionSupported('immersive-vr')
      .then((supported) => {
        if (!cancelled) setXrSupported(supported)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // The XR store owns the session; mirror presence into local state for the enter/exit button.
  useEffect(() => {
    const sync = (session: XRSession | undefined) => setXrActive(Boolean(session))
    sync(xrStore.getState().session)
    return xrStore.subscribe((state) => sync(state.session))
  }, [xrStore])

  const handleEnter = useCallback(() => {
    setXrError(null)
    void xrStore.enterVR().catch(() => {
      setXrError(
        'Could not start the VR session. Open this page in a Quest 3 or Vision Pro browser.',
      )
    })
  }, [xrStore])

  const handleExit = useCallback(() => {
    void xrStore.getState().session?.end()
  }, [xrStore])

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Spatial (VR) correlation
          </div>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-400">
            Drive the scope with the controllers and watch the tip travel through the 3D airway with
            the CT slice tracking alongside the live bronchoscopy panel. Desktop preview: drag to
            orbit; put on a Quest 3 / Vision Pro and press Enter VR for the immersive view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {xrActive ? (
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex min-h-9 items-center rounded-full border border-emerald-300/40 bg-emerald-400/20 px-3 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-400/30"
            >
              Exit VR
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnter}
              disabled={!xrSupported}
              className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-300/15 px-3 text-xs font-semibold text-cyan-50 transition enabled:hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {xrSupported ? 'Enter VR' : 'VR not available on this device'}
            </button>
          )}
        </div>
      </div>
      {xrError ? <p className="mb-2 text-xs text-amber-300">{xrError}</p> : null}
      <div className="relative h-[clamp(420px,52vh,640px)] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0.55, 1.55, 0.95], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.xr.enabled = true
          }}
        >
          <XR store={xrStore}>
            <color attach="background" args={[0x05080f]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 4, 2]} intensity={1.1} />
            <directionalLight position={[-2, 1, -3]} intensity={0.4} color={0x9bb8ff} />
            <Suspense fallback={null}>
              <AirwayXRWorld {...props} />
            </Suspense>
            <DesktopOrbit />
          </XR>
        </Canvas>
        {!xrActive ? (
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
            Desktop preview
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** OrbitControls only on desktop; disabled while an immersive session owns the camera. */
function DesktopOrbit() {
  const gl = useThree((state) => state.gl)
  const [presenting, setPresenting] = useState(false)
  useFrame(() => {
    if (gl.xr.isPresenting !== presenting) setPresenting(gl.xr.isPresenting)
  })
  return (
    <OrbitControls
      makeDefault
      enabled={!presenting}
      target={[0, 1.35, -0.85]}
      enablePan={false}
      minDistance={0.4}
      maxDistance={4}
    />
  )
}

function AirwayXRWorld({
  manifest,
  graph,
  pose,
  ctVolume,
  windowLow,
  windowHigh,
  ctPlaneOpacity,
  stepMm,
  onMove,
  onSteer,
  onRecenter,
}: AirwayXRSceneProps) {
  const worldRef = useRef<THREE.Group>(null)
  const bounds = useMemo(() => boundsForGraph(graph), [graph])
  const worldScale = TARGET_RADIUS_M / bounds.radius
  const stlUrl = manifest.assets.airwayStl
    ? resolveModuleAssetPath(manifest.assets.airwayStl)
    : null

  return (
    <>
      <GrabbableGroup groupRef={worldRef} position={WORLD_POSITION}>
        {/* mm -> m, then recentre the tree on the graph centroid so it sits at WORLD_POSITION. */}
        <group scale={worldScale}>
          <group position={[-bounds.center[0], -bounds.center[1], -bounds.center[2]]}>
            <AirwayShell stlUrl={stlUrl} />
            <CtTipPlane
              ct={manifest.ct}
              volume={ctVolume}
              pose={pose}
              windowLow={windowLow}
              windowHigh={windowHigh}
              opacity={ctPlaneOpacity}
            />
            <ScopeProbe graph={graph} pose={pose} />
          </group>
        </group>
      </GrabbableGroup>

      {/* Sibling of the grabbable model — the panel keeps its own world position so grabbing the
          airway never drags the bronchoscopy feed with it. */}
      <EndoluminalPanel
        stlUrl={stlUrl}
        pose={pose}
        stepMm={stepMm}
        onMove={onMove}
        onSteer={onSteer}
        onRecenter={onRecenter}
      />
    </>
  )
}

/** Translucent airway lumen so the scope and CT plane are visible inside it. */
function AirwayShell({ stlUrl }: { stlUrl: string | null }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  useEffect(() => {
    if (!stlUrl) return
    let cancelled = false
    loadAirwayStlGeometry(stlUrl)
      .then((next) => {
        if (!cancelled) setGeometry(next)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [stlUrl])

  if (!geometry) return null
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#7dd3fc"
        roughness={0.55}
        metalness={0.02}
        side={THREE.DoubleSide}
        transparent
        opacity={0.2}
        depthWrite={false}
      />
    </mesh>
  )
}

/** Axial CT slice plane that follows the scope tip's Z, rebuilt only when the slice index changes. */
function CtTipPlane({
  ct,
  volume,
  pose,
  windowLow,
  windowHigh,
  opacity,
}: {
  ct: AirwayAnatomyCaseManifest['ct']
  volume: Int16Array
  pose: ScopePoseSnapshot
  windowLow: number
  windowHigh: number
  opacity: number
}) {
  const sliceIndex = Math.round(lpsToCtIndex(pose.tipLps, ct)[2])
  const texture = useMemo(() => {
    if (opacity <= 0.01) return null
    const canvas = document.createElement('canvas')
    const painted = paintCtSliceGrayscale({
      canvas,
      ct,
      volume,
      axis: 'axial',
      sliceIndex,
      windowLow,
      windowHigh,
    })
    if (!painted) return null
    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    return next
  }, [ct, volume, sliceIndex, windowLow, windowHigh, opacity])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture || opacity <= 0.01) return null
  const center = ctIndexToLps([(ct.sizeXyz[0] - 1) / 2, (ct.sizeXyz[1] - 1) / 2, sliceIndex], ct)
  const width = (ct.sizeXyz[0] - 1) * ct.spacingXyzMm[0]
  const height = (ct.sizeXyz[1] - 1) * ct.spacingXyzMm[1]
  return (
    <mesh position={center} scale={[1, -1, 1]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Bronchoscope shaft (root -> tip) + glowing tip + headlight, authored in LPS. */
function ScopeProbe({ graph, pose }: { graph: AirwayGraph; pose: ScopePoseSnapshot }) {
  const pathLps = useMemo(
    () => buildScopePathLps(graph, pose.edgeId, pose.distanceMm),
    [graph, pose.edgeId, pose.distanceMm],
  )

  const tubeGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    let last: Vec3 | null = null
    for (const point of pathLps) {
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2]) >= 2) {
        points.push(new THREE.Vector3(...point))
        last = point
      }
    }
    const tail = pathLps[pathLps.length - 1]
    if (tail && last && last !== tail) points.push(new THREE.Vector3(...tail))
    if (points.length < 2) return null
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
    const segments = Math.min(400, Math.max(24, Math.round(curve.getLength() / 1.5)))
    return new THREE.TubeGeometry(curve, segments, 1.9, 12, false)
  }, [pathLps])

  useEffect(() => () => tubeGeometry?.dispose(), [tubeGeometry])

  if (!tubeGeometry) return null
  return (
    <group>
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color="#3f4754"
          roughness={0.35}
          metalness={0.35}
          emissive="#1e293b"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={pose.tipLps}>
        <sphereGeometry args={[2.1, 16, 16]} />
        <meshStandardMaterial color="#eff6ff" emissive="#bfdbfe" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={pose.tipLps} intensity={6} distance={40} decay={1.4} color="#cfe3ff" />
    </group>
  )
}

/**
 * The live virtual-bronchoscopy view, rendered to an off-screen target from a scope-POV camera and
 * shown on a billboarded, draggable in-scene panel — the headset has no DOM, so the endoluminal
 * view must itself be a textured mesh. The off-screen pass runs with `gl.xr.enabled` temporarily
 * off so it renders a normal mono frame, then the main XR frame proceeds untouched.
 */
function EndoluminalPanel({
  stlUrl,
  pose,
  stepMm,
  onMove,
  onSteer,
  onRecenter,
}: {
  stlUrl: string | null
  pose: ScopePoseSnapshot
  stepMm: number
  onMove: (deltaMm: number) => void
  onSteer: (dxUnit: number, dyUpUnit: number) => void
  onRecenter: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const placedRef = useRef(false)
  const facePos = useRef(new THREE.Vector3())
  const fbo = useFBO(FBO_WIDTH, FBO_HEIGHT)

  const scopeScene = useMemo(() => new THREE.Scene(), [])
  const scopeCamera = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(BRONCH_FOV_DEG, FBO_WIDTH / FBO_HEIGHT, 0.06, 900)
    return cam
  }, [])
  const bronchMaterial = useMemo(() => createBronchoscopyMaterial(), [])
  const [scopeGeometry, setScopeGeometry] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (!stlUrl) return
    let cancelled = false
    loadAirwayStlGeometry(stlUrl)
      .then((next) => {
        if (!cancelled) setScopeGeometry(next)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [stlUrl])

  useEffect(() => () => bronchMaterial.dispose(), [bronchMaterial])

  // Pose-driven scope camera + off-screen render. Runs before R3F's main render each frame.
  useFrame(({ gl: renderer }) => {
    const tip = pose.tipLps
    const base = normalize(subtract(pose.lookAtLps, pose.tipLps), pose.tangentLps)
    const { forward, up } = computeViewBasis(base, pose.yawDeg, pose.pitchDeg, 0)
    scopeCamera.position.set(tip[0], tip[1], tip[2])
    scopeCamera.up.set(up[0], up[1], up[2])
    scopeCamera.lookAt(tip[0] + forward[0], tip[1] + forward[1], tip[2] + forward[2])
    scopeCamera.rotateZ((pose.rollDeg * Math.PI) / 180)

    if (!scopeGeometry) return
    // Render the endoluminal view as a normal mono frame: disable XR for this off-screen pass so
    // three doesn't try to use the headset's stereo cameras, then restore it for the main render.
    const xrWasEnabled = renderer.xr.enabled
    renderer.xr.enabled = false
    renderer.setRenderTarget(fbo)
    renderer.render(scopeScene, scopeCamera)
    renderer.setRenderTarget(null)
    renderer.xr.enabled = xrWasEnabled
  })

  // Place the panel once to the user's front-right at eye level; afterwards it billboards to face
  // whichever camera is active (XR head or desktop orbit camera). Reads the camera from the frame
  // state rather than useThree so this component holds no context-subscription hooks.
  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    if (!placedRef.current) {
      group.position.set(0.55, 1.45, -0.5)
      placedRef.current = true
    }
    const out = facePos.current
    if (state.gl.xr.isPresenting) {
      out.setFromMatrixPosition(state.gl.xr.getCamera().matrixWorld)
    } else {
      state.camera.getWorldPosition(out)
    }
    group.rotation.set(0, Math.atan2(out.x - group.position.x, out.z - group.position.z), 0)
  })

  const dragRef = useRef<{ pointerId: number; distance: number; offset: THREE.Vector3 } | null>(
    null,
  )

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    const group = groupRef.current
    if (!group) return
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const distance = Number.isFinite(event.distance)
      ? event.distance
      : event.ray.origin.distanceTo(event.point)
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), distance)
    dragRef.current = {
      pointerId: event.pointerId,
      distance,
      offset: group.position.clone().sub(anchor),
    }
  }

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    const group = groupRef.current
    if (!drag || !group || event.pointerId !== drag.pointerId) return
    event.stopPropagation()
    const anchor = event.ray.origin
      .clone()
      .addScaledVector(event.ray.direction.clone().normalize(), drag.distance)
    group.position.copy(anchor).add(drag.offset)
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current || event.pointerId !== dragRef.current.pointerId) return
    dragRef.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  // Panel is 0.5 m wide; the endoluminal feed is 4:3.
  const panelWidth = 0.5
  const feedHeight = (panelWidth * FBO_HEIGHT) / FBO_WIDTH

  return (
    <group ref={groupRef} position={[0.55, 1.45, -0.5]}>
      {/* Off-screen scope scene: the airway lumen seen from the scope tip. */}
      {scopeGeometry
        ? createPortal(
            <>
              <ambientLight intensity={0.5} color={0xffc4a6} />
              <mesh geometry={scopeGeometry} material={bronchMaterial} />
            </>,
            scopeScene,
          )
        : null}

      {/* Backing + draggable header */}
      <mesh position={[0, 0, -0.004]}>
        <planeGeometry args={[panelWidth + 0.04, feedHeight + 0.14]} />
        <meshBasicMaterial color="#0f172a" toneMapped={false} />
      </mesh>
      <group
        position={[0, feedHeight / 2 + 0.04, 0.002]}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <mesh>
          <planeGeometry args={[panelWidth + 0.04, 0.06]} />
          <meshBasicMaterial color="#1e293b" toneMapped={false} />
        </mesh>
        <XrText
          text="Virtual bronchoscopy — drag to move"
          position={[0, 0, 0.002]}
          width={panelWidth}
          height={0.045}
          fontSize={34}
        />
      </group>

      {/* Live endoluminal feed */}
      <mesh position={[0, 0.02, 0]}>
        <planeGeometry args={[panelWidth, feedHeight]} />
        <meshBasicMaterial map={fbo.texture} toneMapped={false} />
      </mesh>

      {/* Drive controls */}
      <group position={[0, -feedHeight / 2 - 0.06, 0.002]}>
        <XrButton
          label="Withdraw"
          position={[-0.17, 0, 0]}
          size={[0.15, 0.06]}
          repeat
          onTrigger={() => onMove(-stepMm)}
        />
        <XrButton
          label="Advance"
          position={[0.17, 0, 0]}
          size={[0.15, 0.06]}
          primary
          repeat
          onTrigger={() => onMove(stepMm)}
        />
        <XrButton
          label="↑"
          position={[0, 0.07, 0]}
          size={[0.06, 0.05]}
          repeat
          onTrigger={() => onSteer(0, STEER_STEP_DEG)}
        />
        <XrButton
          label="↓"
          position={[0, -0.07, 0]}
          size={[0.06, 0.05]}
          repeat
          onTrigger={() => onSteer(0, -STEER_STEP_DEG)}
        />
        <XrButton
          label="←"
          position={[-0.08, 0.07, 0]}
          size={[0.06, 0.05]}
          repeat
          onTrigger={() => onSteer(-STEER_STEP_DEG, 0)}
        />
        <XrButton
          label="→"
          position={[0.08, 0.07, 0]}
          size={[0.06, 0.05]}
          repeat
          onTrigger={() => onSteer(STEER_STEP_DEG, 0)}
        />
        <XrButton
          label="Recenter view"
          position={[0, -0.15, 0]}
          size={[0.2, 0.05]}
          onTrigger={onRecenter}
        />
      </group>
    </group>
  )
}

/** Grabbable wrapper: translate + rotate the whole airway world by the controller ray. */
function GrabbableGroup({
  groupRef,
  position,
  children,
}: {
  groupRef: React.RefObject<THREE.Group | null>
  position: Vec3
  children: React.ReactNode
}) {
  const grabRef = useRef<{
    pointerId: number
    startDirection: THREE.Vector3
    distance: number
    anchorToModel: THREE.Vector3
    startQuaternion: THREE.Quaternion
  } | null>(null)

  const onDown = (event: ThreeEvent<PointerEvent>) => {
    const target = groupRef.current
    if (!target) return
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    const direction = event.ray.direction.clone().normalize()
    const distance = Number.isFinite(event.distance)
      ? event.distance
      : event.ray.origin.distanceTo(event.point)
    const anchor = event.ray.origin.clone().addScaledVector(direction, distance)
    grabRef.current = {
      pointerId: event.pointerId,
      startDirection: direction,
      distance,
      anchorToModel: target.position.clone().sub(anchor),
      startQuaternion: target.quaternion.clone(),
    }
  }

  const onMovePointer = (event: ThreeEvent<PointerEvent>) => {
    const grab = grabRef.current
    const target = groupRef.current
    if (!grab || !target || event.pointerId !== grab.pointerId) return
    event.stopPropagation()
    const direction = event.ray.direction.clone().normalize()
    const anchor = event.ray.origin.clone().addScaledVector(direction, grab.distance)
    const deltaQuaternion = new THREE.Quaternion().setFromUnitVectors(
      grab.startDirection,
      direction,
    )
    target.position.copy(anchor).add(grab.anchorToModel.clone().applyQuaternion(deltaQuaternion))
    target.quaternion.copy(deltaQuaternion).multiply(grab.startQuaternion)
  }

  const onUp = (event: ThreeEvent<PointerEvent>) => {
    if (!grabRef.current || event.pointerId !== grabRef.current.pointerId) return
    grabRef.current = null
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerDown={onDown}
      onPointerMove={onMovePointer}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </group>
  )
}

/** In-scene button (plane + label). `repeat` holds-to-repeat via pointer capture + an interval. */
function XrButton({
  label,
  position,
  size,
  primary = false,
  repeat = false,
  onTrigger,
}: {
  label: string
  position: [number, number, number]
  size: [number, number]
  primary?: boolean
  repeat?: boolean
  onTrigger: () => void
}) {
  const heldRef = useRef(false)
  const accumRef = useRef(0)
  const triggerRef = useRef(onTrigger)
  useEffect(() => {
    triggerRef.current = onTrigger
  })

  useFrame((_, delta) => {
    if (!repeat || !heldRef.current) return
    accumRef.current += delta
    while (accumRef.current >= 0.11) {
      accumRef.current -= 0.11
      triggerRef.current()
    }
  })

  const handleDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    ;(event.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      event.pointerId,
    )
    triggerRef.current()
    if (repeat) {
      heldRef.current = true
      accumRef.current = 0
    }
  }

  const handleUp = (event: ThreeEvent<PointerEvent>) => {
    heldRef.current = false
    ;(event.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      event.pointerId,
    )
  }

  const bg = primary ? '#0e7490' : '#1e293b'
  return (
    <group
      position={position}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial color={bg} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[size[0] + 0.006, size[1] + 0.006]} />
        <meshBasicMaterial
          color={primary ? '#67e8f9' : '#93c5fd'}
          opacity={0.35}
          transparent
          toneMapped={false}
        />
      </mesh>
      <XrText
        text={label}
        position={[0, 0, 0.008]}
        width={size[0] * 0.9}
        height={size[1] * 0.7}
        fontSize={48}
      />
    </group>
  )
}

/** Unlit canvas-texture text plane (toneMapped off keeps it bright against ACES tone mapping). */
function XrText({
  text,
  position,
  width,
  height,
  fontSize = 44,
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  fontSize?: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#f8fafc'
      context.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      context.lineWidth = Math.max(6, Math.round(fontSize * 0.16))
      context.strokeStyle = 'rgba(2, 6, 23, 0.9)'
      context.strokeText(text, canvas.width / 2, canvas.height / 2, canvas.width - 48)
      context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 48)
    }
    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    next.anisotropy = 8
    return next
  }, [text, fontSize])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
