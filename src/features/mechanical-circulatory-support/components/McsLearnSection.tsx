'use client'

import { useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react'

import { ResizableTeachingWorkspace } from '@/features/learning-module/curriculum'

import {
  MCS_LEARN_PHASES,
  type McsLearnPhase,
  type McsLessonTransferDefinition,
  type McsSectionLearningContract,
} from '../content'
import type { McsAction, McsDerivedMetrics, McsSimulationState } from '../engine'
import { McsLearnActionPane } from './McsLearnActionPane'
import { McsLearnPrimaryPane } from './McsLearnPrimaryPane'
import { McsLearnTeachingPane } from './McsLearnTeachingPane'
import { mcsRevealStage } from './teaching/revealStage'
import styles from './mechanical-circulatory-support.module.css'

const phaseLabels: Readonly<Record<McsLearnPhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

/**
 * One Learn section, as three panes and six phases.
 *
 * The learner's answers live here rather than in the workbench, and the component is mounted with
 * the section id as its key, so moving to another section cannot carry a prediction, a recognition,
 * or a captured before-reading across with it. What the workbench keeps is the phase itself, because
 * the shared activity stepper above the workspace has to be able to show and move it.
 *
 * Completion is emitted from one place: the effect at the bottom, which fires only when the whole
 * authored sequence has been worked through. There is no control anywhere in these panes that marks
 * a section complete.
 */
export function McsLearnSection({
  contract,
  transfer,
  state,
  dispatch,
  phase,
  onPhaseChange,
  sectionComplete,
  onSectionWorkedThrough,
  helpVisible,
  onHelp,
  conceptIds,
  sectionNav,
  foundationMaterial,
  afterCompletion,
}: {
  contract: McsSectionLearningContract
  transfer: McsLessonTransferDefinition
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
  phase: McsLearnPhase
  onPhaseChange: (phase: McsLearnPhase) => void
  sectionComplete: boolean
  onSectionWorkedThrough: () => void
  helpVisible: boolean
  onHelp: () => void
  conceptIds?: readonly string[]
  sectionNav: ReactNode
  foundationMaterial?: ReactNode
  afterCompletion: ReactNode
}) {
  const [recognizeChoiceId, setRecognizeChoiceId] = useState<string | null>(null)
  const [recognizeCommitted, setRecognizeCommitted] = useState(false)
  const [predictionChoiceId, setPredictionChoiceId] = useState<string | null>(null)
  const [predictionCommitted, setPredictionCommitted] = useState(false)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
  const [transferCommitted, setTransferCommitted] = useState(false)
  const [beforeMetrics, setBeforeMetrics] = useState<McsDerivedMetrics | null>(null)
  const [observationSeen, setObservationSeen] = useState(false)
  const [explanationSeen, setExplanationSeen] = useState(false)
  const transferStarted = useRef(false)

  const actionSatisfied = contract.isActionSatisfied(state)
  /*
   * How much of the teaching may be shown. Derived here, from the phase and the commitment this
   * component already owns, so that the disclosure rule lives in one place rather than being
   * re-decided by nine panels.
   */
  const reveal = mcsRevealStage(phase, predictionCommitted)

  function advance() {
    const index = MCS_LEARN_PHASES.indexOf(phase)
    if (index < 0) return
    // Entering Act freezes the readings the observation will be compared against.
    if (phase === 'predict') setBeforeMetrics(state.metrics)
    if (phase === 'observe') setObservationSeen(true)
    if (phase === 'explain') setExplanationSeen(true)
    const next = MCS_LEARN_PHASES[Math.min(index + 1, MCS_LEARN_PHASES.length - 1)]
    if (next === 'transfer' && !transferStarted.current) {
      transferStarted.current = true
      dispatch({ type: 'OPEN_STUDIO', device: transfer.setupDevice })
      for (const setup of transfer.setupActions) dispatch(setup)
    }
    onPhaseChange(next)
  }

  const transferActionsMet = transfer.requiredActionIds.every((id) => state.actionIds.includes(id))
  const sequenceWorkedThrough =
    recognizeCommitted &&
    predictionCommitted &&
    observationSeen &&
    explanationSeen &&
    transferCommitted &&
    transferActionsMet

  useEffect(() => {
    if (sequenceWorkedThrough && !sectionComplete) onSectionWorkedThrough()
  }, [onSectionWorkedThrough, sectionComplete, sequenceWorkedThrough])

  return (
    <div className={styles.learnWorkspaceShell} data-learn-workspace>
      <ResizableTeachingWorkspace
        workspaceLabel={`Mechanical circulatory support learning workspace: ${contract.lessonTitle}`}
        paneLabels={{
          primary: contract.primarySurface === 'anatomy' ? 'Live anatomy' : 'Live monitor',
          secondary: 'Teaching',
          tertiary: 'Your turn',
        }}
        primary={
          <McsLearnPrimaryPane contract={contract} state={state} phaseLabel={phaseLabels[phase]} />
        }
        secondary={
          <McsLearnTeachingPane
            contract={contract}
            state={state}
            reveal={reveal}
            beforeMetrics={beforeMetrics}
            foundationMaterial={foundationMaterial}
          />
        }
        tertiary={
          <McsLearnActionPane
            contract={contract}
            state={state}
            dispatch={dispatch}
            transfer={transfer}
            phase={phase}
            onAdvance={advance}
            actionSatisfied={actionSatisfied}
            beforeMetrics={beforeMetrics}
            recognizeChoiceId={recognizeChoiceId}
            onRecognizeChoice={setRecognizeChoiceId}
            recognizeCommitted={recognizeCommitted}
            onRecognizeCommit={() => setRecognizeCommitted(true)}
            predictionChoiceId={predictionChoiceId}
            onPredictionChoice={setPredictionChoiceId}
            predictionCommitted={predictionCommitted}
            onPredictionCommit={() => setPredictionCommitted(true)}
            transferChoiceId={transferChoiceId}
            onTransferChoice={setTransferChoiceId}
            transferCommitted={transferCommitted}
            onTransferCommit={() => setTransferCommitted(true)}
            sectionComplete={sectionComplete}
            helpVisible={helpVisible}
            onHelp={onHelp}
            conceptIds={conceptIds}
            sectionNav={sectionNav}
            afterCompletion={afterCompletion}
          />
        }
      />
    </div>
  )
}
