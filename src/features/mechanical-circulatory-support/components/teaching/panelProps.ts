import type { McsSectionLearningContract } from '../../content/sectionLearningContracts'
import type { McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import type { McsRevealStage } from './revealStage'

/**
 * What a live MCS teaching panel is given, and — as importantly — what it is not.
 *
 * There is no `dispatch` here and there never should be. A teaching panel explains the state; it
 * does not own a control, a commitment, a phase, or completion. Those belong to the learner-action
 * pane, and a panel that could change the state it is explaining would be able to answer its own
 * section's question on the learner's behalf.
 *
 * `beforeMetrics` is the snapshot `McsLearnSection` already captures on entering the act phase,
 * passed down read-only. Panels do not capture a second baseline: two baselines taken at two moments
 * are two different stories about what the learner's action did.
 */
export interface McsTeachingPanelProps {
  readonly contract: McsSectionLearningContract
  readonly state: McsSimulationState
  readonly reveal: McsRevealStage
  readonly beforeMetrics: McsDerivedMetrics | null
}

export type McsTeachingPanelComponent = (props: McsTeachingPanelProps) => React.JSX.Element
