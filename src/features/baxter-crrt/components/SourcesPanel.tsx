import { BookOpenCheck, FileWarning, LockKeyhole, ShieldCheck } from 'lucide-react'

import {
  baxterCrrtPublicationStatus,
  baxterCrrtPilotSourceReferences,
  baxterCrrtReleaseReviews,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
  prismaxDraftDeviceProfile,
} from '../content'
import styles from './baxter-crrt.module.css'

export function SourcesPanel() {
  const primarySource = baxterCrrtSourceDocuments.find((source) => source.role === 'primary')
  const inactiveSources = baxterCrrtSourceDocuments.filter((source) => source.role !== 'primary')
  const pilotContextSources = baxterCrrtPilotSourceReferences.filter(
    (source) =>
      source.sourceType === 'peer-reviewed' || source.sourceType === 'synthetic-calibration',
  )

  if (!primarySource) {
    throw new Error('Baxter CRRT primary source is not configured.')
  }

  return (
    <section className={styles.sourcesSection} aria-labelledby="baxter-crrt-sources-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Source boundary & release safety</span>
          <h2 id="baxter-crrt-sources-heading">What this draft can—and cannot—claim</h2>
        </div>
        <span className={styles.reviewBadge} data-status={baxterCrrtPublicationStatus}>
          {baxterCrrtPublicationStatus === 'published'
            ? 'PUBLISHED · REVIEW APPROVED'
            : 'DRAFT · REVIEW REQUIRED'}
        </span>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>
            Three synthetic teaching cases are active only inside this authenticated draft.
          </strong>
          <p>
            Phase 4–5 connects the source-mapped PrisMax workflow to deterministic cases, response
            models, and formative scoring. The published studies provide teaching context only;
            every exact case value, condition band, threshold, coefficient, score, critical-error
            rule, and alarm behavior is synthetic and pending clinical and device review. Nothing
            here is a patient-specific recommendation, clinical target, verified device limit, or
            competency decision.
          </p>
        </div>
      </div>

      <dl className={styles.sourceProfile}>
        <div>
          <dt>Evidence class</dt>
          <dd>Device manual + clinical context</dd>
        </div>
        <div>
          <dt>Primary source</dt>
          <dd>{primarySource.title}</dd>
        </div>
        <div>
          <dt>Document identity</dt>
          <dd>{primarySource.documentIdentity}</dd>
        </div>
        <div>
          <dt>Market/configuration</dt>
          <dd>{prismaxDraftDeviceProfile.marketConfiguration}</dd>
        </div>
        <div>
          <dt>Review state</dt>
          <dd>Pending</dd>
        </div>
      </dl>

      <div className={styles.sourceClaimGrid}>
        {baxterCrrtSourceRecords.map((record) => (
          <article key={record.id} className={styles.sourceClaim}>
            <span>
              <ShieldCheck aria-hidden="true" /> {record.evidenceClass.replaceAll('-', ' ')}
            </span>
            <h3>{record.sourceTitle}</h3>
            <p className={styles.sourceIdentity}>{record.documentIdentity}</p>
            <p>
              <strong>Relevant section:</strong> {record.pageOrSection}
            </p>
            <p>{record.claim}</p>
            <p className={styles.sourceLimitation}>
              <strong>Boundary:</strong> {record.limitation}
            </p>
            <small>
              Record {record.id} · review {record.reviewStatus}
            </small>
          </article>
        ))}
      </div>

      <div className={styles.sourceSubheading}>
        <span className={styles.kicker}>Phase 4–5 case evidence</span>
        <h3>Clinical context and synthetic calibration</h3>
        <p>
          Context sources support the teaching distinction being explored. They do not validate the
          pilot&apos;s authored numbers or define success criteria.
        </p>
      </div>

      <div className={styles.sourceClaimGrid}>
        {pilotContextSources.map((source) => (
          <article key={source.id} className={styles.sourceClaim}>
            <span>
              <ShieldCheck aria-hidden="true" /> {source.sourceType.replaceAll('-', ' ')}
            </span>
            <h3>{source.sourceTitle}</h3>
            <p className={styles.sourceIdentity}>{source.documentVersion}</p>
            <p>
              <strong>Relevant section:</strong> {source.pageOrSection}
            </p>
            <p>{source.claim}</p>
            <p className={styles.sourceLimitation}>
              <strong>Boundary:</strong> {source.value}
            </p>
            <small>
              Record {source.id} · review {source.reviewStatus} · {source.implementationLocation}
            </small>
          </article>
        ))}
      </div>

      <details className={styles.inactiveSources}>
        <summary>
          <BookOpenCheck aria-hidden="true" />
          Inactive supporting sources ({inactiveSources.length})
        </summary>
        <div>
          {inactiveSources.map((source) => (
            <article key={source.id}>
              <span>
                <LockKeyhole aria-hidden="true" /> {source.role}
              </span>
              <h3>{source.title}</h3>
              <p>{source.documentIdentity}</p>
              <p>{source.intendedUse}</p>
              <p className={styles.sourceLimitation}>
                <strong>Boundary:</strong> {source.limitation}
              </p>
              <small>Review {source.reviewStatus} · inactive in the Phase 4–5 pilot</small>
            </article>
          ))}
        </div>
      </details>

      <div className={styles.reviewStatusPanel}>
        <h3>Release reviews</h3>
        <ul>
          {baxterCrrtReleaseReviews.map((review) => (
            <li key={review.id}>
              <span aria-hidden="true">○</span>
              <strong>{review.label}</strong>
              <small>{review.status}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
