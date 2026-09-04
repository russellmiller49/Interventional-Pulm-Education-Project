'use client'

import type { ReactNode } from 'react'
import { BookOpenCheck, GraduationCap, RotateCcw } from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { criticalCareConceptById } from '@/features/critical-care/content/concepts'

import { cardiohelpLearnLessonByScenarioId } from '../../content/learnLessons'
import { pairedLessonIdsForCase } from '../../content/curriculum'
import { resolveScenarioReassessment } from '../../content/practiceSupport'
import { predictionControls, predictionDirections, predictionGoals } from '../../content/scenarios'
import type { ScenarioOutcome } from '../../engine'
import type {
  EcmoSimulationState,
  ReassessmentDomain,
  ReassessmentQuestion,
  ScenarioDefinition,
  SupportMode,
  TrendSample,
} from '../../engine/types'
import { EcmoSourceList } from '../evidence/EcmoSourceList'
import styles from '../cardiohelp-ecmo.module.css'
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
  readonly nextLink?: {
    readonly label: string
    readonly href: { readonly pathname: string; readonly query?: Record<string, string> }
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
    predictionGoals.find((goal) => goal.id === id)?.label ?? 'Not committed'
  const controlLabel = (value: string | null) =>
    predictionControls.find((control) => control.value === value)?.label ?? 'Not committed'
  const directionLabel = (value: string | null) =>
    predictionDirections.find((direction) => direction.value === value)?.label ?? 'Not committed'
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

function sampleAt(trends: readonly TrendSample[], time: number): TrendSample | undefined {
  let best: TrendSample | undefined
  for (const sample of trends) {
    if (sample.time <= time) best = sample
    else break
  }
  return best
}

function delta(before: number | undefined, after: number | undefined, digits: number): string {
  if (before === undefined || after === undefined) return 'no sample'
  const change = after - before
  if (Math.abs(change) < 10 ** -digits / 2) return 'unchanged'
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(digits)}`
}

function patientConsequence(
  trends: readonly TrendSample[],
  from: number,
  to: number,
): readonly { readonly label: string; readonly value: string }[] {
  const before = sampleAt(trends, from)
  const after = sampleAt(trends, to)
  return [
    { label: 'Circuit flow', value: `${delta(before?.flow, after?.flow, 2)} L/min` },
    { label: 'SpO₂', value: `${delta(before?.spo2, after?.spo2, 1)} %` },
    { label: 'PaCO₂', value: `${delta(before?.paCO2, after?.paCO2, 0)} mm Hg` },
    { label: 'MAP', value: `${delta(before?.map, after?.map, 0)} mm Hg` },
  ]
}

function DomainComparison({
  domain,
  question,
  selectedId,
}: {
  domain: ReassessmentDomain
  question: ReassessmentQuestion
  selectedId: string
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
      <span>
        You recorded: {selected?.label ?? 'nothing recorded'}
        {matched ? ' · this is the modeled response.' : ''}
      </span>
      {selected?.rationale ? <small>{selected.rationale}</small> : null}
      {!matched && expected ? (
        <>
          <span>Modeled response: {expected.label}</span>
          {expected.rationale ? <small>{expected.rationale}</small> : null}
        </>
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
  const usedClues = (scenario.hints ?? []).filter((hint) =>
    state.scenario.usedHintIds.includes(hint.id),
  )
  const pairedLessonId = pairedLessonIdsForCase(scenario.id)[0]
  const pairedLesson = pairedLessonId
    ? cardiohelpLearnLessonByScenarioId.get(pairedLessonId)
    : undefined
  const concepts = (assumedConceptIds ?? [])
    .map((id) => criticalCareConceptById.get(id))
    .filter((concept): concept is NonNullable<typeof concept> => Boolean(concept))
  const actionEntries = clinical
    ? clinical.appliedInterventions.map((record, index, all) => ({
        id: record.id,
        time: record.time,
        label: record.label,
        immediate: record.response,
        effect: record.effect,
        until: all[index + 1]?.time ?? state.simulationTime,
      }))
    : state.history
        .filter((entry) => entry.kind === 'action')
        .map((entry, index, all) => ({
          id: entry.id,
          time: entry.time,
          label: entry.label,
          immediate: null,
          effect: null,
          until: all[index + 1]?.time ?? state.simulationTime,
        }))

  return (
    <div className={styles.debriefPanel} data-case-debrief>
      <Block kicker="Debrief" heading="Your model and the authored one">
        <dl className={styles.planComparison}>
          {rows.map((row) => (
            <div key={row.label} data-matched={row.matched}>
              <dt>{row.label}</dt>
              <dd>
                <span>You committed: {row.committed}</span>
                {row.matched ? null : <span>Authored expectation: {row.expected}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {!planMatched && causeCorrected ? (
          <p role="note">
            Your later actions matched the authored path. That is remediation of the plan you
            committed, not a match of it.
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
        {actionEntries.length === 0 ? (
          <p>No action was recorded in this run.</p>
        ) : (
          <ol className={styles.debriefTimeline}>
            {actionEntries.map((entry) => (
              <li key={entry.id} data-effect={entry.effect ?? undefined}>
                <time>{entry.time} s</time>
                <span>{entry.label}</span>
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block heading="Action, response, and what the patient did">
        {actionEntries.length === 0 ? (
          <p>Nothing to compare: no action was applied before the reveal.</p>
        ) : (
          <ol className={styles.consequenceList}>
            {actionEntries.map((entry) => (
              <li key={entry.id}>
                <strong>
                  {entry.time} s · {entry.label}
                </strong>
                {entry.immediate ? <span>Immediate: {entry.immediate}</span> : null}
                <dl aria-label="Patient and circuit change until the next action">
                  {patientConsequence(state.trends, entry.time, entry.until).map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <small data-badge>Simulated values from the bounded teaching model</small>
              </li>
            ))}
          </ol>
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
          <p>No safety stop appeared in this run.</p>
        )}
        {usedClues.length ? (
          <p>
            Clues used: {usedClues.map((hint) => hint.title).join(', ')}. They stay part of this
            reasoning trace.
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
            />
          </ul>
        ) : null}
        <div>
          <span className={styles.kicker}>
            {clinicalCase ? 'What should have been done, and why' : 'The authored workflow'}
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
          <Link href={nextLink.href} data-debrief-next>
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
