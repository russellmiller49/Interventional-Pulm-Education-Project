'use client'

import { Bug, Gauge, TestTubeDiagonal } from 'lucide-react'

import type { CrrtSimulationState } from '../engine'
import styles from './crrt-learning-workflow.module.css'

interface CrrtCalibrationPanelProps {
  readonly state: CrrtSimulationState
  readonly attempt: number
  readonly matchedPathId: string | null
  readonly criticalErrorIds: readonly string[]
}

export function shouldRenderCrrtCalibrationPanel(environment: string | undefined): boolean {
  return environment === 'development'
}

function display(value: number | null, unit = ''): string {
  return value === null ? 'unavailable' : `${value.toFixed(2)}${unit}`
}

export function CrrtCalibrationPanel({
  state,
  attempt,
  matchedPathId,
  criticalErrorIds,
}: CrrtCalibrationPanelProps) {
  if (!shouldRenderCrrtCalibrationPanel(process.env.NODE_ENV)) return null

  const pressure = state.circuit.pressures
  const pressureModel = state.scenario.modelConfiguration.pressure
  const patient = state.patient.status === 'configured' ? state.patient : null
  const access = state.access.status === 'configured' ? state.access : null

  return (
    <details className={styles.calibrationPanel} data-testid="crrt-development-calibration">
      <summary>
        <Bug aria-hidden="true" /> Development calibration — hidden model state
      </summary>
      <p>
        This panel exists only in development. It exposes synthetic calibration and deterministic
        engine state for reviewers; it is not learner guidance or a clinical reference.
      </p>

      <div className={styles.calibrationGrid}>
        <section aria-labelledby="crrt-calibration-runtime">
          <h4 id="crrt-calibration-runtime">
            <TestTubeDiagonal aria-hidden="true" /> Runtime
          </h4>
          <dl>
            <div>
              <dt>Fixture</dt>
              <dd>{state.scenario.fixtureId ?? 'unloaded'}</dd>
            </div>
            <div>
              <dt>Seed / attempt</dt>
              <dd>
                {state.seed} / {attempt}
              </dd>
            </div>
            <div>
              <dt>Simulation time</dt>
              <dd>{state.simulationTimeSeconds} s</dd>
            </div>
            <div>
              <dt>Engine / content</dt>
              <dd>
                {state.engineVersion} / {state.contentVersion}
              </dd>
            </div>
            <div>
              <dt>Matched path</dt>
              <dd>{matchedPathId ?? 'none'}</dd>
            </div>
            <div>
              <dt>Candidate critical errors</dt>
              <dd>{criticalErrorIds.join(', ') || 'none'}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="crrt-calibration-pressure">
          <h4 id="crrt-calibration-pressure">
            <Gauge aria-hidden="true" /> Access and pressure terms
          </h4>
          <dl>
            <div>
              <dt>Access resistance</dt>
              <dd>{display(access?.accessResistanceMmHgPerMlMin ?? null)}</dd>
            </div>
            <div>
              <dt>Position multiplier</dt>
              <dd>{display(access?.positionResistanceMultiplier ?? null)}</dd>
            </div>
            <div>
              <dt>Reference pressure</dt>
              <dd>{display(pressureModel?.accessReferencePressureMmHg ?? null, ' mmHg')}</dd>
            </div>
            <div>
              <dt>Access pressure</dt>
              <dd>{display(pressure.accessPressureMmHg, ' mmHg')}</dd>
            </div>
            <div>
              <dt>Filter / return</dt>
              <dd>
                {display(pressure.filterPressureMmHg, ' mmHg')} /{' '}
                {display(pressure.returnPressureMmHg, ' mmHg')}
              </dd>
            </div>
            <div>
              <dt>TMP / filter drop</dt>
              <dd>
                {display(pressure.prismaxTransmembranePressureMmHg, ' mmHg')} /{' '}
                {display(pressure.prismaxFilterPressureDropMmHg, ' mmHg')}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="crrt-calibration-delivery">
          <h4 id="crrt-calibration-delivery">Delivery and patient model</h4>
          <dl>
            <div>
              <dt>Prescribed / delivered dose</dt>
              <dd>
                {display(state.deliveredTherapy.prescribedEffluentDoseMlKgHour)} /{' '}
                {display(state.deliveredTherapy.deliveredDoseMlKgHour)} mL/kg/h
              </dd>
            </div>
            <div>
              <dt>Actual effluent</dt>
              <dd>{display(state.deliveredTherapy.cumulativeActualEffluentMl, ' mL')}</dd>
            </div>
            <div>
              <dt>Downtime</dt>
              <dd>{display(state.deliveredTherapy.cumulativeDowntimeSeconds, ' s')}</dd>
            </div>
            <div>
              <dt>Machine PFR / whole balance</dt>
              <dd>
                {display(state.deliveredTherapy.cumulativeMachinePatientFluidRemovalMl, ' mL')} /{' '}
                {display(state.deliveredTherapy.cumulativeWholePatientBalanceMl, ' mL')}
              </dd>
            </div>
            <div>
              <dt>Hemodynamic stress</dt>
              <dd>{display(patient?.hemodynamicStressIndex ?? null)}</dd>
            </div>
            <div>
              <dt>Active faults</dt>
              <dd>{state.scenario.activeFaults.join(', ') || 'none'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className={styles.calibrationSources}>
        Model sources: {state.scenario.modelConfiguration.sourceIds.join(', ') || 'none'} · queued
        events: {state.scenario.eventQueue.map((event) => event.id).join(', ') || 'none'}
      </p>
    </details>
  )
}
