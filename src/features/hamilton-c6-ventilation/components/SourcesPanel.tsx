import { BookOpen, FileCheck2, FileWarning, FlaskConical, ShieldCheck } from 'lucide-react'

import {
  hamiltonC6DeviceProfile,
  hamiltonC6PublicationStatus,
  ventilationEvidence,
} from '../content'
import styles from './hamilton-c6-ventilation.module.css'

const sourceLabels = {
  manufacturer: 'Manufacturer manual',
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

export function SourcesPanel() {
  const primaryEvidence = ventilationEvidence.slice(0, 2)
  const supportingEvidence = ventilationEvidence.slice(2)
  return (
    <section className={styles.sourcesSection} aria-labelledby="ventilation-sources-heading">
      <div className={styles.sectionTitleRow}>
        <div>
          <span>Evidence boundary & release safety</span>
          <h2 id="ventilation-sources-heading">Draft profile locked to the supplied C6 manual</h2>
        </div>
        <span className={styles.draftBadge}>
          {hamiltonC6PublicationStatus === 'published'
            ? 'PUBLISHED · REVIEW APPROVED'
            : 'DRAFT · REVIEW REQUIRED'}
        </span>
      </div>

      <div className={styles.scopeBoundary}>
        <FileWarning aria-hidden="true" />
        <div>
          <strong>Educational simulation—not a clinical device or validated digital twin.</strong>
          <p>
            This original functional facsimile teaches recognition, ventilator reasoning, and
            reassessment. It does not reproduce every C6 behavior, replace the operator’s manual,
            prescribe care, or verify procedural competency. It is not manufactured, sponsored, or
            endorsed by Hamilton Medical.
          </p>
        </div>
      </div>

      <dl className={styles.deviceProfile}>
        <div>
          <dt>Device vocabulary</dt>
          <dd>{hamiltonC6DeviceProfile.displayName}</dd>
        </div>
        <div>
          <dt>Manual profile</dt>
          <dd>{hamiltonC6DeviceProfile.manualNumber}</dd>
        </div>
        <div>
          <dt>Software</dt>
          <dd>{hamiltonC6DeviceProfile.softwareVersion}</dd>
        </div>
        <div>
          <dt>Simulated modes</dt>
          <dd>(S)CMV · PCV+ · SPONT</dd>
        </div>
        <div>
          <dt>Patient group</dt>
          <dd>{hamiltonC6DeviceProfile.patientGroup}</dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>Authenticated draft</dd>
        </div>
      </dl>

      <div className={styles.evidenceGrid}>
        {primaryEvidence.map((reference) => {
          const Icon = sourceIcons[reference.sourceClass]
          return (
            <article key={reference.id}>
              <span>
                <Icon aria-hidden="true" /> {sourceLabels[reference.sourceClass]}
              </span>
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
              <p>
                <strong>Boundary:</strong> {reference.limitations}
              </p>
            </article>
          )
        })}
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
            <span aria-hidden="true">□</span> A C6-trained device reviewer verifies mode vocabulary,
            controls, alarm/message behavior, and operational boundaries against manual 10197564/00.
          </li>
          <li>
            <span aria-hidden="true">□</span> Accessibility review covers keyboard operation, text
            alarm severity, waveform text equivalents, reduced motion, zoom, and responsive reflow.
          </li>
          <li>
            <span aria-hidden="true">□</span> Clinical translations receive independent review
            before English fallback is removed from non-English routes.
          </li>
          <li>
            <span aria-hidden="true">□</span> Faculty confirms high-risk actions remain
            non-procedural and point to local supervised protocols.
          </li>
        </ul>
      </div>
    </section>
  )
}
