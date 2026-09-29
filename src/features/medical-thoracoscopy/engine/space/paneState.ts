import type {
  CrossSection,
  ScopePose,
  SpacePaneState,
  SpaceReadiness,
  ZoneLedger,
} from '../../components/space/types'
import { ledgerFrom, type Coverage } from './coverage'
import { crossSectionOf } from './crossSection'
import type { LoadedSpace } from './loadSpace'
import type { EngineState } from './spaceReducer'
import { refusalOf } from './spaceWords'

/**
 * The last cut and the last ledger, kept by the identity of what they were made from: a tick of the
 * clock changes neither the pose nor what has been seen, so it need not cut the proxies again.
 */
let lastCut: {
  readonly space: LoadedSpace
  readonly pose: ScopePose
  readonly lungStep: number
  readonly toolMm: number | null
  readonly cut: CrossSection
} | null = null
let lastLedger: {
  readonly coverage: Coverage
  readonly space: LoadedSpace
  readonly reach: readonly number[] | null
  readonly ledger: ZoneLedger
} | null = null

function cutOf(
  space: LoadedSpace,
  pose: ScopePose,
  lungStep: number,
  tool: EngineState['tool'],
): CrossSection {
  const toolMm = tool && tool.phase === 'extended' ? tool.extensionMm : null
  if (
    lastCut &&
    lastCut.space === space &&
    lastCut.pose === pose &&
    lastCut.lungStep === lungStep &&
    lastCut.toolMm === toolMm
  ) {
    return lastCut.cut
  }
  const cut = crossSectionOf(
    space,
    pose,
    lungStep,
    tool ? { phase: tool.phase, extensionMm: tool.extensionMm } : undefined,
  )
  lastCut = { space, pose, lungStep, toolMm, cut }
  return cut
}

function ledgerOf(
  coverage: Coverage,
  space: LoadedSpace,
  reach: readonly number[] | null,
): ZoneLedger {
  if (
    lastLedger &&
    lastLedger.coverage === coverage &&
    lastLedger.space === space &&
    lastLedger.reach === reach
  ) {
    return lastLedger.ledger
  }
  const ledger = ledgerFrom(coverage, space.samples, reach)
  lastLedger = { coverage, space, reach, ledger }
  return ledger
}

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
    ledger: ledgerOf(state.coverage, space, reach),
    refusal: refusalOf(state.limit, state.lungHeld, wallZone, state.tool?.touching ?? false),
    crossSection:
      readiness.kind === 'ready' ? cutOf(space, state.pose, state.lungStep, state.tool) : null,
    clock: { held: state.clockHeld },
    lungStep: state.lungStep,
    ...(state.tool
      ? {
          tool: {
            phase: state.tool.phase,
            extensionMm: state.tool.extensionMm,
            touching: state.tool.touching,
            authorised: state.tool.authorised,
          },
        }
      : {}),
  }
}
