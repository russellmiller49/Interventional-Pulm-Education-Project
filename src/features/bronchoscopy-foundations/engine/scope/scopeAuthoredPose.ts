import { plus, times, type OpticalFrame } from '@/lib/bronchoscopy-core/frame'
import type { ScopePoseSnapshot, Vec3 } from '@/lib/airway-anatomy/types'

import larynx from '../../../../../public/bronchoscopy-foundations/anatomy/larynx/larynx.json'
import type { ScopeInputs } from '../../components/scope/types'
import { scopeFrame } from './scopeFrame'

/** Authored teaching geometry, in mm. The renderer never reapplies rotation or deflection. */
export function authoredScopePose(
  place: 'bench' | 'larynx',
  depthMm: number,
  inputs: ScopeInputs,
): ScopePoseSnapshot {
  const path = larynx.pathLps as Vec3[]
  const distance = Math.max(0, Math.min(larynx.exitMm, depthMm))
  const index = (distance / larynx.exitMm) * (path.length - 1)
  const a = path[Math.floor(index)]
  const b = path[Math.min(path.length - 1, Math.floor(index) + 1)]
  const position: Vec3 =
    place === 'bench'
      ? [0, 0, depthMm]
      : (a.map((value, axis) => value + (b[axis] - value) * (index % 1)) as Vec3)
  const base: OpticalFrame =
    place === 'bench'
      ? { position, forward: [0, 0, 1], up: [0, 1, 0], right: [-1, 0, 0] }
      : {
          position,
          forward: larynx.frameLps.forward as Vec3,
          up: larynx.frameLps.anterior as Vec3,
          right: larynx.frameLps.left.map((value) => -value) as Vec3,
        }
  const frame = scopeFrame(base, inputs)
  return {
    opticalFrame: frame,
    shaftPathLps:
      place === 'bench'
        ? [[0, 0, depthMm - 50], position]
        : [...path.slice(0, Math.floor(index) + 1), position],
    edgeId: -1,
    distanceMm: depthMm,
    edgeLengthMm: place === 'larynx' ? larynx.exitMm : 0,
    tipLps: position,
    tangentLps: base.forward,
    lookAtLps: plus(position, times(frame.forward, 12)),
    branchNodeId: null,
    branchOptions: [],
    trailLps: [],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }
}
