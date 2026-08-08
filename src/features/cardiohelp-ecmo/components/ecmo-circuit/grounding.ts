import * as THREE from 'three'

// Pure grounding math shared by the R3F scene, the label layout and the offline harness. No react
// and no @react-three imports — node scripts and jest import this file directly.

/** A model-local axis-aligned bounding box, as read from the GLB. */
export interface ModelBounds {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

export interface AssetPlacement {
  /** Floor position. The Y component is computed, not authored — see {@link groundAsset}. */
  readonly x: number
  readonly z: number
  /** Euler angles in three.js default 'XYZ' order, matching an R3F `rotation` prop. */
  readonly rotation: readonly [number, number, number]
  readonly scale: number
}

/**
 * The world-space box an asset occupies once its placement has been applied.
 *
 * Computed by transforming all eight corners of the model-local box, because a rotated box's extent
 * is not its unrotated extent. The previous helper measured `min.y` on the *unrotated* GLB and then
 * rotated the group, which is only correct for a yaw — and the moment the console needed a roll to
 * stand up, that assumption put it through the floor.
 */
export function transformedBounds(
  bounds: ModelBounds,
  placement: Pick<AssetPlacement, 'rotation' | 'scale'>,
  origin: THREE.Vector3 = new THREE.Vector3(),
): THREE.Box3 {
  const matrix = new THREE.Matrix4().compose(
    origin,
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(placement.rotation[0], placement.rotation[1], placement.rotation[2]),
    ),
    new THREE.Vector3(placement.scale, placement.scale, placement.scale),
  )
  const box = new THREE.Box3()
  const corner = new THREE.Vector3()
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) {
        box.expandByPoint(corner.set(x, y, z).applyMatrix4(matrix))
      }
    }
  }
  return box
}

/**
 * Place a rotated, scaled asset so its lowest transformed point rests on the floor.
 *
 * Returns both the group origin to render at and the world box the asset then occupies, so labels
 * can be anchored to the object rather than to a hand-tuned height that drifts when the transform
 * changes.
 */
export function groundAsset(
  bounds: ModelBounds,
  placement: AssetPlacement,
  floorY: number,
): { origin: THREE.Vector3; worldBounds: THREE.Box3 } {
  const local = transformedBounds(bounds, placement)
  const origin = new THREE.Vector3(placement.x, floorY - local.min.y, placement.z)
  return { origin, worldBounds: local.clone().translate(origin) }
}
