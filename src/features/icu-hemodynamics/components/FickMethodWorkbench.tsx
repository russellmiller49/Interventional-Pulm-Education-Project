'use client'

import { useId } from 'react'

import { requireCardiacOutputMethod } from '../content/cardiacOutputMethods'
import { requireCardiacOutputParameter } from '../content/cardiacOutputSourceBoundaries'
import {
  fickCardiacOutput,
  fickErrorAmplification,
  fickResultTextEquivalent,
  type FickInputSet,
  type FickResult,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

/**
 * Six Fick episodes, laid out so the input provenance is visible before the result is.
 *
 * Four of them cannot produce a number at all, which is the point. A learner who has only ever seen
 * the equation succeed has no way to recognize the episodes where a complete-looking input set does
 * not describe a single measurement — and those are the ones that reach a chart.
 */

const ASSUMED_EQUATION_QUALIFIER = requireCardiacOutputParameter(
  'oxygen-uptake-estimating-equation',
).learnerFacingQualifier
const BINDING_CONSTANT_QUALIFIER = requireCardiacOutputParameter(
  'hemoglobin-oxygen-binding-capacity',
).learnerFacingQualifier

interface FickEpisode {
  readonly id: string
  readonly label: string
  readonly whatHappened: string
  readonly inputs: FickInputSet
}

const baseInputs: FickInputSet = {
  methodId: 'fick-direct',
  vo2MlMin: 245,
  hemoglobinGDl: 12.4,
  arterialSaturationFraction: 0.97,
  mixedVenousSaturationFraction: 0.68,
  venousSampleSite: 'pulmonary-artery',
  arterialPo2MmHg: null,
  venousPo2MmHg: null,
  includeDissolvedOxygen: false,
  steadyState: true,
  samplesPairedInTime: true,
  intracardiacShuntPresent: false,
}

export const FICK_EPISODES: readonly FickEpisode[] = [
  {
    id: 'measured-uptake',
    label: 'Oxygen uptake measured',
    whatHappened:
      'Expired-gas analysis over the sampling interval, both specimens paired in time, venous specimen from the pulmonary artery.',
    inputs: baseInputs,
  },
  {
    id: 'assumed-uptake',
    label: 'Oxygen uptake assumed',
    whatHappened:
      'Identical specimens, but no uptake measurement. A substituted figure was entered in its place.',
    inputs: { ...baseInputs, methodId: 'fick-assumed-vo2', vo2MlMin: 205 },
  },
  {
    id: 'narrow-content-difference',
    label: 'A narrow oxygen-content difference',
    whatHappened:
      'A high-output episode: the same measured uptake, and a mixed-venous saturation much closer to the arterial one.',
    inputs: { ...baseInputs, mixedVenousSaturationFraction: 0.85 },
  },
  {
    id: 'central-venous-specimen',
    label: 'Venous specimen from the central line',
    whatHappened:
      'Everything else is the same, but the venous specimen came from the superior vena cava rather than the pulmonary artery.',
    inputs: { ...baseInputs, venousSampleSite: 'superior-vena-cava' },
  },
  {
    id: 'contradictory-inputs',
    label: 'Inputs that contradict each other',
    whatHappened:
      'The recorded mixed-venous saturation is higher than the arterial one, and the arterial specimen is missing.',
    inputs: {
      ...baseInputs,
      arterialSaturationFraction: null,
      mixedVenousSaturationFraction: 0.99,
    },
  },
  {
    id: 'intracardiac-shunt',
    label: 'An intracardiac shunt',
    whatHappened:
      'A known left-to-right shunt. The inputs are the ones this calculation takes: one arterial specimen, one pulmonary-artery specimen, one content difference — which is a single systemic difference, and pulmonary and systemic flow are now two different quantities.',
    inputs: { ...baseInputs, intracardiacShuntPresent: true },
  },
]

function FickTrace({ result }: { readonly result: FickResult }) {
  return (
    <dl className={styles.methodProvenanceTable}>
      {result.trace.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>
            <span className={styles.provenanceChip} data-status={row.status}>
              {row.statusLabel}
            </span>
          </dd>
          <dd>{row.display}</dd>
        </div>
      ))}
    </dl>
  )
}

function FickEpisodeCard({ episode }: { readonly episode: FickEpisode }) {
  const headingId = useId()
  const result = fickCardiacOutput(episode.inputs)
  const method = requireCardiacOutputMethod(episode.inputs.methodId)

  return (
    <article className={styles.fickCard} aria-labelledby={headingId}>
      <h3 id={headingId}>{episode.label}</h3>
      <p>{episode.whatHappened}</p>
      <p>
        <strong>{method.name}.</strong>{' '}
        {method.vo2Provenance === 'measured'
          ? 'Oxygen uptake was measured on this patient.'
          : 'Oxygen uptake was assumed, not measured on this patient.'}
      </p>

      <FickTrace result={result} />

      <ol className={styles.fickUnitAccount}>
        {result.unitAccount.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>

      <p className={styles.fickOutcome} data-status={result.status}>
        <span>{result.status === 'calculated' ? 'Method result' : 'Not interpretable'}</span>
        <strong>
          {result.status === 'calculated'
            ? `${result.cardiacOutputLMin?.toFixed(2)} L/min`
            : 'Result withheld'}
        </strong>
        <small>
          {result.status === 'calculated'
            ? `by ${result.methodName.toLowerCase()}`
            : result.withheldReasons.join(' ')}
        </small>
      </p>

      {result.caveats.length > 0 ? (
        <ul className={styles.measurementTeachingAudit}>
          {result.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}

      <p className="sr-only">{fickResultTextEquivalent(result)}</p>
    </article>
  )
}

/**
 * The amplification comparison.
 *
 * One saturation error, applied identically to a wide and a narrow oxygen-content difference. The
 * two cards next to each other are the argument: the input error is the same on both sides, and the
 * result moves much further on the narrow one.
 */
function AmplificationComparison() {
  const headingId = useId()
  const errorFraction = 0.03
  const wide = fickErrorAmplification(baseInputs, errorFraction)
  const narrow = fickErrorAmplification(
    { ...baseInputs, mixedVenousSaturationFraction: 0.85 },
    errorFraction,
  )
  if (!wide || !narrow) return null

  const cards = [
    { id: 'wide', label: 'Wider oxygen-content difference', amplification: wide },
    { id: 'narrow', label: 'Narrower oxygen-content difference', amplification: narrow },
  ]

  return (
    <article className={styles.fickCard} aria-labelledby={headingId}>
      <h3 id={headingId}>The same input error does not always matter the same amount</h3>
      <p>
        Both cards below take the identical mixed-venous saturation error — three binding sites in
        every hundred, in the same direction. The only difference is how far apart the two oxygen
        contents were to begin with. The content difference is the denominator, so as it narrows,
        the same absolute input error produces a larger proportional change in the flow.
      </p>
      <div className={styles.amplificationGrid}>
        {cards.map((card) => (
          <article key={card.id}>
            <h4>{card.label}</h4>
            <p>
              Content difference {card.amplification.contentDifferenceMlDl.toFixed(2)} mL of oxygen
              per dL.
            </p>
            <p>
              Before: {card.amplification.baselineCardiacOutputLMin.toFixed(2)} L/min. After the
              same saturation error: {card.amplification.perturbedCardiacOutputLMin.toFixed(2)}{' '}
              L/min.
            </p>
            <strong>
              {(
                card.amplification.perturbedCardiacOutputLMin -
                card.amplification.baselineCardiacOutputLMin
              ).toFixed(2)}{' '}
              L/min moved
            </strong>
            <p>
              A change of about{' '}
              {Math.abs(Math.round(card.amplification.relativeOutputChange * 100))} in every 100 of
              the starting value.
            </p>
          </article>
        ))}
      </div>
      <p className={styles.measurementTeachingCallout}>
        Same absolute input error, smaller denominator, larger proportional output error. Sampling
        timing, sampling site, hemoglobin, and a substituted oxygen uptake all enter the same
        division and are amplified the same way.
      </p>
    </article>
  )
}

export function FickMethodWorkbench() {
  const headingId = useId()
  return (
    <section className={styles.fickWorkbench} aria-labelledby={headingId}>
      <h2 id={headingId}>Fick: trace every input before you use the number</h2>
      <p>
        Each episode below shows the whole chain — what was measured, what was sampled and from
        where, what was entered, what was assumed, and what was calculated — and then either
        produces a flow or says why it will not. {ASSUMED_EQUATION_QUALIFIER}{' '}
        {BINDING_CONSTANT_QUALIFIER}
      </p>
      {FICK_EPISODES.map((episode) => (
        <FickEpisodeCard key={episode.id} episode={episode} />
      ))}
      <AmplificationComparison />
    </section>
  )
}
