'use client'

import type { Dispatch, ReactNode } from 'react'
import { CircleGauge, Droplets, HeartPulse, Power, ShieldCheck, Wind } from 'lucide-react'

import type {
  IcuCommand,
  IcuScenarioDefinition,
  IcuSimulationState,
  IcuTherapyControl,
  IcuTherapyId,
} from '../engine'
import styles from './icu-simulation.module.css'

interface DevicePanelProps {
  state: IcuSimulationState
  scenario: IcuScenarioDefinition
  dispatch: Dispatch<IcuCommand>
}

interface NumericControlProps {
  label: string
  value: number
  minimum: number
  maximum: number
  step: number
  unit: string
  disabled?: boolean
  onChange: (value: number) => void
}

function NumericControl({
  label,
  value,
  minimum,
  maximum,
  step,
  unit,
  disabled = false,
  onChange,
}: NumericControlProps) {
  return (
    <label className={styles.numericControl}>
      <span>
        <strong>{label}</strong>
        <output>
          {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(step < 0.1 ? 2 : 1)} {unit}
        </output>
      </span>
      <input
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={`${label}, ${value} ${unit}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className={styles.controlRange} aria-hidden="true">
        <small>{minimum}</small>
        <small>{maximum}</small>
      </span>
    </label>
  )
}

function statusCopy(status: 'off' | 'ready' | 'running') {
  if (status === 'running') return 'Running'
  if (status === 'ready') return 'Prepared'
  return 'Not prepared'
}

function DeviceShell({
  id,
  title,
  subtitle,
  status,
  available,
  icon,
  configuration,
  children,
  dispatch,
}: {
  id: IcuTherapyId
  title: string
  subtitle: string
  status: 'off' | 'ready' | 'running'
  available: boolean
  icon: ReactNode
  configuration?: string
  children: ReactNode
  dispatch: Dispatch<IcuCommand>
}) {
  return (
    <section
      className={styles.deviceCard}
      data-status={status}
      data-unavailable={!available || undefined}
      aria-labelledby={`${id}-device-title`}
    >
      <header className={styles.deviceHeader}>
        <span className={styles.deviceIcon}>{icon}</span>
        <div>
          <span>{subtitle}</span>
          <h3 id={`${id}-device-title`}>{title}</h3>
        </div>
        <span className={styles.deviceStatus} data-status={status}>
          <i aria-hidden="true" /> {available ? statusCopy(status) : 'Unavailable in this case'}
        </span>
      </header>

      {available ? (
        <>
          <div className={styles.deviceActions}>
            {status === 'off' ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'therapy.prepare', therapy: id, configuration })}
              >
                <ShieldCheck aria-hidden="true" /> Prepare with team
              </button>
            ) : status === 'ready' ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'therapy.start', therapy: id })}
              >
                <Power aria-hidden="true" /> Start support
              </button>
            ) : (
              <button
                type="button"
                className={styles.stopButton}
                onClick={() => dispatch({ type: 'therapy.stop', therapy: id })}
              >
                <Power aria-hidden="true" /> Stop support
              </button>
            )}
            <span>
              {status === 'off'
                ? 'Complete the supervised readiness workflow before changing support.'
                : status === 'ready'
                  ? 'Readiness confirmed. Review the goal before starting.'
                  : 'Adjust one setting, advance time, then reassess.'}
            </span>
          </div>
          <fieldset disabled={status === 'off'} className={styles.deviceControls}>
            <legend className={styles.srOnly}>{title} controls</legend>
            {children}
          </fieldset>
        </>
      ) : (
        <p className={styles.deviceUnavailable}>
          This support system is outside the authored pathway for the selected patient. Choose a
          different case or use Sandbox to explore reviewed combinations.
        </p>
      )}
    </section>
  )
}

function adjust(
  dispatch: Dispatch<IcuCommand>,
  therapy: IcuTherapyId,
  control: IcuTherapyControl,
  value: number | string | boolean,
) {
  dispatch({ type: 'therapy.adjust', therapy, control, value })
}

function VentilatorPanel({ state, scenario, dispatch }: DevicePanelProps) {
  const device = state.devices.ventilator
  const available = scenario.capabilities.therapies.includes('ventilator')
  return (
    <DeviceShell
      id="ventilator"
      title="Mechanical ventilation"
      subtitle="Airway & gas exchange"
      status={device.status}
      available={available}
      configuration={device.mode}
      icon={<Wind aria-hidden="true" />}
      dispatch={dispatch}
    >
      <label className={styles.selectControl}>
        <span>Ventilator mode</span>
        <select
          value={device.mode}
          onChange={(event) => adjust(dispatch, 'ventilator', 'mode', event.target.value)}
        >
          <option value="volume-control">Volume control</option>
          <option value="pressure-control">Pressure control</option>
          <option value="pressure-support">Pressure support</option>
        </select>
      </label>
      <div className={styles.deviceControlGrid}>
        {device.mode === 'volume-control' ? (
          <NumericControl
            label="Tidal volume"
            value={device.tidalVolumeMl}
            minimum={250}
            maximum={800}
            step={10}
            unit="mL"
            onChange={(value) => adjust(dispatch, 'ventilator', 'tidal-volume-ml', value)}
          />
        ) : device.mode === 'pressure-control' ? (
          <NumericControl
            label="Inspiratory pressure"
            value={device.inspiratoryPressureCmH2O}
            minimum={4}
            maximum={40}
            step={1}
            unit="cmH₂O"
            onChange={(value) =>
              adjust(dispatch, 'ventilator', 'inspiratory-pressure-cmh2o', value)
            }
          />
        ) : (
          <NumericControl
            label="Pressure support"
            value={device.pressureSupportCmH2O}
            minimum={0}
            maximum={30}
            step={1}
            unit="cmH₂O"
            onChange={(value) => adjust(dispatch, 'ventilator', 'pressure-support-cmh2o', value)}
          />
        )}
        <NumericControl
          label={device.mode === 'pressure-support' ? 'Backup rate' : 'Set rate'}
          value={device.ratePerMin}
          minimum={6}
          maximum={36}
          step={1}
          unit="/min"
          onChange={(value) => adjust(dispatch, 'ventilator', 'rate-per-min', value)}
        />
        <NumericControl
          label="PEEP"
          value={device.peepCmH2O}
          minimum={0}
          maximum={24}
          step={1}
          unit="cmH₂O"
          onChange={(value) => adjust(dispatch, 'ventilator', 'peep-cmh2o', value)}
        />
        <NumericControl
          label="FiO₂"
          value={device.fio2}
          minimum={0.21}
          maximum={1}
          step={0.01}
          unit="fraction"
          onChange={(value) => adjust(dispatch, 'ventilator', 'fio2', value)}
        />
      </div>
      <dl className={styles.deviceTelemetry}>
        <div>
          <dt>Peak / plateau</dt>
          <dd>
            {device.peakPressureCmH2O.toFixed(0)} / {device.plateauPressureCmH2O.toFixed(0)} cmH₂O
          </dd>
        </div>
        <div>
          <dt>Minute ventilation</dt>
          <dd>{device.minuteVentilationLMin.toFixed(1)} L/min</dd>
        </div>
      </dl>
    </DeviceShell>
  )
}

function EcmoPanel({ state, scenario, dispatch }: DevicePanelProps) {
  const device = state.devices.ecmo
  const available = scenario.capabilities.therapies.includes('ecmo')
  const configuration = scenario.capabilities.ecmoModes.includes(device.mode)
    ? device.mode
    : (scenario.capabilities.ecmoModes[0] ?? device.mode)
  const targetBloodFlowLMin =
    Number.isFinite(device.targetBloodFlowLMin) && device.targetBloodFlowLMin > 0
      ? device.targetBloodFlowLMin
      : 4
  return (
    <DeviceShell
      id="ecmo"
      title="ECMO"
      subtitle="Extracorporeal support"
      status={device.status}
      available={available}
      configuration={configuration}
      icon={<CircleGauge aria-hidden="true" />}
      dispatch={dispatch}
    >
      <label className={styles.selectControl}>
        <span>Support configuration</span>
        <select
          value={configuration}
          disabled={device.status === 'running'}
          onChange={(event) =>
            dispatch({
              type: 'therapy.prepare',
              therapy: 'ecmo',
              configuration: event.target.value,
            })
          }
        >
          {scenario.capabilities.ecmoModes.map((mode) => (
            <option value={mode} key={mode}>
              {mode.toUpperCase()} ECMO
            </option>
          ))}
        </select>
      </label>
      <div className={styles.deviceControlGrid}>
        <NumericControl
          label="Pump speed"
          value={device.rpm}
          minimum={1_500}
          maximum={5_000}
          step={100}
          unit="RPM"
          onChange={(value) => adjust(dispatch, 'ecmo', 'rpm', value)}
        />
        <NumericControl
          label="Blood flow"
          value={targetBloodFlowLMin}
          minimum={0.5}
          maximum={6}
          step={0.1}
          unit="L/min"
          onChange={(value) => adjust(dispatch, 'ecmo', 'blood-flow-l-min', value)}
        />
        <NumericControl
          label="Sweep gas"
          value={device.sweepLMin}
          minimum={0}
          maximum={12}
          step={0.5}
          unit="L/min"
          onChange={(value) => adjust(dispatch, 'ecmo', 'sweep-l-min', value)}
        />
        <NumericControl
          label="Gas FiO₂"
          value={device.gasFio2}
          minimum={0.21}
          maximum={1}
          step={0.01}
          unit="fraction"
          onChange={(value) => adjust(dispatch, 'ecmo', 'gas-fio2', value)}
        />
      </div>
      <dl className={styles.deviceTelemetry}>
        <div>
          <dt>Delivered blood flow</dt>
          <dd>{device.bloodFlowLMin.toFixed(1)} L/min</dd>
        </div>
        <div>
          <dt>Drainage pressure</dt>
          <dd>{device.drainagePressureMmHg.toFixed(0)} mmHg</dd>
        </div>
        <div>
          <dt>Oxygenator ΔP</dt>
          <dd>{device.oxygenatorPressureDropMmHg.toFixed(0)} mmHg</dd>
        </div>
      </dl>
    </DeviceShell>
  )
}

function McsPanel({ state, scenario, dispatch }: DevicePanelProps) {
  const device = state.devices.mcs
  const available = scenario.capabilities.therapies.includes('mcs')
  const configuration =
    device.device === 'none'
      ? (scenario.capabilities.mcsDevices[0] ?? 'left-impella')
      : device.device
  return (
    <DeviceShell
      id="mcs"
      title="Mechanical circulatory support"
      subtitle="Counterpulsation & axial flow"
      status={device.status}
      available={available}
      configuration={configuration}
      icon={<HeartPulse aria-hidden="true" />}
      dispatch={dispatch}
    >
      <label className={styles.selectControl}>
        <span>Support device</span>
        <select
          value={configuration}
          disabled={device.status === 'running'}
          onChange={(event) =>
            dispatch({
              type: 'therapy.prepare',
              therapy: 'mcs',
              configuration: event.target.value,
            })
          }
        >
          {scenario.capabilities.mcsDevices.map((mcsDevice) => (
            <option value={mcsDevice} key={mcsDevice}>
              {mcsDevice === 'iabp'
                ? 'IABP'
                : mcsDevice === 'rp-impella'
                  ? 'RP axial-flow support'
                  : 'Left axial-flow support'}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.deviceControlGrid}>
        {device.device === 'iabp' ? (
          <label className={styles.selectControl}>
            <span>Assist ratio</span>
            <select
              value={device.assistRatio}
              onChange={(event) =>
                adjust(dispatch, 'mcs', 'assist-ratio', Number(event.target.value))
              }
            >
              <option value={1}>1:1</option>
              <option value={2}>1:2</option>
              <option value={3}>1:3</option>
            </select>
          </label>
        ) : (
          <NumericControl
            label="Performance level"
            value={device.performanceLevel}
            minimum={1}
            maximum={9}
            step={1}
            unit="P-level"
            onChange={(value) => adjust(dispatch, 'mcs', 'performance-level', value)}
          />
        )}
      </div>
      <dl className={styles.deviceTelemetry}>
        <div>
          <dt>Device flow</dt>
          <dd>{device.deviceFlowLMin.toFixed(1)} L/min</dd>
        </div>
        <div>
          <dt>Position / purge</dt>
          <dd>
            {device.position.replace('-', ' ')} · {device.purgeState.replace('-', ' ')}
          </dd>
        </div>
      </dl>
    </DeviceShell>
  )
}

function CrrtPanel({ state, scenario, dispatch }: DevicePanelProps) {
  const device = state.devices.crrt
  const available = scenario.capabilities.therapies.includes('crrt')
  return (
    <DeviceShell
      id="crrt"
      title="Continuous renal replacement"
      subtitle="Fluid & solute support"
      status={device.status}
      available={available}
      configuration={device.modality}
      icon={<Droplets aria-hidden="true" />}
      dispatch={dispatch}
    >
      <label className={styles.selectControl}>
        <span>Modality</span>
        <select
          value={device.modality}
          disabled={device.status === 'running'}
          onChange={(event) =>
            dispatch({
              type: 'therapy.prepare',
              therapy: 'crrt',
              configuration: event.target.value,
            })
          }
        >
          <option value="cvvhd">CVVHD</option>
          <option value="cvvh">CVVH</option>
          <option value="cvvhdf">CVVHDF</option>
        </select>
      </label>
      <div className={styles.deviceControlGrid}>
        <NumericControl
          label="Blood flow"
          value={device.bloodFlowMlMin}
          minimum={50}
          maximum={300}
          step={10}
          unit="mL/min"
          onChange={(value) => adjust(dispatch, 'crrt', 'blood-flow-ml-min', value)}
        />
        <NumericControl
          label="Dialysate"
          value={device.dialysateMlHour}
          minimum={0}
          maximum={4_000}
          step={50}
          unit="mL/h"
          onChange={(value) => adjust(dispatch, 'crrt', 'dialysate-ml-hour', value)}
        />
        <NumericControl
          label="Replacement"
          value={device.replacementMlHour}
          minimum={0}
          maximum={4_000}
          step={50}
          unit="mL/h"
          onChange={(value) => adjust(dispatch, 'crrt', 'replacement-ml-hour', value)}
        />
        <NumericControl
          label="Patient fluid removal"
          value={device.patientFluidRemovalMlHour}
          minimum={0}
          maximum={1_000}
          step={25}
          unit="mL/h"
          onChange={(value) => adjust(dispatch, 'crrt', 'patient-fluid-removal-ml-hour', value)}
        />
      </div>
      <dl className={styles.deviceTelemetry}>
        <div>
          <dt>Access / filter / return</dt>
          <dd>
            {device.accessPressureMmHg.toFixed(0)} / {device.filterPressureMmHg.toFixed(0)} /{' '}
            {device.returnPressureMmHg.toFixed(0)} mmHg
          </dd>
        </div>
        <div>
          <dt>Delivered dose</dt>
          <dd>{device.deliveredDoseMlKgHour.toFixed(0)} mL/kg/h</dd>
        </div>
      </dl>
    </DeviceShell>
  )
}

export function IcuDevicePanels(props: DevicePanelProps) {
  return (
    <div className={styles.deviceStack}>
      <div className={styles.panelIntro}>
        <div>
          <span className={styles.panelKicker}>Bedside devices</span>
          <h2>Prepare, support, and troubleshoot</h2>
        </div>
        <p>
          Device controls update the same patient model. Configuration is abstracted and does not
          teach cannulation, intubation, access placement, or institution-specific setup.
        </p>
      </div>
      <VentilatorPanel {...props} />
      <EcmoPanel {...props} />
      <McsPanel {...props} />
      <CrrtPanel {...props} />
    </div>
  )
}
