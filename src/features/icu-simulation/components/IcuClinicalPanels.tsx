'use client'

import { useState, type Dispatch } from 'react'
import type { Route } from 'next'
import {
  AlertTriangle,
  Beaker,
  Check,
  CheckCircle2,
  ClipboardList,
  Droplet,
  HeartHandshake,
  HeartPulse,
  Image as ImageIcon,
  Microscope,
  Radio,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Waves,
  Wind,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'
import { getCriticalCareIcuScenarioReadiness } from '@/features/critical-care/progress/integrated'

import { ICU_EVIDENCE_BY_ID } from '../content'
import { ICU_SCORE_WEIGHTS, icuScoreDomains } from '../engine'
import type {
  IcuAssessmentId,
  IcuCareInterventionId,
  IcuCommand,
  IcuDiseaseDrivers,
  IcuObservation,
  IcuReassessmentDomain,
  IcuScenarioDefinition,
  IcuScenarioFamily,
  IcuShockClassification,
  IcuSimulationMode,
  IcuSimulationState,
  IcuTrendSample,
} from '../engine'
import { IcuRemediationLinks } from './IcuRemediationLinks'
import styles from './icu-simulation.module.css'

const assessmentCopy: Readonly<
  Record<IcuAssessmentId, { label: string; detail: string; Icon: typeof Stethoscope }>
> = {
  'bedside-exam': {
    label: 'Bedside examination',
    detail: 'Perfusion, congestion, respiratory effort, and focused findings',
    Icon: Stethoscope,
  },
  abg: {
    label: 'Arterial blood gas',
    detail: 'Gas exchange and acid–base observation',
    Icon: Beaker,
  },
  'core-labs': {
    label: 'Core laboratory panel',
    detail: 'Renal, hematology, and chemistry',
    Icon: Microscope,
  },
  lactate: { label: 'Lactate', detail: 'Perfusion marker with delayed trend', Icon: Waves },
  coagulation: {
    label: 'Coagulation panel',
    detail: 'Platelets and clotting observation',
    Icon: Droplet,
  },
  'focused-echo': {
    label: 'Focused echocardiography',
    detail: 'Ventricles, filling, and constraint',
    Icon: HeartPulse,
  },
  'chest-imaging': {
    label: 'Chest imaging',
    detail: 'Lung, line, and device overview',
    Icon: ImageIcon,
  },
  pac: { label: 'PAC assessment', detail: 'Pressure and flow observations', Icon: Radio },
}

const careCopy: Readonly<
  Record<
    IcuCareInterventionId,
    { label: string; detail: string; group: string; Icon: typeof Syringe }
  >
> = {
  'fluid-bolus': {
    label: 'Fluid challenge',
    detail: 'Bounded crystalloid action',
    group: 'Volume',
    Icon: Droplet,
  },
  'blood-products': {
    label: 'Blood products',
    detail: 'Bounded transfusion support',
    group: 'Volume',
    Icon: Droplet,
  },
  'vasopressor-up': {
    label: 'Increase vasopressor tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: Syringe,
  },
  'vasopressor-down': {
    label: 'Decrease vasopressor tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: Syringe,
  },
  'inotrope-up': {
    label: 'Increase inotrope tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: HeartPulse,
  },
  'inotrope-down': {
    label: 'Decrease inotrope tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: HeartPulse,
  },
  'sedation-up': {
    label: 'Increase sedation tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: Syringe,
  },
  'sedation-down': {
    label: 'Decrease sedation tier',
    detail: 'Relative tier only',
    group: 'Medication',
    Icon: Syringe,
  },
  prone: {
    label: 'Prone positioning',
    detail: 'Positioning team action',
    group: 'Respiratory',
    Icon: Wind,
  },
  supine: {
    label: 'Return supine',
    detail: 'Positioning team action',
    group: 'Respiratory',
    Icon: Wind,
  },
  antimicrobials: {
    label: 'Administer antimicrobials',
    detail: 'Abstracted treatment milestone',
    group: 'Definitive care',
    Icon: Syringe,
  },
  'source-control': {
    label: 'Complete source control',
    detail: 'Abstracted team milestone',
    group: 'Definitive care',
    Icon: HeartHandshake,
  },
  reperfusion: {
    label: 'Complete reperfusion',
    detail: 'Abstracted team milestone',
    group: 'Definitive care',
    Icon: HeartHandshake,
  },
  'tamponade-drainage': {
    label: 'Drain tamponade',
    detail: 'Abstracted urgent drainage',
    group: 'Definitive care',
    Icon: HeartHandshake,
  },
  'communicate-plan': {
    label: 'Communicate team plan',
    detail: 'Shared safety action',
    group: 'Safety',
    Icon: ClipboardList,
  },
}

const reassessmentCopy: Readonly<Record<IcuReassessmentDomain, string>> = {
  hemodynamics: 'Hemodynamics',
  respiratory: 'Respiratory',
  renal: 'Renal',
  perfusion: 'Perfusion',
  devices: 'Devices',
}

const classificationCopy: Readonly<Record<IcuShockClassification, string>> = {
  distributive: 'Distributive / vasodilatory shock',
  'lv-cardiogenic': 'Predominantly LV cardiogenic shock',
  'rv-obstructive': 'RV-predominant obstructive shock',
  'hypovolemic-hemorrhagic': 'Hemorrhagic hypovolemic shock',
  'tamponade-obstructive': 'Tamponade physiology',
  'mixed-cardiogenic-vasodilatory': 'Mixed cardiogenic–vasodilatory shock',
}

const expectedClassificationByFamily: Readonly<Record<IcuScenarioFamily, IcuShockClassification>> =
  {
    'septic-ards-aki': 'distributive',
    'lv-cardiogenic': 'lv-cardiogenic',
    'massive-pe-rv': 'rv-obstructive',
    hemorrhagic: 'hypovolemic-hemorrhagic',
    tamponade: 'tamponade-obstructive',
    'mixed-cardiogenic-vasodilatory': 'mixed-cardiogenic-vasodilatory',
  }

const maskedAssessmentNarratives: Readonly<Record<string, string>> = {
  'septic-ards-aki':
    'A synthetic adult transferred from the emergency department has worsening hypotension, bilateral lung injury, oliguria, and rising lactate despite initial stabilization.',
  'lv-cardiogenic':
    'A synthetic adult arrives after acute chest discomfort with pulmonary edema, cool extremities, hypotension, and falling urine output.',
  'massive-pe-rv':
    'A synthetic adult develops abrupt dyspnea, syncope, hypoxemia, elevated right-sided pressures, and hypotension.',
  hemorrhagic:
    'A synthetic adult after an abdominal procedure develops falling arterial pressure, tachycardia, cool skin, and a declining hemoglobin.',
  tamponade:
    'A synthetic adult after an invasive cardiac procedure develops progressive hypotension, tachycardia, elevated venous pressure, and a narrowing pulse pressure.',
  'mixed-cardiogenic-vasodilatory':
    'A synthetic adult with infection develops hypotension, cool extremities, pulmonary congestion, and rising lactate despite initial treatment.',
}

const sandboxDriverCopy: readonly {
  driver: keyof IcuDiseaseDrivers
  label: string
  detail: string
  minimum: number
  maximum: number
  step: number
  unit: string
}[] = [
  {
    driver: 'vasoplegiaSeverity',
    label: 'Vasoplegia',
    detail: 'Relative loss of systemic vascular tone',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'leftVentricularFailureSeverity',
    label: 'LV failure',
    detail: 'Relative left-ventricular contractile impairment',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'rightVentricularFailureSeverity',
    label: 'RV failure',
    detail: 'Relative right-ventricular contractile impairment',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'pulmonaryVascularObstructionSeverity',
    label: 'Pulmonary vascular obstruction',
    detail: 'Relative RV afterload from obstructive physiology',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'tamponadePressureMmHg',
    label: 'Pericardial constraint',
    detail: 'Modeled external cardiac pressure',
    minimum: 0,
    maximum: 25,
    step: 1,
    unit: 'mmHg',
  },
  {
    driver: 'lungInjurySeverity',
    label: 'Lung injury',
    detail: 'Relative shunt and compliance burden',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'acuteKidneyInjurySeverity',
    label: 'Kidney injury',
    detail: 'Relative renal filtration impairment',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
  {
    driver: 'bleedingRateMlHour',
    label: 'Bleeding rate',
    detail: 'Synthetic ongoing blood-loss driver',
    minimum: 0,
    maximum: 1_500,
    step: 50,
    unit: 'mL/h',
  },
  {
    driver: 'infectionBurden',
    label: 'Infection burden',
    detail: 'Relative inflammatory and infectious burden',
    minimum: 0,
    maximum: 1,
    step: 0.05,
    unit: 'severity',
  },
]

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatObservationValue(key: string, value: number | string | boolean | null): string {
  if (value === null) return 'Not available'
  if (typeof value === 'boolean') return value ? 'Present' : 'Absent'
  if (typeof value === 'string') return value
  const unit = key.toLowerCase().includes('percent')
    ? '%'
    : key.toLowerCase().includes('mmhg')
      ? ' mmHg'
      : key.toLowerCase().includes('mmoll')
        ? ' mmol/L'
        : key.toLowerCase().includes('mgdl')
          ? ' mg/dL'
          : key.toLowerCase().includes('gdl')
            ? ' g/dL'
            : ''
  return `${Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1)}${unit}`
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatResponseActual(actual: number | boolean | string, unit: string | null): string {
  if (typeof actual === 'boolean') return actual ? 'Completed' : 'Not completed'
  if (typeof actual === 'string') return humanizeKey(actual)
  const value = Math.abs(actual) >= 100 ? actual.toFixed(0) : actual.toFixed(2)
  return `${Number(value)}${unit ? ` ${unit}` : ''}`
}

export function IcuAlarmCenter({
  state,
  dispatch,
}: {
  state: IcuSimulationState
  dispatch: Dispatch<IcuCommand>
}) {
  const activeAlarms = state.alarms.filter((alarm) => alarm.active)
  return (
    <section
      className={styles.alarmCenter}
      data-clear={activeAlarms.length === 0 || undefined}
      aria-label="Patient and device alarms"
      aria-live="polite"
    >
      <div className={styles.alarmCenterLabel}>
        {activeAlarms.length === 0 ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <ShieldAlert aria-hidden="true" />
        )}
        <div>
          <strong>
            {activeAlarms.length === 0
              ? 'No active model alarms'
              : `${activeAlarms.length} active alarm${activeAlarms.length === 1 ? '' : 's'}`}
          </strong>
          <span>Patient and all connected devices</span>
        </div>
      </div>
      {activeAlarms.length > 0 ? (
        <ul>
          {activeAlarms.map((alarm) => (
            <li key={alarm.id} data-priority={alarm.priority ?? 'unmapped'}>
              <AlertTriangle aria-hidden="true" />
              <div>
                <span>
                  {alarm.subsystem.toUpperCase()} ·{' '}
                  {alarm.priority === null ? 'priority mapping pending review' : alarm.priority}
                </span>
                <strong>{alarm.message}</strong>
              </div>
              <button
                type="button"
                disabled={alarm.acknowledgedAtSeconds !== null}
                onClick={() => dispatch({ type: 'alarm.acknowledge', alarmId: alarm.id })}
              >
                {alarm.acknowledgedAtSeconds === null ? 'Acknowledge' : 'Acknowledged'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function IcuCaseGuide({
  state,
  scenario,
  mode,
  dispatch,
}: {
  state: IcuSimulationState
  scenario: IcuScenarioDefinition
  mode: IcuSimulationMode
  dispatch: Dispatch<IcuCommand>
}) {
  const completedCheckpoints = state.outcome.checkpointIdsCompleted
  const coachingVisible = mode === 'learn' || mode === 'practice' || state.phase === 'debrief'
  const sessionKey = `${state.scenarioId}:${state.seed}`
  const [classificationDraft, setClassificationDraft] = useState<{
    sessionKey: string
    value: IcuShockClassification
  }>(() => ({
    sessionKey,
    value: state.diagnosis.classification ?? 'distributive',
  }))
  const classification =
    classificationDraft.sessionKey === sessionKey
      ? classificationDraft.value
      : (state.diagnosis.classification ?? 'distributive')
  const expectedClassification = expectedClassificationByFamily[state.scenarioFamily]
  const activeCriticalErrors = scenario.criticalErrors.filter((error) =>
    state.outcome.criticalErrorIds.includes(error.id),
  )
  const achievedCheckpoints = scenario.checkpoints.filter((checkpoint) =>
    completedCheckpoints.includes(checkpoint.id),
  )
  const missedCheckpoints = scenario.checkpoints.filter(
    (checkpoint) => !completedCheckpoints.includes(checkpoint.id),
  )
  const achievedActions = scenario.interventions.filter((intervention) =>
    state.performedActionIds.includes(intervention.actionId),
  )
  const missedActions = scenario.interventions.filter(
    (intervention) => !state.performedActionIds.includes(intervention.actionId),
  )
  const response = state.outcome.response
  const passedResponsePaths = (scenario.masteryResponse.oneOf ?? []).filter((path) =>
    response.passedPathIds.includes(path.id),
  )
  const visibleResponseCriteria = response.criteria.filter(
    (criterion) =>
      criterion.pathId === null ||
      response.passedPathIds.length === 0 ||
      response.passedPathIds.includes(criterion.pathId),
  )
  const substitutedActions = response.substitutedActionIds
    .map((actionId) => scenario.interventions.find((item) => item.actionId === actionId)?.label)
    .filter((label): label is string => Boolean(label))
  const remediationReadiness = getCriticalCareIcuScenarioReadiness(state.scenarioFamily, {
    version: 1,
    activities: [],
    updatedAt: '1970-01-01T00:00:00.000Z',
  })

  return (
    <section className={styles.caseGuide} aria-labelledby="case-guide-title">
      <header>
        <div>
          <span className={styles.panelKicker}>{mode} pathway</span>
          <h2 id="case-guide-title">
            {mode === 'assess' && state.phase !== 'debrief'
              ? 'Unclassified ICU patient'
              : scenario.title}
          </h2>
        </div>
        <span className={styles.phaseBadge}>{state.phase}</span>
      </header>
      <p className={styles.caseNarrative}>
        {mode === 'assess' && state.phase !== 'debrief'
          ? (maskedAssessmentNarratives[scenario.id] ??
            'An evolving synthetic adult ICU patient requires assessment, shock classification, and serial reassessment.')
          : scenario.openingNarrative}
      </p>

      <div className={styles.classificationCommit}>
        <div>
          <span className={styles.panelKicker}>Classify before escalating</span>
          <h3>Working shock mechanism</h3>
          <p>
            Commit to the dominant mechanism using the evidence available now.{' '}
            {mode === 'assess'
              ? 'The first commitment counts for assessment scoring; later reclassification is documented but does not replace it.'
              : 'You may reassess the patient later; correctness remains hidden until debrief.'}
          </p>
        </div>
        <label>
          <span>Classification</span>
          <select
            value={classification}
            onChange={(event) =>
              setClassificationDraft({
                sessionKey,
                value: event.target.value as IcuShockClassification,
              })
            }
          >
            {(Object.keys(classificationCopy) as IcuShockClassification[]).map((value) => (
              <option value={value} key={value}>
                {classificationCopy[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => dispatch({ type: 'diagnosis.commit', classification })}
        >
          {state.diagnosis.committed ? (
            <>
              <Check aria-hidden="true" /> Commit reclassification
            </>
          ) : (
            'Commit working diagnosis'
          )}
        </button>
      </div>

      {mode === 'assess' && state.phase !== 'debrief' ? (
        <div className={styles.coachingWithheld}>
          <ShieldAlert aria-hidden="true" />
          <p>
            <strong>Assessment cues are withheld.</strong> Use the chart, patient response, device
            state, and timeline. Causal coaching returns in the debrief.
          </p>
        </div>
      ) : coachingVisible ? (
        <div className={styles.objectivesBlock}>
          <h3>Learning objectives</h3>
          <ul>
            {scenario.learningObjectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode !== 'sandbox' ? (
        <div className={styles.checkpointTrack}>
          <h3>Course checkpoints</h3>
          <ol>
            {scenario.checkpoints.map((checkpoint, index) => {
              const complete = completedCheckpoints.includes(checkpoint.id)
              const revealLabel = mode !== 'assess' || state.phase === 'debrief'
              return (
                <li key={checkpoint.id} data-complete={complete || undefined}>
                  <span>{complete ? <Check aria-label="Complete" /> : index + 1}</span>
                  <div>
                    <strong>{revealLabel ? checkpoint.label : `Checkpoint ${index + 1}`}</strong>
                    <small>{complete ? 'Completed' : 'In progress'}</small>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <p className={styles.sandboxNote}>
          Sandbox is unscored. It begins from a reviewed synthetic preset and still enforces bounded
          device combinations and safety alarms.
        </p>
      )}

      {state.phase === 'debrief' ? (
        <div className={styles.debriefPanel}>
          <div className={styles.debriefOutcome}>
            <span>Outcome</span>
            <strong>
              {mode === 'sandbox' || mode === 'learn'
                ? 'Unscored'
                : `${state.outcome.score.total}%`}
            </strong>
            <small>
              {mode === 'sandbox' || mode === 'learn'
                ? 'No mastery record in this mode'
                : state.outcome.mastery
                  ? 'Mastery achieved'
                  : 'Review the causal debrief'}
            </small>
          </div>
          <div className={styles.debriefContent}>
            <section aria-labelledby="domain-score-title">
              <h3 id="domain-score-title">Six-domain score</h3>
              {mode === 'sandbox' || mode === 'learn' ? (
                <p>Domain scoring is shown only in Practice and Assess.</p>
              ) : (
                <dl className={styles.scoreBreakdown}>
                  {icuScoreDomains.map((domain) => (
                    <div key={domain}>
                      <dt>{humanizeKey(domain)}</dt>
                      <dd>
                        {state.outcome.score[domain]}/{ICU_SCORE_WEIGHTS[domain]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section aria-labelledby="response-gate-title" className={styles.responseGate}>
              <h3 id="response-gate-title">Physiologic response gate</h3>
              <p className={styles.responseGateStatus} data-complete={response.passed || undefined}>
                {response.passed ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertTriangle aria-hidden="true" />
                )}
                <strong>
                  {response.passed ? 'Response demonstrated' : 'Response not demonstrated'}
                </strong>
              </p>
              {passedResponsePaths.length > 0 ? (
                <p>Authored pathway: {passedResponsePaths.map((path) => path.label).join(' · ')}</p>
              ) : scenario.masteryResponse.oneOf ? (
                <p>No complete response pathway was demonstrated.</p>
              ) : null}
              <ul className={styles.responseCriteria}>
                {visibleResponseCriteria.map((criterion) => (
                  <li key={criterion.id} data-complete={criterion.passed || undefined}>
                    {criterion.passed ? (
                      <CheckCircle2 aria-label="Met" />
                    ) : (
                      <AlertTriangle aria-label="Not met" />
                    )}
                    <span>
                      <strong>{criterion.label}</strong>
                      <small>
                        Actual {formatResponseActual(criterion.actual, criterion.unit)} · modeled
                        threshold {criterion.target}
                        {criterion.unit ? ` ${criterion.unit}` : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              {substitutedActions.length > 0 ? (
                <p>
                  The demonstrated alternative pathway supplied score credit for:{' '}
                  {substitutedActions.join('; ')}. These credits did not alter the learner action
                  history.
                </p>
              ) : null}
              <p className={styles.responseThresholdNote} role="note">
                These thresholds are pending-review educational simulator calibration—not bedside
                treatment targets, clinical device guidance, or patient-specific recommendations.
              </p>
            </section>

            <section aria-labelledby="diagnosis-review-title">
              <h3 id="diagnosis-review-title">Classification review</h3>
              <dl className={styles.diagnosisReview}>
                <div>
                  <dt>Latest commitment</dt>
                  <dd>
                    {state.diagnosis.classification
                      ? classificationCopy[state.diagnosis.classification]
                      : 'No classification committed'}
                  </dd>
                </div>
                <div>
                  <dt>Expected mechanism</dt>
                  <dd>{classificationCopy[expectedClassification]}</dd>
                </div>
                <div>
                  <dt>Serial commitments</dt>
                  <dd>{state.diagnosis.commitments.length}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="checkpoint-review-title">
              <h3 id="checkpoint-review-title">Checkpoint review</h3>
              <div className={styles.debriefColumns}>
                <div>
                  <strong>Achieved ({achievedCheckpoints.length})</strong>
                  <ul>
                    {achievedCheckpoints.length > 0 ? (
                      achievedCheckpoints.map((checkpoint) => (
                        <li key={checkpoint.id}>{checkpoint.label}</li>
                      ))
                    ) : (
                      <li>No authored checkpoints completed.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <strong>Missed ({missedCheckpoints.length})</strong>
                  <ul>
                    {missedCheckpoints.length > 0 ? (
                      missedCheckpoints.map((checkpoint) => (
                        <li key={checkpoint.id}>{checkpoint.label}</li>
                      ))
                    ) : (
                      <li>No checkpoints missed.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <section aria-labelledby="action-review-title">
              <h3 id="action-review-title">Key action review</h3>
              <p>
                {achievedActions.length} authored action{achievedActions.length === 1 ? '' : 's'}{' '}
                achieved · {missedActions.length} not demonstrated.
              </p>
              {missedActions.length > 0 ? (
                <ul>
                  {missedActions.slice(0, 6).map((intervention) => (
                    <li key={intervention.actionId}>Consider: {intervention.label}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section aria-labelledby="safety-review-title">
              <h3 id="safety-review-title">Safety-critical review</h3>
              {activeCriticalErrors.length > 0 ? (
                <ul className={styles.criticalErrorList}>
                  {activeCriticalErrors.map((error) => (
                    <li key={error.id}>{error.message}</li>
                  ))}
                </ul>
              ) : (
                <p>No authored critical safety error was triggered.</p>
              )}
            </section>

            <section aria-labelledby="causal-debrief-title">
              <h3 id="causal-debrief-title">Causal debrief</h3>
              <ul>
                {scenario.debrief.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>

            <section aria-label="Focused remediation links">
              <IcuRemediationLinks
                readiness={remediationReadiness}
                heading="Focused remediation"
                showCompletion={false}
              />
            </section>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.completeButton}
          onClick={() => dispatch({ type: 'session.complete' })}
        >
          Complete course and open debrief
        </button>
      )}
    </section>
  )
}

function ResultCard({ observation }: { observation: IcuObservation }) {
  const values = Object.entries(observation.values)
  return (
    <article className={styles.resultCard}>
      <header>
        <span>
          {assessmentCopy[observation.assessmentId as IcuAssessmentId]?.label ??
            humanizeKey(observation.assessmentId)}
        </span>
        <time>available {formatTime(observation.availableAtSeconds)}</time>
      </header>
      {observation.interpretation ? <p>{observation.interpretation}</p> : null}
      {values.length > 0 ? (
        <dl>
          {values.slice(0, 10).map(([key, value]) => (
            <div key={key}>
              <dt>{humanizeKey(key)}</dt>
              <dd>{formatObservationValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No discrete result values were returned.</p>
      )}
    </article>
  )
}

export function IcuDiagnosticsPanel({
  state,
  scenario,
  dispatch,
}: {
  state: IcuSimulationState
  scenario: IcuScenarioDefinition
  dispatch: Dispatch<IcuCommand>
}) {
  const availableResults = state.observations
    .filter(
      (observation) =>
        observation.assessmentId !== 'continuous-monitor' &&
        observation.availableAtSeconds <= state.clock.elapsedSeconds,
    )
    .slice()
    .reverse()
  const pendingResults = state.observations.filter(
    (observation) => observation.availableAtSeconds > state.clock.elapsedSeconds,
  )

  return (
    <section className={styles.clinicalPanel} aria-labelledby="diagnostics-title">
      <header className={styles.panelIntro}>
        <div>
          <span className={styles.panelKicker}>Assessment</span>
          <h2 id="diagnostics-title">Order, interpret, and reassess</h2>
        </div>
        <p>Results appear on the shared timeline and may include modeled delay or uncertainty.</p>
      </header>

      <div className={styles.orderGrid} aria-label="Available assessments">
        {scenario.capabilities.assessments.map((assessmentId) => {
          const copy = assessmentCopy[assessmentId]
          const Icon = copy.Icon
          return (
            <button
              type="button"
              key={assessmentId}
              onClick={() => dispatch({ type: 'assessment.order', assessmentId })}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{copy.label}</strong>
                <small>{copy.detail}</small>
              </span>
            </button>
          )
        })}
      </div>

      {pendingResults.length > 0 ? (
        <p className={styles.pendingResults} role="status">
          {pendingResults.length} ordered result{pendingResults.length === 1 ? ' is' : 's are'}{' '}
          pending. Advance time to receive the observation.
        </p>
      ) : null}

      <div className={styles.resultStack} aria-live="polite">
        {availableResults.length > 0 ? (
          availableResults
            .slice(0, 6)
            .map((observation) => <ResultCard observation={observation} key={observation.id} />)
        ) : (
          <div className={styles.emptyState}>
            <ClipboardList aria-hidden="true" />
            <strong>No diagnostic observations yet</strong>
            <span>Order a focused assessment above.</span>
          </div>
        )}
      </div>
    </section>
  )
}

export function IcuSandboxControls({
  state,
  dispatch,
}: {
  state: IcuSimulationState
  dispatch: Dispatch<IcuCommand>
}) {
  return (
    <section className={styles.clinicalPanel} aria-labelledby="sandbox-controls-title">
      <header className={styles.panelIntro}>
        <div>
          <span className={styles.panelKicker}>Synthetic disease controls</span>
          <h2 id="sandbox-controls-title">Build a bounded mixed-shock state</h2>
        </div>
        <p>
          Change one modeled driver, advance time, and observe the coupled patient and device
          response. These values are educational abstractions, not clinical targets.
        </p>
      </header>
      <div className={styles.sandboxControlGrid}>
        {sandboxDriverCopy.map(({ driver, label, detail, minimum, maximum, step, unit }) => {
          const value = state.patient.drivers[driver]
          return (
            <label className={styles.sandboxControl} key={driver}>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <output>
                {step < 1 ? value.toFixed(2) : value.toFixed(0)} {unit}
              </output>
              <input
                type="range"
                min={minimum}
                max={maximum}
                step={step}
                value={value}
                aria-label={`${label}, ${value} ${unit}`}
                onChange={(event) =>
                  dispatch({
                    type: 'sandbox.adjust',
                    driver,
                    value: Number(event.target.value),
                  })
                }
              />
            </label>
          )
        })}
      </div>
      <p className={styles.sandboxBoundary} role="note">
        Synthetic preset only. The engine enforces reviewed bounds and records semantic driver
        changes in the replay; it never accepts a direct patient-state patch.
      </p>
    </section>
  )
}

export function IcuCarePanel({
  state,
  scenario,
  dispatch,
  controlsLocked = false,
  neutralLocked = false,
}: {
  state: IcuSimulationState
  scenario: IcuScenarioDefinition
  dispatch: Dispatch<IcuCommand>
  controlsLocked?: boolean
  neutralLocked?: boolean
}) {
  const domains = Object.keys(reassessmentCopy) as IcuReassessmentDomain[]
  return (
    <section className={styles.clinicalPanel} aria-labelledby="care-actions-title">
      <header className={styles.panelIntro}>
        <div>
          <span className={styles.panelKicker}>Interventions</span>
          <h2 id="care-actions-title">Immediate and definitive care</h2>
        </div>
        <p>Medication choices use relative tiers. No drug doses or local protocol are modeled.</p>
      </header>

      {neutralLocked ? (
        <div className={styles.neutralControlLock} role="status">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Treatment formulary locked</strong>
            <p>
              Commit the first working shock classification in the Course panel. Case-specific
              intervention names remain concealed until that scored commitment is recorded.
            </p>
          </div>
        </div>
      ) : controlsLocked ? (
        <p className={styles.controlLockNote} role="status">
          Commit a working shock classification in the Course panel before initiating treatment.
          Diagnostic orders remain available.
        </p>
      ) : null}

      {!neutralLocked ? (
        <div className={styles.careGrid}>
          {scenario.capabilities.interventions.map((interventionId) => {
            const copy = careCopy[interventionId]
            const Icon = copy.Icon
            const completed = state.performedActionIds.includes(`care:${interventionId}`)
            return (
              <button
                type="button"
                key={interventionId}
                disabled={controlsLocked}
                data-complete={completed || undefined}
                onClick={() => dispatch({ type: 'care.perform', interventionId })}
              >
                <Icon aria-hidden="true" />
                <span>
                  <small>{copy.group}</small>
                  <strong>{copy.label}</strong>
                  <em>{copy.detail}</em>
                </span>
                {completed ? <Check aria-label="Performed" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {!neutralLocked ? (
        <div className={styles.reassessmentBox}>
          <div>
            <span className={styles.panelKicker}>Close the loop</span>
            <h3>Document a full reassessment</h3>
            <p>Confirm the patient—not just the device—responded to your intervention.</p>
          </div>
          <ul>
            {domains.map((domain) => (
              <li
                key={domain}
                data-complete={state.reassessedDomains.includes(domain) || undefined}
              >
                {state.reassessedDomains.includes(domain) ? <Check aria-hidden="true" /> : <span />}
                {reassessmentCopy[domain]}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => dispatch({ type: 'patient.reassess', domains })}>
            Reassess all domains
          </button>
        </div>
      ) : null}
    </section>
  )
}

type TrendKey =
  | 'mapMmHg'
  | 'spo2Percent'
  | 'lactateMmolL'
  | 'cardiacOutputLMin'
  | 'netFluidBalanceMl'

const trendCopy: Readonly<Record<TrendKey, { label: string; unit: string; color: string }>> = {
  mapMmHg: { label: 'MAP', unit: 'mmHg', color: '#ff6f84' },
  spo2Percent: { label: 'SpO₂', unit: '%', color: '#5adfe0' },
  lactateMmolL: { label: 'Lactate', unit: 'mmol/L', color: '#f3c563' },
  cardiacOutputLMin: { label: 'Cardiac output', unit: 'L/min', color: '#66df9e' },
  netFluidBalanceMl: { label: 'Net fluid', unit: 'mL', color: '#a99aff' },
}

function trendPath(samples: readonly IcuTrendSample[], key: TrendKey): string {
  if (samples.length === 0) return ''
  const values = samples.map((sample) => sample[key]).filter(Number.isFinite)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const spread = Math.max(maximum - minimum, 0.01)
  return samples
    .map((sample, index) => {
      const x = samples.length === 1 ? 100 : (index / (samples.length - 1)) * 100
      const y = 34 - ((sample[key] - minimum) / spread) * 28
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function TrendCard({
  samples,
  trendKey,
}: {
  samples: readonly IcuTrendSample[]
  trendKey: TrendKey
}) {
  const copy = trendCopy[trendKey]
  const first = samples[0]?.[trendKey]
  const latest = samples.at(-1)?.[trendKey]
  const delta = latest !== undefined && first !== undefined ? latest - first : 0
  const direction = Math.abs(delta) < 0.05 ? 'stable' : delta > 0 ? 'rising' : 'falling'
  return (
    <article className={styles.trendCard}>
      <header>
        <span>{copy.label}</span>
        <strong style={{ color: copy.color }}>
          {latest === undefined
            ? '—'
            : Math.abs(latest) >= 10
              ? latest.toFixed(0)
              : latest.toFixed(1)}{' '}
          <small>{copy.unit}</small>
        </strong>
      </header>
      <svg viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 34 L100 34 M0 20 L100 20 M0 6 L100 6" className={styles.trendGridLine} />
        <path
          d={trendPath(samples, trendKey)}
          fill="none"
          stroke={copy.color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p>
        {samples.length === 0
          ? 'No trend samples yet'
          : `${copy.label} is ${direction} over the displayed window.`}
      </p>
    </article>
  )
}

export function IcuTimelinePanel({
  state,
  maskScenarioEvents = false,
}: {
  state: IcuSimulationState
  maskScenarioEvents?: boolean
}) {
  const samples = state.trends.slice(-120)
  return (
    <section className={styles.clinicalPanel} aria-labelledby="trends-title">
      <header className={styles.panelIntro}>
        <div>
          <span className={styles.panelKicker}>Longitudinal course</span>
          <h2 id="trends-title">Trends and timeline</h2>
        </div>
        <p>Visual trends include a sentence-level text equivalent below every trace.</p>
      </header>

      <div className={styles.trendGrid}>
        {(Object.keys(trendCopy) as TrendKey[]).map((key) => (
          <TrendCard key={key} samples={samples} trendKey={key} />
        ))}
      </div>

      <details className={styles.timelineDetails} open>
        <summary>Patient and intervention timeline ({state.history.length} events)</summary>
        {state.history.length > 0 ? (
          <ol>
            {state.history
              .slice(-24)
              .reverse()
              .map((event) => (
                <li key={event.id} data-kind={event.kind}>
                  <time>{formatTime(event.elapsedSeconds)}</time>
                  <span>{event.kind}</span>
                  <strong>
                    {maskScenarioEvents && event.kind === 'scenario'
                      ? 'Patient condition changed—repeat focused assessment.'
                      : event.label}
                  </strong>
                </li>
              ))}
          </ol>
        ) : (
          <p>No events have been recorded.</p>
        )}
      </details>
    </section>
  )
}

const sourceModules = [
  ['ICU Hemodynamics', '/icu-hemodynamics'],
  ['Mechanical Ventilation', '/mechanical-ventilation'],
  ['Mechanical Circulatory Support', '/mechanical-circulatory-support'],
  ['CARDIOHELP ECMO', '/cardiohelp-ecmo'],
  ['Baxter CRRT', '/baxter-crrt'],
] as const

export function IcuSourceNotes({
  scenario,
  masked = false,
}: {
  scenario: IcuScenarioDefinition
  masked?: boolean
}) {
  const evidenceSources = scenario.evidenceIds.map((evidenceId) => ({
    evidenceId,
    source: ICU_EVIDENCE_BY_ID.get(evidenceId),
  }))

  return (
    <section className={styles.sourceNotes} aria-labelledby="source-notes-title">
      <header>
        <span className={styles.panelKicker}>Provenance & boundaries</span>
        <h2 id="source-notes-title">Source notes</h2>
      </header>
      <div className={styles.sourceNoteGrid}>
        <div>
          <h3>Integrated teaching engines</h3>
          <p>
            This module combines educational models from five focused modules. Use those labs for
            detailed device orientation and their complete source notes.
          </p>
          <ul>
            {sourceModules.map(([label, href]) => (
              <li key={href}>
                <Link href={href as Route}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{masked ? 'Assessment evidence boundary' : 'Scenario evidence record'}</h3>
          {masked ? (
            <p>
              Scenario-specific titles and links are withheld during a masked assessment because
              they could reveal the intended diagnosis. The complete evidence record appears in the
              debrief.
            </p>
          ) : (
            <>
              <p>
                Scenario version {scenario.version} · review status {scenario.reviewStatus}.
                Evidence identifiers remain attached to authored events, interventions, and
                checkpoints.
              </p>
              <ul className={styles.evidenceCards}>
                {evidenceSources.map(({ evidenceId, source }) => (
                  <li key={evidenceId}>
                    {source ? (
                      <>
                        {source.url.startsWith('/') ? (
                          <Link href={source.url as Route}>{source.title}</Link>
                        ) : (
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>
                        )}
                        <span>
                          {source.organization} · {source.year} ·{' '}
                          {source.sourceType.replace('-', ' ')}
                        </span>
                        <small>
                          Review: {source.reviewStatus}. {source.limitation}
                        </small>
                      </>
                    ) : (
                      <>
                        <strong>{evidenceId}</strong>
                        <small>Evidence registry entry pending.</small>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3>Interpretation boundary</h3>
          <p>
            Numeric behavior is simplified, deterministic educational modeling—not a validated
            digital twin. Relative medication tiers are intentionally non-prescriptive. Device
            initiation represents a supervised readiness decision, never procedural training.
          </p>
        </div>
      </div>
    </section>
  )
}
