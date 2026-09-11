'use client'

import dynamic from 'next/dynamic'
import { useEffect, useReducer, useState } from 'react'
import { StageLayout } from '@/features/learning-module/stage/StageLayout'
import { SectionHeader } from '@/features/learning-module/stage/SectionHeader'
import { NowCard } from '@/features/learning-module/stage/NowCard'
import { LookInLine } from '@/features/learning-module/stage/LookInLine'
import { BASE_PATH } from '../content/lessons'
import { ASSESS_EXERCISES, PRACTICE_EXERCISES } from '../content/practice'
import { emptyPractice, practiceReducer } from '../engine/practice'
import { feedbackFor, mapComplete, scoreResponse, validChoice } from '../engine/session'
import { PREFIX, readProgress, saveFirst } from '../engine/progress'
import { ModuleFrame } from './ModuleFrame'
import { AxialStack, ReferenceComparison } from './TracingViews'
import { BranchChoice, LearnerRoute, OpeningEditor } from './ResponseControls'
import styles from './branch-tracing.module.css'

const RealCtExplorer = dynamic(() => import('./RealCtExplorer').then((m) => m.RealCtExplorer), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading CT explorer…</p>,
})

export function BranchTracingPractice({ mode }: { mode: 'practice' | 'assess' }) {
  const [started, setStarted] = useState(false)
  const [explorer, setExplorer] = useState(false)
  if (started)
    return (
      <ModuleFrame section={mode} activity>
        <PracticeSession mode={mode} onExit={() => setStarted(false)} />
      </ModuleFrame>
    )
  return (
    <ModuleFrame section={mode}>
      <main className={styles.overview}>
        <div className={styles.eyebrow}>
          BRANCH TRACING / {mode === 'practice' ? 'PRACTICE' : 'ASSESS'}
        </div>
        <h1 className={styles.pageTitle}>
          {mode === 'practice'
            ? 'Build the relationship yourself'
            : 'Check your spatial interpretation'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'practice'
            ? 'Four interpretations. Less assistance. Feedback after submission.'
            : 'A separate set of geometric arrangements, with delayed feedback.'}
        </p>
        <div className={styles.introGrid}>
          <section>
            <h2>What you will do</h2>
            <p>
              For each arrangement, follow the axial stack, choose the next branch and place the
              daughter openings in the stated parent view. You may revisit recorded choices before
              submitting the whole set.
            </p>
            <p>
              {mode === 'practice'
                ? 'Hints are available on request and count as assistance.'
                : 'Permitted tools: independent axial browsing, display presets, zoom and the neutral description of geometric coordinates. Hints and reference views are withheld.'}
            </p>
            <button className={styles.startButton} onClick={() => setStarted(true)}>
              {mode === 'practice' ? 'Start independent practice' : 'Start geometric assessment'}
            </button>
          </section>
          <section className={styles.notice}>
            <h2>
              {mode === 'practice'
                ? 'Interpret the course'
                : 'Clinical assessment is awaiting review'}
            </h2>
            <p>
              These are synthetic geometric exercises. Their results describe branch choice and
              opening interpretation in this model. They are not held-out patient CTs and do not
              carry a clinical pass threshold.
            </p>
            <p>
              Initial responses and hint use are retained. An edited or repeated answer cannot
              replace the first attempt. Backtracking itself carries no penalty.
            </p>
          </section>
        </div>
        {mode === 'practice' && (
          <section className={styles.source}>
            <h2>Explore the existing teaching CT</h2>
            <p>
              Independently browse a real CT preview, inspect the matched airway surface, and build
              a route by choosing openings. This ungraded viewer contains one source CT and no
              candidate anatomical labels.
            </p>
            <button onClick={() => setExplorer((v) => !v)}>
              {explorer ? 'Close CT explorer' : 'Open CT and airway explorer'}
            </button>
            {explorer && <RealCtExplorer />}
          </section>
        )}
      </main>
    </ModuleFrame>
  )
}

function PracticeSession({ mode, onExit }: { mode: 'practice' | 'assess'; onExit: () => void }) {
  const exercises = mode === 'practice' ? PRACTICE_EXERCISES : ASSESS_EXERCISES
  const [s, dispatch] = useReducer(
    practiceReducer(exercises, mode === 'practice'),
    exercises,
    emptyPractice,
  )
  const [saveFailed, setSaveFailed] = useState(false)
  const e = exercises[s.index]
  useEffect(() => {
    s.responses.forEach((response, i) => {
      if (response && !saveFirst(`${mode}.item-${i + 1}`, exercises[i], response))
        setSaveFailed(true)
    })
  }, [exercises, mode, s.responses])
  const ready = s.responses.every(Boolean)
  const current = s.responses[s.index]
  const dirty =
    !current ||
    current.branchId !== s.choice ||
    JSON.stringify(current.openings) !== JSON.stringify(s.openings) ||
    current.hints !== s.hints
  if (s.submitted) {
    const rows = exercises.map((ex, i) => ({
      exercise: ex,
      response: s.responses[i]!,
      score: scoreResponse(ex, s.responses[i]!),
    }))
    const first = readProgress().activities.filter(
      (a) =>
        a.activityId.startsWith(`${PREFIX}.${mode}.`) &&
        a.activityId.endsWith('.connectivity.first'),
    )
    const eligible = first.filter((a) => a.hintCount === 0)
    const divergence = rows.findIndex((r) => !r.score.connectivity)
    return (
      <div className={styles.debrief}>
        <h1>Interpretation debrief</h1>
        <p>
          First-attempt unassisted branch decisions:{' '}
          {eligible.filter((a) => a.bestScore === 100).length}/{eligible.length}. Assisted first
          attempts: {first.length - eligible.length}.{' '}
          {eligible.length === 0 ? 'No unassisted denominator is available.' : ''}
        </p>
        <p>
          {divergence < 0
            ? 'All final branch choices match the supplied geometric evidence.'
            : `First final divergence: interpretation ${divergence + 1}. Review its continuity before repeating the set.`}{' '}
          These interpretations are separate geometric checkpoints, not one clinical route.
        </p>
        {saveFailed && (
          <p role="status">Storage is unavailable. First-attempt counts above may be incomplete.</p>
        )}
        {rows.map((r, i) => (
          <section className={styles.debriefRow} key={r.exercise.id}>
            <div>
              <h2>Interpretation {i + 1}</h2>
              <p>
                <strong>
                  Branch choice: {r.score.connectivity ? 'consistent' : 'review needed'} · opening
                  positions: {r.score.viewpoint}/{r.score.viewpointTotal}
                </strong>
              </p>
              <p>{feedbackFor(r.exercise, r.response)}</p>
              <LearnerRoute exercise={r.exercise} branchId={r.response.branchId} />
            </div>
            <ReferenceComparison exercise={r.exercise} />
          </section>
        ))}
        <p className={styles.notice}>
          Completed means you submitted the set. No mastery or procedural competence is awarded. The
          clinical-case review gate remains open.
        </p>
        <button onClick={onExit}>Return to {mode === 'assess' ? 'Assess' : 'Practice'}</button>
      </div>
    )
  }
  return (
    <StageLayout
      section={mode}
      stageId={`interpretation-${s.index + 1}`}
      label="Independent branch interpretation"
      module="bronchial-branch-tracing"
      workspaceLabel="Independent tracing workspace"
      paneOrder={['steps', 'teaching', 'simulator']}
      defaultWidthFractions={{ primary: 0.26, secondary: 0.29 }}
      paneMinimums={{ primary: 300, secondary: 280, tertiary: 340 }}
      paneCaptions={{
        steps: 'what to do',
        teaching: 'the current problem',
        simulator: 'independent axial browsing',
      }}
      compactPane="steps"
      header={
        <SectionHeader
          kicker={`${mode === 'assess' ? 'Assess' : 'Practice'} · Interpretation ${s.index + 1} of ${exercises.length}`}
          title="Trace and map the next opening"
          onRestart={() => dispatch({ type: 'restart' })}
          restartLabel="Restart set"
          onSaveAndExit={onExit}
          resumedNote={
            saveFailed ? 'Storage is unavailable; this set will not be saved.' : undefined
          }
        />
      }
      contextStrip={
        <div className={styles.context}>
          <span>Synthetic geometry · no clinical-case score</span>
          <span>Reference roll {e.phantom.camera.roll}°</span>
          <span>
            {s.responses.filter(Boolean).length}/{exercises.length} recorded
          </span>
        </div>
      }
      task={
        <>
          <NowCard
            model={{
              kicker: 'Independent interpretation',
              heading: 'Your branch and opening map',
              body: 'Record the relationship from the evidence. Correctness and reference views remain withheld until you submit the complete set.',
              where: (
                <LookInLine
                  location={{
                    pane: 'simulator',
                    landmark: 'Axial tracing stack',
                    alsoPane: 'steps',
                    alsoLandmark: 'Your opening map',
                  }}
                />
              ),
              primary: {
                label: ready && !dirty ? 'Submit all interpretations' : 'Record interpretation',
                onActivate: () => dispatch({ type: ready && !dirty ? 'submit' : 'record' }),
                disabled: !validChoice(e, s.choice) || !mapComplete(e, s.openings),
                disabledReason:
                  'Choose a branch and assign every proximal opening a distinct position.',
              },
            }}
          >
            <BranchChoice
              exercise={e}
              selected={s.choice}
              onChange={(id) => dispatch({ type: 'choose', id })}
            />
            <OpeningEditor
              exercise={e}
              openings={s.openings}
              onChange={(id, position) => dispatch({ type: 'place', id, position })}
            />
            {mode === 'practice' && (
              <div className={styles.hints}>
                <button
                  disabled={s.hints >= e.hints.length}
                  onClick={() => dispatch({ type: 'hint' })}
                >
                  Show a hint
                </button>
                {e.hints.slice(0, s.hints).map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </div>
            )}
          </NowCard>
          <div className={styles.checkpoints} aria-label="Recorded interpretations">
            {exercises.map((_, i) => (
              <button
                key={i}
                disabled={i > s.responses.filter(Boolean).length}
                aria-current={i === s.index ? 'step' : undefined}
                onClick={() => dispatch({ type: 'go', index: i })}
              >
                {i + 1}
                {s.responses[i] ? ' · recorded' : ''}
              </button>
            ))}
          </div>
          <p className={styles.small}>
            Changes to this item must be recorded before moving on. First-attempt results remain
            unchanged.
          </p>
        </>
      }
      teaching={
        <div className={styles.teaching}>
          <h2>Current tracing problem</h2>
          <p>{e.question}</p>
          <p>{e.evidence}</p>
          <h3>Your branch map</h3>
          <LearnerRoute exercise={e} branchId={s.choice} />
          <p>
            Use patient directions and the stated camera roll. The route displayed here is your
            choice; it is not a correctness signal.
          </p>
        </div>
      }
      simulator={
        <AxialStack
          key={e.id}
          exercise={e}
          selected={s.choice}
          onSelect={(id) => dispatch({ type: 'choose', id })}
        />
      }
      footer={
        <div className={styles.footer}>
          <span>
            First attempts are retained. Reloading restarts this set. No reference answers are
            mounted before submission.
          </span>
          <a href={BASE_PATH}>Overview</a>
        </div>
      }
    />
  )
}
