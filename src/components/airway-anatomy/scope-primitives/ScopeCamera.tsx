'use client'

import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { add } from '@/lib/airway-anatomy/geometry'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import type { ScopePoseSnapshot } from '@/lib/airway-anatomy/types'
import { verticalFov } from '@/lib/bronchoscopy-core/frame'

import { BRONCH_FOV_DEG } from './BronchLabelOverlay'

/** Drives the R3F camera from the scope pose every frame. */
export function ScopeCamera({
  pose,
  fovDeg = BRONCH_FOV_DEG,
}: {
  pose: ScopePoseSnapshot
  fovDeg?: number
}) {
  const { camera, size } = useThree()
  useFrame(() => {
    updateScopeCamera(camera, pose, size.width / Math.max(1, size.height), fovDeg)
  })

  return null
}

export function updateScopeCamera(
  camera: THREE.Camera,
  pose: ScopePoseSnapshot,
  aspect: number,
  fovDeg: number = BRONCH_FOV_DEG,
) {
  const frame = scopeOpticalFrame(pose)
  camera.position.set(...frame.position)
  camera.up.set(...frame.up)
  camera.lookAt(...add(frame.position, frame.forward))
  if (camera instanceof THREE.PerspectiveCamera) {
    const fov = verticalFov(fovDeg, aspect)
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }
  camera.updateMatrixWorld()
}
