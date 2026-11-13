/**
 * The "mark the landmarks" task, as a pure state machine.
 *
 * The learner is asked for each landmark of a view in order, one at a time. A click on the asked
 * landmark marks it and moves on. Any other click is a miss: it is counted and nothing else
 * changes. A learner who cannot find one can ask to be shown it; it is then listed as shown, never
 * as marked. The task is done when every landmark is either marked or shown, and nothing changes
 * after that. Only a fresh start of the task clears it.
 */
export interface IdentifyState {
  /** Landmarks the learner clicked correctly, in the order asked. */
  keys: string[];
  /** Landmarks the lab showed at the learner's request. Never also in `keys`. */
  shown: string[];
  /** Clicks that missed the landmark being asked for. */
  wrong: number;
  /** The landmark that was being asked for when the newest click missed; null after a hit. */
  lastMiss: string | null;
  /** Where each marked landmark was clicked, as fractions of the image. */
  points: Record<string, { x: number; y: number }>;
}

export const IDENTIFY_START: IdentifyState = {
  keys: [],
  shown: [],
  wrong: 0,
  lastMiss: null,
  points: {},
};

export type IdentifyEvent =
  /** A click on the image: the structure it landed on, or null for none. */
  | { type: 'click'; key: string | null; at?: { x: number; y: number } }
  /** The learner asked to be shown the landmark now being asked for. */
  | { type: 'show' }
  | { type: 'reset' };

/** The landmark now being asked for, or null when all are marked or shown. */
export function identifyAsked(state: IdentifyState, landmarks: readonly string[]): string | null {
  return landmarks.find((key) => !state.keys.includes(key) && !state.shown.includes(key)) ?? null;
}

export function identifyDone(state: IdentifyState, landmarks: readonly string[]) {
  return landmarks.length > 0 && identifyAsked(state, landmarks) === null;
}

export function identifyReducer(
  state: IdentifyState,
  event: IdentifyEvent,
  landmarks: readonly string[],
): IdentifyState {
  if (event.type === 'reset') return IDENTIFY_START;
  const asked = identifyAsked(state, landmarks);
  // Done stays done, and a task with nothing to ask for takes no clicks.
  if (asked === null) return state;
  if (event.type === 'show')
    return { ...state, shown: [...state.shown, asked], lastMiss: null };
  if (event.key !== asked) return { ...state, wrong: state.wrong + 1, lastMiss: asked };
  return {
    ...state,
    keys: [...state.keys, asked],
    lastMiss: null,
    points: event.at ? { ...state.points, [asked]: event.at } : state.points,
  };
}

export type IdentifyRowState = 'done' | 'shown' | 'current' | 'waiting';

/** How each asked landmark stands, in the order asked. */
export function identifyRows(
  state: IdentifyState,
  landmarks: readonly string[],
): { key: string; number: number; state: IdentifyRowState }[] {
  const asked = identifyAsked(state, landmarks);
  return landmarks.map((key, index) => ({
    key,
    number: index + 1,
    state: state.keys.includes(key)
      ? 'done'
      : state.shown.includes(key)
        ? 'shown'
        : key === asked
          ? 'current'
          : 'waiting',
  }));
}

/** What the lesson page is told about the task. */
export function identifyReport(state: IdentifyState) {
  return { keys: [...state.keys], shown: [...state.shown], wrong: Math.min(10000, state.wrong) };
}
