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
            <p>
              <strong>Check here:</strong>
            </p>
            <ul>
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
            <strong>This establishes:</strong> {contract.whatThisEstablishes}
          </p>
          <p data-does-not-establish>
            <strong>This does not establish:</strong> {contract.whatThisDoesNotEstablish}
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
      <StageBlock
        kind="signals"
        heading="The readings, live"
        visibility={
          phase === 'recognize' || phase === 'predict' || explaining ? 'shown' : 'collapsed'
        }
      >
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

      {/* 8. The boundary: what the model leaves out, read once the mechanism is the learner's. */}
      <StageBlock kind="boundary" heading="What this simulation does not represent">
        <section className={styles.block} data-teaching-block="boundary">
          <h3>What this simulation does not represent</h3>
          {contract.unmodeledNote ? <p data-unmodeled-note>{contract.unmodeledNote}</p> : null}
          <p>
            Displayed pump flows are this model’s own estimates and are labelled so; effective
            delivery is a reasoned line no console shows. A control change advances the model by a
            small fixed step. No insertion, repositioning, purge, anticoagulation or alarm-limit
            instruction is given, and no patient outcome is modelled.
          </p>
        </section>
      </StageBlock>
    </div>
  )
}
