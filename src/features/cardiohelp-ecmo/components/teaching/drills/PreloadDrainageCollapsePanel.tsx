import { ecmoDerivedValueGuides } from '../../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../../engine/types'
import { isInterpretable } from '../../channelReadout'
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
 * Falling flow with increasingly negative pVen.
 *
 * The discriminating observation is a *location*, not a magnitude: a pump that cannot get what it is
 * asking for shows it on the side it pulls from, and the pressures downstream fall with the flow
 * instead of rising against it. So the panel puts pVen and the two downstream channels in the same
 * table with the direction each is moving, and asks which side of the pump the change is on.
 *
 * No number for "how negative is too negative" appears anywhere here, and none should: that value
 * depends on cannula size, patient size, and configuration, and the console's own adjustable
 * pressure limits are device alarm limits rather than a taught cut point.
 */
export function PreloadDrainageCollapsePanel({ state }: { readonly state: EcmoSimulationState }) {
  const { readouts } = state.circuit
  const collapseActive = state.scenario.activeFaults.includes('preload-limited')
  const corrected = state.scenario.correctedFaults.includes('preload-limited')
  // Every comparison below is gated on the readouts meaning something. A direction computed from a
  // stopped circuit's equation intercepts is a fabricated claim even with no number printed beside it.
  const downstreamReadable = isInterpretable(readouts.pInt) && isInterpretable(readouts.pArt)

  return (
    <DrillPanelFrame
      scenarioId="preload-drainage-collapse"
      supportMode="vv"
      clinicalQuestion="Circuit flow has fallen and is swinging, drainage pressure has become steadily more negative, and the drainage limb is juddering. Which side of the pump is the limitation on, and what does that make the first move?"
      boundaries={[
        'The judder is a flag this simulation switches on below a drainage pressure it chooses, and only while one of a few authored faults is active — it is not a general consequence of suction in this model. It is not a rendering of how a real drainage line kicks, and the numbers around it come from simplified response curves.',
        'This simulation offers no number for how negative drainage pressure may become before it matters, because that value depends on cannula size, patient size, and configuration. The console does carry adjustable pressure limits, but those are device alarm limits rather than a taught cut point.',
        'Echocardiography, imaging of cannula position, and the volume picture decide this at the bedside, and none of the three is reproduced here. The single corrective action in this lab stands for all of them.',
        'This simulation does not model the harm of escalating speed against a collapsing drainage path. Its patient response follows circuit flow, so raising speed here makes the modeled saturation look better while the safety event is charged. Read the safety event, not the saturation.',
      ]}
    >
      <SignalRegister
        rows={[
          valueSignalRow(
            'Circuit blood flow',
            'Flow probe on the circuit tubing',
            `${state.circuit.bloodFlow.toFixed(2)} L/min`,
            'What the pump moved. Whether it is tracking the speed you set is the question, not the value itself.',
          ),
          valueSignalRow(
            'Speed setpoint',
            'Console, physical rotary control',
            `${state.device.rpmSetpoint} rpm`,
            `The speed this case opened at is ${state.scenario.baselineRpmSetpoint} rpm, recorded once when the case loaded.`,
          ),
          channelSignalRow(
            'pVen',
            'Drainage limb, before the pump — the side the pump pulls from',
            readouts.pVen,
            'mmHg',
            'Suction on the side the pump draws from.',
          ),
          channelSignalRow(
            'pInt',
            'Between pump and oxygenator — downstream of the pump',
            readouts.pInt,
            'mmHg',
            'The pressure the pump is producing into the circuit downstream of it.',
          ),
          channelSignalRow(
            'pArt',
            'Return limb, after the oxygenator — downstream of the membrane',
            readouts.pArt,
            'mmHg',
            'A circuit pressure, not the patient arterial blood pressure.',
          ),
          channelSignalRow(
            'ΔP',
            'Derived across the membrane',
            readouts.deltaP,
            'mmHg',
            'The pressure lost across the membrane, derived from the two channels either side of it.',
          ),
          valueSignalRow(
            'Drainage chatter',
            'Bedside circuit view',
            state.circuit.drainageChatter ? 'Present' : 'Not present',
            'A visible and text-labelled flag in this model, switched on below a drainage pressure the model chooses.',
            'authored',
          ),
        ]}
        summary={`Flow ${state.circuit.bloodFlow.toFixed(2)} L/min at ${state.device.rpmSetpoint} rpm, against an opening speed of ${state.scenario.baselineRpmSetpoint} rpm. Drainage chatter is ${state.circuit.drainageChatter ? 'present' : 'not present'}. The pressure channels are ${downstreamReadable ? 'reporting' : 'not all reporting in this state'}.`}
      />

      <PatternReading
        rows={[
          {
            label: 'Upstream of the pump',
            reading: `pVen ${readouts.pVen.displayed === null ? 'is not reporting' : `${readouts.pVen.displayed.toFixed(0)} mmHg`}`,
            movement:
              'The one channel upstream of the pump. Note which way it has moved and by how much.',
          },
          {
            label: 'Downstream of the pump',
            reading: downstreamReadable
              ? `pInt ${readouts.pInt.displayed?.toFixed(0)} mmHg, pArt ${readouts.pArt.displayed?.toFixed(0)} mmHg`
              : 'Not reporting in this state',
            movement: downstreamReadable
              ? 'Read these against the flow beside them, and against where they have sat all shift.'
              : 'No direction can be read off channels that are not reporting.',
          },
          {
            label: 'Across the membrane',
            reading:
              readouts.deltaP.displayed === null
                ? 'Not reporting in this state'
                : `ΔP ${readouts.deltaP.displayed.toFixed(0)} mmHg`,
            movement:
              'Note whether it has widened or narrowed, and compare that with what the flow did.',
          },
          {
            label: 'The drainage limb itself',
            reading: state.circuit.drainageChatter ? 'Juddering' : 'Steady',
            movement: 'Shown here as a labelled flag rather than as motion.',
          },
        ]}
        summary="The channel upstream of the pump and the channels downstream of it are listed separately, because which of them moved is what has to be established."
      />

      <Discriminators
        items={[
          {
            question:
              'Did the pressures downstream of the pump rise against the falling flow, or fall with it?',
            whereToLook:
              'pInt and pArt in the table above, read together with the flow value beside them.',
          },
          {
            question: 'Did the gradient across the membrane widen or narrow as flow fell?',
            whereToLook:
              'The ΔP row. A membrane that is resisting and a membrane simply receiving less blood move it in opposite directions.',
          },
          {
            question:
              'If a setting were changed now, would that be a treatment for whatever is limiting this circuit, or something else?',
            whereToLook:
              'The signal table: nothing in it is a setting the circuit is short of. Ask what a change would and would not correct.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        <Mechanism>
          <p>
            The location of the pressure change localises this. Available venous return has become
            insufficient for what the pump is asking for; suction climbs, flow stops tracking the
            speed, and the vessel or cannula intermittently draws shut, which is what the judder is.
            Nothing on this display points downstream: the post-pump pressures and the gradient
            across the membrane fell with the flow rather than rising against it, which is evidence
            against a downstream limitation rather than proof there is none.
          </p>
          <p data-live-fault-state>
            {collapseActive
              ? 'The drainage limitation is still active on this circuit, so the limitation is still present whatever the speed now reads.'
              : corrected
                ? 'The drainage cause has been corrected on this circuit, and the model is updating toward the corrected state.'
                : 'No drainage limitation is active on this circuit at the moment.'}
          </p>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'Oxygenator resistance or a failing membrane lung',
              standing:
                'A real cause of falling flow, and it has its own signature: the pressure feeding the membrane rises and the gradient across it widens. Both would have to be moving the other way from what this circuit shows.',
            },
            {
              candidate: 'Hypovolaemia specifically',
              standing:
                'Volume is one of the reasons venous return can fall short, and it stays on the list. It is not the only one, and a bolus given before the cause has been named treats a category rather than a finding.',
            },
            {
              candidate: 'Change nothing and go straight to the patient and the limb',
              standing:
                'The most defensible of the alternatives, and it gets the priority right: the setting is not the cause and looking is what finds it. What it gives up is the quieter circuit — a collapse that is still being driven is harder to examine, and the reduction costs nothing that correcting the cause will not give back.',
            },
            {
              candidate: 'Cannula position, a kinked or compressed limb, coughing and straining',
              standing:
                'All still open. Separating them needs the patient, the limb, and imaging — which is the reason the search matters more than the setting.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Two separate acts, in order. Take demand off the pump so the collapse quiets and the
            circuit becomes steady enough to search on — that is a holding measure, and it corrects
            nothing. Then find and correct what venous return is actually short of: cannula
            position, a kink or compression, the straining, the volume state.
          </p>
          <p>
            Until one of those has been put right, the limitation is still present however calm the
            display looks.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          device="Pump demand reduced, temporarily and deliberately, and recorded as a holding action rather than as a correction."
          circuitOrGas="Drainage limb traced for kinking or compression; cannula position reviewed with the imaging the unit uses; the circuit watched for the judder resolving as the cause is corrected."
          patient="Coughing, straining, and ventilator interaction addressed; volume state assessed rather than assumed; effective support judged on a patient endpoint rather than on the flow display."
        />

        <HarmfulReflex action="Raising the speed until the flow display comes back to where it was.">
          <p>
            At a bedside, asking a collapsing drainage path for more makes the suction worse and the
            collapse more complete, and the flow that comes back is bought from a vessel that is
            being drawn shut. This simulation records escalating speed during a drainage collapse as
            a safety event under its own mechanism name.
          </p>
          <p data-model-response-caveat>
            Be careful what you take from the numbers if you try it here. This simulation raises
            displayed flow — and the modeled patient saturation with it — when speed is raised in
            this state, because its patient response is a simple function of flow and carries no
            penalty for the collapse. The improvement you would see is an artefact of a bounded
            teaching model, not a result, and the safety event is charged precisely because the
            model cannot show you the cost.
          </p>
        </HarmfulReflex>

        {/*
          Inside the gate: the authored interpretation of the drainage-pressure guide states the
          mechanism in as many words, so a learner scrolling the panel before choosing would meet
          the answer in a reference block.
        */}
        <section className={styles.section} aria-labelledby="preload-guides-heading">
          <h3 id="preload-guides-heading" className={styles.heading}>
            The channels this turns on
          </h3>
          <TextEquivalent>
            Drainage pressure, circuit blood flow, and the transmembrane gradient with their
            authored interpretations. Each shows no value rather than an invented one where the
            channel is not reporting.
          </TextEquivalent>
          <div className="mt-3 grid gap-3">
            <GuidedValue
              guide={ecmoDerivedValueGuides.pVen}
              value={readouts.pVen.displayed}
              headingLevel={4}
            />
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
      </AfterCommitment>
    </DrillPanelFrame>
  )
}
