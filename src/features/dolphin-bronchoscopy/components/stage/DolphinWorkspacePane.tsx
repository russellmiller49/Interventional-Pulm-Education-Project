'use client'

import { useState, type Dispatch } from 'react'

import type { StagePhase } from '@/features/learning-module/stage/stageModel'
import type { AirwayScopeLocation } from '@/lib/airway-anatomy/scope-location'

import type { DolphinStageLesson } from '../../content/stageLessons'
import type { DolphinWorkspace } from '../../content/types'
import type { BreathCuePhase } from '../../engine/scopeGoals'
import type { DolphinStageAction, DolphinStageSession } from '../../engine/stageSession'
import { DolphinAnatomyPane } from '../simulator/DolphinAnatomyPane'
import { DolphinPassageMap } from '../simulator/DolphinPassageMap'
import { DolphinScopePane } from '../simulator/DolphinScopePane'
import { currentDrillTarget } from '../../engine/branchDrill'
import { currentAnatomyPrompt } from './acts/AnatomyPickControl'
import type { StageDrill } from './DolphinActBody'
import { DolphinFrameImage } from './DolphinFrameImage'
import styles from './dolphin-stage.module.css'

/**
 * The Simulator panel: the scope, the 3D dolphin, a still, or the passage map — never blank.
 * A pick in the 3D dolphin answers the anatomy act only while the learner is on the Act step.
 */
export function DolphinWorkspacePane({
  workspace,
  startKey,
  onLocation,
  session,
  lesson,
  dispatch,
  activePhase,
  drill,
}: {
  readonly workspace: DolphinWorkspace
  readonly startKey: string
  readonly onLocation: (location: AirwayScopeLocation, cuePhase: BreathCuePhase | null) => void
  readonly session: DolphinStageSession
  readonly lesson: DolphinStageLesson
  readonly dispatch: Dispatch<DolphinStageAction>
  readonly activePhase: StagePhase
  readonly drill: StageDrill
}) {
  const [selected, setSelected] = useState<string | null>(null)
  switch (workspace.kind) {
    case 'scope': {
      const target =
        lesson.section.act.kind === 'branch-drill' ? currentDrillTarget(drill.state) : null
      return (
        <DolphinScopePane
          workspace={workspace}
          startKey={target ? `${startKey}:${drill.state.index}` : startKey}
          onLocation={onLocation}
          target={target ? { abbr: target, showBeacon: drill.state.showBeacon } : null}
        />
      )
    }
    case 'anatomy': {
      const act = lesson.section.act
      return (
        <DolphinAnatomyPane
          preset={workspace.preset}
          serial={0}
          selectedId={selected}
          caption={workspace.caption}
          onPick={(structureId) => {
            setSelected(structureId)
            if (act.kind !== 'anatomy-pick' || activePhase !== 'act') return
            const prompt = currentAnatomyPrompt(act.prompts, session.commitments.act.picks)
            if (prompt) dispatch({ type: 'ACT_PICK', promptId: prompt.id, choiceId: structureId })
          }}
        />
      )
    }
    case 'frame':
      return (
        <figure className={styles.simulatorFigure}>
          <DolphinFrameImage
            frameId={workspace.frameId}
            revealed={session.commitments.confirmed >= lesson.predictionStepIndex}
          />
          <figcaption className={styles.paneCaption}>{workspace.caption}</figcaption>
        </figure>
      )
    case 'passage':
      return <DolphinPassageMap lit={workspace.lit} caption={workspace.caption} />
  }
}
