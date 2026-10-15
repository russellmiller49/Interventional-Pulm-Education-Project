'use client'

import { useEffect, useMemo, useState, type Dispatch, type KeyboardEvent } from 'react'
import {
  Activity,
  AlarmClock,
  BellRing,
  Gauge,
  Hand,
  LockKeyhole,
  MonitorUp,
  MousePointer2,
  Settings2,
  ShieldCheck,
  Snowflake,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react'

import {
  formatMonitorField,
  getVentilatorDeviceProfile,
  getVentilatorModeDescriptor,
  groupControlsForDevice,
  VENTILATOR_CONTROL_GROUP_NOTE,
  nativeToCanonicalControlValue,
  resolveBreathPhase,
} from '../content'
import { plateauReadingValidity, plateauWithheldNote } from '../content/plateauValidity'
import {
  plateauAcquisition,
  plateauAcquisitionNote,
  type PlateauAcquisitionStatus,
} from '../content/plateauAcquisition'
import type {
  FlowPattern,
  VentilatorBezelKey,
  VentilatorDisplayProfile,
  VentilatorScreen,
  VentilationAction,
  VentilationSimulationState,
  VentilatorControlKey,
  VentilatorWaveformChannel,
} from '../engine'
import {
  CONSOLE_KNOB_ID,
  CONSOLE_PENDING_CONFIRM_ID,
  consoleControlId,
  consoleHoldId,
  consoleModeId,
  consoleScreenId,
} from '../content/consoleControlIds'
import { buildConsoleNumericControls, type ConsoleNumericControl } from '../content/consoleControls'
import { ConsoleWaveformArea, type ConsoleInspection } from './ConsoleWaveformArea'
import { WaveformLoops, WaveformStrip, type WaveformReadout } from './WaveformStrip'
import styles from './mechanical-ventilation.module.css'

/** How this simulator names each flow pattern, and the fallback set for an unsourced device. */
const flowPatternLabels: Record<FlowPattern, string> = {
  square: 'Square',
  'decelerating-50': '50% decelerating',
  sine: 'Sine',
  'decelerating-100': '100% decelerating',
}
const allFlowPatterns = Object.keys(flowPatternLabels) as FlowPattern[]

export type { ConsoleInspection } from './ConsoleWaveformArea'

interface MechanicalVentilatorConsoleProps {
  state: VentilationSimulationState
  dispatch: Dispatch<VentilationAction>
  controlsEnabled: boolean
  allowTeachingAnnotations?: boolean
  /** Independent measurement tasks must not expose an unacquired model plateau. */
  withholdUnacquiredPlateau?: boolean
  /**
   * `observe` shows the console exactly as it is and lets the learner move between its screens, but
   * changes nothing the patient receives: every therapy control is disabled. The Learn stage uses it
   * on reading and explanation steps, so the one console on the page is never a second place to
   * act. Defaults to `operate`.
   */
  mode?: 'operate' | 'observe'
  /**
   * The control "Show me where" points at, by its id from `content/consoleControlIds.ts`. The
   * element carrying that id is marked `data-guided-help` and highlighted; nothing else changes.
   */
  guidedControlId?: string | null
  /**
   * A frozen breath to draw in place of the live traces on the main screen: the captured baseline
   * a question is asked about, or the learner's own last breath while paused. The host owns which
   * samples; the console owns where they are drawn.
   */
  inspection?: ConsoleInspection | null
  /** The pending edit on a knob-and-confirm console, or null once it is confirmed or cancelled. */
  onPendingChange?: (pending: ConsolePendingSetting | null) => void
}

type NumericControl = ConsoleNumericControl

export interface ConsolePendingSetting {
  key: VentilatorControlKey
  value: number | string | boolean
  label: string
  displayValue: string
  unit?: string
  nativeNumeric: boolean
}

function NumericControlTile({
  control,
  selected,
  disabled,
  guided,
  onSelect,
  onChange,
}: {
  control: NumericControl
  selected: boolean
  disabled: boolean
  guided?: boolean
  onSelect: () => void
  onChange: (value: number) => void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? 1 : -1
    onChange(control.value + control.step * direction)
  }
  return (
    <button
      type="button"
      id={consoleControlId(control.key)}
      className={styles.controlTile}
      data-selected={selected}
      data-guided-help={guided || undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${control.label}, ${control.value} ${control.unit}. Select for press-and-turn adjustment.`}
    >
      <span>{control.label}</span>
      <strong>{control.value}</strong>
      <small>{control.unit}</small>
    </button>
  )
}

/**
 * The monitored numbers, in the arrangement the device puts them in: a column of large values
 * beside the waveforms on the Evita, compact labelled tiles on the C6 and AVEA.
 */
function MonitorPanel({
  state,
  display,
}: {
  state: VentilationSimulationState
  display: VentilatorDisplayProfile
}) {
  return (
    <section
      className={styles.mmpPanel}
      data-native-monitor
      data-layout={display.monitorLayout}
      aria-label={display.monitorLabel}
    >
      <div className={styles.mmpValues}>
        {display.monitorFields.map((field) => (
          <div key={field.metric}>
            <span>{field.label}</span>
            <strong>{formatMonitorField(state, field)}</strong>
            <small>{field.unit}</small>
          </div>
        ))}
      </div>
      {display.monitorFooter?.length ? (
        <div className={styles.mmpFooter}>
          {display.monitorFooter.map((field) => (
            <div key={field.metric}>
              <span>{field.label}</span>
              <strong>{formatMonitorField(state, field)}</strong>
              <small>{field.unit}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The PB980 patient-data banner: a horizontal strip across the top of the screen, opened by the
 * Control / Assist / Spontaneous breath-phase letter.
 */
function MonitorBanner({
  state,
  display,
}: {
  state: VentilationSimulationState
  display: VentilatorDisplayProfile
}) {
  const phase = resolveBreathPhase(state)
  return (
    <div className={styles.patientDataBanner} aria-label={display.monitorLabel}>
      {display.showBreathPhase ? (
        <span
          className={styles.breathPhase}
          data-phase={phase.code}
          aria-label={`Breath phase ${phase.label}`}
        >
          {phase.code}
        </span>
      ) : null}
      {display.monitorFields.map((field) => (
        <div key={field.metric}>
          <span>{field.label}</span>
          <strong>{formatMonitorField(state, field)}</strong>
        </div>
      ))}
    </div>
  )
}

function DynamicLungPanel({
  state,
  pressureUnit,
}: {
  state: VentilationSimulationState
  pressureUnit: string
}) {
  const compliance = state.measurements.staticComplianceMlCmH2O
  const gapAcquisitionValue = plateauAcquisition(state)
  /*
   * The gap is peak minus the plateau the panel is entitled to claim — the acquired one when there
   * is a valid acquisition, and nothing at all otherwise. Subtracting the live estimate while
   * showing an acquisition label was the same split identity the pressure readouts had.
   */
  const resistanceGap = Math.max(
    0,
    state.measurements.peakPressureCmH2O -
      (gapAcquisitionValue.valueCmH2O ?? gapAcquisitionValue.estimateCmH2O),
  )
  /*
   * Peak minus plateau is the resistive gap only when the plateau is the elastic pressure. While
   * the patient is pulling it is not — and before anything has been occluded the plateau is an
   * estimate off the trace rather than a measurement, so the difference is not a measured split
   * either. The panel withholds the number in both cases rather than printing a gap the pressure
   * readouts two panes away have just marked uninterpretable.
   */
  const gapAcquisition = gapAcquisitionValue
  const gapIsAttributable = gapAcquisition.supportsMechanicsClaim
  const effort = state.patient.drive.effortAmplitudeCmH2O
  return (
    <section className={styles.dynamicLung} aria-label="Simplified dynamic lung panel">
      <div className={styles.lungGraphic} aria-hidden="true">
        <span className={styles.trachea} />
        <span className={styles.leftLung} data-stiff={compliance < 25} />
        <span className={styles.rightLung} data-stiff={compliance < 25} />
        <span className={styles.effortBand} style={{ opacity: Math.min(1, effort / 14) }} />
      </div>
      <dl>
        <div>
          <dt>Compliance</dt>
          <dd>
            {compliance.toFixed(0)} mL/{pressureUnit}
          </dd>
        </div>
        <div>
          <dt>Resistive gap</dt>
          <dd>
            {gapIsAttributable ? (
              <>
                {resistanceGap.toFixed(0)} {pressureUnit}
              </>
            ) : (
              <>
                —{' '}
                {gapAcquisition.status === 'acquired-invalid'
                  ? 'while the patient is pulling'
                  : `plateau is an ${gapAcquisition.label}`}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Patient effort</dt>
          <dd>
            {effort.toFixed(0)} {pressureUnit}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * The word printed under the plateau value on every facsimile, one per acquisition state. Read from
 * the single projection in `plateauAcquisition.ts`; "not acquired" never reaches a readout, because
 * a surface that withholds the value drops the row.
 */
const PLATEAU_STATUS_WORD: Record<PlateauAcquisitionStatus, string> = {
  'reference-estimate': 'estimate',
  'not-acquired': 'not acquired',
  pending: 'hold running',
  'acquired-invalid': 'not valid',
  stale: 'outdated',
  'acquired-valid': 'measured',
}

export function MechanicalVentilatorConsole({
  state,
  dispatch,
  controlsEnabled,
  allowTeachingAnnotations = true,
  withholdUnacquiredPlateau = false,
  mode = 'operate',
  guidedControlId = null,
  inspection = null,
  onPendingChange,
}: MechanicalVentilatorConsoleProps) {
  const settings = state.ventilator.settings
  const profile = getVentilatorDeviceProfile(state.deviceId)
  const activeMode = getVentilatorModeDescriptor(state.deviceId, settings.deviceMode)
  const pendingMode = state.ventilator.pendingMode
    ? getVentilatorModeDescriptor(state.deviceId, state.ventilator.pendingMode)
    : null
  const activeFeatures = profile.features.filter((feature) =>
    feature.compatibleModes.includes(settings.deviceMode),
  )
  const screenItems: readonly { id: VentilatorScreen; label: string }[] = (
    ['main', 'modes', 'controls', 'alarms', 'graphics', 'tools'] as const
  ).map((id) => ({ id, label: profile.navigationLabels[id] }))
  const [activeControlKey, setActiveControlKey] = useState<VentilatorControlKey>('peepCmH2O')
  const [pendingControl, setPendingControl] = useState<ConsolePendingSetting | null>(null)
  const observing = mode === 'observe'
  const therapyDisabled = !controlsEnabled || state.ventilator.locked || observing
  const guided = (id: string) => (guidedControlId === id ? true : undefined)

  // An observing console holds no half-made edit: there is nothing it could be confirmed with.
  const [wasObserving, setWasObserving] = useState(observing)
  if (wasObserving !== observing) {
    setWasObserving(observing)
    if (observing) setPendingControl(null)
  }

  // The host says what the console is waiting for ("Pending PEEP 10 — confirm on the console").
  useEffect(() => {
    onPendingChange?.(pendingControl)
  }, [onPendingChange, pendingControl])

  useEffect(() => {
    if (state.deviceId !== 'carefusion-avea' || !pendingControl) return
    const timeout = window.setTimeout(() => setPendingControl(null), 15_000)
    return () => window.clearTimeout(timeout)
  }, [pendingControl, state.deviceId])

  const numericControls = useMemo(
    () => buildConsoleNumericControls(state.deviceId, settings),
    [settings, state.deviceId],
  )

  const displayedControls = numericControls.map((control) =>
    pendingControl?.key === control.key && typeof pendingControl.value === 'number'
      ? { ...control, value: pendingControl.value }
      : control,
  )

  const activeControl =
    displayedControls.find((control) => control.key === activeControlKey) ?? displayedControls[0]

  const changeControl = (control: NumericControl, value: number) => {
    if (therapyDisabled) return
    const bounded = Math.min(control.maximum, Math.max(control.minimum, value))
    const rounded = Math.round(bounded / control.step) * control.step
    const nativeValue = Number(rounded.toFixed(2))
    if (profile.commitBehavior !== 'immediate') {
      setPendingControl({
        key: control.key,
        value: nativeValue,
        label: control.label,
        displayValue: String(nativeValue),
        unit: control.unit,
        nativeNumeric: true,
      })
      return
    }
    const canonicalValue = nativeToCanonicalControlValue(
      state.deviceId,
      settings,
      control.key,
      nativeValue,
    )
    dispatch({
      type: 'SET_CONTROL',
      control: control.key,
      value: Number(canonicalValue.toFixed(2)),
    })
  }

  const commitPendingControl = () => {
    if (!pendingControl || therapyDisabled) return
    const canonicalValue =
      pendingControl.nativeNumeric && typeof pendingControl.value === 'number'
        ? Number(
            nativeToCanonicalControlValue(
              state.deviceId,
              settings,
              pendingControl.key,
              pendingControl.value,
            ).toFixed(2),
          )
        : pendingControl.value
    dispatch({
      type: 'SET_CONTROL',
      control: pendingControl.key,
      value: canonicalValue,
    })
    setPendingControl(null)
  }

  const changeDiscreteControl = (
    key: VentilatorControlKey,
    value: string | boolean,
    label: string,
    displayValue: string,
  ) => {
    if (profile.commitBehavior === 'immediate') {
      dispatch({ type: 'SET_CONTROL', control: key, value })
      return
    }
    setPendingControl({
      key,
      value,
      label,
      displayValue,
      nativeNumeric: false,
    })
  }

  const selectControl = (key: VentilatorControlKey) => {
    if (
      state.deviceId === 'carefusion-avea' &&
      pendingControl?.key === key &&
      pendingControl.nativeNumeric
    ) {
      commitPendingControl()
      return
    }
    if (pendingControl && pendingControl.key !== key) setPendingControl(null)
    setActiveControlKey(key)
  }

  const adjustActive = (direction: -1 | 1) => {
    if (!activeControl) return
    changeControl(activeControl, activeControl.value + activeControl.step * direction)
  }

  const activeAlarm = state.alarms[0]
  const screen = state.ventilator.screen
  const latest = state.waveforms.at(-1)
  const display = profile.display
  const pressureNames = display.pressureLabels
  /*
   * A plateau read while the patient is pulling is not the elastic pressure of the respiratory
   * system, so the console marks it rather than pretending otherwise. The device would show the
   * number either way; the learner is the one who has to know it is not usable.
   */
  const plateauValidity = plateauReadingValidity(state)
  /*
   * Two separate questions, and the console used to answer only one of them.
   *
   * `plateauValidity` says whether the patient was quiet; `plateauAcquisition` says whether
   * anything was occluded. Every case opened printing "measured Pplateau 14" with no hold behind
   * it, because the estimate the model publishes on every breath and a measured plateau were the
   * same number on this screen. The value still shows — a real ventilator shows one — but what it
   * is called now comes from the acquisition projection, and the elastic/resistive attribution is
   * made only when a valid occlusion produced it.
   */
  const plateauAcquired = plateauAcquisition(state)
  const plateauUnreliable = !plateauAcquired.supportsMechanicsClaim
  /*
   * One number for one identity. `plateauAcquired.valueCmH2O` is what the console prints wherever
   * it also prints an acquisition label: when a hold has been acquired it is that hold's own
   * reading, and otherwise it is the live estimate the projection carries. Printing
   * `measurements.plateauPressureCmH2O` here is what put roughly 26 on screen beside a hold record
   * of roughly 24.5 and called the 26 "measured during the hold".
   */
  const plateauShown = plateauAcquired.valueCmH2O ?? plateauAcquired.estimateCmH2O
  const pressureReadouts: WaveformReadout[] = [
    { label: pressureNames.peak, value: state.measurements.peakPressureCmH2O },
    {
      label: pressureNames.plateau,
      value: plateauShown,
      unreliable: plateauUnreliable,
      /*
       * Both reasons when both apply. Acquisition and passivity are independent, and a learner
       * reading "estimate from the trace" on a patient who is also pulling needs to hear the
       * second half as well.
       */
      caveat: plateauUnreliable
        ? plateauValidity.interpretable
          ? plateauAcquired.label
          : `${plateauAcquired.label}; ${plateauWithheldNote(plateauValidity)}`
        : undefined,
      status: PLATEAU_STATUS_WORD[plateauAcquired.status],
      statusDetail: plateauAcquired.detail,
    },
    { label: pressureNames.mean, value: state.measurements.meanAirwayPressureCmH2O },
    { label: pressureNames.peep, value: settings.peepCmH2O },
  ].filter((reading) => !withholdUnacquiredPlateau || reading.label !== pressureNames.plateau)
  /*
   * The annotations name what each level *is*. While the patient is pulling, the plateau is not the
   * elastic load and the gap to peak is not the resistive one, so those two labels state the level
   * without the attribution — otherwise the trace annotation contradicts the caveat printed on the
   * readout beside it, in the same render.
   */
  /*
   * `marker` is what fits beside the line it marks; `label` is the whole sentence, which goes to
   * the waveform text equivalent below the console and to the trace's own screen-reader caption.
   * Splitting them is a display decision only — no word of either clause changed.
   */
  const pressureAnnotations = [
    {
      id: 'peak',
      marker: `${pressureNames.peak} ${state.measurements.peakPressureCmH2O.toFixed(0)}`,
      label: `${pressureNames.peak} ${state.measurements.peakPressureCmH2O.toFixed(0)}${
        plateauUnreliable ? '' : ' — resistive + elastic'
      }`,
      value: state.measurements.peakPressureCmH2O,
    },
    {
      id: 'plateau',
      marker: `${pressureNames.plateau} ${plateauShown.toFixed(0)}`,
      label: `${pressureNames.plateau} ${plateauShown.toFixed(0)} — ${
        plateauAcquired.supportsMechanicsClaim
          ? 'elastic load only; gap to peak is resistive'
          : !plateauValidity.interpretable
            ? `${plateauAcquired.label}; depressed by the patient’s own effort, so the gap to peak is not purely resistive`
            : `${plateauAcquired.label}; the gap to peak cannot be read as resistive until a hold is acquired`
      }`,
      value: plateauShown,
    },
    {
      id: 'peep',
      marker: `${pressureNames.peep} ${settings.peepCmH2O.toFixed(0)}`,
      label: `${pressureNames.peep} ${settings.peepCmH2O.toFixed(0)} — baseline the breath starts from`,
      value: settings.peepCmH2O,
    },
  ]

  const holdActive =
    state.ventilator.holdUntil !== null && state.ventilator.holdUntil > state.simulationTime
  // An occlusion holds the trace still, so the reference levels can be named without chasing a
  // moving line — and naming the plateau during the hold is the point of it.
  const annotationsVisible = allowTeachingAnnotations && (state.paused || holdActive)
  const holdSecondsRemaining = holdActive
    ? Math.max(0, (state.ventilator.holdUntil as number) - state.simulationTime)
    : 0

  /*
   * One channel of the vendor's trace stack. The pressure trace carries the derived readouts and,
   * while the trace is not moving, the component labels; the others draw plain. Extracted so the
   * Tools screen can show the trace a maneuver draws on without duplicating the profile plumbing.
   */
  const renderWaveformChannel = (channel: VentilatorWaveformChannel) =>
    channel.field === 'pawCmH2O' ? (
      <WaveformStrip
        key={channel.field}
        samples={state.waveforms}
        field={channel.field}
        label={channel.label}
        unit={channel.unit}
        minimum={channel.minimum}
        maximum={channel.maximum}
        color={channel.color}
        showPmus={allowTeachingAnnotations && state.showEducatorOverlay}
        readouts={pressureReadouts}
        annotationsVisible={annotationsVisible}
        annotations={pressureAnnotations}
      />
    ) : (
      <WaveformStrip
        key={channel.field}
        samples={state.waveforms}
        field={channel.field}
        label={channel.label}
        unit={channel.unit}
        minimum={channel.minimum}
        maximum={channel.maximum}
        color={channel.color}
      />
    )

  /*
   * Pressure and flow are what a hold is read from: pressure settles onto the plateau, flow sits
   * at zero for as long as the valves stay closed. Volume adds nothing to the maneuver, so the
   * Tools screen carries two traces and leaves the third on the monitoring screen.
   */
  const maneuverChannels = display.waveforms.filter(
    (channel) => channel.field === 'pawCmH2O' || channel.field === 'flowLMin',
  )

  const renderBezelKey = (key: VentilatorBezelKey) => {
    switch (key.action) {
      case 'manual-breath':
        return (
          <button
            key={key.action}
            type="button"
            disabled={therapyDisabled}
            onClick={() => dispatch({ type: 'MANUAL_BREATH' })}
          >
            <Wind aria-hidden="true" /> {key.label}
          </button>
        )
      case 'inspiratory-hold':
      case 'expiratory-hold':
        return (
          <button
            key={key.action}
            type="button"
            disabled={therapyDisabled}
            onClick={() =>
              dispatch({
                type: 'PERFORM_HOLD',
                hold: key.action === 'inspiratory-hold' ? 'inspiratory' : 'expiratory',
              })
            }
          >
            <Hand aria-hidden="true" /> {key.label}
          </button>
        )
      case 'alarm-reset':
        return (
          <button key={key.action} type="button" onClick={() => dispatch({ type: 'ACK_ALARM' })}>
            <BellRing aria-hidden="true" /> {key.label}
          </button>
        )
      case 'alarm-silence':
        return (
          <button
            key={key.action}
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_ALARM_AUDIO' })}
          >
            {state.ventilator.alarmAudioEnabled ? (
              <Volume2 aria-hidden="true" />
            ) : (
              <VolumeX aria-hidden="true" />
            )}{' '}
            {key.label}
          </button>
        )
      case 'oxygen-enrichment':
        return (
          <button
            key={key.action}
            type="button"
            aria-label={key.label}
            disabled={therapyDisabled}
            onClick={() => dispatch({ type: 'OXYGEN_ENRICHMENT' })}
          >
            <span aria-hidden="true">O₂</span> {key.label}
          </button>
        )
      case 'screen-lock':
        return (
          <button key={key.action} type="button" onClick={() => dispatch({ type: 'TOGGLE_LOCK' })}>
            <LockKeyhole aria-hidden="true" /> {state.ventilator.locked ? 'Unlock' : key.label}
          </button>
        )
    }
  }

  const bezelBeforeKnob = display.bezelKeys.slice(0, display.knobPosition)
  const bezelAfterKnob = display.bezelKeys.slice(display.knobPosition)
  const lockOnBezel = display.bezelKeys.some((key) => key.action === 'screen-lock')
  // A device that publishes its own set offers only those; the rest keep the simulator's four.
  const flowPatternOptions = display.flowPatterns ?? allFlowPatterns

  return (
    <section
      className={styles.consoleShell}
      data-device={state.deviceId}
      data-console-mode={mode}
      aria-label={`${profile.displayName} functional training facsimile`}
    >
      <div className={styles.consoleBezel}>
        <header className={styles.consoleHeader}>
          <div>
            <span className={styles.consoleModel}>{profile.shortName} TRAINING</span>
            <span>
              {profile.patientGroup} · {activeMode.label}
            </span>
          </div>
          <div className={styles.consoleStatus}>
            {state.ventilator.frozen ? (
              <Snowflake aria-label="Waveforms frozen" />
            ) : (
              <Activity aria-label="Waveforms live" />
            )}
            {state.ventilator.locked ? <LockKeyhole aria-label="Screen locked" /> : null}
            <span>{state.simulationTime.toFixed(0)} s</span>
          </div>
        </header>

        <div
          className={styles.alarmBar}
          data-priority={activeAlarm?.priority ?? 'none'}
          role="status"
          aria-live="polite"
        >
          {activeAlarm ? (
            <>
              <BellRing aria-hidden="true" />
              <strong>{activeAlarm.priority.toUpperCase()}</strong>
              <span>{activeAlarm.message}</span>
              {activeAlarm.acknowledgedAt !== undefined ? <small>ACK</small> : null}
            </>
          ) : (
            <>
              <ShieldCheck aria-hidden="true" />
              <span>No active alarm</span>
            </>
          )}
        </div>

        <div className={styles.consoleScreen}>
          {screen === 'main' ? (
            <div className={styles.monitoringScreen} data-layout={display.monitorLayout}>
              {display.monitorLayout === 'top-banner' ? (
                <MonitorBanner state={state} display={display} />
              ) : null}
              {display.monitorLayout === 'left-column' ? (
                <MonitorPanel state={state} display={display} />
              ) : null}
              {/*
               * Trace order, axis legends, and default scales come from the device profile: the
               * AVEA labels its volume trace Vt and runs Paw from -40, the Evita prints mbar.
               * A single instantaneous Paw sat at PEEP for most of the cycle, so it read as a
               * broken number beside the peak. The pressure trace keeps the derived pressures a
               * real console shows, under that vendor's abbreviations. While a breath is frozen
               * for inspection, the same slot draws that breath instead.
               */}
              <ConsoleWaveformArea
                className={styles.waveformStack}
                deviceId={state.deviceId}
                inspection={inspection}
              >
                {display.waveforms.map(renderWaveformChannel)}
              </ConsoleWaveformArea>
              {display.monitorLayout === 'right-column' ||
              display.monitorLayout === 'right-tiles' ? (
                <MonitorPanel state={state} display={display} />
              ) : null}
            </div>
          ) : null}

          {screen === 'modes' ? (
            <div className={styles.menuScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <span>Modes</span>
                  <h3>Select ventilation mode</h3>
                </div>
                <small>Changes apply after confirmation at a breath boundary.</small>
              </div>
              <div className={styles.modeGrid}>
                {profile.modes.map((candidate) => (
                  <button
                    key={candidate.id}
                    id={consoleModeId(candidate.id)}
                    type="button"
                    className={styles.modeCard}
                    data-selected={
                      state.ventilator.pendingMode === candidate.id ||
                      (!state.ventilator.pendingMode && settings.deviceMode === candidate.id)
                    }
                    data-guided-help={guided(consoleModeId(candidate.id))}
                    data-availability={candidate.availability}
                    aria-pressed={state.ventilator.pendingMode === candidate.id}
                    disabled={therapyDisabled || candidate.availability !== 'simulated'}
                    onClick={() => dispatch({ type: 'SELECT_MODE', mode: candidate.id })}
                  >
                    <strong>{candidate.label}</strong>
                    <span>{candidate.description}</span>
                    {candidate.availability !== 'simulated' ? (
                      <small>{candidate.availabilityNote ?? 'Source-listed only'}</small>
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.confirmModeButton}
                disabled={!state.ventilator.pendingMode || therapyDisabled}
                onClick={() => dispatch({ type: 'CONFIRM_MODE' })}
              >
                {state.deviceId === 'carefusion-avea' ? 'MODE ACCEPT ' : 'Confirm '}
                {pendingMode?.label ?? 'mode'}
              </button>
              {profile.deferredModes.length ? (
                <p className={styles.deviceNote}>
                  Additional source-listed modes outside this release:{' '}
                  {profile.deferredModes.join(', ')}.
                </p>
              ) : null}
            </div>
          ) : null}

          {screen === 'controls' ? (
            <div className={styles.menuScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <span>Controls</span>
                  <h3>{activeMode.label} settings</h3>
                </div>
                <small>Select a tile, then use the physical knob or arrow keys.</small>
              </div>
              {display.controlGroups?.length ? (
                <p className={styles.controlGroupNote} data-control-group-note>
                  {VENTILATOR_CONTROL_GROUP_NOTE}
                </p>
              ) : null}
              {groupControlsForDevice(display, displayedControls).map((group) => (
                <section key={group.label || 'controls'} className={styles.controlGroup}>
                  {group.label ? <h4>{group.label}</h4> : null}
                  <div className={styles.controlGrid}>
                    {group.controls.map((control) => (
                      <NumericControlTile
                        key={control.key}
                        control={control}
                        selected={activeControl?.key === control.key}
                        disabled={therapyDisabled}
                        guided={guided(consoleControlId(control.key))}
                        onSelect={() => selectControl(control.key)}
                        onChange={(value) => {
                          setActiveControlKey(control.key)
                          changeControl(control, value)
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {activeControl?.rangeNote ? (
                <p className={styles.deviceNote}>{activeControl.rangeNote}</p>
              ) : null}
              <div className={styles.inlineDeviceFields}>
                <label>
                  Trigger type
                  <select
                    value={settings.trigger.type}
                    disabled={therapyDisabled}
                    onChange={(event) =>
                      changeDiscreteControl(
                        'triggerType',
                        event.target.value,
                        'Trigger type',
                        event.target.options[event.target.selectedIndex]?.text ??
                          event.target.value,
                      )
                    }
                  >
                    <option value="flow">Flow</option>
                    <option value="pressure">Pressure</option>
                  </select>
                </label>
                {settings.mode === 'volume-ac' && !settings.advanced.autoFlowEnabled ? (
                  <label>
                    Flow pattern
                    <select
                      value={settings.flowPattern}
                      disabled={therapyDisabled}
                      onChange={(event) =>
                        changeDiscreteControl(
                          'flowPattern',
                          event.target.value,
                          'Flow pattern',
                          event.target.options[event.target.selectedIndex]?.text ??
                            event.target.value,
                        )
                      }
                    >
                      {flowPatternOptions.map((pattern) => (
                        <option key={pattern} value={pattern}>
                          {flowPatternLabels[pattern]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {settings.mode === 'pressure-support' ? (
                  <label className={styles.checkField}>
                    <input
                      type="checkbox"
                      checked={settings.apneaBackupEnabled}
                      disabled={therapyDisabled}
                      onChange={(event) =>
                        changeDiscreteControl(
                          'apneaBackupEnabled',
                          event.target.checked,
                          `${profile.shortName} apnea backup`,
                          event.target.checked ? 'On' : 'Off',
                        )
                      }
                    />
                    {profile.shortName} apnea backup
                  </label>
                ) : null}
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={settings.trcEnabled}
                    disabled={therapyDisabled}
                    onChange={(event) =>
                      changeDiscreteControl(
                        'trcEnabled',
                        event.target.checked,
                        profile.controlLabels.trcEnabled ?? 'Tube compensation',
                        event.target.checked ? 'On' : 'Off',
                      )
                    }
                  />
                  {profile.controlLabels.trcEnabled ?? 'Tube compensation'}
                </label>
                {settings.deviceMode === 'intellivent-asv' ? (
                  <>
                    <label className={styles.checkField}>
                      <input
                        type="checkbox"
                        checked={settings.advanced.automaticVentilationController}
                        disabled={therapyDisabled}
                        onChange={(event) =>
                          changeDiscreteControl(
                            'automaticVentilationController',
                            event.target.checked,
                            'Ventilation controller',
                            event.target.checked ? 'Automatic' : 'Manual',
                          )
                        }
                      />
                      Automatic ventilation controller
                    </label>
                    <label className={styles.checkField}>
                      <input
                        type="checkbox"
                        checked={settings.advanced.automaticOxygenationController}
                        disabled={therapyDisabled}
                        onChange={(event) =>
                          changeDiscreteControl(
                            'automaticOxygenationController',
                            event.target.checked,
                            'Oxygenation controller',
                            event.target.checked ? 'Automatic' : 'Manual',
                          )
                        }
                      />
                      Automatic PEEP / Oxygen controller
                    </label>
                  </>
                ) : null}
              </div>
              {activeFeatures.length ? (
                <section className={styles.modeFeatures} aria-label="Mode features">
                  <h4>Mode features</h4>
                  {activeFeatures.map((feature) => {
                    const enabled =
                      feature.id === 'autoflow'
                        ? settings.advanced.autoFlowEnabled
                        : feature.id === 'intellisync-plus'
                          ? settings.advanced.intelliSyncEnabled
                          : false
                    const controlKey =
                      feature.id === 'autoflow'
                        ? ('autoFlowEnabled' as const)
                        : feature.id === 'intellisync-plus'
                          ? ('intelliSyncEnabled' as const)
                          : null
                    return (
                      <label
                        key={feature.id}
                        className={styles.featureField}
                        data-availability={feature.availability}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={
                            therapyDisabled || feature.availability !== 'simulated' || !controlKey
                          }
                          onChange={(event) => {
                            if (!controlKey) return
                            changeDiscreteControl(
                              controlKey,
                              event.target.checked,
                              feature.label,
                              event.target.checked ? 'On' : 'Off',
                            )
                          }}
                        />
                        <span>
                          <strong>{feature.label}</strong>
                          <small>{feature.description}</small>
                          {feature.availabilityNote ? <em>{feature.availabilityNote}</em> : null}
                        </span>
                      </label>
                    )
                  })}
                </section>
              ) : null}
            </div>
          ) : null}

          {screen === 'alarms' ? (
            <div className={styles.menuScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <span>Alarms</span>
                  <h3>Active messages and limits</h3>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ACK_ALARM' })}
                  disabled={!state.alarms.length}
                >
                  Acknowledge all
                </button>
              </div>
              <div className={styles.alarmList}>
                {state.alarms.length ? (
                  state.alarms.map((alarm) => (
                    <article key={alarm.id} data-priority={alarm.priority}>
                      <BellRing aria-hidden="true" />
                      <div>
                        <strong>{alarm.message}</strong>
                        <span>
                          {alarm.priority} priority · started {alarm.startedAt.toFixed(0)} s
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: alarm.id })}
                      >
                        {alarm.acknowledgedAt === undefined ? 'Acknowledge' : 'Acknowledged'}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className={styles.emptyState}>
                    No active alarm. Alarm history remains available during this case attempt.
                  </p>
                )}
              </div>
              <div className={styles.alarmLimitRow}>
                <NumericControlTile
                  control={displayedControls.find((item) => item.key === 'highPressureLimitCmH2O')!}
                  selected={activeControl?.key === 'highPressureLimitCmH2O'}
                  disabled={therapyDisabled}
                  guided={guided(consoleControlId('highPressureLimitCmH2O'))}
                  onSelect={() => selectControl('highPressureLimitCmH2O')}
                  onChange={(value) => {
                    setActiveControlKey('highPressureLimitCmH2O')
                    changeControl(
                      displayedControls.find((item) => item.key === 'highPressureLimitCmH2O')!,
                      value,
                    )
                  }}
                />
              </div>
            </div>
          ) : null}

          {screen === 'graphics' ? (
            <div className={styles.graphicsScreen}>
              <WaveformLoops samples={state.waveforms} />
              {allowTeachingAnnotations ? (
                <DynamicLungPanel state={state} pressureUnit={display.pressureUnit} />
              ) : null}
            </div>
          ) : null}

          {screen === 'tools' ? (
            /*
             * The maneuver and the trace it draws on sit side by side. Performing a hold used to
             * mean leaving the monitoring screen, so the occlusion and the plateau happened while
             * the learner was looking at a menu and had to navigate back to find them. Every one
             * of these devices keeps its waveforms on screen while a maneuver runs — the C6's
             * Tools > Maneuvers, the Evita's Procedures drawer, the PB980's bezel pause keys.
             */
            <div className={styles.toolsScreen}>
              <div className={styles.waveformStack}>
                {maneuverChannels.map(renderWaveformChannel)}
              </div>
              <div className={styles.toolsPanel}>
                <div className={styles.screenHeading}>
                  <div>
                    <span>Tools</span>
                    <h3>Maneuvers and utilities</h3>
                  </div>
                  <small>All values and maneuvers are simulated.</small>
                </div>
                <p
                  className={styles.maneuverStatus}
                  data-active={holdActive}
                  role="status"
                  aria-live="polite"
                >
                  {holdActive ? (
                    <>
                      <strong>
                        Occluding at end-
                        {state.ventilator.holdType === 'inspiratory' ? 'inspiration' : 'expiration'}
                      </strong>
                      <span>
                        {holdSecondsRemaining.toFixed(0)} s remaining · flow is zero, so the
                        pressure on the trace is{' '}
                        {state.ventilator.holdType === 'inspiratory'
                          ? `${pressureNames.plateau}, the elastic load alone`
                          : 'the total PEEP the lung equilibrates to'}
                        {state.ventilator.holdType === 'inspiratory' && plateauUnreliable
                          ? ' — but only in a relaxed patient. This one is still pulling, so what the trace settles on is the alveolar pressure minus their effort, and it will move as that effort does.'
                          : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>No maneuver running</strong>
                      <span>
                        A hold waits for its own point in the breath — end-inspiration or
                        end-expiration — before it closes the valves. Watch the trace above for
                        where it lands.
                      </span>
                    </>
                  )}
                </p>
                <div className={styles.toolGrid}>
                  <button
                    type="button"
                    id={consoleHoldId('inspiratory')}
                    data-guided-help={guided(consoleHoldId('inspiratory'))}
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'PERFORM_HOLD', hold: 'inspiratory' })}
                  >
                    <Hand aria-hidden="true" /> Inspiratory hold
                  </button>
                  <button
                    type="button"
                    id={consoleHoldId('expiratory')}
                    data-guided-help={guided(consoleHoldId('expiratory'))}
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'PERFORM_HOLD', hold: 'expiratory' })}
                  >
                    <Hand aria-hidden="true" /> Expiratory hold
                  </button>
                  <button
                    type="button"
                    disabled={!controlsEnabled}
                    onClick={() => dispatch({ type: 'TOGGLE_FREEZE' })}
                  >
                    <Snowflake aria-hidden="true" />{' '}
                    {state.ventilator.frozen ? 'Unfreeze waveforms' : 'Freeze waveforms'}
                  </button>
                  <button
                    type="button"
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'MANUAL_BREATH' })}
                  >
                    <Wind aria-hidden="true" /> Manual breath
                  </button>
                  <button
                    type="button"
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'OXYGEN_ENRICHMENT' })}
                  >
                    <span aria-hidden="true">O₂</span> O₂ enrichment / suction
                  </button>
                  <button type="button" onClick={() => dispatch({ type: 'TOGGLE_ALARM_AUDIO' })}>
                    {state.ventilator.alarmAudioEnabled ? (
                      <Volume2 aria-hidden="true" />
                    ) : (
                      <VolumeX aria-hidden="true" />
                    )}
                    Alarm audio {state.ventilator.alarmAudioEnabled ? 'on' : 'off'}
                  </button>
                  {/* Devices whose real bezel has no lock key still need the screen lock reachable. */}
                  {lockOnBezel ? null : (
                    <button type="button" onClick={() => dispatch({ type: 'TOGGLE_LOCK' })}>
                      <LockKeyhole aria-hidden="true" />{' '}
                      {state.ventilator.locked ? 'Unlock screen' : 'Lock screen'}
                    </button>
                  )}
                </div>
                <p className={styles.deviceNote}>
                  Bedside actions here are simulated: choosing one shows its effect on this patient.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <nav className={styles.consoleNav} aria-label={`${profile.shortName} screen navigation`}>
          {screenItems.map((item) => (
            <button
              type="button"
              key={item.id}
              id={consoleScreenId(item.id)}
              aria-label={item.label}
              aria-current={screen === item.id ? 'page' : undefined}
              data-guided-help={guided(consoleScreenId(item.id))}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: item.id })}
            >
              {item.id === 'main' ? <MonitorUp aria-hidden="true" /> : null}
              {item.id === 'modes' ? <Wind aria-hidden="true" /> : null}
              {item.id === 'controls' ? <Settings2 aria-hidden="true" /> : null}
              {item.id === 'alarms' ? <AlarmClock aria-hidden="true" /> : null}
              {item.id === 'graphics' ? <Gauge aria-hidden="true" /> : null}
              {item.id === 'tools' ? <MousePointer2 aria-hidden="true" /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {pendingControl ? (
        <div className={styles.pendingControlBar} role="status" aria-live="polite">
          <div>
            <span>Pending {pendingControl.label}</span>
            <strong>
              {pendingControl.displayValue} {pendingControl.unit}
            </strong>
          </div>
          <button
            type="button"
            id={CONSOLE_PENDING_CONFIRM_ID}
            data-guided-help={guided(CONSOLE_PENDING_CONFIRM_ID)}
            disabled={therapyDisabled}
            onClick={commitPendingControl}
          >
            {state.deviceId === 'carefusion-avea' ? 'ACCEPT' : 'Press knob to confirm'}
          </button>
          <button type="button" onClick={() => setPendingControl(null)}>
            CANCEL
          </button>
        </div>
      ) : null}

      {/*
       * Off-screen keys come from the device profile, in the vendor's own order and legend. The
       * PB980 straddles its rotary encoder with four keys either side; the Evita display unit
       * carries only alarm silence, and puts its maneuvers on screen under Procedures.
       */}
      <div className={styles.physicalControls} aria-label={`${profile.shortName} bezel keys`}>
        {bezelBeforeKnob.map(renderBezelKey)}
        <div className={styles.rotaryControl} aria-label="Press-and-turn control">
          <button
            type="button"
            aria-label="Decrease selected control"
            disabled={therapyDisabled}
            onClick={() => adjustActive(-1)}
          >
            −
          </button>
          <button
            type="button"
            id={CONSOLE_KNOB_ID}
            className={styles.rotaryKnob}
            data-guided-help={guided(CONSOLE_KNOB_ID)}
            disabled={therapyDisabled}
            onClick={() =>
              pendingControl
                ? commitPendingControl()
                : dispatch({ type: 'SET_SCREEN', screen: 'controls' })
            }
          >
            <span>{activeControl?.label ?? 'Control'}</span>
            <strong>{activeControl?.value ?? '—'}</strong>
            <small>
              {profile.commitBehavior === 'immediate' ? 'press / turn' : 'turn / confirm'}
            </small>
          </button>
          <button
            type="button"
            aria-label="Increase selected control"
            disabled={therapyDisabled}
            onClick={() => adjustActive(1)}
          >
            +
          </button>
        </div>
        {bezelAfterKnob.map(renderBezelKey)}
      </div>

      <p className={styles.waveformTextEquivalent} aria-live="off">
        Waveform text:{' '}
        {display.waveforms
          .map((channel) => {
            const sample = latest?.[channel.field]
            const shown =
              sample === undefined ? '—' : sample.toFixed(channel.field === 'volumeMl' ? 0 : 1)
            return `${channel.label} ${shown} ${channel.unit}`
          })
          .join('; ')}
        {withholdUnacquiredPlateau
          ? '; plateau pressure has not been acquired'
          : plateauAcquired.supportsMechanicsClaim
            ? `; measured ${pressureNames.plateau} ${plateauShown.toFixed(0)} ${display.pressureUnit}, ${plateauAcquisitionNote(plateauAcquired)}`
            : `; ${pressureNames.plateau} ${plateauShown.toFixed(0)} ${display.pressureUnit} — ${plateauAcquired.label}`}
        {/*
         * The readout beside the trace prints the acquisition state as a word under the plateau
         * value ("estimate", "measured", "not valid", "outdated", "hold running"); it used to be a
         * bare "?" with no legend. The trace's own caption — screen-reader only — carries the full
         * clause, and so does this visible text equivalent, including the effort reason a
         * one-word status has no room for.
         */}
        {!withholdUnacquiredPlateau && !plateauValidity.interpretable
          ? ` — ${plateauWithheldNote(plateauValidity)}`
          : ''}
        ; intrinsic PEEP {state.measurements.intrinsicPeepCmH2O.toFixed(1)} {display.pressureUnit}.
        {/*
         * While the trace is held still it carries labelled reference levels. The trace itself only
         * has room beside each line for the name and the value, so what each level *is* is stated
         * here, in the surface that already exists as this console's visible text equivalent. No
         * new block, so pausing does not resize the screen or add a scroll container.
         */}
        {annotationsVisible ? (
          <>
            {' '}
            {holdActive ? 'Held trace' : 'Frozen trace'}, labelled levels:{' '}
            {pressureAnnotations.map((annotation) => annotation.label).join('; ')}.
          </>
        ) : null}
      </p>
    </section>
  )
}
