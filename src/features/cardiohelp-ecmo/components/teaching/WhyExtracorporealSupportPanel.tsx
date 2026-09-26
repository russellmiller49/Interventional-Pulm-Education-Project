import type { ReactNode } from 'react'

import {
  OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN,
  OXYGEN_DELIVERY_ARITHMETIC_SOURCE_IDS,
} from '../../content/oxygenDeliveryArithmetic'
import { ecmoDerivedValueGuides } from '../../content/ecmoValueGuides'
import type { EcmoSimulationState } from '../../engine/types'
import { useStageTeachingScope } from '../stage/StageTeachingScope'
import type { StagePhase } from '../stage/stageModel'
import { OxygenDeliveryExplorer } from './OxygenDeliveryExplorer'
import {
  FoundationTeachingBlock,
  VaConfigurationLabel,
  GuidedValue,
  ModelBoundary,
  TextEquivalent,
  styles,
  trackDescription,
} from './shared'

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
  const scope = useStageTeachingScope()
  const arterialSaturation = state.supportMode === 'va' ? patient.femoralArterialSpo2 : patient.spo2
  // Content per decilitre. Shown as a term, not as a delivery figure.
  const oxygenContent =
    OXYGEN_CARRIED_PER_GRAM_HEMOGLOBIN * circuit.hemoglobin * (arterialSaturation / 100)
  const consumption = state.modelInputs.oxygenConsumptionMlMin

  if (scope?.foundationBlock)
    return (
      <div className={styles.panel} data-teaching-panel="why-extracorporeal-support">
        {state.supportMode === 'va' ? <VaConfigurationLabel /> : null}
        <FoundationTeachingBlock id="delivery" title="Review oxygen delivery">
          <section className={styles.section} aria-labelledby="why-delivery-heading">
            <h3 id="why-delivery-heading" className={styles.heading}>
              Oxygen delivery, component by component
            </h3>
            <p className="mt-3 text-sm leading-6">
              Tissues need oxygen delivered in flowing blood. Delivery depends on both how much
              blood reaches them and how much oxygen that blood carries.
            </p>
            <p
              className="my-4 rounded-xl border p-3 text-base font-semibold"
              data-delivery-relationship
            >
              Blood flow × oxygen content = oxygen delivery
            </p>
            <p className="text-sm leading-6">
              <strong>Oxygen saturation</strong> is the fraction of hemoglobin carrying oxygen.{' '}
              <strong>Oxygen content</strong>
              {
                ' also depends on how much hemoglobin is present. A high saturation alone does not establish adequate delivery.'
              }
            </p>
            <p className="mt-2 text-sm leading-6">
              <strong>Oxygen consumption</strong> is the amount the tissues use. It must be
              considered alongside delivery.
            </p>
            <p className="mt-2 text-sm leading-6">
              ECMO supports gas exchange, and in VA also circulation, while the underlying problem
              is addressed.
            </p>
          </section>
        </FoundationTeachingBlock>
        <FoundationTeachingBlock id="support-example" title="Review the worked example">
          <section className={styles.section} aria-labelledby="support-example-heading">
            <h3 id="support-example-heading" className={styles.heading}>
              Support while the cause is treated
            </h3>
            <p className="mt-3 text-sm leading-6">
              <strong>Worked example — authored for teaching.</strong> Oxygen demand rises while
              blood flow, hemoglobin, and saturation stay unchanged. Oxygen delivery has not
              increased, but the amount needed has. The unchanged saturation does not settle the
              balance.
            </p>
            <p className="mt-3 text-sm leading-6">
              {state.supportMode === 'vv'
                ? 'In the VV circuit beside you, oxygenated blood returns to the venous circulation. ECMO improves gas exchange; the native heart still provides systemic blood flow. VV does not directly support circulation.'
                : 'The circuit beside you models peripheral femoral VA ECMO, with retrograde arterial return. It provides gas exchange and circulatory support alongside native cardiac output. One arterial saturation does not describe every region.'}
            </p>
            <p className="mt-3 text-sm leading-6">
              Support does not treat the underlying lung injury, cardiac lesion, bleeding, or
              sepsis. The cause still needs assessment and treatment.
            </p>
            <p className="mt-2 text-sm leading-6">
              This is a conceptual example: oxygen demand remains fixed in the live simulation.
            </p>
          </section>
        </FoundationTeachingBlock>
        <details className={styles.section}>
          <summary className="cursor-pointer font-semibold">
            Explore the delivery arithmetic
          </summary>
          <OxygenDeliveryExplorer state={state} sourceIds={OXYGEN_DELIVERY_ARITHMETIC_SOURCE_IDS} />
        </details>
        <details className={styles.section}>
          <summary className="cursor-pointer font-semibold">
            Current components and model detail
          </summary>
          <ComponentBar
            label="Oxygen content · derived estimate"
            detail="Hemoglobin-bound oxygen only; not a measured device output."
            fraction={oxygenContent / 22}
            value={`${oxygenContent.toFixed(1)} mL/dL`}
          />
          <ComponentBar
            label="Native cardiac output · model value"
            detail="Kept separate from displayed circuit blood flow."
            fraction={patient.nativeCardiacOutputLpm / 8}
            value={`${patient.nativeCardiacOutputLpm.toFixed(1)} L/min`}
          />
          <GuidedValue
            guide={ecmoDerivedValueGuides.oxygenConsumption}
            value={consumption}
            headingLevel={3}
          />
        </details>
      </div>
    )

  return (
    <div className={styles.panel} data-teaching-panel="why-extracorporeal-support">
      <PhaseBlock
        /*
         * Not `transfer`. This block opens on the transfer step and the others fold, which a learner
         * reported in September 2026 as the wrong way round: "you are just answering a question in
         * the left-most panel and are done with the middle panel." An earlier verification pass had
         * flagged the same list for a second reason — the block's own caption is the keyed answer's
         * justification, sitting beside the question that asks for it. Both are the same fix.
         */
        focusAt={['recognize', 'predict']}
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
            dioxide clearance. It holds that component while the treatable problem is treated; it
            does not treat the lung injury, the cardiac lesion, or the sepsis itself.
          </TextEquivalent>
        </section>
      </PhaseBlock>

      {/*
        The one block in this panel that was not phase-scoped.

        It stayed fully expanded on all six steps — including the transfer step, whose question is
        about oxygen content, where the bottom of the pane was a card about oxygen consumption
        carrying six separate statements that the number is not real. Folded to its heading
        elsewhere, open where consumption is the subject; nothing already read becomes unreachable,
        which is the same contract every other block in this panel keeps.
      */}
      <PhaseBlock
        focusAt={['recognize', 'observe']}
        heading="Oxygen consumption, and what this number is"
      >
        <GuidedValue
          guide={ecmoDerivedValueGuides.oxygenConsumption}
          value={consumption}
          headingLevel={3}
        />
      </PhaseBlock>
    </div>
  )
}
