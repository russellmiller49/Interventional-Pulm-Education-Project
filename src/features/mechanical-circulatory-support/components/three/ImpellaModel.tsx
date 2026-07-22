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
import { FlowParticles } from './FlowParticles'
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
  trailingBiasProgress: number
  flowRoute: readonly CardiacPoint3[]
  flowLMin: number
  cannulaColor: string
  cannulaRadius: number
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
    const targetProgress = endpointProgress.head
    const physicalSpanProgress =
      IMPELLA_RP_ADVANCEMENT_PROGRESS.correct - IMPELLA_RP_ADVANCEMENT_PROGRESS.ivcInlet
    return {
      modelUrl: IMPELLA_RP_MODEL_URL,
      route: IMPELLA_RP_ADVANCEMENT_ROUTE,
      targetProgress,
      registration: IMPELLA_RP_DEVICE_REGISTRATION,
      anchorLocal: IMPELLA_RP_DEVICE_REGISTRATION.outletLocal,
      trailingAnchorLocal: IMPELLA_RP_DEVICE_REGISTRATION.inletLocal,
      physicalSpanProgress,
      trailingBiasProgress: Math.max(
        0,
        endpointProgress.inlet - Math.max(0, targetProgress - physicalSpanProgress),
      ),
      flowRoute: impellaRpFlowRouteForProgress(targetProgress),
      flowLMin: device.right.running ? state.metrics.rightDeviceFlowLMin : 0,
      cannulaColor: '#5477bf',
      cannulaRadius: 0.088,
    }
  }

  const variant = device.left.variant
  const targetProgress = leftProgress(device.left.position, variant)
  if (variant === '55') {
    return {
      modelUrl: IMPELLA_55_MODEL_URL,
      route: IMPELLA_55_ADVANCEMENT_ROUTE,
      targetProgress,
      registration: IMPELLA_55_DEVICE_REGISTRATION,
      anchorLocal: IMPELLA_55_DEVICE_REGISTRATION.inletLocal,
      trailingAnchorLocal: IMPELLA_55_DEVICE_REGISTRATION.outletLocal,
      physicalSpanProgress:
        IMPELLA_55_ADVANCEMENT_PROGRESS.correct - IMPELLA_55_ADVANCEMENT_PROGRESS.aorticRoot,
      trailingBiasProgress: 0,
      flowRoute: impella55FlowRouteForProgress(targetProgress),
      flowLMin: device.left.running ? state.metrics.leftDeviceFlowLMin : 0,
      cannulaColor: '#667fbe',
      cannulaRadius: 0.084,
    }
  }

  return {
    modelUrl: IMPELLA_CP_MODEL_URL,
    route: IMPELLA_ADVANCEMENT_ROUTE,
    targetProgress,
    registration: IMPELLA_DEVICE_REGISTRATION,
    anchorLocal: IMPELLA_DEVICE_REGISTRATION.inletLocal,
    trailingAnchorLocal: IMPELLA_DEVICE_REGISTRATION.outletLocal,
    physicalSpanProgress:
      IMPELLA_ADVANCEMENT_PROGRESS.correct - IMPELLA_ADVANCEMENT_PROGRESS.aorticRoot,
    trailingBiasProgress: 0,
    flowRoute: impellaFlowRouteForProgress(targetProgress),
    flowLMin: device.left.running ? state.metrics.leftDeviceFlowLMin : 0,
    cannulaColor: '#6680bc',
    cannulaRadius: 0.056,
  }
}

type ImpellaFragment = 'left-distal' | 'left-proximal' | 'right-distal' | 'right-proximal'

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

function cloneFragment(source: THREE.Group, fragment: ImpellaFragment): THREE.Group {
  const clone = SkeletonUtils.clone(source) as THREE.Group
  const excludedMeshes: THREE.Mesh[] = []
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (!fragmentIncludesMesh(fragment, object.name)) {
      excludedMeshes.push(object)
      return
    }
    object.castShadow = true
    object.receiveShadow = false
    object.frustumCulled = false
    object.renderOrder = 40
    const cloneMaterial = (material: THREE.Material) => {
      const next = material.clone()
      // Educational x-ray treatment: keep the endpoint hardware readable through the
      // translucent chambers while the centerline tube supplies the flexible cannula.
      next.depthTest = false
      next.depthWrite = false
      if (next instanceof THREE.MeshStandardMaterial) {
        next.emissive.copy(next.color)
        next.emissiveIntensity = 0.12
        next.metalness = Math.min(0.42, Math.max(0.12, next.metalness))
        next.roughness = Math.max(0.28, next.roughness)
      }
      return next
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material)
  })
  excludedMeshes.forEach((mesh) => mesh.removeFromParent())
  return clone
}

function disposeFragment(fragment: THREE.Group) {
  fragment.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => material.dispose())
  })
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
  const placementProgress = useTrajectoryPlayback({
    targetProgress: config.targetProgress,
    replayKey,
    durationSeconds: side === 'right' ? 8.5 : 7,
    reducedMotion,
  })
  const trailingProgress = useRef(0)
  const trailingBiasProgress = useTrajectoryPlayback({
    targetProgress: config.trailingBiasProgress,
    replayKey,
    durationSeconds: 2.4,
    reducedMotion,
  })

  useFrame(() => {
    const insertionFraction = THREE.MathUtils.clamp(
      placementProgress.current / Math.max(0.001, config.targetProgress),
      0,
      1,
    )
    trailingProgress.current = THREE.MathUtils.clamp(
      Math.max(0, placementProgress.current - config.physicalSpanProgress) +
        trailingBiasProgress.current * insertionFraction,
      0,
      placementProgress.current,
    )
  })

  useEffect(
    () => () => {
      disposeFragment(fragments.distal)
      disposeFragment(fragments.proximal)
    },
    [fragments],
  )

  return (
    <group>
      <ProgressiveSplineTube
        points={config.route}
        progress={trailingProgress}
        radius={side === 'right' ? 0.025 : 0.022}
        color="#253a4d"
        depthTest={false}
        emissiveIntensity={0.04}
        radialSegments={10}
        renderOrder={37}
      />
      <ProgressiveSplineTube
        points={config.route}
        startProgress={trailingProgress}
        progress={placementProgress}
        radius={config.cannulaRadius}
        color={config.cannulaColor}
        depthTest={false}
        emissiveIntensity={0.08}
        radialSegments={12}
        renderOrder={38}
      />
      <SplineFollower
        points={config.route}
        progress={placementProgress}
        reducedMotion={reducedMotion}
        renderOrder={40}
      >
        <group scale={config.registration.modelScale}>
          <group
            position={[-config.anchorLocal[0], -config.anchorLocal[1], -config.anchorLocal[2]]}
          >
            <primitive object={fragments.distal} dispose={null} />
          </group>
        </group>
      </SplineFollower>
      <SplineFollower
        points={config.route}
        progress={trailingProgress}
        reducedMotion={reducedMotion}
        renderOrder={40}
      >
        <group scale={config.registration.modelScale}>
          <group
            position={[
              -config.trailingAnchorLocal[0],
              -config.trailingAnchorLocal[1],
              -config.trailingAnchorLocal[2],
            ]}
          >
            <primitive object={fragments.proximal} dispose={null} />
          </group>
        </group>
      </SplineFollower>
      <FlowParticles
        points={config.flowRoute}
        flow={config.flowLMin}
        color={side === 'right' ? '#b99aff' : '#b6eef0'}
        paused={reducedMotion}
        revealProgress={placementProgress}
        revealAt={Math.max(0, config.targetProgress - 0.003)}
      />
    </group>
  )
}
