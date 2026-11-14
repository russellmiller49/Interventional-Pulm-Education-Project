import type { ScopeEventId, ScopeGoal, ScopeState } from '../../components/scope/types'
import { brokenWithout, type ScopeGoalClaim } from './scopeGoalEvaluation'

/**
 * How a finished scope card is allowed to describe itself (A4, A5).
 *
 * The walkthrough reached the authored target, carried on into the left main bronchus, and read
 * "Done. Every goal on this card is met." in the lead, five green ticks beside it, and the model's
 * limit in small grey type underneath — beside a field of mucosa with no lumen in it. The
 * independent review of that repair was right that a qualifier under a completion headline does not
 * bound the headline: the learner has to reconcile the two, and the headline wins.
 *
 * So the headline itself says what was established. A card whose goals are the events of the
 * attempt reports a **record**, never an assessment; the live readings, where a card has any, are
 * named separately; and what the model cannot establish is stated beside the ticks rather than
 * under them. One place for the words, so the Now card and the pane's own list cannot drift apart.
 *
 * Nothing here judges the image. The model has no measure of a visible lumen, and this copy must
 * never imply one.
 */

/** The heading over a card's goal rows, by what those rows can establish. */
export const GOAL_GROUP_HEADING: Readonly<Record<ScopeGoalClaim, string>> = {
  history: 'On the record for this attempt',
  current: 'Read from the scope right now',
  mixed: 'On the record for this attempt, and read from the scope right now',
}

/** Before the rows are met they are still a to-do list, and the heading says so. */
export const GOAL_PENDING_HEADING = 'What this card is waiting for'

/**
 * The same card in a rewritten section (educator feedback, 2026-10-13: the goal card's wording was
 * too much and confusing). The course says once, on its hub, what the simulator does not judge, so
 * these lines only say what to do and when it is done. None of them says the view is a good one.
 */
export const PLAIN_GOALS_HEADING = 'Goals for this task'
export const PLAIN_GOALS_DONE_HEADING = 'Goals met'
export const PLAIN_NEXT_GOAL_HEADING = 'Your next goal'
export const PLAIN_DONE_LEAD = 'All the goals for this task are met.'

/** The heading over the rows: a to-do while any is outstanding, a record once they are all met. */
export function goalListHeading(claim: ScopeGoalClaim, allMet: boolean, plain = false): string {
  if (plain) return allMet ? PLAIN_GOALS_DONE_HEADING : PLAIN_GOALS_HEADING
  return allMet ? GOAL_GROUP_HEADING[claim] : GOAL_PENDING_HEADING
}

/** The per-row marker, used where one card carries both kinds. */
export const GOAL_CLAIM_TAG: Readonly<Record<ScopeGoalClaim, string>> = {
  history: 'Recorded',
  current: 'Now',
  mixed: 'Recorded and now',
}

/** What the model measures, and what it does not, beside the rows rather than under them. */
export const GOAL_MODEL_LIMIT =
  'The model records where the tip went, the contacts it counted and the views it marked as lost. It does not judge the bronchoscope image, so nothing on this card says the view on the screen is usable.'

/** The lead on a finished card: what was established, never that the current view is acceptable. */
export function scopeDoneLead(claim: ScopeGoalClaim, plain = false): string {
  if (plain) return PLAIN_DONE_LEAD
  switch (claim) {
    case 'history':
      return 'Recorded: every step this card asks for.'
    case 'current':
      return 'Done: every reading this card asks for holds now.'
    case 'mixed':
      return 'Recorded: every step this card asks for, and its live readings hold.'
  }
}

/** Where the tip is at this moment, in the words the caption strip already uses. */
export function scopeNowLine(state: Pick<ScopeState, 'location'>): string {
  return `Where the tip is now: ${state.location.fullLabel}.`
}

/** What the learner did that rules a goal out, in the words the goal card says it. */
const BROKEN_WITHOUT_WORDS: Partial<Record<ScopeEventId, string>> = {
  'accessory-unsafe': 'You asked for an unsafe move with the tool, and it was not done.',
  'advanced-against-closure': 'You advanced against closed folds.',
  'advanced-in-red-out': 'You advanced while the field was red.',
  'suction-in-red-out': 'You used suction while the field was red.',
  'advanced-blind': 'You advanced while the picture was smeared.',
  'bench-advanced-off-target': 'You advanced before the target was centered.',
}

/**
 * Said unasked when this attempt can no longer meet one of its goals (owner feedback, 2026-11-03).
 *
 * A goal that says "without" an unsafe move stays unmet for the rest of the attempt once that move
 * has been made, and nothing on the card said so: the learner could go on trying. This names what
 * happened and the way out. Null while every unmet goal can still be met.
 */
export function blockedGoalSentence(
  goals: readonly ScopeGoal[],
  state: ScopeState,
  canReset: boolean,
): string | null {
  const broken = goals.flatMap((goal) => {
    const event = brokenWithout(goal.test, state)
    return event ? [event] : []
  })
  if (broken.length === 0) return null
  const cause = BROKEN_WITHOUT_WORDS[broken[0]] ?? 'Something in this attempt rules a goal out.'
  const which =
    broken.length === 1
      ? 'The goal that asks you to avoid it cannot be met in this attempt.'
      : 'The goals that ask you to avoid it cannot be met in this attempt.'
  return `${cause} ${which}${canReset ? ' Select Reset the scope to start again.' : ''}`
}
