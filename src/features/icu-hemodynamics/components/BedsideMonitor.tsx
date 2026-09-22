'use client'

import { useMemo, type Dispatch } from 'react'

import type {
  HemodynamicAction,
  HemodynamicSimulationState,
  PressureWaveformField,
} from '../engine'
import {
  monitorPressureReadouts,
  recentTracePressureMetrics,
  thermodilutionAcceptedAverage,
} from '../engine'
import { catheterSimulationNotice } from '../engine/catheterSafety'
import { CARDIAC_PHASE } from '../engine/waveformMorphology'
import { WaveformStrip, type WaveformLandmark, type WaveformPhaseCursor } from './WaveformStrip'
import styles from './icu-hemodynamics.module.css'

interface BedsideMonitorProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
  onOpenCardiacOutput?: () => void
  /**
   * Whether the distal channel may be named by the chamber the tip sits in. While a lesson step is
   * asking where the tip is, the label, the rail caption, the frozen landmarks and the
   * position-specific alarm would each answer it, so the stage withholds them and the channel is
   * called the distal lumen.
   */
  chamberLabel?: 'shown' | 'withheld'
  /** The monitor's own footer controls; the lesson stage supplies its own beneath the monitor. */
  showControls?: boolean
  /** A focused channel uses the same samples and readout calculation as the full monitor. */
  focus?: 'all' | 'pac' | 'arterial'
}

interface PacTraceConfiguration {
  readonly field: PressureWaveformField
  readonly label: string
  readonly minimum: number
  readonly maximum: number
  readonly color: string
  readonly landmarks?: readonly WaveformLandmark[]
  readonly referenceValue?: number
  readonly referenceLabel?: string
  readonly unavailableMessage?: string
  readonly transitionFrom?: {
    readonly field: PressureWaveformField
    readonly untilTime: number
    readonly label: string
  }
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

export function BedsideMonitor({
  state,
  dispatch,
  onOpenCardiacOutput,
  chamberLabel = 'shown',
  showControls = true,
  focus = 'all',
}: BedsideMonitorProps) {
  const measurements = state.measurements
  const withheld = chamberLabel === 'withheld'
  const thermodilutionAverage = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  /*
   * The rail's pressures come from one selector, which the decision record reads too.
   *
   * They used to be derived here and, separately, from `state.measurements` in the record's
   * provenance adapter, which then described the model's estimate as the displayed value; the two
   * disagreed (sanity review of HD-PRE-REVIEW-01, blocker 3). `monitorPressureReadouts` is now the
   * only implementation, so "displayed" means this.
   */
  const readouts = useMemo(() => monitorPressureReadouts(state), [state])
  const endExpiratoryCvpCursor = readouts.rightAtrial.cursor
  const endExpiratoryRap = readouts.rightAtrial.displayedMmHg
  const endExpirationMarker: WaveformPhaseCursor | undefined = endExpiratoryCvpCursor
    ? {
        time: endExpiratoryCvpCursor.time,
        label: 'end-exp',
      }
    : undefined
  const cvpMeasurementCursor: WaveformPhaseCursor | undefined = endExpiratoryCvpCursor
    ? {
        time: endExpiratoryCvpCursor.time,
        value: endExpiratoryCvpCursor.value,
        // The tag prints the rail's number, so the trace and the rail cannot disagree by a digit.
        label: `end-exp · c-base ${value(endExpiratoryRap)}`,
      }
    : undefined
  const activeAlarms = state.alarms.filter(
    (alarm) =>
      alarm.active &&
      !withheld &&
      (alarm.id !== 'low-ci' || thermodilutionAverage !== null) &&
      (alarm.id !== 'high-pap' ||
        state.catheter.position === 'pa' ||
        state.catheter.position === 'wedge'),
  )
  const cvpScaleMaximum = lowPressureScaleMaximum(measurements.rapMmHg + 10)
  const falseWedge = state.measurementSystem.artifact === 'false-wedge'
  // What the simulation itself is restricting, named as a simulation notice rather than smuggled
  // into the device alarm bar (report L9-02).
  const simulationNotice = catheterSimulationNotice(state)
  const wedgeScaleMaximum = lowPressureScaleMaximum(
    falseWedge
      ? measurements.papSystolicMmHg + 5
      : (measurements.pawpMmHg ?? measurements.papDiastolicMmHg) + 8,
  )
  const namedPacTrace: PacTraceConfiguration =
    state.catheter.position === 'rv'
      ? {
          field: 'rvMmHg',
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
            field: 'papMmHg',
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
              field: 'pcwpMmHg',
              // A channel is named for what it is carrying. Under the false-wedge artifact the
              // engine deliberately draws this channel from the pulmonary-artery waveform, because
              // retained pulsatility is what an incomplete occlusion looks like — so naming it
              // PAWP asserted the one thing the tracing denies (report L9-01).
              label: falseWedge ? 'PAC distal' : 'PAWP',
              minimum: 0,
              maximum: wedgeScaleMaximum,
              color: '#ffd166',
              landmarks: falseWedge ? PA_LANDMARKS : WEDGE_LANDMARKS,
              referenceValue: falseWedge
                ? measurements.meanPapMmHg
                : (measurements.pawpMmHg ?? measurements.papDiastolicMmHg),
              referenceLabel: falseWedge ? 'trace mean' : 'end-exp mean',
              transitionFrom:
                state.catheter.wedgeStartedAt === null
                  ? undefined
                  : {
                      field: 'papMmHg',
                      untilTime: state.catheter.wedgeStartedAt,
                      label: 'balloon occlusion → PAWP',
                    },
            }
          : state.catheter.position === 'ra'
            ? {
                field: 'cvpMmHg',
                label: 'RA',
                minimum: -5,
                maximum: cvpScaleMaximum,
                color: '#ffd166',
                landmarks: ATRIAL_LANDMARKS,
              }
            : {
                field: 'cvpMmHg',
                label: 'PAC',
                minimum: -5,
                maximum: cvpScaleMaximum,
                color: '#ffd166',
                unavailableMessage: 'No chamber waveform — tip remains in the introducer',
              }
  const pacTrace: PacTraceConfiguration = withheld
    ? {
        field: namedPacTrace.field,
        label: 'PAC',
        minimum: namedPacTrace.minimum,
        maximum: namedPacTrace.maximum,
        color: namedPacTrace.color,
        unavailableMessage: namedPacTrace.unavailableMessage,
      }
    : namedPacTrace
  // Labels would smear across a sweeping trace, so they appear only on a frozen strip.
  const annotate = state.frozen
  const pacTraceMetrics = useMemo(
    () =>
      state.catheter.position === 'introducer' || state.catheter.position === 'ra'
        ? null
        : recentTracePressureMetrics(
            state.waveforms,
            pacTrace.field,
            state.measurements.heartRateBpm,
          ),
    [pacTrace.field, state.catheter.position, state.measurements.heartRateBpm, state.waveforms],
  )
  const artSystolic = readouts.arterial.systolicMmHg
  const artDiastolic = readouts.arterial.diastolicMmHg
  const artMean = readouts.arterial.mean.displayedMmHg
  const acceptedCardiacIndex =
    thermodilutionAverage === null
      ? null
      : thermodilutionAverage / state.parameters.bodySurfaceAreaM2
  const mixedVenousAvailable =
    state.catheter.position === 'pa' &&
    state.catheter.targetPosition === null &&
    !state.catheter.balloonInflated

  const pacPressureDisplay = withheld
    ? {
        label: 'PAC · distal',
        value: pacTraceMetrics
          ? `${value(pacTraceMetrics.systolic)}/${value(pacTraceMetrics.diastolic)}`
          : value(endExpiratoryRap),
        detail: 'chamber not named on this step · mmHg',
      }
    : state.catheter.position === 'introducer'
      ? {
          label: 'PAC',
          value: '—',
          detail: 'tip in introducer · no chamber pressure',
        }
      : state.catheter.position === 'ra'
        ? {
            label: 'PAC · RA',
            value: value(endExpiratoryRap),
            detail: 'end-exp c-base · mmHg',
          }
        : state.catheter.position === 'rv'
          ? {
              label: 'PAC · RV',
              value: `${value(pacTraceMetrics?.systolic ?? measurements.rvSystolicMmHg)}/${value(
                pacTraceMetrics?.diastolic ?? measurements.rvDiastolicMmHg,
              )}`,
              detail: 'systolic / end-diastolic · mmHg',
            }
          : state.catheter.position === 'pa'
            ? {
                label: 'PAP',
                value: `${value(
                  pacTraceMetrics?.systolic ?? measurements.papSystolicMmHg,
                )}/${value(pacTraceMetrics?.diastolic ?? measurements.papDiastolicMmHg)}`,
                detail: `mPAP ${value(pacTraceMetrics?.mean ?? measurements.meanPapMmHg)}`,
              }
            : falseWedge
              ? {
                  label: 'PAC · distal',
                  value: value(pacTraceMetrics?.mean ?? measurements.pawpMmHg),
                  // Not an occlusion mean: the tracing has kept its pulmonary-artery pulsatility,
                  // which is what an incomplete occlusion looks like. The balloon state is printed
                  // because the contradiction the report found was between a claimed live
                  // occlusion and a balloon that was down (L9-01, Figure 37 callout 3).
                  detail: `trace mean · balloon ${
                    state.catheter.balloonInflated ? 'up' : 'down'
                  } · not a validated occlusion · mmHg`,
                }
              : {
                  label: 'PAC · PAWP',
                  value: value(pacTraceMetrics?.mean ?? measurements.pawpMmHg),
                  detail: `${
                    state.catheter.balloonInflated
                      ? 'balloon occlusion'
                      : 'occluded branch, balloon down'
                  } · live mean · mmHg`,
                }

  if (focus !== 'all') {
    const arterial = focus === 'arterial'
    return (
      <section
        className={styles.focusedMonitor}
        data-focused-monitor={focus}
        aria-label="Simulated pressure observation"
      >
        <header>
          <strong>{arterial ? 'Systemic arterial pressure' : pacPressureDisplay.label}</strong>
          <span>
            {arterial
              ? `${value(artSystolic)}/${value(artDiastolic)} · MAP ${value(artMean)}`
              : pacPressureDisplay.value}{' '}
            mmHg
          </span>
          <small>
            Simulated · {state.sweepSeconds} s sweep · {state.parameters.respiratoryRateBpm}{' '}
            breaths/min · PEEP {state.parameters.peepCmH2O} cm H₂O
          </small>
        </header>
        <WaveformStrip
          samples={state.waveforms}
          field="ecgMv"
          label="ECG II"
          unit="mV"
          minimum={-0.3}
          maximum={1.4}
          color="#61e294"
          sweepSeconds={state.sweepSeconds}
          readable
        />
        <WaveformStrip
          samples={state.waveforms}
          field={arterial ? 'artMmHg' : pacTrace.field}
          label={arterial ? 'ART' : pacTrace.label}
          unit="mmHg"
          minimum={arterial ? 0 : pacTrace.minimum}
          maximum={arterial ? state.pressureScaleMmHg : pacTrace.maximum}
          color={arterial ? '#ff647c' : pacTrace.color}
          sweepSeconds={state.sweepSeconds}
          showScale
          readable
          heartRateBpm={measurements.heartRateBpm}
          landmarks={annotate ? (arterial ? ARTERIAL_LANDMARKS : pacTrace.landmarks) : undefined}
          referenceValue={arterial ? artMean : pacTrace.referenceValue}
          referenceLabel={arterial ? 'MAP' : pacTrace.referenceLabel}
          transitionFrom={arterial ? undefined : pacTrace.transitionFrom}
          unavailableMessage={arterial ? undefined : pacTrace.unavailableMessage}
          phaseCursor={withheld ? undefined : endExpirationMarker}
        />
        {state.catheter.balloonInflated || state.catheter.storedWedgeMmHg !== null ? (
          <p>
            Balloon {state.catheter.balloonInflated ? 'inflated' : 'down'} · stored end-expiratory
            PAWP {value(state.catheter.storedWedgeMmHg)} mmHg
          </p>
        ) : null}
        {activeAlarms.length > 0 ? (
          <p role="status">{activeAlarms.map((alarm) => alarm.label).join(' · ')}</p>
        ) : null}
      </section>
    )
  }

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

      {simulationNotice && !withheld ? (
        <p className={styles.simulationNotice} role="status" data-simulation-safety-notice>
          {simulationNotice}
        </p>
      ) : null}

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
            readable
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
            readable
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? ARTERIAL_LANDMARKS : undefined}
            referenceValue={artMean}
            referenceLabel="MAP"
            phaseCursor={endExpirationMarker}
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
            readable
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? ATRIAL_LANDMARKS : undefined}
            phaseCursor={cvpMeasurementCursor}
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
            readable
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? pacTrace.landmarks : undefined}
            referenceValue={pacTrace.referenceValue}
            referenceLabel={pacTrace.referenceLabel}
            transitionFrom={pacTrace.transitionFrom}
            unavailableMessage={pacTrace.unavailableMessage}
            phaseCursor={state.catheter.position === 'ra' ? cvpMeasurementCursor : undefined}
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
            readable
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
          <div data-color="red" role="group" aria-label="Systemic arterial pressure">
            <span>ART</span>
            <strong>
              {value(artSystolic)}/{value(artDiastolic)}
            </strong>
            <small>trace MAP {value(artMean)}</small>
          </div>
          <div data-color="blue" role="group" aria-label="Central venous pressure">
            <span>CVP / RAP</span>
            <strong>{value(endExpiratoryRap)}</strong>
            <small>end-exp c-base · mmHg</small>
          </div>
          <div data-color="yellow" role="group" aria-label="Current PAC pressure">
            <span>{pacPressureDisplay.label}</span>
            <strong>{pacPressureDisplay.value}</strong>
            <small>{pacPressureDisplay.detail}</small>
          </div>
          <div data-color="yellow" role="group" aria-label="PAWP measurement">
            <span>Stored PAWP</span>
            <strong>{value(state.catheter.storedWedgeMmHg)}</strong>
            <small>
              {state.catheter.storedWedgeMmHg !== null
                ? 'stored end-exp · mmHg'
                : state.catheter.position === 'wedge'
                  ? // "A live trace is visible" said nothing about whether that trace is an
                    // occlusion pressure. Under the false-wedge artifact it is not (report L9-01).
                    falseWedge
                    ? 'nothing stored · the distal trace is not a valid occlusion'
                    : 'live occlusion trace visible · not stored'
                  : 'not captured'}
            </small>
          </div>
          <div data-color="white" role="group" aria-label="Thermodilution cardiac output">
            <span>CO / CI</span>
            <strong>{value(thermodilutionAverage, 1)}</strong>
            <small>
              {acceptedCardiacIndex === null
                ? 'thermodilution not established'
                : `CI ${value(acceptedCardiacIndex, 1)}`}
            </small>
          </div>
          <div data-color="purple" role="group" aria-label="Mixed venous oxygen saturation">
            <span>SvO₂</span>
            <strong>{mixedVenousAvailable ? value(measurements.svo2Percent) : '—'}</strong>
            <small>
              {mixedVenousAvailable
                ? '% · distal PA sample · usual reference 65–75%'
                : 'not available before PA'}
            </small>
          </div>
        </aside>
      </div>

      {showControls ? (
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
                dispatch({
                  type: 'SET_SWEEP',
                  seconds: Number(event.target.value) as 4 | 6 | 8 | 12,
                })
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
          {onOpenCardiacOutput ? (
            <button type="button" onClick={onOpenCardiacOutput}>
              Cardiac output
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  )
}
