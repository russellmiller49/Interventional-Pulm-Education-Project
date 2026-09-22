'use client'

import { useState, type Dispatch } from 'react'
import { ventilatorDeviceProfiles, getVentilatorDeviceProfile } from '../../content/deviceProfiles'
import { resolveVentilationSimulationCase } from '../../content/learningPatient'
import type { LabGoal, LabMetric } from '../../content/learningExperiments'
import type { VentilationTaskPresentation } from '../../content/taskPresentation'
import { labMetricLabels, labSnapshot, type LabSession } from '../../engine/learningLab'
import { holdStatus } from '../../engine/learningMeasurements'
import { plateauAcquisition } from '../../content/plateauAcquisition'
import { PATIENT_REPORT_METRICS, patientReportAvailability } from '../../content/patientReport'
import type { VentilationAction, VentilatorDeviceId, WaveformSample } from '../../engine/types'
import { BedsidePanel } from '../BedsidePanel'
import { MechanicalVentilatorConsole } from '../MechanicalVentilatorConsole'
import { CapturedBreath } from './CapturedBreath'
import { interventionLabels, quickControlId } from './VentilationSimulatorPane'
import { VentilationResponseTimeline } from './VentilationResponseTimeline'
import styles from './task-flow.module.css'
import controls from './ventilation-stage.module.css'

/** All operations go to the host's single session. Local capture/native-view state is visual only. */
export function VentilationTaskWorkbench({
  session,
  presentation,
  engine,
  goals,
  watch,
  controlsEnabled,
  deviceLocked,
  onSelectDevice,
  onResetPatient,
  lockedReason,
  readOnly = false,
  transportOnly = false,
}: {
  session: LabSession
  presentation: VentilationTaskPresentation
  engine: Dispatch<VentilationAction>
  goals: readonly LabGoal[]
  watch: readonly LabMetric[]
  controlsEnabled: boolean
  deviceLocked: boolean
  onSelectDevice: (device: VentilatorDeviceId) => void
  onResetPatient: () => void
  lockedReason?: string
  readOnly?: boolean
  transportOnly?: boolean
}) {
  const state = session.simulation
  const profile = getVentilatorDeviceProfile(session.device)
  const definition = resolveVentilationSimulationCase(state.caseId)
  const [nativeView, setNativeView] = useState(false)
  const [capture, setCapture] = useState<readonly WaveformSample[] | null>(null)
  const controlGoals = goals.filter((g) => g.type === 'control')
  const mechanicsGoals = goals.filter((g) => g.type === 'mechanics')
  const holdGoals = goals.filter((g) => g.type === 'hold')
  const interventionGoals = goals.filter((g) => g.type === 'intervention')
  const before = session.evidence[session.round].baseline
  const snapshot = labSnapshot(state, session.holds, session.conditionRevision)
  const integration = session.unitId === 'high-peak-pressure-integration'
  /*
   * One acquisition projection for every surface on this card: the Readings plateau, the console
   * facsimile inside it, and the measurement-status line below. It used to be
   * `snapshot.plateauSource !== 'captured'` on this one section, so the other thirteen described
   * an estimate off the trace as "Plateau · modeled" while the console beside them said
   * "measured Pplateau".
   */
  const acquisition = plateauAcquisition(state, { requireAcquisition: integration })
  const withholdUnacquiredPlateau = integration && !acquisition.supportsMechanicsClaim
  const report = patientReportAvailability(state)
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
  const metrics: readonly LabMetric[] =
    presentation.kind === 'response-lab'
      ? [
          ...new Set<LabMetric>([
            ...watch,
            ...(session.unitId === 'ventilation-and-co2'
              ? (['volume', 'rate', 'minute', 'expiratoryFlow', 'co2'] as const)
              : (['spo2', 'map', 'peak'] as const)),
          ]),
        ]
      : watch.length
        ? watch
        : ['peak', 'volume', 'rate']
  /*
   * "Dyspnea 7.0 /10" and "Anxiety 8.0 /10" used to sit in the same list as inspiratory time and
   * exhaled volume, which reads as two more things the ventilator measured. They are a modeled
   * patient report, and on a patient who cannot answer they are not even that — see
   * `content/patientReport.ts`.
   */
  const ventilatorMetrics = metrics.filter(
    (metric) => !(PATIENT_REPORT_METRICS as readonly string[]).includes(metric),
  )
  const reportMetrics = metrics.filter((metric) =>
    (PATIENT_REPORT_METRICS as readonly string[]).includes(metric),
  )
  const reference = presentation.surface === 'reference'
  const comparison = presentation.surface === 'comparison'
  const canAct = controlsEnabled && !readOnly && !state.ventilator.locked
  const measurementTypes = holdGoals.length
    ? holdGoals.map((g) => g.hold)
    : watch.includes('intrinsicPeep')
      ? ['expiratory' as const]
      : watch.includes('plateau')
        ? ['inspiratory' as const]
        : []

  return (
    <div className={styles.workbench} data-task-workbench data-session-time={state.simulationTime}>
      <div className={styles.tools} data-ventilation-transport>
        <strong>Playback / inspection</strong>
        <button
          className={controls.toolButton}
          type="button"
          disabled={readOnly}
          aria-pressed={!state.paused}
          data-paused={state.paused}
          onClick={() => engine({ type: 'SET_PAUSED', paused: !state.paused })}
        >
          {state.paused ? 'Run' : 'Pause'}
        </button>
        <button
          className={controls.toolButton}
          type="button"
          disabled={readOnly}
          onClick={() => engine({ type: 'STEP_BREATH' })}
        >
          Advance one breath
        </button>
        <select
          className={controls.select}
          aria-label="Simulation speed"
          value={state.speed}
          disabled={readOnly}
          onChange={(e) => engine({ type: 'SET_SPEED', speed: Number(e.target.value) as 1 | 5 })}
        >
          <option value={1}>1× time</option>
          <option value={5}>5× time</option>
        </select>
        <span className={styles.note} aria-live="off">
          {state.simulationTime.toFixed(1)} s simulated · {state.paused ? 'Paused' : 'Live patient'}
        </span>
      </div>
      {transportOnly ? (
        <p className={styles.note}>
          Run and Step advance the live patient. Reading a captured reference does not change its
          settings or perform a hold.
        </p>
      ) : (
        <>
          {lockedReason ? (
            <p className={styles.boundary} data-controls-locked-note>
              {lockedReason}
            </p>
          ) : null}
          {presentation.patient === 'protection' ? (
            <section className={styles.block} data-pbw-context>
              <h3>Patient context · authored PBW {definition.predictedBodyWeightKg} kg</h3>
              <p>
                Delivered VT {state.measurements.exhaledVtMl.toFixed(0)} mL /{' '}
                {definition.predictedBodyWeightKg} kg ={' '}
                {(state.measurements.exhaledVtMl / definition.predictedBodyWeightKg).toFixed(1)}{' '}
                mL/kg PBW.
              </p>
              <p className={styles.note}>
                The case supplies PBW; a height input is not supplied. Verify height and the
                applicable PBW reference at the bedside. Assess effort, gas exchange, and an
                acquired interpretable pressure together.
              </p>
            </section>
          ) : null}
          {showPatient ? (
            <BedsidePanel state={state} definition={definition} compact requireAssessment />
          ) : null}
          <div className={styles.experiment} data-native-view={nativeView || undefined}>
            <div className={styles.signals}>
              {!nativeView &&
              !reference &&
              !comparison &&
              presentation.kind !== 'concept-control' ? (
                <>
                  <div className={styles.tools}>
                    <button
                      type="button"
                      className={controls.toolButton}
                      onClick={() => setCapture(state.waveforms)}
                    >
                      Capture current breath
                    </button>
                    {capture ? (
                      <button
                        type="button"
                        className={controls.toolButton}
                        onClick={() => setCapture(null)}
                      >
                        Follow live breaths
                      </button>
                    ) : null}
                  </div>
                  <CapturedBreath
                    label={
                      capture
                        ? 'Your captured breath · inspection only'
                        : 'Live patient · most recent complete breath'
                    }
                    samples={capture ?? state.waveforms}
                    effort={presentation.effort}
                  />
                </>
              ) : null}
              <section className={styles.block} data-live-readings>
                <h3>Readings to watch</h3>
                <p className={styles.note} data-controlled-inputs>
                  Selected {profile.controlLabels.peepCmH2O ?? 'PEEP'}{' '}
                  {state.ventilator.settings.peepCmH2O} cmH₂O ·{' '}
                  {profile.controlLabels.oxygenPercent ?? 'Oxygen'}{' '}
                  {state.ventilator.settings.oxygenPercent}%
                  {state.ventilator.settings.mode === 'volume-ac'
                    ? ` · ${profile.controlLabels.vtMl ?? 'VT'} ${state.ventilator.settings.vtMl} mL · ${profile.controlLabels.peakFlowLMin ?? 'Flow'} ${state.ventilator.settings.peakFlowLMin} L/min`
                    : state.ventilator.settings.mode === 'pressure-ac'
                      ? ` · Pressure above PEEP ${state.ventilator.settings.deltaPControlCmH2O} cmH₂O · Inspiratory time ${state.ventilator.settings.inspiratoryTimeSeconds} s`
                      : ` · Pressure support above PEEP ${state.ventilator.settings.pressureSupportCmH2O} cmH₂O`}
                </p>
                <dl className={styles.readings} data-reading-group="ventilator">
                  {ventilatorMetrics.map((metric) => (
                    <div key={metric} data-metric={metric}>
                      <dt>
                        {labMetricLabels[metric].label}
                        {metric === 'plateau'
                          ? ` · ${acquisition.label}`
                          : metric === 'intrinsicPeep'
                            ? ' · model estimate'
                            : ''}
                      </dt>
                      <dd>
                        {/*
                         * The plateau row prints the projection's own value, so the number and
                         * the "· acquired hold" / "· estimate from the trace" label beside it
                         * always describe the same thing. `labSnapshot` keeps its own
                         * lab-side hold list for the evidence table; letting the two reach this
                         * row independently is how a label and a value came apart here.
                         */}
                        {metric === 'plateau' && withholdUnacquiredPlateau
                          ? 'Acquire a current inspiratory hold'
                          : metric === 'plateau'
                            ? `${(acquisition.valueCmH2O ?? acquisition.estimateCmH2O).toFixed(labMetricLabels.plateau.digits)} ${labMetricLabels.plateau.unit}`
                            : `${snapshot.values[metric].toFixed(labMetricLabels[metric].digits)} ${labMetricLabels[metric].unit}`}
                        {before &&
                        !(
                          integration &&
                          metric === 'plateau' &&
                          before.plateauSource !== 'captured'
                        ) ? (
                          <small>
                            Baseline {before.values[metric].toFixed(labMetricLabels[metric].digits)}{' '}
                            {labMetricLabels[metric].unit}
                          </small>
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
                {watch.includes('plateau') ? (
                  <p className={styles.note} data-plateau-acquisition={acquisition.status}>
                    {acquisition.detail}
                  </p>
                ) : null}
              </section>
              {presentation.kind === 'response-lab' ? (
                <VentilationResponseTimeline session={session} />
              ) : null}
            </div>
            <div className={styles.controls}>
              {/* Stable component position preserves the native pending edit when its view changes. */}
              <div
                className={nativeView ? styles.native : undefined}
                data-ventilation-console
                data-controls-locked={!canAct}
              >
                <div>
                  <MechanicalVentilatorConsole
                    state={state}
                    dispatch={engine}
                    controlsEnabled={canAct}
                    teachingControls={controlGoals.map((g) => g.key)}
                    nativeView={nativeView}
                    allowTeachingAnnotations={false}
                    withholdUnacquiredPlateau={withholdUnacquiredPlateau}
                  />
                </div>
              </div>
              {nativeView ? (
                <p className={styles.nativeGate}>
                  The full native console needs more width. Return to the task controls to continue
                  here.
                </p>
              ) : null}
              {mechanicsGoals.length && session.unitId !== 'high-peak-pressure-integration' ? (
                <section className={styles.controlEditor} data-patient-properties>
                  <h3>Teaching patient properties</h3>
                  <p className={styles.note}>
                    Experimental conditions; these are not bedside treatment controls. Keep
                    ventilator settings fixed.
                  </p>
                  {mechanicsGoals.map((goal) => (
                    <label key={goal.key} htmlFor={quickControlId(goal.key)}>
                      <span>
                        {goal.key === 'complianceScale'
                          ? 'Patient compliance'
                          : 'Patient resistance'}{' '}
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
                        onChange={(e) =>
                          engine({
                            type: 'SET_TEACHING_MECHANICS',
                            overrides: { [goal.key]: Number(e.target.value) },
                          })
                        }
                      />
                    </label>
                  ))}
                </section>
              ) : null}
              {measurementTypes.length ? (
                <section className={styles.block} data-hold-provenance>
                  <h3>Measurement status</h3>
                  <p className={styles.note}>
                    Measurement maneuvers occlude flow at a breath boundary. Playback controls do
                    not acquire a pressure.
                  </p>
                  {measurementTypes.map((hold) => (
                    <div key={hold}>
                      {!nativeView ? (
                        <button
                          id={quickControlId(`hold-${hold}`)}
                          className={controls.toolButton}
                          type="button"
                          disabled={
                            !canAct ||
                            state.ventilator.pendingHold !== null ||
                            state.ventilator.holdType !== null
                          }
                          onClick={() => engine({ type: 'PERFORM_HOLD', hold })}
                        >
                          Perform {hold} hold
                        </button>
                      ) : null}
                      <p role="status">
                        {holdStatus(
                          state,
                          session.holds ?? [],
                          session.conditionRevision ?? 0,
                          hold,
                        )}
                      </p>
                    </div>
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
                        effort={presentation.effort}
                      />
                    </details>
                  ) : null}
                </section>
              ) : null}
              {bedsideActionIds.length ? (
                <section className={styles.block}>
                  <h3>Bedside actions</h3>
                  {bedsideActionIds.map((id) => {
                    const record = state.interventions.find((item) => item.interventionId === id)
                    const pending = record
                      ? Math.max(0, record.effectiveAt - state.simulationTime)
                      : 0
                    return (
                      <div key={id}>
                        <button
                          id={quickControlId(id)}
                          className={controls.toolButton}
                          type="button"
                          disabled={!canAct || Boolean(record)}
                          onClick={() =>
                            engine({ type: 'PERFORM_INTERVENTION', interventionId: id })
                          }
                        >
                          {interventionLabels[id] ??
                            definition.interventions.find((item) => item.id === id)?.label ??
                            id}
                        </button>
                        {record ? (
                          <p aria-live="off">
                            {pending > 0
                              ? `Selected; effect pending for ${Math.ceil(pending)} simulated seconds`
                              : 'Action has taken effect; reassess the patient'}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </section>
              ) : null}
            </div>
          </div>
          {session.confounds?.length ? (
            <p className={styles.boundary} role="status">
              Comparison no longer isolates one input: {session.confounds.join('; ')}. Reset patient
              for a clean repeat.
            </p>
          ) : null}
          <details>
            <summary>Console and experiment options</summary>
            <div className={styles.tools}>
              <label>
                Selected console{' '}
                <select
                  className={controls.select}
                  aria-label="Console"
                  value={session.device}
                  disabled={deviceLocked}
                  onChange={(e) => onSelectDevice(e.target.value as VentilatorDeviceId)}
                >
                  {ventilatorDeviceProfiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.shortName}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={controls.toolButton}
                type="button"
                onClick={() => setNativeView((value) => !value)}
              >
                {nativeView ? 'Return to task controls' : `View full ${profile.shortName} console`}
              </button>
              <button
                className={controls.toolButton}
                type="button"
                data-reset-patient
                aria-describedby="mv-reset-explanation"
                disabled={!controlsEnabled || readOnly}
                onClick={() => {
                  setCapture(null)
                  onResetPatient()
                }}
              >
                Reset patient
              </button>
            </div>
            <p className={styles.note}>
              Opening the native console keeps the same patient, device, and pending setting. After
              the first prediction, restart the section to change devices.
            </p>
            <p className={styles.note} data-reset-note id="mv-reset-explanation">
              Reset patient clears this round’s changes, measurements and observation; your first
              prediction stays. Earlier runs remain in history.
            </p>
          </details>
        </>
      )}
    </div>
  )
}
