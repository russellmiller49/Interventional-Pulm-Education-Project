import { BookOpen, FileCheck2, FileWarning, FlaskConical, ShieldCheck } from 'lucide-react'

import {
  getVentilatorDeviceProfile,
  mechanicalVentilationPublicationStatus,
  ventilationEvidence,
  ventilatorDeviceSources,
} from '../content'
import type { VentilatorDeviceId } from '../engine'
import styles from './mechanical-ventilation.module.css'

const sourceLabels = {
  manufacturer: 'Manufacturer source',
  curriculum: 'Supplied curriculum',
  'clinical-reference': 'Casebook clinical source',
  'educational-model': 'Educational model',
} as const

const sourceIcons = {
  manufacturer: ShieldCheck,
  curriculum: BookOpen,
  'clinical-reference': FileCheck2,
  'educational-model': FlaskConical,
} as const

export function SourcesPanel({ deviceId }: { deviceId: VentilatorDeviceId }) {
  const profile = getVentilatorDeviceProfile(deviceId)
  const selectedSources = ventilatorDeviceSources.filter((source) => source.deviceId === deviceId)
  const selectedSourceIds = new Set(selectedSources.map((source) => source.id))
  const supplementalManufacturerEvidence = ventilationEvidence.filter(
    (reference) =>
      reference.deviceId === deviceId &&
      reference.sourceClass === 'manufacturer' &&
      !selectedSourceIds.has(reference.id),
  )
  const supportingEvidence = ventilationEvidence.filter(
    (reference) => reference.sourceClass !== 'manufacturer',
  )
  return (
    <section className={styles.sourcesSection} aria-labelledby="ventilation-sources-heading">
      <div className={styles.sectionTitleRow}>
        <div>
          <span>Evidence boundary & release safety</span>
          <h2 id="ventilation-sources-heading">
            Source-bound profile tied to the supplied {profile.shortName} sources
          </h2>
        </div>
        <span className={styles.draftBadge}>
          {mechanicalVentilationPublicationStatus === 'published'
            ? 'PUBLISHED · REVIEW APPROVED'
            : mechanicalVentilationPublicationStatus === 'tester-preview'
              ? 'UNLISTED · REVIEWER PREVIEW'
              : 'DRAFT · REVIEW REQUIRED'}
        </span>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>Educational simulation—not a clinical device or validated digital twin.</strong>
          <p>
            This original functional facsimile teaches recognition, ventilator reasoning, and
            reassessment. It does not reproduce every device behavior, replace an operator manual,
            prescribe care, or establish procedural readiness. It is not manufactured, sponsored, or
            endorsed by {profile.manufacturer}.
          </p>
        </div>
      </div>

      <dl className={styles.deviceProfile}>
        <div>
          <dt>Selected console</dt>
          <dd>{profile.displayName}</dd>
        </div>
        <div>
          <dt>Source profile</dt>
          <dd>{profile.manualProfile}</dd>
        </div>
        <div>
          <dt>Software / revision</dt>
          <dd>{profile.softwareVersion}</dd>
        </div>
        <div>
          <dt>Simulated modes</dt>
          <dd>
            {profile.modes
              .filter((mode) => mode.availability === 'simulated')
              .map((mode) => mode.label)
              .join(' · ')}
          </dd>
        </div>
        <div>
          <dt>Source-listed only</dt>
          <dd>
            {[
              ...profile.modes
                .filter((mode) => mode.availability !== 'simulated')
                .map((mode) => mode.label),
              ...profile.features
                .filter((feature) => feature.availability !== 'simulated')
                .map((feature) => feature.label),
              ...profile.deferredModes,
            ].join(' · ') || 'None in this profile'}
          </dd>
        </div>
        <div>
          <dt>Patient group</dt>
          <dd>{profile.patientGroup}</dd>
        </div>
        <div>
          <dt>Display basis</dt>
          <dd>{profile.display.displayNote}</dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>
            {mechanicalVentilationPublicationStatus === 'published'
              ? 'Reviewed public release'
              : mechanicalVentilationPublicationStatus === 'tester-preview'
                ? 'Unlisted public tester preview'
                : 'Authenticated draft'}
          </dd>
        </div>
      </dl>

      <div className={styles.evidenceGrid}>
        {selectedSources.map((source) => (
          <article key={source.id}>
            <span>
              <ShieldCheck aria-hidden="true" /> Manufacturer source
            </span>
            <h3>{source.title}</h3>
            <p>{source.citation}</p>
            <p>
              <strong>Revision:</strong> {source.revision} · {source.date}
            </p>
            <p>
              <strong>Relevant pages:</strong> {source.pages}
            </p>
            <p>
              <strong>Used for:</strong> {source.intendedUse}
            </p>
            <p>
              <strong>Source snapshot:</strong> {source.sourceFilename}
              <br />
              <code>SHA-256 {source.sourceSha256}</code>
            </p>
            <p>
              <strong>Boundary:</strong> {source.limitations}
            </p>
          </article>
        ))}
        {supplementalManufacturerEvidence.map((reference) => (
          <article key={reference.id}>
            <span>
              <FileWarning aria-hidden="true" /> Manufacturer source · provenance pending
            </span>
            <h3>{reference.title}</h3>
            <p>{reference.citation}</p>
            {reference.sourceUrl ? (
              <p>
                <a href={reference.sourceUrl} target="_blank" rel="noreferrer">
                  Open manufacturer reference
                </a>
              </p>
            ) : null}
            {reference.pages ? (
              <p>
                <strong>Reviewed sections:</strong> {reference.pages}
              </p>
            ) : null}
            <p>
              <strong>Used for:</strong> {reference.supports.join(' ')}
            </p>
            <p>
              <strong>Boundary:</strong> {reference.limitations}
            </p>
          </article>
        ))}
      </div>

      <details className={styles.supportingSources}>
        <summary>
          Supporting clinical references and model notes ({supportingEvidence.length})
        </summary>
        <div>
          {supportingEvidence.map((reference) => {
            const Icon = sourceIcons[reference.sourceClass]
            return (
              <article key={reference.id}>
                <span>
                  <Icon aria-hidden="true" /> {sourceLabels[reference.sourceClass]}
                </span>
                <h3>{reference.title}</h3>
                <p>{reference.citation}</p>
                <p>
                  <strong>Supports:</strong> {reference.supports.join(' ')}
                </p>
                <p>
                  <strong>Boundary:</strong> {reference.limitations}
                </p>
              </article>
            )
          })}
        </div>
      </details>

      <div className={styles.reviewChecklist}>
        <h3>Required before publication</h3>
        <ul>
          <li>
            <span aria-hidden="true">□</span> Two independent clinicians verify every case, waveform
            signature, accepted path, threshold, and critical-error rule.
          </li>
          <li>
            <span aria-hidden="true">□</span> C6-, Evita-, PB980-, and AVEA-trained reviewers verify
            the core and advanced mode vocabulary, controls, alarms, maneuvers, and documented
            limits.
          </li>
          <li>
            <span aria-hidden="true">□</span> PB980 and AVEA review includes the applicable operator
            manuals; the supplied service/modes guides alone are not treated as complete
            instructions.
          </li>
          <li>
            <span aria-hidden="true">□</span> Adaptive, proportional, and closed-loop responses are
            reviewed as bounded teaching approximations; no reviewer treats them as reproductions of
            proprietary device algorithms.
          </li>
          <li>
            <span aria-hidden="true">□</span> Adult-only cases exclude TCPL and Volume Guarantee
            until a separately reviewed neonatal lung-model pathway exists.
          </li>
          <li>
            <span aria-hidden="true">□</span> Accessibility review covers keyboard operation, text
            alarm severity, waveform equivalents, reduced motion, zoom, and responsive reflow.
          </li>
          <li>
            <span aria-hidden="true">□</span> Clinical translations receive independent review
            before the reviewed-English fallback is removed.
          </li>
          <li>
            <span aria-hidden="true">□</span> Faculty confirms high-risk actions remain
            recognition-and-priority exercises tied to local supervised protocols.
          </li>
        </ul>
      </div>
    </section>
  )
}
