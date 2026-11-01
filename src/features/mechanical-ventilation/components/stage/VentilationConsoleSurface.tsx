'use client'

import { useMemo, type Dispatch } from 'react'

import { FitWidthSurface } from '@/features/learning-module/stage/FitWidthSurface'

import {
  bedsideActionId,
  interventionLabels,
  quickControlId,
} from '../../content/consoleControlIds'
import { deliveredVolumeStepNote, inspiratoryTimeStepNote } from '../../content/deliveredVolume'
import { ventilatorDeviceProfiles } from '../../content/deviceProfiles'
import {
  ventilationExperimentByUnit,
  type LabMetric,
  type LabRound,
} from '../../content/learningExperiments'
import { resolveVentilationSimulationCase } from '../../content/learningPatient'
import { PATIENT_REPORT_METRICS, patientReportAvailability } from '../../content/patientReport'
import { plateauAcquisition } from '../../content/plateauAcquisition'
import { ventilationReferenceMarker } from '../../content/referenceEvidence'
import type { VentilationStageStep } from '../../content/stageLessons'
import { VENTILATION_NUMBERS } from '../../content/teachingNumbers'
import {
  labMetricLabels,
  labSnapshot,
  openLabRound,
  type LabAction,
  type LabSession,
} from '../../engine/learningLab'
import { holdStatus } from '../../engine/learningMeasurements'
import type { VentilationAction, VentilatorDeviceId } from '../../engine/types'
import { BedsidePanel } from '../BedsidePanel'
import {
  MechanicalVentilatorConsole,
  type ConsoleInspection,
  type ConsolePendingSetting,
} from '../MechanicalVentilatorConsole'
import { BreathProvenanceNotes, CapturedBreath } from './CapturedBreath'
import { VentilationClockBar } from './VentilationClockBar'
import { VentilationResponseTimeline } from './VentilationResponseTimeline'
import styles from './task-flow.module.css'

const pauseOrInspect = (round: LabRound) =>
  round.goals.some(
    (goal) => goal.type === 'pause-expiration' || goal.type === 'inspect-inspiration',
  )

/**
 * What the console's screen draws while it is frozen.
 *
 * Live, the console draws its own traces; paused, it holds one breath still for reading, with a
 * cursor — the one-breath inspection lives on the console, not in a panel beside it.
 *
 * - A question about a marked interval: that part's opening breath with its marker, the evidence
 *   sentence withheld until the prediction is committed.
 * - A pause-or-inspect round with its baseline taken: the baseline breath — the record the lab
 *   matches Use this captured interval against — with the marker and, on the task step, the button.
 * - Before anything has run in this part: the baseline breath, the patient as the part opened.
 * - After: the learner's own last breath.
 *
 * A running clock, or a stop the page made by going to the background, shows the live traces.
 */
export function ventilationConsoleInspection({
  step,
  session,
  openingRecord,
  lab,
}: {
  readonly step: VentilationStageStep
  readonly session: LabSession
  /** This part's opening record, the breath a baseline is taken from. */
  readonly openingRecord: LabSession['simulation']['waveforms']
  readonly lab: Dispatch<LabAction>
}): ConsoleInspection | null {
  const state = session.simulation
  if (!state.paused || session.pauseOrigin === 'background') return null
  const round = sessionRound(session)
  const evidence = session.evidence[session.round]
  const marker = ventilationReferenceMarker(session.unitId, session.round) ?? undefined
  const committed = evidence.prediction !== undefined
  const effort = step.presentation.effort
  const kind = step.interaction.kind
  if (marker && (kind === 'read' || kind === 'prediction'))
    return {
      samples: openingRecord,
      label: `Baseline breath · interval ${marker.markerId}`,
      marker,
      revealMarkerEvidence: committed,
      effort,
    }
  if (pauseOrInspect(round) && evidence.baseline)
    return {
      samples: evidence.baseline.waveforms,
      label: marker ? `Baseline breath · interval ${marker.markerId}` : 'Baseline breath',
      marker,
      revealMarkerEvidence: committed,
      onInspect:
        kind === 'simulator-task' && !evidence.response
          ? (sample) => lab({ type: 'INSPECT', sampleTime: sample.time })
          : undefined,
      effort,
    }
  if (state.simulationTime > 0)
    return {
      samples: state.waveforms,
      label: 'Your last breath',
      revealMarkerEvidence: true,
      effort,
    }
  return {
    samples: evidence.baseline?.waveforms ?? openingRecord,
    label: 'Baseline breath',
    revealMarkerEvidence: true,
    effort,
  }
}

function sessionRound(session: LabSession): LabRound {
  return ventilationExperimentByUnit.get(session.unitId)!.rounds[session.round]
}

/** This part's opening record, for this console: what a baseline is taken from. */
export function useOpeningRecord(session: LabSession) {
  return useMemo(
    () => openLabRound(session.unitId, session.round, session.device).baselineRecord,
    [session.unitId, session.round, session.device],
  )
}

/**
 * The simulator, as one surface: the clock bar, the console itself, the readings the step watches,
 * and only the side cards this round needs — the teaching patient's
 * mechanics, the bedside actions, the bedside findings, the predicted-body-weight card. The device
 * picker and Reset patient are folded at the foot.
 *
 * There is one console on the page and one clock. The experiment panel, the slider "teaching
 * interface" and the hidden full-console toggle it replaces were three ways to meet the same
 * patient (owner review, 2026-10-15).
 */
export function VentilationConsoleSurface({
  session,
  step,
  round,
  engine,
  lab,
  guidedControlId,
  onPendingChange,
  onSelectDevice,
  onResetPatient,
  cue = null,
  density,
}: {
  readonly session: LabSession
  readonly step: VentilationStageStep
  readonly round: LabRound
  readonly engine: Dispatch<VentilationAction>
  readonly lab: Dispatch<LabAction>
  readonly guidedControlId: string | null
  readonly onPendingChange: (pending: ConsolePendingSetting | null) => void
  readonly onSelectDevice: (device: VentilatorDeviceId) => void
  readonly onResetPatient: () => void
  /**
   * The task's next move, repeated on the clock bar: the Now card says it in the text column, and
   * this says it where the learner's hands are, above the console.
   */
  readonly cue?: string | null
  /**
   * `laptop` in the desktop workspace, where the console shares a viewport-tall pane with its
   * clock: the console's compact sizes (`mechanical-ventilation.module.css`, "Compact console"),
   * so its screen, its tab row and its hardware keys fit the pane together.
   */
  readonly density?: 'laptop'
}) {
  const state = session.simulation
  const presentation = step.presentation
  const definition = resolveVentilationSimulationCase(state.caseId)
  const openingRecord = useOpeningRecord(session)
  const inspection = ventilationConsoleInspection({ step, session, openingRecord, lab })
  const operate = presentation.consoleMode === 'operate'
  const canAct = operate && !state.ventilator.locked
  const integration = session.unitId === 'high-peak-pressure-integration'
  const acquisition = plateauAcquisition(state, { requireAcquisition: integration })
  const withholdUnacquiredPlateau = integration && !acquisition.supportsMechanicsClaim
  const mechanicsGoals = round.goals.filter(
    (goal): goal is Extract<LabRound['goals'][number], { type: 'mechanics' }> =>
      goal.type === 'mechanics',
  )
  const interventionGoals = round.goals.filter(
    (goal): goal is Extract<LabRound['goals'][number], { type: 'intervention' }> =>
      goal.type === 'intervention',
  )
  const showPatient = presentation.patient === 'bedside'
  const bedsideActionIds = [
    ...new Set([
      ...interventionGoals.map((goal) => goal.id),
      ...(showPatient
        ? ['assess-patient', 'review-waveforms', 'inspect-circuit'].filter((id) =>
            definition.interventions.some((intervention) => intervention.id === id),
          )
        : []),
    ]),
  ]
  const readingsShown =
    presentation.layout !== 'concept' &&
    presentation.layout !== 'breath-walk' &&
    (round.watch.length > 0 || presentation.kind === 'response-lab')

  return (
    <div
      className={styles.consoleSurface}
      data-console-surface
      data-console-mode={presentation.consoleMode}
      data-session-time={state.simulationTime}
      data-mv-density={density}
    >
      <div className={styles.consoleCell}>
        <VentilationClockBar
          state={state}
          engine={engine}
          frozenLabel={inspection?.label ?? null}
          guidedControlId={guidedControlId}
          cue={cue}
        />
        <div
          className={styles.consoleFrame}
          data-ventilation-console
          data-controls-locked={!canAct}
        >
          <FitWidthSurface mode="fit" label={`${definition.patientDescription} · console`}>
            <MechanicalVentilatorConsole
              key={`${session.device}:${session.round}`}
              state={state}
              dispatch={engine}
              controlsEnabled
              mode={presentation.consoleMode}
              guidedControlId={guidedControlId}
              inspection={inspection}
              onPendingChange={onPendingChange}
              allowTeachingAnnotations={false}
              withholdUnacquiredPlateau={withholdUnacquiredPlateau}
            />
          </FitWidthSurface>
        </div>
        {inspection ? (
          <details className={styles.traceNote} data-trace-provenance>
            <summary>How this trace is drawn</summary>
            <BreathProvenanceNotes samples={inspection.samples} effort={inspection.effort} />
          </details>
        ) : null}
      </div>

      {readingsShown ? (
        <ReadingsStrip
          session={session}
          round={round}
          kind={presentation.kind}
          withholdUnacquiredPlateau={withholdUnacquiredPlateau}
        />
      ) : null}

      {session.confounds?.length && operate ? (
        <p className={styles.boundary} role="status" data-confounds>
          This comparison no longer isolates one change: {session.confounds.join('; ')}. Reset the
          patient for a clean repeat.
        </p>
      ) : null}

      {operate && mechanicsGoals.length > 0 && !integration ? (
        <section className={styles.sideCard} data-patient-properties>
          <h3>Teaching patient</h3>
          <p className={styles.note}>
            The patient’s own lungs, not a ventilator setting. Leave the ventilator alone.
          </p>
          {mechanicsGoals.map((goal) => (
            <label key={goal.key} htmlFor={quickControlId(goal.key)}>
              <span>
                {goal.key === 'complianceScale' ? 'Patient compliance' : 'Patient resistance'}{' '}
                <output>{state.teachingMechanics[goal.key].toFixed(2)}×</output>
              </span>
              <input
                id={quickControlId(goal.key)}
                type="range"
                min={0.25}
                max={4}
                step={0.05}
                value={state.teachingMechanics[goal.key]}
                disabled={!canAct}
                data-guided-help={guidedControlId === quickControlId(goal.key) || undefined}
                onChange={(event) =>
                  engine({
                    type: 'SET_TEACHING_MECHANICS',
                    overrides: { [goal.key]: Number(event.target.value) },
                  })
                }
              />
            </label>
          ))}
        </section>
      ) : null}

      {bedsideActionIds.length > 0 && (operate || showPatient) ? (
        <section className={styles.sideCard} data-bedside-actions>
          <h3>Bedside actions</h3>
          {bedsideActionIds.map((id) => {
            const record = state.interventions.find((item) => item.interventionId === id)
            const pending = record ? Math.max(0, record.effectiveAt - state.simulationTime) : 0
            return (
              <div key={id}>
                <button
                  id={bedsideActionId(id)}
                  className={styles.sideButton}
                  type="button"
                  disabled={!canAct || Boolean(record)}
                  data-guided-help={guidedControlId === bedsideActionId(id) || undefined}
                  onClick={() => engine({ type: 'PERFORM_INTERVENTION', interventionId: id })}
                >
                  {interventionLabels[id] ??
                    definition.interventions.find((item) => item.id === id)?.label ??
                    id}
                </button>
                {record ? (
                  <p className={styles.note} aria-live="off">
                    {pending > 0
                      ? `Selected; its effect starts in ${Math.ceil(pending)} s of model time.`
                      : 'In effect. Reassess the patient.'}
                  </p>
                ) : null}
              </div>
            )
          })}
        </section>
      ) : null}

      {presentation.patient === 'protection' ? (
        <section className={styles.sideCard} data-pbw-context>
          <h3>Patient · PBW {definition.predictedBodyWeightKg} kg</h3>
          {state.measurements.exhaledVtSource === 'trace' ? (
            <p>
              Delivered VT {state.measurements.exhaledVtMl.toFixed(0)} mL /{' '}
              {definition.predictedBodyWeightKg} kg ={' '}
              {(state.measurements.exhaledVtMl / definition.predictedBodyWeightKg).toFixed(1)} mL/kg
              PBW.
            </p>
          ) : (
            <p>Delivered VT: waiting for a completed breath on the trace.</p>
          )}
          <p className={styles.note}>
            Goal in ARDS: {VENTILATION_NUMBERS.value('vt-ards-goal')}, within{' '}
            {VENTILATION_NUMBERS.value('vt-ards-range')}. Read it with a valid plateau{' '}
            {VENTILATION_NUMBERS.value('pplat-limit')} and a driving pressure (plateau minus total
            PEEP) held against the reference of{' '}
            {VENTILATION_NUMBERS.value('driving-pressure-reference')}.
          </p>
        </section>
      ) : null}

      {showPatient ? (
        <BedsidePanel state={state} definition={definition} compact requireAssessment />
      ) : null}

      {presentation.kind === 'response-lab' && presentation.layout === 'console-lab' ? (
        <VentilationResponseTimeline session={session} />
      ) : null}

      <details className={styles.consoleOptions} data-console-options>
        <summary>Console options</summary>
        <div className={styles.tools}>
          <label>
            Console{' '}
            <select
              aria-label="Console"
              value={session.device}
              onChange={(event) => onSelectDevice(event.target.value as VentilatorDeviceId)}
            >
              {ventilatorDeviceProfiles.map((profile) => (
                <option value={profile.id} key={profile.id}>
                  {profile.shortName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-reset-patient
            aria-describedby="mv-reset-explanation"
            onClick={onResetPatient}
          >
            Reset patient
          </button>
        </div>
        <p className={styles.note} data-reset-note id="mv-reset-explanation">
          Reset patient clears this part’s changes, holds and captured result; your prediction
          stays. Changing the console starts the section again on a fresh patient.
        </p>
      </details>
    </div>
  )
}

/**
 * The readings a step watches, under the console, each with its baseline once one is taken. The
 * data hooks are the ones the workbench's Readings card carried, so the evidence tests read the
 * same values.
 */
function ReadingsStrip({
  session,
  round,
  kind,
  withholdUnacquiredPlateau,
}: {
  readonly session: LabSession
  readonly round: LabRound
  readonly kind: VentilationStageStep['presentation']['kind']
  readonly withholdUnacquiredPlateau: boolean
}) {
  const state = session.simulation
  const before = session.evidence[session.round].baseline
  const snapshot = labSnapshot(state, session.holds, session.conditionRevision)
  const integration = session.unitId === 'high-peak-pressure-integration'
  const acquisition = plateauAcquisition(state, { requireAcquisition: integration })
  const report = patientReportAvailability(state)
  const volumeStepNote = deliveredVolumeStepNote(state)
  const inspiratoryTimeNote = inspiratoryTimeStepNote(state)
  const metrics: readonly LabMetric[] =
    kind === 'response-lab'
      ? [
          ...new Set<LabMetric>([
            ...round.watch,
            ...(session.unitId === 'ventilation-and-co2'
              ? (['volume', 'rate', 'minute', 'expiratoryFlow', 'co2'] as const)
              : (['spo2', 'map', 'peak'] as const)),
          ]),
        ]
      : round.watch
  const ventilatorMetrics = metrics.filter(
    (metric) => !(PATIENT_REPORT_METRICS as readonly string[]).includes(metric),
  )
  const reportMetrics = metrics.filter((metric) =>
    (PATIENT_REPORT_METRICS as readonly string[]).includes(metric),
  )
  const measurementTypes = round.goals.some((goal) => goal.type === 'hold')
    ? round.goals.flatMap((goal) => (goal.type === 'hold' ? [goal.hold] : []))
    : round.watch.includes('intrinsicPeep')
      ? (['expiratory'] as const)
      : round.watch.includes('plateau')
        ? (['inspiratory'] as const)
        : []
  return (
    <section className={styles.readingsStrip} data-live-readings aria-label="Readings">
      <dl className={styles.readings} data-reading-group="ventilator">
        {ventilatorMetrics.map((metric) => (
          <div key={metric} data-metric={metric}>
            <dt>
              {labMetricLabels[metric].label}
              {metric === 'plateau'
                ? ` · ${acquisition.label}`
                : metric === 'intrinsicPeep'
                  ? ' · model estimate'
                  : metric === 'ti' && inspiratoryTimeNote
                    ? ' · calculated'
                    : ''}
            </dt>
            <dd>
              {metric === 'plateau' && withholdUnacquiredPlateau
                ? 'Acquire a current inspiratory hold'
                : metric === 'plateau'
                  ? `${(acquisition.valueCmH2O ?? acquisition.estimateCmH2O).toFixed(labMetricLabels.plateau.digits)} ${labMetricLabels.plateau.unit}`
                  : `${snapshot.values[metric].toFixed(labMetricLabels[metric].digits)} ${labMetricLabels[metric].unit}`}
              {before &&
              !(integration && metric === 'plateau' && before.plateauSource !== 'captured') ? (
                <small>
                  Baseline {before.values[metric].toFixed(labMetricLabels[metric].digits)}{' '}
                  {labMetricLabels[metric].unit}
                </small>
              ) : null}
              {metric === 'volume' && volumeStepNote ? (
                <small data-volume-step-note>{volumeStepNote}</small>
              ) : null}
              {metric === 'ti' && inspiratoryTimeNote ? (
                <small data-inspiratory-time-step-note>{inspiratoryTimeNote}</small>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {reportMetrics.length > 0 ? (
        <section data-reading-group="patient-report" data-report={report.availability}>
          <h4>{report.heading}</h4>
          <p className={styles.note}>{report.note}</p>
          <dl className={styles.readings}>
            {reportMetrics.map((metric) => (
              <div key={metric} data-metric={metric}>
                <dt>{labMetricLabels[metric].label}</dt>
                <dd>
                  {snapshot.values[metric].toFixed(labMetricLabels[metric].digits)}{' '}
                  {labMetricLabels[metric].unit}
                  <small>{report.suffix}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {round.watch.includes('plateau') ? (
        <p className={styles.note} data-plateau-acquisition={acquisition.status}>
          {acquisition.detail}
        </p>
      ) : null}
      {measurementTypes.length > 0 ? (
        <div data-hold-provenance>
          {measurementTypes.map((hold) => (
            <p key={hold} role="status" className={styles.note}>
              {holdStatus(state, session.holds ?? [], session.conditionRevision ?? 0, hold)}
            </p>
          ))}
          {session.holds?.at(-1) ? (
            <details>
              <summary>Inspect the acquired hold</summary>
              <p>
                {session.holds.at(-1)!.value.toFixed(1)} cmH₂O ·{' '}
                {session.holds.at(-1)!.hold === 'expiratory'
                  ? 'Acquired total PEEP'
                  : 'Acquired plateau'}{' '}
                ·{' '}
                {session.holds.at(-1)!.interpretable
                  ? 'Interpretable at acquisition'
                  : 'Unsuitable for passive mechanics'}
              </p>
              <CapturedBreath
                label="Acquired hold · check current or historical status above"
                samples={session.holds.at(-1)!.waveforms}
                whole={false}
              />
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
