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
 * Startup, self-test, and sensor orientation.
 *
 * The teaching here is one distinction repeated in four places: the scope of a claim. A device
 * diagnostic speaks for device functions, a walk from cannula to cannula speaks for the circuit, the
 * blender speaks for the gas path, and the bedside speaks for the patient — and this console can
 * only ever produce the first two. The panel is built so the learner reads that off the live state
 * rather than being told it, which is why the four domains are a live table and not a list.
 */

type StartupStage = 'pre-use' | 'demonstration' | 'verified'

function stageOf(state: EcmoSimulationState): StartupStage {
  if (state.circuit.circuitInspected) return 'verified'
  return state.device.pumpRunning && state.circuit.bloodFlow > 0 ? 'demonstration' : 'pre-use'
}

const STAGE_SUMMARY: Readonly<Record<StartupStage, string>> = {
  'pre-use':
    'The pump is stopped. Flow is a real zero because its sensor is connected; the three pressure channels and the gradient are not values this model produces for a stopped pump, so they show the unavailable indication with the reason beside it. Nothing on this circuit has been walked by hand.',
  demonstration:
    'The pump is turning, so flow and all three pressure channels are reporting numbers again. Nothing about this circuit has been verified by that: a reference circuit brought up to show you where the readings live is a demonstration, not a completed pre-use sequence.',
  verified:
    'The tip-to-tip inspection has been recorded on this circuit. That is the point at which the circuit domain has something behind it — and it is a separate claim from anything the console reported.',
}

export function StartupSensorOrientationPanel({ state }: { readonly state: EcmoSimulationState }) {
  const stage = stageOf(state)
  const { readouts } = state.circuit
  const inspectionOutstanding = state.scenario.activeFaults.includes('startup-inspection')

  const domains = [
    {
      label: 'Device',
      reading: `Self-test ${state.device.selfTest}, ${state.device.rpmSetpoint} rpm set, power on ${state.device.powerSource.toUpperCase()} at ${Math.round(state.device.batteryPercent)}% battery.`,
      movement: 'The console can speak for this domain, and only this one, on its own.',
    },
    {
      label: 'Circuit and sensors',
      reading: state.circuit.circuitInspected
        ? 'Tip-to-tip inspection recorded on this circuit.'
        : 'No tip-to-tip inspection recorded on this circuit.',
      movement:
        'Flow-probe orientation, which pressure sits on which limb, connections and both cannulas are established by hand, not by the screen.',
    },
    {
      label: 'External gas path',
      reading: `Source ${state.gas.sourceConnected ? 'connected' : 'interrupted'}, sweep ${state.gas.sweepLpm.toFixed(1)} L/min, sweep-gas oxygen fraction ${state.gas.fio2.toFixed(2)}.`,
      movement:
        'The blender is a separate device. Its settings are a statement about supply, not about gas having reached the membrane.',
    },
    {
      label: 'Independent patient data',
      reading: `Bedside saturation ${state.patient.spo2.toFixed(0)}%, arterial carbon dioxide ${state.patient.paCO2.toFixed(0)}, mean arterial pressure ${state.patient.meanArterialPressure.toFixed(0)}.`,
      movement: 'Nothing on the console produces any of this. It arrives from the patient.',
    },
  ]

  return (
    <DrillPanelFrame
      scenarioId="startup-sensor-orientation"
      supportMode="vv"
      clinicalQuestion="Before this venovenous circuit carries blood, what has actually been established — and by which of the four sources of information in the room?"
      boundaries={[
        'The circuit walk in this simulation resolves to a single recorded check. A real pre-use list is dozens of separate confirmations, and local pre-use documentation, the manufacturer instructions, and the unit backup and escalation policy govern the real sequence.',
        'The absent pressure numbers are this simulation declining to produce flow-dependent values for a stopped pump. A stopped pump on a primed circuit has genuine static pressures; this model does not represent them, and the dashes are not a claim about what any particular console would display.',
        'The console follows the U.S. CARDIOHELP Instructions for Use, Revision 2.3 (January 2025). This simulation does not reproduce the physical work of priming, de-airing, or securing a circuit.',
      ]}
    >
      <section className={styles.section} aria-labelledby="startup-stage-heading">
        <h3 id="startup-stage-heading" className={styles.heading}>
          The state on screen right now
        </h3>
        <p className="mt-2 font-semibold" data-startup-stage={stage}>
          {stage === 'pre-use'
            ? 'Stopped, and nothing on it verified'
            : stage === 'demonstration'
              ? 'Running as a reference demonstration'
              : 'Inspection recorded'}
        </p>
        <p className="mt-1">{STAGE_SUMMARY[stage]}</p>
        {inspectionOutstanding ? (
          <p className="mt-2 text-muted-foreground" data-startup-inspection-outstanding>
            The startup diagnostic and the tip-to-tip inspection are both still outstanding on this
            circuit — whether you have arrived here for the first time or come back to it after the
            demonstration.
          </p>
        ) : null}
      </section>

      <SignalRegister
        rows={[
          valueSignalRow(
            'Flow',
            'Flow probe on the circuit tubing',
            `${state.circuit.bloodFlow.toFixed(2)} L/min`,
            state.circuit.flowSensorConnected
              ? 'With its sensor connected, zero is a real reading rather than an absent one. That is what separates it from the pressure channels beside it.'
              : 'The flow sensor is not connected, so the console has nothing to measure.',
            state.circuit.flowSensorConnected ? 'valid' : 'device-unavailable',
          ),
          channelSignalRow(
            'pVen',
            'Drainage limb, before the pump',
            readouts.pVen,
            'mmHg',
            'Says how hard the pump is pulling against what the patient can give it.',
          ),
          channelSignalRow(
            'pInt',
            'Between pump and oxygenator',
            readouts.pInt,
            'mmHg',
            'The pressure the membrane is being fed at.',
          ),
          channelSignalRow(
            'pArt',
            'Return limb, after the oxygenator',
            readouts.pArt,
            'mmHg',
            'A circuit pressure. It is not the patient arterial blood pressure and does not stand in for it.',
          ),
          channelSignalRow(
            'ΔP',
            'Derived across the membrane',
            readouts.deltaP,
            'mmHg',
            'Only as trustworthy as the two channels it is the difference of.',
          ),
          valueSignalRow(
            'Speed setpoint',
            'Console, physical rotary control',
            `${state.device.rpmSetpoint} rpm`,
            'A setting you made. It is interpretable whether or not the pump is turning.',
          ),
          valueSignalRow(
            'Self-test',
            'Console device diagnostic',
            state.device.selfTest,
            'A statement about device functions. It says nothing about the tubing between the two cannulas.',
          ),
          valueSignalRow(
            'Sweep and sweep-gas oxygen fraction',
            'Separate external blender',
            `${state.gas.sweepLpm.toFixed(1)} L/min · ${state.gas.fio2.toFixed(2)}`,
            'Set on a different device from the one displaying the blood-path numbers.',
            'authored',
          ),
        ]}
        summary={`Flow reads ${state.circuit.bloodFlow.toFixed(2)} L/min from a ${state.circuit.flowSensorConnected ? 'connected' : 'disconnected'} sensor. The three pressure channels and the gradient are ${readouts.pVen.displayed === null ? 'not reporting in this state' : 'reporting numbers'}. The speed setpoint, self-test result, power source, and the two blender settings are readable either way.`}
      />

      <PatternReading
        rows={domains}
        summary="Four domains, four different sources. Two of them have something on this console; two of them do not."
      />

      <Discriminators
        items={[
          {
            question:
              'Where a channel shows nothing, is it because the device would show nothing, or because this simulation has no value for it?',
            whereToLook:
              'The reason printed beside each dash in the table above says which of the two it is.',
          },
          {
            question:
              'Which of the four domains does a device that reports itself ready actually speak for?',
            whereToLook:
              'Compare the self-test row with the circuit, gas-path, and patient rows in the pattern above.',
          },
          {
            question:
              'Is a channel that has stopped reporting a fault to be chased, or a property of the state the circuit is in?',
            whereToLook:
              'Bring the reference circuit up and watch which rows change kind, then stop it again.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        <Mechanism>
          <p>
            Each of the four domains is a separate claim with a separate source, and none of them
            substitutes for another. The console is authoritative about device functions and about
            the circuit values its own sensors produce; it is silent about whether the tubing runs
            where you think it runs, about whether gas is reaching the membrane, and about the
            patient entirely.
          </p>
          <p>
            The stopped, unpressurised circuit is the one state in which the other three can be
            checked at no cost. That is the reason verification precedes support rather than
            following it.
          </p>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'A completed startup diagnostic is the verified starting state',
              standing:
                'It is a real and necessary step, and it does establish the device domain. It leaves the circuit, gas-path, and patient domains exactly where they were.',
            },
            {
              candidate: 'The pressure sensors or their cables need attention',
              standing:
                'Worth ruling out at any time, but the reason beside each dash distinguishes a sensor problem from a state this model does not produce a value for. Read the reason before spending the time.',
            },
            {
              candidate: 'The gas path should be confirmed first',
              standing:
                'The gas path does need confirming, and its settings are already on the blender. Doing it first is not wrong; treating it as the whole of the pre-use sequence is.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Work all four domains before support is set: let the startup diagnostic run through,
            walk the circuit by hand from drainage cannula to return cannula, confirm the gas source
            and blender, confirm power and an immediately available backup, and pair the whole of it
            with patient data the console has no way of producing.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          circuitOrGasLabel="Circuit and gas path"
          device="Self-test allowed to finish without the touchscreen or rotary control being operated; the startup screen and the audible indicator confirmed; power source and backup readiness confirmed."
          circuitOrGas="Drainage to pump to oxygenator to return traced by hand; flow-probe orientation and each pressure location confirmed on the limb it belongs to; connections and both cannulas checked; the gas source and blender settings confirmed at the blender."
          patient="Independent bedside and blood-gas data obtained, because none of it exists anywhere on this console."
        />

        <HarmfulReflex action="Bringing the pump up to the ordered speed and inspecting the circuit under flow.">
          <p>
            Nothing showing a fault is not the same as something having been checked. Establishing
            support first makes every subsequent check one performed on a pressurised circuit
            carrying the patient&apos;s blood, and removes the only opportunity to find a
            misorientated probe or a wrong-limb connection at no cost.
          </p>
        </HarmfulReflex>
      </AfterCommitment>

      <section className={styles.section} aria-labelledby="startup-guides-heading">
        <h3 id="startup-guides-heading" className={styles.heading}>
          The channels, and what each is for
        </h3>
        <TextEquivalent>
          Flow, the three pressure channels, and the gradient with their authored interpretations.
          Where a channel is not reporting, its guide shows no value rather than an invented one.
        </TextEquivalent>
        <div className="mt-3 grid gap-3">
          <GuidedValue
            guide={ecmoDerivedValueGuides.circuitBloodFlow}
            value={state.circuit.bloodFlow}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.pVen}
            value={readouts.pVen.displayed}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.pInt}
            value={readouts.pInt.displayed}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.pArt}
            value={readouts.pArt.displayed}
            headingLevel={4}
          />
        </div>
      </section>
    </DrillPanelFrame>
  )
}
