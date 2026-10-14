'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { updateScopeCamera } from '@/components/airway-anatomy/scope-primitives/ScopeCamera'
import type { ScopePoseSnapshot } from '@/lib/airway-anatomy/types'

/** How long the picture takes to settle on a new pose. */
export const CAMERA_EASE_MS = 150
/** A move longer than this is a new start or a reset, and is shown at once. */
const CAMERA_JUMP_MM = 20

/**
 * The scope view's camera, eased from one pose to the next (educator feedback, 2026-10-13: the
 * view jumped a step at a time, which made the driving hard to follow).
 *
 * Presentation only. The model's state is where the learner's command already put it: the
 * controls, the readouts, the goals and the opening names all read that state, and this component
 * only decides how the picture travels to it. With reduced motion the picture is placed at once.
 */
export function EasedScopeCamera({ pose, fovDeg }: { pose: ScopePoseSnapshot; fovDeg: number }) {
  const { camera, size, invalidate } = useThree()
  const target = useRef(new THREE.PerspectiveCamera())
  const from = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion } | null>(null)
  const startedAt = useRef(0)
  const shown = useRef<ScopePoseSnapshot | null>(null)
  const reducedMotion = useRef(true)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => {
      reducedMotion.current = media.matches
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height)
    if (shown.current !== pose) {
      const first = shown.current === null
      shown.current = pose
      updateScopeCamera(target.current, pose, aspect, fovDeg)
      const jump =
        first ||
        reducedMotion.current ||
        camera.position.distanceTo(target.current.position) > CAMERA_JUMP_MM
      from.current = jump
        ? null
        : { position: camera.position.clone(), quaternion: camera.quaternion.clone() }
      startedAt.current = performance.now()
    }
    updateScopeCamera(camera, pose, aspect, fovDeg)
    const start = from.current
    if (!start) return
    const fraction = Math.min(1, (performance.now() - startedAt.current) / CAMERA_EASE_MS)
    if (fraction >= 1) {
      from.current = null
      return
    }
    const eased = fraction * (2 - fraction)
    camera.position.lerpVectors(start.position, target.current.position, eased)
    camera.quaternion.slerpQuaternions(start.quaternion, target.current.quaternion, eased)
    camera.updateMatrixWorld()
    invalidate()
  })
  return null
}
