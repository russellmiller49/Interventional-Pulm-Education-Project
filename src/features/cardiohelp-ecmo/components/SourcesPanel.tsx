import { BookOpen, ExternalLink, FileWarning, FlaskConical, ShieldCheck } from 'lucide-react'

import {
  cardiohelpDeviceProfile,
  type CardiohelpEcmoPublicationStatus,
} from '../content/deviceProfile'
import { cardiohelpEvidence } from '../content/evidence'
import styles from './cardiohelp-ecmo.module.css'

const sourceLabels = {
  manufacturer: 'Manufacturer behavior',
  'clinical-guidance': 'ECMO clinical guidance',
  textbook: 'Textbook teaching',
  'educational-model': 'Simplified educational model',
} as const

const sourceIcons = {
  manufacturer: ShieldCheck,
  'clinical-guidance': ExternalLink,
  textbook: BookOpen,
  'educational-model': FlaskConical,
} as const

export function SourcesPanel({
  publicationStatus,
}: {
  publicationStatus: CardiohelpEcmoPublicationStatus
}) {
  const published = publicationStatus === 'published'
  return (
    <section className={styles.sourcesSection} aria-labelledby="sources-heading">
      <div className={styles.sectionTitleRow}>
        <div>
          <span className={styles.kicker}>Clinical review & source notes</span>
          <h2 id="sources-heading">Evidence boundary and review status</h2>
        </div>
        <span className={styles.draftBadge}>
          {published ? 'PUBLISHED · REVIEW APPROVED' : 'UNLISTED REVIEW · REVIEW REQUIRED'}
        </span>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>The device manual and ECMO curriculum answer different questions.</strong>
          <p>
            The current U.S. IFU governs this facsimile’s console behavior. Its labeled indication
            is partial cardiopulmonary bypass or temporary surgical circulatory bypass for less than
            six hours—not prolonged ECMO management. Adult VV and peripheral VA physiology and
            management reasoning come from the supplied textbook chapters and mode-specific ELSO
            guidance. Every response curve is labeled simulated and is not a patient digital twin.
          </p>
        </div>
      </div>

      <dl className={styles.deviceProfile}>
        <div>
          <dt>Target</dt>
          <dd>{cardiohelpDeviceProfile.displayName}</dd>
        </div>
        <div>
          <dt>U.S. IFU</dt>
          <dd>
            Revision {cardiohelpDeviceProfile.ifuRevision} · {cardiohelpDeviceProfile.ifuDate}
          </dd>
        </div>
        <div>
          <dt>Software</dt>
          <dd>≥ {cardiohelpDeviceProfile.minimumSoftwareVersion}</dd>
        </div>
        <div>
          <dt>thApp</dt>
          <dd>{cardiohelpDeviceProfile.thApp}</dd>
        </div>
        <div>
          <dt>Draft support modes</dt>
          <dd>Adult VV + peripheral femoral VA</dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>
            {published ? 'Reviewed release' : 'Unlisted draft; clinical + device review pending'}
          </dd>
        </div>
      </dl>

      <div className={styles.evidenceGrid}>
        {cardiohelpEvidence.map((reference) => {
          const Icon = sourceIcons[reference.sourceClass]
          return (
            <article
              key={reference.id}
              className={styles.evidenceCard}
              data-source-class={reference.sourceClass}
            >
              <div className={styles.evidenceType}>
                <Icon aria-hidden="true" /> {sourceLabels[reference.sourceClass]}
              </div>
              <h3>{reference.title}</h3>
              <p>{reference.citation}</p>
              {reference.pages ? (
                <p>
                  <strong>Relevant pages:</strong> {reference.pages}
                </p>
              ) : null}
              <ul>
                {reference.supports.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className={styles.evidenceLimitation}>
                <strong>Boundary:</strong> {reference.limitations}
              </p>
              {reference.url ? (
                <a href={reference.url} target="_blank" rel="noreferrer">
                  Open source <ExternalLink aria-hidden="true" />
                </a>
              ) : null}
            </article>
          )
        })}
      </div>

      <div className={styles.reviewChecklist}>
        <h3>Publication checklist</h3>
        <ul>
          <li>
            <span aria-hidden="true">□</span> CARDIOHELP-trained reviewer verifies screen labels,
            workflows, interventions, and target software behavior.
          </li>
          <li>
            <span aria-hidden="true">□</span> Adult ECMO clinician verifies VV and peripheral VA
            scenarios, response direction, debriefs, and safety-critical errors.
          </li>
          <li>
            <span aria-hidden="true">□</span> VA reviewer verifies right-arm monitoring,
            mixed-circulation, LV-loading, and cannulated-limb boundaries without implying a
            universal intervention.
          </li>
          <li>
            <span aria-hidden="true">□</span> Local faculty maps emergency recognition exercises to
            hands-on supervised performance and local escalation policy.
          </li>
          <li>
            <span aria-hidden="true">□</span> Spanish and Simplified Chinese clinical translations
            receive separate review before the English fallback is removed.
          </li>
        </ul>
      </div>
    </section>
  )
}
