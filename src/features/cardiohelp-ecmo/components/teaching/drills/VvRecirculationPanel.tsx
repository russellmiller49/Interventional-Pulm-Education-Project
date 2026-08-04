import { ecmoDerivedValueGuides } from '../../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../../engine/types'
import { DisclosedWorking, GuidedValue, TextEquivalent, styles } from '../shared'
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
 * High displayed flow with limited oxygenation response.
 *
 * The module's spine runs through this panel: displayed litres are not effective support, drainage
 * saturation climbing toward return saturation is the bedside signature, and asking a circuit that
 * is already re-draining its own return for more recruits more of that return.
 *
 * The algebra stays behind the shared disclosure, warning first. It looks like a formula for
 * estimating recirculation from two saturations and is not one — the share here is a property this
 * case authors, and the systemic venous value the drainage saturation is read against is a modeled
 * estimate rather than anything the device measured.
 */
export function VvRecirculationPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { readouts } = state.circuit
  const recirculationActive = state.scenario.activeFaults.includes('recirculation')
  const corrected = state.scenario.correctedFaults.includes('recirculation')
  const baselineRpm = state.scenario.baselineRpmSetpoint
  const aboveBaseline = state.device.rpmSetpoint > baselineRpm
  const displayedFlow = state.circuit.bloodFlow
  const effectiveFlow = state.circuit.recirculationAdjustedCircuitFlowLpm
  const share = state.circuit.recirculationFraction

  return (
    <DrillPanelFrame
      scenarioId="vv-recirculation"
      supportMode="vv"
      clinicalQuestion="Displayed circuit flow is high and every circuit pressure is where it has been all shift, yet the patient is losing ground. Is the number on the screen measuring the support this patient is receiving?"
      boundaries={[
        'The re-drained share is authored as a property of this case at and below the speed it opened at, and widens when the circuit is asked for more. Cannula position, cannula design, volume state and native venous return — the things that actually set recirculation at the bedside — are not modeled here at all.',
        'The systemic venous value that the drainage saturation is read against is a modeled estimate, not a device reading. The direction the teaching coefficient moves in is an educational statement about pulling harder on a re-draining circuit, not a bedside equation.',
        'Separating re-drainage from a genuinely high systemic venous saturation at the bedside takes cannula and imaging data this console cannot supply. No share threshold, flow target, or cannula position is taught in this simulation.',
      ]}
    >
      <SignalRegister
        rows={[
          valueSignalRow(
            'Displayed circuit flow',
            'Flow probe on the circuit tubing',
            `${displayedFlow.toFixed(2)} L/min`,
            'Counts every litre the pump moved past the probe. Whether all of it reached the patient is a separate question this number does not answer.',
          ),
          channelSignalRow(
            'Drainage-limb saturation',
            'Drainage limb, before the oxygenator',
            readouts.venousLineSaturation,
            '%',
            'The saturation of whatever the pump is drawing. It is a drainage-limb value, not a systemic mixed-venous saturation.',
            1,
          ),
          valueSignalRow(
            'Post-oxygenator saturation',
            'Return limb, after the membrane',
            `${state.circuit.postOxygenatorSaturation.toFixed(1)} %`,
            'The saturation of what the membrane is sending back into the circuit.',
          ),
          valueSignalRow(
            'Systemic venous saturation',
            'Estimated by this model, not measured',
            `${state.patient.systemicVenousSaturationEstimate.toFixed(1)} %`,
            'A model estimate of the patient venous saturation. The device does not produce this number.',
            'estimated',
          ),
          valueSignalRow(
            'Patient arterial saturation',
            'Bedside pulse oximeter',
            `${state.patient.spo2.toFixed(1)} %`,
            'The independent reading, produced by the patient rather than by the circuit.',
          ),
          channelSignalRow(
            'ΔP',
            'Derived across the membrane',
            readouts.deltaP,
            'mmHg',
            'A blood-path resistance measurement across the membrane.',
          ),
        ]}
        summary={`Displayed flow ${displayedFlow.toFixed(2)} L/min at ${state.device.rpmSetpoint} rpm. Drainage-limb saturation ${readouts.venousLineSaturation.displayed === null ? 'is not reporting' : `${readouts.venousLineSaturation.displayed.toFixed(1)}%`}, modeled systemic venous estimate ${state.patient.systemicVenousSaturationEstimate.toFixed(1)}%, post-membrane ${state.circuit.postOxygenatorSaturation.toFixed(1)}%, patient arterial saturation ${state.patient.spo2.toFixed(1)}%.`}
      />

      <PatternReading
        rows={[
          {
            label: 'Displayed flow and the speed producing it',
            reading: `${displayedFlow.toFixed(2)} L/min at ${state.device.rpmSetpoint} rpm · this case opened at ${baselineRpm} rpm`,
            movement:
              'Note both, and note what each does if the speed is changed. They are two separate observations.',
          },
          {
            label: 'The drainage limb beside the patient',
            reading: `Drainage ${readouts.venousLineSaturation.displayed === null ? 'not reporting' : `${readouts.venousLineSaturation.displayed.toFixed(1)}%`} · patient arterial ${state.patient.spo2.toFixed(1)}%`,
            movement:
              'Read these two against each other rather than each on its own, and note how far apart they are.',
          },
          {
            label: 'What the membrane is returning',
            reading: `Post-oxygenator ${state.circuit.postOxygenatorSaturation.toFixed(1)}%`,
            movement: 'Compare with the drainage-limb value above and with the patient.',
          },
          {
            label: 'Circuit pressures',
            reading:
              readouts.pInt.displayed === null
                ? 'Not reporting in this state'
                : `pVen ${readouts.pVen.displayed?.toFixed(0)} · pInt ${readouts.pInt.displayed?.toFixed(0)} · pArt ${readouts.pArt.displayed?.toFixed(0)} mmHg`,
            movement: 'Compare each with where it has sat all shift.',
          },
        ]}
        summary={`Displayed flow, the two saturations either side of the pump, what the membrane returns, and the pressure channels — four separate readings to compare rather than one status. ${recirculationActive ? 'A recirculation state is active on this circuit.' : corrected ? 'The recirculation cause has been corrected on this circuit.' : 'No recirculation state is active on this circuit.'}`}
      />

      <Discriminators
        items={[
          {
            question:
              'Is the drainage-limb saturation sitting well below the patient arterial value, or moving toward it?',
            whereToLook:
              'The drainage and patient rows of the pattern above, compared with each other rather than each read alone.',
          },
          {
            question:
              'If the membrane were the problem, what would the post-oxygenator saturation and the gradient across it be doing?',
            whereToLook: 'The post-oxygenator and ΔP rows of the signal table.',
          },
          {
            question:
              'When the circuit is asked for more, do the displayed flow and the adjusted flow move the same way?',
            whereToLook:
              'The two flow numbers, before and after any change to the speed. This is the observation the whole drill turns on.',
          },
        ]}
      />

      <AfterCommitment state={state}>
        {/*
          The adjusted flow and the share are held back to here on purpose. Both are derived from
          the one authored quantity that names the mechanism, and putting either beside the displayed
          flow before the learner has chosen would answer the question the drill is asking.
        */}
        <SignalRegister
          title="The quantities this model was withholding"
          headingId="drill-signals-after-commit-heading"
          rows={[
            valueSignalRow(
              'Recirculation-adjusted circuit flow',
              'Derived by this model from displayed flow and the re-drained share',
              `${effectiveFlow.toFixed(2)} L/min`,
              'The part of the displayed flow on its first circuit. In venovenous support this is the quantity the patient follows.',
              'estimated',
            ),
            valueSignalRow(
              'Re-drained share',
              'Authored by this case, and raised by speed above the opening speed',
              share.toFixed(3),
              'A property of where the cannulae sit and how hard the circuit is pulling. It is not calculated from the saturations.',
              'authored',
            ),
          ]}
          summary={`Displayed ${displayedFlow.toFixed(2)} L/min against an adjusted ${effectiveFlow.toFixed(2)} L/min, at an authored re-drained share of ${share.toFixed(3)}.`}
        />

        <Mechanism>
          <p>
            Some of the oxygenated blood the circuit returns is drawn straight back into the
            drainage cannula. Displayed litres count it twice, so the number on the screen rises
            while the support reaching the patient does not follow it. The drainage limb is diluted
            by return blood, which is why its saturation climbs toward the post-membrane value
            instead of sitting well below it — and the patient and the drainage limb moving in
            opposite directions is the whole signature.
          </p>
          <p data-live-effective-support>
            On this circuit right now the console displays {displayedFlow.toFixed(2)} L/min, of
            which this model puts {effectiveFlow.toFixed(2)} L/min on its first circuit.
            {aboveBaseline
              ? ` The speed has been taken above the ${baselineRpm} rpm this case opened at, and the two numbers have separated further as a result.`
              : ' The speed is at or below the one this case opened at.'}
          </p>
          <DisclosedWorking
            summary="Show how this simulation gets from a share to an adjusted flow"
            caution="Do not carry this to a bedside. It looks like a method for estimating recirculation from two saturations and it is not one: the share here is authored by this case, and the systemic venous value is a model estimate rather than a measurement."
          >
            <p>
              Adjusted flow is displayed flow multiplied by one minus the re-drained share, and the
              drainage-limb saturation is the systemic venous estimate moved toward the
              post-membrane value by that same share. Both directions come from the one authored
              quantity; neither is derived from the saturations, and neither is a bedside
              calculation.
            </p>
          </DisclosedWorking>
        </Mechanism>

        <CompetingExplanations
          items={[
            {
              candidate: 'The membrane lung has stopped transferring oxygen',
              standing:
                'A real cause of a deteriorating patient on unchanged settings, and it would show as a falling post-membrane saturation and usually a widening gradient. Both are available on this display and neither is doing that here.',
            },
            {
              candidate: 'Gas transfer across the membrane is the limit',
              standing:
                'Sweep and sweep-gas oxygen fraction are the controls for carbon-dioxide clearance and membrane oxygen delivery. Raising sweep in this model moves the carbon-dioxide value and leaves the arterial saturation where it is, which is a different problem from this one.',
            },
            {
              candidate: 'Support is being lost somewhere in the circuit, mechanism unnamed',
              standing:
                'Reasonable as far as it goes, and it points at the right place to look. It stops one step short of the observation that would name it, which is the pair of saturations rather than any pressure.',
            },
          ]}
        />

        <FittingResponse>
          <p>
            Read the circuit and the cannulae before changing a setting. Confirm the pattern against
            patient oxygenation and the drainage-limb value, then reassess cannula position and
            configuration and look for the efficient flow point rather than the largest displayed
            number.
          </p>
        </FittingResponse>

        <ThreeDomainResponse
          device="Speed left where it is while the pattern is confirmed. Displayed flow is read as what the pump moved, not as the support delivered."
          circuitOrGas="Cannula position and configuration reviewed with the imaging the unit uses; the drainage and return sites read against each other; the efficient flow point sought rather than the highest one."
          patient="Arterial oxygenation and the blood gas used as the endpoint, because the display cannot tell you whether support improved."
        />

        <HarmfulReflex action="Asking the circuit for more flow because the drainage limb looks diluted.">
          <p>
            Pulling harder on a circuit that is already re-draining its own return recruits more of
            that return than it recruits systemic venous blood. The displayed number keeps climbing,
            which is precisely why the reflex feels rewarded, while the support the patient receives
            falls. This simulation records escalating speed above the speed the case opened at as a
            safety event under its own mechanism name — kept separate from the drainage-collapse
            guard, because naming the wrong mechanism in the debrief would teach the wrong lesson.
          </p>
        </HarmfulReflex>

        {/*
          These guides are inside the gate rather than below it. Two of them are named for the
          mechanism, and a third carries it in its interpretation, so a learner scrolling the panel
          before choosing would meet the answer in a heading.
        */}
        <section className={styles.section} aria-labelledby="recirculation-guides-heading">
          <h3 id="recirculation-guides-heading" className={styles.heading}>
            The quantities this drill turns on
          </h3>
          <TextEquivalent>
            The re-drained share, the adjusted flow it produces, the drainage-limb saturation, and
            the modeled systemic venous estimate it is compared against — each with its authored
            interpretation and its provenance.
          </TextEquivalent>
          <div className="mt-3 grid gap-3">
            <GuidedValue
              guide={ecmoDerivedValueGuides.recirculationFraction}
              value={share}
              headingLevel={4}
            />
            <GuidedValue
              guide={ecmoDerivedValueGuides.recirculationAdjustedCircuitFlow}
              value={effectiveFlow}
              headingLevel={4}
            />
            <GuidedValue
              guide={ecmoDerivedValueGuides.venousLineSaturation}
              value={readouts.venousLineSaturation.displayed}
              headingLevel={4}
            />
            <GuidedValue
              guide={ecmoDerivedValueGuides.systemicVenousSaturationEstimate}
              value={state.patient.systemicVenousSaturationEstimate}
              headingLevel={4}
            />
          </div>
        </section>
      </AfterCommitment>
    </DrillPanelFrame>
  )
}
