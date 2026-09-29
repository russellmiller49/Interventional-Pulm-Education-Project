import { useSyncExternalStore } from 'react'
import type { PerspectiveCamera } from 'three'

import type { ScopeGeometry } from '../../../engine/space/fulcrum'
import type { Vec3 } from '../../../engine/space/vec'

/**
 * The Scope view's camera, set from the engine's optical frame (plan, section 4.6): its origin,
 * its up and where it looks, a square field of the device's field of view. One function, so that the
 * scene and the independent projection check (`landmarkProjection.test.ts`, R3) aim the very same
 * three.js camera the same way.
 */
export function aimScopeCamera(
  camera: PerspectiveCamera,
  frame: ScopeGeometry['camera'],
  fieldOfViewDeg: number,
): void {
  camera.position.set(...frame.origin)
  camera.up.set(...frame.up)
  camera.lookAt(
    frame.origin[0] + frame.forward[0],
    frame.origin[1] + frame.forward[1],
    frame.origin[2] + frame.forward[2],
  )
  camera.fov = fieldOfViewDeg
  camera.aspect = 1
  camera.near = 0.5
  camera.far = 600
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

// ── Development only: landmarks drawn over the Scope view, for the browser's pixel check (R3) ─────

let landmarks: readonly Vec3[] = []
const listeners = new Set<() => void>()

export function setDevLandmarks(points: readonly Vec3[]): void {
  if (process.env.NODE_ENV === 'production') return
  landmarks = points
  for (const listener of listeners) listener()
}

export function useDevLandmarks(): readonly Vec3[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => landmarks,
    () => landmarks,
  )
}

/** A marker's colour, which nothing else in the scene draws. */
export const LANDMARK_COLOUR = '#ff00ff'
