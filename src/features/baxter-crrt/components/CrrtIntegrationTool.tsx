'use client'

import { useState } from 'react'
import type { CrrtFoundationTask } from '../content/foundationLessons'
import type { CrrtPressureSignalId } from '../content/circuitModel'
import { totalExternalInputRateMlHour, totalExternalOutputRateMlHour } from '../engine/fluidModel'
import { selectPrismaxPilotCaseOperationsDisplay } from '../engine/deviceAdapters/prismax'
import {
  nextCrrtOperationalCommand,
  selectCrrtOperationalDisplay,
  type CrrtOperationalRun,
  type CrrtOperationalAction,
} from '../operationalModel'
import { CrrtLivePressureDevice } from './CrrtLivePressureDevice'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import { crrtLearnClock, DeliveryTimeline, FluidChart } from './CrrtOperationalTools'
import styles from './crrt-foundations.module.css'

const number = (n: number | null) =>
  n === null ? 'Unavailable' : n.toLocaleString('en-US', { maximumFractionDigits: 1 })

/** Only observed readings enter the pending task DOM; case titles, faults and authored solutions do not. */
export function CrrtIntegrationTool({
  task,
  run,
  onAction,
}: {
  task: CrrtFoundationTask
  run: CrrtOperationalRun
  onAction: (action: CrrtOperationalAction) => void
}) {
  const [signal, setSignal] = useState<CrrtPressureSignalId>('access')
  const s = run.session.simulation
  const initial = run.snapshots[0].simulation
  const p = initial.patient
  const display = selectCrrtOperationalDisplay(run)
  const flows = display.flows
  const command = nextCrrtOperationalCommand(run, task.operation)
  const inspected = run.session.performedInterventionIds.includes('crrt14-inspect-access-path')
  const corrected = run.session.performedInterventionIds.includes('crrt14-reposition-access')
  const profileSessions = [
    run.snapshots[0],
    ...run.snapshots.filter(
      (item, i) =>
        i > 0 &&
        item.simulation.simulationTimeSeconds >
          run.snapshots[i - 1].simulation.simulationTimeSeconds,
    ),
  ]
  if (p.status !== 'configured')
    return <p>Patient starting context is unavailable; this case cannot be interpreted.</p>
  const balanceTask = task.operation === 'integration-balance'
  return (
    <section className={styles.operational} aria-label="Current run and recorded observations">
      <h3>Current run and recorded observations</h3>
      <p className={styles.caption}>
        Integrated case · synthetic engine run · clock {crrtLearnClock(s.simulationTimeSeconds)} ·
        event {run.session.timeline.length}. This exercise remains draft for clinical/device review.
      </p>
      {balanceTask ? (
        <>
          <p>
            Machine effluent and net CRRT removal are different columns in the recorded timeline.
            The chart below uses net CRRT removal; do not subtract replacement or dialysate again.
          </p>
          <DeliveryTimeline run={run} />
          <FluidChart run={run} />
        </>
      ) : (
        <>
          <details
            open={task.operation === 'integration-entry' || task.id === 'case-anticoagulation'}
          >
            <summary>Patient starting context and applied prescription</summary>
            <p>
              Synthetic starting findings: {number(p.bodyWeightKg)} kg; mean arterial pressure{' '}
              {number(p.meanArterialPressureMmHg)} mmHg; heart rate {number(p.heartRatePerMinute)}
              /min; modeled fluid overload {number(p.totalFluidOverloadMl)} mL. These are authored
              starting values, not new measurements after each action.
            </p>
            <p>
              Applied method: {s.circuit.modality}. Blood flow{' '}
              {number(flows?.bloodFlowMlMin ?? null)} mL/min; dialysate{' '}
              {number(flows?.dialysateFlowMlHour ?? null)} mL/h; net removal{' '}
              {number(flows?.patientFluidRemovalMlHour ?? null)} mL/h. PBP, replacement, syringe and
              makeup are zero in this case.
            </p>
            <p>
              Anticoagulation in this prescription: {s.circuit.anticoagulation}. Citrate/calcium
              dosing remains unavailable without a reviewed local protocol. This run does not model
              citrate metabolism or linked calcium laboratory trends.
            </p>
            <p>
              External intake {number(totalExternalInputRateMlHour(s.scenario.externalFluidRates))}{' '}
              mL/h; non-CRRT output{' '}
              {number(totalExternalOutputRateMlHour(s.scenario.externalFluidRates))} mL/h. These
              patient streams continue during an interruption.
            </p>
          </details>
          <p data-testid="integration-state">
            Delivery: {s.device.deliveryState}; blood pump{' '}
            {s.device.bloodPumpRunning ? 'running' : 'stopped'}; fluid pump{' '}
            {s.device.fluidPumpsRunning ? 'running' : 'stopped'}. Active generic alert count:{' '}
            {s.alarms.length}. No manufacturer priority or automatic response is inferred.
          </p>
          {task.operation === 'integration-action' ? (
            <p className={styles.observation}>
              Current plan:{' '}
              {run.integrationPlan === 'defer'
                ? 'keep paused and escalate'
                : 'guided case correction and verification'}
              . Your first plan response remains in history.
            </p>
          ) : null}
          {command ? (
            <div className={styles.observation}>
              <p>{command.explanation}</p>
              <button type="button" onClick={() => onAction({ type: 'command', id: command.id })}>
                {command.label}
              </button>
            </div>
          ) : null}
          {inspected ? (
            <p role="status" className={styles.observation}>
              {corrected
                ? 'The authored regional correction has been applied. Read actual pump state and subsequent delivery before claiming that treatment is restored.'
                : 'Authored inspection: a return-region restriction is verified. The case supplies no specific catheter, tubing or patient maneuver. Inspection itself has not changed the pressures or delivery.'}
            </p>
          ) : null}
          <div
            className={styles.tableScroll}
            role="region"
            aria-label="Recorded pressure profiles; scroll horizontally if needed"
            tabIndex={0}
          >
            <table className={styles.table}>
              <caption>
                Recorded profiles · mmHg. Scroll across at narrow widths; keyboard users can focus
                this region and use arrow keys. Pump state and flow matter when comparing readings.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Clock</th>
                  <th scope="col">State</th>
                  <th scope="col">Blood flow (mL/min)</th>
                  <th scope="col">Access</th>
                  <th scope="col">Filter</th>
                  <th scope="col">Return</th>
                  <th scope="col">Effluent</th>
                  <th scope="col">TMP</th>
                  <th scope="col">Filter drop</th>
                </tr>
              </thead>
              <tbody>
                {profileSessions.map((session) => {
                  const d = selectPrismaxPilotCaseOperationsDisplay(
                    session.interfaceState,
                    session.simulation,
                  )
                  const pressures = d.pressures
                  return (
                    <tr key={session.simulation.simulationTimeSeconds}>
                      <th scope="row">
                        {crrtLearnClock(session.simulation.simulationTimeSeconds)}
                      </th>
                      <td>{session.simulation.device.deliveryState}</td>
                      <td>{number(d.flows?.bloodFlowMlMin ?? null)}</td>
                      {[
                        pressures.accessPressureMmHg,
                        pressures.filterPressureMmHg,
                        pressures.returnPressureMmHg,
                        pressures.effluentPressureMmHg,
                        pressures.transmembranePressureMmHg,
                        pressures.filterPressureDropMmHg,
                      ].map((n, i) => (
                        <td key={i}>{number(n)}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <CrrtLivePressureDevice
            operations={display}
            selectedSignalId={signal}
            onSelectSignal={setSignal}
            showInterpretation={false}
          >
            <CrrtPilotCircuit
              presentation="live-focused"
              overlayId="cvvhd"
              running={s.device.bloodPumpRunning}
              setReady={
                s.access.status === 'configured' &&
                s.access.accessConnected &&
                s.access.returnConnected
              }
              fluidsReady={s.circuit.bags.every((b) => b.connected && !b.scaleOpen)}
              flows={flows}
              bloodFlowMlMin={flows?.bloodFlowMlMin ?? null}
              dialysateFlowMlHour={flows?.dialysateFlowMlHour ?? null}
              patientFluidRemovalMlHour={flows?.patientFluidRemovalMlHour ?? null}
              highlightedSignalId={signal}
              pressure={{
                access: display.pressures.accessPressureMmHg,
                filter: display.pressures.filterPressureMmHg,
                return: display.pressures.returnPressureMmHg,
                effluent: display.pressures.effluentPressureMmHg,
                TMP: display.pressures.transmembranePressureMmHg,
                filterDrop: display.pressures.filterPressureDropMmHg,
              }}
            />
          </CrrtLivePressureDevice>
          <DeliveryTimeline run={run} />
          {task.operation === 'integration-reassess' ? (
            <>
              <FluidChart run={run} />
              <p>
                {run.integrationPlan === 'defer'
                  ? 'Delivery remains paused. The restriction is unresolved, and escalation has not improved the model.'
                  : 'Compare the subsequent profile at restored flow with the earlier profile. Resumption does not erase recorded downtime or prove patient recovery.'}
              </p>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}
