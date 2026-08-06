'use client'

import { ClipboardPlus, HeartPulse, Stethoscope, TestTube2, UserRound } from 'lucide-react'

import { classifyCaseFindings } from '../content/caseFindings'
import type { VentilationCaseDefinition, VentilationSimulationState } from '../engine'
import styles from './mechanical-ventilation.module.css'

function performed(state: VentilationSimulationState, interventionId: string): boolean {
  return state.interventions.some((record) => record.interventionId === interventionId)
}

function bedsideFindings(state: VentilationSimulationState): string[] {
  const findings: string[] = []
  if (state.patient.airway.pneumothorax) {
    findings.push('Markedly asymmetric chest excursion with unilateral loss of breath sounds.')
  } else if (state.patient.airway.bronchospasm) {
    findings.push('Diffuse expiratory wheeze with prolonged expiration.')
  } else if (state.patient.airway.secretions) {
    findings.push('Coarse breath sounds; secretions are visible in the airway tubing.')
  } else {
    findings.push('Bilateral chest excursion is present.')
  }
  if (state.measurements.intrinsicPeepCmH2O > 8) {
    findings.push('Expiration is prolonged and the next breath begins before full emptying.')
  }
  if (state.patient.human.dyspneaScore >= 6) {
    findings.push('The patient reports severe breathing discomfort when given a way to respond.')
  }
  return findings
}

function circuitFinding(state: VentilationSimulationState): string {
  if (state.patient.airway.condensate) return 'Condensate oscillates near the flow sensor.'
  if (state.patient.airway.circuitLeak)
    return 'A circuit or cuff leak is audible and exhaled volume is reduced.'
  if (state.patient.airway.hmeObstructed) return 'The HME appears loaded and resistive.'
  if (state.patient.airway.ettObstructed) return 'Airway resistance remains high across the ETT.'
  return 'Connections are secure; no visible condensate or large leak is found.'
}

export function BedsidePanel({
  state,
  definition,
  compact = false,
}: {
  state: VentilationSimulationState
  definition: VentilationCaseDefinition
  compact?: boolean
}) {
  const assessed = state.experience === 'learn' || performed(state, 'assess-patient')
  const circuitInspected = state.experience === 'learn' || performed(state, 'inspect-circuit')
  const classified = classifyCaseFindings(definition.id)
  const presentFindings = classified.filter((finding) => finding.kind === 'present')
  const differentialFindings = classified.filter((finding) => finding.kind === 'byBranch')
  const conditionalFindings = classified.filter((finding) => finding.kind === 'onAction')
  const repeatAbgOrdered = state.lastAbgAt !== null
  const repeatAbgReady = repeatAbgOrdered && state.simulationTime >= state.lastAbgAt!
  const mean = state.patient.hemodynamics.mapMmHg

  return (
    <aside
      className={styles.bedsidePanel}
      data-compact={compact || undefined}
      aria-labelledby="bedside-heading"
    >
      <div className={styles.panelHeading}>
        <div>
          <span>{compact ? 'Persistent patient physiology' : 'Independent bedside surface'}</span>
          <h2 id="bedside-heading">
            {compact ? 'Live patient status' : 'Patient, not just ventilator'}
          </h2>
        </div>
        <UserRound aria-hidden="true" />
      </div>

      <section className={styles.vitalMonitor} aria-label="Current simulated vital signs">
        <div>
          <span>HR</span>
          <strong>{state.patient.hemodynamics.heartRatePerMin.toFixed(0)}</strong>
          <small>/min</small>
        </div>
        <div>
          <span>SpO₂</span>
          <strong>{state.patient.gasExchange.spo2Percent.toFixed(0)}</strong>
          <small>%</small>
        </div>
        <div>
          <span>BP</span>
          <strong>
            {state.patient.hemodynamics.systolicMmHg.toFixed(0)}/
            {state.patient.hemodynamics.diastolicMmHg.toFixed(0)}
          </strong>
          <small>MAP {mean.toFixed(0)}</small>
        </div>
        <div>
          <span>fPatient</span>
          <strong>{state.patient.drive.neuralRatePerMin.toFixed(0)}</strong>
          <small>/min</small>
        </div>
      </section>

      {compact ? (
        <dl className={styles.compactComfortGrid} aria-label="Current comfort and sedation">
          <div>
            <dt>Dyspnea</dt>
            <dd>{state.patient.human.dyspneaScore.toFixed(1)} / 10</dd>
          </div>
          <div>
            <dt>Sedation</dt>
            <dd>RASS {state.patient.human.sedationScore}</dd>
          </div>
          <div>
            <dt>Pain</dt>
            <dd>{state.patient.human.painScore.toFixed(0)} / 10</dd>
          </div>
          <div>
            <dt>Delirium</dt>
            <dd>{state.patient.human.deliriumScore.toFixed(0)} / 10</dd>
          </div>
        </dl>
      ) : null}

      <div className={styles.bedsideSections}>
        <details open={!compact}>
          <summary>
            <Stethoscope aria-hidden="true" /> Examination and comfort
          </summary>
          <div>
            {assessed ? (
              <>
                {/*
                 * What this patient has, kept apart from what they might have had. The authored
                 * list mixes the two — for MV-13 it names all three candidate causes at once, each
                 * tagged with its own internal branch name — so listing it flat asserted three
                 * mutually exclusive findings as present simultaneously.
                 */}
                <ul>
                  {presentFindings.map((finding) => (
                    <li key={finding.text}>{finding.text}</li>
                  ))}
                  {bedsideFindings(state).map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
                {differentialFindings.length ? (
                  <>
                    <p>
                      <strong>Still open:</strong> one of these fits this patient. The examination
                      and the traces are what separate them.
                    </p>
                    <ul>
                      {differentialFindings.map((finding) => (
                        <li key={finding.text}>{finding.text}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {conditionalFindings.length ? (
                  <>
                    <p>
                      <strong>Only if you look:</strong> these appear in response to something you
                      have not done yet.
                    </p>
                    <ul>
                      {conditionalFindings.map((finding) => (
                        <li key={finding.text}>{finding.text}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p>Repeat a bedside evaluation to reveal dynamic examination findings.</p>
            )}
            {!compact ? (
              <dl className={styles.comfortGrid}>
                <div>
                  <dt>Dyspnea</dt>
                  <dd>{state.patient.human.dyspneaScore.toFixed(1)} / 10</dd>
                </div>
                <div>
                  <dt>Sedation</dt>
                  <dd>RASS {state.patient.human.sedationScore}</dd>
                </div>
                <div>
                  <dt>Pain</dt>
                  <dd>{state.patient.human.painScore.toFixed(0)} / 10</dd>
                </div>
                <div>
                  <dt>Delirium burden</dt>
                  <dd>{state.patient.human.deliriumScore.toFixed(0)} / 10</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </details>

        <details>
          <summary>
            <TestTube2 aria-hidden="true" /> Arterial blood gas
          </summary>
          <div>
            <dl className={styles.abgGrid}>
              <div>
                <dt>pH</dt>
                <dd>{state.patient.gasExchange.pH.toFixed(2)}</dd>
              </div>
              <div>
                <dt>PaCO₂</dt>
                <dd>{state.patient.gasExchange.paCO2MmHg.toFixed(0)} mmHg</dd>
              </div>
              <div>
                <dt>PaO₂</dt>
                <dd>{state.patient.gasExchange.paO2MmHg.toFixed(0)} mmHg</dd>
              </div>
              <div>
                <dt>HCO₃⁻</dt>
                <dd>{state.patient.gasExchange.bicarbonateMmolL.toFixed(0)} mmol/L</dd>
              </div>
            </dl>
            <p className={styles.orderStatus}>
              <ClipboardPlus aria-hidden="true" />{' '}
              {!repeatAbgOrdered
                ? 'Baseline gas shown. Order a repeat ABG through a bedside review action.'
                : repeatAbgReady
                  ? 'Repeat gas is available from the current simulated physiology.'
                  : `Repeat gas processing: ${Math.max(0, state.lastAbgAt! - state.simulationTime).toFixed(0)} simulated seconds remaining.`}
            </p>
          </div>
        </details>

        <details>
          <summary>
            <HeartPulse aria-hidden="true" /> Circuit and airway check
          </summary>
          <div>
            <p>
              {circuitInspected
                ? circuitFinding(state)
                : 'Inspect the circuit, cuff, HME, flow sensor, and airway to localize this branch.'}
            </p>
          </div>
        </details>
      </div>
    </aside>
  )
}
