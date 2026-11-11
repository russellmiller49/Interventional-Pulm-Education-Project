'use client'

import { useId, useState, type ReactNode } from 'react'

import {
  cardiacOutputInputStatusLabels,
  cardiacOutputMethods,
  cardiacOutputMethodTextEquivalent,
  requireCardiacOutputMethod,
  type CardiacOutputMethod,
  type CardiacOutputMethodId,
} from '../content/cardiacOutputMethods'
import { cardiacOutputOpenMethodQuestions } from '../content/cardiacOutputSourceBoundaries'
import { hemodynamicsSourceClassLabel } from '../content/sourceReviewMetadata'
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

/** The parts of a method's account, in the order the card prints them. */
export type CardiacOutputMethodSectionId =
  | 'provenance'
  | 'calculation'
  | 'acquisition'
  | 'quality'
  | 'repeatability'
  | 'breakdown'
  | 'repeat'
  | 'withhold'
  | 'sources'

export const CARDIAC_OUTPUT_METHOD_SECTION_HEADINGS: Readonly<
  Record<CardiacOutputMethodSectionId, string>
> = {
  provenance: 'Where every value came from',
  calculation: 'How the calculation runs',
  acquisition: 'Acquisition sequence',
  quality: 'Quality checks before the number is used',
  repeatability: 'What repeating it does and does not show',
  breakdown: 'How it breaks down',
  repeat: 'Repeat the acquisition when',
  withhold: 'Withhold the result when',
  sources: 'Sources',
}

/**
 * One part of a method's account, without its heading.
 *
 * The card prints all nine under their headings. The lesson also reads some of them a page at a
 * time, with the thermodilution curve beside them (`FlowPrerequisite`); both draw from here, so a
 * page and the card cannot say different things.
 */
export function CardiacOutputMethodSection({
  method,
  section,
}: {
  readonly method: CardiacOutputMethod
  readonly section: CardiacOutputMethodSectionId
}) {
  const checks = (list: CardiacOutputMethod['qualityChecks']) => (
    <dl className={styles.curveFeatureList}>
      {list.map((check) => (
        <div key={check.id}>
          <dt>{check.label}</dt>
          <dd>
            {check.whatToLookFor} {check.whenItIsNotMet}
          </dd>
        </div>
      ))}
    </dl>
  )
  const lines = (list: readonly string[]) => (
    <ul className={styles.measurementTeachingAudit}>
      {list.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
  switch (section) {
    case 'provenance':
      return (
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
      )
    case 'calculation':
      return (
        <ol className={styles.measurementTeachingSteps}>
          {method.calculationAccount.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )
    case 'acquisition':
      return (
        <ol className={styles.measurementTeachingSteps}>
          {method.acquisitionSequence.map((step) => (
            <li key={step.order}>
              <strong>{step.whatYouDo}</strong> {step.whatItEstablishes}
            </li>
          ))}
        </ol>
      )
    case 'quality':
      return checks(method.qualityChecks)
    case 'repeatability':
      return checks(method.repeatabilityChecks)
    case 'breakdown':
      return (
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
      )
    case 'repeat':
      return lines(method.repeatWhen)
    case 'withhold':
      return lines(method.withholdWhen)
    case 'sources':
      return (
        <ul className={styles.measurementTeachingAudit}>
          {method.evidenceIds.map((evidenceId) => {
            const source = hemodynamicsSourceById.get(evidenceId)
            return (
              <li key={evidenceId}>
                {source
                  ? `${hemodynamicsSourceClassLabel(source)}: ${source.citation}`
                  : evidenceId}
              </li>
            )
          })}
          {method.sourceLimitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      )
  }
}

/** Where the methods are uncertain: common to all three, printed after the method's card. */
export function CardiacOutputOpenQuestions() {
  return (
    <>
      {cardiacOutputOpenMethodQuestions.map((question) => (
        <p key={question.id} className={styles.openQuestionCard}>
          <strong>{question.question}</strong> {question.whyItIsOpen} {question.whatThisModuleDoes}
        </p>
      ))}
    </>
  )
}

/**
 * The light card a part of the method sits on when it is read as a page of its own. The lists were
 * drawn for the light card the Explain card puts them on; on the page's dark card they are unreadable.
 */
export function CardiacOutputMethodPageSurface({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.methodPageSurface} data-method-surface>
      {children}
    </div>
  )
}

/** Where a part of the account is read instead of in the card ("from task 1"). */
export type CardiacOutputMethodElsewhere = Partial<Record<CardiacOutputMethodSectionId, string>>

function MethodDetail({
  method,
  elsewhere = {},
}: {
  readonly method: CardiacOutputMethod
  /**
   * Parts the lesson reads on a page of their own. Each is a closed heading here that says where,
   * and opens in place: nothing is removed from the card.
   */
  readonly elsewhere?: CardiacOutputMethodElsewhere
}) {
  const part = (section: CardiacOutputMethodSectionId) => {
    const heading = CARDIAC_OUTPUT_METHOD_SECTION_HEADINGS[section]
    const where = elsewhere[section]
    const content = <CardiacOutputMethodSection method={method} section={section} />
    return where ? (
      <details
        className={styles.repeatedPart}
        data-stage-collapsed
        data-repeated-part={where}
        data-method-section={section}
      >
        <summary>
          {heading} · {where}
        </summary>
        {content}
      </details>
    ) : (
      <>
        <h4 className={styles.thermoTrialQuality} data-method-section={section}>
          <span>{heading}</span>
        </h4>
        {content}
      </>
    )
  }
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

      {part('provenance')}
      {part('calculation')}
      {part('acquisition')}
      {part('quality')}
      {part('repeatability')}
      {part('breakdown')}

      {elsewhere.repeat || elsewhere.withhold ? (
        <>
          {part('repeat')}
          {part('withhold')}
        </>
      ) : (
        <div className={styles.scenarioSideBySide}>
          <div>{part('repeat')}</div>
          <div>{part('withhold')}</div>
        </div>
      )}

      <p className={styles.measurementTeachingCallout}>
        <strong>Role of the other method.</strong> {method.alternateMethodRole}
      </p>
      <p className={styles.measurementTeachingCallout}>
        <strong>Interpretation boundary.</strong> {method.interpretationBoundary}
      </p>

      {part('sources')}
    </div>
  )
}

/**
 * An optional question: is a measured oxygen uptake and a substituted one the same method?
 *
 * Checking an answer or opening the reasoning shows it; neither advances anything, and the reasoning
 * is available before any answer (HD-01). Try again clears a checked answer.
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
  const [shown, setShown] = useState(false)
  const choice = CARDIAC_OUTPUT_PROVENANCE_CHOICES.find((candidate) => candidate.id === choiceId)
  const best = CARDIAC_OUTPUT_PROVENANCE_CHOICES[0]

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
          onResolved()
        }}
      >
        Check this reading
      </button>
      {committed ? (
        <button
          type="button"
          onClick={() => {
            setCommitted(false)
            setChoiceId(null)
          }}
        >
          Try again
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={shown}
          onClick={() => {
            setShown((current) => !current)
            onResolved()
          }}
        >
          {shown ? 'Hide the reasoning' : 'Show the reasoning'}
        </button>
      )}
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
          {choice.isDefensible ? '' : ` ${best.why}`}
        </p>
      ) : null}
      {!committed && (shown || resolved) ? (
        <p className={styles.methodVerdict} data-verdict="shown" role="status">
          <strong>The best-supported reading. </strong>
          {best.label} {best.why}
        </p>
      ) : null}
    </fieldset>
  )
}

export function CardiacOutputMethodModel({
  provenanceResolved = false,
  onProvenanceResolved,
  shownElsewhere,
}: {
  readonly provenanceResolved?: boolean
  readonly onProvenanceResolved?: () => void
  /**
   * One method whose account the lesson reads partly on pages of its own, and where each part is
   * ("from task 1", "on the pages after this card"). Those parts are closed headings on that
   * method's tab only; the other methods' are not read elsewhere and stay open. `openQuestions`
   * does the same for "Where the methods are uncertain".
   */
  readonly shownElsewhere?: {
    readonly methodId: CardiacOutputMethodId
    readonly sections: CardiacOutputMethodElsewhere
    readonly openQuestions?: string
  }
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
      <MethodDetail
        method={selected}
        elsewhere={selected.id === shownElsewhere?.methodId ? shownElsewhere.sections : undefined}
      />

      <ProvenanceCommitment
        resolved={provenanceResolved}
        onResolved={() => onProvenanceResolved?.()}
      />

      <div className={styles.measurementTeachingCard} data-method-open-questions>
        {shownElsewhere?.openQuestions ? (
          <details
            className={styles.repeatedPart}
            data-stage-collapsed
            data-repeated-part={shownElsewhere.openQuestions}
          >
            <summary>Where the methods are uncertain · {shownElsewhere.openQuestions}</summary>
            <CardiacOutputOpenQuestions />
          </details>
        ) : (
          <>
            <h3>Where the methods are uncertain</h3>
            <CardiacOutputOpenQuestions />
          </>
        )}
      </div>
    </section>
  )
}
