'use client'

import { useEffect, useMemo, useState, type Dispatch, type KeyboardEvent } from 'react'
import {
  Activity,
  AlarmClock,
  BellRing,
  CirclePause,
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
  getVentilatorDeviceProfile,
  nativeToCanonicalControlValue,
} from '../content'
import type {
  VentilatorScreen,
  VentilationAction,
  VentilationSimulationState,
  VentilatorControlKey,
} from '../engine'
import { WaveformLoops, WaveformStrip } from './WaveformStrip'
import styles from './mechanical-ventilation.module.css'

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

function DynamicLungPanel({ state }: { state: VentilationSimulationState }) {
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
          <dd>{compliance.toFixed(0)} mL/cmH₂O</dd>
        </div>
        <div>
          <dt>Resistive gap</dt>
          <dd>{resistanceGap.toFixed(0)} cmH₂O</dd>
        </div>
        <div>
          <dt>Patient effort</dt>
          <dd>{effort.toFixed(0)} cmH₂O</dd>
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
  const modeLabels = profile.modeLabels
  const screenItems = useMemo<readonly { id: VentilatorScreen; label: string }[]>(
    () =>
      (['main', 'modes', 'controls', 'alarms', 'graphics', 'tools'] as const).map((id) => ({
        id,
        label: profile.navigationLabels[id],
      })),
    [profile],
  )
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
    if (settings.mode === 'pressure-ac') {
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
    if (settings.mode === 'pressure-support') {
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
    return controls.map((control) => {
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
  }, [settings, state.deviceId])

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
              {profile.patientGroup} · {modeLabels[settings.mode]}
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
            <div className={styles.monitoringScreen}>
              <div className={styles.waveformStack}>
                <WaveformStrip
                  samples={state.waveforms}
                  field="pawCmH2O"
                  label="Paw"
                  unit="cmH₂O"
                  minimum={0}
                  maximum={50}
                  showPmus={state.showEducatorOverlay}
                />
                <WaveformStrip
                  samples={state.waveforms}
                  field="flowLMin"
                  label="Flow"
                  unit="L/min"
                  minimum={-100}
                  maximum={100}
                />
                <WaveformStrip
                  samples={state.waveforms}
                  field="volumeMl"
                  label="Volume"
                  unit="mL"
                  minimum={0}
                  maximum={1000}
                />
              </div>
              <aside className={styles.mmpPanel} aria-label="Main monitoring parameters">
                <div>
                  <span>Ppeak</span>
                  <strong>{state.measurements.peakPressureCmH2O.toFixed(0)}</strong>
                  <small>cmH₂O</small>
                </div>
                <div>
                  <span>VTE</span>
                  <strong>{state.measurements.exhaledVtMl.toFixed(0)}</strong>
                  <small>mL</small>
                </div>
                <div>
                  <span>fTotal</span>
                  <strong>{state.measurements.totalRatePerMin.toFixed(0)}</strong>
                  <small>/min</small>
                </div>
                <div>
                  <span>MinVol</span>
                  <strong>{state.measurements.minuteVentilationLMin.toFixed(1)}</strong>
                  <small>L/min</small>
                </div>
                <div>
                  <span>I:E</span>
                  <strong>
                    1:
                    {Math.max(
                      0.3,
                      (60 / Math.max(1, state.measurements.totalRatePerMin) -
                        state.measurements.mechanicalInspiratoryTimeSeconds) /
                        Math.max(0.1, state.measurements.mechanicalInspiratoryTimeSeconds),
                    ).toFixed(1)}
                  </strong>
                  <small>ratio</small>
                </div>
              </aside>
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
                {(['volume-ac', 'pressure-ac', 'pressure-support'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={styles.modeCard}
                    data-selected={
                      state.ventilator.pendingMode === mode ||
                      (!state.ventilator.pendingMode && settings.mode === mode)
                    }
                    aria-pressed={state.ventilator.pendingMode === mode}
                    disabled={therapyDisabled}
                    onClick={() => dispatch({ type: 'SELECT_MODE', mode })}
                  >
                    <strong>{modeLabels[mode]}</strong>
                    <span>{profile.modeDescriptions[mode]}</span>
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
                {state.ventilator.pendingMode ? modeLabels[state.ventilator.pendingMode] : 'mode'}
              </button>
              <p className={styles.deviceNote}>
                Not simulated in this shared-core profile: {profile.deferredModes.join(', ')}.
              </p>
            </div>
          ) : null}

          {screen === 'controls' ? (
            <div className={styles.menuScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <span>Controls</span>
                  <h3>{modeLabels[settings.mode]} settings</h3>
                </div>
                <small>Select a tile, then use the physical knob or arrow keys.</small>
              </div>
              <div className={styles.controlGrid}>
                {displayedControls.map((control) => (
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
                {settings.mode === 'volume-ac' ? (
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
                      <option value="square">Square</option>
                      <option value="decelerating-50">50% decelerating</option>
                      <option value="sine">Sine</option>
                      <option value="decelerating-100">100% decelerating</option>
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
              </div>
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
              <DynamicLungPanel state={state} />
            </div>
          ) : null}

          {screen === 'tools' ? (
            <div className={styles.menuScreen}>
              <div className={styles.screenHeading}>
                <div>
                  <span>Tools</span>
                  <h3>Maneuvers and utilities</h3>
                </div>
                <small>All values and maneuvers are simulated.</small>
              </div>
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
              </div>
              <p className={styles.deviceNote}>
                High-risk bedside actions are recognition-and-priority exercises only. Perform
                procedures according to local policy and supervised competency.
              </p>
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

      <div className={styles.physicalControls}>
        <button type="button" onClick={() => dispatch({ type: 'ACK_ALARM' })}>
          <CirclePause aria-hidden="true" /> Audio pause
        </button>
        <button
          type="button"
          disabled={therapyDisabled}
          onClick={() => dispatch({ type: 'OXYGEN_ENRICHMENT' })}
        >
          <span aria-hidden="true">O₂</span> Enrichment
        </button>
        <button
          type="button"
          disabled={therapyDisabled}
          onClick={() => dispatch({ type: 'MANUAL_BREATH' })}
        >
          <Wind aria-hidden="true" /> Manual breath
        </button>
        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_LOCK' })}>
          <LockKeyhole aria-hidden="true" /> {state.ventilator.locked ? 'Unlock' : 'Lock'}
        </button>
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
      </div>

      <p className={styles.waveformTextEquivalent} aria-live="off">
        Waveform text: Paw {latest?.pawCmH2O.toFixed(1) ?? '—'} cmH₂O; flow{' '}
        {latest?.flowLMin.toFixed(1) ?? '—'} L/min; volume {latest?.volumeMl.toFixed(0) ?? '—'} mL;
        measured plateau {state.measurements.plateauPressureCmH2O.toFixed(0)} cmH₂O; intrinsic PEEP{' '}
        {state.measurements.intrinsicPeepCmH2O.toFixed(1)} cmH₂O.
      </p>
    </section>
  )
}
