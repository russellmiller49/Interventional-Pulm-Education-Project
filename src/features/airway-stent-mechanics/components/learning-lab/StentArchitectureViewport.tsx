'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'

import {
  buildScaffoldPaths,
  createRingPath,
  dynamicDPoint,
  getSiliconeYStentTopology,
  PARTIAL_COVER_LENGTH_FRACTION,
  STENT_LENGTH,
  STENT_RADIUS,
  type ScaffoldPath,
} from '../../engine/learningLabGeometry'
import {
  applyLoadAmplitude,
  getRepresentativeLoadProgress,
  getLoadFrame,
  resolveAnimationProgress,
  resolvePingPongProgress,
  type PingPongDirection,
} from '../../engine/learningLabMechanics'
import type {
  LoadFrame,
  StentArchitectureProfile,
  StentGeometryBuilderId,
  StentLoadMode,
} from '../../engine/learningLabTypes'
import { StentArchitectureFallback } from './StentArchitectureFallback'
import { applyLoadFrameToUniforms, useDeformableStentMaterial } from './useDeformableStentMaterial'

const TAU = Math.PI * 2

export interface StentArchitectureViewportProps {
  active: boolean
  amplitude: number
  mode: StentLoadMode
  onFrameChange?: (frame: LoadFrame) => void
  playing: boolean
  profile: StentArchitectureProfile
  reducedMotion: boolean
  resetVersion: number
  showAirway: boolean
  showCover: boolean
}

function PathMesh({ material, path }: { material: THREE.Material; path: ScaffoldPath }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(path.points, path.closed, 'centripetal', 0.5)
    const tubularSegments =
      path.role === 'single-wire'
        ? Math.max(240, Math.min(1400, path.points.length))
        : Math.max(18, Math.min(520, path.points.length * 2))
    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      path.radius,
      path.role === 'single-wire' ? 8 : 7,
      path.closed,
    )
  }, [path])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh castShadow geometry={geometry} material={material} />
}

function createStudGeometry() {
  const geometries: THREE.BufferGeometry[] = []
  const rows = 7
  const columns = 8
  for (let row = 0; row < rows; row += 1) {
    const y = -STENT_LENGTH * 0.42 + (row * (STENT_LENGTH * 0.84)) / (rows - 1)
    const offset = (row % 2) * (Math.PI / columns)
    for (let column = 0; column < columns; column += 1) {
      const theta = offset + (column / columns) * TAU
      const normal = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta))
      const geometry = new THREE.SphereGeometry(0.095, 9, 6, 0, TAU, 0, Math.PI * 0.58)
      geometry.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal),
      )
      geometry.translate(normal.x * STENT_RADIUS * 1.02, y, normal.z * STENT_RADIUS * 1.02)
      geometries.push(geometry)
    }
  }
  return geometries
}

function createDWallGeometry() {
  const radialSegments = 72
  const axialSegments = 22
  const outerRadius = STENT_RADIUS
  const innerRadius = STENT_RADIUS - 0.15
  const positions: number[] = []
  const indices: number[] = []
  const stride = (radialSegments + 1) * 2

  for (let axial = 0; axial <= axialSegments; axial += 1) {
    const y = -STENT_LENGTH * 0.5 + (axial / axialSegments) * STENT_LENGTH
    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * TAU
      const outer = dynamicDPoint(theta, y, outerRadius)
      const inner = dynamicDPoint(theta, y, innerRadius)
      positions.push(outer.x, outer.y, outer.z, inner.x, inner.y, inner.z)
    }
  }

  const outerIndex = (axial: number, radial: number) => axial * stride + radial * 2
  const innerIndex = (axial: number, radial: number) => outerIndex(axial, radial) + 1
  for (let axial = 0; axial < axialSegments; axial += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = outerIndex(axial, radial)
      const b = outerIndex(axial + 1, radial)
      const c = outerIndex(axial + 1, radial + 1)
      const d = outerIndex(axial, radial + 1)
      indices.push(a, b, d, b, c, d)

      const ia = innerIndex(axial, radial)
      const ib = innerIndex(axial + 1, radial)
      const ic = innerIndex(axial + 1, radial + 1)
      const id = innerIndex(axial, radial + 1)
      indices.push(ia, id, ib, ib, id, ic)
    }
  }
  for (const axial of [0, axialSegments]) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const outerA = outerIndex(axial, radial)
      const outerB = outerIndex(axial, radial + 1)
      const innerA = innerIndex(axial, radial)
      const innerB = innerIndex(axial, radial + 1)
      if (axial === 0) indices.push(outerA, outerB, innerA, outerB, innerB, innerA)
      else indices.push(outerA, innerA, outerB, outerB, innerA, innerB)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createLimbGeometry(start: THREE.Vector3, end: THREE.Vector3, radius: number) {
  const direction = end.clone().sub(start)
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 48, 12, true)
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  )
  geometry.translate((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5)
  return geometry
}

function SolidWallScaffold({
  builder,
  ridgeMaterial,
  siliconeMaterial,
  posteriorMaterial,
}: {
  builder: StentGeometryBuilderId
  posteriorMaterial: THREE.Material
  ridgeMaterial: THREE.Material
  siliconeMaterial: THREE.Material
}) {
  const paths = useMemo(() => buildScaffoldPaths(builder), [builder])
  const cylinder = useMemo(
    () => new THREE.CylinderGeometry(STENT_RADIUS, STENT_RADIUS, STENT_LENGTH, 64, 20, true),
    [],
  )
  const dWall = useMemo(() => createDWallGeometry(), [])
  const studs = useMemo(() => createStudGeometry(), [])
  const posterior = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(STENT_RADIUS * 1.62, STENT_LENGTH, 16, 20)
    geometry.rotateY(Math.PI * 0.5)
    geometry.translate(-STENT_RADIUS * 0.56, 0, 0)
    return geometry
  }, [])

  useEffect(
    () => () => {
      cylinder.dispose()
      dWall.dispose()
      posterior.dispose()
      studs.forEach((geometry) => geometry.dispose())
    },
    [cylinder, dWall, posterior, studs],
  )

  if (builder === 'studded-cylinder') {
    return (
      <group>
        <mesh geometry={cylinder} material={siliconeMaterial} />
        {studs.map((geometry, index) => (
          <mesh key={index} castShadow geometry={geometry} material={ridgeMaterial} />
        ))}
        {paths.map((path) => (
          <PathMesh key={path.id} material={ridgeMaterial} path={path} />
        ))}
      </group>
    )
  }

  return (
    <group>
      <mesh geometry={dWall} material={siliconeMaterial} />
      <mesh geometry={posterior} material={posteriorMaterial} renderOrder={3} />
      {paths.map((path) => (
        <PathMesh key={path.id} material={ridgeMaterial} path={path} />
      ))}
    </group>
  )
}

function SiliconeYScaffold({ material }: { material: THREE.Material }) {
  const geometries = useMemo(() => {
    const topology = getSiliconeYStentTopology()
    return {
      junction: new THREE.SphereGeometry(0.7, 42, 22),
      limbs: topology.limbs.map((limb) => ({
        geometry: createLimbGeometry(limb.start, limb.end, limb.radius),
        id: limb.id,
      })),
    }
  }, [])

  useEffect(
    () => () => {
      geometries.junction.dispose()
      geometries.limbs.forEach((limb) => limb.geometry.dispose())
    },
    [geometries],
  )

  return (
    <group>
      {geometries.limbs.map((limb) => (
        <mesh key={limb.id} geometry={limb.geometry} material={material} />
      ))}
      <mesh geometry={geometries.junction} material={material} renderOrder={2} />
    </group>
  )
}

function WireScaffold({
  accentMaterial,
  builder,
  metalMaterial,
}: {
  accentMaterial: THREE.Material
  builder: StentGeometryBuilderId
  metalMaterial: THREE.Material
}) {
  const paths = useMemo(() => buildScaffoldPaths(builder), [builder])
  const usesHookAndCross = builder === 'hook-cross-captured-helices'
  return (
    <group>
      {paths.map((path) => (
        <PathMesh
          key={path.id}
          material={
            usesHookAndCross
              ? path.role === 'capture'
                ? accentMaterial
                : metalMaterial
              : path.role === 'wire-b' ||
                  path.role === 'capture' ||
                  path.role === 'connector' ||
                  path.role === 'single-wire'
                ? accentMaterial
                : metalMaterial
          }
          path={path}
        />
      ))}
    </group>
  )
}

function Cover({ partial, material }: { material: THREE.Material; partial: boolean }) {
  const geometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        STENT_RADIUS * 0.965,
        STENT_RADIUS * 0.965,
        STENT_LENGTH * (partial ? PARTIAL_COVER_LENGTH_FRACTION : 0.92),
        64,
        24,
        true,
      ),
    [partial],
  )
  const edgePaths = useMemo(() => {
    if (!partial) return []
    const halfCoveredLength = STENT_LENGTH * PARTIAL_COVER_LENGTH_FRACTION * 0.5
    return [-1, 1].map((direction) => ({
      ...createRingPath({
        center: new THREE.Vector3(0, direction * halfCoveredLength, 0),
        id: `partial-cover-edge-${direction}`,
        radius: STENT_RADIUS * 0.985,
        role: 'silicone-ridge',
      }),
      radius: 0.028,
    }))
  }, [partial])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={2} />
      {edgePaths.map((path) => (
        <PathMesh key={path.id} material={material} path={path} />
      ))}
    </group>
  )
}

function TubularAirway({ material }: { material: THREE.Material }) {
  const wall = useMemo(
    () => new THREE.CylinderGeometry(1.46, 1.46, STENT_LENGTH + 0.9, 64, 24, true),
    [],
  )
  const rings = useMemo(
    () =>
      Array.from(
        { length: 9 },
        (_, index) =>
          ({
            ...createRingPath({
              center: new THREE.Vector3(0, -STENT_LENGTH * 0.5 + (index / 8) * STENT_LENGTH, 0),
              id: `airway-ring-${index}`,
              radius: 1.47,
              role: 'silicone-ridge',
            }),
            radius: 0.024,
          }) satisfies ScaffoldPath,
      ),
    [],
  )
  useEffect(() => () => wall.dispose(), [wall])

  return (
    <group>
      <mesh geometry={wall} material={material} renderOrder={0} />
      {rings.map((ring) => (
        <PathMesh key={ring.id} material={material} path={ring} />
      ))}
    </group>
  )
}

function YAirway({ material }: { material: THREE.Material }) {
  const geometries = useMemo(() => {
    const junction = new THREE.Vector3(0, -0.18, 0)
    return [
      createLimbGeometry(junction, new THREE.Vector3(0, 2.75, 0), 0.91),
      createLimbGeometry(junction, new THREE.Vector3(-1.65, -2.35, 0), 0.72),
      createLimbGeometry(junction, new THREE.Vector3(1.65, -2.35, 0), 0.72),
    ]
  }, [])
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), [geometries])
  return (
    <group>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={material} renderOrder={0} />
      ))}
    </group>
  )
}

function BoundaryGuides({
  leftRef,
  lowerRef,
  mode,
  rightRef,
  showLengthGuides,
  upperRef,
}: {
  leftRef: RefObject<THREE.Mesh | null>
  lowerRef: RefObject<THREE.Mesh | null>
  mode: StentLoadMode
  rightRef: RefObject<THREE.Mesh | null>
  showLengthGuides: boolean
  upperRef: RefObject<THREE.Mesh | null>
}) {
  const platesVisible = mode === 'radial' || mode === 'ovalization' || mode === 'cough'
  const diameterReferenceVisible =
    mode === 'radial' ||
    mode === 'ovalization' ||
    mode === 'breathing' ||
    mode === 'cough' ||
    mode === 'deployment'
  return (
    <group>
      <group visible={platesVisible}>
        <mesh ref={leftRef} position={[-1.75, mode === 'cough' ? 0.55 : 0, 0]}>
          <boxGeometry args={[0.09, mode === 'cough' ? 1.2 : 3.9, 2.5]} />
          <meshStandardMaterial color="#38bdf8" opacity={0.12} transparent />
        </mesh>
        <mesh ref={rightRef} position={[1.75, 0, 0]} visible={mode !== 'cough'}>
          <boxGeometry args={[0.09, 3.9, 2.5]} />
          <meshStandardMaterial color="#38bdf8" opacity={0.12} transparent />
        </mesh>
      </group>
      <mesh visible={diameterReferenceVisible} rotation-x={Math.PI * 0.5}>
        <torusGeometry args={[STENT_RADIUS, 0.014, 6, 72]} />
        <meshBasicMaterial color="#cbd5e1" depthWrite={false} opacity={0.42} transparent />
      </mesh>
      <group visible={showLengthGuides && mode !== 'rest'}>
        <mesh position-y={-STENT_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
          <torusGeometry args={[1.3, 0.012, 6, 64]} />
          <meshBasicMaterial color="#cbd5e1" depthWrite={false} opacity={0.35} transparent />
        </mesh>
        <mesh position-y={STENT_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
          <torusGeometry args={[1.3, 0.012, 6, 64]} />
          <meshBasicMaterial color="#cbd5e1" depthWrite={false} opacity={0.35} transparent />
        </mesh>
        <mesh ref={lowerRef} position-y={-STENT_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
          <torusGeometry args={[1.36, 0.024, 7, 64]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        <mesh ref={upperRef} position-y={STENT_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
          <torusGeometry args={[1.36, 0.024, 7, 64]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
    </group>
  )
}

function ArchitectureScene({
  active,
  amplitude,
  mode,
  onFrameChange,
  playing,
  profile,
  reducedMotion,
  resetVersion,
  showAirway,
  showCover,
}: StentArchitectureViewportProps) {
  const { invalidate } = useThree()
  const progressRef = useRef(getRepresentativeLoadProgress(mode))
  const directionRef = useRef<PingPongDirection>(
    getRepresentativeLoadProgress(mode) >= 0.5 ? -1 : 1,
  )
  const lastReportRef = useRef(-1)
  const leftPlateRef = useRef<THREE.Mesh>(null)
  const rightPlateRef = useRef<THREE.Mesh>(null)
  const lowerMarkerRef = useRef<THREE.Mesh>(null)
  const upperMarkerRef = useRef<THREE.Mesh>(null)

  const metal = useDeformableStentMaterial({
    clearcoat: 0.55,
    color: '#e2e8f0',
    metalness: 0.9,
    roughness: 0.2,
  })
  const metalAccent = useDeformableStentMaterial({
    clearcoat: 0.48,
    color: profile.geometryBuilder === 'hook-cross-captured-helices' ? '#fbbf24' : '#7dd3fc',
    metalness: 0.82,
    roughness: 0.24,
  })
  const silicone = useDeformableStentMaterial({
    clearcoat: 0.4,
    color: profile.geometryBuilder === 'dynamic-d-cylinder' ? '#5eead4' : '#bae6fd',
    depthWrite: false,
    metalness: 0,
    opacity: 0.7,
    roughness: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const siliconeRidge = useDeformableStentMaterial({
    clearcoat: 0.45,
    color: profile.geometryBuilder === 'dynamic-d-cylinder' ? '#2dd4bf' : '#7dd3fc',
    metalness: 0,
    roughness: 0.35,
  })
  const posterior = useDeformableStentMaterial({
    color: '#fbbf24',
    depthWrite: false,
    metalness: 0,
    opacity: 0.32,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const cover = useDeformableStentMaterial({
    clearcoat: 0.24,
    color: '#e0f2fe',
    depthWrite: false,
    metalness: 0,
    opacity: 0.14,
    roughness: 0.7,
    side: THREE.DoubleSide,
    transparent: true,
  })
  const airway = useDeformableStentMaterial({
    color: '#fb7185',
    depthWrite: false,
    metalness: 0,
    opacity: 0.07,
    roughness: 0.8,
    side: THREE.DoubleSide,
    transparent: true,
  })

  useEffect(() => {
    progressRef.current = getRepresentativeLoadProgress(mode)
    directionRef.current = progressRef.current >= 0.5 ? -1 : 1
    lastReportRef.current = -1
    invalidate()
  }, [invalidate, mode, profile.id, resetVersion])

  useEffect(() => {
    lastReportRef.current = -1
    invalidate()
  }, [amplitude, invalidate])

  useFrame((state, delta) => {
    const isPlaying = playing && active && !reducedMotion && mode !== 'rest'
    const usesPingPong = ['radial', 'bend', 'ovalization', 'deployment'].includes(mode)
    if (usesPingPong) {
      const next = resolvePingPongProgress({
        currentProgress: progressRef.current,
        deltaSeconds: delta,
        direction: directionRef.current,
        isPlaying,
        reducedMotion,
      })
      progressRef.current = next.progress
      directionRef.current = next.direction
    } else {
      progressRef.current = resolveAnimationProgress({
        currentProgress: progressRef.current,
        deltaSeconds: delta,
        isPlaying,
        reducedMotion,
        speed: mode === 'cough' ? 0.3 : 0.22,
      })
    }
    const frame = applyLoadAmplitude(getLoadFrame(mode, progressRef.current, profile), amplitude)

    for (const target of [metal, metalAccent, silicone, siliconeRidge, posterior, cover, airway]) {
      applyLoadFrameToUniforms(target.uniforms, frame)
    }

    const travel = THREE.MathUtils.clamp(
      1 - Math.min(frame.radialScaleX, frame.radialScaleZ),
      0,
      0.5,
    )
    if (leftPlateRef.current) leftPlateRef.current.position.x = -1.75 + travel * 1.15
    if (rightPlateRef.current) rightPlateRef.current.position.x = 1.75 - travel * 1.15
    const halfLength = STENT_LENGTH * 0.5 * frame.axialScale
    if (lowerMarkerRef.current) lowerMarkerRef.current.position.y = frame.axialOffset - halfLength
    if (upperMarkerRef.current) upperMarkerRef.current.position.y = frame.axialOffset + halfLength

    if (
      onFrameChange &&
      (lastReportRef.current < 0 || state.clock.elapsedTime - lastReportRef.current > 0.16)
    ) {
      lastReportRef.current = state.clock.elapsedTime
      onFrameChange(frame)
    }
  })

  const solidWall =
    profile.geometryBuilder === 'studded-cylinder' ||
    profile.geometryBuilder === 'dynamic-d-cylinder'

  return (
    <group rotation={[0.04, -0.26, -0.07]}>
      {showAirway ? (
        profile.capabilities.isBifurcated ? (
          <YAirway material={airway.material} />
        ) : (
          <TubularAirway material={airway.material} />
        )
      ) : null}

      {solidWall ? (
        <SolidWallScaffold
          builder={profile.geometryBuilder}
          posteriorMaterial={posterior.material}
          ridgeMaterial={siliconeRidge.material}
          siliconeMaterial={silicone.material}
        />
      ) : profile.geometryBuilder === 'silicone-y' ? (
        <SiliconeYScaffold material={silicone.material} />
      ) : (
        <WireScaffold
          accentMaterial={metalAccent.material}
          builder={profile.geometryBuilder}
          metalMaterial={metal.material}
        />
      )}

      {showCover && profile.capabilities.supportsCoverInspection ? (
        <Cover material={cover.material} partial={profile.coverage === 'partially-covered'} />
      ) : null}

      {!profile.capabilities.isBifurcated ? (
        <BoundaryGuides
          leftRef={leftPlateRef}
          lowerRef={lowerMarkerRef}
          mode={mode}
          rightRef={rightPlateRef}
          showLengthGuides={profile.capabilities.supportsLengthChange}
          upperRef={upperMarkerRef}
        />
      ) : null}
    </group>
  )
}

function supportsWebGL() {
  if (typeof document === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGL2RenderingContext && canvas.getContext('webgl2')
        ? canvas.getContext('webgl2')
        : canvas.getContext('webgl') || canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}

export function StentArchitectureViewport(props: StentArchitectureViewportProps) {
  const [webglAvailable] = useState(supportsWebGL)
  const shouldAnimate =
    props.playing && props.active && !props.reducedMotion && props.mode !== 'rest'

  if (!webglAvailable) {
    return <StentArchitectureFallback profile={props.profile} />
  }

  return (
    <CanvasErrorBoundary
      key={`${props.profile.id}-${props.resetVersion}`}
      fallback={
        <StentArchitectureFallback
          profile={props.profile}
          reason="The 3D renderer could not start, so the same topology is shown as an accessible schematic."
        />
      }
    >
      <Canvas
        key={props.resetVersion}
        aria-label={`Interactive illustrative ${props.profile.label} architecture`}
        camera={{ fov: 38, position: [6.5, 2.9, 7.6] }}
        dpr={[1, 1.5]}
        frameloop={shouldAnimate ? 'always' : 'demand'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.08
        }}
        shadows
      >
        <hemisphereLight args={['#e0f2fe', '#07111f', 1.15]} />
        <directionalLight castShadow intensity={2.4} position={[5, 7, 6]} />
        <directionalLight color="#7dd3fc" intensity={1.0} position={[-5, 1, -4]} />
        <pointLight color="#fb7185" intensity={0.55} position={[0, -3, 4]} />
        <ArchitectureScene {...props} />
        <OrbitControls
          enableDamping={shouldAnimate}
          enablePan={false}
          makeDefault
          maxDistance={12}
          minDistance={4.8}
          target={[0, 0, 0]}
        />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
