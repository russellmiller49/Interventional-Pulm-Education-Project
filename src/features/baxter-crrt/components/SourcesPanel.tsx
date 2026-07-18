import { BookOpenCheck, FileWarning, LockKeyhole, ShieldCheck } from 'lucide-react'

import { baxterCrrtSmeReviewItems, prismaxDeviceProfile } from '../content/deviceProfiles'
import { baxterCrrtPublicationStatus, baxterCrrtReleaseStage } from '../content/release'
import {
  baxterCrrtPilotSourceReferences,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
} from '../content/provenance'
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
          <span className={styles.kicker}>Evidence, provenance &amp; limitations</span>
          <h2 id="baxter-crrt-sources-heading">
            What this educational module can—and cannot—claim
          </h2>
        </div>
        <span className={styles.reviewBadge} data-status={baxterCrrtPublicationStatus}>
          {baxterCrrtPublicationStatus === 'published'
            ? 'PUBLISHED'
            : `${baxterCrrtReleaseStage.toUpperCase()} · PRIVATE`}
        </span>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>
            Device-manual claims, clinical context, and synthetic teaching calibration remain
            visibly separate.
          </strong>
          <p>
            The 18 cases, seven drills, six tools, and capstones are active in this private build.
            Source and reviewer fields are informational provenance for the final SME pass; missing
            review metadata does not disable private functionality. Exact case values, scoring,
            condition bands, coefficients, and critical-error rules are synthetic educational
            calibration—not patient-specific recommendations, clinical targets, verified device
            limits, local operating policy, or proof of competency.
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
          <dd>{prismaxDeviceProfile.marketConfiguration}</dd>
        </div>
        <div>
          <dt>Review state</dt>
          <dd>Final SME feedback open · runtime available</dd>
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
        <span className={styles.kicker}>Clinical context and calibration evidence</span>
        <h3>Clinical context and synthetic calibration</h3>
        <p>
          Context sources support the teaching distinction being explored. They do not validate the
          authored synthetic numbers or define success criteria.
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
          Supporting references not used for device behavior ({inactiveSources.length})
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
              <small>Review {source.reviewStatus} · not used for runtime device behavior</small>
            </article>
          ))}
        </div>
      </details>

      <div className={styles.reviewStatusPanel}>
        <h3>Informational final-SME feedback domains</h3>
        <ul>
          {baxterCrrtSmeReviewItems.map((review) => (
            <li key={review.domain}>
              <span aria-hidden="true">○</span>
              <strong>{review.label}</strong>
              <small>{review.reviewStatus}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
