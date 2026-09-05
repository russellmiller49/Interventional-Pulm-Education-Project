'use client'

import { useId, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import {
  cardiacOutputInputStatusLabels,
  derivedMetricRecords,
  derivedMetricTextEquivalent,
  derivedThresholdClassificationLabels,
  DERIVED_VERIFICATION_NOTE,
  derivedUnsupportedClaimTopics,
  requireDerivedInputDefinition,
  requireDerivedMetric,
  requireDerivedThresholdContext,
  hemodynamicsSourceById,
  type DerivedMetricId,
  type DerivedMetricRecord,
} from '../content'
import styles from './icu-hemodynamics.module.css'

/**
 * The one place a learner reads what each derived value is.
 *
 * Every sentence on this panel is a field of a `DerivedMetricRecord` or a threshold-context record.
 * The panel it replaces carried its own prose — formulas written a second time next to the engine
 * that computed them, and "normal ranges" with no statement of what kind of claim each number was.
 * Rendering the records means a formula or boundary can only be changed in the place the validator,
 * the evaluator, and the numeric audit also read.
 */

const PIPELINE_STAGES = [
  'Raw measurement',
  'Validated input',
  'Method and timing provenance',
  'Equation',
  'Calculated result',
  'Validity status',
  'Sensitivity and limitations',
  'Interpretation boundary',
] as const

function MetricDetail({ metric }: { readonly metric: DerivedMetricRecord }) {
  return (
    <div className={styles.measurementTeachingCard}>
      <h3>
        {metric.name} ({metric.shortLabel})
      </h3>
      <dl className={styles.curveFeatureList}>
        <div>
          <dt>What it is</dt>
          <dd>
            A calculated value — an equation over measurements, not a new measurement.{' '}
            {metric.interpretation}
          </dd>
        </div>
        <div>
          <dt>Formula</dt>
          <dd>
            <code>
              {metric.shortLabel} = {metric.formulaText}
            </code>{' '}
            reported in {metric.outputUnit || 'a dimensionless ratio'}.
          </dd>
        </div>
        <div>
          <dt>Units, carried through</dt>
          <dd>{metric.unitAccount.join(' ')}</dd>
        </div>
        <div>
          <dt>What the arithmetic needs</dt>
          <dd>{metric.mathematicalDomain}</dd>
        </div>
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>Every input, and how it must arrive</span>
      </h4>
      <dl className={styles.methodProvenanceTable}>
        {metric.dependencies.map((dependency) => {
          const definition = requireDerivedInputDefinition(dependency.inputId)
          return (
            <div key={dependency.inputId}>
              <dt>
                {definition.label} ({definition.unit}) · {dependency.role}
              </dt>
              <dd>
                {dependency.acceptableProvenance.map((provenance) => (
                  <span key={provenance} className={styles.provenanceChip} data-status={provenance}>
                    {cardiacOutputInputStatusLabels[provenance].label}
                  </span>
                ))}
              </dd>
              <dd>
                {definition.whatItIs}
                {definition.requiredConvention
                  ? ` Required convention: ${definition.requiredConvention.replaceAll('-', ' ')}.`
                  : ''}
              </dd>
            </div>
          )
        })}
      </dl>

      <dl className={styles.curveFeatureList}>
        <div>
          <dt>Method dependence</dt>
          <dd>
            {metric.requiresFlowMethod
              ? 'Consumes a cardiac output, so the result carries its acquisition method — bolus thermodilution, direct Fick with measured oxygen uptake, or Fick with an assumed oxygen uptake — and any assumption inside it.'
              : 'Needs no cardiac output, so it can remain available when every flow-dependent value is withheld.'}
          </dd>
        </div>
        <div>
          <dt>Body-size dependence</dt>
          <dd>
            {metric.requiresBodySurfaceArea
              ? 'Requires a body surface area whose height-and-weight provenance is known. When body size is missing, this value is withheld rather than calculated from an assumed figure.'
              : 'Does not use body surface area.'}
          </dd>
        </div>
        <div>
          <dt>Which input moves it most</dt>
          <dd>{metric.sensitivityAccount}</dd>
        </div>
        <div>
          <dt>What it still does not establish</dt>
          <dd>{metric.cannotEstablish}</dd>
        </div>
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>Withhold the result when</span>
      </h4>
      <ul className={styles.measurementTeachingAudit}>
        {metric.invalidWhen.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h4 className={styles.thermoTrialQuality}>
        <span>Context-specific boundaries — each one classified</span>
      </h4>
      <dl className={styles.curveFeatureList}>
        {metric.thresholdContextIds.map((contextId) => {
          const context = requireDerivedThresholdContext(contextId)
          return (
            <div key={contextId}>
              <dt>{derivedThresholdClassificationLabels[context.classification]}</dt>
              <dd>
                {context.statement} <strong>Applies to:</strong> {context.population}{' '}
                {context.notUniversal}
              </dd>
            </div>
          )
        })}
      </dl>

      <h4 className={styles.thermoTrialQuality}>
        <span>Sources and their limits</span>
      </h4>
      <ul className={styles.measurementTeachingAudit}>
        {metric.evidenceIds.map((evidenceId) => {
          const source = hemodynamicsSourceById.get(evidenceId)
          return <li key={evidenceId}>{source ? source.citation : evidenceId}</li>
        })}
        {metric.sourceLimitations.map((limitation) => (
          <li key={limitation}>{limitation}</li>
        ))}
      </ul>
    </div>
  )
}

export function DerivedHemodynamicsTeachingPanel() {
  const headingId = useId()
  const [selectedId, setSelectedId] = useState<DerivedMetricId>('pulmonaryVascularResistance')
  const selected = requireDerivedMetric(selectedId)

  return (
    <section className={styles.measurementTeachingPanel} aria-labelledby={headingId}>
      <header>
        <span>Learn before calculating</span>
        <h2 id={headingId}>Derived hemodynamics are equations, not new measurements</h2>
        <p>
          A derived value is an equation over measurements, and it cannot be more valid than its
          inputs. For every displayed number this station asks the same questions: which equation
          produced it, where each input came from, which method produced the flow, whether the
          inputs belong to one measurement episode, whether the arithmetic is possible, what it is
          sensitive to, and what it still does not establish.
        </p>
      </header>

      <div
        className={styles.derivedDependencyFlow}
        aria-label="From raw measurement to interpretation boundary"
      >
        {PIPELINE_STAGES.map((stage, index) => (
          <span key={stage}>
            {index > 0 ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
            {stage}
          </span>
        ))}
      </div>

      <div className={styles.methodTabs} role="tablist" aria-label="Derived metrics">
        {derivedMetricRecords.map((metric) => (
          <button
            key={metric.id}
            type="button"
            role="tab"
            aria-selected={metric.id === selectedId}
            onClick={() => setSelectedId(metric.id)}
          >
            {metric.shortLabel}
          </button>
        ))}
      </div>

      <p className="sr-only">{derivedMetricTextEquivalent(selected)}</p>
      <MetricDetail metric={selected} />

      <div className={styles.measurementTeachingCard}>
        <h3>What this module does not claim</h3>
        <p className={styles.openQuestionCard}>
          <strong>No universal targets.</strong> No boundary on this station is a treatment target,
          and the model refuses that classification outright. Declared source gaps:{' '}
          {derivedUnsupportedClaimTopics().join(', ').replaceAll('-', ' ')}.
        </p>
        <p className={styles.measurementTeachingSource}>
          <span>Source boundary</span>
          {DERIVED_VERIFICATION_NOTE}
        </p>
      </div>
    </section>
  )
}
