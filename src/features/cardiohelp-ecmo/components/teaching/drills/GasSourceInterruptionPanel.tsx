import { ecmoDerivedValueGuides } from '../../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../../engine/types'
import { GuidedValue, TextEquivalent, styles } from '../shared'
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
 * Gas transfer falls while blood flow persists.
 *
 * Two paths run through one device and only one of them has failed. The panel keeps them in separate
 * blocks for that reason: the blood path — flow, the three pressures, the gradient — is structurally
 * untouched by a gas-source interruption in this model, so the whole of the evidence lives on the gas
 * path and on the patient.
 *
 * The sweep response here is a straight teaching curve. Saying so matters, because a learner who
 * reads it as a dose-response would carry a linear expectation of carbon-dioxide clearance to a
 * bedside where clearance is diminishing and multiply limited.
 */
export function GasSourceInterruptionPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { readouts } = state.circuit
  const sourceConnected = state.gas.sourceConnected
  const interrupted = state.scenario.activeFaults.includes('gas-source-interruption')
  const restored = state.scenario.correctedFaults.includes('gas-source-interruption')

  return (
    <DrillPanelFrame
      scenarioId="gas-source-interruption"
      supportMode="vv"
      clinicalQuestion="The carbon-dioxide value is climbing and the saturation is drifting, while displayed flow and every circuit pressure sit exactly where they have all shift. Which of the two paths through this circuit has failed?"
      boundaries={[
        'This simulation carries the modeled patient along bounded educational curves, and it moves far faster than the few minutes such a change takes at a bedside. The endpoints and the speed are teaching shapes, not a prediction for any particular patient.',
        'The sweep response in this model is a straight line. Real carbon-dioxide removal is diminishing and multiply limited — by membrane surface, by blood flow, and by the gradient itself — so nothing here should be read as a dose-response curve.',
        'The gas panel is a schematic stand-in for a source, a blender, and a line into the membrane. This simulation does not represent the individual connections, the wall or cylinder supply, or the analyser a real check would use.',
      ]}
    >
      <SignalRegister
        rows={[
          valueSignalRow(
            'Sweep-gas source',
            'Separate external gas path, upstream of the blender',
            sourceConnected ? 'Connected' : 'Interrupted',
            'Whether the supply upstream of the blender is continuous.',
            'authored',
          ),
          valueSignalRow(
            'Sweep flow setting',
            'Separate external blender',
            `${state.gas.sweepLpm.toFixed(1)} L/min`,
            'A setpoint on the blender, requesting a gas flow through the membrane.',
          ),
          valueSignalRow(
            'Sweep-gas oxygen fraction',
            'Separate external blender',
            state.gas.fio2.toFixed(2),
            'A setpoint on the same blender, for the oxygen fraction of that gas.',
          ),
          valueSignalRow(
            'Circuit blood flow',
            'Flow probe on the circuit tubing',
            `${state.circuit.bloodFlow.toFixed(2)} L/min`,
            'A blood-path measurement, taken on the tubing rather than on the gas line.',
          ),
          channelSignalRow(
            'pInt',
            'Between pump and oxygenator',
            readouts.pInt,
            'mmHg',
            'A blood-path pressure, between the pump and the membrane.',
          ),
          channelSignalRow(
            'ΔP',
            'Derived across the membrane',
            readouts.deltaP,
            'mmHg',
            'Also blood-path: the pressure lost across the membrane.',
          ),
          valueSignalRow(
            'Post-oxygenator saturation',
            'Return limb, after the membrane',
            `${state.circuit.postOxygenatorSaturation.toFixed(1)} %`,
            'The saturation of the blood the membrane is returning to the circuit.',
          ),
          valueSignalRow(
            'Patient arterial carbon dioxide',
            'Arterial blood gas from the patient',
            state.patient.paCO2.toFixed(0),
            'A patient measurement. Note how fast it has moved as well as how far.',
          ),
          valueSignalRow(
            'Patient arterial saturation',
            'Bedside pulse oximeter',
            `${state.patient.spo2.toFixed(1)} %`,
            'The independent reading, produced by the patient rather than by the circuit.',
          ),
        ]}
        summary={`The gas source is ${sourceConnected ? 'connected' : 'interrupted'}, with sweep set to ${state.gas.sweepLpm.toFixed(1)} L/min and a sweep-gas oxygen fraction of ${state.gas.fio2.toFixed(2)}. Blood flow ${state.circuit.bloodFlow.toFixed(2)} L/min. Post-membrane saturation ${state.circuit.postOxygenatorSaturation.toFixed(1)}%, patient arterial carbon dioxide ${state.patient.paCO2.toFixed(0)}, patient saturation ${state.patient.spo2.toFixed(1)}%.`}
      />

      <PatternReading
        rows={[
          {
            label: 'Blood path',
            reading:
              readouts.pInt.displayed === null
                ? `Flow ${state.circuit.bloodFlow.toFixed(2)} L/min; pressures not reporting in this state`
                : `Flow ${state.circuit.bloodFlow.toFixed(2)} L/min · pVen ${readouts.pVen.displayed?.toFixed(0)} · pInt ${readouts.pInt.displayed?.toFixed(0)} · pArt ${readouts.pArt.displayed?.toFixed(0)} mmHg`,
            movement: 'Compare each of these with where it has sat all shift.',
          },
          {
            label: 'Gas path',
            reading: `Source ${sourceConnected ? 'connected' : 'interrupted'} · sweep ${state.gas.sweepLpm.toFixed(1)} L/min · oxygen fraction ${state.gas.fio2.toFixed(2)}`,
            movement:
              'Three separate facts: whether supply is continuous, and the two settings on the blender.',
          },
          {
            label: 'Gas transfer at the membrane',
            reading: `Post-oxygenator saturation ${state.circuit.postOxygenatorSaturation.toFixed(1)}%`,
            movement: 'Compare with the sweep row above and with the patient row below.',
          },
          {
            label: 'Patient',
            reading: `Carbon dioxide ${state.patient.paCO2.toFixed(0)} · pH ${state.patient.pH.toFixed(2)} · saturation ${state.patient.spo2.toFixed(1)}%`,
            movement: 'Note the size of the change and how quickly it came on.',
          },
        ]}
        summary={`Four rows to compare rather than one status: the blood path, the gas path, what the membrane is returning, and the patient. ${interrupted ? 'The gas-source interruption is active on this circuit.' : restored ? 'The gas source has been restored on this circuit.' : 'No gas-source interruption is active on this circuit.'}`}
      />

      <Discriminators
        items={[
          {
            question:
              'Which of the two paths through this circuit shows anything abnormal at all — the blood path, or the gas path?',
            whereToLook:
              'The first two rows of the pattern above, read as two separate systems rather than as one machine.',
          },
          {
            question:
              'Is a sweep number on a blender a statement about supply, or about delivery to the membrane?',
            whereToLook:
              'The source row and the sweep row of the signal table, which are deliberately separate entries.',
          },
          {
            question:
              'How quickly did the carbon-dioxide value move, and what does that speed rule in or out?',
            whereToLook:
              'The patient row, advanced across the event. A gradient-dependent process and a mechanical one do not fail on the same timescale.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        <Mechanism>
          <p>
            Circuit blood flow and membrane gas flow are two separate paths, and only the second has
            failed. Carbon dioxide crosses the membrane on a gradient the sweep gas maintains, so
            clearance stops almost at once when the supply is absent, while the pump goes on moving
            blood through an undisturbed circuit and the membrane returns blood it has not
            oxygenated.
          </p>
          <p>
            Sweep flow and the oxygen fraction of the sweep gas are settings on a supply. Neither
            delivers anything when the supply itself is not arriving, which is why the connection
            comes before the setpoint.
          </p>
          <p data-live-gas-state>
            {interrupted
              ? 'The source is interrupted on this circuit now, so both blender settings are requests that are not being met.'
              : restored
                ? 'The source has been restored on this circuit, and the patient values are moving back along the model curve.'
                : 'The source is connected on this circuit.'}
          </p>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'The oxygenator has failed and needs exchanging',
              standing:
                'A membrane that has genuinely stopped exchanging gas does have to be replaced, and the patient picture would look much the same. What separates them is upstream: an exchange is the answer only once the gas actually arriving at the membrane has been established.',
            },
            {
              candidate: 'Sweep is simply set too low for this patient',
              standing:
                'Under-sweeping is a real and common cause of a rising carbon-dioxide value, and it is corrected at the blender. It does not produce this onset speed, and it cannot be corrected by a control whose supply is absent.',
            },
            {
              candidate: 'Something in the blood path — clot, cannula position, resistance',
              standing:
                'The right first instinct on most deteriorations, and the pressures and gradient are where it would show. Every one of them is where it was, which is the evidence rather than an assumption.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Follow the gas path itself — source, blender, and the line into the membrane — and
            re-establish verified delivery to the oxygenator. Expect an entirely undisturbed blood
            path and a carbon-dioxide value that turns as soon as gas is arriving again.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          circuitOrGasLabel="Gas path"
          device="Pump speed left alone. The blood-path numbers were never the missing variable, and moving them would obscure the response to the correction."
          circuitOrGas="Source, blender, and the line into the membrane inspected in that order and continuity restored; sweep flow distinguished from sweep-gas oxygen fraction, and both confirmed against the restored supply rather than assumed from the dial."
          patient="Carbon dioxide, pH, and oxygenation reassessed after restoration, on the patient rather than on the circuit display."
        />

        <HarmfulReflex action="Raising the pump speed because less oxygenated blood is evidently reaching the patient.">
          <p>
            It is true that less oxygenated blood is reaching the patient, and false that flow is
            why. More blood moved past a membrane that is not being ventilated returns more blood
            that has not been oxygenated. The reflex spends the time in which the actual break could
            have been found, and it teaches the exact inference — intact gas exchange from a
            normal-looking blood-flow number — that this drill exists to remove.
          </p>
        </HarmfulReflex>
      </AfterCommitment>

      <section className={styles.section} aria-labelledby="gas-guides-heading">
        <h3 id="gas-guides-heading" className={styles.heading}>
          The blood-path channels that stayed still
        </h3>
        <TextEquivalent>
          Circuit blood flow and the transmembrane gradient, with their authored interpretations.
          They are shown here because they are the evidence that the blood path is not the problem.
        </TextEquivalent>
        <div className="mt-3 grid gap-3">
          <GuidedValue
            guide={ecmoDerivedValueGuides.circuitBloodFlow}
            value={state.circuit.bloodFlow}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.transmembraneDeltaP}
            value={readouts.deltaP.displayed}
            headingLevel={4}
          />
        </div>
      </section>
    </DrillPanelFrame>
  )
}
