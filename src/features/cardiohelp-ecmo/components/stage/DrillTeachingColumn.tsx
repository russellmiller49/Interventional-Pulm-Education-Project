'use client'

import { cardiohelpScenarioById } from '../../content/scenarios'
import type { EcmoSimulationState } from '../../engine/types'
import {
  EcmoDrillTeachingPanel,
  hasEcmoDrillTeachingPanel,
} from '../teaching/EcmoDrillTeachingPanel'
import { DrillStepTeaching } from './DrillStepTeaching'
import { StageTeachingScope } from './StageTeachingScope'
import type { StageStep } from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * The teaching pane for a drill: the authored live panel where one exists, and the data-driven
 * explanation everywhere, both scoped to the current step.
 */
export function DrillTeachingColumn({
  state,
  step,
}: {
  readonly state: EcmoSimulationState
  readonly step: StageStep
}) {
  const scenarioId = state.scenario.scenarioId
  const scenario = cardiohelpScenarioById.get(scenarioId)
  const hasPanel = hasEcmoDrillTeachingPanel(scenarioId)
  return (
    <div className={styles.teachingColumn} data-pane="teaching">
      <StageTeachingScope
        value={{
          phase: step.phase,
          predictionCommitted: state.scenario.prediction.committed,
          stepId: step.id,
        }}
      >
        {hasPanel ? <EcmoDrillTeachingPanel state={state} /> : null}
        <DrillStepTeaching scenario={scenario} step={step} hasAuthoredPanel={hasPanel} />
      </StageTeachingScope>
    </div>
  )
}
