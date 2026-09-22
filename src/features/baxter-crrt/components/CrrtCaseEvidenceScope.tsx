'use client'

import { FlaskConical } from 'lucide-react'

import {
  CRRT_ABSENT_EVIDENCE_CAPTION,
  CRRT_CASE_EVIDENCE_HEADING,
  CRRT_SUPPLIED_EVIDENCE_CAPTION,
  type CrrtCaseEvidence,
} from '../caseEvidence'
import {
  isResolvableCrrtSourceId,
  resolveCrrtLearnerFacingSource,
} from '../content/learnerSourceMap'
import styles from './crrt-case-evidence-scope.module.css'
import playerStyles from './crrt-case-player.module.css'

function citationText(sourceIds: readonly string[]): string {
  return sourceIds
    .filter(isResolvableCrrtSourceId)
    .map((id) => {
      const source = resolveCrrtLearnerFacingSource(id)
      const location = source.pageOrSection?.includes('http') ? null : source.pageOrSection
      return [source.sourceTitle, source.documentVersion, location].filter(Boolean).join(' · ')
    })
    .join('; ')
}

/**
 * The case's evidence scope, in the task.
 *
 * This sits with the findings rather than behind the worked explanation, because
 * a learner deciding what a case is asking has to know which evidence exists
 * before committing — not after a reveal tells them it never did.
 */
export function CrrtCaseEvidenceScope({
  evidence,
  scopedId,
}: {
  evidence: CrrtCaseEvidence
  scopedId: (id: string) => string
}) {
  const headingId = scopedId('crrt-case-evidence-scope')
  return (
    <section className={styles.scope} aria-labelledby={headingId}>
      <div className={playerStyles.workflowHeading}>
        <FlaskConical aria-hidden="true" />
        <div>
          <span>Scope</span>
          <h4 id={headingId}>{CRRT_CASE_EVIDENCE_HEADING}</h4>
        </div>
      </div>
      <p className={styles.headline}>{evidence.headline}</p>

      {evidence.supplied.length > 0 ? (
        <div className={styles.block}>
          <h5>Supplied case values</h5>
          <dl className={styles.suppliedGrid}>
            {evidence.supplied.map((entry) => (
              <div key={entry.id} data-supplied={entry.supplied}>
                <dt>{entry.label}</dt>
                <dd>
                  <strong>{entry.valueText}</strong>
                  <small>
                    {entry.sampleIdentity} · {entry.timePoint}
                  </small>
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.caption}>
            {CRRT_SUPPLIED_EVIDENCE_CAPTION}
            {evidence.suppliedSourceIds.length > 0
              ? ` Source: ${evidence.suppliedSourceIds.join(', ')}.`
              : ''}
          </p>
        </div>
      ) : null}

      <div className={styles.block}>
        <h5>Not in this case</h5>
        <ul className={styles.absentList}>
          {evidence.absent.map((entry) => (
            <li key={entry.label}>
              <strong>{entry.label}</strong>
              <span>{entry.reason}</span>
            </li>
          ))}
        </ul>
        <p className={styles.caption}>{CRRT_ABSENT_EVIDENCE_CAPTION}</p>
      </div>

      <div className={styles.twoUp}>
        <div className={styles.block}>
          <h5>What the simulation calculates here</h5>
          <ul>
            {evidence.modelCalculates.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className={styles.block}>
          <h5>What it does not model</h5>
          <ul>
            {evidence.modelDoesNotModel.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      {evidence.furtherTeaching.length > 0 ? (
        <div className={styles.block}>
          <h5>Taught here, not shown by the simulation</h5>
          <ul>
            {evidence.furtherTeaching.map((pointer) => (
              <li key={pointer.text}>
                {pointer.text}
                <span className={styles.citation}>
                  {pointer.sourceIds.length > 0
                    ? citationText(pointer.sourceIds)
                    : 'No registered source yet; awaiting clinical review.'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
