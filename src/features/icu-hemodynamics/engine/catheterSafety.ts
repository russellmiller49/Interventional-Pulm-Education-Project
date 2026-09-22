import type { HemodynamicSimulationState } from './types'

/**
 * One rule for "may this activity move on yet", used by every route out of a step.
 *
 * The module has two balloons — the flow-directed balloon that floats the tip through the right
 * heart, and the same balloon used briefly to occlude a branch for a wedge — and a third state in
 * which the tip is between two places. Before HD-PRE-REVIEW-01 the host asked about them
 * inconsistently: the banner, Back, the task list and the section links read both balloon flags,
 * while Continue and Finish read only `balloonInflated`. A section whose last hands-on step ends
 * with the tip in the ventricle and the flow-directed balloon up therefore showed the recovery
 * banner and still finished, marking the section reviewed (report L5-07, Figure 29).
 *
 * So the question is asked in exactly one place. `catheterTransitionHold` returns what is true now,
 * why it holds, and — the part the banner was missing (L5-08) — which existing control ends it,
 * named by the key the quick-control spotlight already uses. Nothing here recovers anything or
 * writes any state: a hold is a description of the simulation, and only the learner's own action on
 * a real control clears it.
 *
 * What it deliberately does not do is trap a reader. `HemodynamicsStageHost` pairs every hold with
 * an abandon-and-reset path that says in as many words that it resets the simulated activity and
 * records no float, no confirmed artery, no deflation and no completed skill.
 */
export type CatheterHoldReason = 'wedge-balloon' | 'float-balloon' | 'in-flight'

export interface CatheterHold {
  readonly reason: CatheterHoldReason
  /** What is true on the simulator right now, said plainly. */
  readonly state: string
  /** The recovery this state actually supports, naming the control that performs it. */
  readonly recovery: string
  /**
   * The quick-control key of that control (`quickControlId`), or `null` when the simulation is
   * finishing a movement on its own and there is nothing for the learner to press.
   */
  readonly controlKey: 'deflate' | 'withdraw' | 'advance' | null
}

/**
 * The current hold on leaving a step, or `null` when the activity may move.
 *
 * Order matters. An inflated occlusion balloon is the state with the shortest safe life, so it is
 * reported first. A tip that is moving is reported next, because "wait" is the only thing to do
 * while a transition is running, even when the flow-directed balloon is up for it.
 */
export function catheterTransitionHold(state: HemodynamicSimulationState): CatheterHold | null {
  const catheter = state.catheter
  if (catheter.balloonInflated) {
    return {
      reason: 'wedge-balloon',
      state: 'The balloon is inflated and occluding a branch.',
      recovery:
        'Deflate it now with Deflate in the balloon controls, then look at the monitor and say whether the pulmonary-artery tracing has come back.',
      controlKey: 'deflate',
    }
  }
  if (catheter.targetPosition !== null) {
    return {
      reason: 'in-flight',
      state: `The tip is moving toward ${positionWords(catheter.targetPosition)}${
        catheter.floatBalloonInflated ? ', with the flow-directed balloon up' : ''
      }.`,
      recovery:
        'Wait for the movement to finish: the monitor keeps the last confirmed tracing until the tip arrives.',
      controlKey: null,
    }
  }
  if (catheter.floatBalloonInflated) {
    const atArtery = catheter.position === 'pa' || catheter.position === 'wedge'
    return {
      reason: 'float-balloon',
      state: `The flow-directed balloon is up with the tip in ${positionWords(catheter.position)}.`,
      recovery: atArtery
        ? 'Let it down from the tip controls before leaving this step.'
        : 'Finish the float: Advance until the pulmonary-artery tracing appears, where this simulation lets the balloon down, or Withdraw toward the right atrium, which lets it down as the tip comes back.',
      controlKey: atArtery ? 'withdraw' : 'advance',
    }
  }
  return null
}

/** Whether the activity may move past, jump between, re-enter or finish a step. */
export function catheterTransitionAllowed(state: HemodynamicSimulationState): boolean {
  return catheterTransitionHold(state) === null
}

function positionWords(position: HemodynamicSimulationState['catheter']['position']): string {
  switch (position) {
    case 'introducer':
      return 'the introducer'
    case 'ra':
      return 'the right atrium'
    case 'rv':
      return 'the right ventricle'
    case 'pa':
      return 'the pulmonary artery'
    case 'wedge':
      return 'an occluding distal position'
    default:
      return 'its current position'
  }
}

/**
 * The occlusion episode a pulmonary-artery-return observation belongs to.
 *
 * A confirmation that the artery came back is only about the occlusion that just ended. The check
 * was previously recorded under a bare key, so a click taken before any balloon went up, or left
 * over from an earlier task, satisfied the goal for every later wedge (report L6-05, Figure 32).
 * Keying it the way the flush check already keys its own observation — by the conditions the
 * observation was made under — makes a stale or premature confirmation impossible to reuse.
 *
 * `null` means there is no released occlusion to talk about yet: no episode has been taken, or one
 * is still running.
 */
export function paReturnEpisodeKey(state: HemodynamicSimulationState): string | null {
  const catheter = state.catheter
  if (catheter.wedgeEpisodeCount === 0) return null
  if (catheter.balloonInflated) return null
  return `episode-${catheter.wedgeEpisodeCount}`
}

/**
 * Whether the tracing the learner is looking at actually shows the artery back.
 *
 * Used to answer a learner's observation honestly rather than to answer it for them: the control
 * offers "it is back" and "it has not come back", and this says which the current simulation
 * supports.
 *
 * It says nothing about *who* ended the occlusion. The first version folded
 * `forcedSafetyRecovery` in, so after the simulation's own cutoff released the balloon — which
 * puts the tip back in the artery and a pulsatile pulmonary-artery tracing back on the monitor —
 * this reported "not returned", and the control then narrated a persistent occlusion over a trace
 * that had visibly come back (sanity review of HD-PRE-REVIEW-01, blocker 1). How an occlusion
 * ended and what the tracing shows are two facts, and only the second one is an observation.
 * `occlusionReleasedByLearner` carries the first.
 */
export function paWaveformReturned(state: HemodynamicSimulationState): boolean {
  const catheter = state.catheter
  return (
    catheter.position === 'pa' &&
    catheter.targetPosition === null &&
    !catheter.balloonInflated &&
    !catheter.floatBalloonInflated
  )
}

/**
 * Whether the learner ended the last occlusion, or the simulation ended it for them.
 *
 * The provenance half of the pair above, and the one the section's `balloon-down` goal turns on:
 * an automatic release is still not the learner's deflation, and still earns no credit for it.
 */
export function occlusionReleasedByLearner(state: HemodynamicSimulationState): boolean {
  return !state.catheter.forcedSafetyRecovery
}

/**
 * What this simulation is currently restricting, said as a simulation notice.
 *
 * The capstone opens with the tip sitting distally on a deflated balloon, which blocks the
 * pulmonary-artery flush; a learner following the step's stated order met that block as a small
 * disabled button and had to open a collapsed panel to find out why (report L9-02, Figure 38). The
 * notice puts the restriction where the restriction bites.
 *
 * It is deliberately not an alarm. The monitor's alarm bar models a device's alarms, and inventing
 * a manufacturer alarm for a catheter position would assert device behaviour no source here
 * supplies. This says what the simulation is doing, in the simulation's own name, and names no
 * withdrawal distance or recovery sequence — the module's source-review queue records an
 * unresolved disagreement about that guidance (HD-03-08) and it stays unresolved.
 */
export function catheterSimulationNotice(state: HemodynamicSimulationState): string | null {
  const catheter = state.catheter
  const falseWedge = state.measurementSystem.artifact === 'false-wedge'
  if (catheter.position === 'wedge' && !catheter.balloonInflated) {
    return `Simulation safety notice, not a device alarm: the tip is in an occluding distal position with the balloon down.${
      falseWedge
        ? ' This channel has kept its pulmonary-artery pulsatility, so its displayed value is not a validated occlusion pressure.'
        : ''
    } This simulation blocks a flush on the pulmonary-artery line until the tip is back in the artery.`
  }
  if (catheter.balloonInflated) {
    return 'Simulation safety notice, not a device alarm: the balloon is occluding a branch. This simulation blocks a flush on the pulmonary-artery line while it is up.'
  }
  if (catheter.floatBalloonInflated) {
    return 'Simulation safety notice, not a device alarm: the flow-directed balloon is up while the tip floats. This simulation blocks a flush on the pulmonary-artery line while it is.'
  }
  if (catheter.forcedSafetyRecovery) {
    return 'Simulation safety notice, not a device alarm: this simulation ended the last occlusion at its own fixed cutoff. That cutoff belongs to the simulation, not to any catheter.'
  }
  return null
}
