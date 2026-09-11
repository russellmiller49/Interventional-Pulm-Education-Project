import type { ScopeInputs, ScopeViewSpec } from '../../components/scope/types'

/**
 * The teaching model's defaults and limits for the five controls.
 *
 * These bound the simulator, not a device. A real bronchoscope's bending range, outer diameter
 * and channel come from its instructions for use (local policy `scope_ifu`); the model's tip
 * matches the collider's sweep radius (`FLEXIBLE_TIP_RADIUS_MM`) so the drawn tip and the
 * collision check agree.
 */
export const MODEL_DEFLECTION_LIMIT_DEG = 120
export const MODEL_TIP_OD_MM = 3.8
export const DEFAULT_STEP_MM = 3

export const DEFAULT_SCOPE_INPUTS: ScopeInputs = {
  rotationDeg: 0,
  deflectionDeg: 0,
  suction: false,
  accessory: 'none',
  accessoryPosition: 'none',
  cords: 'abducted',
  tube: null,
  scopeOdMm: MODEL_TIP_OD_MM,
  stepMm: DEFAULT_STEP_MM,
  branchLabels: false,
}

/** Rotation wraps to (−180°, 180°]: the readout and the metric goals read the wrapped value. */
export function normalizeRotationDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

export function clampDeflectionDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  return Math.max(-MODEL_DEFLECTION_LIMIT_DEG, Math.min(MODEL_DEFLECTION_LIMIT_DEG, deg))
}

/** A step's starting inputs: the view's defaults over the model's, within the model's limits. */
export function resolveScopeInputs(view: Pick<ScopeViewSpec, 'defaults'>): ScopeInputs {
  const merged: ScopeInputs = { ...DEFAULT_SCOPE_INPUTS, ...(view.defaults ?? {}) }
  return {
    ...merged,
    rotationDeg: normalizeRotationDeg(merged.rotationDeg),
    deflectionDeg: clampDeflectionDeg(merged.deflectionDeg),
    stepMm: merged.stepMm > 0 ? merged.stepMm : DEFAULT_STEP_MM,
    scopeOdMm: merged.scopeOdMm > 0 ? merged.scopeOdMm : MODEL_TIP_OD_MM,
  }
}
