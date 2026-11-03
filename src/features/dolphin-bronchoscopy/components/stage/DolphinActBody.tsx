'use client'

import type { Dispatch } from 'react'

import type { DolphinStageLesson } from '../../content/stageLessons'
import { dolphinLedgerById } from '../../content/ledgers'
import type { DrillAction, DrillState } from '../../engine/branchDrill'
import { visitedAbbrs } from '../../engine/scopeGoals'
import type { DolphinStageAction, DolphinStageSession } from '../../engine/stageSession'
import { BranchDrillOverlay } from '../simulator/BranchDrillOverlay'
import { AnatomyPickControl } from './acts/AnatomyPickControl'
import { FrameIdentify } from './acts/FrameIdentify'
import { LedgerControl } from './acts/LedgerControl'
import { ReportControl } from './acts/ReportControl'
import { ScenarioFrames } from './acts/ScenarioFrames'
import { ScopeGoalsPanel } from './acts/ScopeGoalsPanel'
import { SequenceControl } from './acts/SequenceControl'
import { SortControl } from './acts/SortControl'
import styles from './dolphin-stage.module.css'

export interface StageDrill {
  readonly state: DrillState
  readonly dispatch: (action: DrillAction) => void
}

/**
 * The Act step's body in the Steps panel. Each kind records only what its own work needs, in the
 * section's session; nothing is stored on the device.
 */
export function DolphinActBody({
  lesson,
  session,
  dispatch,
  onRestartScope,
  reviewing,
  drill,
}: {
  readonly lesson: DolphinStageLesson
  readonly session: DolphinStageSession
  readonly dispatch: Dispatch<DolphinStageAction>
  readonly onRestartScope: () => void
  readonly reviewing: boolean
  readonly drill: StageDrill
}) {
  const act = lesson.section.act
  const work = session.commitments.act
  const canRetry = !reviewing && session.commitments.confirmed < lesson.actStepIndex
  switch (act.kind) {
    case 'scope-lab':
      return (
        <ScopeGoalsPanel
          prompt={act.prompt}
          goals={act.goals}
          history={session.scope}
          showPlaces={
            lesson.section.workspace.kind === 'scope' ? lesson.section.workspace.showLocation : true
          }
          onRestart={onRestartScope}
        />
      )
    case 'sort':
      return (
        <SortControl
          sort={act.sort}
          checked={work.sort}
          onCheck={(answers) => dispatch({ type: 'ACT_SORT', answers })}
          onRetry={canRetry ? () => dispatch({ type: 'ACT_RETRY' }) : undefined}
        />
      )
    case 'anatomy-pick':
      return (
        <AnatomyPickControl
          preset={act.preset}
          prompts={act.prompts}
          picks={work.picks}
          onPick={(promptId, choiceId) => dispatch({ type: 'ACT_PICK', promptId, choiceId })}
        />
      )
    case 'sequence':
      return (
        <SequenceControl
          sequence={act.sequence}
          checked={work.sequence}
          onCheck={(order) => dispatch({ type: 'ACT_SEQUENCE', order })}
          onRetry={canRetry ? () => dispatch({ type: 'ACT_RETRY' }) : undefined}
        />
      )
    case 'identify':
      return (
        <FrameIdentify
          identify={act.identify}
          picks={work.picks}
          onPick={(promptId, choiceId) => dispatch({ type: 'ACT_PICK', promptId, choiceId })}
        />
      )
    case 'calculate': {
      const ledger = dolphinLedgerById.get(act.ledgerId)
      if (!ledger) return null
      return (
        <section className={styles.question}>
          <p className={styles.stem}>{act.prompt}</p>
          <LedgerControl
            ledger={ledger}
            done={work.done === true}
            onDone={() => dispatch({ type: 'ACT_DONE' })}
          />
        </section>
      )
    }
    case 'report':
      return (
        <>
          <ScopeGoalsPanel
            prompt={act.prompt}
            goals={act.surveyGoals}
            history={session.scope}
            onRestart={onRestartScope}
          />
          <ReportControl
            templateId={act.templateId}
            visited={new Set(act.fromSurvey ? visitedAbbrs(session.scope) : [])}
            done={work.done === true}
            onDone={() => dispatch({ type: 'ACT_DONE' })}
          />
        </>
      )
    case 'scenario':
      return (
        <ScenarioFrames
          scenario={act.scenario}
          done={work.done === true}
          onFirstChoice={(frameId, choiceId) =>
            dispatch({ type: 'ACT_PICK', promptId: frameId, choiceId })
          }
          onDone={() => dispatch({ type: 'ACT_DONE' })}
        />
      )
    case 'branch-drill':
      return (
        <section className={styles.question}>
          <p className={styles.stem}>{act.prompt}</p>
          <BranchDrillOverlay state={drill.state} dispatch={drill.dispatch} />
        </section>
      )
    case 'read':
      return (
        <section className={styles.question} data-act-read>
          <p className={styles.stem}>{act.prompt}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              data-primary="true"
              disabled={work.done === true}
              onClick={() => dispatch({ type: 'ACT_DONE' })}
            >
              {work.done ? 'Read' : 'I have read it'}
            </button>
          </div>
        </section>
      )
  }
}
