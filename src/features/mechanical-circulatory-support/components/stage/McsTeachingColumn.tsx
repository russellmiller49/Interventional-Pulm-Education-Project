'use client'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import type { StageBlockVisibility } from '@/features/learning-module/stage/StageTeachingScope'

import {
  MCS_CONTROL_PANEL,
  mcsControlsForDevice,
  type McsControlStripState,
} from '../../content/controlPanel'
import { mcsLearnControls } from '../../content/learnControls'
import { mcsSurfaceTarget } from '../../content/primarySurfaces'
import type { McsStageLesson, McsStageStep } from '../../content/stageLessons'
import { MCS_SUPPORT_GRAMMAR, mcsGrammarRowsFor } from '../../content/supportGrammar'
import {
  mcsSpineStop,
  MCS_SUPPORT_SPINE,
  type McsSpineStop,
  type McsSpineStopId,
} from '../../content/supportSpine'
import type { McsDerivedMetrics, McsSimulationState } from '../../engine/types'
import { McsTeachingPanel } from '../teaching/McsTeachingPanel'
import { mcsRevealStage } from '../teaching/revealStage'
import styles from './mcs-stage.module.css'

const STRIP_STATE_LABEL: Readonly<Record<McsControlStripState, string>> = {
  'this-setting': 'This setting',
  'not-this-setting': 'Not this setting',
  'no-setting': 'No setting — find the cause',
}

/**
 * The teaching pane, one block at a time.
 *
 * Before the prediction the pane frames the section — what it is for, where on the loop it
 * stands, what to look at — and says nothing about the mechanism; the live panel shows what is
 * physically on the screen. The mechanism, what the section establishes and does not, the
 * misreading, the four levels, the one table's rows and the control strip open once the
 * prediction is committed, are the focus on the Explain step, and fold to their headings on the
 * transfer. Nothing post-commitment is in the document before the commitment.
 */
export function McsTeachingColumn({
  lesson,
  step,
  state,
  predictionCommitted,
  flowAccountWithheld,
  beforeMetrics,
  walkStop,
  litStopIds,
}: {
  readonly lesson: McsStageLesson
  readonly step: McsStageStep
  readonly state: McsSimulationState
  readonly predictionCommitted: boolean
  readonly flowAccountWithheld: boolean
  readonly beforeMetrics: McsDerivedMetrics | null
  /** The walk's current stop, while the section is walking the loop. */
  readonly walkStop?: McsSpineStop
  /** The stops the map is lighting for this step. */
  readonly litStopIds: readonly McsSpineStopId[]
}) {
  const { contract, spec } = lesson
  const phase = step.phase
  const reveal = mcsRevealStage(phase, predictionCommitted)
  const explaining = phase === 'explain'
  const target = mcsSurfaceTarget(contract.primarySurface, contract.primaryTarget)

  // The selected introductions teach first. Later tasks foreground one explanation; the full
  // legacy panel is retained for the four application sections and the open workbench.
  if (lesson.introductory && !walkStop) {
    const pending = !predictionCommitted && (phase === 'recognize' || phase === 'predict')
    return (
      <section className={styles.block} data-teaching-panel data-teaching-focus={phase}>
        {/*
         * Labelled for what it is (F07). On an identification or a prediction step this explanation
         * is on the page before any answer — deliberately: the module is self-paced and nothing is
         * withheld. What was wrong was the silence about it, which let the step read as "predict,
         * then reveal". The label says the explanation is a worked one and the question an optional
         * check, so nobody is told an answer is hidden when it is not.
         */}
        {!pending && (phase === 'recognize' || phase === 'predict') ? (
          <p className={styles.kicker} data-worked-explanation-label>
            Worked explanation · open before, during or after the optional question
          </p>
        ) : null}
        <h3>{pending ? 'Apply the concept' : 'Why it moved'}</h3>
        {pending ? (
          <p>
            Use the readings and answer choices for this task. You have already studied the
            reference and guided example. The explanation of your selected response appears after
            submission.
          </p>
        ) : (
          <>
            <p>
              <strong>What the action does:</strong> {contract.teaching.howTheActionAffectsTheModel}
            </p>
            <p data-flow-account-note>{contract.teaching.flowAccountNote}</p>
            <p data-does-not-establish>
              <strong>What to do with it:</strong> {contract.whatThisDoesNotEstablish}
            </p>
            {/*
             * The same three paragraphs stood open on every step of the five introductory sections
             * — about seventy words, twenty times over (F39). They are the reading rule for any
             * captured result and the two-line version of the four levels, so they stay on every
             * step, folded: one click for anyone, and the limit that belongs to this exercise
             * stays in the open above them.
             */}
            <details data-reading-the-result>
              <summary>
                Reading the result: pressure, flow, oxygen delivery, patient response
              </summary>
              <p>Read the captured results to see what actually changed in this run.</p>
              <div data-causal-ladder-summary>
                <p>
                  <strong>Pressure and blood flow:</strong> mm Hg and L/min answer different
                  questions. A change in MAP alone cannot establish a change in flow.
                </p>
                <p>
                  <strong>Oxygen delivery and patient response:</strong> oxygen content and
                  consumption matter. Mentation, urine output, skin findings and the lactate trend
                  are read at the bedside.
                </p>
              </div>
            </details>
            <details>
              <summary>Relevant reference: interpreting the constraint</summary>
              <ul>
                {mcsGrammarRowsFor(lesson.sectionId).map((row) => (
                  <li key={row.id}>
                    {row.whatMoved} — {row.whereTheConstraintLives}. {row.shortlist.join(' · ')}
                  </li>
                ))}
              </ul>
              <details>
                <summary>Complete mechanism reference</summary>
                <ul>
                  {MCS_SUPPORT_GRAMMAR.rows.map((row) => (
                    <li key={row.id}>
                      {row.whatMoved} — {row.whereTheConstraintLives}. {row.shortlist.join(' · ')}
                    </li>
                  ))}
                </ul>
              </details>
            </details>
          </>
        )}
      </section>
    )
  }

  const framing: StageBlockVisibility =
    phase === 'recognize' || phase === 'predict' ? 'shown' : 'collapsed'
  const afterCommit: StageBlockVisibility = !predictionCommitted
    ? 'hidden'
    : explaining
      ? 'shown'
      : phase === 'transfer'
        ? 'collapsed'
        : 'collapsed'
  const mechanism: StageBlockVisibility = !predictionCommitted
    ? 'hidden'
    : phase === 'act' || phase === 'observe' || explaining
      ? 'shown'
      : 'collapsed'
  /*
   * The stop cards are the walk's teaching, and a stop's own sentences can answer a later section's
   * question about that place — the aorta stop says what the balloon does not do, which is the
   * first section's prediction. So outside the walk they wait for the commitment, and fold.
   */
  const stopsShown = walkStop ? [walkStop] : litStopIds.map((id) => mcsSpineStop(id))
  const stopVisibility: StageBlockVisibility = walkStop
    ? 'shown'
    : predictionCommitted
      ? 'collapsed'
      : 'hidden'
  /*
   * The live panel is open where a step is read from it, and folded where it would only repeat.
   *
   * It stood open on every stop of the loop walk and on Recognize, Predict and Explain alike, so
   * the same thousand-to-four-thousand-word panel was the first thing on three steps running and
   * on all five stops of the walk (F06, F30, F39). It now opens on the walk's first stop, on
   * Recognize and on Explain; on the later stops and on Predict it is one click away under its own
   * heading. Folding is a default, not a gate: nothing in it waits for an answer.
   */
  const livePanel: StageBlockVisibility = walkStop
    ? walkStop.ordinal === 1
      ? 'shown'
      : 'collapsed'
    : phase === 'recognize' || explaining
      ? 'shown'
      : 'collapsed'
  const rows = mcsGrammarRowsFor(lesson.sectionId)
  const stripControls = mcsControlsForDevice(lesson.startingDevice).filter(
    (control) => spec.controlStrip[control.id] !== undefined,
  )
  const sharedStrip =
    spec.track === 'shared'
      ? MCS_CONTROL_PANEL.controls.filter((control) => spec.controlStrip[control.id] !== undefined)
      : stripControls

  return (
    <div data-teaching-panel data-teaching-focus={phase}>
      {/* 1. This section — always the first block; the only one shown before the reveal toggle. */}
      <StageBlock kind="question" heading="This section" visibility={framing}>
        <section className={styles.block} data-teaching-block="framing">
          <p className={styles.kicker}>
            Section {lesson.index + 1} of {lesson.total} · {lesson.minutes} min
          </p>
          <h3>{lesson.title}</h3>
          <p className={styles.question}>{contract.clinicalQuestion}</p>
          {lesson.increment ? (
            <p data-track-increment>
              <strong>What is new:</strong> {lesson.increment.sentence}
            </p>
          ) : null}
          <p>
            <strong>One idea:</strong> {spec.newConcept}
          </p>
          <p>
            <strong>By the end you can:</strong> {spec.objective}
          </p>
          <p>
            <strong>On the screen right now:</strong> {contract.teaching.whatYouAreSeeing}
          </p>
          {target ? (
            <p>
              <strong>Look here:</strong> {target.label}. {contract.whyThisView}
            </p>
          ) : null}
        </section>
      </StageBlock>

      {/* 2. Where on the loop this section stands, or the walk's current stop. */}
      {stopsShown.map((stop) => (
        <StageBlock
          key={stop.id}
          kind="signals"
          heading={`On the loop: ${stop.plainName}`}
          visibility={stopVisibility}
        >
          <section className={styles.block} data-teaching-block="stop" data-stop={stop.id}>
            <p className={styles.kicker}>
              Stop {stop.ordinal} of {MCS_SUPPORT_SPINE.stops.length} on the loop
            </p>
            <h3>{stop.plainName}</h3>
            <p>{stop.whereYouAre}</p>
            <p>{stop.whatADeviceDoesHere}</p>
            <p className={styles.analogy}>{stop.analogy}</p>
            {/*
              The short list, with the label that says what kind of list it is and the markers
              that say it is a list. It rendered as a bold "Check here:" over three bare lines
              with the marker reset away, and read as more prose. One label fits all five stops
              here — each list is the few things to check at that place — so it is not authored
              per stop the way the hemodynamics spine's is.
            */}
            <p className={styles.kicker} id={`stop-checklist-${stop.id}`} data-stop-checklist-label>
              What to check at this stop
            </p>
            <ul aria-labelledby={`stop-checklist-${stop.id}`} data-stop-checklist>
              {stop.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>
              <strong>On the monitor:</strong> {stop.lookAt.join(' · ')}.
            </p>
          </section>
        </StageBlock>
      ))}

      {/* 4. What the action does to the model — after the commitment. */}
      <StageBlock kind="after-commitment" heading="What the change does" visibility={mechanism}>
        <section className={styles.block} data-teaching-block="mechanism">
          <h3>What the change does</h3>
          <p>{contract.teaching.howTheActionAffectsTheModel}</p>
          <p data-flow-account-note>{contract.teaching.flowAccountNote}</p>
          {contract.targetControl ? (
            <p data-control-guarantee>
              <strong>{mcsLearnControls[contract.targetControl].label}:</strong>{' '}
              {mcsLearnControls[contract.targetControl].changes}{' '}
              {mcsLearnControls[contract.targetControl].doesNotGuarantee}
            </p>
          ) : (
            <p>
              <strong>No adjustment is expected here.</strong> {contract.noActionExplanation}
            </p>
          )}
        </section>
      </StageBlock>

      {/* 5. The explanation: the four levels, what it establishes, the misreading. */}
      <StageBlock kind="after-commitment" heading="Why it moved" visibility={afterCommit}>
        <section className={styles.block} data-teaching-block="explanation">
          <h3>Why it moved</h3>
          <p>{contract.explanation}</p>
          <ol className={styles.ladder} data-causal-ladder-summary>
            <li>
              <strong>Pressure</strong>
              <span>{contract.pressureLevelExplanation}</span>
            </li>
            <li>
              <strong>Flow</strong>
              <span>{contract.flowLevelExplanation}</span>
            </li>
            <li>
              <strong>Oxygen delivery</strong>
              <span>{contract.oxygenDeliveryExplanation}</span>
            </li>
            <li>
              <strong>Organ response</strong>
              <span>{contract.organResponseExplanation}</span>
            </li>
          </ol>
          <p>
            <strong>What this shows:</strong> {contract.whatThisEstablishes}
          </p>
          <p data-does-not-establish>
            <strong>What to do with it:</strong> {contract.whatThisDoesNotEstablish}
          </p>
          <p className={styles.warning} data-common-misinterpretation>
            <strong>One way this is read wrongly:</strong> {contract.commonMisinterpretation}
          </p>
        </section>
      </StageBlock>

      {/* 6. The one table's rows for this section. */}
      {rows.length > 0 ? (
        <StageBlock
          kind="after-commitment"
          heading="What moved, and where the constraint lives"
          visibility={afterCommit}
        >
          <section className={styles.block} data-teaching-block="grammar">
            <h3>What moved, and where the constraint lives</h3>
            <p className={styles.kicker}>
              {rows.length === 1
                ? 'The row this section highlights'
                : 'The rows this section highlights'}
            </p>
            <table className={styles.grammar} data-support-grammar>
              <thead>
                <tr>
                  <th scope="col">What moved</th>
                  <th scope="col">Where the constraint lives</th>
                  <th scope="col">Check</th>
                </tr>
              </thead>
              <tbody>
                {MCS_SUPPORT_GRAMMAR.rows.map((row) => {
                  const highlighted = rows.some((candidate) => candidate.id === row.id)
                  return (
                    <tr
                      key={row.id}
                      data-grammar-row={row.id}
                      data-highlighted={highlighted || undefined}
                    >
                      <td>{row.whatMoved}</td>
                      <td>{row.whereTheConstraintLives}</td>
                      <td>{row.shortlist.join(' · ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className={styles.footnote} data-trend-rule>
              {MCS_SUPPORT_GRAMMAR.trendRule}
            </p>
          </section>
        </StageBlock>
      ) : null}

      {/* 7. The control strip: this setting, not this setting, no setting. */}
      <StageBlock kind="after-commitment" heading="The settings" visibility={afterCommit}>
        <section className={styles.block} data-teaching-block="control-strip">
          <h3>The settings, and what this section says about them</h3>
          {spec.walksTheLoop ? (
            <>
              <p data-control-panel-sentence>{MCS_CONTROL_PANEL.sentence}</p>
              <p data-control-panel-loading>{MCS_CONTROL_PANEL.loadingSentence}</p>
            </>
          ) : null}
          <ul className={styles.strip} data-control-strip>
            {sharedStrip.map((control) => {
              const stripState = spec.controlStrip[control.id] ?? 'no-setting'
              return (
                <li key={control.id} data-control={control.id} data-strip-state={stripState}>
                  <strong>{control.plainName}</strong>
                  <span>{STRIP_STATE_LABEL[stripState]}</span>
                  <small>
                    Moves {control.principallyMoves}. Does not move {control.doesNotMove}.
                  </small>
                </li>
              )
            })}
          </ul>
        </section>
      </StageBlock>

      {/* 7b. The live panel: what is on the screen, disclosed by the section's own reveal rule. Shown
          while the learner is reading the screen and on the explanation; folded while acting. */}
      <StageBlock kind="signals" heading="The readings, live" visibility={livePanel}>
        <section
          className={styles.block}
          data-teaching-block="live-panel"
          data-reveal-stage={reveal}
        >
          <McsTeachingPanel
            contract={contract}
            state={state}
            reveal={reveal}
            beforeMetrics={beforeMetrics}
            withholdFlowAccount={flowAccountWithheld}
          />
        </section>
      </StageBlock>

      {/* 8. A simulator limit, only on the sections where a simulated value could be taken for a real one. */}
      {contract.unmodeledNote ? (
        <StageBlock kind="boundary" heading="A simulator value on this screen">
          <section className={styles.block} data-teaching-block="boundary">
            <h3>A simulator value on this screen</h3>
            <p data-unmodeled-note>{contract.unmodeledNote}</p>
          </section>
        </StageBlock>
      ) : null}
    </div>
  )
}
