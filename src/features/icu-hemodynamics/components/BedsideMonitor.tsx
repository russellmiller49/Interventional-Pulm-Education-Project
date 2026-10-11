'use client'

import { useMemo, useState, type Dispatch } from 'react'

import type {
  HemodynamicAction,
  HemodynamicSimulationState,
  PressureWaveformField,
} from '../engine'
import {
  displaySeamWords,
  displaySeamsFor,
  fittedPressureAxis,
  fixedWithoutNegativeZero,
  mixedVenousAvailability,
  monitorPressureReadouts,
  recentTracePressureMetrics,
  referenceComparisonAxis,
  type PressureAxis,
} from '../engine'
import { catheterSimulationNotice } from '../engine/catheterSafety'
import {
  physiologicalEpisodeWords,
  storedWedgeProvenance,
  thermodilutionSeriesView,
} from '../engine/measurementProvenance'
import { CARDIAC_PHASE } from '../engine/waveformMorphology'
import {
  WaveformStrip,
  type WaveformLandmark,
  type WaveformPhaseCursor,
  type WaveformStripSeam,
} from './WaveformStrip'
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
  /**
   * The retained starting state of a reference comparison. When supplied, the catheter channel
   * keeps one axis — sized from this state's own tracing for every position of the height and zero
   * controls — instead of an axis refitted to each new value (report L2-06).
   */
  comparisonBaseline?: Pick<HemodynamicSimulationState, 'waveforms'>
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
  return value === null || !Number.isFinite(value) ? '—' : fixedWithoutNegativeZero(value, digits)
}

function axisWords(axis: PressureAxis): string {
  return `${fixedWithoutNegativeZero(axis.minimum)} to ${fixedWithoutNegativeZero(axis.maximum)} mmHg`
}

/** How the stored wedge was read, and whether it still describes this patient. */
function storedWedgeWords(stored: NonNullable<ReturnType<typeof storedWedgeProvenance>>): string {
  if (!stored.record) return 'stored · how it was read was not recorded'
  const cursor = stored.record.cursor
  const phase = cursor.withinModeledEndExpiratoryWindow ? 'stored end-exp' : 'stored, not end-exp'
  const who = cursor.placement === 'manual' ? 'your cursor' : 'assisted cursor'
  const conditions = stored.current === false ? ' · earlier conditions' : ''
  return `${phase} · ${who}${conditions}`
}

function lowPressureScaleMaximum(targetMmHg: number): 20 | 40 | 80 | 160 {
  if (targetMmHg <= 18) return 20
  if (targetMmHg <= 36) return 40
  if (targetMmHg <= 72) return 80
  return 160
}

/**
 * Says when a channel's axis changed under a tracing that stayed on the same channel.
 *
 * The monitor fits each axis to the pressure it is showing. When that fit changes, the same
 * waveform is suddenly drawn at half or twice the size, and a learner reads it as the waveform
 * changing (report L2-06). The fit is kept — it is what stops a raised pressure being cut off —
 * and the change is announced instead of left to be noticed. A change of channel is not a change
 * of axis and announces nothing: the channel's own label already changed.
 *
 * The notice describes the axis and how to read it. It makes no statement about the pressure. It
 * used to end "the pressure did not", which is the opposite of what happened: within one channel
 * the fit moves only when the pressure the monitor is displaying has moved far enough to need a
 * different axis — after a fluid step, after pericardial drainage, or after the transducer was
 * moved (sanity review of HD-PRE-REVIEW-03, L2-06). Whether that was the patient or the
 * instrument is not something an axis can know, so it does not say.
 */
const AXIS_REFIT_READING =
  'The monitor refits this axis to the pressure it is displaying, so the same height on the strip now stands for a different pressure. Read a change from the axis numbers and the readout, not from the size of the tracing.'

function useAxisChangeNotice(channel: string, axis: PressureAxis): string | null {
  const [memory, setMemory] = useState<{
    channel: string
    axis: PressureAxis
    change: { from: PressureAxis; to: PressureAxis } | null
  }>({ channel, axis, change: null })
  if (
    memory.channel !== channel ||
    memory.axis.minimum !== axis.minimum ||
    memory.axis.maximum !== axis.maximum
  ) {
    setMemory({
      channel,
      axis,
      change: memory.channel === channel ? { from: memory.axis, to: axis } : null,
    })
  }
  return memory.change
    ? `Axis changed from ${axisWords(memory.change.from)} to ${axisWords(memory.change.to)}. ${AXIS_REFIT_READING}`
    : null
}

/** A still copy of the last two beats, kept in the monitor and never written to the engine. */
interface HeldView {
  readonly samples: HemodynamicSimulationState['waveforms']
  readonly field: PressureWaveformField
  readonly label: string
  readonly color: string
  readonly heartRateBpm: number
  readonly landmarks?: readonly WaveformLandmark[]
  readonly transitionFrom?: PacTraceConfiguration['transitionFrom']
  /**
   * The measurement-system changes the live strip was showing when the copy was taken. Copied with
   * the samples, because they describe those samples: the engine forgets a seam once it has left
   * every live sweep, and the copy outlives that.
   */
  readonly seams: readonly WaveformStripSeam[]
  readonly takenAtSeconds: number
  readonly liveAxis: PressureAxis
}

export function BedsideMonitor({
  state,
  dispatch,
  onOpenCardiacOutput,
  chamberLabel = 'shown',
  showControls = true,
  focus = 'all',
  comparisonBaseline,
}: BedsideMonitorProps) {
  const measurements = state.measurements
  const withheld = chamberLabel === 'withheld'
  /*
   * The cardiac output shown is the series for the conditions the patient is in now (report P-05).
   * A series acquired before a modeled intervention is not carried forward as the current value:
   * the rail says it exists and when it was acquired, and leaves the current value empty.
   */
  const seriesView = thermodilutionSeriesView(state)
  const thermodilutionAverage = seriesView.current.averageLMin
  const earlierSeries = seriesView.latestEarlierEstablished
  const storedWedge = storedWedgeProvenance(state)
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
  // Which pressure channel an alarm is about, for a focused monitor that draws only one of them.
  const alarmIsArterial = (alarm: (typeof activeAlarms)[number]) => alarm.id === 'low-map'
  const alarmIsCatheter = (alarm: (typeof activeAlarms)[number]) =>
    alarm.id === 'high-pap' || alarm.id === 'wedge-safety'
  const alarmsOnOtherChannel = activeAlarms.filter((alarm) =>
    focus === 'arterial' ? alarmIsCatheter(alarm) : alarmIsArterial(alarm),
  )
  const alarmsOnThisChannel = activeAlarms.filter((alarm) => !alarmsOnOtherChannel.includes(alarm))
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
          referenceLabel: 'model RVEDP',
        }
      : state.catheter.position === 'pa'
        ? {
            field: 'papMmHg',
            label: 'PAP',
            minimum: 0,
            maximum: lowPressureScaleMaximum(measurements.papSystolicMmHg + 5),
            color: '#ffd166',
            landmarks: PA_LANDMARKS,
            // The dashed line is the model's own mean, which carries no respiratory swing; the rail's
            // numbers are the last displayed beat. They are different quantities (report L2-02).
            referenceValue: measurements.meanPapMmHg,
            referenceLabel: 'model mPAP',
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
              // Both lines are the model's values, not a stored reading (report L6-03).
              referenceLabel: falseWedge ? 'model mean' : 'model end-exp mean',
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
  /*
   * The catheter channel's axis: fitted to the pressure, unless a reference comparison pins one
   * axis for its whole length (report L2-06). An unavailable channel has no trace to fit.
   */
  const pinnedPacAxis =
    comparisonBaseline && pacTrace.unavailableMessage === undefined
      ? referenceComparisonAxis(comparisonBaseline, pacTrace.field)
      : null
  const pacAxis: PressureAxis = pinnedPacAxis ?? {
    minimum: pacTrace.minimum,
    maximum: pacTrace.maximum,
  }
  // Entering or leaving a pinned comparison is a change of mode, not a refit under the learner.
  const pacAxisNotice = useAxisChangeNotice(
    `pac:${pacTrace.field}:${pinnedPacAxis ? 'pinned' : 'fitted'}`,
    pacAxis,
  )
  const cvpAxis: PressureAxis = { minimum: -5, maximum: cvpScaleMaximum }
  const cvpAxisNotice = useAxisChangeNotice('cvp', cvpAxis)
  const pressureSeams: readonly WaveformStripSeam[] = displaySeamsFor(state, 'other-pressure').map(
    (seam) => ({
      fromTime: seam.fromSeconds,
      untilTime: seam.untilSeconds,
      label: displaySeamWords(seam),
    }),
  )
  const arterialSeams: readonly WaveformStripSeam[] = displaySeamsFor(
    state,
    'systemic-arterial',
  ).map((seam) => ({
    fromTime: seam.fromSeconds,
    untilTime: seam.untilSeconds,
    label: displaySeamWords(seam),
  }))
  /*
   * Frozen is a property of the tracings, not of the model: the engine keeps running and only the
   * waveform buffer stops. The monitor says when the tracings stopped and that they are not live,
   * so a frozen strip is never read as the current state.
   */
  const frozenAtSeconds = state.frozen ? (state.waveforms.at(-1)?.time ?? null) : null
  const [held, setHeld] = useState<HeldView | null>(null)
  // Labels would smear across a sweeping trace, so they appear only on a frozen strip.
  const annotate = state.frozen
  /*
   * During an occlusion the PAC strip shows the cursor the learner (or the assisted placement) set,
   * not the automatic end-expiratory marker: the marker would find end expiration for them, which is
   * the decision the wedge step asks them to make (report L6-02).
   */
  const occluding = state.catheter.position === 'wedge' && state.catheter.balloonInflated
  const wedgeCursor = occluding && state.catheter.wedgeCursor ? state.catheter.wedgeCursor : null
  const pacPhaseCursor: WaveformPhaseCursor | undefined = wedgeCursor
    ? {
        time: wedgeCursor.time,
        value: wedgeCursor.sampleMmHg,
        label: `${wedgeCursor.placement === 'manual' ? 'your cursor' : 'assisted cursor'} · cycle mean ${value(wedgeCursor.cycleMeanMmHg)}`,
      }
    : occluding
      ? undefined
      : endExpirationMarker
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
  const mixedVenous = mixedVenousAvailability(state)
  const mixedVenousAvailable = mixedVenous.available

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
                detail: pacTraceMetrics
                  ? `last beat · mPAP ${value(pacTraceMetrics.mean)}, that beat’s mean`
                  : `model mPAP ${value(measurements.meanPapMmHg)}`,
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
                  // The last displayed beat, wherever in the breath it fell — not the stored,
                  // end-expiratory value (report L6-03).
                  detail: `${
                    state.catheter.balloonInflated
                      ? 'balloon occlusion'
                      : 'occluded branch, balloon down'
                  } · live mean, last beat, any breath phase · mmHg`,
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
            mmHg{' '}
            <small data-focused-sampling>
              {arterial ? 'last beat' : pacPressureDisplay.detail}
            </small>
          </span>
          <small>
            Simulated · {state.sweepSeconds} s sweep · {state.parameters.respiratoryRateBpm}{' '}
            breaths/min · PEEP {state.parameters.peepCmH2O} cm H₂O
            {!arterial && pinnedPacAxis ? (
              <span data-pinned-axis>
                {' '}
                · axis fixed at {axisWords(pacAxis)} for this comparison
              </span>
            ) : null}
          </small>
        </header>
        {frozenAtSeconds !== null ? (
          <p className={styles.monitorViewNote} role="status" data-frozen-note>
            Frozen. These tracings stopped at {frozenAtSeconds.toFixed(1)} s of model time and are
            not live; the model has continued to {state.timeSeconds.toFixed(1)} s.
          </p>
        ) : null}
        {!arterial && pacAxisNotice ? (
          <p className={styles.monitorViewNote} role="status" data-scale-change-note>
            {pacAxisNotice}
          </p>
        ) : null}
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
          minimum={arterial ? 0 : pacAxis.minimum}
          maximum={arterial ? state.pressureScaleMmHg : pacAxis.maximum}
          seams={arterial ? arterialSeams : pressureSeams}
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
          phaseCursor={withheld ? undefined : arterial ? endExpirationMarker : pacPhaseCursor}
        />
        {(arterial || pacTrace.unavailableMessage === undefined) && state.waveforms.length > 1 ? (
          <div className={styles.monitorViewTools} data-monitor-view-tools>
            <button
              type="button"
              aria-pressed={held !== null}
              data-hold-view
              onClick={() =>
                setHeld(
                  held
                    ? null
                    : {
                        samples: state.waveforms,
                        field: arterial ? 'artMmHg' : pacTrace.field,
                        label: arterial ? 'ART' : pacTrace.label,
                        color: arterial ? '#ff647c' : pacTrace.color,
                        heartRateBpm: measurements.heartRateBpm,
                        landmarks: arterial ? ARTERIAL_LANDMARKS : pacTrace.landmarks,
                        transitionFrom: arterial ? undefined : pacTrace.transitionFrom,
                        seams: arterial ? arterialSeams : pressureSeams,
                        takenAtSeconds: state.waveforms.at(-1)?.time ?? state.timeSeconds,
                        liveAxis: arterial
                          ? { minimum: 0, maximum: state.pressureScaleMmHg }
                          : pacAxis,
                      },
                )
              }
            >
              {held ? 'Release the held copy' : 'Hold and enlarge the last two beats'}
            </button>
            <small>
              {held
                ? 'The strip above is still live.'
                : 'Keeps a still, enlarged copy to read wave by wave. Nothing in the simulation stops.'}
            </small>
          </div>
        ) : null}
        {held ? <HeldCopy held={held} /> : null}
        {state.catheter.balloonInflated || state.catheter.storedWedgeMmHg !== null ? (
          <p data-stored-wedge-line>
            Balloon {state.catheter.balloonInflated ? 'inflated' : 'down'} · stored PAWP{' '}
            {value(state.catheter.storedWedgeMmHg)} mmHg
            {storedWedge ? ` · ${storedWedgeWords(storedWedge)}` : ' · nothing stored yet'}
          </p>
        ) : null}
        {activeAlarms.length > 0 ? (
          <p role="status">
            {alarmsOnThisChannel.map((alarm) => alarm.label).join(' · ')}
            {alarmsOnOtherChannel.length > 0 ? (
              /*
               * An alarm from a channel this monitor does not draw is still reported, with the
               * channel it belongs to: "ART MAP LOW" under a tracing of pulmonary-artery pressure
               * read as a statement about that tracing (report L2-06).
               */
              <span data-alarm-other-channel>
                {alarmsOnThisChannel.length > 0 ? ' · ' : ''}
                {arterial ? 'On the catheter’s channel' : 'On the arterial line'}, which this task’s
                monitor does not show:{' '}
                {alarmsOnOtherChannel.map((alarm) => alarm.label).join(' · ')}
              </span>
            ) : null}
          </p>
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

      {frozenAtSeconds !== null ? (
        <p className={styles.monitorViewNote} role="status" data-frozen-note>
          Frozen. These tracings stopped at {frozenAtSeconds.toFixed(1)} s of model time and are not
          live; the model has continued to {state.timeSeconds.toFixed(1)} s.
        </p>
      ) : null}
      {pacAxisNotice || cvpAxisNotice ? (
        <p className={styles.monitorViewNote} role="status" data-scale-change-note>
          {[
            cvpAxisNotice ? `CVP: ${cvpAxisNotice}` : null,
            pacAxisNotice ? `${pacTrace.label}: ${pacAxisNotice}` : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}

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
            seams={arterialSeams}
          />
          <WaveformStrip
            samples={state.waveforms}
            field="cvpMmHg"
            label="CVP"
            unit="mmHg"
            minimum={cvpAxis.minimum}
            maximum={cvpAxis.maximum}
            color="#55c6ff"
            sweepSeconds={state.sweepSeconds}
            readable
            showScale
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? ATRIAL_LANDMARKS : undefined}
            phaseCursor={cvpMeasurementCursor}
            seams={pressureSeams}
          />
          <WaveformStrip
            samples={state.waveforms}
            field={pacTrace.field}
            label={pacTrace.label}
            unit="mmHg"
            minimum={pacAxis.minimum}
            maximum={pacAxis.maximum}
            color={pacTrace.color}
            sweepSeconds={state.sweepSeconds}
            readable
            showScale
            seams={pressureSeams}
            heartRateBpm={measurements.heartRateBpm}
            landmarks={annotate ? pacTrace.landmarks : undefined}
            referenceValue={pacTrace.referenceValue}
            referenceLabel={pacTrace.referenceLabel}
            transitionFrom={pacTrace.transitionFrom}
            unavailableMessage={pacTrace.unavailableMessage}
            phaseCursor={
              state.catheter.position === 'ra'
                ? cvpMeasurementCursor
                : wedgeCursor
                  ? pacPhaseCursor
                  : undefined
            }
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
              {storedWedge
                ? `${storedWedgeWords(storedWedge)} · mmHg`
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
            <small data-co-rail-provenance>
              {acceptedCardiacIndex !== null
                ? `CI ${value(acceptedCardiacIndex, 1)}`
                : earlierSeries
                  ? `thermodilution not established for current conditions · last series ${value(earlierSeries.averageLMin, 1)} L/min was acquired ${physiologicalEpisodeWords(earlierSeries.identity.episode)}`
                  : 'thermodilution not established'}
            </small>
          </div>
          <div data-color="purple" role="group" aria-label="Mixed venous oxygen saturation">
            <span>SvO₂</span>
            <strong>{mixedVenousAvailable ? value(measurements.svo2Percent) : '—'}</strong>
            <small>
              {mixedVenousAvailable
                ? '% · distal PA sample · usual reference 65–75%'
                : mixedVenous.reason}
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

/**
 * The held copy: two beats, still, on an axis fitted to them.
 *
 * On a six-second sweep and an axis sized for the whole venous range, a right-atrial tracing is a
 * few millimetres of line and its a, c and v waves cannot be told apart (report L5-05). This is the
 * same buffer the strip above draws from, cut to its last two cardiac cycles and enlarged. It is a
 * view: no sample is filtered, smoothed or resampled, nothing is written to the engine, and the
 * axis is fitted to the samples so a raised pressure is enlarged where it sits rather than clipped.
 *
 * It keeps the live strip's seams. Two beats can straddle a change of transducer height, zero or
 * line response, and the copy used to draw them as one unbroken line: the step the live strip had
 * left open was joined up again, enlarged, under a caption saying only the window and the axis
 * differ (sanity review of HD-PRE-REVIEW-03, L5-05). The copy now breaks and dims the trace where
 * the live strip did, and its note names the change.
 */
function HeldCopy({ held }: { readonly held: HeldView }) {
  const windowSeconds = (60 / held.heartRateBpm) * 2
  const visible = held.samples.filter(
    (sample) => sample.time >= held.takenAtSeconds - windowSeconds,
  )
  const windowStart = visible[0]?.time ?? held.takenAtSeconds
  // The strip's own rule for which seams fall inside a window, so the note and the plot agree.
  const seamsInWindow = held.seams.filter(
    (seam) => seam.untilTime >= windowStart && seam.fromTime <= held.takenAtSeconds,
  )
  // A copy taken at the moment of a change holds nothing drawn after it: it ends at the change.
  const heldPastAChange = visible.some((sample) =>
    seamsInWindow.some((seam) => sample.time > seam.untilTime),
  )
  const axis =
    fittedPressureAxis(
      visible.map((sample) =>
        held.transitionFrom && sample.time < held.transitionFrom.untilTime
          ? sample[held.transitionFrom.field]
          : sample[held.field],
      ),
    ) ?? held.liveAxis
  return (
    <section
      className={styles.heldCopy}
      data-held-view
      aria-label={`Held copy of the ${held.label} tracing`}
    >
      <p data-held-view-note>
        <strong>Held copy · not live.</strong> The two beats that ended at{' '}
        {held.takenAtSeconds.toFixed(1)} s of model time, on an axis fitted to them (
        {axisWords(axis)}; the live strip uses {axisWords(held.liveAxis)}). The same samples, drawn
        larger: only the time window and the axis differ.
        {seamsInWindow.length > 0 ? (
          <span data-held-view-seam>
            {' '}
            These two beats {heldPastAChange ? 'cross' : 'end at'} a change in the measurement
            system:{' '}
            {seamsInWindow
              .map((seam) => `${seam.label} at ${seam.untilTime.toFixed(1)} s`)
              .join('; ')}
            .{' '}
            {heldPastAChange
              ? 'The part before the marker was drawn under the earlier setting; it is dimmed and not joined to the part after it, as on the live strip.'
              : 'All of this copy was drawn under the earlier setting, so it is dimmed, as that part of the live strip is.'}
          </span>
        ) : null}
      </p>
      <WaveformStrip
        samples={held.samples}
        field={held.field}
        label={held.label}
        unit="mmHg"
        minimum={axis.minimum}
        maximum={axis.maximum}
        color={held.color}
        sweepSeconds={windowSeconds}
        showScale
        readable
        stillCopy
        heartRateBpm={held.heartRateBpm}
        landmarks={held.landmarks}
        transitionFrom={held.transitionFrom}
        seams={held.seams}
      />
    </section>
  )
}
