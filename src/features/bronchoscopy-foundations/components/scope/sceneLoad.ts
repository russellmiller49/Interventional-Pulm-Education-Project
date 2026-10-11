/**
 * The 3D view's load, as one small state machine (BF-01 finding 3).
 *
 * A view is `loading` until its first frame is drawn, then `ready`; an asset, a renderer or a
 * render error makes it `failed`. Every way back to `loading` is counted here, so a view can never
 * sit in `loading` without end:
 * - the learner's own retry starts a new attempt, as often as they ask;
 * - a lost graphics context is recovered without asking, but only `MAX_AUTO_RECOVERIES` times in
 *   one attempt — after that the view fails and the learner decides;
 * - an attempt that has not drawn after `SCENE_LOAD_DEADLINE_MS` on screen fails, with the same
 *   retry and the schematic view on offer.
 *
 * The machine holds no clinical or scope state. It never enables a control: the pane opens the
 * controls on `ready` (or in the schematic view) exactly as before.
 */
export type SceneLoadStatus = 'loading' | 'ready' | 'failed'

export interface SceneLoadState {
  readonly status: SceneLoadStatus
  /** Each attempt reloads the assets and mounts a fresh canvas. */
  readonly attempt: number
  /** Recoveries from a lost graphics context since the learner last asked. */
  readonly autoRecoveries: number
  /** Why the view last failed; null while it has not. */
  readonly failure: 'error' | 'deadline' | 'context-lost' | null
}

export type SceneLoadEvent =
  | { readonly type: 'drawn' }
  | { readonly type: 'failed' }
  | { readonly type: 'deadline' }
  | { readonly type: 'context-lost' }
  | { readonly type: 'retry' }

/** Time a view may stay `loading` while it is on screen in a visible tab. */
export const SCENE_LOAD_DEADLINE_MS = 45_000
export const MAX_AUTO_RECOVERIES = 2

export const INITIAL_SCENE_LOAD: SceneLoadState = {
  status: 'loading',
  attempt: 0,
  autoRecoveries: 0,
  failure: null,
}

export function reduceSceneLoad(state: SceneLoadState, event: SceneLoadEvent): SceneLoadState {
  switch (event.type) {
    case 'drawn':
      // A frame drawn after the view failed belongs to an attempt already given up on.
      return state.status === 'loading' ? { ...state, status: 'ready', failure: null } : state
    case 'failed':
      return state.status === 'failed' ? state : { ...state, status: 'failed', failure: 'error' }
    case 'deadline':
      return state.status === 'loading'
        ? { ...state, status: 'failed', failure: 'deadline' }
        : state
    case 'context-lost':
      if (state.status === 'failed') return state
      return state.autoRecoveries < MAX_AUTO_RECOVERIES
        ? {
            status: 'loading',
            attempt: state.attempt + 1,
            autoRecoveries: state.autoRecoveries + 1,
            failure: null,
          }
        : { ...state, status: 'failed', failure: 'context-lost' }
    case 'retry':
      return { status: 'loading', attempt: state.attempt + 1, autoRecoveries: 0, failure: null }
    default:
      return state
  }
}
