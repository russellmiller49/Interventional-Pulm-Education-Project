'use client'

import { useId, type ReactNode } from 'react'
import { isFoundationUnit } from '../../content/foundations'
import {
  BREATH_STOP_CHECKLIST_LABEL,
  breathStop,
  type BreathStopId,
} from '../../content/breathSpine'
import { breathGrammarRows, breathGrammarRowsFor } from '../../content/breathGrammar'
import { VENTILATION_CONTROL_PANEL } from '../../content/controlPanel'
import { labMetricLabels } from '../../engine/learningLab'
import { ventilationStages } from '../../content/learningCurriculum'
import type {
  VentilationStageLesson,
  VentilationStageStep,
  VentilationStepGuide,
} from '../../content/stageLessons'
import type { VentilationSimulationState } from '../../engine/types'
import {
  MechanicalVentilationTeachingPanel,
  hasVentilationTeachingPanel,
} from '../MechanicalVentilationTeachingPanel'
import { VentilationProtectionReference } from '../VentilationLearningVisuals'
import { VentilationStoryProblems } from './VentilationStoryProblems'
import { ventilationStoryProblemsFor } from '../../content/storyProblems'
import {
  FoundationEvidence,
  PlaybackAndMeasurementNote,
  foundationFigureStep,
} from './FoundationTeaching'
import { MechanismReadingEvidence, MechanismWorkedExample } from './VentilationPrerequisite'
import { ventilationSectionSpec } from '../../content/sectionSpecs'
import flow from './task-flow.module.css'
import styles from './ventilation-stage.module.css'

const KNOB_STATE_LABEL = {
  this: 'This control',
  'not-this': 'Not this control',
  'no-knob': 'No control',
} as const

/** The id the page footer's source list carries, so the lesson can point at it. */
export const VENTILATION_SOURCES_ID = 'mv-section-sources'

function StopCard({ stopId }: { stopId: BreathStopId }) {
  const stop = breathStop(stopId)
  return (
    <section className={styles.block} data-teaching-block="stop" data-stop={stopId}>
      <p className={styles.kicker}>Stop {stop.ordinal} of 4 on the breath</p>
      <h4>{stop.title}</h4>
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
      <p className={styles.kicker} id={`teaching-stop-${stopId}-checklist`}>
        {BREATH_STOP_CHECKLIST_LABEL}
      </p>
      <ul aria-labelledby={`teaching-stop-${stopId}-checklist`} data-stop-checklist>
        {stop.checklist.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}

function GuideBlock({ guide, look }: { guide: VentilationStepGuide; look?: string }) {
  return (
    <section className={styles.block} data-teaching-block="guide" data-maneuver={guide.maneuver}>
      <p className={styles.kicker}>While you do this</p>
      <h4>
        {guide.maneuver === 'pause'
          ? 'You are freezing the display, not changing anything'
          : guide.maneuver === 'hold'
            ? 'You are taking a measurement, not changing a setting'
            : 'You are changing what the patient receives'}
      </h4>
      <p>{guide.note}</p>
      <p>
        <strong>What to look at:</strong> {look ?? guide.look}
      </p>
      {guide.maneuver === 'pause' ? (
        <dl>
          <div>
            <dt>Flow</dt>
            <dd>{breathStop('expiration').look.flow}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>{breathStop('expiration').look.volume}</dd>
          </div>
          <div>
            <dt>Pressure</dt>
            <dd>{breathStop('expiration').look.pressure}</dd>
          </div>
        </dl>
      ) : null}
      {guide.watch.length > 0 ? (
        <p>
          <strong>Readings that will move:</strong>{' '}
          {guide.watch.map((metric) => labMetricLabels[metric].label).join(', ')}. They are under
          Readings to watch, and the captured comparison shows them before and after.
        </p>
      ) : null}
    </section>
  )
}

function GrammarTable({
  onlyHighlighted,
  highlighted,
}: {
  onlyHighlighted: boolean
  highlighted: ReadonlySet<string>
}) {
  const rows = onlyHighlighted
    ? breathGrammarRows.filter((row) => highlighted.has(row.id))
    : breathGrammarRows
  return (
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
          {rows.map((row) => (
            <tr key={row.id} data-grammar-row={row.id} data-highlight={highlighted.has(row.id)}>
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
  )
}

function Disclosure({
  name,
  id,
  open,
  children,
}: {
  name: string
  id: string
  open?: boolean
  children: ReactNode
}) {
  return (
    <details className={flow.lessonDisclosure} data-lesson-disclosure={id} open={open}>
      <summary>{name}</summary>
      <div>{children}</div>
    </details>
  )
}

/**
 * One lesson, in the same shape in every section.
 *
 * The walkthrough (T1) found the parts that teach — the picture and checklist, why it matters, the
 * one table, which control, the live mechanism view, the worked example — folded into seven to ten
 * panels inside one closed panel called "Teaching and worked references", which read as a
 * bibliography and was skipped; and (S6-2) that Sections 1–5 and 6–14 were laid out differently.
 *
 * Every section now carries, in this order:
 *   1. the current idea and what the section should let you do — always shown;
 *   2. the reference for this step — the breath landmark being read, the "while you do this"
 *      guide on an experiment, or the picture and checklist — shown;
 *   3. the evidence this step asks you to read, when it asks — a worked figure or a separate
 *      normal reference — shown, with the limit that applies to it right beside it;
 *   4. the same three named disclosures: Worked example, More detail, Model limits. Sources are the
 *      list at the end of the page, and the lesson says so.
 * Sections 1–5 are shorter (they have fewer mechanism panels) but not a different template.
 * Nothing here is expanded on every step: a step shows its own reference and folds the rest under
 * a name that says what is inside.
 */
export function VentilationTeachingColumn({
  lesson,
  step,
  state,
  stops,
  roundIndex = 0,
  showCapturedReference = true,
  landmarkChooser = false,
  guideLook,
}: {
  readonly lesson: VentilationStageLesson
  readonly step: VentilationStageStep
  readonly state: VentilationSimulationState
  /** The stops the breath map is lighting for this step: the walk's current stop, or the step's. */
  readonly stops: readonly BreathStopId[]
  /** Which application this step belongs to, so the worked reference is that round's breath. */
  readonly roundIndex?: 0 | 1
  /** False when the step itself already carries the marked reference. */
  readonly showCapturedReference?: boolean
  /** True on the walk, where the landmark buttons above choose the stop. */
  readonly landmarkChooser?: boolean
  /**
   * The look line the step card is printing, when it differs from the round's authored one: a
   * step working on a marked interval names the figure that is on screen. Said once, the same way.
   */
  readonly guideLook?: string
}) {
  const headingId = useId()
  const { unit } = lesson
  const spec = ventilationSectionSpec(unit.id)
  const foundation = isFoundationUnit(unit.id)
  const stage = ventilationStages.find((entry) => entry.id === unit.stage)
  const kind = step.interaction.kind
  const taskStep = kind === 'simulator-task' || kind === 'observe'
  const readingStep = kind === 'read' || kind === 'walk'
  const reveal = step.teaching === 'reveal'
  const integration = unit.id === 'high-peak-pressure-integration'
  const rows = breathGrammarRowsFor(unit.id)
  const highlighted = new Set(rows.map((row) => row.id))
  const stopCards = landmarkChooser || stops.length === 1 ? stops : []
  const foundationFigure = foundation && foundationFigureStep(step)
  const mechanismEvidence = !foundation && readingStep
  const boundaryShown = readingStep || reveal

  return (
    <section
      className={flow.block}
      data-lesson
      data-teaching-column
      data-lesson-kind={foundation ? 'foundation' : 'mechanism'}
      data-teaching-focus={step.teaching}
      aria-labelledby={headingId}
    >
      <p className={styles.kicker}>
        Lesson · {stage?.title ?? unit.stage} · Section {lesson.index + 1} of {lesson.total} ·{' '}
        {unit.minutes} min
      </p>
      <h3 id={headingId}>{integration ? 'Clinical brief' : unit.title}</h3>

      <div data-lesson-part="idea" data-teaching-block="framing">
        <p>
          <strong>The idea:</strong> {spec.newConcept}
        </p>
        <p>
          <strong>By the end you can:</strong> {spec.objective}
        </p>
      </div>

      <div data-lesson-part="task">
        {taskStep && step.guide ? <GuideBlock guide={step.guide} look={guideLook} /> : null}
        {!taskStep ? stopCards.map((stopId) => <StopCard key={stopId} stopId={stopId} />) : null}
        {!taskStep ? (
          <section data-teaching-block="method">
            <h4>The picture and the checklist</h4>
            <p className={styles.analogy}>{unit.analogy}</p>
            <p>{unit.explanation}</p>
            <ol>
              {unit.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        ) : null}
        {reveal ? (
          <section data-teaching-block="why">
            <h4>Why it matters at the bedside</h4>
            <p>{unit.why}</p>
          </section>
        ) : null}
        {reveal && rows.length > 0 ? (
          <section data-teaching-block="grammar-rows">
            <h4>This section’s row of the one table</h4>
            <GrammarTable onlyHighlighted highlighted={highlighted} />
          </section>
        ) : null}
        {integration && readingStep ? (
          <p>
            Assess the current observations and uncertainty before measuring. The setup and prior
            patient’s explanation stay undisclosed while you form an interpretation.
          </p>
        ) : null}
      </div>

      {foundationFigure ? (
        <FoundationEvidence
          unitId={unit.id as Parameters<typeof FoundationEvidence>[0]['unitId']}
          state={state}
          stops={stops}
          roundIndex={roundIndex}
          showCapturedReference={showCapturedReference}
          landmarkChooser={landmarkChooser}
        />
      ) : null}
      {mechanismEvidence ? (
        <MechanismReadingEvidence lesson={lesson} device={state.deviceId} />
      ) : null}
      {boundaryShown ? (
        <p className={flow.note} data-teaching-block="boundary">
          <strong>Model limit:</strong> {unit.boundary}
        </p>
      ) : null}

      {integration ? null : (
        <Disclosure name="Worked example" id="worked-example">
          {!foundation && !readingStep ? (
            <MechanismReadingEvidence lesson={lesson} device={state.deviceId} />
          ) : null}
          {foundation ? (
            <div data-worked-example>
              <p>{unit.example.situation}</p>
              <ol>
                {unit.example.reasoning.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <p>{unit.example.conclusion}</p>
            </div>
          ) : (
            <MechanismWorkedExample lesson={lesson} />
          )}
        </Disclosure>
      )}

      <Disclosure name="More detail" id="more-detail">
        {spec.orientation ? (
          <section data-teaching-block="orientation">
            <h4>Why a ventilator exists</h4>
            {spec.orientation.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ) : null}
        {taskStep ? (
          <section data-teaching-block="method">
            <h4>The picture and the checklist</h4>
            <p className={styles.analogy}>{unit.analogy}</p>
            <p>{unit.explanation}</p>
            <ol>
              {unit.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        ) : null}
        {!reveal ? (
          <section data-teaching-block="why">
            <h4>Why it matters at the bedside</h4>
            <p>{unit.why}</p>
          </section>
        ) : null}
        {rows.length > 0 ? (
          <section data-teaching-block="grammar">
            <h4>The one table: what moved → where on the breath → the shortlist</h4>
            <GrammarTable onlyHighlighted={false} highlighted={highlighted} />
            <p className={styles.quickNote}>
              Compare every row against this patient’s own baseline. No row carries a cutoff. This
              section’s rows are marked.
            </p>
          </section>
        ) : null}
        <section data-teaching-block="knob-strip">
          <h4>Which control, if any</h4>
          <p className={styles.kicker}>The five main settings</p>
          <p>
            This strip is the worked reading for both parts of this section. Open it before or after
            trying the optional questions; nothing here is held back.
          </p>
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
          <p className={styles.quickNote}>{VENTILATION_CONTROL_PANEL.shapingSentence}</p>
          <p className={styles.quickNote}>{VENTILATION_CONTROL_PANEL.monitoringSentence}</p>
          <p className={styles.quickNote}>{VENTILATION_CONTROL_PANEL.notSettingsSentence}</p>
        </section>
        {!foundation && hasVentilationTeachingPanel(lesson.panelId) ? (
          <section data-teaching-block="panel" data-teaching-panel={lesson.panelId}>
            <h4>On this ventilator, right now</h4>
            <p className={styles.kicker}>Computed from the running patient</p>
            <MechanicalVentilationTeachingPanel lessonId={lesson.panelId} state={state} />
          </section>
        ) : null}
        {ventilationStoryProblemsFor(unit.id).length > 0 ? (
          <section data-teaching-block="story-problems">
            <h4>Two story problems</h4>
            <VentilationStoryProblems unitId={unit.id} />
          </section>
        ) : null}
        {unit.id === 'lung-protection' && !readingStep ? (
          <section data-teaching-block="reference">
            <VentilationProtectionReference />
          </section>
        ) : null}
        {foundation ? (
          <section data-teaching-block="playback">
            <h4>Playback, patient properties and measurements</h4>
            <PlaybackAndMeasurementNote />
          </section>
        ) : null}
      </Disclosure>

      {boundaryShown ? null : (
        <Disclosure name="Model limits" id="model-limits">
          <p data-teaching-block="boundary">{unit.boundary}</p>
        </Disclosure>
      )}

      <p className={flow.note}>
        Sources for this section are listed{' '}
        <a href={`#${VENTILATION_SOURCES_ID}`}>at the end of the page</a>.
      </p>
    </section>
  )
}
