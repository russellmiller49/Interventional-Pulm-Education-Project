'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'

import { getDeviceLoadFrame } from '@/features/airway-stent-mechanics/content/deviceArchitectureProfiles'
import type {
  DeviceArchitectureProfile,
  DeviceLoadMode,
} from '@/features/airway-stent-mechanics/content/deviceArchitectureProfiles'
import {
  buildDevicePaths,
  DEVICE_LENGTH,
  DEVICE_RADIUS,
  WIRE_RADIUS,
} from '@/features/airway-stent-mechanics/engine/deviceGeometry'
import type { DevicePath } from '@/features/airway-stent-mechanics/engine/deviceGeometry'

import { applyFrameToUniforms, useDeformableStentMaterial } from './useDeformableStentMaterial'

function DevicePathMesh({ material, path }: { material: THREE.Material; path: DevicePath }) {
  const geometry = useMemo(() => {
    const points = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const curve = new THREE.CatmullRomCurve3(points, path.closed, 'centripetal', 0.5)
    const tubularSegments = Math.max(18, Math.min(360, points.length * 2))
    const radialSegments = path.family === 'single-wire' ? 7 : 6

    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      WIRE_RADIUS * path.radiusScale,
      radialSegments,
      path.closed,
    )
  }, [path])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh castShadow geometry={geometry} material={material} />
}

function DeviceScaffold({
  material,
  profile,
}: {
  material: THREE.Material
  profile: DeviceArchitectureProfile
}) {
  const paths = useMemo(() => buildDevicePaths(profile.id), [profile.id])

  return (
    <group>
      {paths.map((path) => (
        <DevicePathMesh key={path.id} material={material} path={path} />
      ))}
    </group>
  )
}

function DeviceCover({
  material,
  profile,
}: {
  material: THREE.Material
  profile: DeviceArchitectureProfile
}) {
  const dimensions = useMemo(() => {
    if (profile.cover === 'partial-midsection') {
      return { length: DEVICE_LENGTH * 0.7, radius: DEVICE_RADIUS * 0.95 }
    }
    if (profile.cover === 'full-inner') {
      return { length: DEVICE_LENGTH * 0.92, radius: DEVICE_RADIUS * 0.91 }
    }
    return { length: DEVICE_LENGTH * 0.94, radius: DEVICE_RADIUS * 0.965 }
  }, [profile.cover])

  const geometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        dimensions.radius,
        dimensions.radius,
        dimensions.length,
        64,
        26,
        true,
      ),
    [dimensions.length, dimensions.radius],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={material} renderOrder={2} />
}

function AirwayPhantom({ material }: { material: THREE.Material }) {
  const wallGeometry = useMemo(
    () => new THREE.CylinderGeometry(1.48, 1.48, DEVICE_LENGTH + 0.9, 64, 28, true),
    [],
  )
  const ringGeometries = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const geometry = new THREE.TorusGeometry(1.49, 0.025, 6, 52)
        geometry.rotateX(Math.PI * 0.5)
        geometry.translate(0, -DEVICE_LENGTH * 0.5 + (index / 8) * DEVICE_LENGTH, 0)
        return geometry
      }),
    [],
  )

  useEffect(
    () => () => {
      wallGeometry.dispose()
      ringGeometries.forEach((geometry) => geometry.dispose())
    },
    [ringGeometries, wallGeometry],
  )

  return (
    <group>
      <mesh geometry={wallGeometry} material={material} renderOrder={0} />
      {ringGeometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={material} renderOrder={0} />
      ))}
    </group>
  )
}

function LoadFixture({
  leftRef,
  mode,
  rightRef,
}: {
  leftRef: RefObject<THREE.Mesh | null>
  mode: DeviceLoadMode
  rightRef: RefObject<THREE.Mesh | null>
}) {
  const isCough = mode === 'cough'
  const visible = isCough || mode === 'radial'
  const fixtureHeight = isCough ? 1.22 : 3.7

  return (
    <group visible={visible}>
      <mesh ref={leftRef} position={[-2.15, isCough ? 0.42 : 0, 0]}>
        <boxGeometry args={[0.16, fixtureHeight, 2.4]} />
        <meshStandardMaterial
          color={isCough ? '#fb7185' : '#38bdf8'}
          emissive={isCough ? '#881337' : '#075985'}
          emissiveIntensity={0.3}
          opacity={0.36}
          transparent
        />
      </mesh>
      {!isCough ? (
        <mesh ref={rightRef} position={[2.15, 0, 0]}>
          <boxGeometry args={[0.16, fixtureHeight, 2.4]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#075985"
            emissiveIntensity={0.3}
            opacity={0.36}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  )
}

function DeploymentMarkers({
  lowerRef,
  mode,
  upperRef,
}: {
  lowerRef: RefObject<THREE.Mesh | null>
  mode: DeviceLoadMode
  upperRef: RefObject<THREE.Mesh | null>
}) {
  const geometry = useMemo(() => new THREE.TorusGeometry(1.35, 0.018, 5, 52), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group visible={mode === 'foreshortening'}>
      <mesh geometry={geometry} position-y={-DEVICE_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
        <meshBasicMaterial color="#64748b" opacity={0.38} transparent />
      </mesh>
      <mesh geometry={geometry} position-y={DEVICE_LENGTH * 0.5} rotation-x={Math.PI * 0.5}>
        <meshBasicMaterial color="#64748b" opacity={0.38} transparent />
      </mesh>
      <mesh ref={lowerRef} geometry={geometry} rotation-x={Math.PI * 0.5}>
        <meshBasicMaterial color="#facc15" />
      </mesh>
      <mesh ref={upperRef} geometry={geometry} rotation-x={Math.PI * 0.5}>
        <meshBasicMaterial color="#facc15" />
      </mesh>
    </group>
  )
}

function DeviceScene({
  loadAmplitude,
  mode,
  playing,
  profile,
  reduceMotion,
  showAirway,
  showCover,
}: {
  loadAmplitude: number
  mode: DeviceLoadMode
  playing: boolean
  profile: DeviceArchitectureProfile
  reduceMotion: boolean
  showAirway: boolean
  showCover: boolean
}) {
  const phaseRef = useRef(0)
  const leftPlateRef = useRef<THREE.Mesh>(null)
  const rightPlateRef = useRef<THREE.Mesh>(null)
  const lowerMarkerRef = useRef<THREE.Mesh>(null)
  const upperMarkerRef = useRef<THREE.Mesh>(null)

  const scaffoldMaterial = useDeformableStentMaterial({
    axialCoupling: profile.visualCalibration.axialCoupling,
    color: profile.id === 'aero' ? '#d8e0e8' : profile.id === 'bonastent' ? '#cbd5e1' : '#e2e8f0',
    metalness: 0.88,
    roughness: 0.2,
    twistGain: profile.visualCalibration.twistGain,
  })
  const coverMaterial = useDeformableStentMaterial({
    axialCoupling: profile.visualCalibration.axialCoupling,
    color: profile.id === 'bonastent' ? '#f8fafc' : '#bae6fd',
    depthWrite: false,
    metalness: 0.02,
    opacity: profile.id === 'bonastent' ? 0.34 : 0.26,
    roughness: 0.65,
    side: THREE.DoubleSide,
    transparent: true,
    twistGain: profile.visualCalibration.twistGain,
  })
  const airwayMaterial = useDeformableStentMaterial({
    axialCoupling: 0,
    color: '#fda4af',
    depthWrite: false,
    metalness: 0,
    opacity: 0.13,
    roughness: 0.78,
    side: THREE.DoubleSide,
    transparent: true,
    twistGain: 0,
  })

  useEffect(() => {
    phaseRef.current = 0
  }, [mode, profile.id])

  useFrame((_, delta) => {
    if (playing && !reduceMotion) phaseRef.current += delta
    const frame = getDeviceLoadFrame({
      elapsedSeconds: phaseRef.current,
      loadAmplitude,
      mode,
      playing: playing && !reduceMotion,
    })

    applyFrameToUniforms(scaffoldMaterial.uniforms, frame)
    applyFrameToUniforms(coverMaterial.uniforms, frame)
    applyFrameToUniforms(airwayMaterial.uniforms, {
      ...frame,
      compression: frame.compression * (mode === 'cough' ? 1.14 : 1.04),
      eccentricity: frame.eccentricity * 1.16,
      ovalization: frame.ovalization * 1.12,
    })

    const normalizedTravel = THREE.MathUtils.clamp(frame.compression / 0.28, 0, 1)
    if (leftPlateRef.current) leftPlateRef.current.position.x = -2.15 + normalizedTravel * 0.58
    if (rightPlateRef.current) rightPlateRef.current.position.x = 2.15 - normalizedTravel * 0.58

    const currentHalfLength =
      DEVICE_LENGTH * 0.5 * (1 + frame.compression * profile.visualCalibration.axialCoupling)
    if (lowerMarkerRef.current) lowerMarkerRef.current.position.y = -currentHalfLength
    if (upperMarkerRef.current) upperMarkerRef.current.position.y = currentHalfLength
  })

  return (
    <group rotation={[0.05, -0.28, -0.08]}>
      {showAirway ? <AirwayPhantom material={airwayMaterial.material} /> : null}
      <DeviceScaffold material={scaffoldMaterial.material} profile={profile} />
      {showCover ? <DeviceCover material={coverMaterial.material} profile={profile} /> : null}
      <LoadFixture leftRef={leftPlateRef} mode={mode} rightRef={rightPlateRef} />
      <DeploymentMarkers lowerRef={lowerMarkerRef} mode={mode} upperRef={upperMarkerRef} />
    </group>
  )
}

export function DeviceArchitectureViewport({
  loadAmplitude,
  mode,
  playing,
  profile,
  reduceMotion,
  showAirway,
  showCover,
  viewVersion,
}: {
  loadAmplitude: number
  mode: DeviceLoadMode
  playing: boolean
  profile: DeviceArchitectureProfile
  reduceMotion: boolean
  showAirway: boolean
  showCover: boolean
  viewVersion: number
}) {
  const canAnimate = !reduceMotion && mode !== 'rest'

  return (
    <Canvas
      key={viewVersion}
      aria-label={`Interactive ${profile.shortLabel} airway stent architecture model`}
      camera={{ fov: 38, position: [6.8, 3.1, 7.8] }}
      dpr={[1, 1.6]}
      frameloop={playing && canAnimate ? 'always' : 'demand'}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      shadows
    >
      <ambientLight intensity={1.1} />
      <directionalLight castShadow intensity={2.2} position={[4, 6, 5]} />
      <directionalLight intensity={1.1} position={[-5, -2, 3]} />
      <pointLight color="#67e8f9" intensity={1.2} position={[-3, 1, -4]} />
      <DeviceScene
        loadAmplitude={loadAmplitude}
        mode={mode}
        playing={playing}
        profile={profile}
        reduceMotion={reduceMotion}
        showAirway={showAirway}
        showCover={showCover}
      />
      <OrbitControls enablePan={false} maxDistance={12} minDistance={5.2} target={[0, 0, 0]} />
    </Canvas>
  )
}
