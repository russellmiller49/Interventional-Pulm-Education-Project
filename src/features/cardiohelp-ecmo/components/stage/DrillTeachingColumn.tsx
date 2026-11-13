'use client'

import { cardiohelpScenarioById } from '../../content/scenarios'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoDrillLivePanel } from '../teaching/EcmoDrillLivePanel'
import {
  EcmoDrillTeachingPanel,
  hasEcmoDrillTeachingPanel,
} from '../teaching/EcmoDrillTeachingPanel'
import { DrillStepTeaching } from './DrillStepTeaching'
import { StageTeachingScope } from './StageTeachingScope'
import type { StageStep } from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * The teaching pane for a drill: the authored panel where one exists, a live readings panel where
 * the drill has that instead, and the data-driven explanation everywhere, all scoped to the
 * current step.
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
        {/*
          A drill without an authored panel may carry a live readings panel instead. It goes above
          the written explanation, which is rendered below exactly as it is for every such drill.
        */}
        {hasPanel ? <EcmoDrillTeachingPanel state={state} /> : <EcmoDrillLivePanel state={state} />}
        <DrillStepTeaching scenario={scenario} step={step} hasAuthoredPanel={hasPanel} />
      </StageTeachingScope>
    </div>
  )
}
