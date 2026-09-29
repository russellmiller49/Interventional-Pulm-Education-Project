'use client'

import { OrthographicCamera, PerspectiveCamera, View } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  Box3,
  CylinderGeometry,
  DoubleSide,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type OrthographicCamera as ThreeOrthographicCamera,
  type PointLight,
  type PerspectiveCamera as ThreePerspectiveCamera,
  type WebGLRendererParameters,
} from 'three'

import { anatomyManifest } from '../../../content/data/generated/anatomy'
import { pleuralZone, type PleuralZoneId } from '../../../content/pleuralZones'
import { scopeGeometry } from '../../../engine/space/fulcrum'
import type { LoadedSpace } from '../../../engine/space/loadSpace'
import type { Vec3 } from '../../../engine/space/vec'
import styles from '../space-pane.module.css'
import { READINESS_WORDS, SCENE_WORDS, VIEW_WORDS } from '../spaceWords'
import { spaceControlId, type SeenState, type SpacePaneState } from '../types'
import { loadAnatomyAssets, type AnatomyAssets } from './anatomyAssets'

/**
 * The space pane's 3D views (plan, section 4.6): one canvas, fixed to the viewport and clipped to the
 * pane, drawing a Chest view and a Scope view through drei's `View`, the pattern of the bronchoscopy
 * scope scene. Frames are drawn on demand: on every committed state, on scroll and on resize.
 *
 * Everything is drawn in the scan's millimetres (LPS). The Chest view looks from the patient's front
 * with the head to the right (owner decisions, T7), its axes the rows of the manifest's
 * `presentationFromLps`. The Scope view's camera is the engine's optical frame, never the other way
 * round: its origin, its forward and its up come from `scopeGeometry`, and its round field is the
 * device's. The drawn meshes are for the eye; the engine answers every spatial question from its
 * proxies.
 *
 * A failure to create the renderer, to load the anatomy or to draw is reported to the pane, which
 * shows the Chest view as a cut instead; a lost context remounts the canvas and loads again.
 */
export type SceneStatus = 'loading' | 'ready' | 'failed'

export interface SpaceSceneViewsProps {
  readonly state: SpacePaneState
  readonly space: LoadedSpace
  readonly onStatus: (status: SceneStatus) => void
}

const CHEST_BACKGROUND = '#0b1622'
const SCOPE_BACKGROUND = '#050303'
const SEEN_COLOURS: Readonly<Record<SeenState, string>> = {
  seen: '#4f9d8a',
  'partly-seen': '#d9a441',
  'not-seen': '#8b95a1',
}
const [RIGHT, UP, TOWARD_VIEWER] = anatomyManifest.presentationFromLps.map(
  (row) => new Vector3(...row),
)

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFailure()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function WebGLContextGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (event: Event) => {
      event.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

/** A frame on every committed state, on scroll and on resize; "ready" once something is drawn. */
function RenderLifecycle({ state, onDraw }: { state: SpacePaneState; onDraw: () => void }) {
  const { invalidate, gl } = useThree()
  const drawn = useRef(false)
  useEffect(() => {
    invalidate(4)
  }, [state, invalidate])
  useEffect(() => {
    const update = () => invalidate(4)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [invalidate])
  // Before the views draw, clear the whole canvas: it is fixed to the viewport, so a region a view
  // has scrolled away from would otherwise keep its last pixels.
  useFrame(() => {
    gl.setScissorTest(false)
    gl.setClearColor(0x000000, 0)
    gl.clear(true, true, true)
  }, 0)
  useFrame(() => {
    if (!drawn.current && gl.info.render.calls > 0) {
      drawn.current = true
      queueMicrotask(onDraw)
    }
  }, 4)
  return null
}

function Drawn({
  geometry,
  matrix,
  material,
}: {
  geometry: BufferGeometry
  matrix: Matrix4
  material: Material
}) {
  return <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false} material={material} />
}

/** A capsule of the instrument, drawn as a unit cylinder stretched along its segment. */
function Segment({
  start,
  end,
  radius,
  material,
}: {
  start: Vec3
  end: Vec3
  radius: number
  material: Material
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...start)
    const b = new Vector3(...end)
    const along = b.clone().sub(a)
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        along.clone().normalize(),
      ),
      length: along.length(),
    }
  }, [start, end])
  const geometry = useMemo(() => new CylinderGeometry(radius, radius, 1, 24), [radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={quaternion}
      scale={[1, Math.max(length, 1e-3), 1]}
      material={material}
    />
  )
}

function useMaterials() {
  const materials = useMemo(() => {
    const tint = (colour: string) =>
      new MeshStandardMaterial({
        color: colour,
        transparent: true,
        opacity: 0.32,
        side: DoubleSide,
        depthWrite: false,
      })
    return {
      zones: {
        seen: tint(SEEN_COLOURS.seen),
        'partly-seen': tint(SEEN_COLOURS['partly-seen']),
        'not-seen': tint(SEEN_COLOURS['not-seen']),
      } as Record<SeenState, MeshStandardMaterial>,
      bone: new MeshStandardMaterial({
        color: '#d8d2c4',
        roughness: 0.8,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
      context: new MeshStandardMaterial({
        color: '#9a6b6b',
        roughness: 0.7,
        transparent: true,
        opacity: 0.55,
      }),
      lung: new MeshStandardMaterial({ color: '#c98e8e', roughness: 0.55 }),
      instrument: new MeshStandardMaterial({ color: '#dfe6ee', metalness: 0.6, roughness: 0.3 }),
      sleeve: new MeshStandardMaterial({
        color: '#f2f2ee',
        roughness: 0.5,
        transparent: true,
        opacity: 0.8,
      }),
      pleura: new MeshStandardMaterial({ color: '#ecc9bf', roughness: 0.45, side: DoubleSide }),
      lungInside: new MeshStandardMaterial({ color: '#b97f86', roughness: 0.5 }),
    }
  }, [])
  useEffect(
    () => () => {
      for (const material of [
        ...Object.values(materials.zones),
        ...Object.values(materials).filter((m) => m instanceof MeshStandardMaterial),
      ]) {
        ;(material as MeshStandardMaterial).dispose()
      }
    },
    [materials],
  )
  return materials
}

/** The scope camera the development probe reports; set by the Scope view as it moves its camera. */
const probedScopeCamera: { current: ThreePerspectiveCamera | null } = { current: null }

function ChestView({
  assets,
  state,
  space,
}: {
  assets: AnatomyAssets
  state: SpacePaneState
  space: LoadedSpace
}) {
  const materials = useMaterials()
  const size = useThree((three) => three.size)
  const camera = useRef<ThreeOrthographicCamera>(null)
  const frame = useMemo(() => {
    const box = new Box3()
    for (const zone of assets.zones) {
      zone.geometry.computeBoundingBox()
      if (zone.geometry.boundingBox)
        box.union(zone.geometry.boundingBox.clone().applyMatrix4(zone.matrix))
    }
    const centre = box.getCenter(new Vector3())
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new Vector3(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        ),
    )
    const across = Math.max(...corners.map((c) => Math.abs(c.clone().sub(centre).dot(RIGHT)))) * 2
    const tall = Math.max(...corners.map((c) => Math.abs(c.clone().sub(centre).dot(UP)))) * 2
    return { centre, across: across * 1.45, tall: tall * 1.45 }
  }, [assets])
  const zoom = Math.min(size.width / frame.across, size.height / frame.tall)
  useLayoutEffect(() => {
    const c = camera.current
    if (!c) return
    c.position.copy(frame.centre.clone().add(TOWARD_VIEWER.clone().multiplyScalar(600)))
    c.up.copy(UP)
    c.lookAt(frame.centre)
    c.zoom = zoom
    c.near = 1
    c.far = 1400
    c.updateProjectionMatrix()
  }, [frame, zoom])
  const geometry = scopeGeometry(state.pose, space.port, space.device)
  const seenOf = (zone: PleuralZoneId): SeenState =>
    state.ledger.find((entry) => entry.zone === zone)?.seen ?? 'not-seen'
  const fieldCone = useMemo(() => {
    const length = 45
    const half = (space.device.fieldOfViewDeg / 2) * (Math.PI / 180)
    return { length, radius: Math.tan(half) * length }
  }, [space.device.fieldOfViewDeg])
  const cone = useMemo(() => {
    const origin = new Vector3(...geometry.camera.origin)
    const forward = new Vector3(...geometry.camera.forward)
    return {
      position: origin.clone().add(forward.clone().multiplyScalar(fieldCone.length / 2)),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), forward),
    }
  }, [geometry.camera.origin, geometry.camera.forward, fieldCone.length])
  return (
    <>
      <color attach="background" args={[CHEST_BACKGROUND]} />
      <OrthographicCamera makeDefault ref={camera} />
      <hemisphereLight args={['#f4f1ea', '#34404c', 1.1]} />
      <directionalLight
        position={TOWARD_VIEWER.clone().add(UP).multiplyScalar(500).toArray()}
        intensity={1.4}
      />
      {assets.context
        // the skin, cut square by the scan's field, would box the view in
        .filter((mesh) => !mesh.name.endsWith('skin'))
        .map((mesh) => (
          <Drawn
            key={mesh.name}
            geometry={mesh.geometry}
            matrix={mesh.matrix}
            material={materials.context}
          />
        ))}
      {assets.ribs
        .filter((mesh) => mesh.name.startsWith('rib:right'))
        .map((mesh) => (
          <Drawn
            key={mesh.name}
            geometry={mesh.geometry}
            matrix={mesh.matrix}
            material={materials.bone}
          />
        ))}
      {assets.lung.map((lobe) => (
        <Drawn
          key={lobe.name}
          geometry={lobe.steps[state.lungStep]}
          matrix={lobe.matrix}
          material={materials.lung}
        />
      ))}
      {assets.zones.map((zone) => (
        <Drawn
          key={zone.zone}
          geometry={zone.geometry}
          matrix={zone.matrix}
          material={materials.zones[seenOf(zone.zone)]}
        />
      ))}
      <Segment
        start={geometry.sleeve.start}
        end={geometry.sleeve.end}
        radius={geometry.sleeve.radius}
        material={materials.sleeve}
      />
      {geometry.shaft ? (
        <Segment
          start={geometry.shaft.start}
          end={geometry.shaft.end}
          radius={geometry.shaft.radius}
          material={materials.instrument}
        />
      ) : null}
      <mesh position={cone.position} quaternion={cone.quaternion}>
        <coneGeometry args={[fieldCone.radius, fieldCone.length, 32, 1, true]} />
        <meshBasicMaterial
          color="#f4e7a1"
          transparent
          opacity={0.22}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function ScopeView({
  assets,
  state,
  space,
}: {
  assets: AnatomyAssets
  state: SpacePaneState
  space: LoadedSpace
}) {
  const materials = useMaterials()
  const camera = useRef<ThreePerspectiveCamera>(null)
  const light = useRef<PointLight>(null)
  const { camera: frame } = scopeGeometry(state.pose, space.port, space.device)
  useLayoutEffect(() => {
    const c = camera.current
    if (!c) return
    c.position.set(...frame.origin)
    c.up.set(...frame.up)
    c.lookAt(
      frame.origin[0] + frame.forward[0],
      frame.origin[1] + frame.forward[1],
      frame.origin[2] + frame.forward[2],
    )
    c.fov = space.device.fieldOfViewDeg
    c.aspect = 1
    c.near = 0.5
    c.far = 600
    c.updateProjectionMatrix()
    c.updateMatrixWorld()
    light.current?.position.set(...frame.origin)
    probedScopeCamera.current = c
  }, [frame, space.device.fieldOfViewDeg])
  return (
    <>
      <color attach="background" args={[SCOPE_BACKGROUND]} />
      <PerspectiveCamera makeDefault ref={camera} />
      <ambientLight intensity={0.25} />
      <pointLight ref={light} intensity={2.4} decay={0.6} distance={0} />
      {assets.zones.map((zone) => (
        <Drawn
          key={zone.zone}
          geometry={zone.geometry}
          matrix={zone.matrix}
          material={materials.pleura}
        />
      ))}
      {assets.lung.map((lobe) => (
        <Drawn
          key={lobe.name}
          geometry={lobe.steps[state.lungStep]}
          matrix={lobe.matrix}
          material={materials.lungInside}
        />
      ))}
    </>
  )
}

/** Development only: what the real canvas drew, and where its scope camera is, for the browser checks. */
function DevelopmentProbe({
  chest,
  scope,
}: {
  chest: RefObject<HTMLDivElement | null>
  scope: RefObject<HTMLDivElement | null>
}) {
  const { gl } = useThree()
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const read = (element: HTMLDivElement | null, round: boolean, background: string) => {
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const ratio = gl.getPixelRatio()
      const context = gl.getContext()
      const width = Math.max(1, Math.floor(rect.width * ratio))
      const height = Math.max(1, Math.floor(rect.height * ratio))
      const x = Math.floor(rect.left * ratio)
      const y = context.drawingBufferHeight - Math.floor(rect.bottom * ratio)
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(x, y, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      const bg = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16))
      let counted = 0
      let tissue = 0
      for (let j = 0; j < height; j += 2) {
        for (let i = 0; i < width; i += 2) {
          if (
            round &&
            (i - width / 2) ** 2 + (j - height / 2) ** 2 > (Math.min(width, height) / 2) ** 2
          )
            continue
          counted += 1
          const k = (j * width + i) * 4
          if (
            Math.abs(pixels[k] - bg[0]) +
              Math.abs(pixels[k + 1] - bg[1]) +
              Math.abs(pixels[k + 2] - bg[2]) >
            36
          )
            tissue += 1
        }
      }
      return { drawnShare: counted ? tissue / counted : 0, width, height }
    }
    const hook = {
      probe: () => ({
        chest: read(chest.current, false, CHEST_BACKGROUND),
        scope: read(scope.current, true, SCOPE_BACKGROUND),
      }),
      scopeCamera: () => {
        const c = probedScopeCamera.current
        if (!c) return null
        c.updateMatrixWorld()
        const direction = c.getWorldDirection(new Vector3())
        const up = new Vector3(0, 1, 0).applyQuaternion(c.getWorldQuaternion(new Quaternion()))
        return {
          position: c.getWorldPosition(new Vector3()).toArray(),
          direction: direction.toArray(),
          up: up.toArray(),
        }
      },
    }
    ;(window as unknown as { __thoracoscopySpace?: typeof hook }).__thoracoscopySpace = hook
    return () => {
      delete (window as unknown as { __thoracoscopySpace?: typeof hook }).__thoracoscopySpace
    }
  }, [gl, chest, scope])
  return null
}

export default function SpaceSceneViews({ state, space, onStatus }: SpaceSceneViewsProps) {
  const [assets, setAssets] = useState<AnatomyAssets | null>(null)
  const [status, setStatus] = useState<SceneStatus>('loading')
  const [generation, setGeneration] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const chest = useRef<HTMLDivElement>(null)
  const scope = useRef<HTMLDivElement>(null)
  const report = useCallback(
    (value: SceneStatus) => {
      setStatus(value)
      onStatus(value)
    },
    [onStatus],
  )
  const failed = useCallback(() => report('failed'), [report])
  const drawn = useCallback(() => report('ready'), [report])
  const recover = useCallback(() => {
    report('loading')
    setGeneration((value) => value + 1)
  }, [report])
  const createRenderer = useCallback(
    async (options: WebGLRendererParameters) => {
      try {
        return new WebGLRenderer({
          ...options,
          antialias: true,
          // transparent, so that between the views the pane shows through
          alpha: true,
          powerPreference: 'low-power',
          // the browser checks read the drawn pixels back; production has no such reader
          preserveDrawingBuffer: process.env.NODE_ENV !== 'production',
        })
      } catch {
        // Fiber creates the renderer outside React's error boundary: report the failure, and leave
        // this canvas's configuration waiting until it is taken down.
        queueMicrotask(failed)
        return new Promise<WebGLRenderer>(() => {})
      }
    },
    [failed],
  )
  useEffect(() => {
    let cancelled = false
    loadAnatomyAssets()
      .then((next) => {
        if (!cancelled) setAssets(next)
      })
      .catch(() => {
        if (!cancelled) failed()
      })
    return () => {
      cancelled = true
    }
  }, [generation, failed])

  return (
    <div className={styles.sceneViews} ref={root} data-three-state={status}>
      {assets && status !== 'failed' ? (
        <SceneBoundary key={generation} onFailure={failed}>
          <Canvas
            // View's scissor is set in viewport coordinates, so the canvas is fixed to the viewport
            // and the pane clips it.
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
            }}
            eventSource={root as RefObject<HTMLDivElement>}
            frameloop={status === 'loading' ? 'always' : 'demand'}
            dpr={[1, 1.5]}
            gl={createRenderer}
            className={styles.sceneCanvas}
          >
            <View.Port />
            <WebGLContextGuard onLost={recover} />
            <RenderLifecycle state={state} onDraw={drawn} />
            <DevelopmentProbe chest={chest} scope={scope} />
          </Canvas>
        </SceneBoundary>
      ) : null}
      <figure className={styles.chestView} aria-labelledby={spaceControlId('chest-heading')}>
        <h3 id={spaceControlId('chest-heading')} className={styles.viewHeading}>
          {SCENE_WORDS.chestHeading}
        </h3>
        <div ref={chest} className={styles.sceneViewport} data-view="chest">
          {assets ? (
            <View className={styles.sceneViewportInner} index={1}>
              <ChestView assets={assets} state={state} space={space} />
            </View>
          ) : (
            <p className={styles.viewWaiting}>{READINESS_WORDS.loading}</p>
          )}
        </div>
        <figcaption className={styles.viewNote}>{SCENE_WORDS.chestNote}</figcaption>
      </figure>
      <section className={styles.scopeView} aria-labelledby={spaceControlId('scope-heading')}>
        <h3 id={spaceControlId('scope-heading')} className={styles.viewHeading}>
          {SCENE_WORDS.scopeHeading}
        </h3>
        <div
          ref={scope}
          className={`${styles.sceneViewport} ${styles.scopeViewport}`}
          data-view="scope"
        >
          {assets ? (
            <View className={styles.sceneViewportInner} index={2}>
              <ScopeView assets={assets} state={state} space={space} />
            </View>
          ) : null}
          <div className={styles.lens} aria-hidden="true" />
        </div>
        <p className={styles.inView} data-in-view={state.inView.join(' ')}>
          {state.inView.length === 0
            ? VIEW_WORDS.nothingInView
            : `${VIEW_WORDS.inView}: ${state.inView.map((zone) => pleuralZone(zone).name).join(', ')}.`}
        </p>
        <p className={styles.viewNote}>{SCENE_WORDS.scopeNote}</p>
      </section>
    </div>
  )
}
