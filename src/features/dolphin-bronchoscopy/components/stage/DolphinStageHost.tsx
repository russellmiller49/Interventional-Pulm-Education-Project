'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { HelpDialog } from '@/features/learning-module/stage/HelpDialog'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { NowCard, type NowCardModel } from '@/features/learning-module/stage/NowCard'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { SectionsDrawer } from '@/features/learning-module/stage/SectionsDrawer'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { StageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'
import { StepList } from '@/features/learning-module/stage/StepList'
import { STAGE_PHASE_LABELS } from '@/features/learning-module/stage/stageModel'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { Link, useRouter } from '@/i18n/navigation'
import type { AirwayScopeLocation } from '@/lib/airway-anatomy/scope-location'

import { DOLPHIN_BOUNDARY_STATEMENT } from '../../content/boundary'
import { dolphinPathway, type DolphinSectionId } from '../../content/pathway'
import { dolphinPhaseOf } from '../../content/pathwayResolver'
import {
  DOLPHIN_ASSESS_HREF,
  DOLPHIN_BRONCHOSCOPY_NAV_BASE,
  DOLPHIN_LEARN_HREF,
  dolphinSectionLinkTarget,
} from '../../content/routes'
import { dolphinStageLesson, type DolphinStageLesson } from '../../content/stageLessons'
import {
  markDolphinSectionReviewed,
  recordDolphinLocation,
  setDolphinSectionReviewLater,
} from '../../engine/selfPacedProgress'
import type { BreathCuePhase } from '../../engine/scopeGoals'
import {
  deriveDolphinStageProgress,
  dolphinStageReducer,
  emptyDolphinStageSession,
  stepWorkDone,
} from '../../engine/stageSession'
import { DolphinModuleFrame } from '../DolphinModuleFrame'
import { useDolphinProgress } from '../useDolphinProgress'
import { dolphinDrillSetById } from '../../content/branchDrillSets'
import { useBranchDrill } from '../simulator/useBranchDrill'
import { DolphinActBody } from './DolphinActBody'
import { DolphinItemCheck } from './DolphinItemCheck'
import { DolphinTeachingColumn } from './DolphinTeachingColumn'
import { DolphinWorkspacePane } from './DolphinWorkspacePane'
import styles from './dolphin-stage.module.css'

/**
 * One Learn section on the shared lesson stage: Steps panel left, the airway or the animal in the
 * middle, the teaching on the right. Restart remounts the section from its first step.
 */
export function DolphinStageHost({
  sectionId,
  locale,
}: {
  readonly sectionId: DolphinSectionId
  readonly locale: string
}) {
  const [run, setRun] = useState(0)
  const lesson = useMemo(() => dolphinStageLesson(sectionId), [sectionId])
  if (!lesson) return null
  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_LEARN_HREF} activityMode>
      <DolphinStage key={run} lesson={lesson} onRestart={() => setRun((value) => value + 1)} />
    </DolphinModuleFrame>
  )
}

function DolphinStage({
  lesson,
  onRestart,
}: {
  readonly lesson: DolphinStageLesson
  readonly onRestart: () => void
}) {
  const t = useTranslations('dolphinBronchoscopy.stage')
  const router = useRouter()
  const section = lesson.section
  const reducer = useMemo(() => dolphinStageReducer(lesson), [lesson])
  const [session, dispatch] = useReducer(reducer, undefined, emptyDolphinStageSession)
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [startSerial, setStartSerial] = useState(0)
  const helpRef = useRef<HTMLButtonElement>(null)
  const { progress: stored } = useDolphinProgress()
  const savedForReview = stored.reviewLaterSectionIds.includes(lesson.sectionId)

  const progress = deriveDolphinStageProgress(lesson, session)
  const liveIndex = progress.liveIndex
  const activeIndex = Math.max(0, Math.min(viewIndex ?? liveIndex, lesson.steps.length - 1))
  const step = lesson.steps[activeIndex]
  const reviewing = viewIndex !== null && viewIndex < liveIndex
  const finished = session.commitments.finished
  const isLast = activeIndex === lesson.steps.length - 1
  const workDone =
    step.interaction.kind === 'read' ||
    step.interaction.kind === 'explain' ||
    stepWorkDone(lesson, step, activeIndex, session)
  /** The teaching that answers the prediction opens once it is committed or the learner moves past it. */
  const revealed =
    progress.predictionCommitted || session.commitments.confirmed >= lesson.predictionStepIndex
  const next = nextPathwaySection(dolphinPathway, lesson.sectionId)

  // A location fact, not a completion: the learner opened this section.
  useEffect(() => {
    recordDolphinLocation({ kind: 'section', id: lesson.sectionId })
  }, [lesson.sectionId])

  // Finishing is the learner's own "reviewed" mark. It says nothing about answers or skipped steps.
  const reviewRecorded = useRef(false)
  useEffect(() => {
    if (!finished || reviewRecorded.current) return
    reviewRecorded.current = true
    markDolphinSectionReviewed(lesson.sectionId)
  }, [finished, lesson.sectionId])

  const drillTargets = useMemo(() => {
    const act = section.act
    if (act.kind !== 'branch-drill') return []
    return (dolphinDrillSetById.get(act.set)?.targets ?? []).slice(0, act.count)
  }, [section.act])
  const [drillState, drillDispatch] = useBranchDrill(drillTargets)
  const drill = useMemo(
    () => ({ state: drillState, dispatch: drillDispatch }),
    [drillState, drillDispatch],
  )
  useEffect(() => {
    if (drillTargets.length > 0 && drillState.done) dispatch({ type: 'ACT_DONE' })
  }, [drillState.done, drillTargets.length])

  const onLocation = useCallback(
    (location: AirwayScopeLocation, cuePhase: BreathCuePhase | null) => {
      dispatch({ type: 'SCOPE_LOCATION', abbr: location.abbr, cuePhase })
      drillDispatch({ type: 'LOCATION', abbr: location.abbr, pathAbbrs: location.pathAbbrs })
    },
    [drillDispatch],
  )
  const restartScope = useCallback(() => {
    dispatch({ type: 'SCOPE_RESET' })
    setStartSerial((value) => value + 1)
  }, [])

  const continuePast = () => {
    dispatch({ type: 'CONTINUE_PAST', index: activeIndex })
    if (isLast) dispatch({ type: 'FINISH' })
    setViewIndex(null)
  }
  const skipPast = () => {
    dispatch({ type: 'SKIP_PAST', index: activeIndex })
    if (isLast) dispatch({ type: 'FINISH' })
    setViewIndex(null)
  }

  const interaction = step.interaction
  const body = (() => {
    switch (interaction.kind) {
      case 'read':
        return (
          <p className={styles.situation} data-clinical-question>
            {section.clinicalQuestion}
          </p>
        )
      case 'prediction':
      case 'transfer':
        return (
          <DolphinItemCheck
            item={interaction.item}
            situation={interaction.authored.situation}
            frameId={interaction.authored.media?.frameId}
            committed={session.commitments.choices[step.id]}
            onCommit={(choiceId) => dispatch({ type: 'COMMIT_CHOICE', stepId: step.id, choiceId })}
            label={interaction.kind === 'prediction' ? 'Prediction' : 'New case'}
          />
        )
      case 'act':
        return (
          <DolphinActBody
            lesson={lesson}
            session={session}
            dispatch={dispatch}
            onRestartScope={restartScope}
            reviewing={reviewing}
            drill={drill}
          />
        )
      case 'explain':
        return (
          <section className={styles.question} data-explain-summary>
            <p className={styles.stem}>{section.newConcept}</p>
            {lesson.steps[lesson.predictionStepIndex] &&
            session.commitments.choices[lesson.steps[lesson.predictionStepIndex].id] ===
              undefined ? (
              <p className={styles.note}>
                You moved past the prediction without answering. Its explanation:{' '}
                {section.prediction.explanation}
              </p>
            ) : null}
          </section>
        )
    }
  })()

  const nowModel: NowCardModel = {
    kicker: `Step ${step.ordinal} of ${lesson.steps.length} · ${STAGE_PHASE_LABELS[step.phase]}`,
    heading: step.title,
    body: step.instruction,
    where: step.lookIn ? <LookInLine location={step.lookIn} /> : undefined,
    back:
      activeIndex > 0
        ? { label: 'Back', onActivate: () => setViewIndex(activeIndex - 1) }
        : undefined,
    primary: reviewing
      ? { label: 'Return to where you were', onActivate: () => setViewIndex(null) }
      : finished && isLast
        ? undefined
        : {
            label: isLast ? 'Finish the section' : 'Continue',
            onActivate: continuePast,
            disabled: !workDone,
            disabledReason: !workDone
              ? 'This step’s work is not done yet. Do it, or skip the step.'
              : undefined,
          },
    secondary:
      !reviewing && !workDone && !finished
        ? { label: 'Skip this step', onActivate: skipPast }
        : undefined,
    pinActions: true,
  }

  const workspace = section.workspace
  const simulator = (
    <DolphinWorkspacePane
      workspace={workspace}
      startKey={`${lesson.sectionId}:${startSerial}`}
      onLocation={onLocation}
      session={session}
      lesson={lesson}
      dispatch={dispatch}
      activePhase={step.phase}
      drill={drill}
    />
  )

  const completion =
    finished && isLast ? (
      <section className={styles.completion} data-section-complete aria-live="polite">
        <p className={styles.kicker}>Section reviewed</p>
        <h3 className="text-lg font-semibold">{section.anchor.checklistLabel}</h3>
        <ul>
          {section.anchor.checklist.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.rowFeedback}>
          Marked reviewed on this device because you reached the end. Nothing about your answers was
          saved.
        </p>
        {lesson.sectionId === 'what-this-module-can-say' ? (
          <p data-boundary-statement>{DOLPHIN_BOUNDARY_STATEMENT}</p>
        ) : null}
        <div className={styles.actions}>
          <Link
            href={next ? dolphinSectionLinkTarget(next.id) : DOLPHIN_ASSESS_HREF}
            className={styles.button}
            data-primary="true"
            data-next-section={next?.id ?? 'integrated-cases'}
          >
            {next ? `Continue to ${next.title}` : 'Go to the integrated cases'}
          </Link>
          <button type="button" className={styles.button} onClick={onRestart}>
            Start this section again
          </button>
        </div>
      </section>
    ) : null

  const task = (
    <div className={styles.steps}>
      <NowCard model={nowModel}>
        {body}
        {completion}
      </NowCard>
      <StepList
        lesson={lesson}
        currentIndex={activeIndex}
        furthestPerformedIndex={Math.max(progress.furthestPerformedIndex, liveIndex - 1)}
        performedStepIds={progress.performedIds}
        predictionCommitted={progress.predictionCommitted}
        reviewIndex={reviewing ? activeIndex : null}
        recapFor={(index) => [lesson.steps[index].title]}
        onSelect={(index) => setViewIndex(index === liveIndex ? null : index)}
      />
    </div>
  )

  const teaching = (
    <StageTeachingScope
      value={{ phase: step.phase, predictionCommitted: revealed, stepId: step.id }}
    >
      <DolphinTeachingColumn section={section} revealed={revealed} />
    </StageTeachingScope>
  )

  const header = (
    <SectionHeader
      breadcrumb={{ href: DOLPHIN_BRONCHOSCOPY_NAV_BASE, label: 'Dolphin Bronchoscopy' }}
      kicker={`${dolphinPhaseOf(lesson.sectionId).title} · Section ${lesson.index + 1} of ${lesson.total}`}
      title={section.title}
      meta={[`${section.minutes} min`]}
      sectionsControl={
        <SectionsDrawer
          pathway={dolphinPathway}
          activeSectionId={lesson.sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          label="Dolphin bronchoscopy sections"
          onSelect={(id) => router.push(dolphinSectionLinkTarget(id))}
        />
      }
      options={
        <button
          type="button"
          className={styles.button}
          aria-pressed={savedForReview}
          onClick={() => setDolphinSectionReviewLater(lesson.sectionId, !savedForReview)}
          data-review-later-toggle
        >
          {savedForReview ? (
            <BookmarkCheck aria-hidden="true" size={16} />
          ) : (
            <Bookmark aria-hidden="true" size={16} />
          )}
          Save for review
        </button>
      }
      helpRef={helpRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={onRestart}
      restartLabel="Restart section"
      onRestartCourse={() => {
        // The course's first section, at its first step. In the first section it restarts it.
        const firstId = dolphinPathway.sections[0]?.id
        if (!firstId || firstId === lesson.sectionId) onRestart()
        else router.push(dolphinSectionLinkTarget(firstId))
      }}
    />
  )

  return (
    <>
      <StageLayout
        stageId={step.id}
        label={section.title}
        module="dolphin-bronchoscopy"
        workspaceLabel="Dolphin bronchoscopy lesson"
        header={header}
        simulator={simulator}
        teaching={teaching}
        task={task}
        paneOrder={['steps', 'simulator', 'teaching']}
        paneCaptions={{
          steps: t('panes.steps'),
          simulator: t('panes.simulator'),
          teaching: t('panes.teaching'),
        }}
        defaultWidthFractions={{ primary: 0.3, secondary: 0.42 }}
        compactPane={step.lookIn?.pane}
      />
      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('help.title')}
        returnFocusTo={helpRef}
      >
        <p>
          <strong>{step.title}.</strong> {step.instruction}
        </p>
        <p>{t('help.skipNote')}</p>
        <p>{t('help.deviceNote')}</p>
        <p data-help-boundary>
          <strong>About this module.</strong> {DOLPHIN_BOUNDARY_STATEMENT}
        </p>
      </HelpDialog>
    </>
  )
}
