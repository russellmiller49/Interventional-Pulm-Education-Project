'use client'

import { ExternalLink } from 'lucide-react'

import { mcsDeviceProfiles, mcsSources } from '../content'
import { MCS_CLAIM_SOURCE_MAP } from '../content/claimSourceMap'
import {
  MCS_SOURCE_CLASS_LABELS,
  MCS_SOURCE_CLASS_MEANING,
  MCS_SOURCE_CLASS_ORDER,
  mcsSourceClass,
  mcsSourceIdsByClass,
  mcsSourceVerificationLabel,
} from '../content/sourceClasses'
import { McsClaimSourceChecks } from './McsClaimSourceChecks'
import styles from './mechanical-circulatory-support.module.css'

export function McsSourcesPanel() {
  const safetyNotices = mcsSources.filter((source) => source.sourceType === 'fda-safety-notice')

  return (
    <section className={styles.sourcesSection} aria-labelledby="mcs-sources-heading">
      <div className={styles.sectionHeading}>
        <span className={styles.kicker}>EVIDENCE & MODEL CARD</span>
        <h2 id="mcs-sources-heading">Source-backed, bounded, and revision-aware</h2>
        <p>
          Sources are listed by kind. Society guidelines, instructions for use and regulator records
          are primary sources; textbook chapters and manufacturer teaching material are secondary;
          two supplied Word syntheses are authoring provenance, kept on record as the documents this
          module was drafted from and not as evidence for it. Whether a labeling record is the
          current revision for a local device has not been verified here. Directional outputs are
          educational estimates.
        </p>
        <dl data-source-class-key>
          {MCS_SOURCE_CLASS_ORDER.map((sourceClass) => (
            <div key={sourceClass} data-source-class={sourceClass}>
              <dt>{MCS_SOURCE_CLASS_LABELS[sourceClass]}</dt>
              <dd>{MCS_SOURCE_CLASS_MEANING[sourceClass]}</dd>
            </div>
          ))}
        </dl>
        <McsClaimSourceChecks claims={MCS_CLAIM_SOURCE_MAP} context="this module" />
      </div>
      <aside className={styles.safetyReview} aria-label="Registered FDA notice records">
        <strong>Registered safety-notice references</strong>
        <p>
          The source registry lists {safetyNotices.length} FDA notice records. These records were
          not opened for this module; current recall status, affected units and labeling have not
          been verified. They do not replace current device instructions or an authoritative recall
          check before publication.
        </p>
        <ul>
          {safetyNotices.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title} <ExternalLink aria-hidden="true" />
              </a>{' '}
              <small>{mcsSourceVerificationLabel(source.id)}.</small>
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
                <dt>Historical registry date</dt>
                <dd>
                  {profile.reviewedAt}; this date does not verify current labeling;{' '}
                  {'no clinical review is recorded'}
                </dd>
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
          {mcsSourceIdsByClass(mcsSources.map((source) => source.id))
            .map((id) => mcsSources.find((source) => source.id === id)!)
            .map((source) => (
              <article key={source.id} data-source-class={mcsSourceClass(source.id)}>
                <span>
                  {MCS_SOURCE_CLASS_LABELS[mcsSourceClass(source.id)]} ·{' '}
                  {source.sourceType.replaceAll('-', ' ')} · {source.year ?? 'date not stated'}
                </span>
                <small data-source-verification>{mcsSourceVerificationLabel(source.id)}.</small>
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
