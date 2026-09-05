'use client'

import type { Dispatch } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'

import type { BreathStopId } from '../../content/breathSpine'
import { resolveVentilationSimulationCase } from '../../content/learningPatient'
import type { LabGoal, LabMetric } from '../../content/learningExperiments'
import { ventilatorDeviceProfiles } from '../../content/deviceProfiles'
import {
  labControlValue,
  labMetricLabels,
  labSnapshot,
  type LabSession,
} from '../../engine/learningLab'
import type {
  VentilationAction,
  VentilatorControlKey,
  VentilatorDeviceId,
} from '../../engine/types'
import { BedsidePanel } from '../BedsidePanel'
import { BreathMap, type BreathMapAnswer } from '../breath-map/BreathMap'
import { MechanicalVentilatorConsole } from '../MechanicalVentilatorConsole'
import styles from './ventilation-stage.module.css'

/**
 * Narrow teaching ranges for the quick controls. The console keeps its own ranges; these exist so a
 * step's one change is a slider under the console rather than a hunt through the device's menus.
 */
export const quickControlRanges: Partial<
  Record<
    VentilatorControlKey,
    { label: string; unit: string; min: number; max: number; step: number }
  >
> = {
  vtMl: { label: 'Tidal volume', unit: 'mL', min: 200, max: 700, step: 10 },
  peakFlowLMin: { label: 'Inspiratory flow', unit: 'L/min', min: 20, max: 90, step: 1 },
  oxygenPercent: { label: 'Oxygen', unit: '%', min: 21, max: 100, step: 1 },
  peepCmH2O: { label: 'PEEP', unit: 'cmH₂O', min: 0, max: 20, step: 1 },
  ratePerMin: { label: 'Rate', unit: '/min', min: 8, max: 35, step: 1 },
  triggerThreshold: { label: 'Flow trigger', unit: 'L/min', min: 0.5, max: 8, step: 0.5 },
  etsPercent: { label: 'Cycle-off (ETS)', unit: '%', min: 5, max: 80, step: 1 },
  pRampMs: { label: 'Rise time', unit: 'ms', min: 0, max: 1000, step: 10 },
}

export const interventionLabels: Readonly<Record<string, string>> = {
  'assess-patient': 'Assess the patient',
  'inspect-circuit': 'Inspect the circuit',
  'drain-condensate': 'Clear the condensate',
  'communication-board': 'Establish communication',
  'treat-pain': 'Treat the pain (modeled)',
}

export function quickControlId(key: string): string {
  return `mv-quick-${key}`
}

export function goalLabel(goal: LabGoal): string {
  if (goal.type === 'control') {
    const range = quickControlRanges[goal.key]
    return `${range?.label ?? goal.key} at ${goal.value}${range?.unit ? ` ${range.unit}` : ''}`
  }
  if (goal.type === 'mechanics') {
    return `${goal.key === 'complianceScale' ? 'Compliance' : 'Resistance'} at ${goal.value}× baseline`
  }
  if (goal.type === 'hold') return `An ${goal.hold} hold, performed`
  if (goal.type === 'intervention') return interventionLabels[goal.id] ?? goal.id
  return 'Paused during outward flow after a full breath'
}

export function formatMetric(session: LabSession, metric: LabMetric): string {
  const snapshot = labSnapshot(session.simulation)
  const value = snapshot.values[metric].toFixed(labMetricLabels[metric].digits)
  return metric === 'plateau' && !snapshot.plateauValid ? `${value} *` : value
}

export function VentilationSimulatorPane({
  session,
  engine,
  controlsEnabled,
  lockedReason,
  onResetPatient,
  onSelectDevice,
  deviceLocked,
  watch,
  goals,
  mechanicsVisible,
  spotlightKey,
  stops,
  mapCaption,
  mapAnswer,
  bedsideAvailable = true,
}: {
  readonly session: LabSession
  readonly engine: Dispatch<VentilationAction>
  readonly controlsEnabled: boolean
  readonly lockedReason?: string
  readonly onResetPatient: () => void
  readonly onSelectDevice: (device: VentilatorDeviceId) => void
  /** Once a prediction is committed the console cannot change without restarting the section. */
  readonly deviceLocked: boolean
  /** The readings the current step asks the learner to watch. */
  readonly watch: readonly LabMetric[]
  /** The current step's goals, for the quick controls; empty renders none. */
  readonly goals: readonly LabGoal[]
  readonly mechanicsVisible: boolean
  /** A quick control to draw attention to, after "Show me where". */
  readonly spotlightKey: string | null
  readonly stops: readonly BreathStopId[]
  readonly mapCaption?: string
  readonly mapAnswer?: BreathMapAnswer
  /**
   * Whether the bedside findings may be opened. False while a section is asking where on the
   * breath the problem lives: the findings name the finding, and the question is the finding.
   */
  readonly bedsideAvailable?: boolean
}) {
  const state = session.simulation
  const controlGoals = goals.filter(
    (goal): goal is Extract<LabGoal, { type: 'control' }> => goal.type === 'control',
  )
  const mechanicsGoals = goals.filter(
    (goal): goal is Extract<LabGoal, { type: 'mechanics' }> => goal.type === 'mechanics',
  )
  const holdGoals = goals.filter(
    (goal): goal is Extract<LabGoal, { type: 'hold' }> => goal.type === 'hold',
  )
  const interventionGoals = goals.filter(
    (goal): goal is Extract<LabGoal, { type: 'intervention' }> => goal.type === 'intervention',
  )
  const showMechanics = mechanicsVisible && (mechanicsGoals.length > 0 || goals.length === 0)
  const hasQuick =
    controlGoals.length > 0 || showMechanics || holdGoals.length > 0 || interventionGoals.length > 0
  const round = session.round
  const caseId = state.caseId
  const definition = resolveVentilationSimulationCase(caseId)

  return (
    <>
      <div className={styles.toolbar} data-ventilation-transport>
        <div className={styles.transport}>
          <span className={styles.live} data-paused={state.paused}>
            <span className={styles.dot} aria-hidden="true" />
            {state.paused ? 'Paused' : 'Live patient'}
          </span>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => engine({ type: 'SET_PAUSED', paused: !state.paused })}
            aria-pressed={!state.paused}
          >
            {state.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {state.paused ? 'Run' : 'Pause'}
          </button>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => engine({ type: 'STEP_BREATH' })}
          >
            <SkipForward aria-hidden="true" />
            Advance one breath
          </button>
          <select
            className={styles.select}
            aria-label="Simulation speed"
            value={state.speed}
            onChange={(event) =>
              engine({ type: 'SET_SPEED', speed: Number(event.target.value) as 1 | 5 })
            }
          >
            <option value={1}>1× time</option>
            <option value={5}>5× time</option>
          </select>
          <span className={styles.clock} aria-live="off">
            {Math.floor(state.simulationTime / 60)}:
            {String(Math.floor(state.simulationTime % 60)).padStart(2, '0')} simulated
          </span>
        </div>
        <div className={styles.transport}>
          <select
            className={styles.select}
            aria-label="Console"
            value={session.device}
            disabled={deviceLocked}
            title={
              deviceLocked
                ? 'The console can change only before the first prediction; restart the section to switch.'
                : undefined
            }
            onChange={(event) => onSelectDevice(event.target.value as VentilatorDeviceId)}
          >
            {ventilatorDeviceProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.shortName}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.toolButton}
            onClick={onResetPatient}
            data-reset-patient
          >
            <RotateCcw aria-hidden="true" />
            Reset patient
          </button>
        </div>
      </div>

      {!controlsEnabled && lockedReason ? (
        <p className={styles.lockedNote} role="status">
          {lockedReason}
        </p>
      ) : null}

      <div
        className={styles.consoleFrame}
        data-mv-density="laptop"
        data-live-learning="true"
        data-controls-locked={!controlsEnabled}
        data-ventilation-console
      >
        <MechanicalVentilatorConsole
          key={`${session.device}:${round}`}
          state={state}
          dispatch={engine}
          controlsEnabled={controlsEnabled}
        />
      </div>

      {watch.length > 0 ? (
        <dl className={styles.readings} aria-label="Readings to watch" data-live-readings>
          {watch.map((metric) => (
            <div key={metric} className={styles.reading} data-metric={metric}>
              <dt>{labMetricLabels[metric].label}</dt>
              <dd>
                {formatMetric(session, metric)}
                <small>{labMetricLabels[metric].unit}</small>
              </dd>
            </div>
          ))}
          {watch.includes('plateau') && !labSnapshot(state).plateauValid ? (
            <p className={styles.quickNote} style={{ gridColumn: '1 / -1' }}>
              * Recent effort keeps this plateau from standing for passive mechanics.
            </p>
          ) : null}
        </dl>
      ) : null}

      {hasQuick ? (
        <section
          className={styles.quick}
          aria-label="Quick controls for this step"
          data-quick-controls
        >
          <div className={styles.quickHeading}>
            <h3>Quick controls for this step</h3>
            <span>
              {controlsEnabled
                ? 'The same settings as on the console.'
                : 'Commit your prediction first.'}
            </span>
          </div>
          {controlGoals.length > 0 ? (
            <div className={styles.sliders}>
              {controlGoals.map((goal) => {
                const range = quickControlRanges[goal.key]
                if (!range) return null
                const value = labControlValue(state, goal.key)
                const id = quickControlId(goal.key)
                return (
                  <div
                    key={goal.key}
                    className={`${styles.slider} ${spotlightKey === goal.key ? styles.spotlight : ''}`}
                  >
                    <label htmlFor={id}>
                      {range.label}
                      <output>
                        {value} {range.unit}
                      </output>
                    </label>
                    <input
                      id={id}
                      className={styles.rangeInput}
                      type="range"
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={value}
                      disabled={!controlsEnabled}
                      onChange={(event) =>
                        engine({
                          type: 'SET_CONTROL',
                          control: goal.key,
                          value: Number(event.target.value),
                        })
                      }
                    />
                    <small>
                      <span>
                        {range.min} {range.unit}
                      </span>
                      <span>
                        {range.max} {range.unit}
                      </span>
                    </small>
                  </div>
                )
              })}
            </div>
          ) : null}
          {showMechanics ? (
            <div className={styles.sliders}>
              {(['complianceScale', 'resistanceScale'] as const).map((key) => {
                const id = quickControlId(key)
                return (
                  <div
                    key={key}
                    className={`${styles.slider} ${spotlightKey === key ? styles.spotlight : ''}`}
                  >
                    <label htmlFor={id}>
                      {key === 'complianceScale' ? 'Patient compliance' : 'Patient resistance'}
                      <output>{state.teachingMechanics[key].toFixed(2)}×</output>
                    </label>
                    <input
                      id={id}
                      className={styles.rangeInput}
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={state.teachingMechanics[key]}
                      disabled={!controlsEnabled}
                      onChange={(event) =>
                        engine({
                          type: 'SET_TEACHING_MECHANICS',
                          overrides: { [key]: Number(event.target.value) },
                        })
                      }
                    />
                    <small>
                      <span>{key === 'complianceScale' ? 'Stiffer' : 'Less resistance'}</span>
                      <span>
                        {key === 'complianceScale' ? 'More compliant' : 'More resistance'}
                      </span>
                    </small>
                  </div>
                )
              })}
            </div>
          ) : null}
          {holdGoals.length > 0 || interventionGoals.length > 0 ? (
            <div className={styles.quickButtons}>
              {holdGoals.map((goal) => (
                <button
                  key={goal.hold}
                  id={quickControlId(`hold-${goal.hold}`)}
                  type="button"
                  className={`${styles.toolButton} ${spotlightKey === `hold-${goal.hold}` ? styles.spotlight : ''}`}
                  disabled={
                    !controlsEnabled ||
                    state.ventilator.pendingHold !== null ||
                    state.ventilator.holdType !== null
                  }
                  onClick={() => engine({ type: 'PERFORM_HOLD', hold: goal.hold })}
                >
                  {state.ventilator.pendingHold === goal.hold
                    ? 'Hold armed for the next breath boundary…'
                    : state.ventilator.holdType === goal.hold
                      ? 'Holding…'
                      : `Perform ${goal.hold} hold`}
                </button>
              ))}
              {interventionGoals.map((goal) => {
                const record = state.interventions.find((item) => item.interventionId === goal.id)
                const pending = record ? Math.max(0, record.effectiveAt - state.simulationTime) : 0
                return (
                  <button
                    key={goal.id}
                    id={quickControlId(goal.id)}
                    type="button"
                    className={`${styles.toolButton} ${spotlightKey === goal.id ? styles.spotlight : ''}`}
                    disabled={!controlsEnabled || record !== undefined}
                    onClick={() =>
                      engine({ type: 'PERFORM_INTERVENTION', interventionId: goal.id })
                    }
                  >
                    {record
                      ? pending > 0
                        ? `${interventionLabels[goal.id] ?? goal.id} — takes effect in ${Math.ceil(pending)} s`
                        : `${interventionLabels[goal.id] ?? goal.id} — in effect`
                      : (interventionLabels[goal.id] ?? goal.id)}
                  </button>
                )
              })}
            </div>
          ) : null}
          {showMechanics ? (
            <p className={styles.quickNote}>
              The patient sliders scale this patient’s baseline mechanics. They are not ventilator
              settings.
            </p>
          ) : null}
        </section>
      ) : null}

      <BreathMap emphasis={stops} caption={mapCaption} answer={mapAnswer} />

      {bedsideAvailable ? (
        <details className={styles.bedside} data-bedside-findings>
          <summary>
            Patient and circuit findings ·{' '}
            {caseId === 'MV-LAB' ? 'passive teaching patient' : 'this patient'}
          </summary>
          <BedsidePanel state={state} definition={definition} compact />
        </details>
      ) : (
        <p className={styles.quickNote} data-bedside-withheld>
          The patient and circuit findings open once you have said where on the breath the problem
          lives.
        </p>
      )}
    </>
  )
}
