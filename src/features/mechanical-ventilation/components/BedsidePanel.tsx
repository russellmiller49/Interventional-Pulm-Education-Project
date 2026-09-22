'use client'

import { ClipboardPlus, HeartPulse, Stethoscope, TestTube2, UserRound } from 'lucide-react'

import { classifyCaseFindings, examinationBranchEvidence } from '../content/caseFindings'
import {
  arterialGasSampleIsPending,
  arterialGasSampleLabel,
  arterialGasView,
} from '../engine/arterialGas'
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
  requireAssessment = false,
}: {
  state: VentilationSimulationState
  definition: VentilationCaseDefinition
  compact?: boolean
  /** Independent tasks reveal findings through the existing assessment/intervention workflow. */
  requireAssessment?: boolean
}) {
  const assessed =
    (!requireAssessment && state.experience === 'learn') || performed(state, 'assess-patient')
  const circuitInspected =
    (!requireAssessment && state.experience === 'learn') || performed(state, 'inspect-circuit')
  const classified = classifyCaseFindings(definition.id)
  const suppliedFindings = classified.filter((finding) => finding.kind === 'present')
  const differentialFindings = classified.filter((finding) => finding.kind === 'byBranch')
  const conditionalFindings = classified.filter((finding) => finding.kind === 'onAction')
  /*
   * What this learner's own examination has narrowed, and nothing else. `examinationBranchEvidence`
   * reads only the live findings the panel is already printing, and only after the action that
   * produces them — the model's hidden branch is never consulted here.
   */
  const narrowed = examinationBranchEvidence(state.patient.airway, { assessed, circuitInspected })
  const narrowedLine = narrowed
    ? (differentialFindings.find((finding) => finding.branch === narrowed.branch) ?? null)
    : null
  const gas = arterialGasView(state.arterialGasSamples, state.simulationTime)
  const mean = state.patient.hemodynamics.mapMmHg

  return (
    <section
      className={styles.bedsidePanel}
      data-bedside-panel
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
          <span>{requireAssessment ? 'fTotal' : 'fPatient'}</span>
          <strong>
            {(requireAssessment
              ? state.measurements.totalRatePerMin
              : state.patient.drive.neuralRatePerMin
            ).toFixed(0)}
          </strong>
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
            <dd>
              {!requireAssessment || assessed
                ? `${state.patient.human.painScore.toFixed(0)} / 10`
                : 'Assess patient'}
            </dd>
          </div>
          <div>
            <dt>Delirium</dt>
            <dd>
              {!requireAssessment || assessed
                ? `${state.patient.human.deliriumScore.toFixed(0)} / 10`
                : 'Assess patient'}
            </dd>
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
                 * What this patient has, kept apart from what they might have had, and both kept
                 * apart from how the case was described at handover.
                 *
                 * The authored list mixes all three — for MV-13 it names the three candidate
                 * causes at once, each tagged with its own internal branch name — so listing it
                 * flat asserted mutually exclusive findings as present simultaneously. It also
                 * carries the handover's own numbers: MV-01's "Ppeak 34 and Pplat 27 cm H2O"
                 * belongs to that description, not to the console, which reads 25 and 14 at the
                 * same instant, and MV-14's "SpO2 falls" describes the presentation rather than
                 * the saturation now. Printing all of it under "Examination and comfort" made it
                 * the learner's own current findings.
                 */}
                <section data-finding-group="supplied">
                  <h3>From the case description at handover</h3>
                  <p>
                    How this patient was presented. Any numbers here are the presenting description;
                    what the patient is doing now is on the console and in the vitals above.
                  </p>
                  <ul>
                    {suppliedFindings.map((finding) => (
                      <li key={finding.text}>{finding.text}</li>
                    ))}
                  </ul>
                </section>
                <section data-finding-group="current">
                  <h3>What your examination finds now</h3>
                  <ul>
                    {bedsideFindings(state).map((finding) => (
                      <li key={finding}>{finding}</li>
                    ))}
                  </ul>
                </section>
                {differentialFindings.length ? (
                  <section data-finding-group="differential" data-narrowed={narrowed?.branch}>
                    {narrowedLine ? (
                      <>
                        <p>
                          <strong>Narrowed by what you found:</strong> {narrowed!.from} supports one
                          of the candidates this case carries. It is not a confirmed diagnosis, and
                          the response to treatment is still the test.
                        </p>
                        <ul>
                          <li data-branch-support="supported">
                            {narrowedLine.text} — supported by your examination.
                          </li>
                          {differentialFindings
                            .filter((finding) => finding !== narrowedLine)
                            .map((finding) => (
                              <li key={finding.text} data-branch-support="unsupported">
                                {finding.text} — nothing on this examination supports this one.
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Still open:</strong> one of these fits this patient. The
                          examination and the traces are what separate them.
                        </p>
                        <ul>
                          {differentialFindings.map((finding) => (
                            <li key={finding.text}>{finding.text}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                ) : null}
                {conditionalFindings.length && !requireAssessment ? (
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
                  <dd>
                    {!requireAssessment || assessed
                      ? `${state.patient.human.painScore.toFixed(0)} / 10`
                      : 'Assess patient'}
                  </dd>
                </div>
                <div>
                  <dt>Delirium burden</dt>
                  <dd>
                    {!requireAssessment || assessed
                      ? `${state.patient.human.deliriumScore.toFixed(0)} / 10`
                      : 'Assess patient'}
                  </dd>
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
            {/*
             * A specimen, not a window onto the model. These four numbers used to be read live
             * from `state.patient.gasExchange` under the line "Baseline gas shown", so the
             * baseline moved: MV-14 showed PaO2 76 at the start of the run and 97 a hundred
             * simulated seconds later with nothing ordered.
             */}
            <dl className={styles.abgGrid} data-abg-sample={gas.current.id}>
              <div>
                <dt>pH</dt>
                <dd>{gas.current.values.pH.toFixed(2)}</dd>
              </div>
              <div>
                <dt>PaCO₂</dt>
                <dd>{gas.current.values.paCO2MmHg.toFixed(0)} mmHg</dd>
              </div>
              <div>
                <dt>PaO₂</dt>
                <dd>{gas.current.values.paO2MmHg.toFixed(0)} mmHg</dd>
              </div>
              <div>
                <dt>HCO₃⁻</dt>
                <dd>{gas.current.values.bicarbonateMmolL.toFixed(0)} mmol/L</dd>
              </div>
            </dl>
            <p className={styles.orderStatus} data-abg-kind={gas.current.kind}>
              <ClipboardPlus aria-hidden="true" /> {arterialGasSampleLabel(gas.current)}.{' '}
              {gas.currentIsBaseline
                ? 'It is history supplied with the case and does not change as the simulated patient does. Order a repeat ABG through a bedside review action to sample the patient now.'
                : 'The values were frozen when the specimen was drawn; the patient has gone on changing since.'}
            </p>
            {gas.pending ? (
              <p className={styles.orderStatus} data-abg-pending={gas.pending.id}>
                Repeat gas drawn at {gas.pending.collectedAtSeconds.toFixed(0)} s is processing:{' '}
                {gas.secondsUntilPending.toFixed(0)} simulated seconds until the result. The
                specimen does not change while it waits.
              </p>
            ) : null}
            {gas.all.length > 1 ? (
              <details data-abg-history>
                <summary>Earlier gases on this patient ({gas.all.length})</summary>
                <ul>
                  {gas.all.map((sample) => (
                    <li key={sample.id} data-abg-history-sample={sample.id}>
                      {arterialGasSampleLabel(sample, state.simulationTime)} —{' '}
                      {/*
                       * A specimen that has not resulted has no numbers to read yet — every one
                       * of them, not just the first outstanding order. Two orders can be open at
                       * once, and the second was printing its values, and its future result
                       * time, before that time had arrived.
                       */}
                      {arterialGasSampleIsPending(sample, state.simulationTime) ? (
                        'not resulted yet'
                      ) : (
                        <>
                          pH {sample.values.pH.toFixed(2)}, PaCO₂{' '}
                          {sample.values.paCO2MmHg.toFixed(0)}, PaO₂{' '}
                          {sample.values.paO2MmHg.toFixed(0)}, HCO₃⁻{' '}
                          {sample.values.bicarbonateMmolL.toFixed(0)}
                          {sample.id === gas.current.id ? ' · shown above' : ''}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
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
    </section>
  )
}
