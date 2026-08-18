import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { ecmoReferenceProfileForMode } from '../../content/referenceProfiles'
import type { EcmoSimulationState } from '../../engine/types'
import { EcmoCircuitMinimap } from './EcmoCircuitMinimap'
import { EcmoLocalizationCard } from './EcmoLocalizationCard'
import {
  ChannelValue,
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  direction,
  directionWord,
  styles,
} from './shared'

/**
 * Speed is selected; flow is what the circuit returns under its current loading.
 *
 * Comparisons here are against *this modeled circuit's own reference state*, never against
 * "normal ECMO values" — the reference profile is an authored teaching anchor, and calling it
 * normal would turn a model constant into a clinical claim.
 *
 * This is where the module states its diagnostic grammar, and the three "mechanism previews" it
 * used to keep in a private array are now four rows of the shared localization registry, rendered
 * by reference. Two things changed and both were already true: the gas path is one of the four
 * recurring patterns and was only ever missing from the preview list, and the sentences a drill
 * later uses are now literally the sentences shown here rather than a paraphrase of them.
 *
 * The scaffold stops at pattern and location. What to inspect, the response that fits and the
 * reflex to avoid stay with the drills, because a learner meeting this table is looking at a
 * circuit with nothing wrong with it and has not been asked to diagnose anything yet.
 */

export function PumpPressureZonesPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, device } = state
  const profile = ecmoReferenceProfileForMode(state.supportMode)
  const referenceFlow = (profile.expected.bloodFlow.low + profile.expected.bloodFlow.high) / 2
  const referenceDeltaP = (profile.expected.deltaP.low + profile.expected.deltaP.high) / 2

  const flowShift = direction(circuit.bloodFlow - referenceFlow, 0.05)
  // A direction is an interpretation, so it needs a value the model stands behind. Comparing the
  // stopped circuit's intercept against the reference would print "about the same" underneath a
  // tile that already reads `--`.
  const deltaPReadout = circuit.readouts.deltaP
  const deltaPShift =
    deltaPReadout.displayed === null
      ? null
      : direction(deltaPReadout.displayed - referenceDeltaP, 2)

  return (
    <div className={styles.panel} data-teaching-panel="pump-and-pressure-zones">
      <section className={styles.section} aria-labelledby="pump-heading">
        <h3 id="pump-heading" className={styles.heading}>
          Setting, result, and the zones that report them
        </h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3" data-selected-setting>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Selected setting
            </p>
            <p className="text-2xl font-semibold">{device.rpmSetpoint} rpm</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Chosen by the operator. It does not by itself determine the flow.
            </p>
          </div>
          <div className="rounded-xl border p-3" data-resulting-flow>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resulting flow</p>
            <p className="text-2xl font-semibold">{circuit.bloodFlow.toFixed(2)} L/min</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {directionWord[flowShift]} than this circuit&rsquo;s reference state
              {flowShift === 'flat' ? '' : ` (${referenceFlow.toFixed(2)} L/min)`}.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4" data-pressure-zones>
          <ChannelValue label="pVen" readout={circuit.readouts.pVen} unit="mmHg" />
          <ChannelValue label="pInt" readout={circuit.readouts.pInt} unit="mmHg" />
          <ChannelValue label="pArt" readout={circuit.readouts.pArt} unit="mmHg" />
          <ChannelValue label="ΔP" readout={circuit.readouts.deltaP} unit="mmHg" />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {deltaPShift === null
            ? `The gradient is not being reported, so it cannot be compared with this circuit’s reference state. ${deltaPReadout.reason}`
            : `The gradient is ${directionWord[deltaPShift]} than this circuit’s reference state.`}{' '}
          Read the four together: one zone moving alone means something different from two moving
          together.
        </p>

        <TextEquivalent>
          The pump is set to {device.rpmSetpoint} rpm and the circuit is returning{' '}
          {circuit.bloodFlow.toFixed(2)} L/min, {directionWord[flowShift]} than this circuit&rsquo;s
          reference flow of {referenceFlow.toFixed(2)} L/min.{' '}
          {deltaPShift === null
            ? `The gradient across the membrane is not available, ${deltaPReadout.reason}`
            : `The gradient across the membrane is ${directionWord[deltaPShift]} than its reference value of ${referenceDeltaP.toFixed(0)} mmHg.`}{' '}
          Speed is a setting; flow is the result of that speed under the loading the circuit
          currently has.
        </TextEquivalent>

        <ModelBoundary>
          Comparisons here are to this modeled circuit&rsquo;s own authored reference state, not to
          a normal range for ECMO. The reference values are teaching anchors for this simulation.
        </ModelBoundary>
      </section>

      <EcmoCircuitMinimap
        supportMode={state.supportMode}
        presentation={deriveEcmoCircuitPresentation(state, {
          kind: 'foundation-scaffold',
          emphasis: 'pressure-zones',
        })}
      />

      <EcmoLocalizationCard mode="scaffold-table" supportMode={state.supportMode} />

      <GuidedValue
        guide={ecmoDerivedValueGuides.transmembraneDeltaP}
        value={circuit.readouts.deltaP.displayed}
        headingLevel={3}
      />
    </div>
  )
}
