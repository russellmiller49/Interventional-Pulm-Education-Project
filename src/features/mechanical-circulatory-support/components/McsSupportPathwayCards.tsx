'use client'

import {
  HeldDisagreement,
  MeasurementClarification,
} from '@/features/critical-care/components/teaching/EvidenceRenderers'
import { criticalCareMeasurementClarificationById } from '@/features/critical-care/content/measurementClarifications'
import { criticalCareSourceConflictById } from '@/features/critical-care/content/sourceConflicts'

import {
  mcsRequiredDistinctions,
  mcsSupportPathwayCards,
  type McsSupportPathwayCard,
} from '../content/supportPathways'
import styles from './mechanical-circulatory-support.module.css'

/**
 * Every support pathway, in the same fields, in the same order.
 *
 * The rendering is deliberately repetitive: the comparison only works if the learner can run a
 * finger down the same row across four cards. Nothing is dropped for a pathway where the answer is
 * boring, because "no blood enters this device" and "this reports no device flow" are the two most
 * useful rows on the counterpulsation card.
 *
 * The two evidence records are wired to their own renderers and not interchanged. The Impella CP
 * manufacturer figures are a *measurement clarification* — three numbers naming three measurands,
 * which do not contradict each other. The textbook pair is a *held disagreement* — one source
 * contradicting itself. Rendering either with the other's component inverts the authored position.
 */

const displayedFlowValueTypeLabels = {
  measured: 'measured on the circuit',
  estimated: 'estimated by the device',
  'no-device-flow-reported': 'no device flow reported',
} as const

const supportRoleLabels = {
  temporary: 'Temporary support',
  durable: 'Durable support',
} as const

function PathwayCard({ card }: { card: McsSupportPathwayCard }) {
  const clarifications = card.measurementClarificationIds
    .map((id) => criticalCareMeasurementClarificationById.get(id))
    .filter((entry) => entry !== undefined)
  const conflicts = card.sourceConflictIds
    .map((id) => criticalCareSourceConflictById.get(id))
    .filter((entry) => entry !== undefined)

  return (
    <article
      className={styles.pathwayCard}
      data-pathway-id={card.id}
      data-mechanism-class={card.mechanismClass}
      data-support-role={card.supportRole}
      data-availability={card.availability}
      aria-labelledby={`${card.id}-heading`}
    >
      <header>
        <span className={styles.pathwayCardRole} data-support-role={card.supportRole}>
          {supportRoleLabels[card.supportRole]}
        </span>
        <h3 id={`${card.id}-heading`}>{card.displayName}</h3>
        {card.availability === 'comparison-only' && card.comparisonNote ? (
          <p className={styles.pathwayCardComparison}>
            <small>Comparison pathway</small>
            {card.comparisonNote}
          </p>
        ) : null}
      </header>

      <dl className={styles.pathwayCardFields}>
        <div data-field="bloodEntersFrom">
          <dt>Blood enters from</dt>
          <dd>{card.bloodEntersFrom}</dd>
        </div>
        <div data-field="bloodReturnsTo">
          <dt>Blood returns to</dt>
          <dd>{card.bloodReturnsTo}</dd>
        </div>
        <div data-field="mechanism">
          <dt>Mechanism</dt>
          <dd>{card.mechanism}</dd>
        </div>
        <div data-field="flowPattern">
          <dt>Flow pattern</dt>
          <dd>{card.flowPattern}</dd>
        </div>
        <div data-field="chamberPrimarilyUnloaded">
          <dt>Chamber primarily unloaded</dt>
          <dd>{card.chamberPrimarilyUnloaded}</dd>
        </div>
        <div data-field="chamberOrBedPotentiallyLoaded">
          <dt>Chamber or vascular bed potentially loaded</dt>
          <dd>{card.chamberOrBedPotentiallyLoaded}</dd>
        </div>
        <div data-field="preloadRequirements">
          <dt>Preload requirements</dt>
          <dd>{card.preloadRequirements}</dd>
        </div>
        <div data-field="constraints">
          <dt>Afterload, position, rhythm, and obstruction</dt>
          <dd>
            <ul className={styles.pathwayCardConstraints}>
              <li data-constraint="afterload">
                <small>Afterload</small>
                {card.constraints.afterload}
              </li>
              <li data-constraint="position">
                <small>Position</small>
                {card.constraints.position}
              </li>
              <li data-constraint="rhythm">
                <small>Rhythm</small>
                {card.constraints.rhythm}
              </li>
              <li data-constraint="obstruction">
                <small>Obstruction</small>
                {card.constraints.obstruction}
              </li>
            </ul>
          </dd>
        </div>
        <div data-field="gasExchange">
          <dt>Gas exchange</dt>
          <dd>
            <span
              className={styles.pathwayCardFlag}
              data-gas-exchange={card.gasExchange.provides ? 'yes' : 'no'}
            >
              {card.gasExchange.provides ? 'Yes' : 'No'}
            </span>
            {card.gasExchange.statement}
          </dd>
        </div>
        <div data-field="displayedFlow">
          <dt>What the displayed flow means</dt>
          <dd>
            <span className={styles.valueTypeChip} data-value-type={card.displayedFlow.valueType}>
              {displayedFlowValueTypeLabels[card.displayedFlow.valueType]}
            </span>
            <p>{card.displayedFlow.statement}</p>
            <p className={styles.pathwayCardAdditivity} data-additivity>
              <small>Adding it to another stream</small>
              {card.displayedFlow.additivity}
            </p>
          </dd>
        </div>
        <div data-field="lowFlowDifferential">
          <dt>If the flow is low: patient, position, or device</dt>
          <dd>
            <ul className={styles.pathwayCardConstraints}>
              <li data-differential="patient">
                <small>Patient</small>
                {card.lowFlowDifferential.patient}
              </li>
              <li data-differential="position">
                <small>Position</small>
                {card.lowFlowDifferential.position}
              </li>
              <li data-differential="device">
                <small>Device</small>
                {card.lowFlowDifferential.device}
              </li>
            </ul>
          </dd>
        </div>
        <div data-field="firstUnsafeReflex">
          <dt>First unsafe reflex</dt>
          <dd>{card.firstUnsafeReflex}</dd>
        </div>
        <div data-field="supportRole">
          <dt>Temporary or durable</dt>
          <dd>{supportRoleLabels[card.supportRole]}</dd>
        </div>
        <div data-field="bridgeExitBoundary">
          <dt>Bridge and exit-strategy boundary</dt>
          <dd>{card.bridgeExitBoundary}</dd>
        </div>
      </dl>

      <section
        className={styles.pathwayCardProduct}
        data-product-references
        aria-label="Product reference flows"
      >
        <h4>Product reference flows</h4>
        {card.productReferences.length > 0 ? (
          <ul>
            {card.productReferences.map((reference) => (
              <li key={reference.id} data-product-reference={reference.id}>
                <strong>{reference.valueText}</strong>
                <span data-measurand>{reference.measurand}</span>
                <small>{reference.productName}</small>
                <small>{reference.condition}</small>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.pathwayCardNotATarget} data-not-a-target>
          {card.productReferenceBoundary}
        </p>
      </section>

      {clarifications.length > 0 || conflicts.length > 0 ? (
        <div className={styles.pathwayCardEvidence}>
          {clarifications.map((clarification) => (
            <MeasurementClarification
              key={clarification.id}
              clarification={clarification}
              headingLevel={4}
            />
          ))}
          {conflicts.map((conflict) => (
            <HeldDisagreement key={conflict.id} conflict={conflict} headingLevel={4} />
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function McsRequiredDistinctions() {
  return (
    <section
      className={styles.requiredDistinctions}
      aria-labelledby="mcs-required-distinctions-heading"
      data-mcs-required-distinctions
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>HOLD THESE APART</span>
        <h3 id="mcs-required-distinctions-heading">
          Claims that have to survive contact with a product track
        </h3>
      </div>
      <ol>
        {mcsRequiredDistinctions.map((distinction) => (
          <li key={distinction.id} data-distinction-id={distinction.id}>
            <p className={styles.distinctionClaim}>{distinction.claim}</p>
            <p className={styles.distinctionConfusion}>
              <small>Confused with</small>
              {distinction.confusedWith}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function McsSupportPathwayCards({
  cards = mcsSupportPathwayCards,
}: {
  cards?: readonly McsSupportPathwayCard[]
}) {
  return (
    <section
      className={styles.pathwayCards}
      aria-labelledby="mcs-pathway-cards-heading"
      data-mcs-pathway-cards
    >
      <div className={styles.commonModelHeading}>
        <span className={styles.kicker}>ONE CARD SHAPE, EVERY PATHWAY</span>
        <h2 id="mcs-pathway-cards-heading">Source, destination, and what the number means</h2>
        <p>
          The same fields in the same order for every pathway, so the rows can be read across rather
          than down. Product figures appear last, behind the measurand each one names.
        </p>
      </div>
      <div className={styles.pathwayCardGrid}>
        {cards.map((card) => (
          <PathwayCard key={card.id} card={card} />
        ))}
      </div>
      <McsRequiredDistinctions />
    </section>
  )
}
