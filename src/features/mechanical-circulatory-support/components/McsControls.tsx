'use client'

import type { Dispatch } from 'react'

import {
  isMcsActionIdPermitted,
  type ImpellaDeviceState,
  type ImpellaSide,
  type McsAction,
  type McsPatientControl,
  type McsSimulationState,
} from '../engine'
import styles from './mechanical-circulatory-support.module.css'

const patientControls: readonly {
  id: McsPatientControl
  label: string
  minimum: number
  maximum: number
  step: number
  unit: string
}[] = [
  { id: 'preloadPercent', label: 'Preload', minimum: 50, maximum: 145, step: 1, unit: '%' },
  { id: 'heartRateBpm', label: 'Heart rate', minimum: 40, maximum: 180, step: 1, unit: 'bpm' },
  {
    id: 'systemicVascularResistanceDynSecCm5',
    label: 'SVR',
    minimum: 400,
    maximum: 2200,
    step: 25,
    unit: 'dyn·s·cm⁻⁵',
  },
  {
    id: 'leftVentricularContractility',
    label: 'LV contractility',
    minimum: 0.2,
    maximum: 1.4,
    step: 0.02,
    unit: 'relative',
  },
  {
    id: 'rightVentricularContractility',
    label: 'RV contractility',
    minimum: 0.2,
    maximum: 1.4,
    step: 0.02,
    unit: 'relative',
  },
  {
    id: 'pulmonaryVascularResistanceWU',
    label: 'PVR',
    minimum: 0.5,
    maximum: 9,
    step: 0.1,
    unit: 'WU',
  },
  { id: 'peepCmH2O', label: 'PEEP', minimum: 0, maximum: 20, step: 1, unit: 'cm H₂O' },
  {
    id: 'aorticInsufficiencySeverity',
    label: 'Aortic insufficiency',
    minimum: 0,
    maximum: 1,
    step: 0.1,
    unit: 'severity',
  },
]

function RangeControl({
  label,
  value,
  minimum,
  maximum,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string
  value: number
  minimum: number
  maximum: number
  step: number
  unit: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={styles.rangeControl}>
      <span>
        <strong>{label}</strong>
        <output>
          {value.toFixed(step < 1 ? 1 : 0)} <small>{unit}</small>
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ImpellaPumpControls({
  side,
  device,
  disabled,
  dispatch,
}: {
  side: ImpellaSide
  device: ImpellaDeviceState
  disabled: (actionId: string) => boolean
  dispatch: Dispatch<McsAction>
}) {
  const pump = device[side]
  const sideLabel =
    side === 'left' ? (device.left.variant === '55' ? 'Impella 5.5' : 'Impella CP') : 'Impella RP'
  const actionId = (control: 'running' | 'performanceLevel' | 'position' | 'purgeState') =>
    `impella:${side}:set-${
      control === 'performanceLevel' ? 'level' : control === 'purgeState' ? 'purge' : control
    }`
  const positionOptions =
    side === 'left'
      ? [
          ['correct', 'Aligned'],
          ['too-deep', 'Too deep'],
          ['too-shallow', 'Too shallow'],
        ]
      : [
          ['correct', 'Aligned IVC-to-PA relationship'],
          ['inlet-too-high', 'Inlet too high'],
          ['outlet-too-proximal', 'Outlet too proximal'],
          ['too-distal', 'Outlet too distal'],
        ]

  return (
    <fieldset className={styles.impellaPumpControls}>
      <legend>{sideLabel}</legend>
      <div className={styles.controlGrid}>
        <label className={styles.checkControl}>
          <input
            type="checkbox"
            checked={pump.running}
            disabled={disabled(actionId('running'))}
            onChange={(event) =>
              dispatch({
                type: 'SET_IMPELLA_CONTROL',
                side,
                control: 'running',
                value: event.target.checked,
              })
            }
          />
          <span>
            <strong>Pump support</strong>
            <small>{pump.running ? 'Running' : 'Paused'}</small>
          </span>
        </label>
        <RangeControl
          label="Performance level"
          value={pump.performanceLevel}
          minimum={0}
          maximum={9}
          step={1}
          unit="P-level"
          disabled={disabled(actionId('performanceLevel'))}
          onChange={(value) =>
            dispatch({ type: 'SET_IMPELLA_CONTROL', side, control: 'performanceLevel', value })
          }
        />
        <label className={styles.selectControl}>
          <span>Placement state</span>
          <select
            value={pump.position}
            disabled={disabled(actionId('position'))}
            onChange={(event) =>
              dispatch({
                type: 'SET_IMPELLA_CONTROL',
                side,
                control: 'position',
                value: event.target.value,
              })
            }
          >
            {positionOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectControl}>
          <span>Purge-system state</span>
          <select
            value={pump.purgeState}
            disabled={disabled(actionId('purgeState'))}
            onChange={(event) =>
              dispatch({
                type: 'SET_IMPELLA_CONTROL',
                side,
                control: 'purgeState',
                value: event.target.value,
              })
            }
          >
            <option value="normal">Normal</option>
            <option value="high-pressure">High pressure</option>
            <option value="low-pressure">Low pressure</option>
          </select>
        </label>
      </div>
    </fieldset>
  )
}

export function McsControls({
  state,
  dispatch,
}: {
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
}) {
  const unavailable = (actionId: string) => !isMcsActionIdPermitted(state, actionId)
  const patientActionId = (control: McsPatientControl) =>
    control === 'preloadPercent'
      ? 'patient:set-preload'
      : control === 'systemicVascularResistanceDynSecCm5'
        ? 'patient:set-svr'
        : control === 'rightVentricularContractility'
          ? 'patient:set-rv'
          : control === 'pulmonaryVascularResistanceWU'
            ? 'patient:set-pvr'
            : 'patient:adjust'
  return (
    <section className={styles.controlsCard} aria-label="Patient and mechanical-support controls">
      <header>
        <div>
          <span className={styles.kicker}>BOUNDED CONTROLS</span>
          <h2>Change one variable, then read the system</h2>
        </div>
        <span className={styles.liveBadge}>Controls available</span>
      </header>
      <details open className={styles.controlGroup}>
        <summary>Patient conditions</summary>
        <div className={styles.controlGrid}>
          {patientControls.map((control) => (
            <RangeControl
              key={control.id}
              label={control.label}
              value={state.patient[control.id]}
              minimum={control.minimum}
              maximum={control.maximum}
              step={control.step}
              unit={control.unit}
              disabled={unavailable(patientActionId(control.id))}
              onChange={(value) =>
                dispatch({ type: 'SET_PATIENT_CONTROL', control: control.id, value })
              }
            />
          ))}
          <label className={styles.selectControl}>
            <span>Rhythm</span>
            <select
              value={state.patient.rhythm}
              disabled={unavailable('patient:set-rhythm')}
              onChange={(event) =>
                dispatch({
                  type: 'SET_RHYTHM',
                  rhythm: event.target.value as typeof state.patient.rhythm,
                })
              }
            >
              <option value="sinus">Sinus</option>
              <option value="atrial-fibrillation">Atrial fibrillation</option>
              <option value="paced">Paced</option>
            </select>
          </label>
          <label className={styles.checkControl}>
            <input
              type="checkbox"
              checked={state.patient.tamponade}
              disabled={unavailable('patient:set-tamponade')}
              onChange={(event) =>
                dispatch({ type: 'SET_TAMPONADE', active: event.target.checked })
              }
            />
            <span>
              <strong>Pericardial constraint</strong>
              <small>Selected obstruction fault</small>
            </span>
          </label>
        </div>
      </details>

      <details open className={styles.controlGroup}>
        <summary>
          {state.deviceKind === 'iabp'
            ? 'IABP counterpulsation'
            : state.deviceKind === 'impella'
              ? 'Impella left, right, or biventricular support'
              : 'Durable continuous-flow LVAD'}
        </summary>
        {state.device.kind === 'iabp' ? (
          <div className={styles.controlGrid}>
            <label className={styles.checkControl}>
              <input
                type="checkbox"
                checked={state.device.running}
                disabled={unavailable('iabp:set-running')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_IABP_CONTROL',
                    control: 'running',
                    value: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Console support</strong>
                <small>{state.device.running ? 'Running' : 'Paused'}</small>
              </span>
            </label>
            <label className={styles.selectControl}>
              <span>Assist ratio</span>
              <select
                value={state.device.assistRatio}
                disabled={unavailable('iabp:set-ratio')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_IABP_CONTROL',
                    control: 'assistRatio',
                    value: Number(event.target.value),
                  })
                }
              >
                <option value={1}>1:1</option>
                <option value={2}>1:2</option>
                <option value={3}>1:3</option>
              </select>
            </label>
            <label className={styles.selectControl}>
              <span>Trigger source</span>
              <select
                value={state.device.triggerSource}
                disabled={unavailable('iabp:set-trigger')}
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
            <RangeControl
              label="Inflation vs notch"
              value={state.device.inflationOffsetMs}
              minimum={-180}
              maximum={180}
              step={5}
              unit="ms"
              disabled={unavailable('iabp:set-inflation')}
              onChange={(value) =>
                dispatch({ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value })
              }
            />
            <RangeControl
              label="Deflation vs systole"
              value={state.device.deflationOffsetMs}
              minimum={-180}
              maximum={180}
              step={5}
              unit="ms"
              disabled={unavailable('iabp:set-deflation')}
              onChange={(value) =>
                dispatch({ type: 'SET_IABP_CONTROL', control: 'deflationOffsetMs', value })
              }
            />
          </div>
        ) : state.device.kind === 'impella' ? (
          <div className={styles.impellaControlStack}>
            <div className={styles.impellaConfiguration}>
              <label className={styles.selectControl}>
                <span>Left-sided support</span>
                <select
                  aria-label="Left-sided Impella configuration"
                  value={state.device.left.enabled ? state.device.left.variant : 'off'}
                  disabled={
                    unavailable('impella:enable-left') && unavailable('impella:set-left-variant')
                  }
                  onChange={(event) => {
                    if (event.target.value === 'off') {
                      dispatch({
                        type: 'SET_IMPELLA_CONFIGURATION',
                        control: 'leftEnabled',
                        value: false,
                      })
                      return
                    }
                    dispatch({
                      type: 'SET_IMPELLA_CONFIGURATION',
                      control: 'leftVariant',
                      value: event.target.value as 'cp' | '55',
                    })
                  }}
                >
                  <option value="off">Off</option>
                  <option value="cp">Impella CP</option>
                  <option value="55">Impella 5.5</option>
                </select>
              </label>
              <label className={styles.selectControl}>
                <span>Right-sided support</span>
                <select
                  aria-label="Right-sided Impella configuration"
                  value={state.device.right.enabled ? 'rp' : 'off'}
                  disabled={unavailable('impella:enable-right')}
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
            </div>
            <p className={styles.impellaBalanceNote}>
              Left flow unloads the LV and contributes to systemic output. RP flow bypasses the RV
              into the pulmonary artery and is displayed separately—it is never added directly to
              systemic flow.
            </p>
            {state.device.left.enabled ? (
              <ImpellaPumpControls
                side="left"
                device={state.device}
                disabled={unavailable}
                dispatch={dispatch}
              />
            ) : null}
            {state.device.right.enabled ? (
              <ImpellaPumpControls
                side="right"
                device={state.device}
                disabled={unavailable}
                dispatch={dispatch}
              />
            ) : null}
          </div>
        ) : (
          <div className={styles.controlGrid}>
            <label className={styles.checkControl}>
              <input
                type="checkbox"
                checked={state.device.powerConnected}
                disabled={unavailable('lvad:set-power')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_LVAD_CONTROL',
                    control: 'powerConnected',
                    value: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Approved power path</strong>
                <small>{state.device.powerConnected ? 'Connected' : 'Disconnected'}</small>
              </span>
            </label>
            <label className={styles.checkControl}>
              <input
                type="checkbox"
                checked={state.device.speedChangeAuthorized}
                disabled={unavailable('lvad:authorize-speed')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_LVAD_CONTROL',
                    control: 'speedChangeAuthorized',
                    value: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Authorized-personnel order</strong>
                <small>Simulation authorization only</small>
              </span>
            </label>
            <RangeControl
              label="Pump speed"
              value={state.device.speedRpm}
              minimum={4600}
              maximum={6200}
              step={100}
              unit="rpm"
              disabled={unavailable('lvad:set-speed') || !state.device.speedChangeAuthorized}
              onChange={(value) =>
                dispatch({ type: 'SET_LVAD_CONTROL', control: 'speedRpm', value })
              }
            />
            <label className={styles.checkControl}>
              <input
                type="checkbox"
                checked={state.device.controllerFault}
                disabled={unavailable('lvad:set-controller')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_LVAD_CONTROL',
                    control: 'controllerFault',
                    value: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Controller fault</strong>
                <small>Selected device fault</small>
              </span>
            </label>
            <label className={styles.checkControl}>
              <input
                type="checkbox"
                checked={state.device.suspectedPumpThrombosis}
                disabled={unavailable('lvad:set-thrombosis')}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_LVAD_CONTROL',
                    control: 'suspectedPumpThrombosis',
                    value: event.target.checked,
                  })
                }
              />
              <span>
                <strong>High-power / thrombosis pattern</strong>
                <small>Selected obstruction fault</small>
              </span>
            </label>
          </div>
        )}
      </details>
      {state.device.kind === 'lvad' ? (
        <p className={styles.authorityNote}>
          <strong>Authorized simulation only.</strong> Real LVAD speed changes require current
          labeling, the prescribing MCS team, and appropriately credentialed personnel.
        </p>
      ) : null}
    </section>
  )
}
