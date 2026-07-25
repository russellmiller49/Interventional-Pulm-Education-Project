'use client'

import Image from 'next/image'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleStop,
  ClipboardCheck,
  FileClock,
  Gauge,
  HelpCircle,
  History,
  LockKeyhole,
  MonitorCog,
  Play,
  Power,
  RotateCcw,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import {
  prismaxSimulatorArtwork,
  prismaxSimulatorHotspots,
  type PrismaxSimulatorHotspotId,
} from '../content/prismaxSimulator'
import type { CrrtConsoleControlsModel } from '../engine/consoleControls'
import {
  selectPrismaxPilotInterface,
  selectPrismaxPilotOperationsDisplay,
  type PrismaxPilotInterfaceAction,
  type PrismaxPilotInterfaceState,
  type PrismaxPilotOperationsDisplay,
  type PrismaxPrescriptionDraft,
  type PrismaxSetupStepId,
} from '../engine/deviceAdapters/prismax'
import styles from './prismax-pilot-interface.module.css'

interface RevealedPrismaxPilotCaseContext {
  readonly identityMasked?: false
  readonly caseId: string
  readonly title: string
  readonly pathway: 'practice' | 'mastery'
}

interface MaskedPrismaxPilotCaseContext {
  readonly identityMasked: true
  readonly learnerLabel: string
  readonly pathway: 'mastery'
}

export type PrismaxPilotCaseContext =
  | RevealedPrismaxPilotCaseContext
  | MaskedPrismaxPilotCaseContext

interface PrismaxPilotInterfaceProps {
  state: PrismaxPilotInterfaceState
  dispatch: Dispatch<PrismaxPilotInterfaceAction>
  controlsEnabled?: boolean
  controlsUnavailableReason?: 'debrief'
  consoleControls?: CrrtConsoleControlsModel
  operationsDisplay?: PrismaxPilotOperationsDisplay
  caseContext?: PrismaxPilotCaseContext
  onPerformCaseAction?: (interventionId: string) => void
  onReset?: () => void
}

const prescriptionFields = [
  {
    field: 'bloodFlowMlMin',
    label: 'Blood flow',
    unit: 'mL/min',
    note: 'Enter first. Set-specific minimum and increments are not encoded.',
  },
  {
    field: 'dialysateFlowMlHour',
    label: 'Dialysate flow',
    unit: 'mL/h',
    note: 'CVVHD dialysate-flow entry. Confirm device- and set-specific limits before clinical use.',
  },
  {
    field: 'patientFluidRemovalMlHour',
    label: 'Patient fluid removal',
    unit: 'mL/h',
    note: 'Machine setting only; it is not whole-patient balance.',
  },
] as const satisfies readonly {
  field: keyof PrismaxPrescriptionDraft
  label: string
  unit: string
  note: string
}[]

function formatFlow(value: number | null, unit: string) {
  return value === null ? '—' : `${value.toLocaleString()} ${unit}`
}

function formatMetric(value: number | null, unit: string, digits = 1) {
  return value === null ? '—' : `${value.toFixed(digits)} ${unit}`
}

function formatStepLabel(stepId: PrismaxSetupStepId) {
  return stepId === 'connect-patient'
    ? 'Connect Patient'
    : stepId.charAt(0).toUpperCase() + stepId.slice(1)
}

function caseIdentifier(caseContext: PrismaxPilotCaseContext): string {
  return caseContext.identityMasked ? 'Masked case' : 'Selected clinical case'
}

function caseTitle(caseContext: PrismaxPilotCaseContext): string {
  return caseContext.identityMasked ? caseContext.learnerLabel : caseContext.title
}

function PrescriptionStep({
  state,
  dispatch,
}: {
  state: PrismaxPilotInterfaceState
  dispatch: Dispatch<PrismaxPilotInterfaceAction>
}) {
  const view = selectPrismaxPilotInterface(state)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'COMMIT_PRESCRIPTION' })
    dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'prescription' })
  }

  return (
    <form className={styles.prescriptionForm} onSubmit={handleSubmit}>
      <div className={styles.screenCopy}>
        <span>Step 3 · Prescription</span>
        <h4>Enter the three case controls</h4>
        <p>
          These are blank training inputs, not defaults or recommendations. Blood flow is entered
          first; no local set-specific ranges or increments are inferred.
        </p>
      </div>

      <div className={styles.fieldGrid}>
        {prescriptionFields.map(({ field, label, unit, note }, index) => {
          const disabled = index > 0 && !view.canSetDialysateAndPatientFluidRemoval
          return (
            <label key={field} className={styles.flowField}>
              <span>{label}</span>
              <span className={styles.inputShell}>
                <input
                  aria-describedby={`${field}-note`}
                  disabled={disabled}
                  inputMode="decimal"
                  min="0"
                  step="any"
                  type="number"
                  value={state.prescriptionDraft[field] ?? ''}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_PRESCRIPTION_VALUE',
                      field,
                      value: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
                <b>{unit}</b>
              </span>
              <small id={`${field}-note`}>{disabled ? 'Enter blood flow first.' : note}</small>
            </label>
          )
        })}
      </div>

      <div className={styles.pendingNotice} role="note">
        <ShieldAlert aria-hidden="true" />
        <span>
          Replacement, PBP, syringe, citrate, solution selection, and set-specific validation are
          outside this CVVHD case surface.
        </span>
      </div>

      <button className={styles.primaryAction} disabled={!view.canCommitPrescription} type="submit">
        Review and apply case values
      </button>
    </form>
  )
}

function SetupStepContent({
  state,
  dispatch,
  caseContext,
}: {
  state: PrismaxPilotInterfaceState
  dispatch: Dispatch<PrismaxPilotInterfaceAction>
  caseContext?: PrismaxPilotCaseContext
}) {
  const view = selectPrismaxPilotInterface(state)
  const activeStep = view.activeStep?.id

  if (activeStep === 'patient') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 1 · Patient</span>
          <h4>Confirm the simulated case</h4>
          <p>
            {caseContext
              ? `${caseIdentifier(caseContext)} uses simulated physiology and does not collect patient identifiers or patient-entered data.`
              : 'Orientation does not collect identifiers or load patient physiology.'}
          </p>
        </div>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'patient' })}
        >
          Confirm case-free context
        </button>
      </div>
    )
  }

  if (activeStep === 'therapy') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 2 · Therapy</span>
          <h4>Select the learning workflow</h4>
          <p>
            CVVHD is the active workflow for this case surface. This does not establish availability
            on a local installed device or suitability for a patient.
          </p>
        </div>
        <button
          className={styles.choiceCard}
          type="button"
          onClick={() => dispatch({ type: 'SELECT_CVVHD' })}
        >
          <strong>CVVHD</strong>
          <span>Diffusive educational interface · AW8035 manual reference</span>
        </button>
        {state.selectedModality === 'cvvhd' ? (
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'therapy' })}
          >
            Continue with CVVHD workflow
          </button>
        ) : null}
      </div>
    )
  }

  if (activeStep === 'prescription') {
    return <PrescriptionStep state={state} dispatch={dispatch} />
  }

  if (activeStep === 'sets') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 4 · Sets</span>
          <h4>Verify the training flow path</h4>
          <p>
            The original schematic shows the required educational topology. No commercial set,
            catalog number, compatibility claim, or disposable-specific range is selected.
          </p>
        </div>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'sets' })}
        >
          Confirm training set path
        </button>
      </div>
    )
  }

  if (activeStep === 'fluids') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 5 · Fluids</span>
          <h4>Verify case bag positions</h4>
          <p>
            Dialysate and effluent positions are active for the CVVHD checkout. PBP and replacement
            positions remain visible but inactive; no solution composition is encoded.
          </p>
        </div>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'fluids' })}
        >
          Confirm bag and scale positions
        </button>
      </div>
    )
  }

  if (activeStep === 'prime') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 6 · Prime</span>
          <h4>Run the educational prime check</h4>
          <p>
            This interaction verifies sequence only. It does not simulate a disposable, fluid
            volume, priming duration, detector response, or real machine action.
          </p>
        </div>
        <progress
          aria-label="Educational prime progress"
          max={2}
          value={state.primeState === 'complete' ? 2 : state.primeState === 'in-progress' ? 1 : 0}
        />
        {state.primeState === 'not-started' ? (
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => dispatch({ type: 'START_PRIME' })}
          >
            Start prime sequence check
          </button>
        ) : state.primeState === 'in-progress' ? (
          <button
            className={styles.primaryAction}
            type="button"
            onClick={() => {
              dispatch({ type: 'COMPLETE_PRIME' })
              dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'prime' })
            }}
          >
            Complete prime verification
          </button>
        ) : null}
      </div>
    )
  }

  if (activeStep === 'review') {
    const prescription = state.committedPrescription
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 7 · Review</span>
          <h4>Confirm the entered case values</h4>
          <p>
            These are simulated case entries. They do not establish a target, normal range, or
            clinical approval.
          </p>
        </div>
        <dl className={styles.reviewGrid}>
          <div>
            <dt>Therapy</dt>
            <dd>CVVHD · educational case surface</dd>
          </div>
          <div>
            <dt>Blood flow</dt>
            <dd>{formatFlow(prescription?.flows.bloodFlowMlMin ?? null, 'mL/min')}</dd>
          </div>
          <div>
            <dt>Dialysate</dt>
            <dd>{formatFlow(prescription?.flows.dialysateFlowMlHour ?? null, 'mL/h')}</dd>
          </div>
          <div>
            <dt>Machine PFR</dt>
            <dd>{formatFlow(prescription?.flows.patientFluidRemovalMlHour ?? null, 'mL/h')}</dd>
          </div>
        </dl>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'review' })}
        >
          Confirm review
        </button>
      </div>
    )
  }

  if (activeStep === 'connect-patient') {
    return (
      <div className={styles.procedureCard}>
        <div className={styles.screenCopy}>
          <span>Step 8 · Connect Patient</span>
          <h4>Confirm the simulated access and return path</h4>
          <p>
            {caseContext
              ? 'This step connects the simulated circuit only after setup and prescription review are complete.'
              : 'No patient model is connected in Orientation. This step confirms that the equipment sequence reached its final setup check.'}
          </p>
        </div>
        <button
          className={styles.primaryAction}
          type="button"
          onClick={() => dispatch({ type: 'COMPLETE_SETUP_STEP', stepId: 'connect-patient' })}
        >
          Confirm simulated line path
        </button>
      </div>
    )
  }

  return (
    <div className={styles.readyCard}>
      <Check aria-hidden="true" />
      <div>
        <span>All eight setup checks complete</span>
        <h4>Ready for interface checkout</h4>
        <p>
          {caseContext
            ? 'Starting opens Operations and begins the simulated case.'
            : 'Starting opens Operations without loading a patient case or clinical model.'}
        </p>
      </div>
      <button
        className={styles.startAction}
        disabled={!view.canStartTreatment}
        type="button"
        onClick={() => dispatch({ type: 'START_TREATMENT' })}
      >
        <Play aria-hidden="true" /> Start interface run
      </button>
    </div>
  )
}

function OperationsScreen({
  state,
  dispatch,
  operations,
  caseContext,
  consoleControls,
  onPerformCaseAction,
}: {
  state: PrismaxPilotInterfaceState
  dispatch: Dispatch<PrismaxPilotInterfaceAction>
  operations: PrismaxPilotOperationsDisplay
  caseContext?: PrismaxPilotCaseContext
  consoleControls?: CrrtConsoleControlsModel
  onPerformCaseAction?: (interventionId: string) => void
}) {
  const pressures = [
    ['Access', operations.pressures.accessPressureMmHg],
    ['Filter', operations.pressures.filterPressureMmHg],
    ['Return', operations.pressures.returnPressureMmHg],
    ['Effluent', operations.pressures.effluentPressureMmHg],
    ['TMP', operations.pressures.transmembranePressureMmHg],
    ['ΔP', operations.pressures.filterPressureDropMmHg],
  ] as const
  const running = operations.treatmentState === 'running'
  const ended = operations.treatmentState === 'ended'
  const stopButtonRef = useRef<HTMLButtonElement>(null)
  const resumeButtonRef = useRef<HTMLButtonElement>(null)
  const endButtonRef = useRef<HTMLButtonElement>(null)
  const stopDialogRef = useRef<HTMLElement>(null)
  const wasStopDialogOpen = useRef(false)

  useEffect(() => {
    if (state.stopDialogOpen) {
      wasStopDialogOpen.current = true
      resumeButtonRef.current?.focus()
      return
    }

    if (wasStopDialogOpen.current) {
      wasStopDialogOpen.current = false
      stopButtonRef.current?.focus()
    }
  }, [state.stopDialogOpen])

  useEffect(() => {
    if (!state.stopDialogOpen) return

    function isOutsideDialog(event: Event) {
      const target = event.target
      return target instanceof Node && !stopDialogRef.current?.contains(target)
    }

    function blockOutsidePointerInteraction(event: Event) {
      if (!isOutsideDialog(event)) return
      event.preventDefault()
      event.stopPropagation()
    }

    function keepFocusInDialog(event: FocusEvent) {
      if (!isOutsideDialog(event)) return
      resumeButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', blockOutsidePointerInteraction, true)
    document.addEventListener('click', blockOutsidePointerInteraction, true)
    document.addEventListener('focusin', keepFocusInDialog, true)
    return () => {
      document.removeEventListener('pointerdown', blockOutsidePointerInteraction, true)
      document.removeEventListener('click', blockOutsidePointerInteraction, true)
      document.removeEventListener('focusin', keepFocusInDialog, true)
    }
  }, [state.stopDialogOpen])

  function closeStopDialog() {
    dispatch({ type: 'CLOSE_STOP_DIALOG' })
  }

  function handleStopDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeStopDialog()
      return
    }

    if (event.key !== 'Tab') return
    const firstControl = resumeButtonRef.current
    const lastControl = endButtonRef.current
    if (!firstControl || !lastControl) return

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault()
      lastControl.focus()
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault()
      firstControl.focus()
    }
  }

  return (
    <div className={styles.operationsScreen} data-running={running}>
      <div className={styles.operationsHeader}>
        <div>
          <span>
            Therapy Operations ·{' '}
            {caseContext ? `${caseIdentifier(caseContext)} simulated case` : 'CVVHD orientation'}
          </span>
          <strong>
            {running
              ? 'Interface run active'
              : ended
                ? 'Interface run ended'
                : 'Therapy paused · pumps stopped'}
          </strong>
        </div>
        <span className={styles.runState}>
          <i aria-hidden="true" /> {running ? 'Pumps active' : 'Pumps stopped'}
        </span>
      </div>

      <div className={styles.pumpStrip} aria-label="Pilot flow displays">
        <div>
          <span>BFR</span>
          <strong>{formatFlow(operations.flows?.bloodFlowMlMin ?? null, 'mL/min')}</strong>
        </div>
        <div>
          <span>Dialysate</span>
          <strong>{formatFlow(operations.flows?.dialysateFlowMlHour ?? null, 'mL/h')}</strong>
        </div>
        <div>
          <span>PFR</span>
          <strong>{formatFlow(operations.flows?.patientFluidRemovalMlHour ?? null, 'mL/h')}</strong>
        </div>
        <div>
          <span>Effluent target</span>
          <strong>{formatFlow(operations.effluentPumpTargetMlHour, 'mL/h')}</strong>
        </div>
      </div>

      {consoleControls && consoleControls.settingActions.length > 0 ? (
        <section className={styles.caseSettingPanel} aria-labelledby="prismax-case-setting-heading">
          <div className={styles.caseSettingHeading}>
            <SlidersHorizontal aria-hidden="true" />
            <div>
              <span>Active case controls</span>
              <h4 id="prismax-case-setting-heading">Adjust case-relevant machine settings</h4>
            </div>
          </div>
          <p className={styles.caseSettingBoundary}>
            Only choices written into this exercise are available. These simulated values are not
            clinical targets, device limits, or unrestricted bedside controls.
          </p>

          {consoleControls.prerequisiteActions.some(({ performed }) => !performed) ? (
            <div className={styles.consolePrerequisites}>
              <strong>Required clinical step</strong>
              {consoleControls.prerequisiteActions.map((action) => (
                <article key={action.id} data-complete={action.performed}>
                  <ClipboardCheck aria-hidden="true" />
                  <div>
                    <span>{action.category}</span>
                    <h5>{action.label}</h5>
                    <p>{action.description}</p>
                    {action.missingPrerequisiteLabels.length > 0 ? (
                      <small>Requires {action.missingPrerequisiteLabels.join(', ')}.</small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={action.performed || !action.enabled || !onPerformCaseAction}
                    aria-label={`Record clinical step: ${action.label}`}
                    onClick={() => onPerformCaseAction?.(action.id)}
                  >
                    {action.performed ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                    {action.performed ? 'Completed' : 'Record step'}
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          <div className={styles.caseSettingGrid}>
            {consoleControls.settingActions.map((action) => (
              <article key={action.id} data-unsafe={action.unsafe} data-complete={action.performed}>
                <div className={styles.caseSettingTitle}>
                  <span>{action.unsafe ? 'Unsafe comparison path' : 'Case setting'}</span>
                  <h5>{action.label}</h5>
                  <p>{action.description}</p>
                </div>
                <dl>
                  {action.changes.map((change) => (
                    <div key={`${action.id}-${change.target}`}>
                      <dt>{change.label}</dt>
                      <dd>{change.instruction}</dd>
                    </div>
                  ))}
                </dl>
                {action.missingPrerequisiteLabels.length > 0 ? (
                  <small>Requires {action.missingPrerequisiteLabels.join(', ')}.</small>
                ) : null}
                <button
                  type="button"
                  disabled={!action.enabled || !onPerformCaseAction}
                  aria-label={`Apply case setting: ${action.label}`}
                  onClick={() => onPerformCaseAction?.(action.id)}
                >
                  {action.performed && !action.repeatable ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <SlidersHorizontal aria-hidden="true" />
                  )}
                  {action.performed && !action.repeatable
                    ? 'Applied'
                    : action.performed
                      ? 'Apply again'
                      : action.unsafe
                        ? 'Choose unsafe path'
                        : 'Apply setting change'}
                </button>
                {action.performed ? <p role="status">{action.response}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.operationsBody}>
        <section aria-labelledby="phase3-pressure-heading">
          <div className={styles.subscreenHeading}>
            <Gauge aria-hidden="true" />
            <h4 id="phase3-pressure-heading">Pressure display</h4>
          </div>
          <div className={styles.pressureGrid} role="list" aria-label="Simulated pressure signals">
            {pressures.map(([label, value]) => (
              <div key={label} role="listitem">
                <span>{label}</span>
                <strong>{value === null ? '—' : `${value.toFixed(0)} mmHg`}</strong>
                <small>{value === null ? 'No case signal' : 'Simulated case value'}</small>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="phase3-dose-heading">
          <div className={styles.subscreenHeading}>
            <MonitorCog aria-hidden="true" />
            <h4 id="phase3-dose-heading">Treatment status</h4>
          </div>
          <dl className={styles.statusList}>
            <div>
              <dt>Prescribed dose</dt>
              <dd>
                {formatMetric(operations.effluentDoseMlKgHour, 'mL/kg/h')}{' '}
                <small>{caseContext ? 'simulated case value' : 'case weight required'}</small>
              </dd>
            </div>
            <div>
              <dt>Delivered dose</dt>
              <dd>
                {formatMetric(operations.deliveredDoseMlKgHour, 'mL/kg/h')}{' '}
                <small>
                  {caseContext ? 'includes simulated downtime' : 'simulation not running'}
                </small>
              </dd>
            </div>
            <div>
              <dt>Machine removal / whole balance</dt>
              <dd>
                {formatMetric(operations.cumulativeMachinePatientFluidRemovalMl, 'mL', 0)} /{' '}
                {formatMetric(operations.cumulativeWholePatientBalanceMl, 'mL', 0)}{' '}
                <small>{caseContext ? 'distinct model outputs' : 'no elapsed case time'}</small>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section
        className={styles.alarmWindow}
        aria-labelledby="phase3-alarm-heading"
        aria-live={operations.activeAlarmCodes.length > 0 ? 'assertive' : 'polite'}
        data-active={operations.activeAlarmCodes.length > 0}
      >
        <div>
          <AlertTriangle aria-hidden="true" />
          <span>Alarm window</span>
          <strong id="phase3-alarm-heading">
            {operations.activeAlarmCodes.length > 0
              ? operations.activeAlarmCodes.join(', ')
              : 'No active alarms'}
          </strong>
        </div>
        <p>
          {operations.activeAlarmCodes.length > 0
            ? 'A generic training alert is shown. Review the patient and circuit, identify the cause, and verify resolution; acknowledgement alone does not resolve the problem.'
            : 'This exercise does not reproduce exact alarm names, priorities, thresholds, pump or clamp reactions, or correction steps. Follow current device instructions and local policy.'}
        </p>
        <p className={styles.alarmPriority}>
          <strong>Priority status:</strong> not mapped — independent device review required.
        </p>
        <button disabled type="button">
          Acknowledge unavailable
        </button>
      </section>

      <div className={styles.messageCenter} role="status" aria-live="polite">
        <FileClock aria-hidden="true" />
        <div>
          <span>Most recent interface event</span>
          <strong>
            {running
              ? caseContext
                ? `${caseIdentifier(caseContext)} case in progress`
                : 'Case-free equipment checkout started'
              : ended
                ? 'Interface run ended; reload outside the facsimile'
                : 'Simulation delivery paused; use the case intervention to resume'}
          </strong>
        </div>
      </div>

      {running ? (
        <button
          ref={stopButtonRef}
          className={styles.stopAction}
          type="button"
          onClick={() => dispatch({ type: 'OPEN_STOP_DIALOG' })}
        >
          <CircleStop aria-hidden="true" /> Stop
        </button>
      ) : null}

      {state.stopDialogOpen ? (
        <div className={styles.dialogBackdrop}>
          <section
            ref={stopDialogRef}
            className={styles.stopDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="phase3-stop-dialog-title"
            aria-describedby="phase3-stop-dialog-description"
            onKeyDown={handleStopDialogKeyDown}
          >
            <CircleStop aria-hidden="true" />
            <div>
              <span>Stop interface run</span>
              <h4 id="phase3-stop-dialog-title">End this equipment checkout?</h4>
              <p id="phase3-stop-dialog-description">
                End is irreversible until a clean reload. Return-blood and recirculation decisions
                are deliberately not simulated without reviewed policy and case context.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <button ref={resumeButtonRef} type="button" onClick={closeStopDialog}>
                Resume interface
              </button>
              <button
                ref={endButtonRef}
                type="button"
                onClick={() => dispatch({ type: 'END_TREATMENT' })}
              >
                End interface run
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function PrismaxHardwareOrientation({ state }: { state: PrismaxPilotInterfaceState }) {
  const [selectedHotspotId, setSelectedHotspotId] = useState<PrismaxSimulatorHotspotId>(
    prismaxSimulatorHotspots[0].id,
  )
  const selectedHotspot =
    prismaxSimulatorHotspots.find(({ id }) => id === selectedHotspotId) ??
    prismaxSimulatorHotspots[0]
  const stateLabel =
    state.treatmentState === 'running'
      ? 'Simulated treatment active'
      : state.treatmentState === 'ended'
        ? 'Run ended'
        : state.screen === 'operations'
          ? 'Operations paused'
          : state.screen === 'setup'
            ? 'Setup checks underway'
            : 'Ready for new attempt'

  return (
    <section className={styles.hardwarePanel} aria-labelledby="prismax-hardware-heading">
      <header className={styles.hardwareHeading}>
        <span>Generated equipment orientation</span>
        <h3 id="prismax-hardware-heading">Explore the physical machine</h3>
        <p>
          Select a numbered region to connect the hardware layout with the functional touchscreen
          simulator.
        </p>
      </header>

      <div className={styles.machineVisual}>
        <Image
          alt={prismaxSimulatorArtwork.alt}
          fill
          sizes="(max-width: 1100px) 100vw, 32vw"
          src={prismaxSimulatorArtwork.src}
        />
        <span className={styles.machineStateBadge} data-state={state.treatmentState}>
          {stateLabel}
        </span>
        <div className={styles.hotspotLayer} role="group" aria-label="CRRT machine regions">
          {prismaxSimulatorHotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              aria-controls="prismax-hardware-detail"
              aria-label={`Explore ${hotspot.label}`}
              aria-pressed={selectedHotspot.id === hotspot.id}
              style={{ left: `${hotspot.xPercent}%`, top: `${hotspot.yPercent}%` }}
              onClick={() => setSelectedHotspotId(hotspot.id)}
            >
              {hotspot.ordinal}
            </button>
          ))}
        </div>
      </div>

      <div id="prismax-hardware-detail" className={styles.hardwareDetail} aria-live="polite">
        <span>{selectedHotspot.ordinal}</span>
        <div>
          <h4>{selectedHotspot.label}</h4>
          <p>{selectedHotspot.description}</p>
          <small>PrisMax Operator&apos;s Manual · cited hardware-orientation section</small>
        </div>
      </div>

      <div className={styles.hardwareKey} role="group" aria-label="Machine region key">
        {prismaxSimulatorHotspots.map((hotspot) => (
          <button
            key={hotspot.id}
            type="button"
            aria-pressed={selectedHotspot.id === hotspot.id}
            onClick={() => setSelectedHotspotId(hotspot.id)}
          >
            <span>{hotspot.ordinal}</span>
            {hotspot.shortLabel}
          </button>
        ))}
      </div>

      <small className={styles.artworkNote}>
        {prismaxSimulatorArtwork.generationMethod} No product logo or copied screen artwork.
      </small>
    </section>
  )
}

export function PrismaxPilotInterface({
  state,
  dispatch,
  controlsEnabled = true,
  controlsUnavailableReason,
  consoleControls,
  operationsDisplay,
  caseContext,
  onPerformCaseAction,
  onReset,
}: PrismaxPilotInterfaceProps) {
  const view = selectPrismaxPilotInterface(state)
  const operations = operationsDisplay ?? selectPrismaxPilotOperationsDisplay(state)

  return (
    <div className={styles.interfaceFrame}>
      {!controlsEnabled ? (
        <div className={styles.unavailableNotice} role="status">
          <LockKeyhole aria-hidden="true" />
          <div>
            <span>
              <strong>This run is read-only</strong>
              {controlsUnavailableReason === 'debrief'
                ? 'Start a clean attempt to make additional treatment or machine changes.'
                : 'Start a clean attempt to use the educational device controls.'}
            </span>
          </div>
        </div>
      ) : null}

      <div className={styles.simulatorWorkbench}>
        <PrismaxHardwareOrientation state={state} />

        <fieldset className={styles.controlFieldset} disabled={!controlsEnabled}>
          <legend className={styles.visuallyHidden}>
            {controlsEnabled
              ? 'Educational device controls'
              : 'Educational device controls unavailable'}
          </legend>
          <section
            className={styles.consoleShell}
            aria-label="Original PrisMax functional educational facsimile"
          >
            <div className={styles.consoleTop}>
              <div>
                <Power aria-hidden="true" />
                <span>Independent educational interface</span>
              </div>
              <span data-state={state.treatmentState}>
                {state.treatmentState === 'running'
                  ? 'RUNNING'
                  : state.treatmentState === 'ended'
                    ? 'ENDED'
                    : state.screen === 'operations'
                      ? 'PAUSED'
                      : 'SETUP'}
              </span>
            </div>

            <div className={styles.touchscreen}>
              <nav className={styles.toolbar} aria-label="Educational device toolbar">
                <span>
                  <History aria-hidden="true" /> History <small>Case timeline</small>
                </span>
                <span>
                  <Settings aria-hidden="true" /> Tools <small>Excluded</small>
                </span>
                <span>
                  <LockKeyhole aria-hidden="true" /> Lock <small>Excluded</small>
                </span>
                <span>
                  <HelpCircle aria-hidden="true" /> Help <small>Sources below</small>
                </span>
              </nav>

              {state.screen === 'start' ? (
                <div className={styles.startScreen}>
                  <div>
                    <span>
                      {caseContext
                        ? 'Clinical curriculum · simulated case'
                        : 'Orientation · manufacturer-manual workflow'}
                    </span>
                    <h3>
                      {caseContext
                        ? `Start ${caseIdentifier(caseContext)}: ${caseTitle(caseContext)}`
                        : 'Start a case-free interface checkout'}
                    </h3>
                    <p>
                      {caseContext
                        ? 'No patient identifiers or patient-entered data are used. All physiology, pressure, alert, and response values are simulated for education.'
                        : 'No patient identifiers, default prescription, physiology, pressure, alarm fault, or clinical target is loaded.'}
                    </p>
                  </div>
                  <div className={styles.startChoices}>
                    <button type="button" onClick={() => dispatch({ type: 'SELECT_NEW_PATIENT' })}>
                      <strong>New Patient</strong>
                      <span>
                        {caseContext
                          ? 'Begin a new case attempt'
                          : 'Begin a blank educational setup'}
                      </span>
                    </button>
                    <button
                      aria-describedby="same-patient-unavailable"
                      disabled={!view.samePatientAvailable}
                      type="button"
                    >
                      <strong>Same Patient</strong>
                      <span>No prior simulated case</span>
                    </button>
                  </div>
                  <small id="same-patient-unavailable">
                    Same Patient is unavailable because the reference documents do not provide one
                    supported workflow for this exercise.
                  </small>
                </div>
              ) : state.screen === 'setup' ? (
                <div className={styles.procedureScreen}>
                  <ol className={styles.stepRail} aria-label="PrisMax educational setup sequence">
                    {view.stepStatuses.map(({ step, status }, index) => (
                      <li
                        key={step.id}
                        data-status={status}
                        aria-current={status === 'current' ? 'step' : undefined}
                      >
                        <span>
                          {status === 'complete' ? <Check aria-hidden="true" /> : index + 1}
                        </span>
                        <div>
                          <strong>{formatStepLabel(step.id as PrismaxSetupStepId)}</strong>
                          <small>{status}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.procedureBody}>
                    <SetupStepContent state={state} dispatch={dispatch} caseContext={caseContext} />
                  </div>
                </div>
              ) : (
                <OperationsScreen
                  state={state}
                  dispatch={dispatch}
                  operations={operations}
                  caseContext={caseContext}
                  consoleControls={consoleControls}
                  onPerformCaseAction={onPerformCaseAction}
                />
              )}
            </div>

            <footer className={styles.consoleFooter}>
              <span>Educational facsimile · not a medical device</span>
              <span>AW8035 Rev B manual-reference profile · no local override loaded</span>
            </footer>
          </section>

          {state.treatmentState === 'ended' ? (
            <aside className={styles.resetDock} aria-label="Simulator clean reload">
              <div>
                <RotateCcw aria-hidden="true" />
                <span>
                  <strong>Run ended</strong>
                  Reloading creates a fresh interface state and does not invoke Same Patient.
                </span>
              </div>
              <button
                autoFocus
                type="button"
                onClick={() => (onReset ? onReset() : dispatch({ type: 'RESET_INTERFACE' }))}
              >
                Reload clean interface
              </button>
            </aside>
          ) : null}
        </fieldset>
      </div>
    </div>
  )
}
