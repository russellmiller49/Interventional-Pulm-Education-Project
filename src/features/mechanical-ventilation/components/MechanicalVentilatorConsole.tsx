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
  adaptControlDescriptor,
  canonicalToNativeControlValue,
  formatMonitorField,
  getVentilatorDeviceProfile,
  getVentilatorModeDescriptor,
  groupControlsForDevice,
  nativeToCanonicalControlValue,
  orderControlsForDevice,
  resolveBreathPhase,
} from '../content'
import {
  isAdaptivePressureMode,
  isAdaptiveSupportMode,
  isSimvMode,
  isTwoLevelMode,
} from '../engine'
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
import { WaveformLoops, WaveformStrip } from './WaveformStrip'
import styles from './mechanical-ventilation.module.css'

/** How this simulator names each flow pattern, and the fallback set for an unsourced device. */
const flowPatternLabels: Record<FlowPattern, string> = {
  square: 'Square',
  'decelerating-50': '50% decelerating',
  sine: 'Sine',
  'decelerating-100': '100% decelerating',
}
const allFlowPatterns = Object.keys(flowPatternLabels) as FlowPattern[]

interface MechanicalVentilatorConsoleProps {
  state: VentilationSimulationState
  dispatch: Dispatch<VentilationAction>
  controlsEnabled: boolean
}

interface NumericControl {
  key: VentilatorControlKey
  label: string
  value: number
  unit: string
  minimum: number
  maximum: number
  step: number
  rangeNote?: string
}

interface PendingSetting {
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
  onSelect,
  onChange,
}: {
  control: NumericControl
  selected: boolean
  disabled: boolean
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
      className={styles.controlTile}
      data-selected={selected}
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
    <aside
      className={styles.mmpPanel}
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
    </aside>
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
  const resistanceGap = Math.max(
    0,
    state.measurements.peakPressureCmH2O - state.measurements.plateauPressureCmH2O,
  )
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
            {resistanceGap.toFixed(0)} {pressureUnit}
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

export function MechanicalVentilatorConsole({
  state,
  dispatch,
  controlsEnabled,
}: MechanicalVentilatorConsoleProps) {
  const settings = state.ventilator.settings
  const profile = getVentilatorDeviceProfile(state.deviceId)
  const activeMode = getVentilatorModeDescriptor(state.deviceId, settings.deviceMode)
  const pendingMode = state.ventilator.pendingMode
    ? getVentilatorModeDescriptor(state.deviceId, state.ventilator.pendingMode)
    : null
  const simvActive = isSimvMode(settings.deviceMode)
  const adaptivePressureActive = isAdaptivePressureMode(settings.deviceMode)
  const twoLevelActive = isTwoLevelMode(settings.deviceMode)
  const adaptiveSupportActive = isAdaptiveSupportMode(settings.deviceMode)
  const activeFeatures = profile.features.filter((feature) =>
    feature.compatibleModes.includes(settings.deviceMode),
  )
  const screenItems: readonly { id: VentilatorScreen; label: string }[] = (
    ['main', 'modes', 'controls', 'alarms', 'graphics', 'tools'] as const
  ).map((id) => ({ id, label: profile.navigationLabels[id] }))
  const [activeControlKey, setActiveControlKey] = useState<VentilatorControlKey>('peepCmH2O')
  const [pendingControl, setPendingControl] = useState<PendingSetting | null>(null)
  const therapyDisabled = !controlsEnabled || state.ventilator.locked

  useEffect(() => {
    if (state.deviceId !== 'carefusion-avea' || !pendingControl) return
    const timeout = window.setTimeout(() => setPendingControl(null), 15_000)
    return () => window.clearTimeout(timeout)
  }, [pendingControl, state.deviceId])

  const numericControls = useMemo<NumericControl[]>(() => {
    const controls: NumericControl[] = [
      {
        key: 'oxygenPercent',
        label: 'Oxygen',
        value: settings.oxygenPercent,
        unit: '%',
        minimum: 21,
        maximum: 100,
        step: 1,
      },
      {
        key: 'peepCmH2O',
        label: 'PEEP/CPAP',
        value: settings.peepCmH2O,
        unit: 'cmH₂O',
        minimum: 0,
        maximum: 30,
        step: 1,
      },
      {
        key: 'triggerThreshold',
        label: settings.trigger.type === 'flow' ? 'Flow trigger' : 'Pressure trigger',
        value:
          settings.trigger.type === 'flow'
            ? settings.trigger.thresholdLMin
            : settings.trigger.thresholdCmH2O,
        unit: settings.trigger.type === 'flow' ? 'L/min' : 'cmH₂O',
        minimum:
          settings.trigger.type === 'flow' ? (settings.mode === 'pressure-support' ? 0.5 : 1) : -15,
        maximum: settings.trigger.type === 'flow' ? 10 : -0.1,
        step: settings.trigger.type === 'flow' ? 0.5 : 0.5,
      },
      {
        key: 'highPressureLimitCmH2O',
        label: 'High pressure',
        value: settings.highPressureLimitCmH2O,
        unit: 'cmH₂O',
        minimum: 10,
        maximum: 80,
        step: 1,
      },
    ]
    if (settings.mode === 'volume-ac') {
      controls.splice(
        0,
        0,
        {
          key: 'vtMl',
          label: 'Vt',
          value: settings.vtMl,
          unit: 'mL',
          minimum: 100,
          maximum: 1000,
          step: 10,
        },
        {
          key: 'ratePerMin',
          label: 'Rate',
          value: settings.ratePerMin,
          unit: '/min',
          minimum: 4,
          maximum: 40,
          step: 1,
        },
      )
      if (!settings.advanced.autoFlowEnabled) {
        controls.splice(
          2,
          0,
          {
            key: 'peakFlowLMin',
            label: 'Peak flow',
            value: settings.peakFlowLMin,
            unit: 'L/min',
            minimum: 10,
            maximum: 150,
            step: 5,
          },
          {
            key: 'pausePercent',
            label: 'Tip pause',
            value: settings.pausePercent,
            unit: '%',
            minimum: 0,
            maximum: 50,
            step: 5,
          },
        )
      }
    }
    if (
      settings.mode === 'pressure-ac' &&
      !twoLevelActive &&
      !adaptiveSupportActive &&
      !adaptivePressureActive
    ) {
      controls.splice(
        0,
        0,
        {
          key: 'deltaPControlCmH2O',
          label: 'Pcontrol',
          value: settings.deltaPControlCmH2O,
          unit: 'cmH₂O',
          minimum: 5,
          maximum: 45,
          step: 1,
        },
        {
          key: 'ratePerMin',
          label: 'Rate',
          value: settings.ratePerMin,
          unit: '/min',
          minimum: 4,
          maximum: 40,
          step: 1,
        },
        {
          key: 'inspiratoryTimeSeconds',
          label: 'TI',
          value: settings.inspiratoryTimeSeconds,
          unit: 's',
          minimum: 0.2,
          maximum: 3,
          step: 0.1,
        },
        {
          key: 'pRampMs',
          label: 'P-ramp',
          value: settings.pRampMs,
          unit: 'ms',
          minimum: 0,
          maximum: Math.min(1000, Math.floor((settings.inspiratoryTimeSeconds * 1000) / 3)),
          step: 10,
        },
      )
    }
    if (adaptivePressureActive && settings.mode === 'pressure-ac') {
      controls.unshift(
        {
          key: 'ratePerMin',
          label: 'Rate',
          value: settings.ratePerMin,
          unit: '/min',
          minimum: 4,
          maximum: 40,
          step: 1,
        },
        {
          key: 'inspiratoryTimeSeconds',
          label: 'TI',
          value: settings.inspiratoryTimeSeconds,
          unit: 's',
          minimum: 0.2,
          maximum: 3,
          step: 0.1,
        },
        {
          key: 'pRampMs',
          label: 'P-ramp',
          value: settings.pRampMs,
          unit: 'ms',
          minimum: 0,
          maximum: Math.min(1000, Math.floor((settings.inspiratoryTimeSeconds * 1000) / 3)),
          step: 10,
        },
      )
    }
    if (
      settings.mode === 'pressure-support' &&
      settings.deviceMode !== 'proportional-assist' &&
      settings.deviceMode !== 'volume-support'
    ) {
      controls.splice(
        0,
        0,
        {
          key: 'pressureSupportCmH2O',
          label: 'Psupport',
          value: settings.pressureSupportCmH2O,
          unit: 'cmH₂O',
          minimum: 0,
          maximum: 30,
          step: 1,
        },
        {
          key: 'pRampMs',
          label: 'P-ramp',
          value: settings.pRampMs,
          unit: 'ms',
          minimum: 0,
          maximum: 200,
          step: 10,
        },
        {
          key: 'etsPercent',
          label: 'ETS',
          value: settings.etsPercent,
          unit: '%',
          minimum: 5,
          maximum: 80,
          step: 5,
        },
        {
          key: 'tiMaxSeconds',
          label: 'TI max',
          value: settings.tiMaxSeconds,
          unit: 's',
          minimum: 0.5,
          maximum: 3,
          step: 0.1,
        },
        {
          key: 'apneaRatePerMin',
          label: 'Apnea rate',
          value: settings.apneaRatePerMin,
          unit: '/min',
          minimum: 5,
          maximum: 30,
          step: 1,
        },
      )
    }
    if (adaptivePressureActive || settings.deviceMode === 'volume-support') {
      controls.unshift({
        key: 'targetVtMl',
        label: 'Target Vt',
        value: settings.advanced.targetVtMl,
        unit: 'mL',
        minimum: 100,
        maximum: 1000,
        step: 10,
      })
    }
    if (simvActive) {
      controls.push(
        {
          key: 'spontaneousPressureSupportCmH2O',
          label: 'Spontaneous PS',
          value: settings.advanced.spontaneousPressureSupportCmH2O,
          unit: 'cmH₂O',
          minimum: 0,
          maximum: 30,
          step: 1,
        },
        {
          key: 'spontaneousRampMs',
          label: 'Spontaneous rise',
          value: settings.advanced.spontaneousRampMs,
          unit: 'ms',
          minimum: 0,
          maximum: 2000,
          step: 10,
        },
        {
          key: 'spontaneousCyclePercent',
          label: 'Spontaneous cycle',
          value: settings.advanced.spontaneousCyclePercent,
          unit: '%',
          minimum: 5,
          maximum: 80,
          step: 5,
        },
      )
    }
    if (twoLevelActive) {
      controls.unshift(
        {
          key: 'pHighCmH2O',
          label: 'P high',
          value: settings.advanced.pHighCmH2O,
          unit: 'cmH₂O',
          minimum: 5,
          maximum: 50,
          step: 1,
        },
        {
          key: 'pLowCmH2O',
          label: 'P low',
          value: settings.advanced.pLowCmH2O,
          unit: 'cmH₂O',
          minimum: 0,
          maximum: 20,
          step: 1,
        },
        {
          key: 'tHighSeconds',
          label: 'T high',
          value: settings.advanced.tHighSeconds,
          unit: 's',
          minimum: 0.2,
          maximum: 15,
          step: 0.1,
        },
        {
          key: 'tLowSeconds',
          label: 'T low',
          value: settings.advanced.tLowSeconds,
          unit: 's',
          minimum: 0.1,
          maximum: 3,
          step: 0.1,
        },
        {
          key: 'spontaneousPressureSupportCmH2O',
          label: 'Spontaneous PS',
          value: settings.advanced.spontaneousPressureSupportCmH2O,
          unit: 'cmH₂O',
          minimum: 0,
          maximum: 30,
          step: 1,
        },
      )
    }
    if (settings.deviceMode === 'proportional-assist') {
      controls.unshift({
        key: 'proportionalSupportPercent',
        label: 'Proportional support',
        value: settings.advanced.proportionalSupportPercent,
        unit: '%',
        minimum: 5,
        maximum: 95,
        step: 5,
      })
    }
    if (adaptiveSupportActive) {
      controls.unshift({
        key: 'minuteVolumePercent',
        label: '%MinVol',
        value: settings.advanced.minuteVolumePercent,
        unit: '%',
        minimum: 25,
        maximum: 350,
        step: 5,
      })
    }
    if (settings.deviceMode === 'intellivent-asv') {
      controls.unshift(
        {
          key: 'targetSpO2LowPercent',
          label: 'Target SpO₂ low',
          value: settings.advanced.targetSpO2LowPercent,
          unit: '%',
          minimum: 85,
          maximum: 98,
          step: 1,
        },
        {
          key: 'targetPetCO2MmHg',
          label: 'Target PetCO₂',
          value: settings.advanced.targetPetCO2MmHg,
          unit: 'mm Hg',
          minimum: 25,
          maximum: 80,
          step: 1,
        },
      )
    }
    const adapted = controls.map((control) => {
      const descriptor = adaptControlDescriptor(state.deviceId, settings, control)
      const triggerLabel =
        control.key === 'triggerThreshold' && settings.trigger.type === 'pressure'
          ? 'Pressure trigger'
          : descriptor.label
      return {
        ...control,
        ...descriptor,
        label: triggerLabel,
        value: canonicalToNativeControlValue(state.deviceId, settings, control.key, control.value),
      }
    })
    // Each vendor presents the same settings in its own order — the Evita's therapy bar, the
    // AVEA's primary-control row, the C6's three purpose groups.
    return orderControlsForDevice(getVentilatorDeviceProfile(state.deviceId).display, adapted)
  }, [
    adaptivePressureActive,
    adaptiveSupportActive,
    settings,
    simvActive,
    state.deviceId,
    twoLevelActive,
  ])

  const displayedControls = numericControls.map((control) =>
    pendingControl?.key === control.key && typeof pendingControl.value === 'number'
      ? { ...control, value: pendingControl.value }
      : control,
  )

  const activeControl =
    displayedControls.find((control) => control.key === activeControlKey) ?? displayedControls[0]

  const changeControl = (control: NumericControl, value: number) => {
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
    if (!pendingControl) return
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
   * system, so the console prints it with a question mark rather than pretending otherwise. The
   * device would show the number either way; the learner is the one who has to know it is not
   * usable.
   */
  const plateauUnreliable = !state.measurements.plateauIsInterpretable
  const pressureReadouts = [
    { label: pressureNames.peak, value: state.measurements.peakPressureCmH2O },
    {
      label: pressureNames.plateau,
      value: state.measurements.plateauPressureCmH2O,
      unreliable: plateauUnreliable,
      caveat: plateauUnreliable
        ? `not interpretable: patient effort ${state.measurements.endInspiratoryEffortCmH2O.toFixed(0)} cmH₂O at end-inspiration`
        : undefined,
    },
    { label: pressureNames.mean, value: state.measurements.meanAirwayPressureCmH2O },
    { label: pressureNames.peep, value: settings.peepCmH2O },
  ]
  const pressureAnnotations = [
    {
      id: 'peak',
      label: `${pressureNames.peak} ${state.measurements.peakPressureCmH2O.toFixed(0)} — resistive + elastic`,
      value: state.measurements.peakPressureCmH2O,
    },
    {
      id: 'plateau',
      label: `${pressureNames.plateau} ${state.measurements.plateauPressureCmH2O.toFixed(0)} — elastic load only; gap to peak is resistive`,
      value: state.measurements.plateauPressureCmH2O,
    },
    {
      id: 'peep',
      label: `${pressureNames.peep} ${settings.peepCmH2O.toFixed(0)} — baseline the breath starts from`,
      value: settings.peepCmH2O,
    },
  ]

  const holdActive =
    state.ventilator.holdUntil !== null && state.ventilator.holdUntil > state.simulationTime
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
        showPmus={state.showEducatorOverlay}
        readouts={pressureReadouts}
        // An occlusion holds the trace still, so the reference levels can be named without
        // chasing a moving line — and naming the plateau during the hold is the point of it.
        annotationsVisible={state.paused || holdActive}
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
              <div className={styles.waveformStack}>
                {/*
                 * Trace order, axis legends, and default scales come from the device profile: the
                 * AVEA labels its volume trace Vt and runs Paw from -40, the Evita prints mbar.
                 * A single instantaneous Paw sat at PEEP for most of the cycle, so it read as a
                 * broken number beside the peak. The pressure trace keeps the derived pressures a
                 * real console shows, under that vendor's abbreviations.
                 */}
                {display.waveforms.map(renderWaveformChannel)}
              </div>
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
                {profile.modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={styles.modeCard}
                    data-selected={
                      state.ventilator.pendingMode === mode.id ||
                      (!state.ventilator.pendingMode && settings.deviceMode === mode.id)
                    }
                    data-availability={mode.availability}
                    aria-pressed={state.ventilator.pendingMode === mode.id}
                    disabled={therapyDisabled || mode.availability !== 'simulated'}
                    onClick={() => dispatch({ type: 'SELECT_MODE', mode: mode.id })}
                  >
                    <strong>{mode.label}</strong>
                    <span>{mode.description}</span>
                    {mode.availability !== 'simulated' ? (
                      <small>{mode.availabilityNote ?? 'Source-listed only'}</small>
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
              <DynamicLungPanel state={state} pressureUnit={display.pressureUnit} />
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
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'PERFORM_HOLD', hold: 'inspiratory' })}
                  >
                    <Hand aria-hidden="true" /> Inspiratory hold
                  </button>
                  <button
                    type="button"
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
                  High-risk bedside actions are recognition-and-priority exercises only. Perform
                  procedures according to local policy and under appropriate supervision.
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
              aria-current={screen === item.id ? 'page' : undefined}
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
          <button type="button" onClick={commitPendingControl}>
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
            className={styles.rotaryKnob}
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
        ; measured {pressureNames.plateau} {state.measurements.plateauPressureCmH2O.toFixed(0)}{' '}
        {display.pressureUnit}; intrinsic PEEP {state.measurements.intrinsicPeepCmH2O.toFixed(1)}{' '}
        {display.pressureUnit}.
      </p>
    </section>
  )
}
