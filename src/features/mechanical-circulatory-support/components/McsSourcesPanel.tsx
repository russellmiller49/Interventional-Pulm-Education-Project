'use client'

import { ExternalLink } from 'lucide-react'

import { mcsDeviceProfiles, mcsSources } from '../content'
import styles from './mechanical-circulatory-support.module.css'

export function McsSourcesPanel() {
  const safetyNotices = mcsSources.filter((source) => source.sourceType === 'fda-safety-notice')

  return (
    <section className={styles.sourcesSection} aria-labelledby="mcs-sources-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>EVIDENCE & MODEL CARD</span>
        <h2 id="mcs-sources-heading">Source-backed, bounded, and revision-aware</h2>
        <p>
          Clinical concepts are linked to the supplied reference, society guidelines, current FDA
          labeling, and manufacturer update material. Directional outputs are educational estimates.
        </p>
      </div>
      <aside className={styles.safetyReview} aria-label="Current FDA safety-review flags">
        <strong>Current safety-review flags</strong>
        <p>
          This preview records {safetyNotices.length} relevant FDA device notices found during the
          July 19, 2026 review. They do not replace affected-unit checks, current instructions, or a
          new recall sweep at content freeze and immediately before publication.
        </p>
        <ul>
          {safetyNotices.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title} <ExternalLink aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div className={styles.profileGrid}>
        {mcsDeviceProfiles.map((profile) => (
          <article key={profile.id}>
            <span>{profile.category}</span>
            <h3>{profile.displayName}</h3>
            <p>{profile.mechanism}</p>
            <dl>
              <div>
                <dt>Scope</dt>
                <dd>{profile.controlSummary}</dd>
              </div>
              <div>
                <dt>Labeling anchor</dt>
                <dd>{profile.labelingRevision}</dd>
              </div>
              <div>
                <dt>Reviewed</dt>
                <dd>{profile.reviewedAt}</dd>
              </div>
            </dl>
            <ul>
              {profile.modelLimitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <details>
              <summary>Control bounds and alarm model</summary>
              <p>
                <strong>Controls:</strong>{' '}
                {profile.controlBounds
                  .map(
                    (bound) =>
                      `${bound.label}${bound.minimum !== undefined ? ` ${bound.minimum}–${bound.maximum} ${bound.unit ?? ''}` : ''}`,
                  )
                  .join(' · ')}
              </p>
              <p>
                <strong>Alarm patterns:</strong>{' '}
                {profile.alarmDefinitions.map((alarm) => alarm.label).join(' · ')}
              </p>
            </details>
          </article>
        ))}
      </div>
      <details className={styles.sourceDetails}>
        <summary>Open citations and intended use</summary>
        <div className={styles.sourceList}>
          {mcsSources.map((source) => (
            <article key={source.id}>
              <span>
                {source.sourceType.replaceAll('-', ' ')} · {source.year}
              </span>
              <h3>{source.title}</h3>
              <p>{source.citation}</p>
              <p>
                <strong>Used for:</strong> {source.intendedUse}
              </p>
              {source.limitation ? (
                <p>
                  <strong>Boundary:</strong> {source.limitation}
                </p>
              ) : null}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  Open source <ExternalLink aria-hidden="true" />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </details>
    </section>
  )
}
