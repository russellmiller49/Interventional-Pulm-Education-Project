'use client'

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import type { CardiacPoint3 } from '@/features/cardiac-anatomy/content/paths'

import type { ImpellaSide } from '../../engine'
import { createImpellaBloodFlowPaths } from './impellaFlowGeometry'

const PARTICLE_FORWARD = new THREE.Vector3(0, 1, 0)

type StreamMotion = 'suction' | 'transit' | 'jet'

function ParticleStream({
  points,
  count,
  radius,
  color,
  speed,
  flow,
  paused,
  motion,
  phaseOffset = 0,
  revealProgress,
  revealAt,
}: {
  points: readonly CardiacPoint3[]
  count: number
  radius: number
  color: string
  speed: number
  flow: number
  paused: boolean
  motion: StreamMotion
  phaseOffset?: number
  revealProgress: MutableRefObject<number>
  revealAt: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
        false,
        'centripetal',
      ),
    [points],
  )
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color,
        depthTest: true,
        depthWrite: false,
        opacity: 0.9,
        toneMapped: false,
        transparent: true,
      }),
    [color],
  )
  const transform = useMemo(() => new THREE.Object3D(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock }) => {
    const instances = mesh.current
    if (!instances) return
    const isVisible = flow > 0.05 && revealProgress.current >= revealAt
    instances.visible = isVisible
    if (!isVisible) return

    const elapsed = paused ? 0 : clock.elapsedTime
    for (let index = 0; index < count; index += 1) {
      const phase = (elapsed * speed + index / count + phaseOffset) % 1
      const progress = motion === 'suction' ? phase ** 1.55 : phase
      curve.getPointAt(progress, transform.position)
      curve.getTangentAt(progress, tangent).normalize()
      transform.quaternion.setFromUnitVectors(PARTICLE_FORWARD, tangent)
      const pulse = 0.9 + Math.sin((phase + index / count) * Math.PI * 2) * 0.12
      const taper =
        motion === 'suction'
          ? THREE.MathUtils.lerp(1.12, 0.68, progress)
          : motion === 'jet'
            ? THREE.MathUtils.lerp(0.72, 1.08, progress)
            : 0.82
      const elongation = motion === 'jet' ? 2.7 : motion === 'transit' ? 1.7 : 1.25
      const size = radius * pulse * taper
      transform.scale.set(size, size * elongation, size)
      transform.updateMatrix()
      instances.setMatrixAt(index, transform.matrix)
    }
    instances.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={15}
    />
  )
}

export function ImpellaBloodFlow({
  points,
  flow,
  side,
  paused,
  revealProgress,
  revealAt,
}: {
  points: readonly CardiacPoint3[]
  flow: number
  side: ImpellaSide
  paused: boolean
  revealProgress: MutableRefObject<number>
  revealAt: number
}) {
  const paths = useMemo(() => createImpellaBloodFlowPaths(points), [points])
  const colors =
    side === 'right'
      ? { inlet: '#a91f49', transit: '#d52c50', outlet: '#f04461' }
      : { inlet: '#d72b3e', transit: '#ff3948', outlet: '#ff654f' }

  return (
    <group>
      {paths.inlet.map((path, index) => (
        <ParticleStream
          key={`inlet-${index}`}
          points={path}
          count={6}
          radius={0.032}
          color={colors.inlet}
          speed={0.13 + flow * 0.025}
          flow={flow}
          paused={paused}
          motion="suction"
          phaseOffset={index * 0.07}
          revealProgress={revealProgress}
          revealAt={revealAt}
        />
      ))}
      <ParticleStream
        points={paths.core}
        count={16}
        radius={0.027}
        color={colors.transit}
        speed={0.17 + flow * 0.04}
        flow={flow}
        paused={paused}
        motion="transit"
        revealProgress={revealProgress}
        revealAt={revealAt}
      />
      {paths.outlet.map((path, index) => (
        <ParticleStream
          key={`outlet-${index}`}
          points={path}
          count={7}
          radius={0.034}
          color={colors.outlet}
          speed={0.38 + flow * 0.07}
          flow={flow}
          paused={paused}
          motion="jet"
          phaseOffset={index * 0.055}
          revealProgress={revealProgress}
          revealAt={revealAt}
        />
      ))}
    </group>
  )
}
