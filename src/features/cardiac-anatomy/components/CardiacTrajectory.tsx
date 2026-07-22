'use client'

import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import type { CardiacPoint3 } from '../content/paths'

const FORWARD_AXIS = new THREE.Vector3(0, 1, 0)
const LOCAL_LATERAL_AXIS = new THREE.Vector3(1, 0, 0)

export function cardiacCurve(points: readonly CardiacPoint3[]): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
}

interface TrajectoryPlaybackOptions {
  targetProgress: number
  replayKey: number
  durationSeconds: number
  reducedMotion: boolean
  paused?: boolean
  initialProgress?: number
  startProgress?: number
  /** Snap administrative position changes while still allowing an explicit replay key to animate. */
  snapToTarget?: boolean
}

interface PlaybackSegment {
  from: number
  to: number
  elapsed: number
  duration: number
}

function smootherStep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Frame-rate-independent trajectory playback shared by catheter and cannula meshes. */
export function useTrajectoryPlayback({
  targetProgress,
  replayKey,
  durationSeconds,
  reducedMotion,
  paused = false,
  initialProgress,
  startProgress = 0,
  snapToTarget = false,
}: TrajectoryPlaybackOptions): MutableRefObject<number> {
  const target = THREE.MathUtils.clamp(targetProgress, 0, 1)
  const initial =
    reducedMotion || snapToTarget
      ? target
      : THREE.MathUtils.clamp(initialProgress ?? startProgress, 0, 1)
  const progress = useRef(initial)
  const segment = useRef<PlaybackSegment>({
    from: initial,
    to: target,
    elapsed: 0,
    duration: Math.max(0.2, durationSeconds * Math.abs(target - initial)),
  })
  const previousReplayKey = useRef(replayKey)

  useEffect(() => {
    const replayed = previousReplayKey.current !== replayKey
    previousReplayKey.current = replayKey
    if (reducedMotion || (snapToTarget && !replayed)) {
      progress.current = target
      segment.current = { from: target, to: target, elapsed: 1, duration: 1 }
      return
    }
    const from = replayed ? startProgress : progress.current
    if (replayed) progress.current = from
    segment.current = {
      from,
      to: target,
      elapsed: 0,
      duration: Math.max(0.24, durationSeconds * Math.abs(target - from)),
    }
  }, [durationSeconds, reducedMotion, replayKey, snapToTarget, startProgress, target])

  useFrame((_, delta) => {
    if (paused || reducedMotion) return
    const motion = segment.current
    if (motion.elapsed >= motion.duration) {
      progress.current = motion.to
      return
    }
    motion.elapsed = Math.min(motion.duration, motion.elapsed + Math.min(delta, 0.1))
    progress.current = THREE.MathUtils.lerp(
      motion.from,
      motion.to,
      smootherStep(motion.elapsed / motion.duration),
    )
  })

  return progress
}

interface ProgressiveSplineTubeProps {
  points: readonly CardiacPoint3[]
  progress: MutableRefObject<number>
  startProgress?: MutableRefObject<number>
  radius: number
  color: string
  opacity?: number
  depthTest?: boolean
  emissiveIntensity?: number
  radialSegments?: number
  renderOrder?: number
}

export function ProgressiveSplineTube({
  points,
  progress,
  startProgress,
  radius,
  color,
  opacity = 1,
  depthTest = true,
  emissiveIntensity = 0.08,
  radialSegments = 10,
  renderOrder = 20,
}: ProgressiveSplineTubeProps) {
  const tubularSegments = Math.max(72, points.length * 2)
  const geometry = useMemo(() => {
    const curve = cardiacCurve(points)
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
  }, [points, radialSegments, radius, tubularSegments])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const indexCount = geometry.index?.count ?? 0
    const firstRing = Math.floor(
      THREE.MathUtils.clamp(startProgress?.current ?? 0, 0, 1) * tubularSegments,
    )
    const lastRing = Math.floor(
      THREE.MathUtils.clamp(progress.current, startProgress?.current ?? 0, 1) * tubularSegments,
    )
    const firstIndex = Math.min(indexCount, firstRing * radialSegments * 6)
    const visibleCount = Math.min(
      indexCount - firstIndex,
      Math.max(0, lastRing - firstRing) * radialSegments * 6,
    )
    geometry.setDrawRange(firstIndex, visibleCount)
  })

  return (
    <mesh geometry={geometry} castShadow frustumCulled={false} renderOrder={renderOrder}>
      <meshPhysicalMaterial
        color={color}
        depthTest={depthTest}
        depthWrite={depthTest && opacity >= 1}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        metalness={0.04}
        opacity={opacity}
        roughness={0.34}
        transparent={opacity < 1}
      />
    </mesh>
  )
}

interface SplineFollowerProps {
  points: readonly CardiacPoint3[]
  progress: MutableRefObject<number>
  children: ReactNode
  lateralMotion?: number
  reducedMotion?: boolean
  rollRadians?: number
  renderOrder?: number
}

/** Places local +Y along the spline tangent using a stable, smoothed frame. */
export function SplineFollower({
  points,
  progress,
  children,
  lateralMotion = 0,
  reducedMotion = false,
  rollRadians = 0,
  renderOrder = 21,
}: SplineFollowerProps) {
  const group = useRef<THREE.Group>(null)
  const curve = useMemo(() => cardiacCurve(points), [points])
  const point = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const rollQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const transportQuaternion = useRef(new THREE.Quaternion())
  const tangentDeltaQuaternion = useRef(new THREE.Quaternion())
  const previousTangent = useRef(new THREE.Vector3())
  const previousProgress = useRef(Number.NaN)

  useFrame(({ clock }, delta) => {
    if (!group.current) return
    const pathProgress = THREE.MathUtils.clamp(progress.current, 0, 1)
    curve.getPointAt(pathProgress, point)
    curve.getTangentAt(pathProgress, tangent).normalize()
    const snapOrientation =
      !Number.isFinite(previousProgress.current) ||
      Math.abs(pathProgress - previousProgress.current) > 0.08
    if (snapOrientation) {
      transportQuaternion.current.setFromUnitVectors(FORWARD_AXIS, tangent)
    } else {
      tangentDeltaQuaternion.current.setFromUnitVectors(previousTangent.current, tangent)
      transportQuaternion.current.premultiply(tangentDeltaQuaternion.current).normalize()
    }
    normal.copy(LOCAL_LATERAL_AXIS).applyQuaternion(transportQuaternion.current).normalize()
    if (lateralMotion > 0 && !reducedMotion) {
      point.addScaledVector(normal, Math.sin(clock.elapsedTime * 3.2) * lateralMotion)
    }
    group.current.position.copy(point)
    previousTangent.current.copy(tangent)
    previousProgress.current = pathProgress
    targetQuaternion.copy(transportQuaternion.current)
    if (rollRadians !== 0) {
      rollQuaternion.setFromAxisAngle(FORWARD_AXIS, rollRadians)
      targetQuaternion.multiply(rollQuaternion)
    }
    if (snapOrientation || reducedMotion) {
      group.current.quaternion.copy(targetQuaternion)
    } else {
      const orientationBlend = 1 - Math.exp(-14 * Math.min(delta, 0.1))
      group.current.quaternion.slerp(targetQuaternion, orientationBlend)
    }
  })

  return (
    <group ref={group} renderOrder={renderOrder}>
      {children}
    </group>
  )
}
