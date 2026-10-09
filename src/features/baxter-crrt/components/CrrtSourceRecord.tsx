import type { CrrtLearnerCitation } from '../sourcePresentation'
import styles from './crrt-source-dating.module.css'

/**
 * The exact registered record behind a plain citation, one disclosure away (F-19).
 *
 * The main path shows `citation.line` and `citation.review`; this keeps the id, the registered
 * strings verbatim and where the module uses the record reachable by any learner — not an admin
 * view — so a limitation or an unreviewed status can always be traced.
 */
export function CrrtSourceRecord({ citation }: { readonly citation: CrrtLearnerCitation }) {
  const { audit } = citation
  // Case and drill example values have no published source; a build identifier is not a citation.
  if (audit.id.startsWith('SYNTH-')) {
    return (
      <details className={styles.record} data-source-record={audit.id}>
        <summary>Where in the source</summary>
        <ul className={styles.list}>
          <li>Example values written for this exercise.</li>
        </ul>
      </details>
    )
  }
  return (
    <details className={styles.record} data-source-record={audit.id}>
      <summary>Where in the source</summary>
      <ul className={styles.list}>
        <li>Edition: {audit.documentVersion ?? 'not recorded'}</li>
        <li>Section: {audit.pageOrSection}</li>
        {audit.versionNote ? <li>{audit.versionNote}</li> : null}
      </ul>
    </details>
  )
}
