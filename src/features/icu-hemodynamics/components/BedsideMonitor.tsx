'use client'

import type { Dispatch } from 'react'

import type { HemodynamicAction, HemodynamicSimulationState } from '../engine'
import { thermodilutionAcceptedAverage } from '../engine'
import { CARDIAC_PHASE } from '../engine/waveformMorphology'
import { WaveformStrip, type WaveformLandmark } from './WaveformStrip'
import styles from './icu-hemodynamics.module.css'

interface BedsideMonitorProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
  onOpenCardiacOutput: () => void
}

const pressureScales = [40, 80, 160, 240] as const
const sweeps = [4, 6, 8, 12] as const

/** Wave components labeled on a frozen right atrial trace. */
const ATRIAL_LANDMARKS: readonly WaveformLandmark[] = [
  { id: 'a', label: 'a', phase: CARDIAC_PHASE.atrialAWave, placement: 'above' },
  { id: 'c', label: 'c', phase: CARDIAC_PHASE.atrialCWave, placement: 'above' },
  { id: 'x', label: 'x', phase: CARDIAC_PHASE.atrialXDescent, placement: 'below' },
  { id: 'v', label: 'v', phase: CARDIAC_PHASE.atrialVWave, placement: 'above' },
  { id: 'y', label: 'y', phase: CARDIAC_PHASE.atrialYDescent, placement: 'below' },
]

/** The wedge carries the same wave family, delayed, and without a c wave. */
const WEDGE_LANDMARKS: readonly WaveformLandmark[] = [
  { id: 'a', label: 'a', phase: CARDIAC_PHASE.wedgeAWave, placement: 'above' },
  { id: 'x', label: 'x', phase: CARDIAC_PHASE.wedgeXDescent, placement: 'below' },
  { id: 'v', label: 'v', phase: CARDIAC_PHASE.wedgeVWave, placement: 'above' },
  { id: 'y', label: 'y', phase: CARDIAC_PHASE.wedgeYDescent, placement: 'below' },
]

const PA_LANDMARKS: readonly WaveformLandmark[] = [
  { id: 'peak', label: 'PASP', phase: CARDIAC_PHASE.pulmonaryArteryPeak, placement: 'above' },
  {
    id: 'notch',
    label: 'notch',
    phase: CARDIAC_PHASE.pulmonicDicroticNotch + 0.015,
    placement: 'above',
  },
]

const RV_LANDMARKS: readonly WaveformLandmark[] = [
  { id: 'peak', label: 'RVSP', phase: 0.16, placement: 'above' },
  { id: 'fill', label: 'filling', phase: 0.78, placement: 'below' },
]

const ARTERIAL_LANDMARKS: readonly WaveformLandmark[] = [
  {
    id: 'notch',
    label: 'dicrotic notch',
    phase: CARDIAC_PHASE.aorticDicroticNotch + 0.014,
    placement: 'below',
  },
]

function value(value: number | null, digits = 0): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function lowPressureScaleMaximum(targetMmHg: number): 20 | 40 | 80 | 160 {
  if (targetMmHg <= 18) return 20
  if (targetMmHg <= 36) return 40
  if (targetMmHg <= 72) return 80
  return 160
}

export function BedsideMonitor({ state, dispatch, onOpenCardiacOutput }: BedsideMonitorProps) {
  const measurements = state.measurements
  const activeAlarms = state.alarms.filter((alarm) => alarm.active)
  const cvpScaleMaximum = lowPressureScaleMaximum(measurements.rapMmHg + 10)
  const wedgeScaleMaximum = lowPressureScaleMaximum(
    state.measurementSystem.artifact === 'false-wedge'
      ? measurements.papSystolicMmHg + 5
      : (measurements.pawpMmHg ?? measurements.papDiastolicMmHg) + 8,
  )
  const pacTrace =
    state.catheter.position === 'rv'
      ? {
          field: 'rvMmHg' as const,
          label: 'RV',
          minimum: 0,
          maximum: lowPressureScaleMaximum(measurements.rvSystolicMmHg + 5),
          color: '#ffd166',
          landmarks: RV_LANDMARKS,
          referenceValue: measurements.rvDiastolicMmHg,
          referenceLabel: 'RVEDP',
        }
      : state.catheter.position === 'pa'
        ? {
            field: 'papMmHg' as const,
            label: 'PAP',
            minimum: 0,
            maximum: lowPressureScaleMaximum(measurements.papSystolicMmHg + 5),
            color: '#ffd166',
            landmarks: PA_LANDMARKS,
            referenceValue: measurements.meanPapMmHg,
            referenceLabel: 'mPAP',
          }
        : state.catheter.position === 'wedge'
          ? {
              field: 'pcwpMmHg' as const,
              label: 'PAWP',
              minimum: 0,
              maximum: wedgeScaleMaximum,
              color: '#ffd166',
              landmarks: WEDGE_LANDMARKS,
              referenceValue: measurements.pawpMmHg ?? measurements.papDiastolicMmHg,
              referenceLabel: 'end-exp mean',
            }
          : {
              field: 'cvpMmHg' as const,
              label: 'RA/CVP',
              minimum: -5,
              maximum: cvpScaleMaximum,
              color: '#ffd166',
              landmarks: ATRIAL_LANDMARKS,
              referenceValue: measurements.rapMmHg,
              referenceLabel: 'end-exp mean',
            }
  // Labels would smear across a sweeping trace, so they appear only on a frozen strip.
  const annotate = state.frozen
  const thermodilutionAverage = thermodilutionAcceptedAverage(state.thermodilutionTrials)

  return (
    <section className={styles.monitor} aria-label="Vendor-neutral simulated ICU bedside monitor">
      <header className={styles.monitorHeader}>
        <div>
          <span className={styles.monitorKicker}>HEMO // EDU</span>
          <strong>Adult ICU · deterministic model</strong>
        </div>
        <div className={styles.monitorSignalStatus}>
          <span
            className={state.measurementSystem.zeroed ? styles.statusGood : styles.statusWarning}
          />
          {state.measurementSystem.zeroed ? 'Pressure system zeroed' : 'ZERO REQUIRED'}
        </div>
        <time>{state.timeSeconds.toFixed(1)} s</time>
      </header>

      <div className={styles.alarmBar} role="status" aria-live="polite">
        {activeAlarms.length === 0 ? (
          <span className={styles.alarmClear}>NO ACTIVE MODEL ALARMS</span>
        ) : (
          activeAlarms.map((alarm) => (
            <span key={alarm.id} data-priority={alarm.priority}>
              {alarm.acknowledged ? 'ACK · ' : ''}
              {alarm.label}
            </span>
          ))
        )}
        {activeAlarms.length > 0 && (
          <button type="button" onClick={() => dispatch({ type: 'ACKNOWLEDGE_ALARMS' })}>
            Acknowledge
          </button>
        )}
      </div>

      <div className={styles.monitorBody}>
        <div className={styles.waveformStack}>
          <WaveformStrip
            samples={state.waveforms}
            field="ecgMv"
            label="ECG II"
            unit="mV"
            minimum={-0.3}
            maximum={1.4}
            color="#61e294"
            sweepSeconds={state.sweepSeconds}
          />
          <WaveformStrip
            samples={state.waveforms}
            field="artMmHg"
            label="ART"
            unit="mmHg"
            minimum={0}
            maximum={state.pressureScaleMmHg}
            color="#ff647c"
            sweepSeconds={state.sweepSeconds}
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? ARTERIAL_LANDMARKS : undefined}
            referenceValue={measurements.mapMmHg}
            referenceLabel="MAP"
          />
          <WaveformStrip
            samples={state.waveforms}
            field="cvpMmHg"
            label="CVP"
            unit="mmHg"
            minimum={-5}
            maximum={cvpScaleMaximum}
            color="#55c6ff"
            sweepSeconds={state.sweepSeconds}
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? ATRIAL_LANDMARKS : undefined}
            referenceValue={measurements.rapMmHg}
            referenceLabel="end-exp mean"
          />
          <WaveformStrip
            samples={state.waveforms}
            field={pacTrace.field}
            label={pacTrace.label}
            unit="mmHg"
            minimum={pacTrace.minimum}
            maximum={pacTrace.maximum}
            color={pacTrace.color}
            sweepSeconds={state.sweepSeconds}
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? pacTrace.landmarks : undefined}
            referenceValue={pacTrace.referenceValue}
            referenceLabel={pacTrace.referenceLabel}
          />
          <WaveformStrip
            samples={state.waveforms}
            field="pleth"
            label="PLETH"
            unit="relative"
            minimum={0}
            maximum={1.2}
            color="#6ee7e0"
            sweepSeconds={state.sweepSeconds}
          />
        </div>

        <aside className={styles.numericRail} aria-label="Current simulated hemodynamic values">
          <div data-color="green">
            <span>HR</span>
            <strong>{value(measurements.heartRateBpm)}</strong>
            <small>bpm</small>
          </div>
          <div data-color="cyan">
            <span>SpO₂</span>
            <strong>{value(measurements.spo2Percent)}</strong>
            <small>%</small>
          </div>
          <div data-color="red">
            <span>ART</span>
            <strong>
              {value(measurements.artSystolicMmHg)}/{value(measurements.artDiastolicMmHg)}
            </strong>
            <small>MAP {value(measurements.mapMmHg)}</small>
          </div>
          <div data-color="blue">
            <span>CVP / RAP</span>
            <strong>{value(measurements.rapMmHg)}</strong>
            <small>end-exp mean · mmHg</small>
          </div>
          <div data-color="yellow">
            <span>PAP</span>
            <strong>
              {value(measurements.papSystolicMmHg)}/{value(measurements.papDiastolicMmHg)}
            </strong>
            <small>mPAP {value(measurements.meanPapMmHg)}</small>
          </div>
          <div data-color="yellow">
            <span>PAWP</span>
            <strong>
              {state.catheter.storedWedgeMmHg === null
                ? value(measurements.pawpMmHg)
                : value(state.catheter.storedWedgeMmHg)}
            </strong>
            <small>
              {state.catheter.storedWedgeMmHg === null
                ? 'end-exp mean · mmHg'
                : 'stored end-exp · mmHg'}
            </small>
          </div>
          <div data-color="white">
            <span>CO / CI</span>
            <strong>
              {thermodilutionAverage === null
                ? value(measurements.cardiacOutputLMin, 1)
                : value(thermodilutionAverage, 1)}
            </strong>
            <small>CI {value(measurements.cardiacIndexLMinM2, 1)}</small>
          </div>
          <div data-color="purple">
            <span>SvO₂</span>
            <strong>{value(measurements.svo2Percent)}</strong>
            <small>%</small>
          </div>
        </aside>
      </div>

      <footer className={styles.monitorControls}>
        <button
          type="button"
          aria-pressed={state.frozen}
          onClick={() => dispatch({ type: 'TOGGLE_FREEZE' })}
        >
          {state.frozen ? 'Unfreeze' : 'Freeze + label waves'}
        </button>
        <label>
          Sweep
          <select
            value={state.sweepSeconds}
            onChange={(event) =>
              dispatch({ type: 'SET_SWEEP', seconds: Number(event.target.value) as 4 | 6 | 8 | 12 })
            }
          >
            {sweeps.map((sweep) => (
              <option value={sweep} key={sweep}>
                {sweep} s
              </option>
            ))}
          </select>
        </label>
        <label>
          ART scale
          <select
            value={state.pressureScaleMmHg}
            onChange={(event) =>
              dispatch({
                type: 'SET_PRESSURE_SCALE',
                maximum: Number(event.target.value) as 40 | 80 | 160 | 240,
              })
            }
          >
            {pressureScales.map((scale) => (
              <option value={scale} key={scale}>
                0–{scale}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => dispatch({ type: 'ZERO_TRANSDUCER' })}>
          Zero pressures
        </button>
        <button type="button" onClick={onOpenCardiacOutput}>
          Cardiac output
        </button>
      </footer>
    </section>
  )
}
