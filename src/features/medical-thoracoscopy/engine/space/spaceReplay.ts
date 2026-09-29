import type { SpaceCommand, SpaceInputMode, SpaceSnapshotId } from '../../components/space/types'
import type { SpaceResolver } from './loadSpace'
import { reduce, type EngineState } from './spaceReducer'

/**
 * Replay a script of actions, each at a time, under a schedule of ticks (plan, section 7): the
 * clock is ticked up to each action's time in the schedule's own steps, then the action is applied.
 * Any schedule must give the same state and the same events.
 */
export type ScriptAction =
  | {
      readonly type: 'command'
      readonly command: SpaceCommand
      readonly input: SpaceInputMode
      /** Left out, the command is issued against the state it meets, so it is never stale. */
      readonly snapshot?: SpaceSnapshotId
    }
  | { readonly type: 'lung-target'; readonly step: number }

export interface TimedAction {
  readonly atMs: number
  readonly action: ScriptAction
}

export function replay(
  start: EngineState,
  script: readonly TimedAction[],
  resolver: SpaceResolver,
  tickMs: (clockMs: number) => number,
  untilMs: number,
): EngineState {
  let state = start
  const advanceTo = (time: number) => {
    while (state.clockMs < time) {
      const step = Math.min(Math.max(1, Math.floor(tickMs(state.clockMs))), time - state.clockMs)
      state = reduce(state, { type: 'tick', ms: step }, resolver)
    }
  }
  for (const { atMs, action } of [...script].sort((a, b) => a.atMs - b.atMs)) {
    advanceTo(atMs)
    const snapshotted =
      action.type === 'command'
        ? { ...action, snapshot: action.snapshot ?? state.snapshot }
        : action
    state = reduce(state, snapshotted, resolver)
  }
  advanceTo(untilMs)
  return state
}
