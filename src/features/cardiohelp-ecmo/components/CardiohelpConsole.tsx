'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  AlertTriangle,
  Battery,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  CirclePower,
  Gauge,
  History,
  House,
  Lock,
  Menu,
  RotateCcw,
  ShieldAlert,
  Unlock,
  Zap,
} from 'lucide-react'

import type {
  AlarmEvent,
  ClinicalInitiationTargets,
  EcmoChannelReadout,
  ConsoleScreen,
  EcmoSimulationState,
  GuidedControlId,
  GuidedTarget,
  PressureLimits,
  SimulationAction,
} from '../engine'
import { resolvePumpStopExplanation } from '../engine'
import { formatChannelReadout } from './channelReadout'
import { revealEcmoTargetIfNeeded } from './stage/scrollTaskPaneToTop'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpConsoleProps {
  state: EcmoSimulationState
  dispatch: (action: SimulationAction) => void
  controlsEnabled: boolean
  guidedTarget?: GuidedTarget | null
  guidedControlId?: GuidedControlId | null
  initiationTargets?: ClinicalInitiationTargets | null
}

const screenTabs: readonly { id: ConsoleScreen; label: string; short: string }[] = [
  { id: 'startup', label: 'Startup', short: 'START' },
  { id: 'parameters', label: 'Parameter list', short: 'PARAM' },
  { id: 'blood', label: 'Blood parameters', short: 'BLOOD' },
  { id: 'transport', label: 'Transport', short: 'TRANS' },
  { id: 'interventions', label: 'Interventions', short: 'INTERV' },
  { id: 'timers', label: 'Timers', short: 'TIME' },
]

/**
 * The CARDIOHELP venous probe measures blood in the disposable's measuring cell, which is
 * integrated in the oxygenator pump unit on the venous inlet side — so this tile reads the
 * drainage limb, not a systemic mixed-venous estimate (IFU Rev 2.3: p39 probe description, p46
 * "Oxygen saturation in the measuring cell", p104 measuring-cell location).
 */
// What to read this beside, not what moves it: this description reaches the BLOOD and START
// screens before the recirculation drill's prediction, and the mechanism it used to name is that
// drill's answer.
const VENOUS_LINE_SATURATION_DESCRIPTION =
  'Device-displayed venous-line saturation, read on the drainage limb. Compare it with the patient’s own saturation rather than reading it alone.'

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

function ParameterTile({
  label,
  value,
  unit,
  alarm,
  large = false,
  note,
}: {
  label: string
  value: string | number
  unit: string
  alarm?: AlarmEvent
  large?: boolean
  /** A qualifier on what the number is — "requested, the pump is stopped" — not a second reading. */
  note?: string
}) {
  return (
    <div
      className={`${styles.parameterTile} ${large ? styles.parameterTileLarge : ''}`}
      data-alarm-priority={alarm?.priority ?? 'none'}
    >
      <span className={styles.parameterLabel}>{label}</span>
      <span className={styles.parameterValue}>{value}</span>
      <span className={styles.parameterUnit}>{unit}</span>
      {note ? (
        <span className={styles.parameterUnit} data-parameter-note>
          {note}
        </span>
      ) : null}
      {alarm ? <span className={styles.parameterAlarmText}>{alarm.priority} alarm</span> : null}
    </div>
  )
}

/**
 * The speed tile, saying whether the number is a speed the pump is turning at.
 *
 * `rpmSetpoint` is a setting. The model can stop the pump without zeroing it — the pressure
 * interlock does exactly that — and an initiation case holds an ordered speed before support has
 * started at all. Printing "Speed 3600 RPM" beside 0.00 L/min let both read as a rotating pump
 * (C3-1, C1-5). The tile now says which it is; what the number is has not changed.
 */
function SpeedTile({ state, large = false }: { state: EcmoSimulationState; large?: boolean }) {
  const pump = resolvePumpStopExplanation(state)
  return (
    <ParameterTile
      label={pump.running ? 'Speed' : 'Speed (requested)'}
      value={state.device.rpmSetpoint}
      unit="RPM"
      large={large}
      note={pump.running ? undefined : pump.label}
    />
  )
}

/**
 * A tile fed from an engine readout rather than a bare number.
 *
 * The IFU's convention is that a measured value which is unavailable, unsupported, or outside the
 * documented display range shows as dashes rather than as a number (Rev 2.3 §3, page 47). The two
 * reasons a value can be missing here are not the same claim, so the visible dashes are identical
 * but the accessible text distinguishes a device-side unavailability from a limitation of this
 * simulation.
 */
function ReadoutTile({
  label,
  readout,
  unit,
  precision = 1,
  alarm,
  large = false,
  description,
}: {
  label: string
  readout: EcmoChannelReadout
  unit: string
  precision?: number
  alarm?: AlarmEvent
  large?: boolean
  description?: string
}) {
  const formatted = formatChannelReadout(label, readout, unit, precision, description)
  return (
    <div
      className={`${styles.parameterTile} ${large ? styles.parameterTileLarge : ''}`}
      data-alarm-priority={alarm?.priority ?? 'none'}
      data-readout-status={readout.status}
    >
      <span className={styles.parameterLabel}>{label}</span>
      <span className={styles.parameterValue}>{formatted.valueText}</span>
      <span className={styles.parameterUnit}>{formatted.unitText}</span>
      <span className="sr-only">{formatted.screenReaderText}</span>
      {alarm ? <span className={styles.parameterAlarmText}>{alarm.priority} alarm</span> : null}
    </div>
  )
}

function ScreenBody({ state, dispatch, controlsEnabled, guidedControlId }: CardiohelpConsoleProps) {
  const { screen } = state.device
  const alarmFor = (parameter: string) =>
    state.alarms.find(
      (alarm) => alarm.parameter?.toLocaleLowerCase() === parameter.toLocaleLowerCase(),
    )

  if (screen === 'menu') {
    return (
      <div className={styles.menuGrid} aria-label="CARDIOHELP-i menu">
        <button type="button" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'settings' })}>
          <Gauge aria-hidden="true" /> Settings
        </button>
        <button type="button" disabled>
          Cardiopulmonary Support thApp
        </button>
        <button
          type="button"
          disabled={!controlsEnabled || state.device.locked}
          onClick={() =>
            dispatch({
              type: 'SET_PUMP_MODE',
              mode: state.device.pumpMode === 'rpm' ? 'lpm' : 'rpm',
            })
          }
        >
          Pump mode: {state.device.pumpMode.toUpperCase()}
        </button>
        <button type="button" disabled>
          Recording: educational log
        </button>
        <button
          id="cardiohelp-alarm-list-button"
          type="button"
          data-guided-help={guidedControlId === 'cardiohelp-alarm-list-button'}
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'alarm-history' })}
        >
          <History aria-hidden="true" /> Alarm list
        </button>
        <button type="button" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'startup' })}>
          Close
        </button>
      </div>
    )
  }

  if (screen === 'settings') {
    const limitRows: readonly {
      parameter: keyof PressureLimits
      label: string
      unit: string
      step: number
    }[] = [
      { parameter: 'pVenWarningLow', label: 'pVen warning low', unit: 'mmHg', step: 5 },
      { parameter: 'pVenAlarmLow', label: 'pVen alarm low', unit: 'mmHg', step: 5 },
      { parameter: 'pIntWarningHigh', label: 'pInt warning high', unit: 'mmHg', step: 5 },
      { parameter: 'pIntAlarmHigh', label: 'pInt alarm high', unit: 'mmHg', step: 5 },
      { parameter: 'pArtWarningHigh', label: 'pArt warning high', unit: 'mmHg', step: 5 },
      { parameter: 'pArtAlarmHigh', label: 'pArt alarm high', unit: 'mmHg', step: 5 },
      { parameter: 'flowLow', label: 'Flow low', unit: 'L/min', step: 0.1 },
      { parameter: 'flowHigh', label: 'Flow high', unit: 'L/min', step: 0.1 },
    ]
    return (
      <div className={styles.settingsScreen}>
        <div className={styles.settingsHeading}>
          <strong>Parameter alarm limits</strong>
          <span>Use the rotary-style controls to edit the simulated limits.</span>
        </div>
        <div className={styles.limitGrid}>
          {limitRows.map(({ parameter, label, unit, step }) => (
            <div className={styles.limitRow} key={parameter}>
              <span>{label}</span>
              <button
                type="button"
                aria-label={`Decrease ${label}`}
                disabled={!controlsEnabled || state.device.locked}
                onClick={() => dispatch({ type: 'ADJUST_LIMIT', parameter, delta: -step })}
              >
                −
              </button>
              <output aria-label={`${label} value`}>
                {state.device.limits[parameter].toFixed(unit === 'L/min' ? 1 : 0)}{' '}
                <small>{unit}</small>
              </output>
              <button
                type="button"
                aria-label={`Increase ${label}`}
                disabled={!controlsEnabled || state.device.locked}
                onClick={() => dispatch({ type: 'ADJUST_LIMIT', parameter, delta: step })}
              >
                +
              </button>
            </div>
          ))}
        </div>
        <p role="note">Alarm limits are device settings, not patient targets.</p>
      </div>
    )
  }

  if (screen === 'alarm-history') {
    return (
      <div className={styles.alarmHistory}>
        <div className={styles.screenSectionHeading}>
          <History aria-hidden="true" /> Latest six alarms
        </div>
        {state.alarmHistory.length ? (
          <ol>
            {state.alarmHistory.map((alarm) => (
              <li key={alarm.id} data-priority={alarm.priority}>
                <span>{formatTime(alarm.startedAt)}</span>
                <strong>{alarm.priority.toUpperCase()}</strong>
                <span>{alarm.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No alarm events recorded.</p>
        )}
      </div>
    )
  }

  if (screen === 'blood') {
    return (
      <div className={styles.parameterGrid}>
        <ParameterTile label="TVen" value={state.circuit.tVen.toFixed(1)} unit="°C" />
        <ParameterTile label="TArt" value={state.circuit.tArt.toFixed(1)} unit="°C" />
        <ReadoutTile
          label="SvO₂"
          readout={state.circuit.readouts.venousLineSaturation}
          unit="%"
          description={VENOUS_LINE_SATURATION_DESCRIPTION}
        />
        <ParameterTile label="Hb" value={state.circuit.hemoglobin.toFixed(1)} unit="g/dL" />
        <ParameterTile label="Hct" value={state.circuit.hematocrit.toFixed(1)} unit="%" />
      </div>
    )
  }

  if (screen === 'transport') {
    return (
      <div className={styles.transportGrid}>
        <ParameterTile label="Flow" value={state.circuit.bloodFlow.toFixed(2)} unit="L/min" large />
        <SpeedTile state={state} large />
        <ReadoutTile label="pVen" readout={state.circuit.readouts.pVen} unit="mmHg" precision={0} />
        <ReadoutTile label="pArt" readout={state.circuit.readouts.pArt} unit="mmHg" precision={0} />
        <ParameterTile label="Battery" value={state.device.batteryPercent.toFixed(0)} unit="%" />
        {state.device.powerSource !== 'ac' ? (
          <button
            id="cardiohelp-restore-ac-power"
            type="button"
            className={styles.screenActionButton}
            disabled={!controlsEnabled}
            data-guided-help={guidedControlId === 'cardiohelp-restore-ac-power'}
            onClick={() => dispatch({ type: 'RESTORE_AC_POWER' })}
          >
            <Zap aria-hidden="true" /> Reconnect verified AC source
          </button>
        ) : null}
      </div>
    )
  }

  if (screen === 'interventions') {
    return (
      <div className={styles.interventionList}>
        <div>
          <span>Pressure intervention</span>
          <strong>{state.device.pressureInterventionEnabled ? 'ENABLED' : 'OFF'}</strong>
        </div>
        <div>
          <span>Bubble intervention</span>
          <strong>{state.device.bubbleInterventionEnabled ? 'ENABLED' : 'OFF'}</strong>
        </div>
        <div>
          <span>Arterial bubble state</span>
          <strong>{state.circuit.bubbleResetRequired ? 'RESET REQUIRED' : 'CLEAR'}</strong>
        </div>
        <button
          id="cardiohelp-reset-bubble"
          type="button"
          disabled={!controlsEnabled || !state.circuit.bubbleResetRequired}
          aria-describedby="cardiohelp-reset-bubble-reason"
          data-guided-help={guidedControlId === 'cardiohelp-reset-bubble'}
          onClick={() => dispatch({ type: 'RESET_BUBBLE' })}
        >
          <RotateCcw aria-hidden="true" /> Reset bubble intervention
        </button>
        {/*
          Why the reset is or is not available, said rather than implied.
          S15-2: a blocked reset was a greyed-out control with nothing to read. The enabled case is
          carried too, because the reset is deliberately live while the air source is still
          outstanding — pressing it then is the mistake the drill exists to catch, and the learner
          should be able to read what the control will do before finding out.
        */}
        <p id="cardiohelp-reset-bubble-reason" role="status" aria-live="polite">
          {!controlsEnabled
            ? 'Reading only in this section; the reset is not operable here.'
            : !state.circuit.bubbleResetRequired
              ? 'Not available: no bubble intervention is latched on this circuit, so there is nothing to reset.'
              : 'Available. The reset clears the console latch only. It does not remove air, and it is refused while the air source is still uncorrected.'}
        </p>
      </div>
    )
  }

  if (screen === 'timers') {
    return (
      <div className={styles.timerGrid}>
        {state.device.timers.map((timer, index) => (
          <div key={index}>
            <span>{index === 3 ? 'Countdown' : `Timer ${index + 1}`}</span>
            <strong>{formatTime(timer)}</strong>
            <span className={styles.timerActions}>
              <button
                type="button"
                disabled={!controlsEnabled}
                onClick={() => dispatch({ type: 'TOGGLE_TIMER', timerIndex: index })}
              >
                {state.device.timerRunning[index] ? 'Stop' : 'Start'}
              </button>
              <button
                type="button"
                disabled={!controlsEnabled}
                onClick={() => dispatch({ type: 'RESET_TIMER', timerIndex: index })}
              >
                Reset
              </button>
            </span>
          </div>
        ))}
        <p>Timers are informational and are not diagnostic tools.</p>
      </div>
    )
  }

  if (screen === 'parameters') {
    return (
      <div className={styles.parameterGrid}>
        <ReadoutTile
          label="pVen"
          readout={state.circuit.readouts.pVen}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pVen')}
        />
        <ReadoutTile
          label="pInt"
          readout={state.circuit.readouts.pInt}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pInt')}
        />
        <ReadoutTile
          label="pArt"
          readout={state.circuit.readouts.pArt}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pArt')}
        />
        <ParameterTile label="pAux" value={state.circuit.pAux ?? '---'} unit="mmHg" />
        <ReadoutTile
          label="Δp"
          readout={state.circuit.readouts.deltaP}
          unit="mmHg · trend"
          precision={0}
        />
        <ParameterTile
          label="Flow"
          value={state.circuit.flowSensorConnected ? state.circuit.bloodFlow.toFixed(2) : '---'}
          unit="L/min"
          alarm={alarmFor('Flow')}
        />
      </div>
    )
  }

  return (
    <div className={styles.startupScreen}>
      <div className={styles.startupPrimary}>
        <ParameterTile
          label="Flow"
          value={state.circuit.flowSensorConnected ? state.circuit.bloodFlow.toFixed(2) : '---'}
          unit="L/min"
          large
          alarm={alarmFor('Flow')}
        />
        <SpeedTile state={state} large />
      </div>
      <div className={styles.startupSecondary}>
        <ReadoutTile
          label="pVen"
          readout={state.circuit.readouts.pVen}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pVen')}
        />
        <ReadoutTile
          label="pInt"
          readout={state.circuit.readouts.pInt}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pInt')}
        />
        <ReadoutTile
          label="pArt"
          readout={state.circuit.readouts.pArt}
          unit="mmHg"
          precision={0}
          alarm={alarmFor('pArt')}
        />
        <ReadoutTile
          label="Δp"
          readout={state.circuit.readouts.deltaP}
          unit="mmHg · trend"
          precision={0}
        />
        <ReadoutTile
          label="SvO₂"
          readout={state.circuit.readouts.venousLineSaturation}
          unit="%"
          description={VENOUS_LINE_SATURATION_DESCRIPTION}
        />
      </div>
    </div>
  )
}

export function CardiohelpConsole({
  state,
  dispatch,
  controlsEnabled,
  guidedTarget = null,
  guidedControlId = null,
  initiationTargets = null,
}: CardiohelpConsoleProps) {
  const topAlarm = state.alarms[0]
  const pumpStop = resolvePumpStopExplanation(state)
  const unlockTimerRef = useRef<number | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  /** Set by a pointer press so the click it also fires does not step a second time. */
  const pointerHeldRef = useRef(false)
  /** Releases `pointerHeldRef` one turn after a press ends, in case no click follows it. */
  const pendingClickTimerRef = useRef<number | null>(null)
  const rpmBars = useMemo(
    () => Math.round((state.device.rpmSetpoint / 5000) * 12),
    [state.device.rpmSetpoint],
  )
  const knobValue =
    state.device.pumpMode === 'rpm' ? state.device.rpmSetpoint : state.device.lpmSetpoint
  const knobMin = 0
  const knobMax = state.device.pumpMode === 'rpm' ? 5000 : 9.9
  const safetyHeld = state.device.safetyHeld
  const rpmTargetMatched = initiationTargets
    ? Math.abs(state.device.rpmSetpoint - initiationTargets.rpm) <=
      (initiationTargets.rpmTolerance ?? 50)
    : false

  useEffect(
    () => () => {
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current)
      if (holdTimerRef.current) window.clearInterval(holdTimerRef.current)
      if (pendingClickTimerRef.current) window.clearTimeout(pendingClickTimerRef.current)
    },
    [],
  )

  function rotate(delta: number) {
    if (!controlsEnabled) return
    dispatch({ type: 'ROTARY_DELTA', delta })
  }

  function clearPendingClickTimer() {
    if (pendingClickTimerRef.current === null) return
    window.clearTimeout(pendingClickTimerRef.current)
    pendingClickTimerRef.current = null
  }

  /**
   * Let the click this press will also fire arrive, then stop holding the flag for it.
   *
   * The held flag is a different question from the repeat timer and is cleared on its own
   * schedule. It exists so the click a completed press also fires does not step a second time, so
   * a release must not clear it before that click arrives — it is released on the next turn of the
   * event loop instead. A hold that ends with no click at all (dragged off the button, or released
   * outside the document) therefore stops swallowing the next genuine tap, which used to include
   * the next keyboard activation, since Enter and Space never set the flag in the first place.
   */
  function releasePendingClick() {
    if (!pointerHeldRef.current || pendingClickTimerRef.current !== null) return
    pendingClickTimerRef.current = window.setTimeout(() => {
      pendingClickTimerRef.current = null
      pointerHeldRef.current = false
    }, 0)
  }

  /*
   * A held stepper stops when the hold does — including the ways a hold ends off this element.
   *
   * The button's own handlers cover press, release and the pointer leaving it. They do not cover
   * the window losing focus, the tab going to the background, or a pointer released outside the
   * document, and in each of those the repeat carried on against a control nobody was touching.
   * A release anywhere ends the gesture; a focus loss or a hidden tab abandons it outright.
   */
  useEffect(() => {
    const stopRepeat = () => {
      if (holdTimerRef.current !== null) {
        window.clearInterval(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }
    const endGesture = () => {
      stopRepeat()
      releasePendingClick()
    }
    const abandonGesture = () => {
      stopRepeat()
      clearPendingClickTimer()
      pointerHeldRef.current = false
    }
    const stopWhenHidden = () => {
      if (document.visibilityState === 'hidden') abandonGesture()
    }
    window.addEventListener('blur', abandonGesture)
    window.addEventListener('pointerup', endGesture)
    window.addEventListener('pointercancel', abandonGesture)
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => {
      window.removeEventListener('blur', abandonGesture)
      window.removeEventListener('pointerup', endGesture)
      window.removeEventListener('pointercancel', abandonGesture)
      document.removeEventListener('visibilitychange', stopWhenHidden)
      abandonGesture()
    }
    // Both helpers touch refs only, so this listener set is installed once and never rebuilt.
  }, [])

  /**
   * Press-and-hold on the rotary steppers, so a long ramp is not a long click count.
   *
   * One tap is one step, as before. Holding starts a repeat that widens its step after a moment,
   * which is what makes bringing a stopped pump up to a working speed a couple of seconds of hold
   * rather than sixty-four separate clicks. Purely an input affordance: every repeat goes through
   * the same `ROTARY_DELTA` the single click uses, so the engine sees nothing new.
   *
   * Keyboard users are unaffected — Enter or Space on these buttons still steps once through the
   * click handler, and the knob itself takes held arrow keys via the browser's own key repeat.
   */
  function beginHold(direction: number) {
    if (!controlsEnabled || state.device.locked) return
    endHold()
    clearPendingClickTimer()
    pointerHeldRef.current = true
    rotate(direction)
    let repeats = 0
    holdTimerRef.current = window.setInterval(() => {
      repeats += 1
      /*
       * Widen the step rather than shortening the interval: the setpoint stays readable while it
       * climbs, and a learner can still stop on a value they meant to stop on.
       *
       * The rate itself is left where the owner set it. It is this interface's key-repeat and
       * nothing else — the hint below says so — and the September 2026 walkthrough's reading of it
       * as a ramp rate (S7-2) is a claim about the copy rather than about the timing. Slowing it
       * would undo the affordance that makes bringing a stopped pump up one hold instead of
       * sixty-four clicks, which an earlier owner review asked for.
       */
      const step = repeats > 20 ? 4 : repeats > 8 ? 2 : 1
      rotate(direction * step)
    }, 90)
  }

  function endHold() {
    if (holdTimerRef.current === null) return
    window.clearInterval(holdTimerRef.current)
    holdTimerRef.current = null
  }

  function beginUnlockHold() {
    if (!state.device.locked || unlockTimerRef.current) return
    unlockTimerRef.current = window.setTimeout(() => {
      unlockTimerRef.current = null
      dispatch({ type: 'TOGGLE_LOCK' })
    }, 1000)
  }

  function cancelUnlockHold() {
    if (!unlockTimerRef.current) return
    window.clearTimeout(unlockTimerRef.current)
    unlockTimerRef.current = null
  }

  return (
    <section
      id="cardiohelp-console"
      className={styles.consoleSection}
      aria-labelledby="console-heading"
      data-guided-focus={guidedTarget === 'console'}
      data-guided-help={guidedControlId === 'cardiohelp-console'}
      tabIndex={-1}
    >
      {guidedTarget === 'console' ? (
        <div className={styles.guidedFocusFlag} role="status">
          <span aria-hidden="true">●</span> Guided focus: device console
        </div>
      ) : null}
      <div className={styles.sectionTitleRow}>
        <div>
          <span className={styles.kicker}>Device console</span>
          <h2 id="console-heading">CARDIOHELP-i functional educational facsimile</h2>
        </div>
        <span className={styles.simulatedBadge}>SIMULATED VALUES</span>
      </div>

      {/*
        Whether this console can be operated, said on the console.

        A learner review in September 2026 read the disabled state as a defect — "none of the
        buttons actually work at this phase… I was confused on whether I should be interacting with
        it". The foundation sections teach from bounded, restorable states and hand the learner
        their changes as named task actions; the drills hand them the console itself.
        Driven by the prop that decides it rather than by a second flag, so it cannot drift, and
        worded to stay true: the screen and menu controls are live either way.
      */}
      {controlsEnabled ? null : (
        <p className={styles.readingOnlyNote} data-console-reading-only>
          <strong>Reading only in this section.</strong> The pump, sweep and alarm controls are off
          here; use the named lesson actions to make a change. You can still move between the
          screens.
        </p>
      )}

      {/*
        Why there is no flow, said once, on every screen.

        A stopped pump used to be inferable only from a flow of 0.00 beside four dashed pressure
        channels — and on the pressure-interlock path the alarm that announced the stop cleared with
        the channel it was keyed to, one second later (C3-1). This is the model's own protection and
        state event, labelled as the model's; it carries no CARDIOHELP alarm code or priority and no
        pressure number, because the channels are unavailable precisely for want of one.
      */}
      {pumpStop.running ? null : (
        <p
          className={styles.readingOnlyNote}
          role="status"
          aria-live="polite"
          data-pump-stop={pumpStop.cause}
        >
          <strong>{pumpStop.label}.</strong> {pumpStop.detail}
        </p>
      )}

      <div className={styles.deviceShell}>
        <div className={styles.deviceBrandRow}>
          <span>CARDIOHELP-i</span>
          <small>Original schematic · not manufacturer endorsed</small>
        </div>

        <div className={styles.deviceLayout}>
          <aside
            className={styles.rpmRail}
            aria-label={
              pumpStop.running
                ? `RPM LED indicator: ${state.device.rpmSetpoint} RPM`
                : `RPM LED indicator: ${state.device.rpmSetpoint} RPM requested; ${pumpStop.label.toLocaleLowerCase()}`
            }
          >
            <span>RPM</span>
            <div className={styles.rpmBars} aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <i key={index} data-active={index < rpmBars} />
              ))}
            </div>
            <strong>{state.device.rpmSetpoint}</strong>
          </aside>

          <div className={styles.touchscreenFrame}>
            <div className={styles.statusBar} data-priority={topAlarm?.priority ?? 'none'}>
              <span>Cardiopulmonary Support</span>
              <strong
                role={topAlarm ? 'alert' : 'status'}
                aria-live={topAlarm?.priority === 'high' ? 'assertive' : 'polite'}
                aria-atomic="true"
              >
                {topAlarm
                  ? `${topAlarm.priority.toUpperCase()}: ${topAlarm.message}`
                  : 'No active alarm'}
              </strong>
              <span>
                {state.device.locked ? (
                  <Lock aria-label="Controls locked" />
                ) : (
                  <Unlock aria-label="Controls unlocked" />
                )}
              </span>
              <time>{formatTime(state.simulationTime)}</time>
            </div>

            <div className={styles.screenWorkArea}>
              <div className={styles.screenBody}>
                <ScreenBody
                  state={state}
                  dispatch={dispatch}
                  controlsEnabled={controlsEnabled}
                  guidedControlId={guidedControlId}
                />
              </div>
              <nav className={styles.screenToolbar} aria-label="Touchscreen toolbar">
                <button
                  id="cardiohelp-home-button"
                  type="button"
                  aria-label="Home"
                  data-guided-help={guidedControlId === 'cardiohelp-home-button'}
                  onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'startup' })}
                >
                  <House aria-hidden="true" />
                </button>
                <button
                  id="cardiohelp-menu-button"
                  type="button"
                  aria-label="Menu"
                  data-guided-help={guidedControlId === 'cardiohelp-menu-button'}
                  onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'menu' })}
                >
                  <Menu aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.overrideButton}
                  aria-label="Global Override - safety control required; dangerous degraded mode"
                  disabled={!controlsEnabled || !safetyHeld}
                  onClick={() => dispatch({ type: 'TOGGLE_GLOBAL_OVERRIDE' })}
                  data-active={state.device.globalOverride}
                >
                  <ShieldAlert aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Acknowledge current alarm"
                  disabled={!controlsEnabled || !topAlarm}
                  onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: topAlarm?.id })}
                >
                  <BellOff aria-hidden="true" />
                </button>
                <span
                  className={styles.powerTile}
                  title={`${state.device.batteryPercent.toFixed(0)}% battery`}
                >
                  {state.device.powerSource === 'ac' ? (
                    <Zap aria-label="AC power" />
                  ) : (
                    <Battery aria-label="Battery power" />
                  )}
                </span>
              </nav>
            </div>

            <nav className={styles.screenTabs} aria-label="CARDIOHELP screens">
              {screenTabs.map((tab) => (
                <button
                  id={`cardiohelp-screen-${tab.id}`}
                  type="button"
                  key={tab.id}
                  aria-label={tab.label}
                  aria-current={state.device.screen === tab.id ? 'page' : undefined}
                  data-active={state.device.screen === tab.id}
                  data-guided-help={guidedControlId === `cardiohelp-screen-${tab.id}`}
                  onClick={(event) => {
                    const button = event.currentTarget
                    dispatch({ type: 'SET_SCREEN', screen: tab.id })
                    // A reflowed screen can change height above its tabs. Retain the learner's
                    // active tab without scrolling the whole console or changing focus.
                    requestAnimationFrame(() => revealEcmoTargetIfNeeded(button))
                  }}
                >
                  {tab.short}
                </button>
              ))}
            </nav>
          </div>

          <aside className={styles.physicalPanel} aria-label="Physical console controls">
            <div className={styles.powerIndicators}>
              <span data-on={state.device.powerSource === 'ac'}>
                <Zap aria-hidden="true" /> AC
              </span>
              <span data-on={state.device.powerSource === 'battery'}>
                <Battery aria-hidden="true" /> {state.device.batteryPercent.toFixed(0)}%
              </span>
            </div>

            <button
              type="button"
              disabled={!controlsEnabled}
              className={styles.physicalButton}
              onPointerDown={() => dispatch({ type: 'PRESS_SAFETY' })}
              onPointerUp={() => dispatch({ type: 'RELEASE_SAFETY' })}
              onPointerLeave={() => dispatch({ type: 'RELEASE_SAFETY' })}
              onPointerCancel={() => dispatch({ type: 'RELEASE_SAFETY' })}
              onKeyDown={(event) => {
                if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  dispatch({ type: 'PRESS_SAFETY' })
                }
                if (state.device.safetyHeld && event.key.toLocaleLowerCase() === 'z') {
                  event.preventDefault()
                  dispatch({ type: 'TOGGLE_ZERO_FLOW' })
                }
                if (state.device.safetyHeld && event.key.toLocaleLowerCase() === 'g') {
                  event.preventDefault()
                  dispatch({ type: 'TOGGLE_GLOBAL_OVERRIDE' })
                }
              }}
              onKeyUp={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  dispatch({ type: 'RELEASE_SAFETY' })
                }
              }}
              data-active={safetyHeld}
              aria-pressed={safetyHeld}
              aria-label="Hold Safety; while held activate zero flow or Global Override"
              aria-describedby="cardiohelp-safety-chord-hint"
            >
              <ShieldAlert aria-hidden="true" />
              {safetyHeld ? 'Safety held' : 'Hold Safety'}
            </button>
            <button
              type="button"
              disabled={!controlsEnabled || !safetyHeld}
              className={styles.physicalButton}
              onClick={() => dispatch({ type: 'TOGGLE_ZERO_FLOW' })}
              data-active={state.device.zeroFlowActive}
              aria-pressed={state.device.zeroFlowActive}
            >
              <AlertTriangle aria-hidden="true" />
              Zero flow
            </button>
            <button
              type="button"
              className={styles.physicalButton}
              onClick={() => {
                if (!state.device.locked) dispatch({ type: 'TOGGLE_LOCK' })
              }}
              onPointerDown={beginUnlockHold}
              onPointerUp={cancelUnlockHold}
              onPointerLeave={cancelUnlockHold}
              onPointerCancel={cancelUnlockHold}
              onKeyDown={(event) => {
                if (
                  state.device.locked &&
                  !event.repeat &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault()
                  beginUnlockHold()
                }
              }}
              onKeyUp={(event) => {
                if (event.key === 'Enter' || event.key === ' ') cancelUnlockHold()
              }}
              aria-pressed={state.device.locked}
            >
              {state.device.locked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
              {state.device.locked ? 'Hold to unlock' : 'Lock controls'}
            </button>
            <button type="button" className={styles.physicalButton} disabled>
              <CirclePower aria-hidden="true" /> Power on
            </button>

            <div className={styles.modeSwitch} aria-label="Pump control mode">
              <button
                id="cardiohelp-pump-mode-rpm"
                type="button"
                data-active={state.device.pumpMode === 'rpm'}
                data-guided-help={guidedControlId === 'cardiohelp-pump-mode-rpm'}
                disabled={!controlsEnabled || state.device.locked}
                onClick={() => dispatch({ type: 'SET_PUMP_MODE', mode: 'rpm' })}
              >
                RPM
              </button>
              <button
                id="cardiohelp-pump-mode-lpm"
                type="button"
                data-active={state.device.pumpMode === 'lpm'}
                data-guided-help={guidedControlId === 'cardiohelp-pump-mode-lpm'}
                disabled={
                  !controlsEnabled || state.device.locked || !state.circuit.flowSensorConnected
                }
                onClick={() => dispatch({ type: 'SET_PUMP_MODE', mode: 'lpm' })}
              >
                LPM
              </button>
            </div>

            {initiationTargets ? (
              <div
                id="cardiohelp-rpm-order-cue"
                className={styles.simulatorOrderCue}
                data-matched={rpmTargetMatched}
                role="note"
                aria-label="RPM initiation order"
              >
                <span>Simulated case order</span>
                <strong>{initiationTargets.rpm} RPM</strong>
                <small>
                  Current: {state.device.rpmSetpoint} RPM · Select RPM mode and use the rotary
                  control below.
                </small>
              </div>
            ) : null}

            <div className={styles.rotaryControl}>
              <button
                type="button"
                aria-label="Decrease setpoint"
                aria-describedby="cardiohelp-rotary-hold-hint"
                disabled={!controlsEnabled || state.device.locked}
                onPointerDown={() => beginHold(-1)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onClick={() => {
                  if (pointerHeldRef.current) {
                    clearPendingClickTimer()
                    pointerHeldRef.current = false
                    return
                  }
                  rotate(-1)
                }}
              >
                <ChevronDown aria-hidden="true" />
              </button>
              <div
                id="cardiohelp-rpm-control"
                className={`${styles.knob} ${initiationTargets ? styles.simulatorTargetControl : ''}`}
                role="slider"
                tabIndex={controlsEnabled && !state.device.locked ? 0 : -1}
                aria-label={`${state.device.pumpMode.toUpperCase()} rotary setpoint`}
                aria-describedby={initiationTargets ? 'cardiohelp-rpm-order-cue' : undefined}
                aria-valuemin={knobMin}
                aria-valuemax={knobMax}
                aria-valuenow={knobValue}
                data-initiation-target={Boolean(initiationTargets)}
                data-target-matched={rpmTargetMatched}
                data-guided-help={guidedControlId === 'cardiohelp-rpm-control'}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                    event.preventDefault()
                    rotate(1)
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    rotate(-1)
                  }
                }}
              >
                <span aria-hidden="true" />
                <strong>
                  {state.device.pumpMode === 'rpm'
                    ? state.device.rpmSetpoint
                    : state.device.lpmSetpoint.toFixed(1)}
                </strong>
                <small>{state.device.pumpMode.toUpperCase()}</small>
              </div>
              <button
                type="button"
                aria-label="Increase setpoint"
                aria-describedby="cardiohelp-rotary-hold-hint"
                disabled={!controlsEnabled || state.device.locked}
                onPointerDown={() => beginHold(1)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onClick={() => {
                  if (pointerHeldRef.current) {
                    clearPendingClickTimer()
                    pointerHeldRef.current = false
                    return
                  }
                  rotate(1)
                }}
              >
                <ChevronUp aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              className={styles.audioButton}
              aria-pressed={state.device.alarmAudioEnabled}
              onClick={() => dispatch({ type: 'TOGGLE_ALARM_AUDIO' })}
            >
              {state.device.alarmAudioEnabled ? (
                <Bell aria-hidden="true" />
              ) : (
                <BellOff aria-hidden="true" />
              )}
              Optional alarm audio {state.device.alarmAudioEnabled ? 'on' : 'off'}
            </button>
          </aside>
        </div>
      </div>

      {/*
        How to read and operate the facsimile, said beside it rather than printed on it.

        The two operating hints used to sit inside the physical-control column at nine pixels, and
        a fellow walkthrough (S4-1) could not read them or tell what PARAM, BLOOD, TRANS and INTERV
        stood for. The device keeps its own short labels — they are what the real screen shows — and
        the explanation sits under the device at reading size. The hint ids are unchanged, so the
        controls that cite them through `aria-describedby` still do.
      */}
      <div className={styles.consoleNotes} data-console-notes>
        <p id="cardiohelp-safety-chord-hint">
          <strong>Hold Safety.</strong> Touch: hold Safety with one pointer. Keyboard: hold Space,
          then press Z for zero flow or G for Global Override.
        </p>
        <p id="cardiohelp-rotary-hold-hint">
          <strong>Rotary dial.</strong> Tap to step the setpoint, or press and hold to ramp it.
          Keyboard: focus the dial and hold an arrow key. How fast a hold moves the number is this
          interface&rsquo;s own repeat rate, not a statement about how any pump ramps, and the value
          it moves is the speed being requested.
        </p>
        <p data-console-tab-key>
          <strong>Screen tabs.</strong>{' '}
          {screenTabs.map((tab, index) => (
            <span key={tab.id}>
              {index > 0 ? ' · ' : null}
              <abbr title={tab.label}>{tab.short}</abbr> {tab.label}
            </span>
          ))}
          . The menu button (≡) opens Settings and the Alarm list.
        </p>
        <p data-console-paux>
          <strong>pAux</strong> on the Parameter list is an additional pressure channel, read from a
          separate external pressure sensor (IFU revision 2.3, pages 45 and 110); the device raises
          alarms for pAux values outside warning/alarm limits only in its &ldquo;MECC&rdquo;
          application (page 91). This simulation does not model a pAux sensor, so the channel shows
          no value and is not one of the pressures these lessons teach.
        </p>
      </div>
    </section>
  )
}
