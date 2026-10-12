'use client'

import { ventilationEvidenceById, ventilationSourceClassLabel } from '../content/evidence'
import { VENTILATION_NUMBERS } from '../content/teachingNumbers'
import styles from './ventilation-course.module.css'

/**
 * The two reference surfaces the knowledge check and the lung-protection section still use: the
 * ATS 2024 adult ARDS card, and a folded source list. The reading-course explorers that used to
 * live here had no importers and are gone.
 */

export function VentilationProtectionReference() {
  return (
    <aside className={styles.breath} aria-label="Adult ARDS guideline reference">
      <span className={styles.badge}>
        Adult ARDS · ARDS Network 2000; ATS/ESICM/SCCM 2017, kept in the ATS 2024 update
      </span>
      <h2 style={{ marginTop: 18 }}>Three numbers, together</h2>
      <p className={styles.number}>{VENTILATION_NUMBERS.value('vt-ards-goal')}</p>
      <p className={styles.muted}>
        Tidal volume goal, within {VENTILATION_NUMBERS.value('vt-ards-range')}
      </p>
      <p className={styles.number} style={{ marginTop: 20 }}>
        {VENTILATION_NUMBERS.value('pplat-limit')}
      </p>
      <p className={styles.muted}>Plateau pressure, on a relaxed patient</p>
      <p className={styles.number} style={{ marginTop: 20 }}>
        {VENTILATION_NUMBERS.value('driving-pressure-limit')}
      </p>
      <p className={styles.muted}>Driving pressure: plateau minus PEEP (Amato 2015)</p>
      <p className={styles.muted} style={{ marginTop: 20 }}>
        PBW, male: {VENTILATION_NUMBERS.value('pbw-male')}. Female:{' '}
        {VENTILATION_NUMBERS.value('pbw-female')}.
      </p>
      <a
        className={styles.textLink}
        href="https://pubmed.ncbi.nlm.nih.gov/28459336/"
        target="_blank"
        rel="noreferrer"
      >
        Read the 2017 recommendation
      </a>{' '}
      <a
        className={styles.textLink}
        href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10870893/"
        target="_blank"
        rel="noreferrer"
      >
        Read the 2024 update that keeps it
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
      <summary>Sources</summary>
      <ul className={styles.sources}>
        {evidenceIds.map((id) => {
          const source = ventilationEvidenceById.get(id)
          return source ? (
            <li key={id} data-evidence-id={id}>
              <strong>{ventilationSourceClassLabel[source.sourceClass]} · </strong>
              {source.sourceUrl ? (
                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              <p>{source.citation}</p>
              <p>{source.limitations}</p>
            </li>
          ) : null
        })}
      </ul>
    </details>
  )
}
