'use client'
import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { AnimatedGantryGlb } from '@/components/fluoroview/CarmInsetView'
import { createSamplingModel, createShield, createStaff, disposeModel } from '../lib/models'
import { ANATOMY_MODEL } from '../lib/anatomy'
import { LESION_CENTER, beamDirection, toolTipForDepth, type Point3 } from '../lib/physics'
import styles from '../imaging.module.css'
interface SceneProps {
  orbit?: number
  tilt?: number
  depth?: number
  kind?: 'fixed' | 'mobile'
  staffDistance?: number
  shield?: boolean
  safety?: boolean
  compact?: boolean
  centerTarget?: boolean
  offsetX?: number
  offsetDepth?: number
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className={styles.sceneFallback}>
        The 3D view is unavailable. Use the CT projection, controls and text results for this
        activity.
      </div>
    ) : (
      this.props.children
    )
  }
}
function Viewpoint({ view, safety, suite }: { view: number; safety: boolean; suite: boolean }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const positions = [
      [250, 500, 170],
      [0, 620, 0.01],
      [680, 0, 0],
      [0, 0, 680],
    ]
    const p = positions[view % positions.length]
    const factor = safety ? 4.5 : suite ? 1.3 : 1
    camera.up.set(
      0,
      suite || safety || view % 4 === 3 ? 1 : 0,
      suite || safety || view % 4 === 3 ? 0 : 1,
    )
    camera.position.set(p[0] * factor, p[1] * factor, p[2] * factor)
    camera.lookAt(safety ? 650 : 0, 0, 0)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, view, safety, suite])
  return null
}
function Anatomy({ visible }: { visible: string[] }) {
  const invalidate = useThree((state) => state.invalidate)
  const gltf = useGLTF(ANATOMY_MODEL, '/fluoroview/draco/')
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => m.clone())
          : object.material.clone()
        const mats = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of mats) {
          if (material instanceof THREE.MeshStandardMaterial) {
            const name = object.name.replaceAll('_', ' ')
            if (name === 'Airways') material.color.set('#d7ded4')
            if (name === 'Lungs') {
              material.color.set('#7babad')
              material.opacity = 0.12
            }
            if (name === 'Ribs and spine') {
              material.color.set('#d0c5af')
              material.opacity = 0.22
            }
            material.roughness = 0.75
          }
          material.depthWrite = !material.transparent
          material.needsUpdate = true
        }
      }
    })
    return clone
  }, [gltf.scene])
  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh)
        object.visible = visible.includes(object.name.replaceAll('_', ' '))
    })
    invalidate()
  }, [scene, visible, invalidate])
  useEffect(
    () => () =>
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh)
          for (const m of Array.isArray(object.material) ? object.material : [object.material])
            m.dispose()
      }),
    [scene],
  )
  return <primitive object={scene} scale={1000} dispose={null} />
}
function Objects({ props, layers }: { props: SceneProps; layers: string[] }) {
  const tip = toolTipForDepth(props.depth ?? 22)
  const arrow = useMemo(() => {
    const n = new THREE.Vector3(...beamDirection(props.orbit ?? 0, props.tilt ?? 0))
    return new THREE.ArrowHelper(
      n,
      new THREE.Vector3(...LESION_CENTER).addScaledVector(n, -170),
      210,
      '#8fbdcf',
      17,
      7,
    )
  }, [props.orbit, props.tilt])
  const staff = useMemo(() => createStaff(props.staffDistance ?? 1.6), [props.staffDistance])
  const shield = useMemo(() => createShield(), [])
  useEffect(() => () => disposeModel(staff), [staff])
  useEffect(() => () => disposeModel(shield), [shield])
  useEffect(
    () => () => {
      arrow.line.geometry.dispose()
      arrow.cone.geometry.dispose()
    },
    [arrow],
  )
  const offset: Point3 = props.centerTarget
    ? [
        -LESION_CENTER[0] + (props.offsetX ?? 0),
        -LESION_CENTER[1] + (props.offsetDepth ?? 0),
        -LESION_CENTER[2],
      ]
    : [0, 0, 0]
  return (
    <>
      <group position={offset}>
        <Anatomy visible={layers} />
        <mesh position={LESION_CENTER}>
          <sphereGeometry args={[9, 32, 24]} />
          <meshStandardMaterial color="#e4b068" roughness={0.6} transparent opacity={0.9} />
        </mesh>
        <mesh position={[tip[0] - 32.5, tip[1], tip[2]]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.95, 0.95, 65, 20]} />
          <meshStandardMaterial color="#e6edf0" metalness={0.72} roughness={0.28} />
        </mesh>
        <Html position={[LESION_CENTER[0] + 15, LESION_CENTER[1], LESION_CENTER[2]]}>
          <span className={styles.modelLabel}>Authored target</span>
        </Html>
        {!props.compact && !props.safety && <primitive object={arrow} />}
      </group>
      {props.safety && (
        <group position={[0, 650, 0]} scale={10}>
          <primitive object={staff} />
          {props.shield && <primitive object={shield} />}
          <Html position={[(props.staffDistance ?? 1.6) * 100, 40, 0]} center>
            <span className={styles.modelLabel}>Staff</span>
          </Html>
        </group>
      )}
    </>
  )
}
export default function Scene3D(props: SceneProps) {
  const [view, setView] = useState(0)
  const [suite, setSuite] = useState(false)
  const [layers, setLayers] = useState(['Airways', 'Lungs'])
  return (
    <div className={styles.sceneWrap}>
      <div className={styles.sceneHeading}>
        <span>{suite ? 'Original FluoroView C-arm' : 'CT-derived anatomy · 3D Slicer'}</span>
        {!props.safety && (
          <div className={styles.buttonRow}>
            <button type="button" aria-pressed={!suite} onClick={() => setSuite(false)}>
              Anatomy
            </button>
            <button type="button" aria-pressed={suite} onClick={() => setSuite(true)}>
              C-arm motion
            </button>
          </div>
        )}
      </div>
      <div
        className={props.compact ? styles.sceneCompact : styles.scene}
        role="img"
        aria-label={
          suite
            ? 'Original FluoroView C-arm animation, a generic motion reference.'
            : 'CT-derived thorax, segmented airways, lungs and skeleton with an authored teaching target and instrument.'
        }
      >
        <SceneBoundary>
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [460, 350, 460], fov: 43, near: 1, far: 12000 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.setClearColor('#101c25')
              gl.domElement.dataset.threeState = 'ready'
            }}
            fallback={
              <div className={styles.sceneFallback}>
                Use the linked image and text results without WebGL.
              </div>
            }
          >
            <ambientLight intensity={0.65} />
            <directionalLight position={[200, 500, 400]} intensity={1.6} />
            <directionalLight position={[-400, 100, -200]} intensity={0.65} color="#bacddc" />
            <Suspense
              fallback={
                <Html center>
                  <span className={styles.modelLabel}>Preparing the 3D asset…</span>
                </Html>
              }
            >
              {suite ? (
                <AnimatedGantryGlb
                  glbUri="/peripheral-imaging/anatomy/fluoroview-carm.glb"
                  raoLao={props.orbit ?? 0}
                  cranialCaudal={props.tilt ?? 0}
                  dracoBaseUrl="/fluoroview/draco/"
                />
              ) : (
                <Objects props={props} layers={layers} />
              )}
            </Suspense>
            <Viewpoint view={view} safety={Boolean(props.safety)} suite={suite} />
            <OrbitControls
              key={view + ':' + suite + ':' + props.safety}
              target={[props.safety ? 650 : 0, 0, 0]}
              enablePan={false}
              enableDamping={false}
              minDistance={280}
              maxDistance={props.safety ? 7000 : 1700}
            />
          </Canvas>
        </SceneBoundary>
      </div>
      {!suite && (
        <div className={styles.anatomyLayers} aria-label="Anatomy layers">
          {['Airways', 'Lungs', 'Ribs and spine', 'Thoracic envelope'].map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={layers.includes(name)}
              onClick={() =>
                setLayers((current) =>
                  current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
                )
              }
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.sceneToolbar}>
        <span>
          {suite
            ? 'Single-axis motion reference · not a clearance test'
            : 'Drag to inspect · scroll to zoom'}
        </span>
        <div aria-label="3D camera views" className={styles.buttonRow}>
          {['Perspective', 'Anterior', 'Side', 'Head'].map((label, i) => (
            <button
              type="button"
              key={label}
              aria-pressed={view % 4 === i}
              onClick={() => setView(i + (Math.floor(view / 4) + 1) * 4)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SamplingObjects({ tip }: { tip: [number, number, number] }) {
  const [x, y, z] = tip
  const model = useMemo(() => createSamplingModel([x, y, z]), [x, y, z])
  useEffect(() => () => disposeModel(model), [model])
  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[40, 60, 50]} intensity={2.4} />
      <primitive object={model} />
      <Html position={[0, -11, 0]} center>
        <span className={styles.modelLabel}>Target sphere</span>
      </Html>
      <Html position={[x - 10, y + 3, z]} center>
        <span className={styles.modelLabel}>Sampling window</span>
      </Html>
      <Html position={[x + 3, y, z]}>
        <span className={styles.modelLabel}>Tip</span>
      </Html>
    </>
  )
}
export function SamplingScene3D({ tip }: { tip: [number, number, number] }) {
  const [view, setView] = useState(0)
  const positions: [number, number, number][] = [
    [33, 28, 36],
    [0, 58, 0.01],
    [58, 0, 0.01],
    [0, 0, 58],
  ]
  return (
    <div className={styles.sceneWrap}>
      <div
        className={styles.sceneCompact}
        role="img"
        aria-label="3D teaching sphere and fictional needle. The thick sampling-window segment is distinct from the tip. Linked slices below provide the same geometry."
      >
        <SceneBoundary>
          <Canvas
            key={view}
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: positions[view % 4], fov: 36, near: 0.1, far: 500 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            onCreated={({ gl }) => {
              gl.setClearColor('#102936')
              gl.domElement.dataset.threeState = 'ready'
            }}
            fallback={
              <div className={styles.sceneFallback}>
                Use the linked analytic slices and text explanation below.
              </div>
            }
          >
            <SamplingObjects tip={tip} />
            <OrbitControls
              target={[0, 0, 0]}
              enablePan={false}
              enableDamping={false}
              minDistance={35}
              maxDistance={160}
            />
          </Canvas>
        </SceneBoundary>
      </div>
      <div className={styles.sceneToolbar}>
        <span>Same authored geometry as the linked slices</span>
        <div className={styles.buttonRow} aria-label="Sampling model views">
          {['Perspective', 'Anterior', 'Side', 'Head'].map((label, i) => (
            <button
              key={label}
              type="button"
              aria-pressed={view % 4 === i}
              onClick={() => setView(i + (Math.floor(view / 4) + 1) * 4)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
