'use client'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import type { StageBlockVisibility } from '@/features/learning-module/stage/StageTeachingScope'

import { breathStop, type BreathStopId } from '../../content/breathSpine'
import { breathGrammarRows, breathGrammarRowsFor } from '../../content/breathGrammar'
import { VENTILATION_CONTROL_PANEL } from '../../content/controlPanel'
import { ventilationStages } from '../../content/learningCurriculum'
import type { VentilationStageLesson, VentilationStageStep } from '../../content/stageLessons'
import type { VentilationSimulationState } from '../../engine/types'
import {
  MechanicalVentilationTeachingPanel,
  hasVentilationTeachingPanel,
} from '../MechanicalVentilationTeachingPanel'
import { VentilationProtectionReference } from '../VentilationLearningVisuals'
import { VentilationStoryProblems } from './VentilationStoryProblems'
import { ventilationStoryProblemsFor } from '../../content/storyProblems'
import styles from './ventilation-stage.module.css'

const KNOB_STATE_LABEL = {
  this: 'This control',
  'not-this': 'Not this control',
  'no-knob': 'No control',
} as const

/**
 * The teaching pane, one block at a time.
 *
 * Before the prediction the pane frames the section — what it is for, which stop of the breath it
 * stands at, what to look at — and says nothing about the mechanism. The analogy, the precise
 * statement, the checklist, the grammar row, the knob strip, the live teaching panel and the
 * boundary open on the Explain step, fold to their headings on the transfer, and are never in the
 * document before the commitment.
 */
export function VentilationTeachingColumn({
  lesson,
  step,
  state,
  predictionCommitted,
  stops,
}: {
  readonly lesson: VentilationStageLesson
  readonly step: VentilationStageStep
  readonly state: VentilationSimulationState
  readonly predictionCommitted: boolean
  /** The stops the breath map is lighting for this step: the walk's current stop, or the step's. */
  readonly stops: readonly BreathStopId[]
}) {
  const { unit, spec } = lesson
  const stage = ventilationStages.find((entry) => entry.id === unit.stage)
  const focus = step.teaching
  const revealed =
    predictionCommitted && (focus === 'reveal' || focus === 'transfer' || focus === 'task')

  const framingVisibility: StageBlockVisibility = focus === 'framing' ? 'shown' : 'collapsed'
  const stopVisibility: StageBlockVisibility =
    focus === 'framing' || focus === 'task' ? 'shown' : 'collapsed'
  const revealVisibility: StageBlockVisibility = !revealed
    ? 'hidden'
    : focus === 'reveal'
      ? 'shown'
      : 'collapsed'
  const methodVisibility: StageBlockVisibility = !predictionCommitted
    ? 'hidden'
    : focus === 'reveal'
      ? 'shown'
      : 'collapsed'

  const rows = breathGrammarRowsFor(unit.id)
  const highlighted = new Set(rows.map((row) => row.id))

  return (
    <div data-teaching-column data-teaching-focus={focus}>
      <StageBlock kind="question" heading="This section" visibility={framingVisibility}>
        <section className={styles.block} data-teaching-block="framing">
          <p className={styles.kicker}>
            {stage?.title ?? unit.stage} · Section {lesson.index + 1} of {lesson.total} ·{' '}
            {unit.minutes} min
          </p>
          <h3>{unit.title}</h3>
          <p>
            <strong>What is new:</strong> {unit.increment}
          </p>
          <p>
            <strong>One idea:</strong> {spec.newConcept}
          </p>
          <p>
            <strong>By the end you can:</strong> {spec.objective}
          </p>
        </section>
      </StageBlock>

      {spec.orientation ? (
        <StageBlock
          kind="question"
          heading="Why a ventilator exists"
          visibility={focus === 'framing' && step.phase === 'recognize' ? 'shown' : 'collapsed'}
        >
          <section className={styles.block} data-teaching-block="orientation">
            <h3>Why a ventilator exists</h3>
            {spec.orientation.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        </StageBlock>
      ) : null}

      {stops.map((stopId) => {
        const stop = breathStop(stopId)
        return (
          <StageBlock
            key={stopId}
            kind="signals"
            heading={`On the breath: ${stop.title}`}
            visibility={stopVisibility}
          >
            <section className={styles.block} data-teaching-block="stop" data-stop={stopId}>
              <p className={styles.kicker}>Stop {stop.ordinal} of 4 on the breath</p>
              <h3>{stop.title}</h3>
              <p>
                Plain name: {stop.plainName}. On the console: {stop.consoleLabel}.
              </p>
              <p className={styles.analogy}>{stop.analogy}</p>
              <dl>
                <div>
                  <dt>Pressure</dt>
                  <dd>{stop.look.pressure}</dd>
                </div>
                <div>
                  <dt>Flow</dt>
                  <dd>{stop.look.flow}</dd>
                </div>
                <div>
                  <dt>Volume</dt>
                  <dd>{stop.look.volume}</dd>
                </div>
              </dl>
              <ul>
                {stop.checklist.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </StageBlock>
        )
      })}

      {stops.length === 0 && focus !== 'reveal' && !spec.orientation ? (
        <section className={styles.block} data-teaching-block="whole-breath">
          <p className={styles.kicker}>The whole breath</p>
          <p>
            This section stands at the whole breath rather than one stop. Read every breath in
            order: the start, the push, the switch, the emptying.
          </p>
        </section>
      ) : null}

      <StageBlock
        kind="pattern"
        heading="The picture and the checklist"
        visibility={methodVisibility}
      >
        <section className={styles.block} data-teaching-block="method">
          <p className={styles.kicker}>Hold it this way</p>
          <p className={styles.analogy}>{unit.analogy}</p>
          <p>{unit.explanation}</p>
          <ol>
            {unit.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      </StageBlock>

      <StageBlock
        kind="after-commitment"
        heading="Why it matters at the bedside"
        visibility={revealVisibility}
      >
        <section className={styles.block} data-teaching-block="why">
          <p className={styles.kicker}>Why it matters</p>
          <p>{unit.why}</p>
        </section>
      </StageBlock>

      {rows.length > 0 ? (
        <StageBlock
          kind="after-commitment"
          heading="What moved, where on the breath, and the shortlist"
          visibility={revealVisibility}
        >
          <section className={styles.block} data-teaching-block="grammar">
            <p className={styles.kicker}>The one table</p>
            <h3>What moved → where on the breath → the shortlist</h3>
            <div className={styles.grammarWrap}>
              <table className={styles.grammar}>
                <thead>
                  <tr>
                    <th scope="col">What moved</th>
                    <th scope="col">Where</th>
                    <th scope="col">Shortlist</th>
                  </tr>
                </thead>
                <tbody>
                  {breathGrammarRows.map((row) => (
                    <tr
                      key={row.id}
                      data-grammar-row={row.id}
                      data-highlight={highlighted.has(row.id)}
                    >
                      <td>{row.whatMoved}</td>
                      <td>
                        {row.where.kind === 'stop'
                          ? `${breathStop(row.where.stopId).title}. ${row.where.detail}`
                          : row.where.detail}
                      </td>
                      <td>{row.shortlist.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.quickNote}>
              Compare every row against this patient’s own baseline. No row carries a cutoff.
            </p>
          </section>
        </StageBlock>
      ) : null}

      <StageBlock
        kind="after-commitment"
        heading="Which control, if any"
        visibility={revealVisibility}
      >
        <section className={styles.block} data-teaching-block="knob-strip">
          <p className={styles.kicker}>The five things you can change</p>
          <p>{VENTILATION_CONTROL_PANEL.sentence}</p>
          <ul className={styles.strip}>
            {VENTILATION_CONTROL_PANEL.knobs.map((knob) => {
              const entry = spec.knobStrip[knob.id]
              return (
                <li key={knob.id} data-knob={knob.id} data-knob-state={entry.state}>
                  <span className={styles.knobState}>{KNOB_STATE_LABEL[entry.state]}</span>
                  <strong>{knob.consoleLabel}</strong>
                  <span>{entry.note}</span>
                </li>
              )
            })}
          </ul>
          {spec.shapingNote ? <p>{spec.shapingNote}</p> : null}
          <p className={styles.quickNote}>{VENTILATION_CONTROL_PANEL.monitoringSentence}</p>
        </section>
      </StageBlock>

      {hasVentilationTeachingPanel(lesson.panelId) ? (
        <StageBlock
          kind="after-commitment"
          heading="On this ventilator, right now"
          visibility={revealVisibility}
        >
          <section
            className={styles.block}
            data-teaching-block="panel"
            data-teaching-panel={lesson.panelId}
          >
            <p className={styles.kicker}>Computed from the running patient</p>
            <MechanicalVentilationTeachingPanel lessonId={lesson.panelId} state={state} />
          </section>
        </StageBlock>
      ) : null}

      {ventilationStoryProblemsFor(unit.id).length > 0 ? (
        <StageBlock
          kind="after-commitment"
          heading="Two story problems"
          visibility={revealVisibility}
        >
          <VentilationStoryProblems unitId={unit.id} />
        </StageBlock>
      ) : null}

      {unit.id === 'lung-protection' ? (
        <StageBlock
          kind="after-commitment"
          heading="The guideline reference"
          visibility={revealVisibility}
        >
          <section className={styles.block} data-teaching-block="reference">
            <VentilationProtectionReference />
          </section>
        </StageBlock>
      ) : null}

      <StageBlock
        kind="discriminators"
        heading="A worked example"
        visibility={revealed ? 'collapsed' : 'hidden'}
      >
        <section className={`${styles.block} ${styles.example}`} data-teaching-block="example">
          <p className={styles.kicker}>A constructed illustration, not patient data</p>
          <p>{unit.example.situation}</p>
          <ol>
            {unit.example.reasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p>
            <strong>{unit.example.conclusion}</strong>
          </p>
        </section>
      </StageBlock>

      <StageBlock
        kind="boundary"
        heading="What this model does not represent"
        visibility={revealVisibility}
      >
        <section className={styles.block} data-teaching-block="boundary">
          <p className={styles.kicker}>Model boundary</p>
          <p>{unit.boundary}</p>
        </section>
      </StageBlock>
    </div>
  )
}
