'use client'

import { ventilationEvidenceById } from '../content/evidence'
import styles from './ventilation-course.module.css'

/**
 * The two reference surfaces the knowledge check and the lung-protection section still use: the
 * ATS 2024 adult ARDS card, and a folded source list. The reading-course explorers that used to
 * live here had no importers and are gone.
 */

export function VentilationProtectionReference() {
  return (
    <aside className={styles.breath} aria-label="Adult ARDS guideline reference">
      <span className={styles.badge}>Guideline · ATS 2024 · adult ARDS</span>
      <h2 style={{ marginTop: 18 }}>Two measurements, together</h2>
      <p className={styles.number}>
        4–8 <small>mL/kg PBW</small>
      </p>
      <p className={styles.muted}>Tidal volume, using predicted body weight</p>
      <p className={styles.number} style={{ marginTop: 20 }}>
        &lt;30 <small>cmH₂O</small>
      </p>
      <p className={styles.muted}>Plateau pressure, with a valid measurement</p>
      <p className={styles.muted} style={{ marginTop: 20 }}>
        These limits guide adult ARDS ventilation. They do not replace individualized clinical
        evaluation.
      </p>
      <a
        className={styles.textLink}
        href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/"
        target="_blank"
        rel="noreferrer"
      >
        Read the ATS recommendation
      </a>
    </aside>
  )
}

export function VentilationLearningSources({
  evidenceIds,
}: {
  readonly evidenceIds: readonly string[]
}) {
  return (
    <details className={styles.details}>
      <summary>Sources and model boundaries</summary>
      <ul className={styles.sources}>
        {evidenceIds.map((id) => {
          const source = ventilationEvidenceById.get(id)
          return source ? (
            <li key={id}>
              <strong>
                {source.sourceClass === 'guideline' ? 'Guideline' : 'Clinical reference'} ·{' '}
              </strong>
              {source.sourceUrl ? (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              <p>{source.citation}</p>
              <p>{source.limitations}</p>
              {source.reviewedAt && (
                <p>Source checked {source.reviewedAt}; independent clinical sign-off pending.</p>
              )}
            </li>
          ) : null
        })}
      </ul>
      <p className={styles.muted}>
        Examples and questions were authored for this course on September 5, 2026. Their distractors
        adapt the supplied casebook and existing lesson rationales. They are not patient data or
        prevalence estimates.
      </p>
    </details>
  )
}
