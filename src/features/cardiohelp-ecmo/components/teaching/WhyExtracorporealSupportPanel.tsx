import type { ReactNode } from 'react'

import {
  OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN,
  OXYGEN_DELIVERY_ARITHMETIC_SOURCE_IDS,
} from '../../content/oxygenDeliveryArithmetic'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import { ecmoFoundationLessonRuntime } from '../../content/foundationLessonRuntime'
import type { EcmoSimulationState } from '../../engine/types'
import { useStageTeachingScope } from '../stage/StageTeachingScope'
import type { StagePhase } from '../stage/stageModel'
import { OxygenDeliveryExplorer } from './OxygenDeliveryExplorer'
import { GuidedValue, ModelBoundary, TextEquivalent, styles, trackDescription } from './shared'

/**
 * A block of this panel that knows which steps it belongs to.
 *
 * An owner review in September 2026 found four consecutive steps of this section showing identical
 * content: "we have had four steps but nothing has changed... it basically is just saying to read the
 * same thing four times." Every step rendered the whole panel, so the step list advanced while the
 * teaching pane stood still.
 *
 * Each block now names the steps it is the focus of. Elsewhere it folds to its heading rather than
 * disappearing, so nothing the learner has already read becomes unreachable. Outside a stage — the
 * render harness, a panel test, the offline preview — there is no scope and every block renders
 * open, exactly as before.
 */
function PhaseBlock({
  focusAt,
  heading,
  children,
}: {
  readonly focusAt: readonly StagePhase[]
  readonly heading: string
  readonly children: ReactNode
}) {
  const scope = useStageTeachingScope()
  if (!scope || focusAt.includes(scope.phase)) return <>{children}</>
  return (
    <details className={styles.section} data-phase-block data-phase-collapsed>
      <summary className={styles.heading}>{heading}</summary>
      {children}
    </details>
  )
}

/**
 * The components of oxygen delivery, kept apart.
 *
 * The panel deliberately does not compute a delivery figure or a target. Its whole claim is that
 * delivery is a product of separable terms, and that a reassuring value in one of them settles
 * nothing about the others — so producing a single summary number would undo the lesson.
 */

function ComponentBar({
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
    <div className="grid gap-1" data-delivery-component={label}>
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
  const oxygenContent =
    OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN * circuit.hemoglobin * (arterialSaturation / 100)
  const consumption = state.modelInputs.oxygenConsumptionMlMin

  return (
    <div className={styles.panel} data-teaching-panel="why-extracorporeal-support">
      <PhaseBlock
        focusAt={['recognize', 'predict', 'transfer']}
        heading="Oxygen delivery, component by component"
      >
        <section className={styles.section} aria-labelledby="why-delivery-heading">
          <h3 id="why-delivery-heading" className={styles.heading}>
            Oxygen delivery, component by component
          </h3>

          <div className="mt-3 grid gap-4">
            <ComponentBar
              label="Oxygen content"
              detail={`Hemoglobin ${circuit.hemoglobin.toFixed(1)} g/dL carrying a saturation of ${arterialSaturation.toFixed(0)}. Content is dominated by how much carrier there is, not only by how loaded it is.`}
              fraction={oxygenContent / 22}
              value={`${oxygenContent.toFixed(1)} mL per dL`}
            />
            <ComponentBar
              label="Blood flow"
              detail={
                state.supportMode === 'va'
                  ? `Native cardiac output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min, with the circuit adding ${circuit.bloodFlow.toFixed(2)} L/min on the arterial side. These are kept separate here; this model does not define a combined systemic figure.`
                  : `Native cardiac output ${patient.nativeCardiacOutputLpm.toFixed(1)} L/min. The circuit moves ${circuit.bloodFlow.toFixed(2)} L/min but returns it to the venous side, so it changes the content of blood reaching the right heart rather than adding systemic flow.`
              }
              fraction={patient.nativeCardiacOutputLpm / 8}
              value={`${patient.nativeCardiacOutputLpm.toFixed(1)} L/min native`}
            />
            <ComponentBar
              label="Oxygen consumption"
              detail="What the tissues are asking for. It sits on the other side of the balance and can move independently of everything above it."
              fraction={consumption / 400}
              value={`${consumption} mL/min`}
            />
          </div>

          <TextEquivalent>
            Under {trackDescription(state)}. Content is {oxygenContent.toFixed(1)} mL of oxygen per
            decilitre, from a hemoglobin of {circuit.hemoglobin.toFixed(1)} g/dL at a saturation of{' '}
            {arterialSaturation.toFixed(0)}. Native cardiac output is{' '}
            {patient.nativeCardiacOutputLpm.toFixed(1)} L/min and circuit flow is{' '}
            {circuit.bloodFlow.toFixed(2)} L/min. The model is given a consumption of {consumption}{' '}
            mL per minute. No single one of these three components establishes whether delivery is
            adequate.
          </TextEquivalent>

          <ModelBoundary>
            The bars show each component on its own arbitrary scale so the three can be seen side by
            side. They are not to a common unit, and no delivery figure or target is computed from
            them.
          </ModelBoundary>
        </section>
      </PhaseBlock>

      {/*
        The interactive half, foregrounded on the two steps that are about manipulating the
        components and reading what happens. It is the answer to the other half of the same owner
        review: the Act step asked the learner to attribute a change to a component while offering
        no way to try one.
      */}
      <PhaseBlock focusAt={['act', 'observe']} heading="Move one component and watch the rest">
        <OxygenDeliveryExplorer state={state} sourceIds={OXYGEN_DELIVERY_ARITHMETIC_SOURCE_IDS} />
      </PhaseBlock>

      <PhaseBlock
        focusAt={['observe', 'explain']}
        heading="What the circuit is being asked to substitute for"
      >
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
            Extracorporeal support substitutes for a failing step in oxygen delivery or carbon
            dioxide clearance. It holds a physiologic variable while the treatable problem is
            treated; it does not treat the lung injury, the cardiac lesion, or the sepsis itself.
          </TextEquivalent>
        </section>
      </PhaseBlock>

      <GuidedValue
        guide={ecmoDerivedValueGuides.oxygenConsumption}
        value={consumption}
        headingLevel={3}
      />
    </div>
  )
}
