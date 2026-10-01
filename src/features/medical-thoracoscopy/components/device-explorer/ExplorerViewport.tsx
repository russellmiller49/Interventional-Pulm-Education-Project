'use client'

import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { explorerDevice } from '../../content/deviceExplorerCatalogue'
import type { AssemblyGeometry } from '../../engine/deviceExplorer/assembly'
import { AssemblyView } from './AssemblyView'
import {
  applyKey,
  blendKeys,
  fitClipping,
  FRONT_VIEW,
  keyFromCamera,
  type WorldCameraKey,
} from './explorerCamera'
import { ASSEMBLY, type ExplorerState } from './explorerState'
import {
  createSceneLink,
  type ExplorerAssetSource,
  type HotspotTarget,
  type SceneLink,
} from './sceneLink'
import type { SequenceClock } from './sequenceClock'
import { motionSeconds, useReducedMotion } from './reducedMotion'
import { SingleDeviceView } from './SingleDeviceView'
import { createStudioEnvironment } from './studioEnvironment'
import styles from './device-explorer.module.css'

/** Seconds for the camera to fly to a new view. */
const FLIGHT_SECONDS = 0.9

export interface ExplorerViewportProps {
  readonly source: ExplorerAssetSource
  readonly geometry: AssemblyGeometry
  readonly clock: SequenceClock
  readonly state: ExplorerState
  readonly onSelectHotspot: (key: string) => void
  /** The viewer took the camera: orbit, pan or zoom. */
  readonly onUserCamera: () => void
}

function installStudioEnvironment(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
  const previous = scene.environment
  const studio = createStudioEnvironment()
  const pmrem = new THREE.PMREMGenerator(gl)
  const environment = pmrem.fromScene(studio.scene, 0.02)
  scene.environment = environment.texture
  scene.environmentIntensity = 1
  studio.dispose()
  pmrem.dispose()
  return () => {
    scene.environment = previous
    environment.dispose()
  }
}

/** Studio light without a remote environment map: a built studio and three lamps. */
function Studio() {
  const { gl, scene, invalidate } = useThree()
  // A render target must be recreated on effect re-setup (including React Strict Mode).
  useLayoutEffect(() => {
    const cleanup = installStudioEnvironment(scene, gl)
    invalidate()
    return cleanup
  }, [gl, scene, invalidate])
  return (
    <>
      <hemisphereLight args={['#f4f6fa', '#80868f', 0.7]} />
      <directionalLight position={[-420, 620, 520]} intensity={2.2} />
      <directionalLight position={[480, 160, 380]} intensity={0.8} color="#dfe9f5" />
      <directionalLight position={[120, 260, -620]} intensity={1.4} />
    </>
  )
}

/** Where a hotspot is best seen from: facing it, from behind it, or from the side. */
const ANCHOR_VIEW: Record<string, 1 | -1> = {
  distalFace: 1,
  opticalOrigin: 1,
  channelExit: 1,
  channelEntry: -1,
  eyepiece: 1,
  lightPost: 1,
  stopcock: 1,
  toolTip: 1,
  jawHinge: 1,
  tip: 1,
  distalEnd: 1,
  proximalEnd: 1,
}

function hotspotKey(target: HotspotTarget): WorldCameraKey {
  target.object.updateWorldMatrix(true, false)
  const position = new THREE.Vector3().setFromMatrixPosition(target.object.matrixWorld)
  const sense = target.spec.anchor ? ANCHOR_VIEW[target.spec.anchor] : undefined
  const direction = FRONT_VIEW.clone()
  if (sense) {
    const facing = new THREE.Vector3(0, 0, 1).transformDirection(target.object.matrixWorld)
    direction
      .multiplyScalar(0.8)
      .addScaledVector(facing, 0.75 * sense)
      .normalize()
  }
  return { target: position, direction, radius: target.spec.focusRadiusMm }
}

/**
 * Moves the camera: flies to a model, a hotspot or the sequence's view when asked, follows the
 * sequence while the viewer has not taken the camera, and otherwise leaves it to the controls.
 */
function CameraDirector({
  link,
  state,
  controls,
}: {
  link: SceneLink
  state: ExplorerState
  controls: React.RefObject<OrbitControlsImpl | null>
}) {
  const camera = useThree((three) => three.camera) as THREE.PerspectiveCamera
  const invalidate = useThree((three) => three.invalidate)
  const flight = useRef<null | {
    from: WorldCameraKey
    to: () => WorldCameraKey | null
    t: number
  }>(null)
  const choices = useRef(state)
  const reduced = useReducedMotion()
  const still = useRef(reduced)
  useLayoutEffect(() => {
    choices.current = state
    still.current = reduced
  }, [reduced, state])
  const target = useRef(new THREE.Vector3())

  // A new request: a model chosen, a hotspot, a reset, or following switched back on.
  useEffect(() => {
    const orbit = controls.current
    const from = keyFromCamera(camera, orbit?.target ?? target.current)
    const hotspot = state.hotspot
    let to: () => WorldCameraKey | null
    if (hotspot) {
      to = () => {
        const found = link.targets().find((candidate) => candidate.key === hotspot)
        return found ? hotspotKey(found) : null
      }
    } else if (state.selection === ASSEMBLY && state.follow) {
      to = () => link.followKey()
    } else {
      to = () => link.frame()
    }
    flight.current = { from, to, t: 0 }
    invalidate()
    // Only a request moves the camera; state changes that are not requests leave it alone.
  }, [state.cameraSerial]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, rawDelta) => {
    const orbit = controls.current
    const delta = Math.min(rawDelta, 1 / 20)
    const current = flight.current
    let key: WorldCameraKey | null = null
    if (current) {
      // A goal that is not there yet (a model still loading) waits; the view asks for a frame
      // when it arrives.
      const goal = current.to()
      if (goal) {
        current.t = Math.min(1, current.t + delta / motionSeconds(FLIGHT_SECONDS, still.current))
        key = blendKeys(current.from, goal, current.t)
        if (current.t >= 1) flight.current = null
        invalidate()
      }
    } else if (
      choices.current.selection === ASSEMBLY &&
      choices.current.follow &&
      !choices.current.hotspot
    ) {
      key = link.followKey()
    }
    if (key && orbit) {
      applyKey(camera, orbit.target, key)
    } else if (orbit) {
      fitClipping(camera, camera.position.distanceTo(orbit.target))
    }
  }, -2)

  // The viewer took the camera: stop flying.
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const stop = () => {
      flight.current = null
    }
    orbit.addEventListener('start', stop)
    return () => orbit.removeEventListener('start', stop)
  }, [controls])

  return null
}

/**
 * Development only: `window.__deviceExplorer`, to read what the scene shows and count the frames it
 * draws, and to draw frames by hand when the page is hidden (a hidden tab gets no animation frames).
 */
function DevProbe({ link }: { link: SceneLink }) {
  const { gl, camera, scene, advance, invalidate } = useThree()
  const renders = useRef(0)
  useFrame(() => {
    renders.current += 1
  }, -4)
  useEffect(() => {
    const target = window as unknown as { __deviceExplorer?: unknown }
    target.__deviceExplorer = {
      renders: () => renders.current,
      status: () => link.status(),
      reports: () => Object.fromEntries(link.reports()),
      hotspots: () => link.targets().map((spot) => spot.key),
      /** Each device root in the scene: shown or not, where, and its materials' opacity. */
      roots: () => {
        const found: Record<string, unknown>[] = []
        scene.traverse((object) => {
          if (!object.name.startsWith('device')) return
          const box = new THREE.Box3().setFromObject(object)
          const opacities = new Set<number>()
          object.traverse((child) => {
            const mesh = child as THREE.Mesh
            if (mesh.isMesh) opacities.add((mesh.material as THREE.Material).opacity)
          })
          let shown = object.visible
          for (let parent = object.parent; parent; parent = parent.parent) shown &&= parent.visible
          found.push({
            name: object.name,
            shown,
            min: box.min.toArray().map(Math.round),
            max: box.max.toArray().map(Math.round),
            opacities: [...opacities],
          })
        })
        return found
      },
      /** Where each showing hotspot lands in the viewport, in CSS pixels. */
      screen: () => {
        const { width, height } = gl.domElement.getBoundingClientRect()
        return link.targets().map((spot) => {
          const point = spot.object.getWorldPosition(new THREE.Vector3()).project(camera)
          return {
            key: spot.key,
            x: Math.round(((point.x + 1) / 2) * width),
            y: Math.round(((1 - point.y) / 2) * height),
            inside: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z < 1,
          }
        })
      },
      camera: () => ({
        position: camera.position.toArray(),
        near: (camera as THREE.PerspectiveCamera).near,
        far: (camera as THREE.PerspectiveCamera).far,
      }),
      renderer: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        pixelRatio: gl.getPixelRatio(),
      }),
      /** Draw `count` frames now, stepping the clock by `seconds` each. */
      frames: (count = 1, seconds = 1 / 60) => {
        const start = performance.now()
        for (let index = 0; index < count; index += 1)
          advance((start + (index + 1) * seconds * 1000) / 1000)
        return renders.current
      },
      invalidate: () => invalidate(),
    }
    return () => {
      delete target.__deviceExplorer
    }
  }, [advance, camera, gl, invalidate, link, scene])
  return null
}

class ExplorerBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null })
  }
  render() {
    if (this.state.error) {
      return (
        <div className={styles.viewportMessage} role="alert">
          <strong>This model could not be shown.</strong>
          <span>{this.state.error.message}</span>
        </div>
      )
    }
    return this.props.children
  }
}

function Loading() {
  return (
    <Html center>
      <span className={styles.loading}>Loading the model…</span>
    </Html>
  )
}

export default function ExplorerViewport({
  source,
  geometry,
  clock,
  state,
  onSelectHotspot,
  onUserCamera,
}: ExplorerViewportProps) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const link = useMemo<SceneLink>(() => createSceneLink(), [])
  const development = process.env.NODE_ENV === 'development'
  const assembly = state.selection === ASSEMBLY

  return (
    <div className={styles.canvasHolder}>
      <ExplorerBoundary resetKey={state.selection}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ fov: 30, near: 0.5, far: 6000, position: [60, 180, 900] }}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: development }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping
            gl.toneMappingExposure = 1
            gl.setClearColor(0x000000, 0)
            gl.domElement.dataset.explorerCanvas = 'ready'
          }}
          fallback={
            <div className={styles.viewportMessage}>
              This view needs WebGL. The controls and details beside it still work.
            </div>
          }
        >
          <Studio />
          <Suspense fallback={<Loading />}>
            {assembly ? (
              <AssemblyView
                source={source}
                geometry={geometry}
                clock={clock}
                link={link}
                exploded={state.exploded}
                cutaway={state.cutaway}
                jaw={state.jaw}
                labels={state.labels}
                hotspot={state.hotspot}
                onSelectHotspot={onSelectHotspot}
              />
            ) : (
              <SingleDeviceView
                key={state.selection}
                device={explorerDevice(state.selection)}
                source={source}
                link={link}
                jaw={state.jaw}
                labels={state.labels}
                hotspot={state.hotspot}
                onSelectHotspot={onSelectHotspot}
              />
            )}
          </Suspense>
          <OrbitControls
            ref={controls}
            makeDefault
            enableDamping
            dampingFactor={0.14}
            zoomToCursor
            minDistance={2}
            maxDistance={6000}
            onStart={onUserCamera}
          />
          <CameraDirector link={link} state={state} controls={controls} />
          {development && <DevProbe link={link} />}
        </Canvas>
      </ExplorerBoundary>
    </div>
  )
}
