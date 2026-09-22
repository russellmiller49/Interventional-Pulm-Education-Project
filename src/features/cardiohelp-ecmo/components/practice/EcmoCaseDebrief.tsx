'use client'

import type { ReactNode } from 'react'
import { BookOpenCheck, GraduationCap, RotateCcw } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { criticalCareConceptById } from '@/features/critical-care/content/concepts'

import { cardiohelpLearnLessonByScenarioId } from '../../content/learnLessons'
import { pairedLessonIdsForCase } from '../../content/curriculum'
import { resolveScenarioReassessment } from '../../content/practiceSupport'
import { RECOGNITION_ONLY_FAULTS } from '../../engine/reducer'
import { predictionControls, predictionDirections, predictionGoals } from '../../content/scenarios'
import type { ScenarioOutcome } from '../../engine'
import type {
  EcmoSimulationState,
  ReassessmentDomain,
  ReassessmentQuestion,
  ScenarioDefinition,
  SupportMode,
} from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import styles from '../cardiohelp-ecmo.module.css'
import { buildDebriefTimeline, changesAtAction, describeSignalChange } from './debriefTimeline'
import { describeSafetyEvents } from './safetyLabels'

/**
 * The debrief of a Practice case, in the activity-contract sequence.
 *
 * One component replaces the inline debrief that used to live under the reassessment questions and
 * the shared debrief panel that repeated it below the workbench. The order is the one every
 * critical-care activity uses: the learner's model against the authored one, what they did, what
 * each action did to the circuit and then to the patient, the safety and reassessment record,
 * remediation, one transfer link, replay.
 *
 * Nothing here is rendered before the reveal, and nothing here prints an identifier: safety events
 * come through their authored labels, reassessment options through their labels and, where one is
 * authored, their rationale.
 */
export interface EcmoCaseDebriefProps {
  readonly state: EcmoSimulationState
  readonly scenario: ScenarioDefinition
  readonly outcome: ScenarioOutcome
  readonly supportMode: SupportMode
  readonly assumedConceptIds?: readonly string[]
  /**
   * Where the learner goes next, and how.
   *
   * `onSelect` is present when the target is another case on this same route, which has to be
   * loaded rather than navigated to — see the comment in `EcmoPracticeActivity`. The `href` stays
   * either way so the control is still a real link.
   */
  readonly nextLink?: {
    readonly label: string
    readonly href: { readonly pathname: string; readonly query?: Record<string, string> }
    /** Present when the target loads in place rather than navigating; see the doc comment above. */
    readonly onSelect?: () => void
  } | null
  readonly onReplay: () => void
}

interface PlanRow {
  readonly label: string
  readonly committed: string
  readonly expected: string
  readonly matched: boolean
}

function planRows(state: EcmoSimulationState, scenario: ScenarioDefinition): readonly PlanRow[] {
  const { prediction } = state.scenario
  const { expectation } = scenario
  const goalLabel = (id: string | null) =>
    predictionGoals.find((goal) => goal.id === id)?.label ?? 'No prediction recorded'
  const controlLabel = (value: string | null) =>
    predictionControls.find((control) => control.value === value)?.label ?? 'No prediction recorded'
  const directionLabel = (value: string | null) =>
    predictionDirections.find((direction) => direction.value === value)?.label ??
    'No prediction recorded'
  return [
    {
      label: 'Immediate goal',
      committed: goalLabel(prediction.goalId),
      expected: goalLabel(expectation.goalId),
      matched: prediction.goalId === expectation.goalId,
    },
    {
      label: 'First move',
      committed: controlLabel(prediction.control),
      expected: controlLabel(expectation.control),
      matched: prediction.control === expectation.control,
    },
    {
      label: 'Expected immediate effect',
      committed: directionLabel(prediction.direction),
      expected: directionLabel(expectation.direction),
      matched: prediction.direction === expectation.direction,
    },
  ]
}

function DomainComparison({
  domain,
  question,
  selectedId,
  modelBoundary,
}: {
  domain: ReassessmentDomain
  question: ReassessmentQuestion
  selectedId: string
  modelBoundary?: string
}) {
  const selected = question.options.find((option) => option.id === selectedId)
  const expected = question.options.find((option) => option.id === question.correctOptionId)
  const matched = selectedId === question.correctOptionId
  const label =
    domain === 'device'
      ? 'Device / console'
      : domain === 'circuit'
        ? 'Circuit / gas path'
        : 'Patient'
  return (
    <li data-domain={domain} data-matched={matched}>
      <strong>{label}</strong>
      {/*
       * ECMO-FELLOW-02: the key is the response this case expects — an authored teaching
       * expectation — and it used to be labelled "the modeled response", a claim that the monitor
       * had shown it. Where the case names a finding this model does not produce, it says so here.
       */}
      <span>
        You recorded: {selected?.label ?? 'nothing recorded'}
        {matched ? ' · this is the response this case expects.' : ''}
      </span>
      {selected?.rationale ? <small>{selected.rationale}</small> : null}
      {!matched && expected ? (
        <>
          <span>The response this case expects: {expected.label}</span>
          {expected.rationale ? <small>{expected.rationale}</small> : null}
        </>
      ) : null}
      {modelBoundary ? (
        <small data-model-boundary="response">Not shown by this simulation: {modelBoundary}</small>
      ) : null}
    </li>
  )
}

function Block({
  heading,
  kicker,
  children,
}: {
  heading: string
  kicker?: string
  children: ReactNode
}) {
  return (
    <section className={styles.debriefBlock} aria-label={heading}>
      {kicker ? <span className={styles.kicker}>{kicker}</span> : null}
      <h3>{heading}</h3>
      {children}
    </section>
  )
}

export function EcmoCaseDebrief({
  state,
  scenario,
  outcome,
  supportMode,
  assumedConceptIds,
  nextLink,
  onReplay,
}: EcmoCaseDebriefProps) {
  const rows = planRows(state, scenario)
  const planMatched = rows.every((row) => row.matched)
  const causeCorrected = state.scenario.correctedFaults.includes(
    scenario.expectation.correctiveFault,
  )
  const clinical = state.scenario.clinical
  const clinicalCase = scenario.clinicalCase
  const reassessment = resolveScenarioReassessment(scenario)
  const submitted = state.scenario.reassessment
  const safetyEvents = describeSafetyEvents(scenario, outcome.criticalErrors)
  /*
   * Where the patient actually is at the reveal, beside the action log rather than instead of it.
   *
   * "No safety event is recorded" is a statement about one thing: whether an action this case
   * treats as unsafe was taken. On the VV integrated case it sat alone under a heading that reads
   * as a verdict, at the end of an off-sweep trial the patient had failed — SpO₂ 82, PaCO₂ 72,
   * pH 7.16 on the monitor at that moment (IV-3). The readings are the model's own current state,
   * printed unrounded from the patient rather than re-derived, and carry the same simulated-values
   * badge as every other number in this debrief.
   */
  const patientAtReveal: readonly { readonly label: string; readonly value: string }[] =
    supportMode === 'va'
      ? [
          { label: 'Right-arm SpO₂', value: `${state.patient.rightRadialSpo2.toFixed(1)} %` },
          { label: 'Femoral SpO₂', value: `${state.patient.femoralArterialSpo2.toFixed(1)} %` },
          { label: 'MAP', value: `${state.patient.meanArterialPressure.toFixed(0)} mm Hg` },
          {
            label: 'PaCO₂ / pH',
            value: `${state.patient.paCO2.toFixed(0)} mm Hg / ${state.patient.pH.toFixed(2)}`,
          },
        ]
      : [
          { label: 'SpO₂', value: `${state.patient.spo2.toFixed(1)} %` },
          { label: 'PaCO₂', value: `${state.patient.paCO2.toFixed(0)} mm Hg` },
          { label: 'pH', value: state.patient.pH.toFixed(2) },
          { label: 'Work of breathing', value: state.patient.workOfBreathing },
        ]
  /** The authored "correction" here is recognition and escalation; the pattern is still running. */
  const recognitionOnly = RECOGNITION_ONLY_FAULTS.includes(scenario.expectation.correctiveFault)
  const pairedLessonId = pairedLessonIdsForCase(scenario.id)[0]
  const pairedLesson = pairedLessonId
    ? cardiohelpLearnLessonByScenarioId.get(pairedLessonId)
    : undefined
  const concepts = (assumedConceptIds ?? [])
    .map((id) => criticalCareConceptById.get(id))
    .filter((concept): concept is NonNullable<typeof concept> => Boolean(concept))
  const timeline = buildDebriefTimeline(state)
  const actionCount = timeline.reduce((total, group) => total + group.entries.length, 0)

  return (
    <div className={styles.debriefPanel} data-case-debrief>
      <p>
        This is the authored case explanation. It does not claim that you performed the actions
        described.
      </p>
      <Block kicker="Case explanation" heading="Your reasoning and the case's own">
        <dl className={styles.planComparison}>
          {rows.map((row) => (
            <div key={row.label} data-matched={row.matched}>
              <dt>{row.label}</dt>
              <dd>
                <span>You recorded: {row.committed}</span>
                {row.matched ? null : <span>Expected in this case: {row.expected}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {state.scenario.prediction.committed && !planMatched && causeCorrected ? (
          <p role="note">
            Your later actions matched the path this case teaches. That is a recovery from the plan
            you committed, not a match of it.
          </p>
        ) : null}
        <h4>{scenario.debrief.diagnosis}</h4>
        <ol>
          {scenario.debrief.causalChain.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Block>

      <Block heading="What you did">
        {actionCount === 0 ? (
          <p>No action was recorded in this run.</p>
        ) : (
          <ol className={styles.debriefTimeline}>
            {timeline.map((group) => (
              <li key={group.time} data-debrief-second={group.time}>
                <time>{group.time} s</time>
                <span>
                  {group.entries.map((entry) => entry.label).join(' · ')}
                  {group.entries.length > 1 ? (
                    <small data-same-second>
                      {' '}
                      — {group.entries.length} actions in the same modeled second; the clock did not
                      advance between them.
                    </small>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block heading="Action, response, and what the patient did">
        {actionCount === 0 ? (
          <p>Nothing to compare: no action was applied before the reveal.</p>
        ) : (
          <>
            <p className={styles.debriefNote}>
              Each comparison names its own pair of readings. Circuit, device, and external gas
              settings can change at an action without advancing the clock; a patient change an
              action earns appears from the next modeled second. Modeled seconds are compressed:
              they are not a bedside time course.
            </p>
            <ol className={styles.consequenceList}>
              {timeline.map((group) => (
                <li key={group.time} data-debrief-group={group.time}>
                  <strong>At {group.time} s</strong>
                  {group.entries.map((entry) => {
                    const atAction = entry.observation ? changesAtAction(entry.observation) : null
                    return (
                      <div key={entry.id} className={styles.debriefAction} data-debrief-action>
                        <span>{entry.label}</span>
                        {entry.authoredResponse ? (
                          <small>Case description: {entry.authoredResponse}</small>
                        ) : null}
                        <small data-at-action>
                          {atAction === null
                            ? 'No reading was recorded at this action.'
                            : atAction.length === 0
                              ? 'At the action: no change in the pump, flow, pressure, or settings compared here.'
                              : `At the action: ${atAction.map(describeSignalChange).join('; ')}.`}
                        </small>
                      </div>
                    )
                  })}
                  {group.intervalSeconds === 0 ? (
                    <small data-interval="none">
                      No modeled time passed before{' '}
                      {group === timeline.at(-1) ? 'the reveal' : 'the next action'}, so no later
                      response could appear.
                    </small>
                  ) : (
                    <dl className={styles.debriefChips} data-interval={group.intervalSeconds}>
                      <div>
                        <dt>
                          This run, {group.time} → {group.intervalEndTime} s (
                          {group.intervalSeconds} modeled s)
                        </dt>
                        <dd>
                          {group.interval
                            ? group.interval.map(describeSignalChange).join('; ')
                            : 'No reading was recorded for this interval.'}
                        </dd>
                      </div>
                      <div data-untreated>
                        <dt>Same case left untreated from the start, same seconds</dt>
                        <dd>
                          {group.untreated
                            ? group.untreated.map(describeSignalChange).join('; ')
                            : 'Not available.'}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <small data-badge>Simulated values from the bounded teaching model</small>
                </li>
              ))}
            </ol>
          </>
        )}
        {clinical && clinicalCase ? (
          <p>
            Trajectory at the reveal: <strong>{clinical.trajectory.replaceAll('-', ' ')}</strong>.{' '}
            {causeCorrected
              ? clinicalCase.completionResponse
              : (clinical.lastResponse ?? clinicalCase.deteriorationResponse)}
          </p>
        ) : null}
      </Block>

      <Block heading="Safety and reassessment">
        {safetyEvents.length ? (
          <div className={styles.safetyDebrief} role="note">
            <strong>Safety events in this run</strong>
            <ul>
              {safetyEvents.map((label, index) => (
                <li key={`${index}-${label}`}>{label}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>
            No action in this run was one this case records as unsafe. That is a statement about the
            action log and about nothing else: it is not a safety certification, and it says nothing
            about how the patient is doing. Read that below.
          </p>
        )}
        <div data-patient-at-reveal>
          <span className={styles.kicker}>Where the patient is at the reveal</span>
          <dl aria-label="Patient state at the reveal">
            {patientAtReveal.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <small data-badge>Simulated values from the bounded teaching model</small>
        </div>
        {recognitionOnly && causeCorrected ? (
          <p role="note" data-recognition-only>
            What this case asks for here is recognition and escalation, and that is what it
            represents. Recognition and escalation do not themselves treat this pattern. The
            readings above show the current simulated patient state, including any changes as the
            model clock advanced; they do not demonstrate a treatment response to recognition.
          </p>
        ) : null}
        {submitted ? (
          <ul className={styles.domainComparison}>
            <DomainComparison
              domain="device"
              question={reassessment.device}
              selectedId={submitted.deviceOptionId}
            />
            <DomainComparison
              domain="circuit"
              question={reassessment.circuit}
              selectedId={submitted.circuitOptionId}
            />
            <DomainComparison
              domain="patient"
              question={reassessment.patient}
              selectedId={submitted.patientOptionId}
              modelBoundary={reassessment.modelBoundary}
            />
          </ul>
        ) : null}
        <div>
          <span className={styles.kicker}>
            {clinicalCase
              ? 'What should have been done, and why'
              : 'The workflow this case teaches'}
          </span>
          <ol>
            {scenario.debrief.correctWorkflow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
        <div className={styles.safetyDebrief}>
          <strong>Safety notes</strong>
          <ul>
            {scenario.debrief.safetyNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Block>

      <Block heading="What this case was designed to teach">
        <p>
          <strong>{scenario.title}.</strong> {scenario.summary}
        </p>
        {clinicalCase ? (
          <>
            <p>
              <strong>The decision:</strong> {clinicalCase.decisionPrompt}
            </p>
            <ul className={styles.caseObjectives}>
              {clinicalCase.learningObjectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            <small>Curriculum source: {clinicalCase.sourceCase}</small>
          </>
        ) : null}
      </Block>

      <Block heading="Go deeper">
        <div className={styles.debriefLinks}>
          {pairedLesson ? (
            <Link
              href={{
                pathname: `${cardiohelpEcmoNavBase}/learn`,
                query: { lesson: pairedLesson.scenarioId, track: supportMode },
              }}
            >
              <GraduationCap aria-hidden="true" /> Review the paired lesson: {pairedLesson.title}
            </Link>
          ) : (
            <p>No lesson in this track teaches this mechanism yet.</p>
          )}
        </div>
        {concepts.length ? (
          <ul className={styles.conceptList}>
            {concepts.map((concept) => (
              <li key={concept.id}>
                <strong>{concept.title}</strong>
                <span>{concept.shortExplanation}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <EcmoSourceList
          evidenceIds={scenario.evidenceIds}
          title="Sources for this case"
          headingLevel={4}
          surface="workspace"
        />
      </Block>

      <div className={styles.debriefActions}>
        {nextLink ? (
          <Link
            href={nextLink.href}
            data-debrief-next
            onClick={
              nextLink.onSelect
                ? (event) => {
                    event.preventDefault()
                    nextLink.onSelect?.()
                  }
                : undefined
            }
          >
            <BookOpenCheck aria-hidden="true" /> Next: {nextLink.label}
          </Link>
        ) : null}
        <button type="button" onClick={onReplay} data-debrief-replay>
          <RotateCcw aria-hidden="true" /> Replay this case
        </button>
      </div>
    </div>
  )
}
