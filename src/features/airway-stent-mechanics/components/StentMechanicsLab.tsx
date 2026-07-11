'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  TubeGeometry,
  Vector3,
  type Group,
} from 'three'

import { CanvasErrorBoundary } from '@/components/airway-anatomy-lesson/CanvasErrorBoundary'
import { Button } from '@/components/ui/button'
import { getStentArchitecturePreset } from '@/features/airway-stent-mechanics/content/stentProfiles'
import type {
  AirwayGeometryId,
  LoadMode,
  MechanicsInputs,
  MechanicsProfile,
  StentArchitecturePreset,
} from '@/features/airway-stent-mechanics/engine/types'
import { cn } from '@/lib/cn'

interface StentMechanicsLabProps {
  inputs: MechanicsInputs
  profile: MechanicsProfile
}

function createCenterline(geometry: AirwayGeometryId, curvaturePercent: number) {
  const bend = MathUtils.clamp(curvaturePercent / 100, 0, 1) * 2.25

  if (geometry === 'curved') {
    return new CatmullRomCurve3([
      new Vector3(-bend * 0.44, -3, 0),
      new Vector3(-bend * 0.34, -1.6, 0),
      new Vector3(-bend * 0.05, -0.2, 0.04),
      new Vector3(bend * 0.45, 1.35, 0.02),
      new Vector3(bend * 0.73, 3, -0.05),
    ])
  }

  return new CatmullRomCurve3([
    new Vector3(0, -3, 0),
    new Vector3(0, -1.5, 0),
    new Vector3(0, 0, 0),
    new Vector3(0, 1.5, 0),
    new Vector3(0, 3, 0),
  ])
}

function createVariableTubeGeometry({
  path,
  radialSegments = 48,
  tubularSegments = 120,
  radiusAt,
}: {
  path: CatmullRomCurve3
  radialSegments?: number
  tubularSegments?: number
  radiusAt: (t: number) => { x: number; z: number }
}) {
  const geometry = new BufferGeometry()
  const frames = path.computeFrenetFrames(tubularSegments, false)
  const vertices: number[] = []
  const indices: number[] = []

  for (let segment = 0; segment <= tubularSegments; segment += 1) {
    const t = segment / tubularSegments
    const center = path.getPointAt(t)
    const radius = radiusAt(t)
    const normal = frames.normals[Math.min(segment, frames.normals.length - 1)]
    const binormal = frames.binormals[Math.min(segment, frames.binormals.length - 1)]

    for (let side = 0; side <= radialSegments; side += 1) {
      const angle = (side / radialSegments) * Math.PI * 2
      const point = center
        .clone()
        .addScaledVector(normal, Math.cos(angle) * radius.x)
        .addScaledVector(binormal, Math.sin(angle) * radius.z)
      vertices.push(point.x, point.y, point.z)
    }
  }

  const row = radialSegments + 1
  for (let segment = 0; segment < tubularSegments; segment += 1) {
    for (let side = 0; side < radialSegments; side += 1) {
      const a = segment * row + side
      const b = (segment + 1) * row + side
      const c = (segment + 1) * row + side + 1
      const d = segment * row + side + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRingCurve(
  path: CatmullRomCurve3,
  t: number,
  radius: number,
  waveAmplitude = 0,
  cells = 8,
) {
  const frames = path.computeFrenetFrames(120, false)
  const frameIndex = Math.round(t * 120)
  const center = path.getPointAt(t)
  const normal = frames.normals[frameIndex]
  const binormal = frames.binormals[frameIndex]
  const tangent = frames.tangents[frameIndex]
  const points = Array.from({ length: 64 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2
    return center
      .clone()
      .addScaledVector(normal, Math.cos(angle) * radius)
      .addScaledVector(binormal, Math.sin(angle) * radius)
      .addScaledVector(tangent, Math.sin(angle * cells) * waveAmplitude)
  })
  return new CatmullRomCurve3(points, true, 'centripetal')
}

function createOffsetLongitudinalCurve(
  path: CatmullRomCurve3,
  angle: number,
  radius: number,
  phaseShift = 0,
) {
  const steps = 100
  const frames = path.computeFrenetFrames(steps, false)
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const center = path.getPointAt(t)
    const localAngle = angle + Math.sin((t * 8 + phaseShift) * Math.PI) * 0.08
    return center
      .clone()
      .addScaledVector(frames.normals[index], Math.cos(localAngle) * radius)
      .addScaledVector(frames.binormals[index], Math.sin(localAngle) * radius)
  })
  return new CatmullRomCurve3(points)
}

function createHelixCurve({
  path,
  phase,
  radius,
  turns,
  direction,
}: {
  path: CatmullRomCurve3
  phase: number
  radius: number
  turns: number
  direction: -1 | 1
}) {
  const steps = 140
  const frames = path.computeFrenetFrames(steps, false)
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps
    const angle = phase + direction * t * turns * Math.PI * 2
    return path
      .getPointAt(t)
      .addScaledVector(frames.normals[index], Math.cos(angle) * radius)
      .addScaledVector(frames.binormals[index], Math.sin(angle) * radius)
  })
  return new CatmullRomCurve3(points)
}

function AirwaySurface({
  geometry,
  path,
  asymmetryPercent,
}: {
  geometry: AirwayGeometryId
  path: CatmullRomCurve3
  asymmetryPercent: number
}) {
  const airwayGeometry = useMemo(
    () =>
      createVariableTubeGeometry({
        path,
        radiusAt: (t) => {
          if (geometry === 'tapered') {
            const radius = 1.58 - t * 0.42
            return { x: radius, z: radius }
          }
          if (geometry === 'asymmetric') {
            const focal = Math.exp(-((t - 0.52) ** 2) / 0.035)
            const compression = focal * MathUtils.clamp(asymmetryPercent / 100, 0.15, 1)
            return { x: 1.5 - compression * 0.5, z: 1.5 - compression * 0.13 }
          }
          return { x: 1.5, z: 1.5 }
        },
      }),
    [asymmetryPercent, geometry, path],
  )

  return (
    <mesh geometry={airwayGeometry}>
      <meshPhysicalMaterial
        color="#c98f89"
        depthWrite={false}
        opacity={0.2}
        roughness={0.76}
        side={DoubleSide}
        transparent
      />
    </mesh>
  )
}

function SiliconeModel({
  path,
  preset,
  radius,
  structureScale,
}: {
  path: CatmullRomCurve3
  preset: StentArchitecturePreset
  radius: number
  structureScale: number
}) {
  const dynamic = preset.id === 'dynamic-silicone'
  const wall = useMemo(
    () =>
      createVariableTubeGeometry({
        path,
        radialSegments: 56,
        radiusAt: () => ({ x: radius, z: radius * (dynamic ? 0.88 : 1) }),
      }),
    [dynamic, path, radius],
  )
  const rings = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const curve = createRingCurve(path, 0.06 + index * 0.098, radius * 1.02)
        return new TubeGeometry(curve, 64, 0.045 * structureScale, 8, true)
      }),
    [path, radius, structureScale],
  )

  return (
    <group>
      <mesh geometry={wall}>
        <meshPhysicalMaterial
          color={dynamic ? '#62d4c7' : '#67b7e5'}
          clearcoat={0.42}
          depthWrite={false}
          opacity={0.48}
          roughness={0.3}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {rings.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={dynamic ? '#31b9aa' : '#2b91c8'} roughness={0.36} />
        </mesh>
      ))}
    </group>
  )
}

function BraidedModel({
  path,
  preset,
  radius,
  structureScale,
  braidAngleDeg,
}: {
  path: CatmullRomCurve3
  preset: StentArchitecturePreset
  radius: number
  structureScale: number
  braidAngleDeg: number
}) {
  const wirePairs = preset.id === 'single-wire-knit' ? 4 : 7
  const turns = MathUtils.mapLinear(braidAngleDeg, 35, 70, 3.4, 6.8)
  const wireRadius = 0.024 * structureScale
  const wires = useMemo(() => {
    const geometries: TubeGeometry[] = []
    for (let index = 0; index < wirePairs; index += 1) {
      const phase = (index / wirePairs) * Math.PI * 2
      for (const direction of [-1, 1] as const) {
        const curve = createHelixCurve({ path, phase, radius, turns, direction })
        geometries.push(new TubeGeometry(curve, 140, wireRadius, 6, false))
      }
    }
    return geometries
  }, [path, radius, turns, wirePairs, wireRadius])
  const cover = useMemo(
    () =>
      preset.isCovered
        ? createVariableTubeGeometry({
            path,
            radialSegments: 56,
            radiusAt: () => ({ x: radius * 1.012, z: radius * 1.012 }),
          })
        : null,
    [path, preset.isCovered, radius],
  )

  return (
    <group>
      {wires.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial
            color={index % 2 === 0 ? '#dbeafe' : '#8bc9e8'}
            metalness={0.72}
            roughness={0.22}
          />
        </mesh>
      ))}
      {cover ? (
        <mesh geometry={cover}>
          <meshPhysicalMaterial
            color="#7dd3c7"
            depthWrite={false}
            opacity={0.22}
            roughness={0.34}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  )
}

function LaserCutModel({
  path,
  radius,
  structureScale,
}: {
  path: CatmullRomCurve3
  radius: number
  structureScale: number
}) {
  const geometries = useMemo(() => {
    const result: TubeGeometry[] = []
    const ringTs = Array.from({ length: 9 }, (_, index) => 0.06 + index * 0.11)
    for (const t of ringTs) {
      result.push(
        new TubeGeometry(
          createRingCurve(path, t, radius, 0.095, 8),
          80,
          0.035 * structureScale,
          6,
          true,
        ),
      )
    }
    for (let index = 0; index < 8; index += 1) {
      const curve = createOffsetLongitudinalCurve(
        path,
        (index / 8) * Math.PI * 2,
        radius,
        index / 8,
      )
      result.push(new TubeGeometry(curve, 100, 0.031 * structureScale, 6, false))
    }
    return result
  }, [path, radius, structureScale])

  return (
    <group>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color="#cbd5e1" metalness={0.78} roughness={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function createYPaths() {
  return [
    new CatmullRomCurve3([
      new Vector3(0, -2.8, 0),
      new Vector3(0, -1.45, 0),
      new Vector3(0, -0.25, 0),
      new Vector3(0, 0.15, 0),
    ]),
    new CatmullRomCurve3([
      new Vector3(-0.02, 0.05, 0),
      new Vector3(-0.38, 0.55, 0.02),
      new Vector3(-0.95, 1.35, 0.12),
      new Vector3(-1.62, 2.45, 0.22),
    ]),
    new CatmullRomCurve3([
      new Vector3(0.02, 0.05, 0),
      new Vector3(0.42, 0.48, -0.02),
      new Vector3(1.05, 1.15, -0.12),
      new Vector3(1.78, 2.15, -0.28),
    ]),
  ]
}

function YModel({
  patientSpecific,
  structureScale,
}: {
  patientSpecific: boolean
  structureScale: number
}) {
  const paths = useMemo(() => createYPaths(), [])
  const airwayGeometries = useMemo(
    () =>
      paths.map((path, index) =>
        createVariableTubeGeometry({
          path,
          tubularSegments: 72,
          radiusAt: (t) => {
            const base = index === 0 ? 1.2 : index === 1 ? 0.92 : 0.86
            const taper = patientSpecific ? 1 - t * (index === 0 ? 0.08 : 0.18) : 1
            return { x: base * taper, z: base * taper }
          },
        }),
      ),
    [paths, patientSpecific],
  )
  const stentGeometries = useMemo(
    () =>
      paths.map((path, index) =>
        createVariableTubeGeometry({
          path,
          tubularSegments: 72,
          radiusAt: (t) => {
            const base = index === 0 ? 1.02 : index === 1 ? 0.76 : 0.72
            const taper = patientSpecific ? 1 - t * (index === 0 ? 0.04 : 0.14) : 1
            return { x: base * taper, z: base * taper }
          },
        }),
      ),
    [paths, patientSpecific],
  )
  const rings = useMemo(
    () =>
      paths.flatMap((path, pathIndex) =>
        Array.from({ length: pathIndex === 0 ? 6 : 4 }, (_, index) => {
          const t = 0.12 + index * (pathIndex === 0 ? 0.15 : 0.22)
          const radius = pathIndex === 0 ? 1.03 : pathIndex === 1 ? 0.77 : 0.73
          return new TubeGeometry(
            createRingCurve(path, t, radius),
            56,
            0.04 * structureScale,
            7,
            true,
          )
        }),
      ),
    [paths, structureScale],
  )

  return (
    <group>
      {airwayGeometries.map((geometry, index) => (
        <mesh key={`airway-${index}`} geometry={geometry}>
          <meshPhysicalMaterial
            color="#c98f89"
            depthWrite={false}
            opacity={0.18}
            roughness={0.76}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
      {stentGeometries.map((geometry, index) => (
        <mesh key={`stent-${index}`} geometry={geometry}>
          <meshPhysicalMaterial
            color={patientSpecific ? '#65d6bd' : '#67b7e5'}
            clearcoat={0.42}
            depthWrite={false}
            opacity={0.46}
            roughness={0.3}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
      {rings.map((geometry, index) => (
        <mesh key={`ring-${index}`} geometry={geometry}>
          <meshStandardMaterial color={patientSpecific ? '#2db7a0' : '#2b91c8'} roughness={0.34} />
        </mesh>
      ))}
    </group>
  )
}

function LoadAnimatedGroup({
  active,
  children,
  loadMode,
  reducedMotion,
  rotating,
}: {
  active: boolean
  children: React.ReactNode
  loadMode: LoadMode
  reducedMotion: boolean
  rotating: boolean
}) {
  const group = useRef<Group>(null)

  useFrame((state, delta) => {
    if (!group.current) return
    const time = state.clock.elapsedTime
    let radialTarget = 1
    let axialTarget = 0
    let bendTarget = 0

    if (active && loadMode === 'breathing') {
      radialTarget = 0.965 + Math.sin(time * 2.3) * 0.025
    } else if (active && loadMode === 'cough') {
      const pulse = Math.max(0, Math.sin(time * 5.8)) ** 8
      radialTarget = 1 - pulse * 0.16
      bendTarget = pulse * 0.045
    } else if (active && loadMode === 'migration') {
      axialTarget = Math.sin(time * 2.2) * 0.15
    } else if (reducedMotion) {
      radialTarget = loadMode === 'cough' ? 0.9 : loadMode === 'breathing' ? 0.98 : 1
      axialTarget = loadMode === 'migration' ? 0.08 : 0
      bendTarget = loadMode === 'cough' ? 0.025 : 0
    }

    if (reducedMotion) {
      group.current.scale.set(radialTarget, 1, radialTarget)
      group.current.position.y = axialTarget
      group.current.rotation.z = bendTarget
    } else {
      group.current.scale.x = MathUtils.damp(group.current.scale.x, radialTarget, 9, delta)
      group.current.scale.z = MathUtils.damp(group.current.scale.z, radialTarget, 9, delta)
      group.current.position.y = MathUtils.damp(group.current.position.y, axialTarget, 8, delta)
      group.current.rotation.z = MathUtils.damp(group.current.rotation.z, bendTarget, 8, delta)
      if (rotating) group.current.rotation.y += delta * 0.1
    }
  })

  return <group ref={group}>{children}</group>
}

function RelativeStressHotspots({
  path,
  profile,
}: {
  path: CatmullRomCurve3
  profile: MechanicsProfile
}) {
  const intensity = MathUtils.clamp(profile.chronicContactIndex / 100, 0.12, 1)
  const color = useMemo(
    () => new Color('#ef4444').lerp(new Color('#f59e0b'), 1 - intensity),
    [intensity],
  )
  const points = [path.getPointAt(0.05), path.getPointAt(0.95)]

  return (
    <group>
      {points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.17 + intensity * 0.09, 24, 16]} />
          <meshBasicMaterial color={color} opacity={0.25 + intensity * 0.48} transparent />
        </mesh>
      ))}
    </group>
  )
}

function Scene({
  active,
  inputs,
  loadMode,
  profile,
  reducedMotion,
  rotating,
}: {
  active: boolean
  inputs: MechanicsInputs
  loadMode: LoadMode
  profile: MechanicsProfile
  reducedMotion: boolean
  rotating: boolean
}) {
  const width = useThree((state) => state.size.width)
  const compact = width < 620
  const preset = getStentArchitecturePreset(inputs.architectureId)
  const path = useMemo(
    () => createCenterline(inputs.airwayGeometry, inputs.curvaturePercent),
    [inputs.airwayGeometry, inputs.curvaturePercent],
  )
  const oversizeRatio = MathUtils.clamp(
    inputs.freeStentDiameterMm / inputs.airwayDiameterMm,
    0.82,
    1.28,
  )
  const stentRadius = 1.24 + (oversizeRatio - 1) * 0.16

  if (preset.renderKind === 'y') {
    return (
      <group position={[0, compact ? -0.18 : 0, 0]} scale={compact ? 0.82 : 0.95}>
        <LoadAnimatedGroup
          active={active}
          loadMode={loadMode}
          reducedMotion={reducedMotion}
          rotating={rotating}
        >
          <YModel
            patientSpecific={preset.id === 'patient-specific-silicone'}
            structureScale={inputs.structureScale}
          />
        </LoadAnimatedGroup>
      </group>
    )
  }

  return (
    <group
      position={[0, compact ? -0.08 : 0, 0]}
      rotation={[0.02, -0.28, -0.03]}
      scale={compact ? 0.86 : 1}
    >
      <AirwaySurface
        asymmetryPercent={inputs.asymmetryPercent}
        geometry={inputs.airwayGeometry}
        path={path}
      />
      <LoadAnimatedGroup
        active={active}
        loadMode={loadMode}
        reducedMotion={reducedMotion}
        rotating={rotating}
      >
        {preset.renderKind === 'silicone' ? (
          <SiliconeModel
            path={path}
            preset={preset}
            radius={stentRadius}
            structureScale={inputs.structureScale}
          />
        ) : preset.renderKind === 'braid' ? (
          <BraidedModel
            braidAngleDeg={inputs.braidAngleDeg}
            path={path}
            preset={preset}
            radius={stentRadius}
            structureScale={inputs.structureScale}
          />
        ) : (
          <LaserCutModel path={path} radius={stentRadius} structureScale={inputs.structureScale} />
        )}
        <RelativeStressHotspots path={path} profile={profile} />
      </LoadAnimatedGroup>
    </group>
  )
}

function TextFallback({ inputs, profile }: StentMechanicsLabProps) {
  const preset = getStentArchitecturePreset(inputs.architectureId)
  return (
    <div className="flex min-h-[470px] flex-col items-center justify-center gap-3 p-8 text-center text-sm leading-6 text-slate-300">
      <p className="font-semibold text-white">The 3D scene is unavailable.</p>
      <p>
        Current model: {preset.label} in a {inputs.airwayGeometry} airway. Relative radial support
        is {profile.radialSupportBand}; chronic contact is {profile.contactBand}; straightening
        tendency is {profile.straighteningBand}; modeled bend-area retention is{' '}
        {profile.areaRetentionPercent}%.
      </p>
      <p>All controls and the full textual interpretation remain available beside the viewer.</p>
    </div>
  )
}

const loadModes: Array<{ id: LoadMode; label: string; description: string }> = [
  { id: 'rest', label: 'Static', description: 'Deployed equilibrium without cyclic motion' },
  { id: 'breathing', label: 'Breathing', description: 'Low-amplitude cyclic radial deformation' },
  {
    id: 'cough',
    label: 'Cough',
    description: 'Short, high-amplitude compression and bending pulse',
  },
  {
    id: 'migration',
    label: 'Micromotion',
    description: 'Submillimeter axial pistoning at the interface',
  },
]

export function StentMechanicsLab({ inputs, profile }: StentMechanicsLabProps) {
  const reducedMotion = Boolean(useReducedMotion())
  const [active, setActive] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [loadMode, setLoadMode] = useState<LoadMode>('rest')
  const [resetVersion, setResetVersion] = useState(0)
  const preset = getStentArchitecturePreset(inputs.architectureId)

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-950 text-white shadow-2xl">
      <div className="border-b border-slate-700/80 px-5 py-4 md:flex md:items-center md:justify-between md:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Conceptual 3D model
          </p>
          <h3 className="mt-1 text-xl font-semibold">{preset.label}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Geometry is normalized for comparison. Color, deformation, and glow are educational—not
            finite-element stress or a device-specific force prediction.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
          {!reducedMotion && loadMode !== 'rest' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => setActive((value) => !value)}
            >
              {active ? (
                <Pause className="h-4 w-4" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {active ? 'Pause load' : 'Animate load'}
            </Button>
          ) : null}
          {!reducedMotion ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => setRotating((value) => !value)}
              aria-pressed={rotating}
            >
              {rotating ? 'Stop rotation' : 'Rotate model'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => {
              setActive(false)
              setRotating(false)
              setLoadMode('rest')
              setResetVersion((value) => value + 1)
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset scene
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.38fr)_minmax(280px,0.62fr)]">
        <div
          className="relative min-h-[500px] border-b border-slate-700/80 lg:min-h-[620px] lg:border-b-0 lg:border-r"
          role="img"
          aria-label={`Interactive conceptual model of ${preset.label} in a ${inputs.airwayGeometry} airway`}
        >
          <p className="sr-only" role="status" aria-live="polite">
            {preset.label}. {loadMode} load. Relative radial support {profile.radialSupportBand},
            chronic contact {profile.contactBand}, migration resistance {profile.migrationBand}, and
            straightening tendency {profile.straighteningBand}.
          </p>
          <CanvasErrorBoundary fallback={<TextFallback inputs={inputs} profile={profile} />}>
            <Canvas
              key={resetVersion}
              dpr={[1, 1.75]}
              camera={{ position: [5.2, 1.15, 7.7], fov: 38, near: 0.01, far: 100 }}
              gl={{ antialias: true, alpha: false }}
            >
              <color attach="background" args={['#06101f']} />
              <fog attach="fog" args={['#06101f', 9, 15]} />
              <ambientLight intensity={0.72} />
              <hemisphereLight args={['#dff5ff', '#142238', 1.25]} />
              <directionalLight position={[4, 6, 7]} intensity={2.1} color="#e0f2fe" />
              <directionalLight position={[-4, 0, 3]} intensity={0.8} color="#38bdf8" />
              <pointLight position={[0, -3, 3]} intensity={0.55} color="#f59e0b" />
              <Scene
                active={active}
                inputs={inputs}
                loadMode={loadMode}
                profile={profile}
                reducedMotion={reducedMotion}
                rotating={rotating}
              />
              <OrbitControls
                makeDefault
                enablePan={false}
                minDistance={5.4}
                maxDistance={11}
                minPolarAngle={0.34}
                maxPolarAngle={2.8}
                target={[0, 0, 0]}
              />
            </Canvas>
          </CanvasErrorBoundary>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-slate-600/80 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
            Drag to orbit · scroll/pinch to zoom
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Load mode
            </p>
            <div className="mt-3 grid gap-2">
              {loadModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setLoadMode(mode.id)
                    setActive(false)
                  }}
                  aria-pressed={loadMode === mode.id}
                  className={cn(
                    'rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none',
                    loadMode === mode.id
                      ? 'border-cyan-300/70 bg-cyan-300/10'
                      : 'border-slate-700 bg-slate-900/70 hover:border-slate-500',
                  )}
                >
                  <span className="block text-sm font-semibold text-white">{mode.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                    {mode.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              What the scene emphasizes
            </p>
            <dl className="mt-3 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-300">Architecture</dt>
                <dd className="text-right font-medium">{preset.family}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-300">Contact loading</dt>
                <dd className="capitalize font-medium">{profile.contactBand}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-300">Straightening</dt>
                <dd className="capitalize font-medium">{profile.straighteningBand}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-300">Bend-area retention</dt>
                <dd className="font-medium">{profile.areaRetentionPercent}% index</dd>
              </div>
            </dl>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            Red-orange end glows represent relative concentration, not measured pressure.
            Reduced-motion preferences convert cyclic modes to static end states.
          </p>
        </div>
      </div>
    </section>
  )
}
