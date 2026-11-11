import type { Vec3 } from './coordinates'

/**
 * Where an opening's number is anchored in the scope's picture: points along the daughter airway
 * from the fork, deepest first, so the number sits in the opening and not on the spur in front
 * of it. The picture uses the deepest one it can see.
 */
export function openingAnchors(fork: readonly number[], daughter: readonly number[]): Vec3[] {
  const delta = [daughter[0] - fork[0], daughter[1] - fork[1], daughter[2] - fork[2]]
  const length = Math.hypot(delta[0], delta[1], delta[2]) || 1
  const at = (mm: number) =>
    [0, 1, 2].map((axis) => fork[axis] + (delta[axis] / length) * mm) as Vec3
  return [at(12), at(9), at(6), at(Math.min(3, length)), at(1.5)]
}
