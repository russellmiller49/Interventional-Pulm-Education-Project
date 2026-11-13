import {
  EUSB_HOLD_AREA_FRACTION,
  EUSB_HOLD_MS,
} from '../../../../../src/lib/eus-b-guided-contract';
import type { EusbHeld } from '../../../../../src/lib/eus-b-guided-bridge';

/**
 * The "bring this into the image and hold it" task, as a pure state machine.
 *
 * The target counts as held while the area of it the beam reaches is at least a set share of its
 * area in the reference view. Held without a break for a set time, the task is done and stays
 * done: the image at that moment is kept and later frames cannot undo it.
 *
 * A learner who is stuck can ask to be shown the view. The lab then drives the scope there, and
 * the task is closed as shown, never as found: nothing the scope does afterwards can turn a shown
 * view into a found one. Only a fresh start of the task can.
 *
 * Time is passed in. The component that runs this times the hold with a timer, never with frame
 * counts or animation frames: frames stop arriving once the scope is still, and a hidden tab
 * pauses animation frames.
 */
export interface ReachState {
  /** When the current unbroken hold began, or null while the target is not held. */
  heldSince: number | null;
  /** The newest image in which the target was held. */
  candidate: EusbHeld | null;
  /** Share of the reference area in the newest frame. */
  areaRatio: number;
  found: boolean;
  foundAt?: EusbHeld;
  /** The lab drove the scope to the view. `shownAt` is the lab's reference image. */
  shown: boolean;
  shownAt?: EusbHeld;
}

export const REACH_START: ReachState = {
  heldSince: null,
  candidate: null,
  areaRatio: 0,
  found: false,
  shown: false,
};

export type ReachEvent =
  /** A frame was drawn: how much of the target it shows, and what that image is. */
  | { type: 'frame'; areaRatio: number; now: number; image: EusbHeld }
  /** The hold timer fired. */
  | { type: 'tick'; now: number }
  /** The lab has driven the scope to the target's view at the learner's request. */
  | { type: 'shown'; image: EusbHeld }
  | { type: 'reset' };

export const targetIsHeld = (areaRatio: number) => areaRatio >= EUSB_HOLD_AREA_FRACTION;

function finish(state: ReachState, now: number): ReachState {
  if (state.found || state.heldSince === null || !state.candidate) return state;
  if (now - state.heldSince < EUSB_HOLD_MS) return state;
  return { ...state, found: true, foundAt: state.candidate };
}

export function reachReducer(state: ReachState, event: ReachEvent): ReachState {
  if (event.type === 'reset') return REACH_START;
  // Done stays done, and shown stays shown, whatever arrives afterwards.
  if (state.found || state.shown) return state;
  if (event.type === 'shown')
    return {
      ...state,
      heldSince: null,
      candidate: null,
      shown: true,
      shownAt: { ...event.image, source: 'reference' },
    };
  if (event.type === 'tick') return finish(state, event.now);
  const areaRatio = Number.isFinite(event.areaRatio) ? Math.max(0, event.areaRatio) : 0;
  if (!targetIsHeld(areaRatio)) return { ...state, heldSince: null, candidate: null, areaRatio };
  return finish(
    {
      ...state,
      heldSince: state.heldSince ?? event.now,
      candidate: event.image,
      areaRatio,
    },
    event.now,
  );
}

/** How long the target has been held without a break, capped at the time the task asks for. */
export function reachHeldMs(state: ReachState, now: number) {
  if (state.found) return EUSB_HOLD_MS;
  if (state.heldSince === null) return 0;
  return Math.min(EUSB_HOLD_MS, Math.max(0, now - state.heldSince));
}

/** Milliseconds until the hold completes, or null when no hold is running. */
export function reachTimeLeftMs(state: ReachState, now: number) {
  if (state.found || state.shown || state.heldSince === null) return null;
  return Math.max(0, EUSB_HOLD_MS - (now - state.heldSince));
}
