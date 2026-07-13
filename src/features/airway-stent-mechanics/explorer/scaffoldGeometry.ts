import * as THREE from 'three'

import {
  STENT_LENGTH as SOURCE_STENT_LENGTH,
  STENT_RADIUS as SOURCE_STENT_RADIUS,
  buildScaffoldPaths,
  type ScaffoldPathRole,
} from '../engine/learningLabGeometry'
import { getStentExplorerArchitectureProfile } from './architectures'
import type { StentExplorerArchitectureId, StentExplorerPose } from './types'

export const EXPLORER_STENT_LENGTH = 4.8
export const EXPLORER_STENT_RADIUS = 1

const gaussian = (value: number, width: number) => Math.exp(-(value * value) / (2 * width * width))

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function deploymentScale(pose: StentExplorerPose) {
  return 0.3 + clamp01(pose.deployment) * 0.7
}

export function deformStentPoint({
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

export interface ExplorerScaffoldPath {
  id: string
  points: THREE.Vector3[]
  radius: number
  role: ScaffoldPathRole
}

function densifyPath(points: readonly THREE.Vector3[]): THREE.Vector3[] {
  if (points.length >= 12) return points.map((point) => point.clone())
  const densified: THREE.Vector3[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    for (let step = 0; step < 8; step += 1) {
      densified.push(start.clone().lerp(end, step / 8))
    }
  }
  densified.push(points.at(-1)!.clone())
  return densified
}

const baselinePathCache = new Map<StentExplorerArchitectureId, ExplorerScaffoldPath[]>()

function getBaselinePaths(architectureId: StentExplorerArchitectureId): ExplorerScaffoldPath[] {
  const cached = baselinePathCache.get(architectureId)
  if (cached) return cached

  const profile = getStentExplorerArchitectureProfile(architectureId)
  if (!profile.geometryBuilder) return []
  const paths = buildScaffoldPaths(profile.geometryBuilder).map((path) => ({
    id: path.id,
    points: densifyPath(path.points),
    radius: path.radius,
    role: path.role,
  }))
  baselinePathCache.set(architectureId, paths)
  return paths
}

function fractureRoleFor(architectureId: StentExplorerArchitectureId): ScaffoldPathRole {
  switch (architectureId) {
    case 'laser-cut-covered':
    case 'balloon-expanded-metal':
      return 'connector'
    case 'single-wire-knit-partial-cover':
      return 'single-wire'
    case 'hook-cross-covered':
      return 'capture'
    default:
      return 'wire-a'
  }
}

function topologyLoad(pose: StentExplorerPose) {
  return clamp01(
    Math.max(
      Math.abs(pose.axialScale - 1) * 4,
      pose.axialExcursion,
      pose.bend,
      pose.radialCompression,
      pose.airwayCompression,
    ),
  )
}

function localWireGeometry({
  architectureId,
  path,
  pathProgress,
  pose,
  radius,
  theta,
}: {
  architectureId: StentExplorerArchitectureId
  path: ExplorerScaffoldPath
  pathProgress: number
  pose: StentExplorerPose
  radius: number
  theta: number
}) {
  const load = topologyLoad(pose)
  const deformationWindow = Math.sin(Math.PI * pathProgress)
  const wireDirection = path.role === 'wire-a' ? 1 : path.role === 'wire-b' ? -1 : 0

  if (architectureId === 'free-crossing-braid') {
    return {
      radius,
      theta: theta + wireDirection * load * deformationWindow * 0.14,
    }
  }

  if (architectureId === 'hook-cross-covered') {
    // Captured junction rings remain fixed relative to the more subtly
    // rotating braid families in this authored qualitative cue.
    return {
      radius,
      theta: theta + wireDirection * load * deformationWindow * 0.035,
    }
  }

  if (architectureId === 'single-wire-knit-partial-cover' && path.role === 'single-wire') {
    return {
      radius: radius * (1 + load * Math.sin(pathProgress * Math.PI * 12) * 0.045),
      theta,
    }
  }

  return { radius, theta }
}

/**
 * Adapts the retired lab's validated procedural topology into the persistent explorer pose.
 * Geometry is normalized and qualitative; it does not encode product dimensions or force.
 */
export function buildExplorerScaffoldPaths(
  architectureId: StentExplorerArchitectureId,
  pose: StentExplorerPose,
): ExplorerScaffoldPath[] {
  const profile = getStentExplorerArchitectureProfile(architectureId)
  if (!profile.geometryBuilder) return []

  const baselinePaths = getBaselinePaths(architectureId)
  const fractureRole = fractureRoleFor(architectureId)
  let fractureApplied = false

  return baselinePaths.flatMap((path) => {
    const points = path.points.map((point, pointIndex) => {
      const theta = Math.atan2(point.z, point.x)
      const normalizedRadius = Math.hypot(point.x, point.z) / SOURCE_STENT_RADIUS
      const pathProgress = pointIndex / Math.max(1, path.points.length - 1)
      const localGeometry = localWireGeometry({
        architectureId,
        path,
        pathProgress,
        pose,
        radius: EXPLORER_STENT_RADIUS * normalizedRadius,
        theta,
      })
      const transformedPoint = deformStentPoint({
        length: EXPLORER_STENT_LENGTH,
        pose,
        radius: localGeometry.radius,
        t: point.y / SOURCE_STENT_LENGTH,
        theta: localGeometry.theta,
      })

      if (
        (architectureId === 'laser-cut-covered' || architectureId === 'balloon-expanded-metal') &&
        path.role === 'connector'
      ) {
        const hingeWindow = Math.sin(Math.PI * pathProgress)
        const direction = path.id.length % 2 === 0 ? 1 : -1
        transformedPoint.z += topologyLoad(pose) * hingeWindow * direction * 0.12
      }

      return transformedPoint
    })
    const transformed = {
      id: path.id,
      points,
      radius: path.radius,
      role: path.role,
    }

    if (
      fractureApplied ||
      pose.fracture <= 0.02 ||
      path.role !== fractureRole ||
      points.length < 12
    ) {
      return [transformed]
    }

    fractureApplied = true
    const midpoint = Math.floor(points.length / 2)
    const requestedGap = Math.max(1, Math.round(1 + pose.fracture * 3))
    const maximumGap = Math.max(1, Math.min(midpoint - 3, points.length - midpoint - 3))
    const gap = Math.min(requestedGap, maximumGap)
    return [
      { ...transformed, id: `${path.id}-proximal`, points: points.slice(0, midpoint - gap) },
      { ...transformed, id: `${path.id}-distal`, points: points.slice(midpoint + gap) },
    ]
  })
}
