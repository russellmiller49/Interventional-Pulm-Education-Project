'use client'

import { useEffect, useState } from 'react'
import type { CrrtFoundationTask } from '../content/foundationLessons'
import type { CrrtPressureSignalId } from '../content/circuitModel'
import {
  prismaxSimulatorHotspots,
  type PrismaxSimulatorHotspotId,
} from '../content/prismaxSimulator'
import { crrtHardwareFunctionTeaching } from '../content/operationalLessons'
import { totalExternalInputRateMlHour, totalExternalOutputRateMlHour } from '../engine/fluidModel'
import type { CrrtLearnEvidence } from '../learnEvidence'
import {
  crrtLearnRunLabels,
  crrtRecordedDeliveryIntervals,
  crrtRecordedFluidChart,
  crrtValidBalanceResponse,
  nextCrrtOperationalCommand,
  selectCrrtOperationalDisplay,
  type CrrtOperationalAction,
  type CrrtOperationalRun,
} from '../operationalModel'
import { CrrtFoundationToolView } from './CrrtFoundationTools'
import { CrrtLivePressureDevice } from './CrrtLivePressureDevice'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import { PrismaxPilotInterface, PrismaxStaticDeviceReference } from './PrismaxPilotInterface'
import styles from './crrt-foundations.module.css'

const number = (value: number | null, digits = 1) =>
  value === null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: digits })
export const crrtLearnClock = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`

export function CrrtOperationalTool({
  task,
  run,
  onAction,
  onReady,
}: {
  task: CrrtFoundationTask
  run?: CrrtOperationalRun
  onAction: (action: CrrtOperationalAction) => void
  onReady: (response: string) => void
}) {
  const [selected, setSelected] = useState<CrrtPressureSignalId>('access')
  if (task.operation === 'hardware') return <HardwareOrientation onReady={onReady} />
  if (!run) return null
  const session = run.session
  const simulation = session.simulation
  const operations = selectCrrtOperationalDisplay(run)
  const command = nextCrrtOperationalCommand(run, task.operation)
  const latestIntervention = [...session.timeline]
    .reverse()
    .find((event) => event.type === 'intervention-performed')
  const response = session.caseDefinition.interventions.find(
    (i) => i.id === latestIntervention?.referenceId,
  )?.response
  const chartOnly = task.operation === 'balance' || task.operation === 'missing-chart'
  const showPressures = task.operation === 'normal' || task.operation?.startsWith('alarm-')
  return (
    <section className={styles.operational} aria-label="Current run and recorded observations">
      <h3>Current run and recorded observations</h3>
      <p className={styles.caption} data-run-id={run.id}>
        {crrtLearnRunLabels[run.id]} · event {session.timeline.length} · clock{' '}
        {crrtLearnClock(simulation.simulationTimeSeconds)}. All values below belong to this run. A
        new run starts with its own clock and record.
      </p>
      {chartOnly ? (
        <FluidChart run={run} missingUrine={task.operation === 'missing-chart'} />
      ) : (
        <>
          <PatientAndDelivery run={run} />
          {command ? (
            <div className={styles.observation}>
              <p>{command.explanation}</p>
              <button type="button" onClick={() => onAction({ type: 'command', id: command.id })}>
                {command.label}
              </button>
            </div>
          ) : null}
          {response && run.id !== 'workflow' && run.id !== 'delivery' ? (
            <p role="status" className={styles.observation}>
              {response}
            </p>
          ) : null}
          {task.operation === 'setup' ? (
            <>
              <p className={styles.caption}>
                Enter → review/apply → complete modeled preparation → start. End treatment and
                reload are outside this task; use Restart lesson to begin again.
              </p>
              {simulation.device.deliveryState !== 'running' ? (
                <PrismaxPilotInterface
                  presentation="guided-setup"
                  caseContext={{
                    caseId: session.caseDefinition.id,
                    title: 'CVVHD setup with an 80 kg synthetic patient',
                    pathway: 'learn',
                  }}
                  state={session.interfaceState}
                  dispatch={(action) => onAction({ type: 'device', action })}
                  operationsDisplay={operations}
                />
              ) : (
                <p role="status" className={styles.observation}>
                  The modeled treatment has started. The applied settings are shown above; no
                  observation time or delivery volume has yet accumulated. Continue to record the
                  normal reference.
                </p>
              )}
            </>
          ) : null}
          {showPressures ? (
            <>
              <CrrtLivePressureDevice
                operations={operations}
                selectedSignalId={selected}
                onSelectSignal={setSelected}
              >
                <CrrtPilotCircuit
                  presentation="live-focused"
                  overlayId="cvvhd"
                  running={simulation.device.bloodPumpRunning}
                  setReady={
                    simulation.access.status === 'configured' &&
                    simulation.access.accessConnected &&
                    simulation.access.returnConnected
                  }
                  fluidsReady={simulation.circuit.bags.every((b) => b.connected && !b.scaleOpen)}
                  bloodFlowMlMin={operations.flows?.bloodFlowMlMin ?? null}
                  dialysateFlowMlHour={operations.flows?.dialysateFlowMlHour ?? null}
                  patientFluidRemovalMlHour={operations.flows?.patientFluidRemovalMlHour ?? null}
                  flows={operations.flows}
                  highlightedSignalId={selected}
                  pressure={{
                    access: operations.pressures.accessPressureMmHg,
                    filter: operations.pressures.filterPressureMmHg,
                    return: operations.pressures.returnPressureMmHg,
                    effluent: operations.pressures.effluentPressureMmHg,
                    TMP: operations.pressures.transmembranePressureMmHg,
                    filterDrop: operations.pressures.filterPressureDropMmHg,
                  }}
                />
              </CrrtLivePressureDevice>
              {run.id === 'access' ? <AlarmRecord run={run} /> : null}
            </>
          ) : null}
          {task.operation === 'net-change' || task.operation === 'net-observe' ? (
            <NetRemovalComparison run={run} />
          ) : null}
          {task.operation !== 'setup' ? <DeliveryTimeline run={run} /> : null}
        </>
      )}
    </section>
  )
}

function HardwareOrientation({ onReady }: { onReady: (response: string) => void }) {
  const [regions, setRegions] = useState<readonly string[]>([])
  const [selectedRegion, setSelectedRegion] = useState<PrismaxSimulatorHotspotId>('solution-pumps')
  const [paths, setPaths] = useState(false)
  useEffect(() => {
    if (paths && regions.length === prismaxSimulatorHotspots.length)
      onReady('hardware-and-fluid-destinations-reviewed')
  }, [regions, paths, onReady])
  return (
    <section className={styles.operational} aria-label="Machine functions and fluid destinations">
      <h3>Machine functions and fluid destinations</h3>
      <PrismaxStaticDeviceReference
        orientation
        onSelectRegion={(id) => {
          setSelectedRegion(id)
          setRegions((previous) => (previous.includes(id) ? previous : [...previous, id]))
        }}
      />
      <p className={styles.observation} role="status">
        {crrtHardwareFunctionTeaching[selectedRegion]}
      </p>
      <p>
        {regions.length} of {prismaxSimulatorHotspots.length} hardware functions selected.
      </p>
      <h3>Follow the fluid destinations</h3>
      <p>
        The fixed circuit also shows conceptual replacement and PBP paths. Only the
        dialysate-supported CVVHD workflow is operational in the setup task that follows.
      </p>
      <CrrtFoundationToolView tool="fluid-walk" onReady={() => setPaths(true)} />
    </section>
  )
}

function PatientAndDelivery({ run }: { run: CrrtOperationalRun }) {
  const s = run.session.simulation
  const display = selectCrrtOperationalDisplay(run)
  const therapy = s.deliveredTherapy
  const f = display.flows
  const rates = s.scenario.externalFluidRates
  return (
    <>
      {run.id === 'access' || run.id === 'fluid' ? (
        <p>
          <strong>Case presentation:</strong> {run.session.caseDefinition.patientDescription}
        </p>
      ) : null}
      <p>
        <strong>Synthetic patient:</strong>{' '}
        {s.patient.status === 'configured'
          ? `${number(s.patient.bodyWeightKg)} kg`
          : 'Weight unavailable'}
        .{' '}
        {run.id === 'access'
          ? 'This case asks you to assess the patient and access path as a pressure pattern changes. Patient assessment actions record a reviewed case step; they do not simulate a physical examination.'
          : run.id === 'fluid'
            ? 'High external intake can leave whole-patient balance positive despite net CRRT removal. Review tolerance and fluid goals together.'
            : 'Reference for setup and fluid accounting; no kidney-recovery trajectory is modeled.'}
      </p>
      <dl className={styles.metrics}>
        <div>
          <dt>Applied modality / delivery state</dt>
          <dd>
            {display.modality?.toUpperCase() ?? 'Not applied'} · {s.device.deliveryState}
          </dd>
        </div>
        <div>
          <dt>Applied blood flow</dt>
          <dd>{number(f?.bloodFlowMlMin ?? null)} mL/min</dd>
        </div>
        <div>
          <dt>Applied dialysate</dt>
          <dd>{number(f?.dialysateFlowMlHour ?? null)} mL/h</dd>
        </div>
        <div>
          <dt>Applied patient fluid removal</dt>
          <dd>{number(f?.patientFluidRemovalMlHour ?? null)} mL/h</dd>
        </div>
        <div>
          <dt>Modeled pumps</dt>
          <dd>
            Blood: {s.device.bloodPumpRunning ? 'on' : 'off'} · Fluid:{' '}
            {s.device.fluidPumpsRunning ? 'on' : 'off'}
          </dd>
        </div>
        <div>
          <dt>Recorded effluent</dt>
          <dd>{number(therapy.cumulativeActualEffluentMl)} mL</dd>
        </div>
        <div>
          <dt>Recorded charting window / downtime</dt>
          <dd>
            {crrtLearnClock(therapy.chartingWindowSeconds)} /{' '}
            {crrtLearnClock(therapy.cumulativeDowntimeSeconds)}
          </dd>
        </div>
        <div>
          <dt>Recorded interval dose proxy</dt>
          <dd>{number(display.deliveredDoseMlKgHour, 2)} mL/kg/h</dd>
        </div>
        <div>
          <dt>Current external intake / output</dt>
          <dd>
            {number(totalExternalInputRateMlHour(rates))} /{' '}
            {number(totalExternalOutputRateMlHour(rates))} mL/h
          </dd>
        </div>
      </dl>
      <p className={styles.caption}>
        Applied flows remain settings while paused; they are not proof that fluid is moving.
        Recorded quantities derive from the engine’s integrated delivery and common charting
        interval.
      </p>
      {display.cumulativeFluid.withheldReason ? (
        <p role="status">{display.cumulativeFluid.withheldReason}</p>
      ) : null}
    </>
  )
}

function AlarmRecord({ run }: { run: CrrtOperationalRun }) {
  const s = run.session.simulation
  const alarms = [...s.alarms, ...s.alarmHistory]
  return (
    <section aria-label="Alert and cause record">
      <h3>Alert and cause record</h3>
      <p>
        Generic engine alerts · manufacturer mapping and priorities pending. These alerts do not
        automatically stop the modeled pumps.
      </p>
      {alarms.length ? (
        <ul>
          {alarms.map((a) => (
            <li key={a.id}>
              {a.code} · {a.active ? 'active cause' : 'cause resolved'} ·{' '}
              {a.acknowledgedAtSeconds === undefined
                ? 'not acknowledged'
                : `acknowledged at ${crrtLearnClock(a.acknowledgedAtSeconds)}`}
              {a.resolvedAtSeconds === undefined
                ? ''
                : ` · resolved at ${crrtLearnClock(a.resolvedAtSeconds)}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No active or historical alert in this run yet.</p>
      )}
      <p>
        Patient intake and non-CRRT output continue during a pause. A stopped blood pump changes
        pressure conditions; compare resumed pressure and new delivery before declaring this case
        restored.
      </p>
    </section>
  )
}

export function DeliveryTimeline({ run }: { run: CrrtOperationalRun }) {
  const intervals = crrtRecordedDeliveryIntervals(run)
  return (
    <section aria-label="Recorded delivery timeline">
      <h3>Recorded delivery timeline</h3>
      <p className={styles.caption}>
        On narrow screens, scroll across the table. With a keyboard, focus its region and use the
        left and right arrow keys.
      </p>
      {!intervals.length ? (
        <p>No observation interval has elapsed.</p>
      ) : (
        <div
          className={styles.tableScroll}
          role="region"
          aria-label="Recorded intervals; scroll horizontally if needed"
          tabIndex={0}
        >
          <table className={styles.table}>
            <caption>
              Actual interval totals · mL; downtime in minutes. End state describes the endpoint,
              not the entire preceding interval.
            </caption>
            <thead>
              <tr>
                <th scope="col">Interval</th>
                <th scope="col">Effluent</th>
                <th scope="col">Net CRRT removal</th>
                <th scope="col">External intake</th>
                <th scope="col">Non-CRRT output</th>
                <th scope="col">Downtime</th>
                <th scope="col">End state</th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((r) => (
                <tr key={`${r.startSeconds}-${r.endSeconds}`}>
                  <th scope="row">
                    {crrtLearnClock(r.startSeconds)}–{crrtLearnClock(r.endSeconds)}
                  </th>
                  <td>{number(r.effluentMl)}</td>
                  <td>{number(r.removalMl)}</td>
                  <td>{number(r.externalInputMl)}</td>
                  <td>{number(r.externalOutputMl)}</td>
                  <td>{number(r.downtimeSeconds / 60)}</td>
                  <td>{r.endState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function FluidChart({
  run,
  missingUrine = false,
}: {
  run: CrrtOperationalRun
  missingUrine?: boolean
}) {
  const chart = crrtRecordedFluidChart(run.session, missingUrine)
  const therapy = run.session.simulation.deliveredTherapy
  return (
    <>
      <h3>
        {missingUrine ? 'Incomplete chart copy' : 'Recorded patient-fluid chart'} · 0–
        {crrtLearnClock(therapy.chartingWindowSeconds)}
      </h3>
      <dl className={styles.metrics}>
        <div>
          <dt>External intake</dt>
          <dd>{number(chart.externalInputMl)} mL</dd>
        </div>
        <div>
          <dt>Urine output</dt>
          <dd>
            {chart.urineMl === null ? 'Not recorded in this chart' : `${number(chart.urineMl)} mL`}
          </dd>
        </div>
        <div>
          <dt>Other non-CRRT output</dt>
          <dd>{number(chart.otherOutputMl)} mL</dd>
        </div>
        <div>
          <dt>Recorded net CRRT removal</dt>
          <dd>{number(chart.removalMl)} mL</dd>
        </div>
        <div>
          <dt>Additional device net gain</dt>
          <dd>{number(chart.additionalDeviceGainMl)} mL</dd>
        </div>
        <div>
          <dt>Recorded downtime</dt>
          <dd>{crrtLearnClock(therapy.cumulativeDowntimeSeconds)}</dd>
        </div>
      </dl>
      {chart.withheldReason ? <p>{chart.withheldReason}</p> : null}
    </>
  )
}

function NetRemovalComparison({ run }: { run: CrrtOperationalRun }) {
  const initial = run.snapshots[0]
  const applied = run.snapshots.find((s) =>
    s.performedInterventionIds.includes('crrt10-cautious-pfr-adjustment'),
  )
  const states = [
    initial,
    ...(applied ? [applied] : []),
    ...(run.session.simulation.simulationTimeSeconds > 0 ? [run.session] : []),
  ]
  return (
    <section aria-label="Immediate and subsequent response">
      <h3>Immediate and subsequent response</h3>
      <p className={styles.caption}>
        On narrow screens, scroll across the comparison. With a keyboard, focus its region and use
        the left and right arrow keys.
      </p>
      <div
        className={styles.tableScroll}
        role="region"
        aria-label="Net-removal comparison; scroll horizontally if needed"
        tabIndex={0}
      >
        <table className={styles.table}>
          <caption>
            Same CRRT-10 run · engine values at recorded events. Reserve and stress are teaching
            proxies, not clinical tolerance measurements.
          </caption>
          <thead>
            <tr>
              <th scope="col">Observation</th>
              <th scope="col">Blood mL/min</th>
              <th scope="col">Dialysate mL/h</th>
              <th scope="col">Removal mL/h</th>
              <th scope="col">Net CRRT mL</th>
              <th scope="col">Patient balance mL</th>
              <th scope="col">Reserve mL / stress index</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s, i) => {
              const sim = s.simulation
              const chart = crrtRecordedFluidChart(s)
              return (
                <tr key={i}>
                  <th scope="row">
                    {i === 0
                      ? 'Before adjustment'
                      : i === 1
                        ? 'Immediately applied'
                        : 'After observation'}{' '}
                    · {crrtLearnClock(sim.simulationTimeSeconds)}
                  </th>
                  <td>{number(sim.circuit.flows?.bloodFlowMlMin ?? null)}</td>
                  <td>{number(sim.circuit.flows?.dialysateFlowMlHour ?? null)}</td>
                  <td>{number(sim.circuit.flows?.patientFluidRemovalMlHour ?? null)}</td>
                  <td>{number(chart.removalMl)}</td>
                  <td>{number(chart.balanceMl)}</td>
                  <td>
                    {sim.patient.status === 'configured'
                      ? `${number(sim.patient.intravascularReserveMl)} / ${number(sim.patient.hemodynamicStressIndex, 3)}`
                      : 'Unavailable'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function CrrtRecordedBalanceQuestion({
  run,
  evidence,
  onSubmit,
  onFeedbackDisplayed,
  onContinue,
}: {
  run: CrrtOperationalRun
  evidence?: CrrtLearnEvidence
  onSubmit: (response: string, correct: boolean, inputs: Readonly<Record<string, number>>) => void
  onFeedbackDisplayed: () => void
  onContinue: () => void
}) {
  const [raw, setRaw] = useState('')
  const value = crrtValidBalanceResponse(raw)
  const chart = crrtRecordedFluidChart(run.session)
  const expected = chart.balanceMl
  useEffect(() => {
    if (evidence && !evidence.feedbackDisplayed) onFeedbackDisplayed()
  }, [evidence, onFeedbackDisplayed])
  return (
    <section aria-label="Recorded balance calculation" className={styles.numericQuestion}>
      <h3>Recorded balance calculation</h3>
      {evidence ? (
        <div role="status" className={styles.feedback}>
          <h3>{evidence.correct ? 'Balance accounted for' : 'Review the fluid accounting'}</h3>
          <p>
            First answer: {number(evidence.inputs?.answerMl ?? null)} mL. Recorded balance:{' '}
            {number(expected)} mL.
          </p>
          <p>
            {number(chart.externalInputMl)} − {number(chart.urineMl)} −{' '}
            {number(chart.otherOutputMl)} − {number(chart.removalMl)} +{' '}
            {number(chart.additionalDeviceGainMl)} = {number(expected)} mL. Positive means gain.
            These are recorded interval totals. Recorded interruptions remain part of the patient
            ledger.
          </p>
          <p>Your first response is retained. Review the explanation before continuing.</p>
          <button type="button" onClick={onContinue}>
            Review feedback and continue
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (value !== null && expected !== null)
              onSubmit(`balance:${value}`, Math.abs(value - expected) < 0.5, {
                answerMl: value,
                expectedBalanceMl: expected,
              })
          }}
        >
          <label htmlFor="crrt-recorded-balance">Signed whole-patient balance (mL)</label>
          <input
            id="crrt-recorded-balance"
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            aria-describedby="crrt-balance-help"
          />
          <p id="crrt-balance-help">
            Enter a finite number in mL. Blank or invalid entries cannot be submitted.{' '}
            {expected === null
              ? 'Required fluid attribution is unavailable, so an exact balance cannot be submitted.'
              : ''}
          </p>
          <button type="submit" disabled={value === null || expected === null}>
            Check recorded balance
          </button>
        </form>
      )}
    </section>
  )
}
