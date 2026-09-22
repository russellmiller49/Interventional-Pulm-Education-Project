import type { ScopeState } from '../../components/scope/types'
import type { ScopeGoalClaim } from './scopeGoalEvaluation'

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

/** The heading over the rows: a to-do while any is outstanding, a record once they are all met. */
export function goalListHeading(claim: ScopeGoalClaim, allMet: boolean): string {
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
export function scopeDoneLead(claim: ScopeGoalClaim): string {
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
