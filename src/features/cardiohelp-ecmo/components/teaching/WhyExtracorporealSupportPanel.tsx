import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { GuidedValue, ModelBoundary, TextEquivalent, styles, trackDescription } from './shared'

/**
 * The oxygen-delivery ledger, with its terms kept apart.
 *
 * The panel deliberately does not compute a delivery figure or a target. Its whole claim is that
 * delivery is a product of separable terms, and that a reassuring value in one of them settles
 * nothing about the others — so producing a single summary number would undo the lesson.
 */

const HUFNER = 1.34

function LedgerBar({
  label,
  detail,
  fraction,
  value,
}: {
  readonly label: string
  readonly detail: string
  readonly fraction: number
  readonly value: string
}) {
  const width = Math.max(4, Math.min(100, fraction * 100))
  return (
    <div className="grid gap-1" data-ledger-term={label}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-foreground/70"
          style={{ width: `${width}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  )
}

export function WhyExtracorporealSupportPanel({ state }: { readonly state: EcmoSimulationState }) {
  const { circuit, patient, gas } = state
  const arterialSaturation = state.supportMode === 'va' ? patient.femoralArterialSpo2 : patient.spo2
  // Content per decilitre. Shown as a term, not as a delivery figure.
  const oxygenContent = HUFNER * circuit.hemoglobin * (arterialSaturation / 100)
  const consumption = state.modelInputs.oxygenConsumptionMlMin

  return (
    <div className={styles.panel} data-teaching-panel="why-extracorporeal-support">
      <section className={styles.section} aria-labelledby="why-ledger-heading">
        <h3 id="why-ledger-heading" className={styles.heading}>
          The delivery ledger, term by term
        </h3>

        <div className="mt-3 grid gap-4">
          <LedgerBar
            label="Content"
            detail={`Hemoglobin ${circuit.hemoglobin.toFixed(1)} g/dL carrying a saturation of ${arterialSaturation.toFixed(0)}. Content is dominated by how much carrier there is, not only by how loaded it is.`}
            fraction={oxygenContent / 22}
            value={`${oxygenContent.toFixed(1)} mL per dL`}
          />
          <LedgerBar
            label="Flow"
            detail={
              state.supportMode === 'va'
                ? `Native cardiac output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min, with the circuit adding ${circuit.bloodFlow.toFixed(2)} L/min on the arterial side. These are kept separate here; this model does not define a combined systemic figure.`
                : `Native cardiac output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min. The circuit moves ${circuit.bloodFlow.toFixed(2)} L/min but returns it to the venous side, so it changes the content of blood reaching the right heart rather than adding systemic flow.`
            }
            fraction={patient.nativeCardiacOutputLpm / 8}
            value={`${patient.nativeCardiacOutputLpm.toFixed(1)} L/min native`}
          />
          <LedgerBar
            label="Consumption"
            detail="Sits on the other side of the ledger and can move independently of everything above it."
            fraction={consumption / 400}
            value={`${consumption} mL/min`}
          />
        </div>

        <TextEquivalent>
          Under {trackDescription(state)}. Content is {oxygenContent.toFixed(1)} mL of oxygen per
          decilitre, from a hemoglobin of {circuit.hemoglobin.toFixed(1)} g/dL at a saturation of{' '}
          {arterialSaturation.toFixed(0)}. Native cardiac output is{' '}
          {patient.nativeCardiacOutputLpm.toFixed(1)} L/min and circuit flow is{' '}
          {circuit.bloodFlow.toFixed(2)} L/min. The model is given a consumption of {consumption} mL
          per minute. No single one of these three terms establishes whether delivery is adequate.
        </TextEquivalent>

        <ModelBoundary>
          The bars show each term on its own arbitrary scale so the three can be seen side by side.
          They are not to a common unit, and no delivery figure or target is computed from them.
        </ModelBoundary>
      </section>

      <section className={styles.section} aria-labelledby="why-gas-heading">
        <h3 id="why-gas-heading" className={styles.heading}>
          What the circuit is being asked to substitute for
        </h3>
        <p className="mt-2 text-sm leading-6">
          The sweep gas is running at {gas.sweepLpm.toFixed(1)} L/min with an oxygen fraction of{' '}
          {gas.fio2.toFixed(2)}
          {gas.sourceConnected ? '' : ', and the gas source is currently interrupted'}. Carbon
          dioxide clearance and oxygen transfer are governed by different parts of the circuit,
          which is why the two controls are not interchangeable.
        </p>
        <TextEquivalent>
          Extracorporeal support substitutes for a failing step in oxygen delivery or carbon dioxide
          clearance. It holds a physiologic variable while the treatable problem is treated; it does
          not treat the lung injury, the cardiac lesion, or the sepsis itself.
        </TextEquivalent>
      </section>

      <GuidedValue
        guide={ecmoDerivedValueGuides.oxygenConsumption}
        value={consumption}
        headingLevel={3}
      />
    </div>
  )
}
