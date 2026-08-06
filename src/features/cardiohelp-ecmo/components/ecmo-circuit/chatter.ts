import type { EcmoSimulationState } from '../../engine/types'

// Pure drainage-chatter presentation logic, shared by the 3D scene, the 3D host's status cues and
// the tube shader. No react and no @react-three imports, so jest and node scripts can exercise it
// without a WebGL context — which is the only way this cue can be tested at all.

/** Judders per second. Fast enough to read as chatter, slow enough not to strobe. */
export const CHATTER_HZ = 4.5

/**
 * Whether the drainage limb should be shown juddering.
 *
 * One expression, one owner: the engine's `drainageChatter` (past drainage capacity *and*
 * pVen < −75 mmHg). Views used to derive their own threshold — the bedside scene gated a wide
 * collapse on `pVen.displayed <= -300`, which no authored drainage scenario reaches — so the map
 * said the line was chattering while the 3D scene showed a limb at rest.
 *
 * The pump check is presentational only: a stopped pump is not drawing anything shut, and the
 * engine's flag is not recomputed while the scenario is paused.
 */
export function drainageChatterActive(state: EcmoSimulationState): boolean {
  return state.device.pumpRunning && state.circuit.drainageChatter
}

/**
 * How far the drainage limb is crimped at a given moment of the chatter cycle.
 *
 * Reduced motion holds a single deep value instead of oscillating: still unmistakable as a sucked-
 * down limb, but not moving. The `phase` is a 0..1 position in the cycle; the raised sine makes the
 * limb snap shut and spring back rather than breathe, so it spends longer open than crimped.
 */
export function chatterPinchAmount({
  collapse,
  phase,
  reduceMotion,
}: {
  collapse: number
  phase: number
  reduceMotion: boolean
}): number {
  const clamped = Math.min(1, Math.max(0, collapse))
  if (reduceMotion) return clamped * 0.42
  const judder = Math.pow(Math.sin(phase * Math.PI * 2) * 0.5 + 0.5, 1.6)
  return clamped * (0.12 + judder * 0.5)
}
