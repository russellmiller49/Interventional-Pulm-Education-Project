import type { CordsState } from '../../components/scope/types'

/**
 * The teaching model's authored geometry and scripted timings.
 *
 * Every number here shapes the simulator, not a patient or a device: where the model larynx puts
 * the glottis, where the model tube ends, how long a scripted breath lasts. None of them is a
 * clinical measurement, a placement recommendation or a threshold, and the boundary sentence on
 * each view says so (knowledge spec §23.4: scripted states are labelled as scripted).
 */

/** Model larynx: the glottis plane, and the end of the subglottis where the trachea begins. */
export const LARYNX_GLOTTIS_MM = 30
export const LARYNX_LENGTH_MM = 45
/** The tip must be roughly straight at the glottis; a strongly bent tip is refused, not guided. */
export const GLOTTIS_ALIGN_LIMIT_DEG = 30

/** The scripted breath: expiration first, so crossing needs a wait; a cough every third breath. */
export const BREATH_CYCLE_SEC = 4
export const BREATH_OUT_SEC = 2.4
export const COUGH_EVERY_BREATHS = 3
export const COUGH_WINDOW_SEC: readonly [number, number] = [0.8, 1.6]

export type BreathPhase = 'breath-out' | 'breath-in' | 'cough'

export function breathPhaseAt(clockSec: number): BreathPhase {
  const t = Math.max(0, clockSec)
  const breath = Math.floor(t / BREATH_CYCLE_SEC)
  const within = t - breath * BREATH_CYCLE_SEC
  if (within >= BREATH_OUT_SEC) return 'breath-in'
  if (
    breath % COUGH_EVERY_BREATHS === COUGH_EVERY_BREATHS - 1 &&
    within >= COUGH_WINDOW_SEC[0] &&
    within < COUGH_WINDOW_SEC[1]
  )
    return 'cough'
  return 'breath-out'
}

export function cordsForPhase(phase: BreathPhase): CordsState {
  switch (phase) {
    case 'breath-in':
      return 'abducted'
    case 'breath-out':
      return 'narrowing'
    case 'cough':
      return 'adducted'
  }
}

/** Model endotracheal tube along the trachea: where the scope starts, and where the tube ends. */
export const TUBE_START_MM = 35
export const TUBE_TIP_MM = 70
/** Inside a tube a bent tip meets its wall; beyond this bend an advance registers contact. */
export const TUBE_CONTACT_DEFLECTION_DEG = 15

/** The main carina is "reached" within this distance above it, where both origins are in view. */
export const CARINA_ZONE_MM = 20

/** Reducing the bend by this much lifts the lens off the wall (grammar row `red-out`). */
export const RED_OUT_RELAX_DEG = 15

/** A change in depth beyond this during a hold is drift (drill D10). */
export const DRIFT_TOLERANCE_MM = 0.5

/** Inside an airway this far (or half its first segment, if shorter), the view reaches beyond its opening. */
export const DISTAL_VIEW_MM = 8

/**
 * Mid-airway, an advance with the tip aimed at the wall touches it when the wall along the aim is
 * within this many steps. Small segments therefore demand an aligned tip; the trachea and main
 * bronchi forgive a bend. A geometric proxy from the centerline radius, not a collision model.
 */
export const WALL_AIM_STEPS = 2

/** Where an authored start places the tip along its airway's first labelled segment. */
export const START_FRACTION = { proximal: 0.15, mid: 0.5, distal: 0.85 } as const

/** Withdrawing this far lifts the lens off the wall (grammar row `red-out`: withdraw slightly). */
export const RED_OUT_WITHDRAW_MM = 2

/** Drill D10: how long the view is held for the scripted image, in simulated seconds. */
export const HOLD_SECONDS = 5

/**
 * Within this distance of a bifurcation, a tip bent into one of the branch openings is aimed at a
 * lumen rather than at the wall, so an advance there is not a wall contact.
 */
export const BRANCH_APPROACH_MM = 6

/** The cone around a branch's direction that counts as aimed into it: the aim guard's own cone. */
export const AIM_CONE_DEG = 40

/** One insertion command is travelled in increments no longer than this, so no airway is skipped. */
export const MOTION_INCREMENT_MM = 0.5
