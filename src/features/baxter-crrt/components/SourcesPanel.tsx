import { BookOpenCheck, FileWarning, LockKeyhole, ShieldCheck } from 'lucide-react'

import { baxterCrrtSmeReviewItems, prismaxDeviceProfile } from '../content/deviceProfiles'
import { baxterCrrtPublicationStatus, baxterCrrtReleaseStage } from '../content/release'
import {
  baxterCrrtPilotSourceReferences,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
} from '../content/provenance'
import styles from './baxter-crrt.module.css'

interface SourcesPanelProps {
  readonly reviewPreview?: boolean
}

function learnerEvidenceText(value: string): string {
  return value
    .replace('draft educational profile', 'educational profile')
    .replace('synthetic educational engine signals', 'simulated case values')
    .replace(
      'CRRT-04 connects a synthetic model after the gated sequence',
      'CRRT-04 begins a simulated case after setup and prescription review',
    )
    .replace('deferred Prismaflex adapter', 'Prismaflex presentation')
    .replace('Generic engine alerts', 'Generic training alerts')
    .replace('the shared adapter', 'a device-specific case view')
    .replace('by the adapter', 'in this exercise')
    .replace('The adapter does not invent', 'This exercise does not infer')
    .replace('an unmapped engine alarm', 'a generic training alert')
    .replace('synthetic case', 'simulated case')
    .replace('simulator recommendation', 'treatment recommendation')
    .replace('Directional model context only', 'Pressure-direction context only')
}

export function SourcesPanel({ reviewPreview = false }: SourcesPanelProps) {
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
          <span className={styles.kicker}>Evidence &amp; limitations</span>
          <h2 id="baxter-crrt-sources-heading">What supports this educational module</h2>
        </div>
        {reviewPreview ? (
          <span className={styles.reviewBadge} data-status={baxterCrrtPublicationStatus}>
            {baxterCrrtPublicationStatus === 'published'
              ? 'PUBLISHED'
              : `${baxterCrrtReleaseStage.toUpperCase()} · SME PREVIEW`}
          </span>
        ) : null}
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>
            Device-manual facts, clinical evidence, and simulated case values serve different
            purposes.
          </strong>
          <p>
            Device details come from the referenced manuals, and clinical concepts come from the
            cited literature and guidance. Patient values, responses, scores, and safety flags are
            simulated for practice; they are not treatment recommendations, verified device limits,
            local policy, or proof of competency.
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
          <dt>Educational scope</dt>
          <dd>Adult ICU CRRT concepts and device-interface practice</dd>
        </div>
      </dl>

      <details className={styles.inactiveSources} open={reviewPreview || undefined}>
        <summary>
          <BookOpenCheck aria-hidden="true" /> Detailed evidence and source records
        </summary>
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
              <p>{reviewPreview ? record.claim : learnerEvidenceText(record.claim)}</p>
              <p className={styles.sourceLimitation}>
                <strong>Boundary:</strong>{' '}
                {reviewPreview ? record.limitation : learnerEvidenceText(record.limitation)}
              </p>
              {reviewPreview ? (
                <small>
                  Record {record.id} · review {record.reviewStatus}
                </small>
              ) : null}
            </article>
          ))}
        </div>

        <div className={styles.sourceSubheading}>
          <span className={styles.kicker}>Clinical context and case-value evidence</span>
          <h3>Clinical context and simulated case values</h3>
          <p>
            Context sources support the clinical concepts being taught. They do not turn the
            simulated values into treatment thresholds or define success for a real patient.
          </p>
        </div>

        <div className={styles.sourceClaimGrid}>
          {pilotContextSources.map((source) => (
            <article key={source.id} className={styles.sourceClaim}>
              <span>
                <ShieldCheck aria-hidden="true" />{' '}
                {source.sourceType === 'synthetic-calibration'
                  ? 'simulated case values'
                  : source.sourceType.replaceAll('-', ' ')}
              </span>
              <h3>
                {!reviewPreview && source.sourceType === 'synthetic-calibration'
                  ? 'Simulated case values'
                  : source.sourceTitle}
              </h3>
              <p className={styles.sourceIdentity}>{source.documentVersion}</p>
              <p>
                <strong>Relevant section:</strong>{' '}
                {!reviewPreview && source.sourceType === 'synthetic-calibration'
                  ? `${source.id.replace('SYNTH-', '')} educational case values`
                  : source.pageOrSection}
              </p>
              <p>
                {!reviewPreview && source.sourceType === 'synthetic-calibration'
                  ? 'Provides the simulated patient values, treatment settings, timing, and responses used in this exercise.'
                  : reviewPreview
                    ? source.claim
                    : learnerEvidenceText(source.claim)}
              </p>
              <p className={styles.sourceLimitation}>
                <strong>Boundary:</strong>{' '}
                {!reviewPreview && source.sourceType === 'synthetic-calibration'
                  ? 'These values are for education and are not clinical targets, alarm limits, device limits, or patient-specific recommendations.'
                  : reviewPreview
                    ? source.value
                    : learnerEvidenceText(String(source.value ?? 'Not specified.'))}
              </p>
              {reviewPreview ? (
                <small>
                  Record {source.id} · review {source.reviewStatus} ·{' '}
                  {source.implementationLocation}
                </small>
              ) : null}
            </article>
          ))}
        </div>
      </details>

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

      {reviewPreview ? (
        <div className={styles.reviewStatusPanel}>
          <h3>Final-SME feedback domains</h3>
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
      ) : null}
    </section>
  )
}
