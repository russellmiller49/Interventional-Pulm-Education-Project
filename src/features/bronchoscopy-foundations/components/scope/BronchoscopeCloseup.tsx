'use client'

import { useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import head from '../../../../../public/bronchoscopy-foundations/anatomy/devices/control-head.json'
import { MODEL_DEFLECTION_LIMIT_DEG } from '../../engine/scope/scopeInputs'
import type { ScopeState } from './types'
import type { ScopeSceneAssets } from './scopeSceneAssets'
import { bendingSectionSample, BENDING_SECTION_LENGTH } from './benchPresentation'

function installStudioEnvironment(scene: THREE.Scene, gl: THREE.WebGLRenderer) {
  const previous = scene.environment
  const room = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(gl)
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.75
  room.dispose()
  pmrem.dispose()
  return () => {
    scene.environment = previous
    environment.dispose()
  }
}

/** Self-contained studio illumination; no remote environment map or additional dependency. */
function Studio({
  width,
  height,
  centerY = 0,
}: {
  width: number
  height: number
  centerY?: number
}) {
  const { gl, scene, camera, invalidate } = useThree()
  // A render target must be recreated on effect re-setup (including React Strict Mode).
  useLayoutEffect(() => {
    const cleanup = installStudioEnvironment(scene, gl)
    invalidate()
    return cleanup
  }, [gl, scene, invalidate])
  useFrame(() => {
    const c = camera as THREE.PerspectiveCamera
    // View's portal size can still be zero after a hidden compact pane is revealed.
    // Its scissor renderer updates the camera aspect from the live DOM rectangle each draw.
    const aspect = Number.isFinite(c.aspect) && c.aspect > 0 ? c.aspect : 1
    const span = Math.max(height, width / aspect)
    const distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(c.fov / 2)))
    c.position.set(distance * 0.16, centerY + distance * 0.055, distance)
    c.lookAt(0, centerY, 0)
    c.updateMatrixWorld()
  })
  return (
    <>
      <color attach="background" args={['#dce5e7']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-90, 100, 120]} intensity={3.2} />
      <directionalLight position={[90, 0, 80]} intensity={1.1} color="#cde4f5" />
      <directionalLight position={[30, 50, -80]} intensity={2.8} />
    </>
  )
}

/** Printed U/D markings on the faceplate, attached to the rotating control head. */
function DirectionMarkings() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 560
    const context = canvas.getContext('2d')!
    context.strokeStyle = '#e8e8df'
    context.lineWidth = 6
    context.lineCap = 'round'
    context.beginPath()
    context.ellipse(230, 280, 195, 220, 0, 2.08, 4.2)
    context.stroke()
    context.font = 'bold 43px Arial'
    context.fillStyle = '#e8e8df'
    context.fillText('D', 140, 71)
    context.fillText('U', 139, 530)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[-7, 29, 22]}>
      <planeGeometry args={[42, 56]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

export function ControlHeadCloseup({
  assets,
  state,
  suctionTravel,
}: {
  assets: ScopeSceneAssets
  state: ScopeState
  suctionTravel: number
}) {
  const source = assets.models.get('devices/control-head.glb')!.scene
  const assemblies = useMemo(() => {
    const body = new THREE.Group(),
      lever = new THREE.Group(),
      suction = new THREE.Group()
    source.children.forEach((node) => {
      const group = node.name.startsWith('LEVER_')
        ? lever
        : node.name.startsWith('SUCTION_')
          ? suction
          : body
      group.add(node.clone(true))
    })
    return { body, lever, suction }
  }, [source])
  const bend =
    (state.inputs.deflectionDeg / MODEL_DEFLECTION_LIMIT_DEG) *
    THREE.MathUtils.degToRad(head.leverTravelDeg)
  // Turn about the insertion-tube axis. The lever rotates with the body, not in screen space.
  const rotation = THREE.MathUtils.degToRad(-state.inputs.rotationDeg)
  const suctionPosition = head.suctionPivot.map(
    (value, axis) => value - head.suctionAxis[axis] * head.suctionTravel * suctionTravel,
  ) as [number, number, number]
  return (
    <>
      <Studio width={105} height={190} centerY={12} />
      <group position={[0, 7 - state.depthMm * 0.3, 0]} rotation={[0, rotation - 0.12, -0.06]}>
        <primitive object={assemblies.body} dispose={null} />
        <DirectionMarkings />
        <group position={head.leverPivot as [number, number, number]} rotation={[0, 0, bend]}>
          <primitive object={assemblies.lever} dispose={null} />
        </group>
        <group position={suctionPosition}>
          <primitive object={assemblies.suction} dispose={null} />
        </group>
      </group>
    </>
  )
}

class BendingCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    readonly rotation: number,
    readonly bend: number,
  ) {
    super()
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    return target.set(...bendingSectionSample(this.rotation, this.bend, t).position)
  }
}

export function DistalTipCloseup({ state }: { state: ScopeState }) {
  const { rotationDeg, deflectionDeg } = state.inputs
  const curve = useMemo(
    () => new BendingCurve(rotationDeg, deflectionDeg),
    [rotationDeg, deflectionDeg],
  )
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 1.9, 24, false), [curve])
  useEffect(() => () => geometry.dispose(), [geometry])
  const end = bendingSectionSample(rotationDeg, deflectionDeg, 1)
  const quaternion = (t: number) => {
    const frame = bendingSectionSample(rotationDeg, deflectionDeg, t).frame
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...frame.right).negate(),
        new THREE.Vector3(...frame.up),
        new THREE.Vector3(...frame.forward),
      ),
    )
  }
  return (
    <>
      <Studio width={128} height={82} />
      {/* Two enlarged ends of one instrument. The middle insertion tube is omitted. */}
      <group rotation={[0, Math.PI / 2, 0]} position={[-26 + state.depthMm * 0.8, -2, 0]}>
        <mesh position={[0, 0, -19]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.9, 1.9, 38, 32]} />
          <meshStandardMaterial color="#171b1e" roughness={0.29} />
        </mesh>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#171b1e" roughness={0.38} />
        </mesh>
        {Array.from({ length: 17 }, (_, index) => {
          const t = index / 17
          return (
            <mesh key={index} position={curve.getPoint(t)} quaternion={quaternion(t)}>
              <torusGeometry args={[1.9, 0.075, 6, 32]} />
              <meshStandardMaterial color="#292d30" roughness={0.48} />
            </mesh>
          )
        })}
        <group position={end.position} quaternion={quaternion(1)}>
          <mesh position={[0, 0, 1.7]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.95, 1.95, 3.4, 40]} />
            <meshStandardMaterial color="#41484e" roughness={0.24} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0, 3.43]}>
            <circleGeometry args={[1.82, 40]} />
            <meshStandardMaterial color="#0a0d10" roughness={0.33} />
          </mesh>
          <mesh position={[-0.65, 0.62, 3.48]}>
            <circleGeometry args={[0.62, 32]} />
            <meshPhysicalMaterial color="#1a4159" metalness={0.4} roughness={0.12} clearcoat={1} />
          </mesh>
          <mesh position={[0.57, -0.57, 3.49]}>
            <ringGeometry args={[0.55, 0.73, 32]} />
            <meshStandardMaterial color="#687178" metalness={0.65} roughness={0.28} />
          </mesh>
          {[
            [-1, -0.7],
            [0.8, 0.85],
          ].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 3.5]}>
              <circleGeometry args={[0.33, 24]} />
              <meshStandardMaterial color="#e2e1c8" emissive="#f9edc6" emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>
        {/* Shallow shaft markings make actual forward/back travel visible. */}
        {[8, 20, 32].map((distance) => (
          <mesh key={distance} position={[0, 0, -distance]}>
            <torusGeometry args={[1.92, 0.12, 6, 32]} />
            <meshStandardMaterial color="#a9afb0" roughness={0.7} />
          </mesh>
        ))}
      </group>
      <mesh position={[-26, -17, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, BENDING_SECTION_LENGTH * 2, 8]} />
        <meshBasicMaterial color="#9caaaf" />
      </mesh>
    </>
  )
}
