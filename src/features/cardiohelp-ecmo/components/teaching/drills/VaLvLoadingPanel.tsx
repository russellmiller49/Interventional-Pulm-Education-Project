'use client'

import { LV_UNLOADING_RESPONSE } from '../../../engine'
import type { EcmoSimulationState } from '../../../engine/types'
import { ArterialPressureTrace } from '../../monitor/ArterialPressureTrace'
import { TextEquivalent, styles } from '../shared'
import { DrillLivePanelFrame } from './DrillLivePanelFrame'
import { Discriminators, PatternReading } from './drillPanelPrimitives'

const SCENARIO_ID = 'va-lv-loading'

/**
 * The live readings for peripheral VA with a ventricle that is not ejecting.
 *
 * The lesson asks the learner to weigh pulse pressure, the valve and the lungs against a flow and a
 * mean pressure that look fine, and showed all of it as a grid of numbers two screens below the
 * console. This panel leads with the arterial line itself, beside the text and live: flat while the
 * ventricle does not eject, opening as flow is lowered and the inotrope runs. The readings under it
 * are grouped by what each is evidence of, and a short list says which of the lesson's moves are in
 * place on this circuit.
 *
 * Nothing here names the diagnosis or the response: those stay in the drill's written explanation
 * under this panel, exactly as they were. The sizes of the response are the engine's
 * (`LV_UNLOADING_RESPONSE`).
 */
export function VaLvLoadingLivePanel({ state }: { readonly state: EcmoSimulationState }) {
  const { patient, circuit } = state
  const planRecorded = state.scenario.correctedFaults.includes('lv-loading')
  const flowLowered =
    circuit.bloodFlow > 0 && circuit.bloodFlow <= LV_UNLOADING_RESPONSE.loweredFlowLpm
  const inotropeRunning = Boolean(state.scenario.inotropeRunning)

  return (
    <DrillLivePanelFrame
      scenarioId={SCENARIO_ID}
      supportMode="va"
      lead={
        <section className={styles.section} aria-labelledby="lv-arterial-heading" data-lv-arterial>
          <h3 id="lv-arterial-heading" className={styles.heading}>
            The arterial line, now
          </h3>
          <ArterialPressureTrace patient={patient} compact />
          <TextEquivalent>
            Mean arterial pressure {patient.meanArterialPressure} mmHg with a pulse pressure of{' '}
            {patient.pulsePressure} mmHg. Aortic-valve opening is{' '}
            {patient.aorticValveOpening ? 'present' : 'not observed'}.
          </TextEquivalent>
        </section>
      }
      clinicalQuestion="Circuit flow is steady and the mean arterial pressure looks acceptable. What do the arterial trace, the aortic valve and the lungs say about the left ventricle?"
      boundary="In this simulation lowering flow and starting the inotrope move pulse pressure and native output by sizes the model sets. Volume removal and a vent are recorded as a plan and change no reading here, so the lungs stay as the case opened them."
    >
      <PatternReading
        title="The readings, by what each is evidence of"
        headingId="drill-live-pattern-heading"
        rows={[
          {
            label: 'What the circuit is delivering',
            reading: `Flow ${circuit.bloodFlow.toFixed(2)} L/min, mean arterial pressure ${patient.meanArterialPressure} mmHg`,
            movement: 'Note what each of these two is a measure of.',
          },
          {
            label: 'What the ventricle is doing',
            reading: `Pulse pressure ${patient.pulsePressure.toFixed(0)} mmHg, aortic valve ${patient.aorticValveOpening ? 'opening' : 'not opening'}, native output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min`,
            movement: 'Read on the arterial trace above and on echo, not on the console.',
          },
          {
            label: 'Behind the ventricle',
            reading: `Pulmonary congestion ${patient.pulmonaryCongestion}`,
            movement: 'Read it with the row above it.',
          },
        ]}
        summary="The readings are grouped by what each is evidence of: the circuit’s delivery, the ventricle’s own work, and the lungs behind it."
      />

      <section className={styles.section} aria-labelledby="lv-moves-heading" data-lv-moves>
        <h3 id="lv-moves-heading" className={styles.heading}>
          What has been done on this circuit
        </h3>
        <dl className="mt-2 grid gap-1">
          <div className="flex flex-wrap gap-1" data-lv-move="flow" data-done={flowLowered}>
            <dt className="font-semibold">Circuit flow:</dt>
            <dd>{flowLowered ? 'turned down' : 'not turned down'}</dd>
          </div>
          <div className="flex flex-wrap gap-1" data-lv-move="inotrope" data-done={inotropeRunning}>
            <dt className="font-semibold">Inotrope:</dt>
            <dd>{inotropeRunning ? 'running' : 'not started'}</dd>
          </div>
          <div className="flex flex-wrap gap-1" data-lv-move="plan" data-done={planRecorded}>
            <dt className="font-semibold">Volume removal and vent:</dt>
            <dd>{planRecorded ? 'planned, not carried out' : 'no plan recorded'}</dd>
          </div>
        </dl>
      </section>

      <Discriminators
        items={[
          {
            question: 'Is the left ventricle ejecting?',
            whereToLook: 'The arterial trace and its pulse pressure, and the aortic valve on echo.',
          },
          {
            question:
              'Which of these readings would look the same whether or not the ventricle were ejecting?',
            whereToLook: 'Circuit flow and mean arterial pressure, in the first group.',
          },
          {
            question:
              'What would more circuit flow do to the pressure the ventricle ejects against?',
            whereToLook:
              'On peripheral VA the circuit returns blood into the aorta, toward the valve.',
          },
        ]}
      />
    </DrillLivePanelFrame>
  )
}
