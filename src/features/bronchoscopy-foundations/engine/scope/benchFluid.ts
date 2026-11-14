import type { ScopeState } from '../../components/scope/types'

/** Dimensionless bench reservoir. Geometry and emptying rate are teaching conventions, not patient measurements. */
export const BENCH_FLUID = { surfaceStartMm: 12, bottomMm: 48, removalPerSecond: 0.15 } as const

export function benchFluidObservation(state: Pick<ScopeState, 'depthMm' | 'signals' | 'inputs'>) {
  const remaining = state.signals.benchFluidRemaining ?? 1
  const surfaceMm =
    BENCH_FLUID.bottomMm - remaining * (BENCH_FLUID.bottomMm - BENCH_FLUID.surfaceStartMm)
  const submerged =
    remaining > 0 && state.depthMm > surfaceMm + 0.01 && state.depthMm < BENCH_FLUID.bottomMm
  return { remaining, surfaceMm, submerged, aspirating: submerged && state.inputs.suction }
}
