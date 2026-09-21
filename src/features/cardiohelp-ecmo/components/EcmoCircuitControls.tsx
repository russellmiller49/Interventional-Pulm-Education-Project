'use client'

import { resolveBubbleResumption } from '../engine'
import type { EcmoSimulationState, GuidedControlId, SimulationAction } from '../engine'
import styles from './cardiohelp-ecmo.module.css'

function ClampControl({
  limb,
  closed,
  disabled,
  guidedHelp,
  onToggle,
}: {
  limb: 'Drainage' | 'Return'
  closed: boolean
  disabled: boolean
  guidedHelp: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      id={limb === 'Drainage' ? 'cardiohelp-clamp-drainage' : 'cardiohelp-clamp-return'}
      className={styles.clampControl}
      data-closed={closed}
      data-guided-help={guidedHelp}
      aria-pressed={closed}
      disabled={disabled}
      onClick={onToggle}
    >
      <span aria-hidden="true" className={styles.clampControlIcon}>
        {closed ? '×' : '↔'}
      </span>
      <span>
        <strong>{limb} clamp</strong>
        <small>{closed ? 'Closed · no forward flow' : 'Open · flow path available'}</small>
      </span>
    </button>
  )
}

/** The existing safety-gated controls, independent of optional 3D loading or graphics support. */
export function EcmoCircuitControls({
  state,
  dispatch,
  controlsEnabled,
  guidedControlId,
}: {
  readonly state: EcmoSimulationState
  readonly dispatch: (action: SimulationAction) => void
  readonly controlsEnabled: boolean
  readonly guidedControlId?: GuidedControlId | null
}) {
  const closedClampCount =
    Number(state.circuit.drainageClampClosed) + Number(state.circuit.returnClampClosed)
  // Protective controls depend on the live/read-only surface, never a learning response.
  const clampControlsEnabled = controlsEnabled
  /*
   * Whether resumption is available is the engine's question, not this component's.
   *
   * This used to read `circuit.bubbleResetRequired` — the console's intervention latch — which is
   * not what the reducer's resumption branch asks about. On the clinical air cases the de-airing
   * intervention clears that latch, so the button went dead at precisely the point the case's own
   * next required action needed it, while sitting live over an uncleared circuit beforehand. Both
   * readers now share `resolveBubbleResumption`, and the reason it gives is the reason shown.
   */
  const resumption = resolveBubbleResumption(state)
  const resumeEnabled = clampControlsEnabled && resumption.eligible
  const resumeReason = clampControlsEnabled
    ? resumption.reason
    : 'This is a read-only teaching view. Open the guided activity to use circuit controls.'
  const flowState =
    closedClampCount > 0 ? 'ISOLATED' : state.device.pumpRunning ? 'FLOWING' : 'PUMP STOPPED'
  return (
    <div className={styles.clampControlPanel} aria-label="Circuit isolation clamps">
      <div>
        <span className={styles.kicker}>Interactive flow isolation</span>
        <h3>Bedside circuit clamps</h3>
        <p>
          Closing either limb immediately interrupts forward circuit flow. Use clamp isolation only
          when the learning scenario calls for it; a running pump against an occluded limb can
          create hazardous pressure conditions.
        </p>
      </div>
      <div className={styles.clampControlGrid}>
        <ClampControl
          limb="Drainage"
          closed={state.circuit.drainageClampClosed}
          disabled={!clampControlsEnabled}
          guidedHelp={guidedControlId === 'cardiohelp-clamp-drainage'}
          onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'drainage' })}
        />
        <ClampControl
          limb="Return"
          closed={state.circuit.returnClampClosed}
          disabled={!clampControlsEnabled}
          guidedHelp={guidedControlId === 'cardiohelp-clamp-return'}
          onToggle={() => dispatch({ type: 'TOGGLE_CIRCUIT_CLAMP', limb: 'return' })}
        />
        {/*
            Resumption after an air event, as one bounded act.
            Deliberately not the console reset and deliberately not a clamp: this module does not
            teach where clamp opening, pump restart and console reset fall relative to one another,
            because that choreography is device- and program-specific. The button says what it
            stands for, and the helper text says it is a simulation abstraction.
          */}
        <button
          type="button"
          id="cardiohelp-resume-support"
          className={styles.clampControl}
          data-guided-help={guidedControlId === 'cardiohelp-resume-support'}
          data-resumption-status={resumption.status}
          disabled={!resumeEnabled}
          aria-describedby="cardiohelp-resume-support-reason"
          onClick={() => dispatch({ type: 'RESUME_SUPPORT_AFTER_BUBBLE' })}
        >
          <span aria-hidden="true" className={styles.clampControlIcon}>
            ▶
          </span>
          <span>
            <strong>Resume support per current IFU and local protocol</strong>
            <small>
              A deliberate simplification. It stands in for the device- and program-specific
              resumption sequence and does not reproduce or teach that sequence.
            </small>
          </span>
        </button>
      </div>
      {/*
        The reason a protective control is unavailable, said rather than implied.
        A blocked resumption used to be a greyed-out button with nothing to read: S15-2 in the
        September 2026 walkthrough. It is `role="status"` rather than an alert because it changes
        as the learner works the sequence, and it carries the enabled case too, so the accessible
        description the button points at is never empty.
      */}
      <p
        id="cardiohelp-resume-support-reason"
        className={styles.clampStatus}
        role="status"
        aria-live="polite"
        data-resume-reason={resumption.status}
      >
        {resumeReason}
      </p>
      <div
        className={styles.clampStatus}
        role="status"
        aria-live="polite"
        data-alert={closedClampCount > 0}
      >
        <strong>{flowState}</strong>
        <span>
          {!clampControlsEnabled
            ? 'This is a read-only teaching view. Open the guided activity to use circuit controls.'
            : closedClampCount === 0
              ? 'Both circuit clamps are open.'
              : `${closedClampCount} clamp${closedClampCount === 1 ? '' : 's'} closed; forward flow is stopped.`}
        </span>
      </div>
    </div>
  )
}
