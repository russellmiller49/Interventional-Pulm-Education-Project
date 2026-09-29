import type { SpacePaneState, SpaceReadiness } from '../../components/space/types'
import { ledgerFrom } from './coverage'
import { crossSectionOf } from './crossSection'
import type { LoadedSpace } from './loadSpace'
import type { EngineState } from './spaceReducer'
import { refusalOf } from './spaceWords'

/** The engine's state as the pane contract has it (slice 9): what every pane draws. */
export function paneStateOf(
  state: EngineState,
  space: LoadedSpace,
  reach: readonly number[] | null,
  readiness: SpaceReadiness = { kind: 'ready' },
): SpacePaneState {
  const wallZone =
    state.limit?.kind === 'wall' && state.limit.triangle >= 0
      ? (space.triangleZones[state.limit.triangle] ?? null)
      : null
  return {
    snapshot: state.snapshot,
    readiness,
    pose: state.pose,
    inView: state.inView,
    ledger: ledgerFrom(state.coverage, space.samples, reach),
    refusal: refusalOf(state.limit, state.lungHeld, wallZone),
    crossSection:
      readiness.kind === 'ready' ? crossSectionOf(space, state.pose, state.lungStep) : null,
    clock: { held: state.clockHeld },
  }
}
