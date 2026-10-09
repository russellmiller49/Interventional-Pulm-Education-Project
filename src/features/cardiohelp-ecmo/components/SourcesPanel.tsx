import {
  BookOpen,
  ExternalLink,
  FileText,
  FileWarning,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react'
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
import { ECMO_NUMBER_ONLY_SOURCES } from '../content/teachingNumbers'
import styles from './cardiohelp-ecmo.module.css'
import { EcmoSourceList } from './evidence/EcmoSourceList'
import {
  EcmoAnticoagulationReference,
  EcmoCircuitPressureReference,
  EcmoStartingSupportReference,
  EcmoVenousCellReference,
} from './teaching/EcmoReferenceValues'
import evidenceStyles from './evidence/evidence.module.css'

/**
 * The hub's sources: the device profile, the numbers the module teaches, and the registry grouped
 * by source class, rendered through the shared source list.
 */

const sourceIcons: Readonly<Record<EcmoSourceClass, LucideIcon>> = {
  manufacturer: ShieldCheck,
  'clinical-guidance': ExternalLink,
  textbook: BookOpen,
  'supplied-curriculum': FileText,
  'educational-model': FlaskConical,
}

export function SourcesPanel({
  publicationStatus,
}: {
  publicationStatus?: CardiohelpEcmoPublicationStatus
}) {
  return (
    <section
      className={styles.sourcesSection}
      aria-labelledby="sources-heading"
      data-publication-status={publicationStatus}
    >
      <div className={styles.sectionTitleRow}>
        <div>
          <span className={styles.kicker}>Sources</span>
          <h2 id="sources-heading">Sources and reference values</h2>
        </div>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>The device manual and ECMO curriculum answer different questions.</strong>
          <p>
            Console behavior follows the U.S. IFU, revision {cardiohelpDeviceProfile.ifuRevision},
            issued {cardiohelpDeviceProfile.ifuDate}. Its labeled indication is partial
            cardiopulmonary bypass or temporary surgical circulatory bypass for less than six hours,
            not prolonged ECMO. Adult VV and peripheral VA physiology and management come from
            textbook chapters and mode-specific ELSO guidance.
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
          <dt>Support modes</dt>
          <dd>Adult VV + peripheral femoral VA</dd>
        </div>
      </dl>

      <h3 className="mt-3 text-sm font-semibold">Reference values</h3>
      <EcmoCircuitPressureReference />
      <EcmoStartingSupportReference />
      <EcmoAnticoagulationReference />
      <EcmoVenousCellReference />
      <section className="mt-3 text-xs leading-5" data-number-sources>
        <h3 className="text-xs font-semibold">Textbooks cited for the reference values</h3>
        <ul className="mt-1 list-disc pl-5">
          {ECMO_NUMBER_ONLY_SOURCES.map((source) => (
            <li key={source.id}>{source.title}</li>
          ))}
        </ul>
      </section>

      <details className={styles.reviewChecklist} data-source-registry>
        <summary className={evidenceStyles.checklistSummary}>
          <h3>Source registry and provenance</h3>
        </summary>
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
      </details>
    </section>
  )
}
