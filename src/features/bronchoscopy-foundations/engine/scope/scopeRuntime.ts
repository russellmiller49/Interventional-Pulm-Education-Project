import type { ScopeState, ScopeViewSpec } from '../../components/scope/types'
import type { ScopeCase } from './scopeCase'

/**
 * The reducer's bookkeeping beyond the pane contract.
 *
 * The pane reads `ScopeState`; the host keeps the reducer's `ScopeRuntimeState` (a `ScopeState`
 * with `runtime` added) and hands it back on the next command. `runtime` holds the causes behind
 * what the pane shows — the lens smear and the tip against the wall are separate facts, so clearing
 * one never hides the other — and where a scripted hold began.
 */
export interface ScopeRuntime {
  /** The lens itself: smeared by the lens script until cleared. */
  readonly lens: 'clear' | 'contaminated'
  /** The tip against the wall: the depth it happened at and how bent the tip was then. */
  readonly redOut: { readonly depthMm: number; readonly bendDeg: number } | null
  /** An airway-triggered script has begun (the first entry into its airway). */
  readonly scriptBegun: boolean
  /** Drill D10: the insertion depth the hold is measured from. */
  readonly holdDepthMm: number | null
}

export interface ScopeRuntimeState extends ScopeState {
  readonly runtime: ScopeRuntime
}

/** What every command is reduced against: the step's view and the loaded case. */
export interface ScopeContext {
  readonly view: ScopeViewSpec
  /** Null only where the tip never enters the airway tree (the bench). */
  readonly scopeCase: ScopeCase | null
}
