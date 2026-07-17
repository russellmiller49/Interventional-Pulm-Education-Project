'use client'

import { Activity, Clock3, Droplets, FlaskConical, HeartPulse } from 'lucide-react'

import {
  selectFluidBalanceLedger,
  selectPrescriptionSummary,
  selectPressureSummary,
  type CrrtSimulationState,
} from '../engine'
import styles from './crrt-learning-workflow.module.css'

interface CrrtResponsePanelProps {
  readonly state: CrrtSimulationState
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toFixed(digits)
}

export function CrrtResponsePanel({ state }: CrrtResponsePanelProps) {
  const prescription = selectPrescriptionSummary(state)
  const fluid = selectFluidBalanceLedger(state)
  const pressure = selectPressureSummary(state)
  const patient = state.patient.status === 'configured' ? state.patient : null
  const potassium = patient?.solutes.potassium?.concentrationPerLiter
  const bicarbonate = patient?.solutes.bicarbonate?.concentrationPerLiter
  const recentTrends = state.trends.slice(-4)

  return (
    <section className={styles.responsePanel} aria-labelledby="crrt-response-heading">
      <div className={styles.responseHeading}>
        <div>
          <span>Simulated response · review pending</span>
          <h3 id="crrt-response-heading">Patient, delivery, and reassessment</h3>
        </div>
        <strong>
          <Clock3 aria-hidden="true" /> {Math.round(state.simulationTimeSeconds / 60)} min
        </strong>
      </div>

      <div className={styles.responseCards}>
        <article>
          <HeartPulse aria-hidden="true" />
          <span>Patient</span>
          <strong>{formatNumber(patient?.meanArterialPressureMmHg)} mmHg MAP</strong>
          <small>Stress index {formatNumber(patient?.hemodynamicStressIndex, 2)}</small>
        </article>
        <article>
          <FlaskConical aria-hidden="true" />
          <span>Simulated solutes</span>
          <strong>
            K {formatNumber(potassium)} · HCO₃ {formatNumber(bicarbonate)}
          </strong>
          <small>Model values, not clinical predictions</small>
        </article>
        <article>
          <Activity aria-hidden="true" />
          <span>Effluent dose</span>
          <strong>{formatNumber(prescription.prescribedEffluentDoseMlKgHour)} prescribed</strong>
          <small>{formatNumber(prescription.deliveredDoseMlKgHour)} delivered mL/kg/h</small>
        </article>
        <article>
          <Droplets aria-hidden="true" />
          <span>Fluid distinction</span>
          <strong>{formatNumber(fluid.machinePfrSettingMlHour, 0)} mL/h machine PFR</strong>
          <small>
            Whole-patient balance {formatNumber(fluid.cumulativeWholePatientBalanceMl, 0)} mL
          </small>
        </article>
      </div>

      <div className={styles.responseSummaries}>
        <p>{pressure.accessibleText}</p>
        <p>
          The machine has removed {formatNumber(fluid.cumulativeMachinePfrMl, 0)} mL while all
          simulated external inputs and outputs produce a whole-patient balance of{' '}
          {formatNumber(fluid.cumulativeWholePatientBalanceMl, 0)} mL.
        </p>
      </div>

      <div className={styles.trendTableWrap}>
        <table>
          <caption>
            Recent simulated trend samples. Values are synthetic, pending review, and unsuitable for
            patient care.
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Access</th>
              <th scope="col">Hemodynamic stress</th>
              <th scope="col">Whole balance</th>
            </tr>
          </thead>
          <tbody>
            {recentTrends.length > 0 ? (
              recentTrends.map((sample) => (
                <tr key={sample.timeSeconds}>
                  <th scope="row">{Math.round(sample.timeSeconds / 60)} min</th>
                  <td>{formatNumber(sample.accessPressureMmHg, 0)} mmHg</td>
                  <td>{formatNumber(sample.hemodynamicStressIndex, 2)}</td>
                  <td>{formatNumber(sample.cumulativeWholePatientBalanceMl, 0)} mL</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Advance simulated time to create a trend sample.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
