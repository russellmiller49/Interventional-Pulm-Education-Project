'use client'

import { Html, Line, OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import {
  getStentExplorerArchitectureProfile,
  hasExplorerArchitectureCover,
  isYExplorerArchitecture,
} from '../../explorer/architectures'
import { getAvailableStentExplorerHotspots } from '../../explorer/hotspots'
import { buildExplorerScaffoldPaths } from '../../explorer/scaffoldGeometry'
import type {
  StentExplorerArchitectureId,
  StentExplorerPose,
  StentExplorerStation,
  StentExplorerStationId,
  StentExplorerViewMode,
  StentMechanicsModifiers,
} from '../../explorer/types'
import { getStentExplorerAirwayPose } from '../../explorer/pose'

const TAU = Math.PI * 2
const STENT_LENGTH = 4.8
const STENT_RADIUS = 1
const AIRWAY_RADIUS = 1.42
const HOTSPOT_LABEL_OFFSETS = [
  [-34, -20],
  [36, -8],
  [-32, 15],
  [36, 23],
] as const

interface SceneProps {
  architectureId: StentExplorerArchitectureId
  cameraCommand?: StentExplorerCameraCommand
  modifiers?: StentMechanicsModifiers
  onContextLost: () => void
  playing: boolean
  pose: StentExplorerPose
  reducedMotion: boolean
  showHotspots: boolean
  station: StentExplorerStation
  viewMode: StentExplorerViewMode
}

export type StentExplorerCameraAction =
  | 'orbit-left'
  | 'orbit-right'
  | 'pan-left'
  | 'pan-right'
  | 'reset'

export interface StentExplorerCameraCommand {
  action: StentExplorerCameraAction
  id: number
}

export interface StentExplorerHotspot {
  description: string
  id: string
  label: string
  position: readonly [number, number, number]
}

const HOTSPOTS: Record<StentExplorerStationId, readonly StentExplorerHotspot[]> = {
  'architecture-lumen': [
    {
      id: 'wall-budget',
      label: 'Wall budget',
      description: 'The structural envelope occupies part of the shared outer diameter.',
      position: [1.05, 0.25, 0.18],
    },
    {
      id: 'open-lumen',
      label: 'Open lumen',
      description: 'Inspect the inner opening; the SVG view compares it at a common scale.',
      position: [0.2, 2.28, 0.1],
    },
  ],
  'metal-architecture': [
    {
      id: 'wire-junctions',
      label: 'Crossings / junctions',
      description: 'Inspect whether crossings slide, are captured, or are absent.',
      position: [1.05, 0.75, 0.25],
    },
    {
      id: 'ring-connectors',
      label: 'Connectors',
      description: 'Laser-cut connectors transfer motion between neighboring rings.',
      position: [-0.85, 0.1, 0.72],
    },
    {
      id: 'continuous-strand',
      label: 'Continuous strand',
      description: 'Knitted loop deformation can propagate along one wire path.',
      position: [0.9, -0.95, 0.4],
    },
    {
      id: 'coverage-transitions',
      label: 'Coverage transition',
      description: 'Inspect full, partial, and absent coverage as different interfaces.',
      position: [-0.7, 1.85, 0.55],
    },
  ],
  'cough-motion': [
    {
      id: 'end-excursion',
      label: 'End excursion',
      description:
        'Architecture-specific length change or sliding can alter where an end contacts tissue.',
      position: [0.95, 2.35, 0.12],
    },
    {
      id: 'fixed-landmark',
      label: 'Airway landmark',
      description:
        'Compare the moving stent end with the fixed airway ring; motion alone does not predict granulation.',
      position: [-1.45, 2.55, 0],
    },
  ],
  'curve-buckle': [
    {
      id: 'inner-curve-contact',
      label: 'Focal contact',
      description: 'The inside of the curve can concentrate contact as a straight tube conforms.',
      position: [1.25, 0.45, 0.12],
    },
    {
      id: 'central-involution',
      label: 'Central involution',
      description: 'Localized wall infolding can reduce the patent lumen without uniform collapse.',
      position: [0.45, 0.05, 0.85],
    },
  ],
  migration: [
    {
      id: 'proximal-landmark',
      label: 'Fixed landmark',
      description: 'The airway reference stays fixed while the device shifts longitudinally.',
      position: [-1.45, 1.7, 0],
    },
    {
      id: 'apposition-gap',
      label: 'Apposition gap',
      description: 'Reduced contact can permit displacement; this model does not calculate risk.',
      position: [1.2, -0.75, 0.25],
    },
  ],
  'mucus-obstruction': [
    {
      id: 'dependent-pocket',
      label: 'Dependent pocket',
      description: 'Secretions collect along a dependent surface before coalescing into a plug.',
      position: [0.15, -0.85, 0.78],
    },
    {
      id: 'residual-lumen',
      label: 'Residual lumen',
      description:
        'Inspect the remaining opening rather than treating secretion coating as binary.',
      position: [-0.6, 0.15, 0.55],
    },
  ],
  granulation: [
    {
      id: 'end-contact',
      label: 'End contact zone',
      description:
        'Motion, secretion or infection, dwell time, and host response can converge at a device end.',
      position: [1, 2.18, 0.15],
    },
    {
      id: 'tissue-encroachment',
      label: 'Tissue encroachment',
      description: 'The tissue overlay is qualitative and does not estimate an individual outcome.',
      position: [-0.55, 2.05, 0.7],
    },
  ],
  'tumor-ingrowth-overgrowth': [
    {
      id: 'through-cells',
      label: 'Through-cell ingrowth',
      description: 'Uncovered openings permit tissue to project between scaffold elements.',
      position: [1.02, 0.2, 0.15],
    },
    {
      id: 'end-overgrowth',
      label: 'End overgrowth',
      description:
        'A covering changes the pathway; it does not provide absolute protection at the ends.',
      position: [-0.72, 2.18, 0.52],
    },
  ],
  'fracture-cover-failure': [
    {
      id: 'loading-hotspot',
      label: 'Repeated-load hotspot',
      description:
        'A tortuous curve can focus repeated loading; the model does not assign fracture to cough alone.',
      position: [1.1, 0.15, 0.18],
    },
    {
      id: 'integrity-gap',
      label: 'Integrity gap',
      description: 'Inspect wire discontinuity and cover separation as distinct failure modes.',
      position: [0.2, 0.2, 1.05],
    },
  ],
  'y-stent': [
    {
      id: 'carinal-saddle',
      label: 'Carinal saddle',
      description: 'Saddle position couples trunk fit to both branch limbs.',
      position: [0, -0.15, 0.75],
    },
    {
      id: 'branch-orifice',
      label: 'Distal branch orifice',
      description: 'Limb length, diameter, and angle can crowd a distal opening.',
      position: [1.65, -2, 0.25],
    },
    {
      id: 'posterior-wall',
      label: 'Posterior motion',
      description:
        'Posterior-wall motion and secretion pockets are inspected separately from branch fit.',
      position: [-0.15, 0.75, -0.65],
    },
  ],
  'deploy-rescue': [
    {
      id: 'release-front',
      label: 'Release front',
      description: 'Expansion and position change as the conceptual delivery constraint withdraws.',
      position: [1.25, 0.25, 0.15],
    },
    {
      id: 'inspection-end',
      label: 'Immediate inspection',
      description:
        'Inspect both ends, lumen, branch orifices, and tissue contact after deployment.',
      position: [-0.9, 2.22, 0.22],
    },
  ],
}

export function getStationHotspots(
  station: StentExplorerStation,
  architectureId?: StentExplorerArchitectureId,
) {
  const layout = HOTSPOTS[station.id]
  const availableHotspots = getAvailableStentExplorerHotspots(station, architectureId)

  return availableHotspots.map((hotspot, index) => {
    const fallbackAngle = (index / Math.max(1, station.hotspots.length)) * TAU
    const positionedHotspot = layout.find((candidate) => candidate.id === hotspot.id)
    return {
      ...hotspot,
      position:
        positionedHotspot?.position ??
        ([
          Math.cos(fallbackAngle) * 1.18,
          1.1 - index * 0.72,
          Math.sin(fallbackAngle) * 0.5,
        ] as const),
    }
  })
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function gaussian(value: number, width: number) {
  return Math.exp(-(value * value) / (2 * width * width))
}

function architectureIsY(architectureId: StentExplorerArchitectureId) {
  return isYExplorerArchitecture(architectureId)
}

function architectureIsSilicone(architectureId: StentExplorerArchitectureId) {
  return (
    architectureId === 'solid-silicone' ||
    architectureId === 'silicone-y' ||
    architectureId === 'dynamic-y'
  )
}

function architectureHasCover(architectureId: StentExplorerArchitectureId) {
  return hasExplorerArchitectureCover(architectureId)
}

function deploymentScale(pose: StentExplorerPose) {
  return 0.3 + clamp01(pose.deployment) * 0.7
}

function deformedPoint({
  length,
  pose,
  radius,
  t,
  theta,
}: {
  length: number
  pose: StentExplorerPose
  radius: number
  t: number
  theta: number
}) {
  const axialScale = Math.max(0.55, pose.axialScale)
  const deployed = deploymentScale(pose)
  const bendOffset = pose.bend * 1.38 * (1 - 4 * t * t)
  const kinkWindow = gaussian(t, 0.16)
  const innerCurveWindow = ((Math.cos(theta) + 1) / 2) ** 3
  const involution = pose.kink * kinkWindow * innerCurveWindow * radius * 0.58
  const radialX = radius * deployed * (1 - pose.radialCompression * 0.32)
  const radialZ = radius * deployed * (1 - pose.airwayCompression * 0.18)

  return new THREE.Vector3(
    bendOffset + Math.cos(theta) * radialX - involution,
    t * length * axialScale,
    Math.sin(theta) * radialZ,
  )
}

function createTubeShellGeometry({
  innerRadius,
  length,
  outerRadius,
  pose,
}: {
  innerRadius: number
  length: number
  outerRadius: number
  pose: StentExplorerPose
}) {
  const axialSegments = 26
  const radialSegments = 56
  const stride = (radialSegments + 1) * 2
  const positions: number[] = []
  const indices: number[] = []

  for (let axial = 0; axial <= axialSegments; axial += 1) {
    const t = axial / axialSegments - 0.5
    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const theta = (radial / radialSegments) * TAU
      const outer = deformedPoint({ length, pose, radius: outerRadius, t, theta })
      const inner = deformedPoint({ length, pose, radius: innerRadius, t, theta })
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
  geometry.computeBoundingSphere()
  return geometry
}

function buildRingPoints(t: number, radius: number, pose: StentExplorerPose) {
  return Array.from({ length: 65 }, (_, index) =>
    deformedPoint({
      length: STENT_LENGTH,
      pose,
      radius,
      t,
      theta: (index / 64) * TAU,
    }),
  )
}

function buildAxialRidgePoints(theta: number, radius: number, pose: StentExplorerPose) {
  return Array.from({ length: 33 }, (_, index) =>
    deformedPoint({
      length: STENT_LENGTH,
      pose,
      radius,
      t: index / 32 - 0.5,
      theta,
    }),
  )
}

function DeformedShell({
  clippingPlanes,
  color,
  innerRadius,
  opacity,
  outerRadius,
  pose,
  length = STENT_LENGTH,
}: {
  clippingPlanes: readonly THREE.Plane[]
  color: string
  innerRadius: number
  opacity: number
  outerRadius: number
  pose: StentExplorerPose
  length?: number
}) {
  const geometry = useMemo(
    () =>
      createTubeShellGeometry({
        innerRadius,
        length,
        outerRadius,
        pose,
      }),
    [innerRadius, length, outerRadius, pose],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        clearcoat={0.35}
        clipShadows
        clippingPlanes={[...clippingPlanes]}
        color={color}
        depthWrite={opacity >= 0.8}
        opacity={opacity}
        roughness={0.45}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
      />
    </mesh>
  )
}

function SiliconeScaffold({
  clippingPlanes,
  pose,
  wallOccupancy = 0.75,
}: {
  clippingPlanes: readonly THREE.Plane[]
  pose: StentExplorerPose
  wallOccupancy?: number
}) {
  const rings = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) =>
        buildRingPoints(index / 7 - 0.5, STENT_RADIUS * 1.025, pose),
      ),
    [pose],
  )
  const ridges = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) =>
        buildAxialRidgePoints((index / 8) * TAU, STENT_RADIUS * 1.028, pose),
      ),
    [pose],
  )

  return (
    <group>
      <DeformedShell
        clippingPlanes={clippingPlanes}
        color="#67e8f9"
        innerRadius={Math.max(0.52, 0.92 - wallOccupancy * 0.267)}
        opacity={0.78}
        outerRadius={STENT_RADIUS}
        pose={pose}
      />
      {rings.map((points, index) => (
        <Line key={`ring-${index}`} color="#164e63" lineWidth={1.8} points={points} />
      ))}
      {ridges.map((points, index) => (
        <Line key={`ridge-${index}`} color="#0e7490" lineWidth={1.25} points={points} />
      ))}
    </group>
  )
}

function MetallicScaffold({
  architectureId,
  clippingPlanes,
  pose,
  showCover,
  wallOccupancy = 0.75,
}: {
  architectureId: StentExplorerArchitectureId
  clippingPlanes: readonly THREE.Plane[]
  pose: StentExplorerPose
  showCover: boolean
  wallOccupancy?: number
}) {
  const profile = getStentExplorerArchitectureProfile(architectureId)
  const paths = useMemo(
    () => buildExplorerScaffoldPaths(architectureId, pose),
    [architectureId, pose],
  )
  const coverLength = profile.coverage === 'partially-covered' ? STENT_LENGTH * 0.6 : STENT_LENGTH
  const baseWireColor = profile.materialBehavior === 'balloon-set' ? '#f8fafc' : '#c4b5fd'
  const wireColors = {
    'wire-a': baseWireColor,
    'wire-b': '#7dd3fc',
    capture: '#fbbf24',
    connector: '#fb7185',
    'single-wire': '#a7f3d0',
    'silicone-ridge': '#67e8f9',
  } as const

  return (
    <group>
      {architectureHasCover(architectureId) && showCover ? (
        <DeformedShell
          clippingPlanes={clippingPlanes}
          color="#bae6fd"
          innerRadius={Math.min(0.94, 0.97 - wallOccupancy * 0.08)}
          length={coverLength}
          opacity={Math.max(0.16, 0.32 - pose.coverFailure * 0.13)}
          outerRadius={0.96}
          pose={pose}
        />
      ) : null}
      {paths.map((path) => (
        <Line
          key={path.id}
          color={wireColors[path.role]}
          lineWidth={Math.min(2.35, 1.05 + path.radius * 10)}
          points={path.points}
        />
      ))}
    </group>
  )
}

function createCylinderBetween(start: THREE.Vector3, end: THREE.Vector3, radius: number) {
  const direction = end.clone().sub(start)
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 38, 10, true)
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  )
  geometry.translate((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5)
  return geometry
}

function Limb({
  clippingPlanes,
  color,
  end,
  opacity,
  radius,
  start,
  wireframe = false,
}: {
  clippingPlanes: readonly THREE.Plane[]
  color: string
  end: THREE.Vector3
  opacity: number
  radius: number
  start: THREE.Vector3
  wireframe?: boolean
}) {
  const geometry = useMemo(() => createCylinderBetween(start, end, radius), [end, radius, start])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        clearcoat={0.25}
        clipShadows
        clippingPlanes={[...clippingPlanes]}
        color={color}
        depthWrite={opacity > 0.7}
        opacity={opacity}
        roughness={0.45}
        side={THREE.DoubleSide}
        transparent={opacity < 1}
        wireframe={wireframe}
      />
    </mesh>
  )
}

function YAirway({ clippingPlanes }: { clippingPlanes: readonly THREE.Plane[] }) {
  const junction = useMemo(() => new THREE.Vector3(0, -0.18, 0), [])
  const top = useMemo(() => new THREE.Vector3(0, 3, 0), [])
  const left = useMemo(() => new THREE.Vector3(-2, -2.65, 0), [])
  const right = useMemo(() => new THREE.Vector3(2, -2.65, 0), [])

  return (
    <group>
      <Limb
        clippingPlanes={clippingPlanes}
        color="#fb7185"
        end={top}
        opacity={0.13}
        radius={1.18}
        start={junction}
      />
      <Limb
        clippingPlanes={clippingPlanes}
        color="#fb7185"
        end={left}
        opacity={0.13}
        radius={0.92}
        start={junction}
      />
      <Limb
        clippingPlanes={clippingPlanes}
        color="#fb7185"
        end={right}
        opacity={0.13}
        radius={0.92}
        start={junction}
      />
    </group>
  )
}

function YScaffold({
  architectureId,
  clippingPlanes,
  modifiers,
  pose,
}: {
  architectureId: StentExplorerArchitectureId
  clippingPlanes: readonly THREE.Plane[]
  modifiers?: StentMechanicsModifiers
  pose: StentExplorerPose
}) {
  const junction = useMemo(() => new THREE.Vector3(0, -0.15, 0), [])
  const top = useMemo(() => new THREE.Vector3(0, 2.55, 0), [])
  const branchSpread = 1.35 + (modifiers?.branchAngleMismatch ?? 0.5) * 0.65
  const distalReach = -2 - (modifiers?.distalOrificeCompromise ?? 0.25) * 0.55
  const left = useMemo(() => new THREE.Vector3(-branchSpread, -2.28, 0), [branchSpread])
  const right = useMemo(
    () => new THREE.Vector3(branchSpread, distalReach, 0),
    [branchSpread, distalReach],
  )
  const deployed = deploymentScale(pose)
  const rightScale = 1 - pose.branchCompromise * 0.28
  const metallic = architectureId === 'metallic-y'
  const color = architectureId === 'dynamic-y' ? '#5eead4' : metallic ? '#cbd5e1' : '#67e8f9'
  const opacity = metallic ? 0.92 : 0.72

  return (
    <group
      position={[
        (modifiers?.saddleMismatch ?? 0.25) * 0.34,
        (modifiers?.saddleMismatch ?? 0.25) * 0.12,
        0,
      ]}
    >
      <Limb
        clippingPlanes={clippingPlanes}
        color={color}
        end={top}
        opacity={opacity}
        radius={0.83 * deployed}
        start={junction}
        wireframe={metallic}
      />
      <Limb
        clippingPlanes={clippingPlanes}
        color={color}
        end={left}
        opacity={opacity}
        radius={0.66 * deployed}
        start={junction}
        wireframe={metallic}
      />
      <Limb
        clippingPlanes={clippingPlanes}
        color={color}
        end={right}
        opacity={opacity}
        radius={0.66 * deployed * rightScale}
        start={junction}
        wireframe={metallic}
      />
      {architectureId === 'dynamic-y' ? (
        <mesh position={[-0.72 - pose.posteriorMotion * 0.16, 0.82, -0.36]} rotation={[0, 0.2, 0]}>
          <planeGeometry args={[1.18, 2.2, 12, 12]} />
          <meshStandardMaterial
            color="#facc15"
            opacity={0.28 + pose.posteriorMotion * 0.2}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  )
}

function StraightAirway({
  clippingPlanes,
  modifiers,
  pose,
  stationId,
}: {
  clippingPlanes: readonly THREE.Plane[]
  modifiers?: StentMechanicsModifiers
  pose: StentExplorerPose
  stationId: StentExplorerStationId
}) {
  const airwayPose = useMemo<StentExplorerPose>(
    () => getStentExplorerAirwayPose(stationId, pose, modifiers),
    [modifiers, pose, stationId],
  )

  return (
    <DeformedShell
      clippingPlanes={clippingPlanes}
      color="#fb7185"
      innerRadius={AIRWAY_RADIUS - 0.08}
      opacity={0.12}
      outerRadius={AIRWAY_RADIUS}
      pose={airwayPose}
    />
  )
}

function MucusOverlay({
  amount,
  pocketLocation = 0.75,
}: {
  amount: number
  pocketLocation?: number
}) {
  if (amount <= 0.01) return null

  return (
    <group
      position={[pocketLocation * 0.38, -0.55 - pocketLocation * 0.34, 0.82 - pocketLocation * 0.3]}
      scale={0.35 + amount * 0.75}
    >
      {[
        [-0.45, -0.2, 0],
        [-0.05, 0.05, 0.08],
        [0.35, -0.08, -0.04],
        [0.02, 0.38, 0.02],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <sphereGeometry args={[0.34 + (index % 2) * 0.08, 20, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.55}
            color="#f59e0b"
            opacity={0.82}
            roughness={0.35}
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}

function GranulationOverlay({ amount, atTop = true }: { amount: number; atTop?: boolean }) {
  if (amount <= 0.01) return null

  return (
    <group position={[0, atTop ? 2.16 : -2.16, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
      <mesh scale={[1, 1, 0.72 + amount * 0.28]}>
        <torusGeometry args={[0.78, 0.06 + amount * 0.26, 20, 72]} />
        <meshPhysicalMaterial color="#e11d48" roughness={0.72} />
      </mesh>
    </group>
  )
}

function TumorOverlay({
  ingrowth,
  ingrowthAtExposedEnd,
  overgrowth,
}: {
  ingrowth: number
  ingrowthAtExposedEnd: boolean
  overgrowth: number
}) {
  return (
    <group>
      {ingrowth > 0.01 ? (
        <group
          position={[0.9, ingrowthAtExposedEnd ? 1.84 : 0.15, 0]}
          scale={0.35 + ingrowth * 0.9}
        >
          {[
            [0, 0, 0],
            [-0.18, 0.26, 0.12],
            [-0.22, -0.28, -0.08],
            [-0.42, 0.02, 0.18],
          ].map((position, index) => (
            <mesh key={index} position={position as [number, number, number]}>
              <sphereGeometry args={[0.28 + (index % 2) * 0.06, 18, 12]} />
              <meshStandardMaterial color="#a21caf" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ) : null}
      <GranulationOverlay amount={overgrowth} />
    </group>
  )
}

function IntegrityFailureOverlay({
  coverFailure,
  fracture,
}: {
  coverFailure: number
  fracture: number
}) {
  return (
    <group>
      {fracture > 0.01 ? (
        <group position={[0.95, 0.1, 0]}>
          <mesh scale={0.11 + fracture * 0.16}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <Line
            color="#fecaca"
            lineWidth={3}
            points={[new THREE.Vector3(-0.18, -0.35, 0), new THREE.Vector3(0.02, -0.12, 0)]}
          />
          <Line
            color="#fecaca"
            lineWidth={3}
            points={[new THREE.Vector3(0.2, 0.15, 0), new THREE.Vector3(0.42, 0.42, 0)]}
          />
        </group>
      ) : null}
      {coverFailure > 0.01 ? (
        <group
          position={[0, 0.18, 0.96]}
          rotation={[0.15, 0, 0]}
          scale={0.45 + coverFailure * 0.65}
        >
          <mesh position={[-0.28, 0, 0]} rotation={[0, -0.28, 0]}>
            <planeGeometry args={[0.48, 1.25]} />
            <meshStandardMaterial
              color="#fdba74"
              opacity={0.72}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          <mesh position={[0.3, 0.05, 0.06]} rotation={[0, 0.34, 0]}>
            <planeGeometry args={[0.48, 1.18]} />
            <meshStandardMaterial
              color="#fdba74"
              opacity={0.72}
              side={THREE.DoubleSide}
              transparent
            />
          </mesh>
          <Line
            color="#f97316"
            lineWidth={3}
            points={[
              new THREE.Vector3(0, -0.62, 0.04),
              new THREE.Vector3(-0.08, -0.2, 0.1),
              new THREE.Vector3(0.08, 0.18, 0.08),
              new THREE.Vector3(0, 0.63, 0.05),
            ]}
          />
        </group>
      ) : null}
    </group>
  )
}

function MigrationGuides({ amount }: { amount: number }) {
  if (amount <= 0.01) return null

  return (
    <group>
      {[-1.8, 1.8].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
          <torusGeometry args={[AIRWAY_RADIUS * 1.04, 0.025, 8, 72]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ))}
      <Line
        color="#facc15"
        dashed
        dashSize={0.16}
        gapSize={0.1}
        lineWidth={2}
        points={[
          new THREE.Vector3(-1.55, 0.15, 0),
          new THREE.Vector3(-1.55, 0.15 + amount * 1.25, 0),
        ]}
      />
    </group>
  )
}

function BranchCompromiseOverlay({ amount, isY }: { amount: number; isY: boolean }) {
  if (amount <= 0.01) return null
  return (
    <group
      position={isY ? [1.45, -1.98, 0] : [0.62, -2.15, 0.45]}
      rotation={isY ? [0, 0, -0.68] : [Math.PI * 0.5, 0, 0]}
      scale={0.2 + amount * 0.75}
    >
      <mesh>
        <sphereGeometry args={[0.55, 24, 16]} />
        <meshStandardMaterial color="#f59e0b" opacity={0.84} roughness={0.62} transparent />
      </mesh>
    </group>
  )
}

function DeploymentOverlay({ amount, isY }: { amount: number; isY: boolean }) {
  if (amount >= 0.995) return null
  const withdrawal = amount * 2.5
  return (
    <group position={isY ? [0, 0.8 + withdrawal, 0] : [0, -0.25 + withdrawal, 0]}>
      <mesh>
        <cylinderGeometry args={[isY ? 1 : 1.22, isY ? 1 : 1.22, 2.6, 48, 1, true]} />
        <meshPhysicalMaterial
          color="#64748b"
          metalness={0.42}
          opacity={0.62}
          roughness={0.3}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
      <mesh position={[0, -1.35, 0]} rotation={[Math.PI * 0.5, 0, 0]}>
        <torusGeometry args={[isY ? 1 : 1.22, 0.06, 10, 64]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  )
}

function PosteriorMotionGuide({ amount }: { amount: number }) {
  if (amount <= 0.01) return null
  return (
    <Line
      color="#facc15"
      dashed
      dashSize={0.12}
      gapSize={0.08}
      lineWidth={2}
      points={[
        new THREE.Vector3(-0.98, 0.95, -0.48),
        new THREE.Vector3(-0.98 - amount * 0.42, 0.95, -0.48),
      ]}
    />
  )
}

function HotspotMarkers({ hotspots }: { hotspots: readonly StentExplorerHotspot[] }) {
  return (
    <group>
      {hotspots.map((hotspot, index) => {
        const [offsetX, offsetY] = HOTSPOT_LABEL_OFFSETS[index % HOTSPOT_LABEL_OFFSETS.length]

        return (
          <group key={hotspot.id} position={[...hotspot.position]}>
            <mesh>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshBasicMaterial color="#fde047" depthTest={false} />
            </mesh>
            <Html center distanceFactor={7.5} zIndexRange={[30, 10]}>
              <span
                aria-hidden="true"
                className="pointer-events-none inline-block whitespace-nowrap rounded-full border border-amber-200/60 bg-slate-950/90 px-2 py-1 text-[10px] font-bold text-amber-100 shadow-lg backdrop-blur"
                style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
              >
                {index + 1}. {hotspot.label}
              </span>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function CameraAndControls({
  cameraCommand,
  isY,
  viewMode,
}: {
  cameraCommand?: StentExplorerCameraCommand
  isY: boolean
  viewMode: StentExplorerViewMode
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastCommandIdRef = useRef(0)
  const { camera, invalidate } = useThree()
  const target = useMemo<[number, number, number]>(() => [0, isY ? -0.15 : 0, 0], [isY])

  const applyPreset = useCallback(() => {
    const controls = controlsRef.current
    if (viewMode === 'endoscopic') {
      camera.position.set(0, -3.65, 0.08)
      camera.lookAt(0, 2.4, 0)
      if (camera instanceof THREE.PerspectiveCamera) camera.setFocalLength(12)
    } else if (viewMode === 'cutaway') {
      camera.position.set(isY ? 7.8 : 6.5, isY ? 1.5 : 1.8, 6.6)
      camera.lookAt(target[0], target[1], target[2])
      if (camera instanceof THREE.PerspectiveCamera) camera.setFocalLength(32)
    } else {
      camera.position.set(isY ? 0.4 : 7.2, isY ? 2.5 : 3.25, isY ? 9.2 : 7.5)
      camera.lookAt(target[0], target[1], target[2])
      if (camera instanceof THREE.PerspectiveCamera) camera.setFocalLength(35)
    }
    camera.updateProjectionMatrix()
    if (controls) {
      if (viewMode === 'endoscopic') controls.target.set(0, 2.4, 0)
      else controls.target.set(target[0], target[1], target[2])
      controls.update()
    }
    invalidate()
  }, [camera, invalidate, isY, target, viewMode])

  useEffect(() => applyPreset(), [applyPreset])

  useEffect(() => {
    if (!cameraCommand || cameraCommand.id === lastCommandIdRef.current) return
    lastCommandIdRef.current = cameraCommand.id
    const controls = controlsRef.current

    if (cameraCommand.action === 'reset' || viewMode === 'endoscopic') {
      applyPreset()
      return
    }

    const focus = controls?.target.clone() ?? new THREE.Vector3(...target)
    if (cameraCommand.action === 'orbit-left' || cameraCommand.action === 'orbit-right') {
      const direction = cameraCommand.action === 'orbit-left' ? 1 : -1
      const offset = camera.position.clone().sub(focus)
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * 0.2)
      camera.position.copy(focus.clone().add(offset))
    } else {
      camera.updateMatrixWorld()
      const direction = cameraCommand.action === 'pan-left' ? -1 : 1
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      right.normalize().multiplyScalar(direction * 0.32)
      camera.position.add(right)
      focus.add(right)
      if (controls) controls.target.copy(focus)
    }

    camera.lookAt(focus)
    camera.updateProjectionMatrix()
    controls?.update()
    invalidate()
  }, [applyPreset, camera, cameraCommand, invalidate, target, viewMode])

  const endoscopic = viewMode === 'endoscopic'
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping={!endoscopic}
      enablePan={!endoscopic}
      enableRotate={!endoscopic}
      enableZoom={!endoscopic}
      makeDefault
      maxDistance={14}
      minDistance={3.8}
      screenSpacePanning
      target={endoscopic ? [0, 2.4, 0] : target}
    />
  )
}

function WebGLContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost)
  }, [gl, onContextLost])

  return null
}

function SceneInvalidator({ signature }: { signature: string }) {
  const { invalidate } = useThree()
  useEffect(() => invalidate(), [invalidate, signature])
  return null
}

export function StentExplorerScene({
  architectureId,
  cameraCommand,
  modifiers,
  onContextLost,
  playing,
  pose,
  reducedMotion,
  showHotspots,
  station,
  viewMode,
}: SceneProps) {
  const isY = architectureIsY(architectureId)
  const cutaway = viewMode === 'cutaway'
  const visualPose = useMemo<StentExplorerPose>(() => {
    if (station.id === 'deploy-rescue') return pose
    if (station.id === 'architecture-lumen') {
      return { ...pose, airwayCompression: 0, deployment: 1, radialCompression: 0 }
    }
    return { ...pose, deployment: 1 }
  }, [pose, station.id])
  const clippingPlanes = useMemo(
    () => (cutaway ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.06)] : []),
    [cutaway],
  )
  const migrationDirection =
    (modifiers?.proximalDisplacement ?? 0) > (modifiers?.distalDisplacement ?? 0) ? -1 : 1
  const translationY =
    visualPose.migration * 1.22 * migrationDirection + visualPose.axialExcursion * 0.62
  const controlAllowsHotspots =
    station.id === 'metal-architecture'
      ? (modifiers?.structuralHotspot ?? 1) > 0
      : station.id === 'cough-motion'
        ? (modifiers?.endTracking ?? 1) > 0
        : station.id === 'curve-buckle'
          ? (modifiers?.focalContact ?? 1) > 0
          : station.id === 'migration'
            ? (modifiers?.landmarkTracking ?? 1) > 0
            : station.id === 'fracture-cover-failure'
              ? (modifiers?.structuralHotspot ?? 1) > 0
              : station.id === 'deploy-rescue'
                ? (modifiers?.inspectionReveal ?? 1) > 0
                : true
  const signature = `${station.id}:${architectureId}:${viewMode}:${showHotspots}:${playing}:${reducedMotion}:${Object.values(visualPose).join(',')}:${Object.values(modifiers ?? {}).join(',')}`

  return (
    <>
      <WebGLContextGuard onContextLost={onContextLost} />
      <SceneInvalidator signature={signature} />
      <CameraAndControls cameraCommand={cameraCommand} isY={isY} viewMode={viewMode} />

      {isY ? (
        <YAirway clippingPlanes={clippingPlanes} />
      ) : (
        <StraightAirway
          clippingPlanes={clippingPlanes}
          modifiers={modifiers}
          pose={visualPose}
          stationId={station.id}
        />
      )}

      <group position={[0, translationY, 0]}>
        {isY ? (
          <YScaffold
            architectureId={architectureId}
            clippingPlanes={clippingPlanes}
            modifiers={modifiers}
            pose={visualPose}
          />
        ) : architectureIsSilicone(architectureId) ? (
          <SiliconeScaffold
            clippingPlanes={clippingPlanes}
            pose={visualPose}
            wallOccupancy={modifiers?.wallOccupancy}
          />
        ) : (
          <MetallicScaffold
            architectureId={architectureId}
            clippingPlanes={clippingPlanes}
            pose={visualPose}
            showCover={station.id !== 'metal-architecture' || (modifiers?.coverInspection ?? 1) > 0}
            wallOccupancy={modifiers?.wallOccupancy}
          />
        )}
      </group>

      <MucusOverlay amount={visualPose.mucus} pocketLocation={modifiers?.retentionPocket} />
      <GranulationOverlay amount={visualPose.granulation} />
      <TumorOverlay
        ingrowth={visualPose.tumorIngrowth}
        ingrowthAtExposedEnd={(modifiers?.exposedEndIngrowth ?? 0) > 0}
        overgrowth={visualPose.tumorOvergrowth}
      />
      <IntegrityFailureOverlay
        coverFailure={visualPose.coverFailure}
        fracture={visualPose.fracture}
      />
      <MigrationGuides amount={visualPose.migration} />
      <BranchCompromiseOverlay amount={visualPose.branchCompromise} isY={isY} />
      {isY ? <PosteriorMotionGuide amount={visualPose.posteriorMotion} /> : null}
      {station.id === 'deploy-rescue' ? (
        <DeploymentOverlay amount={visualPose.deployment} isY={isY} />
      ) : null}
      {showHotspots && controlAllowsHotspots ? (
        <HotspotMarkers hotspots={getStationHotspots(station, architectureId)} />
      ) : null}
    </>
  )
}
