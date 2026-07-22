'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import {
  ProgressiveSplineTube,
  SplineFollower,
  useTrajectoryPlayback,
} from '@/features/cardiac-anatomy/components/CardiacTrajectory'
import {
  IMPELLA_55_ADVANCEMENT_PROGRESS,
  IMPELLA_55_ADVANCEMENT_ROUTE,
  IMPELLA_55_DEVICE_REGISTRATION,
  IMPELLA_55_MODEL_URL,
  IMPELLA_ADVANCEMENT_PROGRESS,
  IMPELLA_ADVANCEMENT_ROUTE,
  IMPELLA_CP_MODEL_URL,
  IMPELLA_DEVICE_REGISTRATION,
  IMPELLA_RP_ADVANCEMENT_PROGRESS,
  IMPELLA_RP_ADVANCEMENT_ROUTE,
  IMPELLA_RP_DEVICE_REGISTRATION,
  IMPELLA_RP_MODEL_URL,
  impella55FlowRouteForProgress,
  impellaFlowRouteForProgress,
  impellaRpFlowRouteForProgress,
  type CardiacPoint3,
} from '@/features/cardiac-anatomy/content/paths'

import type {
  ImpellaDeviceState,
  ImpellaLeftPosition,
  ImpellaSide,
  McsSimulationState,
} from '../../engine'
import { ImpellaBloodFlow } from './ImpellaBloodFlow'
import { createCannulaHelixPoints, smoothImpellaCannulaRoute } from './impellaFlowGeometry'
import { impellaRpEndpointProgress } from './impellaPlacement'

interface ImpellaVisualConfig {
  modelUrl: string
  route: readonly CardiacPoint3[]
  targetProgress: number
  registration: {
    inletLocal: CardiacPoint3
    outletLocal: CardiacPoint3
    modelScale: number
  }
  anchorLocal: CardiacPoint3
  trailingAnchorLocal: CardiacPoint3
  physicalSpanProgress: number
  flowRoute: readonly CardiacPoint3[]
  flowLMin: number
  cannulaColor: string
  cannulaRadius: number
  shaftRadius: number
  reinforcementRings: number
  smoothCannula?: boolean
  cannulaStartProgress?: number
  deploysPigtail?: boolean
  deployedTipScale?: number
  annulusOffsetProgress?: number
  accessConduitEndProgress?: number
}

function leftProgress(position: ImpellaLeftPosition, variant: 'cp' | '55'): number {
  const progress = variant === '55' ? IMPELLA_55_ADVANCEMENT_PROGRESS : IMPELLA_ADVANCEMENT_PROGRESS
  if (position === 'too-deep') return progress.deep
  if (position === 'too-shallow') return progress.tooShallow
  return progress.correct
}

function visualConfig(
  side: ImpellaSide,
  device: ImpellaDeviceState,
  state: McsSimulationState,
): ImpellaVisualConfig {
  if (side === 'right') {
    const endpointProgress = impellaRpEndpointProgress(device.right.position)
    return {
      modelUrl: IMPELLA_RP_MODEL_URL,
      route: IMPELLA_RP_ADVANCEMENT_ROUTE,
      targetProgress: endpointProgress.head,
      registration: IMPELLA_RP_DEVICE_REGISTRATION,
      anchorLocal: IMPELLA_RP_DEVICE_REGISTRATION.outletLocal,
      trailingAnchorLocal: IMPELLA_RP_DEVICE_REGISTRATION.inletLocal,
      physicalSpanProgress:
        IMPELLA_RP_ADVANCEMENT_PROGRESS.correct - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet,
      flowRoute: impellaRpFlowRouteForProgress(endpointProgress.head, endpointProgress.inlet),
      flowLMin: device.right.running ? state.metrics.rightDeviceFlowLMin : 0,
      cannulaColor: '#385a91',
      cannulaRadius: 0.088,
      shaftRadius: 0.044,
      reinforcementRings: 0,
      smoothCannula: true,
      cannulaStartProgress: endpointProgress.inlet,
      deploysPigtail: true,
    }
  }

  const variant = device.left.variant
  const targetProgress = leftProgress(device.left.position, variant)
  if (variant === '55') {
    const physicalSpanProgress =
      IMPELLA_55_ADVANCEMENT_PROGRESS.correct - IMPELLA_55_ADVANCEMENT_PROGRESS.aorticRoot
    return {
      modelUrl: IMPELLA_55_MODEL_URL,
      route: IMPELLA_55_ADVANCEMENT_ROUTE,
      targetProgress,
      registration: IMPELLA_55_DEVICE_REGISTRATION,
      anchorLocal: IMPELLA_55_DEVICE_REGISTRATION.inletLocal,
      trailingAnchorLocal: IMPELLA_55_DEVICE_REGISTRATION.outletLocal,
      physicalSpanProgress,
      flowRoute: impella55FlowRouteForProgress(
        targetProgress,
        Math.max(0, targetProgress - physicalSpanProgress),
      ),
      flowLMin: device.left.running ? state.metrics.leftDeviceFlowLMin : 0,
      cannulaColor: '#86a8ff',
      cannulaRadius: 0.084,
      shaftRadius: 0.036,
      reinforcementRings: 10,
      annulusOffsetProgress:
        IMPELLA_55_ADVANCEMENT_PROGRESS.correct - IMPELLA_55_ADVANCEMENT_PROGRESS.aorticValve,
      accessConduitEndProgress: IMPELLA_55_ADVANCEMENT_PROGRESS.surgicalAccessEnd,
    }
  }

  const physicalSpanProgress =
    IMPELLA_ADVANCEMENT_PROGRESS.correct - IMPELLA_ADVANCEMENT_PROGRESS.aorticRoot
  return {
    modelUrl: IMPELLA_CP_MODEL_URL,
    route: IMPELLA_ADVANCEMENT_ROUTE,
    targetProgress,
    registration: IMPELLA_DEVICE_REGISTRATION,
    anchorLocal: IMPELLA_DEVICE_REGISTRATION.inletLocal,
    trailingAnchorLocal: IMPELLA_DEVICE_REGISTRATION.outletLocal,
    physicalSpanProgress,
    flowRoute: impellaFlowRouteForProgress(
      targetProgress,
      Math.max(0, targetProgress - physicalSpanProgress),
    ),
    flowLMin: device.left.running ? state.metrics.leftDeviceFlowLMin : 0,
    cannulaColor: '#82aaff',
    cannulaRadius: 0.056,
    shaftRadius: 0.036,
    reinforcementRings: 8,
    deploysPigtail: true,
    deployedTipScale:
      device.left.position === 'too-deep' ? 0.8 : device.left.position === 'correct' ? 0.95 : 1,
    annulusOffsetProgress:
      IMPELLA_ADVANCEMENT_PROGRESS.correct - IMPELLA_ADVANCEMENT_PROGRESS.aorticValve,
  }
}

type ImpellaFragment = 'left-distal' | 'left-proximal' | 'right-distal' | 'right-proximal'

interface DeployableMesh {
  mesh: THREE.Mesh
  baseScale: THREE.Vector3
}

interface FragmentClone {
  root: THREE.Group
  deployableMeshes: DeployableMesh[]
}

function fragmentIncludesMesh(fragment: ImpellaFragment, name: string): boolean {
  if (fragment === 'left-distal') {
    return (
      name.includes('DistalPigtail') || name.includes('DistalTip') || name.includes('InletCage')
    )
  }
  if (fragment === 'left-proximal') {
    return (
      name.includes('OutletCage') ||
      name.includes('MotorHousing') ||
      name.includes('OpenPressureArea') ||
      name.includes('FiberOpticSensor')
    )
  }
  if (fragment === 'right-distal') {
    return name.includes('DistalPigtail') || name.includes('OutletCage')
  }
  return (
    name.includes('InletCage') ||
    name.includes('MotorHousing') ||
    name.includes('DifferentialPressureSensor') ||
    name.includes('ProximalShaft')
  )
}

function cloneFragment(source: THREE.Group, fragment: ImpellaFragment): FragmentClone {
  const root = SkeletonUtils.clone(source) as THREE.Group
  const excludedMeshes: THREE.Mesh[] = []
  const deployableMeshes: DeployableMesh[] = []
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (!fragmentIncludesMesh(fragment, object.name)) {
      excludedMeshes.push(object)
      return
    }
    const isDeployablePigtail = object.name.includes('DistalPigtail')
    object.castShadow = true
    object.receiveShadow = false
    object.frustumCulled = false
    object.renderOrder = 8
    const cloneMaterial = (material: THREE.Material) => {
      const next = material.clone()
      next.depthTest = true
      next.depthWrite = !isDeployablePigtail
      next.transparent = isDeployablePigtail
      if (next instanceof THREE.MeshStandardMaterial) {
        if (object.name.includes('Cage')) next.color.set('#ff6569')
        else if (object.name.includes('Distal')) next.color.set('#77adff')
        else if (object.name.includes('Motor')) next.color.set('#d6dfdc')
        next.emissive.copy(next.color)
        next.emissiveIntensity = 0.11
        next.metalness = Math.min(0.5, Math.max(0.14, next.metalness))
        next.roughness = Math.max(0.28, next.roughness)
      }
      return next
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material)
    if (isDeployablePigtail) {
      object.visible = false
      deployableMeshes.push({ mesh: object, baseScale: object.scale.clone() })
    }
  })
  excludedMeshes.forEach((mesh) => mesh.removeFromParent())
  return { root, deployableMeshes }
}

function disposeFragment(fragment: FragmentClone) {
  fragment.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material.dispose())
  })
}

function smootherStep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export default function ImpellaModel({
  side,
  state,
  reducedMotion,
  replayKey = 0,
}: {
  side: ImpellaSide
  state: McsSimulationState
  reducedMotion: boolean
  replayKey?: number
}) {
  const device = state.device as ImpellaDeviceState
  const config = visualConfig(side, device, state)
  const source = useGLTF(config.modelUrl, CARDIAC_DRACO_PATH)
  const fragments = useMemo(
    () => ({
      distal: cloneFragment(source.scene, side === 'right' ? 'right-distal' : 'left-distal'),
      proximal: cloneFragment(source.scene, side === 'right' ? 'right-proximal' : 'left-proximal'),
    }),
    [side, source.scene],
  )
  const fragmentsRef = useRef(fragments)
  const smoothCannulaRoute = useMemo(
    () => (config.smoothCannula ? smoothImpellaCannulaRoute(config.flowRoute) : null),
    [config.flowRoute, config.smoothCannula],
  )
  const reinforcementHelixRoute = useMemo(
    () =>
      smoothCannulaRoute
        ? createCannulaHelixPoints(smoothCannulaRoute, config.cannulaRadius * 1.018, 22)
        : null,
    [config.cannulaRadius, smoothCannulaRoute],
  )
  const placementProgress = useTrajectoryPlayback({
    targetProgress: config.targetProgress,
    replayKey,
    durationSeconds: side === 'right' ? 8.5 : 7,
    reducedMotion,
  })
  const trailingProgress = useRef(0)
  const annulusProgress = useRef(0)
  const annulusMarker = useRef<THREE.Group>(null)
  const guidewire = useRef<THREE.Group>(null)
  const guidewireExtension = useRef<THREE.Mesh>(null)
  const guidewireEndProgress = useRef(0)
  const tipDeployment = useRef(reducedMotion ? 1 : 0)
  const previousReplayKey = useRef(replayKey)
  const reinforcementProgress = useMemo(
    () => Array.from({ length: config.reinforcementRings }, () => ({ current: 0 })),
    [config.reinforcementRings],
  )
  const reinforcementGroups = useRef<Array<THREE.Group | null>>([])
  const accessConduitProgress = useRef(config.accessConduitEndProgress ?? 0)
  const originalCannulaEndProgress = useRef(0)
  const smoothCannulaStartProgress = useRef(0)
  const smoothCannulaEndProgress = useRef(0)

  useFrame((_, delta) => {
    trailingProgress.current = THREE.MathUtils.clamp(
      placementProgress.current - config.physicalSpanProgress,
      0,
      placementProgress.current,
    )

    const visibleSpan = placementProgress.current - trailingProgress.current
    const visibleFraction = THREE.MathUtils.clamp(
      visibleSpan / Math.max(0.001, config.physicalSpanProgress),
      0,
      1,
    )
    if (smoothCannulaRoute && config.cannulaStartProgress !== undefined) {
      const smoothSpan = Math.max(0.0001, config.targetProgress - config.cannulaStartProgress)
      originalCannulaEndProgress.current = Math.min(
        placementProgress.current,
        config.cannulaStartProgress,
      )
      smoothCannulaStartProgress.current = THREE.MathUtils.clamp(
        (trailingProgress.current - config.cannulaStartProgress) / smoothSpan,
        0,
        1,
      )
      smoothCannulaEndProgress.current = THREE.MathUtils.clamp(
        (placementProgress.current - config.cannulaStartProgress) / smoothSpan,
        0,
        1,
      )
    } else {
      originalCannulaEndProgress.current = placementProgress.current
      smoothCannulaStartProgress.current = 0
      smoothCannulaEndProgress.current = 0
    }
    const visibleRingCount = Math.floor(config.reinforcementRings * visibleFraction)
    reinforcementProgress.forEach((progress, index) => {
      const group = reinforcementGroups.current[index]
      if (group) group.visible = index < visibleRingCount
      progress.current =
        trailingProgress.current + visibleSpan * ((index + 1) / Math.max(1, visibleRingCount + 1))
    })

    if (config.annulusOffsetProgress !== undefined) {
      const offset = config.annulusOffsetProgress
      annulusProgress.current = Math.max(0, placementProgress.current - offset)
      if (annulusMarker.current) annulusMarker.current.visible = placementProgress.current > offset
    } else if (annulusMarker.current) {
      annulusMarker.current.visible = false
    }

    const replayRestarted = previousReplayKey.current !== replayKey
    previousReplayKey.current = replayKey
    if (replayRestarted) tipDeployment.current = 0

    const mutableFragments = fragmentsRef.current
    const hasDeployableTip =
      config.deploysPigtail === true && mutableFragments.distal.deployableMeshes.length > 0
    const arrived =
      !replayRestarted && Math.abs(placementProgress.current - config.targetProgress) < 0.0005
    if (hasDeployableTip) {
      if (reducedMotion) tipDeployment.current = 1
      else if (!arrived) tipDeployment.current = 0
      else tipDeployment.current = Math.min(1, tipDeployment.current + Math.min(delta, 0.1) / 0.65)
    } else {
      tipDeployment.current = 1
    }
    const deployment = smootherStep(tipDeployment.current)
    const deployedTipScale = config.deployedTipScale ?? 1
    for (const { mesh, baseScale } of mutableFragments.distal.deployableMeshes) {
      mesh.visible = deployment > 0.01
      mesh.scale.copy(baseScale).multiplyScalar((0.24 + deployment * 0.76) * deployedTipScale)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => {
        material.opacity = deployment
      })
    }
    guidewireEndProgress.current = Math.min(1, placementProgress.current + 0.022)
    if (guidewire.current) {
      guidewire.current.visible = !arrived
    }
    if (guidewireExtension.current) {
      const extensionFraction = THREE.MathUtils.clamp(
        (placementProgress.current + 0.022 - 1) / 0.022,
        0,
        1,
      )
      guidewireExtension.current.visible = !arrived && extensionFraction > 0.001
      guidewireExtension.current.scale.y = extensionFraction
      guidewireExtension.current.position.y = 0.11 * extensionFraction
    }
  })

  useEffect(
    () => () => {
      disposeFragment(fragments.distal)
      disposeFragment(fragments.proximal)
    },
    [fragments],
  )

  useEffect(() => {
    fragmentsRef.current = fragments
  }, [fragments])

  useEffect(() => {
    accessConduitProgress.current = config.accessConduitEndProgress ?? 0
  }, [config.accessConduitEndProgress])

  return (
    <group>
      <ProgressiveSplineTube
        points={config.route}
        progress={trailingProgress}
        radius={config.shaftRadius}
        color="#24364a"
        depthTest
        emissiveIntensity={0.035}
        radialSegments={10}
        renderOrder={8}
      />

      <group ref={guidewire}>
        <ProgressiveSplineTube
          points={config.route}
          startProgress={placementProgress}
          progress={guidewireEndProgress}
          radius={0.012}
          color="#edf3ef"
          depthTest
          emissiveIntensity={0.09}
          radialSegments={7}
          renderOrder={9}
        />
      </group>
      {smoothCannulaRoute ? (
        <>
          <ProgressiveSplineTube
            points={config.route}
            startProgress={trailingProgress}
            progress={originalCannulaEndProgress}
            radius={config.cannulaRadius}
            color={config.cannulaColor}
            depthTest
            emissiveIntensity={0.08}
            radialSegments={18}
            renderOrder={8}
          />
          <ProgressiveSplineTube
            points={smoothCannulaRoute}
            startProgress={smoothCannulaStartProgress}
            progress={smoothCannulaEndProgress}
            radius={config.cannulaRadius}
            color={config.cannulaColor}
            depthTest
            emissiveIntensity={0.08}
            radialSegments={20}
            renderOrder={8}
          />
          {reinforcementHelixRoute ? (
            <ProgressiveSplineTube
              points={reinforcementHelixRoute}
              startProgress={smoothCannulaStartProgress}
              progress={smoothCannulaEndProgress}
              radius={0.0048}
              color="#93a8b7"
              depthTest
              emissiveIntensity={0.04}
              radialSegments={5}
              renderOrder={9}
            />
          ) : null}
        </>
      ) : (
        <ProgressiveSplineTube
          points={config.route}
          startProgress={trailingProgress}
          progress={placementProgress}
          radius={config.cannulaRadius}
          color={config.cannulaColor}
          depthTest
          emissiveIntensity={0.12}
          radialSegments={14}
          renderOrder={8}
        />
      )}

      {config.accessConduitEndProgress !== undefined ? (
        <ProgressiveSplineTube
          points={config.route}
          progress={accessConduitProgress}
          radius={0.13}
          color="#c79b82"
          opacity={0.32}
          depthTest
          emissiveIntensity={0.025}
          radialSegments={18}
          renderOrder={12}
        />
      ) : null}

      {reinforcementProgress.map((progress, index) => (
        <group
          key={index}
          visible={false}
          ref={(node) => {
            reinforcementGroups.current[index] = node
          }}
        >
          <SplineFollower points={config.route} progress={progress} reducedMotion renderOrder={9}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={9}>
              <torusGeometry args={[config.cannulaRadius * 1.025, 0.007, 7, 16]} />
              <meshStandardMaterial
                color="#d7ddd9"
                emissive="#5f6a68"
                emissiveIntensity={0.08}
                metalness={0.58}
                roughness={0.28}
              />
            </mesh>
          </SplineFollower>
        </group>
      ))}

      <group ref={annulusMarker} visible={false}>
        <SplineFollower
          points={config.route}
          progress={annulusProgress}
          reducedMotion
          renderOrder={9}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={9}>
            <torusGeometry args={[config.cannulaRadius * 1.13, 0.012, 8, 20]} />
            <meshStandardMaterial
              color="#ffd36f"
              emissive="#ffc34e"
              emissiveIntensity={0.22}
              metalness={0.64}
              roughness={0.22}
            />
          </mesh>
        </SplineFollower>
      </group>

      <SplineFollower
        points={config.route}
        progress={placementProgress}
        reducedMotion={reducedMotion}
        renderOrder={9}
      >
        <mesh ref={guidewireExtension} visible={false} castShadow renderOrder={9}>
          <cylinderGeometry args={[0.012, 0.012, 0.22, 7]} />
          <meshStandardMaterial
            color="#edf3ef"
            emissive="#8d9894"
            emissiveIntensity={0.09}
            metalness={0.4}
            roughness={0.32}
          />
        </mesh>
        <group scale={config.registration.modelScale}>
          <group
            position={[-config.anchorLocal[0], -config.anchorLocal[1], -config.anchorLocal[2]]}
          >
            <primitive object={fragments.distal.root} dispose={null} />
          </group>
        </group>
      </SplineFollower>
      <SplineFollower
        points={config.route}
        progress={trailingProgress}
        reducedMotion={reducedMotion}
        renderOrder={9}
      >
        <group scale={config.registration.modelScale}>
          <group
            position={[
              -config.trailingAnchorLocal[0],
              -config.trailingAnchorLocal[1],
              -config.trailingAnchorLocal[2],
            ]}
          >
            <primitive object={fragments.proximal.root} dispose={null} />
          </group>
        </group>
      </SplineFollower>
      <ImpellaBloodFlow
        points={smoothCannulaRoute ?? config.flowRoute}
        flow={config.flowLMin}
        side={side}
        paused={reducedMotion}
        revealProgress={placementProgress}
        revealAt={Math.max(0, config.targetProgress - 0.003)}
      />
    </group>
  )
}
