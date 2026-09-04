import { BookOpen, ExternalLink, FileWarning, FlaskConical, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  cardiohelpDeviceProfile,
  type CardiohelpEcmoPublicationStatus,
} from '../content/deviceProfile'
import {
  ecmoEvidenceIdsBySourceClass,
  ecmoSourceClassLabels,
  ecmoSourceClasses,
  type EcmoSourceClass,
} from '../content/evidenceResolver'
import styles from './cardiohelp-ecmo.module.css'
import { EcmoSourceList } from './evidence/EcmoSourceList'
import evidenceStyles from './evidence/evidence.module.css'

/**
 * The hub's evidence boundary: the device profile, the registry grouped by source class, and the
 * reviewer checklist.
 *
 * The registry is rendered through the shared source list rather than a card grid of its own, so
 * the title, badge, claim scope, link and copy control here are the same ones a learner meets beside
 * a circuit-walk stop or a localization row. Grouping by source class keeps the boundary the panel's
 * introduction draws — manual versus curriculum versus simplified model — visible in the structure
 * and not only in the badges.
 */

const sourceIcons: Readonly<Record<EcmoSourceClass, LucideIcon>> = {
  manufacturer: ShieldCheck,
  'clinical-guidance': ExternalLink,
  textbook: BookOpen,
  'educational-model': FlaskConical,
}

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
            {published ? 'Reviewed release' : 'Unlisted draft; clinical and device review pending'}
          </dd>
        </div>
      </dl>

      {ecmoSourceClasses.map((sourceClass) => {
        const Icon = sourceIcons[sourceClass]
        const headingId = `sources-${sourceClass}`
        return (
          <section
            key={sourceClass}
            className={evidenceStyles.group}
            aria-labelledby={headingId}
            data-source-class={sourceClass}
          >
            <h3 id={headingId} className={evidenceStyles.groupHeading}>
              <Icon aria-hidden="true" /> {ecmoSourceClassLabels[sourceClass]}
            </h3>
            <EcmoSourceList
              evidenceIds={ecmoEvidenceIdsBySourceClass(sourceClass)}
              labelledBy={headingId}
              surface="shell"
            />
          </section>
        )
      })}

      <details className={styles.reviewChecklist}>
        <summary className={evidenceStyles.checklistSummary}>
          <h3>Publication checklist</h3>
        </summary>
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
      </details>
    </section>
  )
}
