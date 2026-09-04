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
  offConsoleSignalRow,
  valueSignalRow,
} from './drillPanelPrimitives'

/**
 * Arterial bubble alarm with pump stop.
 *
 * The whole of this drill is ordering, so the panel is built around a live sequence rather than
 * around a pattern: what the device has done, what isolation has and has not been achieved, whether
 * the source has been corrected, and whether the latch is still set. Each of those is a separate
 * state flag in the engine, and reading them as one — "the alarm is handled" — is the error.
 *
 * No bubble size appears anywhere, and none should: the manufacturer document supplied for this
 * module is internally inconsistent on a size threshold, so this exercise teaches a sequence rather
 * than a rule about how much air matters.
 */

/**
 * What the one resumption action is, said in the same words everywhere it appears.
 *
 * The module teaches recognition, isolation, source correction and de-airing. It does not teach
 * where clamp opening, pump restart and console reset fall relative to one another afterwards —
 * that is device- and program-specific — so the action that stands in for it has to say so wherever
 * it is described.
 */
const BOUNDED_ACTION_NOTE =
  'This single simulated action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.'

interface BubbleStep {
  readonly label: string
  readonly done: boolean
  readonly detail: string
}

export function ArterialBubbleStopPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, device } = state
  const sourceCorrected = state.scenario.correctedFaults.includes('arterial-bubble')
  const isolated = circuit.drainageClampClosed && circuit.returnClampClosed

  const sequence: readonly BubbleStep[] = [
    {
      label: 'The device stopped the pump',
      done: !device.pumpRunning,
      detail:
        'Forward push removed. This is the only thing the intervention did, and it is not isolation.',
    },
    {
      label: 'Return limb clamped near the patient',
      done: circuit.returnClampClosed,
      detail: 'The limb that would carry air to the patient, closed first.',
    },
    {
      label: 'Drainage limb clamped near the patient',
      done: circuit.drainageClampClosed,
      detail: 'The patient is separated from the circuit only once both limbs are closed.',
    },
    {
      label: 'Air source found and corrected',
      done: sourceCorrected,
      detail:
        'The only step that stops air returning as soon as flow does. Nothing before it addresses the cause.',
    },
    {
      label: 'Support resumed per the current IFU and approved local protocol',
      done:
        !circuit.bubbleResetRequired &&
        !circuit.drainageClampClosed &&
        !circuit.returnClampClosed &&
        device.pumpRunning,
      detail:
        'One simulated step here, taken only once the source and the circuit are both right. This single simulated action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
    },
  ]

  return (
    <DrillPanelFrame
      scenarioId="arterial-bubble-stop"
      supportMode="vv"
      clinicalQuestion="The bubble channel has raised a high-priority alarm and the pump has stopped on its own. What has that stop actually achieved, and what has to be true before this circuit carries blood to the patient again?"
      boundaries={[
        'This exercise injects an air event with no volume assigned to it and no threshold behind it. The manufacturer document supplied for this module is internally inconsistent on a bubble-size threshold, so this simulation offers no trigger value and teaches a sequence instead.',
        'This module teaches isolation — return limb, then drainage limb, near the patient — because that is what separates a patient from an air column wherever the air is found. It deliberately does not teach where clamp opening, pump restart and console reset fall relative to one another during resumption: that choreography is device- and program-specific, and approved protocols differ on it. This single simulated action stands in for the device- and program-specific resumption sequence; it does not reproduce or teach that sequence.',
        'This simulation does not represent the physical work of de-airing a real circuit, and it does not model the patient being carried conventionally while the circuit is off. Both are real and both happen in the time this lab compresses to a button.',
      ]}
    >
      <SignalRegister
        rows={[
          valueSignalRow(
            'Bubble intervention',
            'Console, arterial bubble channel',
            circuit.arterialBubbleDetected ? 'Air detected' : 'No air indicated',
            'A device response to a detected event. It reports the channel, not the volume of air.',
            'authored',
          ),
          valueSignalRow(
            'Pump',
            'Console device state',
            device.pumpRunning ? 'Running' : 'Stopped',
            'The device stopped it when the channel fired.',
          ),
          valueSignalRow(
            'Bubble reset latch',
            'Console, Interventions screen',
            circuit.bubbleResetRequired ? 'Set — reset still required' : 'Clear',
            'A latch the device holds until it is reset. Reset restarts the pump.',
          ),
          valueSignalRow(
            'Near-patient clamps',
            'Bedside circuit, both limbs',
            `Drainage ${circuit.drainageClampClosed ? 'closed' : 'open'} · return ${circuit.returnClampClosed ? 'closed' : 'open'}`,
            'Two independent clamps on the bedside circuit, one on each limb, near the patient.',
            // Not a console reading. The CARDIOHELP has no clamp sensor, and the whole point of this
            // drill is that the device state and the isolation state are separate facts — so the
            // register must not tell the learner the console can be consulted for this one.
            'bedside',
          ),
          valueSignalRow(
            'Circuit blood flow',
            'Flow probe on the circuit tubing',
            `${circuit.bloodFlow.toFixed(2)} L/min`,
            'A real reading either way: the sensor is connected, so a zero here is the circuit reporting zero rather than the console reporting nothing.',
          ),
          channelSignalRow(
            'pVen',
            'Drainage limb, before the pump',
            circuit.readouts.pVen,
            'mmHg',
            'A circuit pressure on the drainage limb.',
          ),
          channelSignalRow(
            'pArt',
            'Return limb, after the oxygenator',
            circuit.readouts.pArt,
            'mmHg',
            'A circuit pressure on the return limb — never the patient arterial blood pressure.',
          ),
          offConsoleSignalRow(
            'Patient arterial saturation',
            'Bedside pulse oximeter',
            `${state.patient.spo2.toFixed(1)} %`,
            'The independent reading. Note which way it is going while the circuit is not running.',
          ),
        ]}
        summary={`Pump ${device.pumpRunning ? 'running' : 'stopped'}, reset latch ${circuit.bubbleResetRequired ? 'set' : 'clear'}, drainage clamp ${circuit.drainageClampClosed ? 'closed' : 'open'}, return clamp ${circuit.returnClampClosed ? 'closed' : 'open'}, air source ${sourceCorrected ? 'corrected' : 'not corrected'}. Flow ${circuit.bloodFlow.toFixed(2)} L/min; the pressure channels ${circuit.readouts.pVen.displayed === null ? 'are not reporting in this state' : 'are reporting'}.`}
      />

      <PatternReading
        rows={[
          {
            label: 'What the device did',
            reading: `Pump ${device.pumpRunning ? 'running' : 'stopped'} · intervention latch ${circuit.bubbleResetRequired ? 'set' : 'clear'}`,
            movement: 'Two device states. Note what each one is a statement about.',
          },
          {
            label: 'What is between the patient and the circuit',
            reading: `Drainage clamp ${circuit.drainageClampClosed ? 'closed' : 'open'} · return clamp ${circuit.returnClampClosed ? 'closed' : 'open'}`,
            movement: 'Two bedside states, independent of the device states above.',
          },
          {
            label: 'The air source',
            reading: sourceCorrected ? 'Recorded as corrected' : 'Not recorded as corrected',
            movement: 'A third state again, separate from both the device and the clamps.',
          },
          {
            label: 'The patient',
            reading: `Saturation ${state.patient.spo2.toFixed(1)}% · flow ${circuit.bloodFlow.toFixed(2)} L/min`,
            movement: 'Note the direction of travel, and what is and is not driving it.',
          },
        ]}
        summary={`Device state, clamp state, and source state are three separate facts. The patient is ${isolated ? 'isolated from both limbs' : 'still continuous with at least one limb'}, and the air source is ${sourceCorrected ? 'corrected' : 'not corrected'}.`}
      />

      <Discriminators
        items={[
          {
            question:
              'Does stopping the pump separate the patient from the circuit, or only stop blood being pushed along it?',
            whereToLook:
              'The pump row and the clamp row of the signal table. They are two different state flags for a reason.',
          },
          {
            question:
              'Which of the states in the table above is about where air is entering, rather than about what air already in the circuit is doing?',
            whereToLook:
              'The four rows of the pattern. They are four separate facts; ask what each one would and would not change.',
          },
          {
            question: 'The saturation is falling. What does that change, and what does it not?',
            whereToLook:
              'The patient row against the reset-latch row, and what resetting the latch would and would not do to the circuit.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        {/*
          The ordered checklist is the answer to "what has the pump stop achieved", so it belongs
          here. Before the commitment the same five facts are on the panel as five separate states
          with nothing said about what they add up to.
        */}
        <PatternReading
          title="The five things that have to be true, in order"
          headingId="drill-bubble-sequence-heading"
          rows={sequence.map((step) => ({
            label: step.label,
            reading: step.done ? 'Done' : 'Not yet',
            movement: step.detail,
          }))}
          summary={`${sequence.filter((step) => step.done).length} of 5 are true on this circuit.`}
        />

        <Mechanism>
          <p>
            The device intervention and the isolation are two different acts. Stopping the pump
            removes the forward push; only the near-patient clamps separate the patient from an air
            column; and only finding where air is entering keeps it from returning as soon as flow
            does. Reset is never a response to the alarm, and never a substitute for source
            correction and de-airing; where it falls within resumption is governed by the current
            IFU and your unit&apos;s approved protocol. The patient is carried conventionally
            throughout.
          </p>
          <p data-live-bubble-state>
            {sourceCorrected
              ? circuit.bubbleResetRequired
                ? 'The source has been corrected on this circuit and the latch is still set — which is correct: clearing it is a separate act from correcting the cause.'
                : 'The source has been corrected and support resumed, so this circuit came back only once the air had been dealt with.'
              : circuit.bubbleResetRequired
                ? 'The source has not been corrected on this circuit and the latch is still set. Resetting now would restart the pump on a circuit whose air source is still there.'
                : 'The latch is clear on this circuit.'}
          </p>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'A stopped pump has already separated the patient from the circuit',
              standing:
                'Superficially reasonable, and it is the belief the clamp step exists to correct. Air in a limb continuous with the patient does not need a pump to reach them, and the console reports the pump and the clamps as separate states because they are separate facts.',
            },
            {
              candidate: 'The amount of air should be established first',
              standing:
                'Volume genuinely matters clinically. It is not obtainable here, and it does not change the first move: isolation and source-finding are the same whatever the volume, so establishing it first only delays them.',
            },
            {
              candidate: 'The membrane lung is the source and should be exchanged',
              standing:
                'An exchange may end up being right, but a return-side detection is weak evidence for it: the detector reports where air was found, not where it entered. Air is entrained wherever circuit pressure is below atmospheric — the drainage limb, its connections, and any line handled near the patient — and the return side is simply where it announces itself. This is a conclusion that follows finding the source, not one that substitutes for it.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Recognise that the device has stopped forward flow and nothing else; close the return
            limb and then the drainage limb near the patient to isolate; find and correct where air
            is entering and confirm the circuit is clear. After the source is corrected and the
            circuit is confirmed clear, resume support through the protocol-governed clamp, pump,
            and device sequence.
          </p>
          <p>
            Which limb opens first, when the pump turns, and where the console reset falls are
            device- and program-specific, and are governed by the current IFU and your unit&apos;s
            approved ECMO air-emergency protocol. This simulation is not the authority on any of it.{' '}
            {BOUNDED_ACTION_NOTE}
          </p>
          <p>
            Acknowledgement is not correction, and reset is not source control. Each is a separate
            act with a separate purpose.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          device="Alarm recognised rather than merely silenced; the intervention left latched until the circuit is right; the device brought back only as part of the protocol-governed resumption."
          circuitOrGas="Return limb clamped, then the drainage limb, near the patient; the air source found and eliminated; the circuit confirmed bubble free; then support resumed per the current IFU and approved local protocol."
          patient="Carried conventionally while the circuit is off, with oxygenation and haemodynamics followed independently of a console that has nothing to report while the pump is stopped."
        />

        <HarmfulReflex action="Getting the pump turning again before the air source has been dealt with.">
          <p>
            The falling saturation makes this the most tempting action in the drill, and it is the
            one that returns air to a patient. Resuming restores forward flow; it does not remove
            air and it does not close the way air got in. This simulation records a resume before
            the cause has been corrected as a critical safety error, and it records opening a clamp
            on a circuit whose air is neither corrected nor cleared as a separate one.
          </p>
          <p>
            It also refuses to let you open the last closed limb by hand while the latch still holds
            the pump. That would put the patient back on both limbs of a circuit moving no blood,
            which is exactly the state the single resume step exists to skip past.
          </p>
        </HarmfulReflex>
      </AfterCommitment>

      <section className={styles.section} aria-labelledby="bubble-guides-heading">
        <h3 id="bubble-guides-heading" className={styles.heading}>
          What the console can and cannot report here
        </h3>
        <TextEquivalent>
          Circuit blood flow with its authored interpretation, and the drainage-limb pressure
          showing no value rather than an invented one while the pump is stopped.
        </TextEquivalent>
        <div className="mt-3 grid gap-3">
          <GuidedValue
            guide={ecmoDerivedValueGuides.circuitBloodFlow}
            value={circuit.bloodFlow}
            headingLevel={4}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.pVen}
            value={circuit.readouts.pVen.displayed}
            headingLevel={4}
          />
        </div>
      </section>
    </DrillPanelFrame>
  )
}
