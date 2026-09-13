import type { Dispatch } from 'react'
import { mcsLearnControls } from '../../content/learnControls'
import { isMcsLearningActionPermitted } from '../../engine/learningSession'
import type { McsAction, McsSimulationState } from '../../engine/types'
import { RangeControl } from '../McsControls'
import styles from './mcs-stage.module.css'

/** The same registered controls and reducer, restricted to this learning task. */
export function McsTaskControls({
  state,
  dispatch,
  allowedActionIds,
  disabled = false,
}: {
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
  allowedActionIds: readonly string[]
  disabled?: boolean
}) {
  const controls = Object.values(mcsLearnControls).filter(
    (control) =>
      allowedActionIds.includes(control.actionId) && control.location !== 'guided-actions',
  )
  if (!controls.length)
    return (
      <p data-task-controls-locked>
        No device or patient adjustment is part of this task. Use the Read or Select buttons in
        Steps when requested.
      </p>
    )
  return (
    <section className={styles.block} data-task-controls aria-label="Controls for this task">
      {controls.map((control) => {
        const condition =
          control.id === 'control:patient-svr' || control.id === 'control:impella-left-position'
        const range = (
          label: string,
          value: number,
          min: number,
          max: number,
          step: number,
          unit: string,
          action: (value: number) => McsAction,
        ) => (
          <RangeControl
            label={label}
            value={value}
            minimum={min}
            maximum={max}
            step={step}
            unit={unit}
            controlId={control.id}
            highlightControl={control.id}
            disabled={
              disabled || !isMcsLearningActionPermitted(state, action(value), allowedActionIds)
            }
            onChange={(v) => dispatch(action(v))}
          />
        )
        return (
          <div key={control.id}>
            <p className={styles.kicker}>
              {condition ? 'Simulated patient condition / fault' : 'Device setting'}
            </p>
            {control.id === 'control:patient-svr'
              ? range(
                  'SVR',
                  state.patient.systemicVascularResistanceDynSecCm5,
                  400,
                  2200,
                  25,
                  'dyn·s·cm⁻⁵',
                  (value) => ({
                    type: 'SET_PATIENT_CONTROL',
                    control: 'systemicVascularResistanceDynSecCm5',
                    value,
                  }),
                )
              : null}
            {control.id === 'control:iabp-inflation' && state.device.kind === 'iabp'
              ? range(
                  'Inflation vs notch',
                  state.device.inflationOffsetMs,
                  -180,
                  180,
                  10,
                  'ms',
                  (value) => ({ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value }),
                )
              : null}
            {control.id === 'control:impella-left-level' && state.device.kind === 'impella'
              ? range(
                  'Performance level',
                  state.device.left.performanceLevel,
                  1,
                  9,
                  1,
                  '',
                  (value) => ({
                    type: 'SET_IMPELLA_CONTROL',
                    side: 'left',
                    control: 'performanceLevel',
                    value,
                  }),
                )
              : null}
            {control.id === 'control:impella-left-position' && state.device.kind === 'impella' ? (
              <label>
                Simulated placement condition
                <select
                  aria-label="Placement state"
                  value={state.device.left.position}
                  disabled={
                    disabled ||
                    !isMcsLearningActionPermitted(
                      state,
                      { type: 'SET_IMPELLA_CONTROL', control: 'position', value: 'too-deep' },
                      allowedActionIds,
                    )
                  }
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_IMPELLA_CONTROL',
                      side: 'left',
                      control: 'position',
                      value: event.target.value,
                    })
                  }
                >
                  <option value="correct">Aligned</option>
                  <option value="too-deep">Too deep</option>
                  <option value="too-shallow">Too shallow</option>
                </select>
              </label>
            ) : null}
            {control.id === 'control:iabp-trigger' && state.device.kind === 'iabp' ? (
              <label>
                Trigger source
                <select
                  value={state.device.triggerSource}
                  disabled={
                    disabled ||
                    !isMcsLearningActionPermitted(
                      state,
                      { type: 'SET_IABP_CONTROL', control: 'triggerSource', value: 'pressure' },
                      allowedActionIds,
                    )
                  }
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_IABP_CONTROL',
                      control: 'triggerSource',
                      value: event.target.value,
                    })
                  }
                >
                  <option value="ecg">ECG</option>
                  <option value="pressure">Arterial pressure</option>
                  <option value="internal">Internal</option>
                </select>
              </label>
            ) : null}
            <p>
              {control.changes} {control.doesNotGuarantee}
            </p>
          </div>
        )
      })}
      <p className={styles.footnote}>
        Each setting change repeats the observation from this task’s captured baseline for eight
        simulated seconds. Other settings stay fixed. The interval is a teaching choice, not a
        clinical stabilization time.
      </p>
    </section>
  )
}
