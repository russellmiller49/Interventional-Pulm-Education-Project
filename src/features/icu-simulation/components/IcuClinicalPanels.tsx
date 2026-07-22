'use client'

import type { Dispatch, ReactNode } from 'react'
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

import type {
  IcuAssessmentId,
  IcuCareInterventionId,
  IcuCommand,
  IcuObservation,
  IcuReassessmentDomain,
  IcuScenarioDefinition,
  IcuSimulationMode,
  IcuSimulationState,
  IcuTrendSample,
} from '../engine'
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

  return (
    <section className={styles.caseGuide} aria-labelledby="case-guide-title">
      <header>
        <div>
          <span className={styles.panelKicker}>{mode} pathway</span>
          <h2 id="case-guide-title">{scenario.title}</h2>
        </div>
        <span className={styles.phaseBadge}>{state.phase}</span>
      </header>
      <p className={styles.caseNarrative}>{scenario.openingNarrative}</p>

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
          <div>
            <span>Outcome</span>
            <strong>{mode === 'sandbox' ? 'Unscored' : `${state.outcome.score.total}%`}</strong>
            <small>
              {state.outcome.mastery ? 'Mastery achieved' : 'Review the causal debrief'}
            </small>
          </div>
          <ul>
            {scenario.debrief.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
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

export function IcuCarePanel({
  state,
  scenario,
  dispatch,
}: {
  state: IcuSimulationState
  scenario: IcuScenarioDefinition
  dispatch: Dispatch<IcuCommand>
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

      <div className={styles.careGrid}>
        {scenario.capabilities.interventions.map((interventionId) => {
          const copy = careCopy[interventionId]
          const Icon = copy.Icon
          const completed = state.performedActionIds.includes(interventionId)
          return (
            <button
              type="button"
              key={interventionId}
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

      <div className={styles.reassessmentBox}>
        <div>
          <span className={styles.panelKicker}>Close the loop</span>
          <h3>Document a full reassessment</h3>
          <p>Confirm the patient—not just the device—responded to your intervention.</p>
        </div>
        <ul>
          {domains.map((domain) => (
            <li key={domain} data-complete={state.reassessedDomains.includes(domain) || undefined}>
              {state.reassessedDomains.includes(domain) ? <Check aria-hidden="true" /> : <span />}
              {reassessmentCopy[domain]}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => dispatch({ type: 'patient.reassess', domains })}>
          Reassess all domains
        </button>
      </div>
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

export function IcuTimelinePanel({ state }: { state: IcuSimulationState }) {
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
                  <strong>{event.label}</strong>
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

export function IcuSourceNotes({ scenario }: { scenario: IcuScenarioDefinition }) {
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
          <h3>Scenario evidence record</h3>
          <p>
            Scenario version {scenario.version} · review status {scenario.reviewStatus}. Evidence
            identifiers remain attached to authored events, interventions, and checkpoints.
          </p>
          <ul className={styles.evidenceList}>
            {scenario.evidenceIds.map((evidenceId) => (
              <li key={evidenceId}>{evidenceId}</li>
            ))}
          </ul>
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
