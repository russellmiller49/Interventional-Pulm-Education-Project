'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

import { CARDIAC_DRACO_PATH } from '@/features/cardiac-anatomy/components/CardiacVesselModels'
import { CardiacPath } from '@/features/cardiac-anatomy/components/CardiacPath'
import { SplineFollower } from '@/features/cardiac-anatomy/components/CardiacTrajectory'
import {
  CARDIAC_RIG,
  LVAD_MODEL_URL,
  type CardiacPoint3,
} from '@/features/cardiac-anatomy/content/paths'

import type { LvadDeviceState, McsSimulationState } from '../../engine'
import { FlowParticles } from './FlowParticles'

const LOCAL_FORWARD = new THREE.Vector3(0, 1, 0)

function alignmentQuaternion(
  localDirection: CardiacPoint3,
  worldDirection: CardiacPoint3,
): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(...localDirection).normalize(),
    new THREE.Vector3(...worldDirection).normalize(),
  )
}

function GraftRing({ points, progress }: { points: readonly CardiacPoint3[]; progress: number }) {
  const progressRef = useRef(progress)
  return (
    <SplineFollower points={points} progress={progressRef} reducedMotion renderOrder={9}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={9}>
        <torusGeometry args={[0.104, 0.012, 8, 20]} />
        <meshStandardMaterial
          color="#707b7b"
          emissive="#263334"
          emissiveIntensity={0.04}
          metalness={0.12}
          roughness={0.68}
        />
      </mesh>
    </SplineFollower>
  )
}

export default function LvadModel({
  state,
  reducedMotion,
}: {
  state: McsSimulationState
  reducedMotion: boolean
}) {
  const source = useGLTF(LVAD_MODEL_URL, CARDIAC_DRACO_PATH)
  const device = state.device as LvadDeviceState
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(source.scene) as THREE.Group
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = false
      object.renderOrder = 8
      const cloneMaterial = (material: THREE.Material) => {
        const next = material.clone()
        next.depthTest = true
        next.depthWrite = true
        if (next instanceof THREE.MeshStandardMaterial) {
          const isPump = object.name.includes('PumpAndHousing')
          next.color.set(isPump ? '#95a2a5' : '#b8c1bf')
          next.emissive.set(isPump ? '#29383b' : '#202c2d')
          next.emissiveIntensity = isPump ? 0.09 : 0.045
          next.metalness = isPump ? 0.56 : 0.48
          next.roughness = isPump ? 0.3 : 0.36
        }
        return next
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material)
    })
    return clone
  }, [source.scene])

  const registration = CARDIAC_RIG.lvad.modelRegistration
  const modelQuaternion = useMemo(
    () => alignmentQuaternion(registration.modelOutwardAxisLocal, registration.outwardAxis),
    [registration.modelOutwardAxisLocal, registration.outwardAxis],
  )
  const cuffQuaternion = useMemo(
    () => alignmentQuaternion([0, 1, 0], registration.outwardAxis),
    [registration.outwardAxis],
  )
  const anastomosisQuaternion = useMemo(() => {
    const surface = new THREE.Vector3(...CARDIAC_RIG.lvad.ctRegistration.aorticSurfaceAnastomosis)
    const lumen = new THREE.Vector3(...CARDIAC_RIG.lvad.ctRegistration.aorticLumenEndpoint)
    return new THREE.Quaternion().setFromUnitVectors(LOCAL_FORWARD, lumen.sub(surface).normalize())
  }, [])
  const flowRoute = useMemo(
    () => [...CARDIAC_RIG.lvad.inflowRoute, ...CARDIAC_RIG.lvad.outflowRoute.slice(1)],
    [],
  )
  const visibleOutflowRoute = useMemo(() => CARDIAC_RIG.lvad.outflowRoute.slice(0, -1), [])
  const graftRings = useMemo(
    () => Array.from({ length: 15 }, (_, index) => 0.05 + (index / 14) * 0.87),
    [],
  )

  useEffect(
    () => () => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      })
    },
    [model],
  )

  const activelyPumping = device.running && device.powerConnected && !device.controllerFault

  return (
    <group>
      <group position={registration.apicalCuffWorld} quaternion={modelQuaternion}>
        <group scale={registration.scale}>
          <group
            position={[
              -registration.modelAnchorLocal[0],
              -registration.modelAnchorLocal[1],
              -registration.modelAnchorLocal[2],
            ]}
          >
            <primitive object={model} dispose={null} />
          </group>
        </group>
      </group>
      <group position={registration.apicalCuffWorld} quaternion={cuffQuaternion}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={9}>
          <torusGeometry args={[0.19, 0.035, 12, 32]} />
          <meshStandardMaterial
            color="#cbd0cb"
            emissive="#3c4746"
            emissiveIntensity={0.06}
            metalness={0.58}
            roughness={0.32}
          />
        </mesh>
      </group>

      <CardiacPath
        points={visibleOutflowRoute}
        radius={0.105}
        color="#aeb8b5"
        emissiveIntensity={0.025}
        radialSegments={18}
        tubularSegments={160}
      />
      {graftRings.map((progress) => (
        <GraftRing key={progress} points={visibleOutflowRoute} progress={progress} />
      ))}

      <group
        position={CARDIAC_RIG.lvad.ctRegistration.aorticSurfaceAnastomosis}
        quaternion={anastomosisQuaternion}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow renderOrder={9}>
          <torusGeometry args={[0.118, 0.02, 10, 28]} />
          <meshStandardMaterial
            color="#d1d5cf"
            emissive="#47504e"
            emissiveIntensity={0.05}
            metalness={0.46}
            roughness={0.38}
          />
        </mesh>
      </group>

      <FlowParticles
        points={flowRoute}
        flow={activelyPumping ? state.metrics.deviceFlowLMin : 0}
        color="#ff9da8"
        paused={reducedMotion}
      />
    </group>
  )
}
