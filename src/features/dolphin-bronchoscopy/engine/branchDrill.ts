import { nextOpeningHint } from '../content/branchMap'

/**
 * The find-the-branch drill, score-free. A target is named; the learner drives; arriving moves on.
 * A turn off the passage to the target is reported as a hint naming where the scope is and where
 * the target leaves, never counted. Nothing here is stored or timed.
 */
export interface DrillState {
  readonly targets: readonly string[]
  readonly index: number
  /** Targets reached by driving, in order. Skipped ones are not here. */
  readonly arrived: readonly string[]
  readonly hint: string | null
  readonly showBeacon: boolean
  readonly done: boolean
}

export type DrillAction =
  /** The scope entered a place. `pathAbbrs` is the passage from the root to it. */
  | { readonly type: 'LOCATION'; readonly abbr: string; readonly pathAbbrs: readonly string[] }
  | { readonly type: 'NEXT' }
  | { readonly type: 'SKIP' }
  | { readonly type: 'SHOW_ME' }
  | { readonly type: 'RESET' }

export function initialDrillState(targets: readonly string[]): DrillState {
  return {
    targets,
    index: 0,
    arrived: [],
    hint: null,
    showBeacon: false,
    done: targets.length === 0,
  }
}

export function currentDrillTarget(state: DrillState): string | null {
  return state.done ? null : (state.targets[state.index] ?? null)
}

/** The labels a target's passage runs through, for telling a detour from progress. */
export function onPassageTo(target: string, abbr: string, targetPath: readonly string[]): boolean {
  return abbr === target || targetPath.includes(abbr)
}

function advance(state: DrillState): DrillState {
  const index = state.index + 1
  return { ...state, index, hint: null, showBeacon: false, done: index >= state.targets.length }
}

export function drillReducer(
  passageOf: (target: string) => readonly string[],
): (state: DrillState, action: DrillAction) => DrillState {
  return (state, action) => {
    const target = currentDrillTarget(state)
    switch (action.type) {
      case 'LOCATION': {
        if (!target) return state
        if (action.abbr === target) {
          return advance({ ...state, arrived: [...state.arrived, target] })
        }
        if (!onPassageTo(target, action.abbr, passageOf(target))) {
          const where = nextOpeningHint(target)
          return {
            ...state,
            hint: `You turned into ${action.abbr}, off the way to ${target}. Back out to the last fork.${
              where ? ` ${where}.` : ''
            }`,
          }
        }
        return state.hint ? { ...state, hint: null } : state
      }
      case 'NEXT':
      case 'SKIP':
        return target ? advance(state) : state
      case 'SHOW_ME':
        return target ? { ...state, showBeacon: true } : state
      case 'RESET':
        return initialDrillState(state.targets)
      default:
        return state
    }
  }
}
