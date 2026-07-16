'use client'

import { useMemo, useState, type Dispatch, type KeyboardEvent } from 'react'
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
  Play,
  Settings2,
  ShieldCheck,
  Snowflake,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react'

import type {
  C6Mode,
  C6Screen,
  VentilationAction,
  VentilationSimulationState,
  VentilatorControlKey,
} from '../engine'
import { WaveformLoops, WaveformStrip } from './WaveformStrip'
import styles from './hamilton-c6-ventilation.module.css'

interface HamiltonC6ConsoleProps {
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
}

const modeLabels: Record<C6Mode, string> = {
  scmv: '(S)CMV',
  'pcv-plus': 'PCV+',
  spont: 'SPONT',
}

const screenItems: readonly { id: C6Screen; label: string }[] = [
  { id: 'main', label: 'Monitoring' },
  { id: 'modes', label: 'Modes' },
  { id: 'controls', label: 'Controls' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'tools', label: 'Tools' },
]

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

export function HamiltonC6Console({ state, dispatch, controlsEnabled }: HamiltonC6ConsoleProps) {
  const settings = state.ventilator.settings
  const [activeControlKey, setActiveControlKey] = useState<VentilatorControlKey>('peepCmH2O')
  const therapyDisabled = !controlsEnabled || state.ventilator.locked

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
        minimum: settings.trigger.type === 'flow' ? 0.5 : -15,
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
    if (settings.mode === 'scmv') {
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
    if (settings.mode === 'pcv-plus') {
      controls.splice(
        0,
        0,
        {
          key: 'deltaPControlCmH2O',
          label: 'Pcontrol',
          value: settings.deltaPControlCmH2O,
          unit: 'cmH₂O',
          minimum: 3,
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
          maximum: 1000,
          step: 10,
        },
      )
    }
    if (settings.mode === 'spont') {
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
          minimum: 4,
          maximum: 30,
          step: 1,
        },
      )
    }
    return controls
  }, [settings])

  const activeControl =
    numericControls.find((control) => control.key === activeControlKey) ?? numericControls[0]

  const changeControl = (control: NumericControl, value: number) => {
    const bounded = Math.min(control.maximum, Math.max(control.minimum, value))
    const rounded = Math.round(bounded / control.step) * control.step
    dispatch({ type: 'SET_CONTROL', control: control.key, value: Number(rounded.toFixed(2)) })
  }

  const adjustActive = (direction: -1 | 1) => {
    if (!activeControl) return
    changeControl(activeControl, activeControl.value + activeControl.step * direction)
  }

  const activeAlarm = state.alarms[0]
  const screen = state.ventilator.screen
  const latest = state.waveforms.at(-1)

  return (
    <section className={styles.consoleShell} aria-label="C6 functional training facsimile">
      <div className={styles.consoleBezel}>
        <header className={styles.consoleHeader}>
          <div>
            <span className={styles.consoleModel}>C6 TRAINING</span>
            <span>Adult/Ped · {modeLabels[settings.mode]}</span>
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
                {(['scmv', 'pcv-plus', 'spont'] as const).map((mode) => (
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
                    <span>
                      {mode === 'scmv'
                        ? 'Volume-targeted mandatory ventilation'
                        : mode === 'pcv-plus'
                          ? 'Pressure-controlled mandatory ventilation'
                          : 'Spontaneous pressure support with apnea backup'}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.confirmModeButton}
                disabled={!state.ventilator.pendingMode || therapyDisabled}
                onClick={() => dispatch({ type: 'CONFIRM_MODE' })}
              >
                Confirm{' '}
                {state.ventilator.pendingMode ? modeLabels[state.ventilator.pendingMode] : 'mode'}
              </button>
              <p className={styles.deviceNote}>
                ASV, INTELLiVENT-ASV, and IntelliSync+ are intentionally outside this v1 training
                profile.
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
                {numericControls.map((control) => (
                  <NumericControlTile
                    key={control.key}
                    control={control}
                    selected={activeControl?.key === control.key}
                    disabled={therapyDisabled}
                    onSelect={() => setActiveControlKey(control.key)}
                    onChange={(value) => changeControl(control, value)}
                  />
                ))}
              </div>
              <div className={styles.inlineDeviceFields}>
                <label>
                  Trigger type
                  <select
                    value={settings.trigger.type}
                    disabled={therapyDisabled}
                    onChange={(event) =>
                      dispatch({
                        type: 'SET_CONTROL',
                        control: 'triggerType',
                        value: event.target.value,
                      })
                    }
                  >
                    <option value="flow">Flow</option>
                    <option value="pressure">Pressure</option>
                  </select>
                </label>
                {settings.mode === 'scmv' ? (
                  <label>
                    Flow pattern
                    <select
                      value={settings.flowPattern}
                      disabled={therapyDisabled}
                      onChange={(event) =>
                        dispatch({
                          type: 'SET_CONTROL',
                          control: 'flowPattern',
                          value: event.target.value,
                        })
                      }
                    >
                      <option value="square">Square</option>
                      <option value="decelerating-50">50% decelerating</option>
                      <option value="sine">Sine</option>
                      <option value="decelerating-100">100% decelerating</option>
                    </select>
                  </label>
                ) : null}
                {settings.mode === 'spont' ? (
                  <label className={styles.checkField}>
                    <input
                      type="checkbox"
                      checked={settings.apneaBackupEnabled}
                      disabled={therapyDisabled}
                      onChange={(event) =>
                        dispatch({
                          type: 'SET_CONTROL',
                          control: 'apneaBackupEnabled',
                          value: event.target.checked,
                        })
                      }
                    />
                    Apnea backup
                  </label>
                ) : null}
                <label className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={settings.trcEnabled}
                    disabled={therapyDisabled}
                    onChange={(event) =>
                      dispatch({
                        type: 'SET_CONTROL',
                        control: 'trcEnabled',
                        value: event.target.checked,
                      })
                    }
                  />
                  TRC compensation
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
                  control={numericControls.find((item) => item.key === 'highPressureLimitCmH2O')!}
                  selected={activeControl?.key === 'highPressureLimitCmH2O'}
                  disabled={therapyDisabled}
                  onSelect={() => setActiveControlKey('highPressureLimitCmH2O')}
                  onChange={(value) =>
                    changeControl(
                      numericControls.find((item) => item.key === 'highPressureLimitCmH2O')!,
                      value,
                    )
                  }
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

        <nav className={styles.consoleNav} aria-label="C6 screen navigation">
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
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'controls' })}
          >
            <span>{activeControl?.label ?? 'Control'}</span>
            <strong>{activeControl?.value ?? '—'}</strong>
            <small>press / turn</small>
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
