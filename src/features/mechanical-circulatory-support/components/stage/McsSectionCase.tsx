'use client'

import { useEffect, useReducer, useState } from 'react'

import { mcsPracticeScenarios } from '../../content/scenarios'
import { createInitialMcsState, mcsReducer } from '../../engine'
import { recordMcsVisit } from '../../engine/learningProgress'
import type { McsScenarioDefinition } from '../../engine/types'
import { CirculationMap } from '../circulation-map/CirculationMap'
import { McsCaseWorkflow, type McsCaseEmbedding } from '../McsCaseWorkflow'
import { McsControls } from '../McsControls'
import { McsMonitor } from '../McsMonitor'
import { McsClockBar } from './McsClockBar'
import { mcsClockContext } from './mcsClockContext'
import flowStyles from './mcs-flow.module.css'

function loadCase(scenario: McsScenarioDefinition) {
  return mcsReducer(createInitialMcsState('practice', scenario.device), {
    type: 'LOAD_SCENARIO',
    scenario,
  })
}

/**
 * A practice case run as the last task of a Learn section.
 *
 * The same case Practice opens — the same reducer, brief, readings, controls and worked
 * explanation — on its own engine, mounted inside the section's task card. The section pauses its
 * own patient and does not mount its simulator while this is the current task, so this case's
 * clock is the only one running; it sits in the same bar as the section's, at the head of the case.
 *
 * Nothing about a run is written. The case is recorded as opened on this device, as Practice
 * records it, and the location stays the section's, so Resume reopens the section, not Practice.
 */
export function McsSectionCase({
  caseId,
  sectionId,
  embedded,
}: {
  readonly caseId: string
  readonly sectionId: string
  readonly embedded: McsCaseEmbedding
}) {
  const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === caseId)
  if (!scenario) throw new Error(`No practice case ${caseId}`)
  const [state, dispatch] = useReducer(mcsReducer, scenario, loadCase)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    recordMcsVisit(scenario.id, 'practice', scenario.device)
    recordMcsVisit(sectionId, 'learn', scenario.device, 'transfer')
  }, [scenario.id, scenario.device, sectionId])

  useEffect(() => {
    if (!running) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 500 : 250
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [running])

  const clock = mcsClockContext(state)
  return (
    <div className={flowStyles.sectionCase} data-section-case={scenario.id}>
      <McsClockBar
        running={running}
        held={false}
        timeSeconds={state.timeSeconds}
        onToggle={() => setRunning((current) => !current)}
        onStepCycle={() => {
          setRunning(false)
          dispatch({ type: 'TICK', seconds: 60 / state.patient.heartRateBpm })
        }}
        items={clock.items}
        alarm={clock.alarm}
      />
      <McsCaseWorkflow
        key={state.seed}
        state={state}
        dispatch={dispatch}
        observations={<McsMonitor state={state} revealCausality />}
        controls={<McsControls state={state} dispatch={dispatch} hideUnavailable={false} />}
        embedded={embedded}
      />
      <details className={flowStyles.sectionCaseMap}>
        <summary>Support pathway · circulation map</summary>
        <CirculationMap state={state} />
      </details>
    </div>
  )
}
