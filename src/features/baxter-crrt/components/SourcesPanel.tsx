import { BookOpenCheck, FileWarning, LockKeyhole, ShieldCheck } from 'lucide-react'

import { prismaxDeviceProfile } from '../content/deviceProfiles'
import {
  baxterCrrtPilotSourceReferences,
  baxterCrrtSourceDocuments,
  baxterCrrtSourceRecords,
} from '../content/provenance'
import styles from './baxter-crrt.module.css'

function learnerEvidenceText(value: string): string {
  return value
    .replace('draft educational profile', 'educational profile')
    .replace('synthetic educational engine signals', 'simulated case values')
    .replace(
      'CRRT-04 connects a synthetic model after the gated sequence',
      'CRRT-04 begins a simulated case after setup and prescription review',
    )
    .replace('deferred Prismaflex adapter', 'archived prior-platform reference')
    .replace('Generic engine alerts', 'Generic training alerts')
    .replace('the shared adapter', 'a device-specific case view')
    .replace('by the adapter', 'in this exercise')
    .replace('The adapter does not invent', 'This exercise does not infer')
    .replace('an unmapped engine alarm', 'a generic training alert')
    .replace('synthetic case', 'simulated case')
    .replace('simulator recommendation', 'treatment recommendation')
    .replace('Directional model context only', 'Pressure-direction context only')
}

export function SourcesPanel() {
  const primarySource = baxterCrrtSourceDocuments.find((source) => source.role === 'primary')
  const supportingSources = baxterCrrtSourceDocuments.filter((source) => source.role !== 'primary')
  const contextSources = baxterCrrtPilotSourceReferences.filter(
    (source) =>
      source.sourceType === 'peer-reviewed' || source.sourceType === 'synthetic-calibration',
  )

  if (!primarySource) throw new Error('Baxter CRRT primary source is not configured.')

  return (
    <section className={styles.sourcesSection} aria-labelledby="baxter-crrt-sources-heading">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>Evidence &amp; limitations</span>
          <h2 id="baxter-crrt-sources-heading">What supports this educational module</h2>
        </div>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>
            Device-manual facts, clinical evidence, and simulated case values serve different
            purposes.
          </strong>
          <p>
            Device details come from the referenced PrisMax manual, and clinical concepts come from
            cited literature and guidance. Simulated values and responses are not treatment
            recommendations, verified device limits, local policy, or proof of clinical readiness.
          </p>
        </div>
      </div>

      <dl className={styles.sourceProfile}>
        <div>
          <dt>Evidence class</dt>
          <dd>Device manual + clinical context</dd>
        </div>
        <div>
          <dt>Primary device source</dt>
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
          <dd>Adult ICU CRRT concepts and PrisMax interface practice</dd>
        </div>
      </dl>

      <details className={styles.inactiveSources}>
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
              <p>{learnerEvidenceText(record.claim)}</p>
              <p className={styles.sourceLimitation}>
                <strong>Boundary:</strong> {learnerEvidenceText(record.limitation)}
              </p>
            </article>
          ))}
        </div>

        <div className={styles.sourceSubheading}>
          <span className={styles.kicker}>Clinical context and case-value evidence</span>
          <h3>Clinical context and simulated case values</h3>
          <p>
            Context sources support the concepts being taught. They do not turn simulated values
            into treatment thresholds or define success for a real patient.
          </p>
        </div>

        <div className={styles.sourceClaimGrid}>
          {contextSources.map((source) => {
            const synthetic = source.sourceType === 'synthetic-calibration'
            return (
              <article key={source.id} className={styles.sourceClaim}>
                <span>
                  <ShieldCheck aria-hidden="true" />
                  {synthetic ? 'simulated case values' : source.sourceType.replaceAll('-', ' ')}
                </span>
                <h3>{synthetic ? 'Simulated case values' : source.sourceTitle}</h3>
                <p className={styles.sourceIdentity}>{source.documentVersion}</p>
                <p>
                  <strong>Relevant section:</strong>{' '}
                  {synthetic
                    ? `${source.id.replace('SYNTH-', '')} educational case values`
                    : source.pageOrSection}
                </p>
                <p>
                  {synthetic
                    ? 'Provides the simulated patient values, treatment settings, timing, and responses used in this exercise.'
                    : learnerEvidenceText(source.claim)}
                </p>
                <p className={styles.sourceLimitation}>
                  <strong>Boundary:</strong>{' '}
                  {synthetic
                    ? 'These values are for education and are not clinical targets, alarm limits, device limits, or patient-specific recommendations.'
                    : learnerEvidenceText(String(source.value ?? 'Not specified.'))}
                </p>
              </article>
            )
          })}
        </div>
      </details>

      <details className={styles.inactiveSources}>
        <summary>
          <BookOpenCheck aria-hidden="true" /> Supporting references not used for PrisMax runtime
          behavior ({supportingSources.length})
        </summary>
        <div>
          {supportingSources.map((source) => (
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
            </article>
          ))}
        </div>
      </details>
    </section>
  )
}
