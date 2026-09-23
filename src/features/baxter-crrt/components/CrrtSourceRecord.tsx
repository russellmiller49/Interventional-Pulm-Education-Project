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
  return (
    <details className={styles.record} data-source-record={audit.id}>
      <summary>Source record {audit.id}</summary>
      <ul className={styles.list}>
        <li>Registered version: {audit.documentVersion ?? 'not recorded'}</li>
        <li>Registered section: {audit.pageOrSection}</li>
        <li>
          Review status: {audit.reviewStatus}
          {audit.reviewer ? ` · ${audit.reviewer}` : ' · no reviewer recorded'}
        </li>
        <li>Used in: {audit.implementationLocation}</li>
        {audit.versionNote ? <li>{audit.versionNote}</li> : null}
      </ul>
    </details>
  )
}
