import { BookOpen, FileCheck2, FileWarning, FlaskConical, ShieldCheck } from 'lucide-react'

import {
  getVentilatorDeviceProfile,
  ventilationEvidence,
  ventilationSourceClassLabel,
  ventilatorDeviceSources,
} from '../content'
import type { VentilatorDeviceId } from '../engine'
import styles from './mechanical-ventilation.module.css'

const sourceIcons = {
  guideline: FileCheck2,
  manufacturer: ShieldCheck,
  curriculum: BookOpen,
  'clinical-reference': FileCheck2,
  'educational-model': FlaskConical,
  'supplied-transcripts': FileWarning,
  'modeling-preprint': FlaskConical,
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
          <span>Sources</span>
          <h2 id="ventilation-sources-heading">
            Where the {profile.shortName} console and the teaching come from
          </h2>
        </div>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>A teaching simulator, not a clinical device.</strong>
          <p>
            It teaches recognition, ventilator reasoning and reassessment. It does not reproduce
            every behavior of the {profile.shortName} and is not made or endorsed by{' '}
            {profile.manufacturer}.
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
              <strong>Scope:</strong> {source.limitations}
            </p>
          </article>
        ))}
        {supplementalManufacturerEvidence.map((reference) => (
          <article key={reference.id}>
            <span>
              <FileWarning aria-hidden="true" /> Manufacturer source
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
              <strong>Scope:</strong> {reference.limitations}
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
                  <Icon aria-hidden="true" /> {ventilationSourceClassLabel[reference.sourceClass]}
                </span>
                <h3>{reference.title}</h3>
                <p>{reference.citation}</p>
                <p>
                  <strong>Supports:</strong> {reference.supports.join(' ')}
                </p>
                <p>
                  <strong>Scope:</strong> {reference.limitations}
                </p>
              </article>
            )
          })}
        </div>
      </details>
    </section>
  )
}
