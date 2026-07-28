import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { ecmoReferenceProfileForMode } from '../../content/referenceProfiles'
import type { EcmoSimulationState } from '../../engine/types'
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
 */

const MECHANISM_PREVIEWS = [
  {
    id: 'preload',
    label: 'Drainage limitation',
    signature:
      'Drainage pressure becomes more negative; flow stops following speed and may become unstable.',
  },
  {
    id: 'return',
    label: 'Return-side resistance',
    signature:
      'Both post-pump pressures rise together; the gradient across the membrane changes little.',
  },
  {
    id: 'membrane',
    label: 'Membrane resistance',
    signature: 'The pre-membrane pressure separates from the return pressure; the gradient widens.',
  },
] as const

export function PumpPressureZonesPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, device } = state
  const profile = ecmoReferenceProfileForMode(state.supportMode)
  const referenceFlow = (profile.expected.bloodFlow.low + profile.expected.bloodFlow.high) / 2
  const referenceDeltaP = (profile.expected.deltaP.low + profile.expected.deltaP.high) / 2

  const flowShift = direction(circuit.bloodFlow - referenceFlow, 0.05)
  const deltaPShift = direction(circuit.deltaP - referenceDeltaP, 2)

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
          The gradient is {directionWord[deltaPShift]} than this circuit&rsquo;s reference state.
          Read the four together: one zone moving alone means something different from two moving
          together.
        </p>

        <TextEquivalent>
          The pump is set to {device.rpmSetpoint} rpm and the circuit is returning{' '}
          {circuit.bloodFlow.toFixed(2)} L/min, {directionWord[flowShift]} than this circuit&rsquo;s
          reference flow of {referenceFlow.toFixed(2)} L/min. The gradient across the membrane is{' '}
          {directionWord[deltaPShift]} than its reference value of {referenceDeltaP.toFixed(0)}{' '}
          mmHg. Speed is a setting; flow is the result of that speed under the loading the circuit
          currently has.
        </TextEquivalent>

        <ModelBoundary>
          Comparisons here are to this modeled circuit&rsquo;s own authored reference state, not to
          a normal range for ECMO. The reference values are teaching anchors for this simulation.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="mechanism-preview-heading">
        <h3 id="mechanism-preview-heading" className={styles.heading}>
          Mechanism previews — signatures you will work through later
        </h3>
        <dl className="mt-3 grid gap-3">
          {MECHANISM_PREVIEWS.map((preview) => (
            <div
              key={preview.id}
              className="rounded-xl border p-3"
              data-mechanism-preview={preview.id}
            >
              <dt className="text-sm font-semibold">{preview.label}</dt>
              <dd className="mt-1 text-xs leading-5 text-muted-foreground">{preview.signature}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          These are directional previews only. The circuit in front of you has no injected problem,
          and the drills that work each signature come later in the pathway.
        </p>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.transmembraneDeltaP}
        value={circuit.readouts.deltaP.displayed}
        headingLevel={3}
      />
    </div>
  )
}
