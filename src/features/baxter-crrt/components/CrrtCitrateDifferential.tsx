'use client'

import { Fragment, useId, useState } from 'react'
import {
  CRRT_CITRATE_HELD_OPEN_NOTICE,
  CRRT_CITRATE_MECHANISM_HEADLINE,
  CRRT_CITRATE_SCOPE_NOTICE,
  crrtCitrateComparisonRows,
  crrtCitrateDifferentialById,
  crrtCitrateDifferentialCategories,
  crrtCitrateMechanismWalk,
  type CrrtCitrateDifferentialId,
  type CrrtSamplingDomain,
} from '../content/citrateDifferential'
import { crrtCircuitNode } from '../content/circuitModel'
import { baxterCrrtLearnerFacingSourceById } from '../content/learnerSourceMap'
import { crrtSourceDating } from '../content/sourceReviewMetadata'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import { CrrtSourceDating } from './CrrtSourceDating'
import styles from './crrt-citrate-differential.module.css'

const DOMAIN_LABELS: Record<CrrtSamplingDomain, string> = {
  circuit: 'Circuit sample',
  systemic: 'Patient sample',
  'both-compared': 'Both domains, different questions',
}
const basisLabel = (kind: string) =>
  kind === 'registered-source-gap' || kind === 'held-open'
    ? 'Open question'
    : kind === 'clinical-publication'
      ? 'Clinical-publication support · review pending'
      : 'Read off this circuit'

export function crrtCitrateComparisonTextEquivalent(): string {
  return [
    CRRT_CITRATE_MECHANISM_HEADLINE,
    ...crrtCitrateMechanismWalk().map(
      ({ term, traceOnTheCircuit }) =>
        `${term.term} (${basisLabel(term.claimSupport.kind)}). ${term.definition} ${term.whyItMatters} ${traceOnTheCircuit}`,
    ),
    ...crrtCitrateDifferentialCategories.map((c) =>
      [
        c.name,
        c.clinicalQuestion,
        c.notToBeConfusedWith,
        c.samplingDomainWhy,
        ...crrtCitrateComparisonRows.map(
          (r) => `${r.label} (${basisLabel(r.read(c).support)}): ${r.read(c).statement}`,
        ),
        c.whatOneFindingCannotEstablish,
        c.firstVerificationBoundary,
      ].join(' '),
    ),
    CRRT_CITRATE_HELD_OPEN_NOTICE,
    CRRT_CITRATE_SCOPE_NOTICE,
  ].join('\n')
}

export interface CrrtCitrateDifferentialProps {
  readonly initialCategoryId?: CrrtCitrateDifferentialId
  readonly presentation?: 'full' | 'mechanism' | 'comparison'
  /** Guided exposure only; independent application is a separate task. */
  readonly onReviewed?: (response: string) => void
}

export function CrrtCitrateDifferential({
  initialCategoryId = 'insufficient-citrate-effect',
  presentation = 'full',
  onReviewed,
}: CrrtCitrateDifferentialProps) {
  const prefix = useId()
  const [termIndex, setTermIndex] = useState(0)
  const [visitedTerms, setVisitedTerms] = useState<readonly number[]>([])
  const [openCategoryId, setCategory] = useState(initialCategoryId)
  const [visitedCategories, setVisitedCategories] = useState<readonly string[]>([])
  const walk = crrtCitrateMechanismWalk()
  const step = walk[termIndex]
  const category = crrtCitrateDifferentialById.get(openCategoryId)!
  const sourceIds =
    presentation === 'mechanism' ? step.term.claimSupport.supportingSourceIds : category.sourceIds
  function selectTerm(index: number) {
    setTermIndex(index)
    const visited = [...new Set([...visitedTerms, index])]
    setVisitedTerms(visited)
    if (visited.length === walk.length) onReviewed?.('citrate-path-and-samples-reviewed')
  }
  function selectCategory(id: CrrtCitrateDifferentialId) {
    setCategory(id)
    const visited = [...new Set([...visitedCategories, id])]
    setVisitedCategories(visited)
    if (visited.length === crrtCitrateDifferentialCategories.length)
      onReviewed?.('four-citrate-patterns-reviewed')
  }
  return (
    <section className={styles.citrate} aria-labelledby={`${prefix}-title`}>
      <header className={styles.header}>
        <h3 id={`${prefix}-title`}>
          {presentation === 'comparison'
            ? 'Four citrate patterns'
            : 'Citrate path and sampling points'}
        </h3>
        <span className={styles.pendingBadge}>Clinical review pending</span>
      </header>
      <p>{CRRT_CITRATE_MECHANISM_HEADLINE}</p>
      {presentation !== 'comparison' ? (
        <section className={styles.mechanism} aria-label="Citrate mechanism walk">
          <div
            className={styles.categoryPicker}
            role="group"
            aria-label="Citrate path and sampling selection"
          >
            {walk.map((item, index) => (
              <button
                key={item.termId}
                type="button"
                aria-pressed={index === termIndex}
                aria-controls={`${prefix}-term`}
                onClick={() => selectTerm(index)}
              >
                {item.ordinal}. {item.term.term}
              </button>
            ))}
          </div>
          <p>
            {visitedTerms.length} of {walk.length} locations selected. Select both sampling domains
            to compare what each measures.
          </p>
          <div
            id={`${prefix}-term`}
            className={styles.mechanismStep}
            data-support={step.term.claimSupport.kind}
          >
            <h4>{step.term.term}</h4>
            <p>{step.term.definition}</p>
            <p>{step.term.whyItMatters}</p>
            <p>
              <strong>On this circuit:</strong> {crrtCircuitNode(step.nodeId).label}.{' '}
              {step.traceOnTheCircuit}
            </p>
            <span className={styles.supportTag}>{basisLabel(step.term.claimSupport.kind)}</span>
          </div>
          <CrrtPilotCircuit
            presentation="focused"
            overlayId="citrate-calcium"
            highlightedNodeId={step.nodeId}
            running={false}
            setReady={false}
            fluidsReady={false}
            bloodFlowMlMin={null}
            dialysateFlowMlHour={null}
            patientFluidRemovalMlHour={null}
            pressure={{
              access: null,
              filter: null,
              return: null,
              effluent: null,
              TMP: null,
              filterDrop: null,
            }}
          />
          <p>
            Conceptual path only. This diagram does not apply citrate, operate a pump or generate
            calcium measurements.
          </p>
        </section>
      ) : null}
      {presentation !== 'mechanism' ? (
        <section className={styles.comparison} aria-label="Citrate comparison">
          <div
            className={styles.categoryPicker}
            role="group"
            aria-label="Citrate comparison categories"
          >
            {crrtCitrateDifferentialCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === openCategoryId}
                aria-controls={`${prefix}-category`}
                onClick={() => selectCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p>
            {visitedCategories.length} of 4 patterns selected. These are conceptual contrasts, not
            diagnostic criteria.
          </p>
          <div
            id={`${prefix}-category`}
            className={styles.categoryDetail}
            data-category={category.id}
          >
            <h4>{category.name}</h4>
            <p>{category.clinicalQuestion}</p>
            <p>
              {DOMAIN_LABELS[category.samplingDomain]} · {category.samplingDomainWhy}
            </p>
            <p>{category.notToBeConfusedWith}</p>
            <dl className={styles.fieldList}>
              {crrtCitrateComparisonRows.map((r) => {
                const field = r.read(category)
                return (
                  <div key={r.id} data-support={field.support}>
                    <dt>
                      {r.label}{' '}
                      <span className={styles.supportTag}>{basisLabel(field.support)}</span>
                    </dt>
                    <dd>{field.statement}</dd>
                  </div>
                )
              })}
            </dl>
            <p>
              <strong>Limit:</strong> {category.whatOneFindingCannotEstablish}
            </p>
            <p>{category.firstVerificationBoundary}</p>
          </div>
          <p>{CRRT_CITRATE_HELD_OPEN_NOTICE}</p>
        </section>
      ) : null}
      <details className={styles.textEquivalent}>
        <summary>Sources for this explanation</summary>
        {sourceIds.map((id) => {
          const source = baxterCrrtLearnerFacingSourceById.get(id)!
          const dated = crrtSourceDating(id) !== undefined
          return (
            <Fragment key={id}>
              <p>
                <strong>{source.sourceTitle}</strong> · {source.documentVersion}.{' '}
                {source.pageOrSection}.{dated ? null : ` Review: ${source.reviewStatus}.`}
              </p>
              <CrrtSourceDating sourceId={id} />
            </Fragment>
          )
        })}
      </details>
      {presentation === 'full' ? (
        <details className={styles.textEquivalent}>
          <summary>Read the whole comparison as text</summary>
          <pre>{crrtCitrateComparisonTextEquivalent()}</pre>
        </details>
      ) : null}
      <p className={styles.scopeNotice} role="note">
        {CRRT_CITRATE_SCOPE_NOTICE}
      </p>
    </section>
  )
}
