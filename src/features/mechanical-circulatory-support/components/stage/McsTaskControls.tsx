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
        No adjustment is suggested for this task. Explore all supported controls below if you want
        to vary the model.
      </p>
    )
  return (
    <section className={styles.block} data-task-controls aria-label="Controls for this task">
      {controls.map((control) => {
        const meaning =
          control.id === 'control:patient-svr' || control.id === 'control:patient-rv-contractility'
            ? 'Simulated patient condition'
            : control.id === 'control:lvad-thrombosis' ||
                control.id === 'control:impella-left-position'
              ? 'Model fault'
              : control.id === 'control:impella-right-enable'
                ? 'Simulated device configuration'
                : 'Device setting'
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
            <p className={styles.kicker}>{meaning}</p>
            {control.id === 'control:patient-rv-contractility'
              ? range(
                  'RV contractility',
                  state.patient.rightVentricularContractility,
                  0.2,
                  1.4,
                  0.02,
                  'relative',
                  (value) => ({
                    type: 'SET_PATIENT_CONTROL',
                    control: 'rightVentricularContractility',
                    value,
                  }),
                )
              : null}
            {control.id === 'control:impella-right-enable' && state.device.kind === 'impella' ? (
              <label>
                Right-sided support
                <select
                  aria-label="Right-sided Impella configuration"
                  value={state.device.right.enabled ? 'rp' : 'off'}
                  disabled={
                    disabled ||
                    !isMcsLearningActionPermitted(
                      state,
                      { type: 'SET_IMPELLA_CONFIGURATION', control: 'rightEnabled', value: true },
                      allowedActionIds,
                    )
                  }
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_IMPELLA_CONFIGURATION',
                      control: 'rightEnabled',
                      value: event.target.value === 'rp',
                    })
                  }
                >
                  <option value="off">Off</option>
                  <option value="rp">Impella RP</option>
                </select>
              </label>
            ) : null}
            {control.id === 'control:lvad-thrombosis' && state.device.kind === 'lvad' ? (
              <label>
                <input
                  type="checkbox"
                  checked={state.device.suspectedPumpThrombosis}
                  disabled={
                    disabled ||
                    !isMcsLearningActionPermitted(
                      state,
                      { type: 'SET_LVAD_CONTROL', control: 'suspectedPumpThrombosis', value: true },
                      allowedActionIds,
                    )
                  }
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_LVAD_CONTROL',
                      control: 'suspectedPumpThrombosis',
                      value: event.target.checked,
                    })
                  }
                />
                High-power / thrombosis pattern
              </label>
            ) : null}
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
        These controls focus the suggested exercise. All supported controls remain available below.
        Patient properties and fault selectors create experimental conditions; they are not bedside
        treatments. Captures use the session model time, not a clinical stabilization interval.
      </p>
    </section>
  )
}
