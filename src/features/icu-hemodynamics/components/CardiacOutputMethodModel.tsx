'use client'

import { useId, useState } from 'react'

import {
  cardiacOutputInputStatusLabels,
  cardiacOutputMethods,
  cardiacOutputMethodTextEquivalent,
  requireCardiacOutputMethod,
  type CardiacOutputMethod,
  type CardiacOutputMethodId,
} from '../content/cardiacOutputMethods'
import {
  CARDIAC_OUTPUT_VERIFICATION_NOTE,
  cardiacOutputOpenMethodQuestions,
} from '../content/cardiacOutputSourceBoundaries'
import { hemodynamicsSourceById } from '../content/sources'
import styles from './icu-hemodynamics.module.css'

/**
 * The one place a learner reads what each cardiac-output method is.
 *
 * Every sentence on this panel is a field of a `CardiacOutputMethod` record. That is the whole
 * design: the panel used to carry its own prose, the engine carried its own behavior, and the two
 * could drift — which is how "direct Fick" ended up describing a calculation with an assumed oxygen
 * uptake. Rendering the records means a claim can only be changed in the place the validator and
 * the numeric audit also read.
 */

export const CARDIAC_OUTPUT_PROVENANCE_CHOICES = [
  {
    id: 'only-measured-is-direct',
    label:
      'Only the result whose oxygen uptake was measured is direct Fick. The other is an estimate, and it moves in direct proportion to the substituted figure.',
    isDefensible: true,
    why: 'Direct Fick is named for its numerator. The specimens can be drawn perfectly in both episodes and only one of them measured what the equation needs.',
  },
  {
    id: 'both-are-direct',
    label:
      'Both are direct Fick, because both used an arterial specimen and a pulmonary-artery specimen.',
    isDefensible: false,
    why: 'Good specimens settle the denominator. They say nothing about whether the oxygen uptake was measured, and that is what the word direct refers to.',
  },
  {
    id: 'substituted-is-direct',
    label:
      'The one using a substituted figure is direct Fick, because it needs no expired-gas collection.',
    isDefensible: false,
    why: 'This inverts the distinction. Substituting a value is what makes a result an estimate rather than a measurement.',
  },
  {
    id: 'needs-dissolved-term',
    label: 'Neither is direct Fick unless the dissolved-oxygen term is included in both contents.',
    isDefensible: false,
    why: 'The dissolved term is a small addition to each content and must be applied to both or neither. It has nothing to do with how the oxygen uptake was obtained.',
  },
] as const

function ProvenanceChip({
  status,
}: {
  readonly status: keyof typeof cardiacOutputInputStatusLabels
}) {
  return (
    <span className={styles.provenanceChip} data-status={status}>
      {cardiacOutputInputStatusLabels[status].label}
    </span>
  )
}

function MethodDetail({ method }: { readonly method: CardiacOutputMethod }) {
  return (
    <div className={styles.measurementTeachingCard}>
      <h3>{method.name}</h3>
      <dl className={styles.curveFeatureList}>
        <div>
          <dt>What it estimates</dt>
          <dd>{method.measurand}</dd>
        </div>
        <div>
          <dt>What is directly observed</dt>
          <dd>{method.directlyObserved}</dd>
        </div>
        <div>
          <dt>Raw data behind the number</dt>
          <dd>{method.rawDataRepresentation}</dd>
        </div>
        {method.vo2Provenance === null ? null : (
          <div>
            <dt>Oxygen uptake</dt>
            <dd>
              {method.vo2Provenance === 'measured'
                ? 'Measured on this patient over the interval the specimens describe.'
                : 'Not measured on this patient. A substituted figure stands in for it.'}
            </dd>
          </div>
        )}
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>Where every value came from</span>
      </h4>
      <dl className={styles.methodProvenanceTable}>
        {method.inputs.map((input) => (
          <div key={input.id}>
            <dt>
              {input.label}
              {input.unit ? ` (${input.unit})` : ''}
            </dt>
            <dd>
              <ProvenanceChip status={input.status} />
            </dd>
            <dd>
              {input.whatItIs} {input.howItGoesWrong}
            </dd>
          </div>
        ))}
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>How the calculation runs</span>
      </h4>
      <ol className={styles.measurementTeachingSteps}>
        {method.calculationAccount.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <h4 className={styles.thermoTrialQuality}>
        <span>Acquisition sequence</span>
      </h4>
      <ol className={styles.measurementTeachingSteps}>
        {method.acquisitionSequence.map((step) => (
          <li key={step.order}>
            <strong>{step.whatYouDo}</strong> {step.whatItEstablishes}
          </li>
        ))}
      </ol>

      <h4 className={styles.thermoTrialQuality}>
        <span>Quality checks before the number is used</span>
      </h4>
      <dl className={styles.curveFeatureList}>
        {method.qualityChecks.map((check) => (
          <div key={check.id}>
            <dt>{check.label}</dt>
            <dd>
              {check.whatToLookFor} {check.whenItIsNotMet}
            </dd>
          </div>
        ))}
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>What repeating it does and does not show</span>
      </h4>
      <dl className={styles.curveFeatureList}>
        {method.repeatabilityChecks.map((check) => (
          <div key={check.id}>
            <dt>{check.label}</dt>
            <dd>
              {check.whatToLookFor} {check.whenItIsNotMet}
            </dd>
          </div>
        ))}
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>How it breaks down</span>
      </h4>
      <dl className={styles.curveFeatureList}>
        {method.failureModes.map((mode) => (
          <div key={mode.id}>
            <dt>{mode.label}</dt>
            <dd>
              {mode.mechanism} {mode.effectOnResult}{' '}
              {mode.visibleInAcquisition
                ? 'Visible from the acquisition itself.'
                : 'Not visible from the acquisition alone.'}
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.scenarioSideBySide}>
        <div>
          <h4 className={styles.thermoTrialQuality}>
            <span>Repeat the acquisition when</span>
          </h4>
          <ul className={styles.measurementTeachingAudit}>
            {method.repeatWhen.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className={styles.thermoTrialQuality}>
            <span>Withhold the result when</span>
          </h4>
          <ul className={styles.measurementTeachingAudit}>
            {method.withholdWhen.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className={styles.measurementTeachingCallout}>
        <strong>Role of the other method.</strong> {method.alternateMethodRole}
      </p>
      <p className={styles.measurementTeachingCallout}>
        <strong>Interpretation boundary.</strong> {method.interpretationBoundary}
      </p>

      <h4 className={styles.thermoTrialQuality}>
        <span>Sources and their limits</span>
      </h4>
      <ul className={styles.measurementTeachingAudit}>
        {method.evidenceIds.map((evidenceId) => {
          const source = hemodynamicsSourceById.get(evidenceId)
          return <li key={evidenceId}>{source ? source.citation : evidenceId}</li>
        })}
        {method.sourceLimitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The learner's commitment that a measured oxygen uptake and a substituted one are two methods.
 *
 * Committing reveals the reasoning for whichever position was taken and advances nothing; continuing
 * stays a separate deliberate action elsewhere on the station.
 */
function ProvenanceCommitment({
  resolved,
  onResolved,
}: {
  readonly resolved: boolean
  readonly onResolved: () => void
}) {
  const legendId = useId()
  const groupName = useId()
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [committed, setCommitted] = useState(false)
  const choice = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((candidate) => candidate.id === choiceId)

  return (
    <fieldset className={styles.methodCommitment} aria-labelledby={legendId}>
      <legend id={legendId}>
        Two Fick results are on record for the same patient in the same hour. One had oxygen uptake
        measured by expired-gas analysis over the sampling interval; the other used a substituted
        figure. Which statement describes them?
      </legend>
      {CARDIAC_OUTPUT_PROVENANCE_CHOICES.map((candidate) => (
        <label key={candidate.id}>
          <input
            type="radio"
            name={groupName}
            checked={choiceId === candidate.id}
            disabled={committed}
            onChange={() => setChoiceId(candidate.id)}
          />
          {candidate.label}
        </label>
      ))}
      <button
        type="button"
        disabled={choiceId === null || committed}
        onClick={() => {
          setCommitted(true)
          if (choice?.isDefensible) onResolved()
        }}
      >
        Commit this reading
      </button>
      {committed && choice ? (
        <p
          className={styles.methodVerdict}
          data-verdict={choice.isDefensible ? 'defensible' : 'not-defensible'}
          role="status"
        >
          <strong>
            {choice.isDefensible ? 'Best-supported reading. ' : 'Not the best-supported reading. '}
          </strong>
          {choice.why}
          {choice.isDefensible ? '' : ` ${CARDIAC_OUTPUT_PROVENANCE_CHOICES[0].why}`}
        </p>
      ) : null}
      {resolved && !committed ? (
        <p className={styles.methodVerdict}>
          You have already separated the two Fick methods on this station.
        </p>
      ) : null}
    </fieldset>
  )
}

export function CardiacOutputMethodModel({
  provenanceResolved = false,
  onProvenanceResolved,
}: {
  readonly provenanceResolved?: boolean
  readonly onProvenanceResolved?: () => void
}) {
  const headingId = useId()
  const [selectedId, setSelectedId] = useState<CardiacOutputMethodId>('thermodilution')
  const selected = requireCardiacOutputMethod(selectedId)

  return (
    <section className={styles.measurementTeachingPanel} aria-labelledby={headingId}>
      <header>
        <span>Learn before measuring</span>
        <h2 id={headingId}>Cardiac output: measure flow, then judge the method</h2>
        <p>
          Cardiac output is blood flow per minute. Neither method here measures flow directly: one
          derives it from a temperature-time curve and the other from an oxygen balance. Before any
          number is used, four questions have answers — what is this method estimating, which values
          were measured and which were assumed, was the acquisition usable and repeatable, and what
          should be checked when the two methods disagree.
        </p>
      </header>

      <div className={styles.methodTabs} role="tablist" aria-label="Cardiac-output methods">
        {cardiacOutputMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            role="tab"
            aria-selected={method.id === selectedId}
            onClick={() => setSelectedId(method.id)}
          >
            {method.name}
          </button>
        ))}
      </div>

      <p className="sr-only">{cardiacOutputMethodTextEquivalent(selected)}</p>
      <MethodDetail method={selected} />

      <ProvenanceCommitment
        resolved={provenanceResolved}
        onResolved={() => onProvenanceResolved?.()}
      />

      <div className={styles.measurementTeachingCard}>
        <h3>Questions this module does not answer</h3>
        {cardiacOutputOpenMethodQuestions.map((question) => (
          <p key={question.id} className={styles.openQuestionCard}>
            <strong>{question.question}</strong> {question.whyItIsOpen}{' '}
            {question.whatThisModuleDoes}
          </p>
        ))}
        <p className={styles.measurementTeachingSource}>
          <span>Source boundary</span>
          {CARDIAC_OUTPUT_VERIFICATION_NOTE}
        </p>
      </div>
    </section>
  )
}
