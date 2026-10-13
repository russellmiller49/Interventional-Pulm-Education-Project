import type {
  CordsState,
  ScopeCommand,
  ScopeScriptId,
  ScopeViewSpec,
} from '../../components/scope/types'

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

/**
 * The scripts whose scene carries a clock of its own: a patient breathing, an assistant waiting.
 *
 * Their model moves on simulated time rather than on anything the learner does, so the pane is
 * allowed to hand the host `tick` while the step is ready, enabled and on screen. This is the one
 * list both sides read (`components/scope/useScopePlayback.ts` produces the ticks,
 * `engine/stageSession.ts` accepts them), so the producer and the consumer cannot drift apart.
 *
 * Environment time is not learner work. A `tick` records no input mode (`reduceScope`), so it can
 * never make an untouched start state count as something the learner did, and every other scripted
 * command stays refused on an authored step.
 */
export const ENVIRONMENT_CLOCK_SCRIPTS: ReadonlySet<ScopeScriptId> = new Set<ScopeScriptId>([
  'breathing-cords',
  'assistant-interrupt',
])

/** Whether this command is the scripted scene's own clock on a view that runs one. */
export function isEnvironmentClockCommand(
  view: Pick<ScopeViewSpec, 'script' | 'benchSuction'>,
  command: ScopeCommand,
): boolean {
  return (
    command.type === 'tick' &&
    (view.benchSuction === true || (!!view.script && ENVIRONMENT_CLOCK_SCRIPTS.has(view.script)))
  )
}

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
 *
 * Unaided travel only. Guided travel follows the lumen and registers no contact from a bend
 * (educator feedback, 2026-10-13): how a bent tip meets a wall is learned with a scope in the hand.
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

/** The cone around a branch's direction that counts as aimed into it, for the wall proxy above. */
export const AIM_CONE_DEG = 40

/**
 * Guided travel's aim guard (educator feedback, 2026-10-13: the driving asked for more precision
 * than a screen can teach).
 *
 * The picture decides. At a fork the scope enters the opening nearest the centre of the picture,
 * as that picture is from where the scope waits (`FORK_STANDOFF_MM`). The opening has to be in
 * the picture (within the cone) and plainly the nearest (by the margin, in degrees between the
 * view axis and each opening). So an opening the learner has brought toward the centre is the one
 * entered, with no exact aim asked for: at the main carina a bend of some six degrees toward a
 * side is enough.
 *
 * The margin is set so that a tip left straight still stops at the forks where the course wants a
 * choice made: the main carina, the end of each main bronchus and of the bronchus intermedius,
 * the middle lobe's two segments and the superior segment's opening all lie within some ten
 * degrees of each other in a straight tip's picture. Deeper, where one opening is plainly the way
 * ahead, a straight tip follows the airway on. A smaller margin let a held Advance run from the
 * start of a task to a segment with no choice made at all.
 *
 * The rule it replaces read the direction each branch leaves the fork in, which the picture does
 * not show: an opening centred in the view could lose to the airway's continuation.
 */
export const GUIDED_AIM_CONE_DEG = 50
export const GUIDED_AIM_MARGIN_DEG = 12
/**
 * Where a guided tip waits when its aim at a fork is undecided: this far short of the fork, so the
 * picture it is asked to choose from still holds both openings and their names. Right at the fork
 * the picture is the ridge between them.
 */
export const FORK_STANDOFF_MM = 8

/** One insertion command is travelled in increments no longer than this, so no airway is skipped. */
export const MOTION_INCREMENT_MM = 0.5
