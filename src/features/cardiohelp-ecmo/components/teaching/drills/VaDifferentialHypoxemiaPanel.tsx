import { ecmoDerivedValueGuides } from '../../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../../engine/types'
import { GuidedValue, TextEquivalent, VaConfigurationLabel, styles } from '../shared'
import {
  AfterCommitment,
  CompetingExplanations,
  Discriminators,
  DrillPanelFrame,
  FittingResponse,
  HarmfulReflex,
  Mechanism,
  PatternReading,
  SignalRegister,
  ThreeDomainResponse,
  channelSignalRow,
  valueSignalRow,
} from './drillPanelPrimitives'

/**
 * Peripheral VA: upper-body oxygenation falls despite oxygenated return blood.
 *
 * Two arterial saturations from one patient are not one number measured twice. The panel is
 * organised by sampling site for that reason: before the commitment every row says only where the
 * blood came from, so the learner has to decide what that makes each number worth. Which of the
 * three reassuring values is the misleading one is the answer, and it is named after the commitment.
 *
 * The hardest line to hold here is about flow. Raising retrograde flow does move the meeting place
 * of the two streams at a bedside; this simulation does not model that at all, and it must say both
 * things — otherwise the fixed model response reads as a claim that flow is clinically irrelevant.
 */
export function VaDifferentialHypoxemiaPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { patient, circuit } = state
  const differentialActive = state.scenario.activeFaults.includes('differential-hypoxemia')
  const corrected = state.scenario.correctedFaults.includes('differential-hypoxemia')
  const gap = patient.femoralArterialSpo2 - patient.rightRadialSpo2

  return (
    <DrillPanelFrame
      scenarioId="va-differential-hypoxemia"
      supportMode="va"
      clinicalQuestion="A right-hand oximeter is low while a femoral arterial sample and the blood leaving the membrane both read high, and the arterial trace is pulsatile. Are these three readings disagreeing with each other, or reporting different things?"
      boundaries={[
        'This simulation models peripheral femoral venoarterial support with retrograde arterial return. V-AV, upper-body arterial return, and central venoarterial ECMO change the flow topology, and conclusions drawn here do not carry to them.',
        'This simulation does not derive or move a mixing point. It reproduces the upper-body oxygenation cue with a bounded educational response curve, and changing circuit flow will not move the displayed mixing region here. At a bedside, retrograde flow and native ejection genuinely do determine where the two streams meet — that this lab holds the region fixed is a limitation of the lab, not a statement that flow does not matter.',
        'Ventilator settings, cannulation options, and cerebral oximetry are not modeled. The single corrective action here stands for verification and escalation through the reviewed local protocol, not for a bedside manoeuvre that resolves differential oxygenation on its own.',
      ]}
    >
      <section className={styles.section} aria-labelledby="va-config-heading">
        <h3 id="va-config-heading" className={styles.heading}>
          The configuration this is being read in
        </h3>
        <div className="mt-2">
          <VaConfigurationLabel />
        </div>
        <p className="mt-2">
          Retrograde oxygenated return from the femoral cannula travels up the aorta; blood the
          heart ejects travels down it. Which beds each stream supplies therefore depends on where
          they meet, and that is why the site a sample is drawn from is part of what the number
          means.
        </p>
      </section>

      <SignalRegister
        rows={[
          valueSignalRow(
            'Right radial saturation',
            'Right upper limb — the bed nearest the aortic root and the head vessels',
            `${patient.rightRadialSpo2.toFixed(1)} %`,
            'An arterial saturation sampled in the right upper limb. It is a proxy for that territory and a direct measurement of nothing else.',
          ),
          valueSignalRow(
            'Femoral arterial saturation',
            'Lower limb — the bed nearest the return cannula',
            `${patient.femoralArterialSpo2.toFixed(1)} %`,
            'An arterial saturation sampled in the lower body, near where the circuit returns blood.',
          ),
          valueSignalRow(
            'Post-oxygenator saturation',
            'Return limb, after the membrane — inside the circuit',
            `${circuit.postOxygenatorSaturation.toFixed(1)} %`,
            'A circuit measurement, taken inside the return limb rather than on the patient.',
          ),
          valueSignalRow(
            'Pulse pressure',
            'Arterial line, from native ejection',
            `${patient.pulsePressure.toFixed(0)} mmHg`,
            'Evidence about whether the ventricle is ejecting.',
          ),
          valueSignalRow(
            'Native cardiac output',
            'Echocardiographic estimate, authored by this case',
            `${patient.nativeCardiacOutputLpm.toFixed(1)} L/min`,
            'The size of the native stream, authored by this case rather than measured by anything on this console.',
            'authored',
          ),
          valueSignalRow(
            'Aortic valve',
            'Echocardiography',
            patient.aorticValveOpening ? 'Opening' : 'Not opening',
            'Whether the ventricle is opening the valve at all.',
            'authored',
          ),
          valueSignalRow(
            'Circuit blood flow',
            'Flow probe on the circuit tubing',
            `${circuit.bloodFlow.toFixed(2)} L/min`,
            'A circuit measurement. In venoarterial support it is not total systemic flow, to which native output also contributes.',
          ),
          channelSignalRow(
            'pArt',
            'Return limb, after the oxygenator — inside the circuit',
            circuit.readouts.pArt,
            'mmHg',
            'A circuit pressure. It is not the patient arterial blood pressure and must not be read as one.',
          ),
          valueSignalRow(
            'Mean arterial pressure',
            'Patient arterial line',
            `${patient.meanArterialPressure.toFixed(0)} mmHg`,
            'The patient pressure. This is the one that is about the patient; pArt above is not.',
          ),
        ]}
        summary={`Right radial ${patient.rightRadialSpo2.toFixed(1)}% against femoral ${patient.femoralArterialSpo2.toFixed(1)}% and post-membrane ${circuit.postOxygenatorSaturation.toFixed(1)}%, a spread of ${gap.toFixed(1)} points between the two arterial sites. Pulse pressure ${patient.pulsePressure.toFixed(0)} mmHg with the aortic valve ${patient.aorticValveOpening ? 'opening' : 'not opening'} and native output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min. Circuit flow ${circuit.bloodFlow.toFixed(2)} L/min.`}
      />

      <PatternReading
        rows={[
          {
            label: 'Upper body',
            reading: `Right radial ${patient.rightRadialSpo2.toFixed(1)}%`,
            movement: 'Note the site as well as the number.',
          },
          {
            label: 'Lower body',
            reading: `Femoral ${patient.femoralArterialSpo2.toFixed(1)}%`,
            movement: 'A different site on the same patient. Compare it with the row above.',
          },
          {
            label: 'Inside the circuit',
            reading: `Post-membrane ${circuit.postOxygenatorSaturation.toFixed(1)}%, flow ${circuit.bloodFlow.toFixed(2)} L/min`,
            movement:
              'Inside the circuit rather than on the patient. Compare with both sites above.',
          },
          {
            label: 'The native stream',
            reading: `Pulse pressure ${patient.pulsePressure.toFixed(0)} mmHg, aortic valve ${patient.aorticValveOpening ? 'opening' : 'closed'}, native output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min`,
            movement: 'Three findings about whether the heart is ejecting, and how much.',
          },
        ]}
        summary={`Two arterial sites ${Math.abs(gap) > 2 ? `${gap.toFixed(1)} points apart` : 'reading close together'}, with a native stream present. ${differentialActive ? 'The differential-oxygenation state is active on this circuit.' : corrected ? 'The differential-oxygenation state has been addressed on this circuit.' : 'No differential-oxygenation state is active on this circuit.'}`}
      />

      <Discriminators
        items={[
          {
            question:
              'Which territory does each of the three high-reading sites actually speak for, and does any of them speak for the head?',
            whereToLook:
              'The measured-at column of the signal table. Every row names a site rather than a patient.',
          },
          {
            question:
              'Is there a second circulation competing with the circuit at all, and how large is it?',
            whereToLook:
              'Pulse pressure, aortic-valve opening, and native cardiac output, read together.',
          },
          {
            question:
              'If the three readings cannot all be trusted, which one would you doubt — and which one is nearest the return cannula?',
            whereToLook:
              'The femoral and post-membrane rows, and where each sits relative to the arterial return.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        <Mechanism>
          <p>
            Two arterial oxygenation readings taken from different parts of one patient are not one
            number measured twice. In femoral venoarterial support they report two circulations:
            retrograde oxygenated circuit blood supplying the lower body, and antegrade blood the
            heart is ejecting — carrying whatever the native lungs have done to it — supplying the
            upper body. When native ejection recovers before lung oxygenation does, the upper body
            can receive poorly oxygenated native blood while the lower body and the circuit both
            look excellent.
          </p>
          <p>
            The femoral and post-membrane values do not establish cerebral or coronary oxygenation,
            and the site nearest the return cannula is the least able to say what the brain is
            receiving. Everything that discriminates lives at the patient: where the sample was
            taken, whether the ventricle is ejecting, what the native lungs are doing to what it
            ejects, and where along the aorta the two streams meet.
          </p>
          <p data-live-differential-state>
            {differentialActive
              ? `The upper-body cue is active on this circuit, with the two arterial sites ${gap.toFixed(1)} points apart.`
              : corrected
                ? 'The upper-body pattern has been recognised and escalated on this circuit, and the modeled right-radial value is moving along its authored recovery curve.'
                : 'No upper-body differential is active on this circuit at the moment.'}
          </p>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'A faulty oximeter probe or an unreliable circuit sensor',
              standing:
                'Always worth excluding, and confirming the upper-body value with a right radial blood gas does exactly that. It stops being an explanation once the gas agrees with the oximeter, and holding settings until three readings "agree" assumes they are measuring one thing.',
            },
            {
              candidate: 'The patient is simply under-supported',
              standing:
                'A saturation of this level would mean that in most other contexts. Here the lower body and the membrane both say the circuit is delivering, so the question is where the delivery arrives rather than how much of it there is.',
            },
            {
              candidate: 'The native lungs, the ventilator, and the recovering ventricle',
              standing:
                'Very much on the table, and the reason the upper-body stream is poorly oxygenated in the first place. This simulation does not model ventilator settings, so this line of reasoning is described here rather than testable here.',
            },
            {
              candidate: 'Cannulation strategy',
              standing:
                'The definitive answer in many real cases, and outside what this lab can do. It belongs to the ECMO team under the reviewed local protocol.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Establish the pattern before moving a circuit setting. Confirm the upper-body value with
            a right radial blood gas, read it against native ejection, the native lungs and the
            circuit data, and escalate the support and cannulation strategy to the ECMO team under
            the reviewed local protocol.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          device="Circuit settings left alone while the pattern is established. Circuit flow and pArt are read as circuit quantities, neither of which reports systemic perfusion or patient arterial pressure."
          circuitOrGas="Circuit performance confirmed — membrane output, gradient, cannula position — so that the circuit can be excluded as the limitation rather than assumed adequate."
          patient="Right radial blood gas obtained; native ejection and native lung function assessed; upper-body monitoring chosen for the territory at risk; the strategy escalated to the ECMO team."
        />

        <HarmfulReflex action="Raising pump speed because a systemic saturation of this level means the patient is under-supported.">
          <p>
            The reflex treats one of the two arterial numbers as the patient&apos;s systemic
            saturation and the circuit as the only supply. It spends the time in which the
            upper-body value could have been confirmed and the two circulations read apart. In this
            simulation the modeled right-radial value does not respond to circuit flow at all —
            which is a limitation of the model rather than a claim about the bedside, where
            retrograde flow and native ejection do determine where the streams meet.
          </p>
        </HarmfulReflex>
      </AfterCommitment>

      <section className={styles.section} aria-labelledby="va-guides-heading">
        <h3 id="va-guides-heading" className={styles.heading}>
          What circuit flow does and does not report in venoarterial support
        </h3>
        <TextEquivalent>
          The recirculation-adjusted circuit flow, which in venoarterial support equals displayed
          circuit flow, together with the modeled systemic venous estimate — each with the authored
          caveat that neither describes total systemic perfusion.
        </TextEquivalent>
        <div className="mt-3 grid gap-3">
          <GuidedValue
            guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
            value={circuit.recirculationAdjustedCircuitFlowLpm}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.systemicVenousSaturationEstimate}
            value={patient.systemicVenousSaturationEstimate}
            headingLevel={4}
          />
        </div>
      </section>
    </DrillPanelFrame>
  )
}
