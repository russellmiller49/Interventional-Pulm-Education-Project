'use client'

import { useId, useState } from 'react'

import {
  CRRT_CITRATE_DIFFERENTIAL_IDS,
  CRRT_CITRATE_HELD_OPEN_NOTICE,
  CRRT_CITRATE_MECHANISM_HEADLINE,
  CRRT_CITRATE_SCOPE_NOTICE,
  crrtCitrateComparisonRows,
  crrtCitrateDifferentialById,
  crrtCitrateDifferentialCategories,
  crrtCitrateMechanismWalk,
  type CrrtCitrateDifferentialCategory,
  type CrrtCitrateDifferentialId,
  type CrrtSamplingDomain,
} from '../content/citrateDifferential'
import styles from './crrt-citrate-differential.module.css'

const DOMAIN_LABELS: Readonly<Record<CrrtSamplingDomain, string>> = Object.freeze({
  circuit: 'Circuit sample',
  systemic: 'Patient sample',
  'both-compared': 'Both samples, compared',
})

/**
 * The complete text equivalent for the comparison.
 *
 * The rendered table distinguishes an open question from a stated one with a border, a background,
 * and a written tag; this string carries the same distinction in words, so a reader who never sees
 * the styling loses nothing. It is exposed in a disclosure rather than a tooltip, because a
 * consequence that is only available on hover is not available.
 */
export function crrtCitrateComparisonTextEquivalent(): string {
  const lines: string[] = [
    'Four questions about citrate, kept apart.',
    CRRT_CITRATE_MECHANISM_HEADLINE,
  ]

  for (const step of crrtCitrateMechanismWalk()) {
    lines.push(
      `Mechanism step ${step.ordinal}. ${step.term.term}. ${step.term.definition} ${step.term.whyItMatters} On the circuit: ${step.traceOnTheCircuit}`,
    )
  }

  for (const category of crrtCitrateDifferentialCategories) {
    lines.push(
      `Category ${category.ordinal} of ${crrtCitrateDifferentialCategories.length}: ${category.name}. ${category.notToBeConfusedWith} The question it asks: ${category.clinicalQuestion} Sampling domain: ${DOMAIN_LABELS[category.samplingDomain]}, because ${category.samplingDomainWhy}`,
    )
    for (const row of crrtCitrateComparisonRows) {
      const field = row.read(category)
      lines.push(
        `${category.name} — ${row.label} (${
          field.support === 'held-open'
            ? 'open question, not answered by the sources registered for this module'
            : 'follows from the circuit'
        }): ${field.statement}`,
      )
    }
    lines.push(
      `${category.name} — what one finding cannot establish: ${category.whatOneFindingCannotEstablish}`,
    )
    lines.push(`${category.name} — first safe step: ${category.firstVerificationBoundary}`)
  }

  lines.push(CRRT_CITRATE_HELD_OPEN_NOTICE)
  lines.push(CRRT_CITRATE_SCOPE_NOTICE)
  return lines.join('\n')
}

export interface CrrtCitrateDifferentialProps {
  readonly initialCategoryId?: CrrtCitrateDifferentialId
}

function CategoryDetail({
  category,
  headingId,
}: {
  readonly category: CrrtCitrateDifferentialCategory
  readonly headingId: string
}) {
  return (
    <div className={styles.categoryDetail} data-category={category.id}>
      <h5 id={headingId}>
        {category.ordinal}. {category.name}
      </h5>
      <p>
        <span className={styles.domainBadge}>{DOMAIN_LABELS[category.samplingDomain]}</span>
      </p>
      <p className={styles.categoryQuestion}>
        <strong>The question it asks:</strong> {category.clinicalQuestion}
      </p>
      <p className={styles.notConfused}>{category.notToBeConfusedWith}</p>
      <p className={styles.heldOpenNotice}>
        <strong>Why that sample:</strong> {category.samplingDomainWhy}
      </p>

      <dl className={styles.fieldList}>
        {crrtCitrateComparisonRows.map((row) => {
          const field = row.read(category)
          return (
            <div key={row.id} data-support={field.support} data-row={row.id}>
              <dt>
                {row.label}
                <span className={styles.supportTag}>
                  {field.support === 'held-open' ? 'Open question' : 'Follows from the circuit'}
                </span>
              </dt>
              <dd>{field.statement}</dd>
            </div>
          )
        })}
      </dl>

      <div className={styles.limitBlock}>
        <strong>What one finding cannot establish</strong>
        <p>{category.whatOneFindingCannotEstablish}</p>
      </div>
      <div className={styles.limitBlock}>
        <strong>First safe step</strong>
        <p>{category.firstVerificationBoundary}</p>
      </div>
    </div>
  )
}

/**
 * C3 — the citrate mechanism walk and the four-way comparison.
 *
 * The mechanism walk reuses the citrate terms authored during C0/C1 rather than defining them a
 * second time, and the circuit those terms describe is the same circuit in the same orientation
 * shown everywhere else in the module.
 */
export function CrrtCitrateDifferential({
  initialCategoryId = 'insufficient-citrate-effect',
}: CrrtCitrateDifferentialProps) {
  const idPrefix = useId()
  const [openCategoryId, setOpenCategoryId] = useState<CrrtCitrateDifferentialId>(initialCategoryId)
  const walk = crrtCitrateMechanismWalk()
  const openCategory = crrtCitrateDifferentialById.get(openCategoryId)!
  const detailHeadingId = `${idPrefix}-category-heading`

  return (
    <section
      className={styles.citrate}
      aria-labelledby={`${idPrefix}-heading`}
      data-open-category={openCategoryId}
      data-category-count={CRRT_CITRATE_DIFFERENTIAL_IDS.length}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Mechanism you can carry to any protocol</span>
          <h3 id={`${idPrefix}-heading`}>
            Citrate: where it acts, and four questions to keep apart
          </h3>
        </div>
        <span className={styles.pendingBadge}>Teaching section</span>
      </header>

      <p className={styles.headline}>{CRRT_CITRATE_MECHANISM_HEADLINE}</p>

      <section className={styles.mechanism} aria-labelledby={`${idPrefix}-mechanism-heading`}>
        <h4 id={`${idPrefix}-mechanism-heading`}>Follow it once around the circuit</h4>
        <ol>
          {walk.map((step) => (
            <li key={step.termId} className={styles.mechanismStep} data-term={step.termId}>
              <span className={styles.stepOrdinal}>
                Step {step.ordinal} of {walk.length}
              </span>
              <strong>{step.term.term}</strong>
              <p>{step.term.definition}</p>
              <em>{step.term.whyItMatters}</em>
              <span className={styles.traceLine}>
                <strong>Trace it:</strong> {step.traceOnTheCircuit}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.comparison} aria-labelledby={`${idPrefix}-comparison-heading`}>
        <h4 id={`${idPrefix}-comparison-heading`}>
          Four questions, four different answers to &ldquo;which sample?&rdquo;
        </h4>
        <p className={styles.heldOpenNotice}>
          These are four separate questions, not four names for one problem. Open each in turn; the
          summary underneath keeps all four visible at once.
        </p>

        <div
          className={styles.categoryPicker}
          role="group"
          aria-label="Citrate comparison categories"
        >
          {crrtCitrateDifferentialCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={category.id === openCategoryId}
              aria-controls={detailHeadingId}
              onClick={() => setOpenCategoryId(category.id)}
            >
              <span className={styles.categoryOrdinal}>
                Question {category.ordinal} of {crrtCitrateDifferentialCategories.length}
              </span>
              <span className={styles.categoryName}>{category.name}</span>
              <span className={styles.categoryDomain}>
                {DOMAIN_LABELS[category.samplingDomain]}
              </span>
            </button>
          ))}
        </div>

        <CategoryDetail category={openCategory} headingId={detailHeadingId} />

        <p className={styles.heldOpenNotice}>{CRRT_CITRATE_HELD_OPEN_NOTICE}</p>

        <ul className={styles.allCategories} aria-label="All four questions side by side">
          {crrtCitrateDifferentialCategories.map((category) => (
            <li key={category.id} data-summary-for={category.id}>
              <strong>
                {category.ordinal}. {category.name}
              </strong>{' '}
              — {DOMAIN_LABELS[category.samplingDomain]}. {category.clinicalQuestion}{' '}
              {category.notToBeConfusedWith}
            </li>
          ))}
        </ul>

        <details className={styles.textEquivalent}>
          <summary>Read the whole comparison as text</summary>
          <pre>{crrtCitrateComparisonTextEquivalent()}</pre>
        </details>
      </section>

      <p className={styles.scopeNotice} role="note">
        {CRRT_CITRATE_SCOPE_NOTICE}
      </p>
    </section>
  )
}
