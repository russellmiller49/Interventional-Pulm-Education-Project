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
  predictionCommitted,
}: {
  readonly state: EcmoSimulationState
  readonly step: StageStep
  readonly predictionCommitted: boolean
}) {
  const scenarioId = state.scenario.scenarioId
  const scenario = cardiohelpScenarioById.get(scenarioId)
  const hasPanel = hasEcmoDrillTeachingPanel(scenarioId)
  return (
    <div className={styles.teachingColumn} data-pane="teaching">
      <StageTeachingScope value={{ phase: step.phase, predictionCommitted, stepId: step.id }}>
        {hasPanel ? <EcmoDrillTeachingPanel state={state} /> : null}
        <DrillStepTeaching
          scenario={scenario}
          step={step}
          predictionCommitted={predictionCommitted}
          hasAuthoredPanel={hasPanel}
        />
      </StageTeachingScope>
    </div>
  )
}
