import { ArrowLeftRight, CircleAlert, LockKeyhole } from 'lucide-react'

import { baxterCrrtCrossDeviceTransferManifest } from '../content/crossDeviceTransfer'
import styles from './crrt-cross-device-transfer-review.module.css'

export function CrrtCrossDeviceTransferReview() {
  const manifest = baxterCrrtCrossDeviceTransferManifest

  return (
    <section
      className={styles.shell}
      aria-labelledby="baxter-crrt-cross-device-transfer-heading"
      data-reviewer-only="true"
      data-learner-runtime="disabled"
      data-scoring="none"
      data-progress-write="none"
      data-analytics="none"
      data-competency="none"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Phase 8 composition plan · pending review</span>
          <h3 id="baxter-crrt-cross-device-transfer-heading">
            <ArrowLeftRight aria-hidden="true" /> Cross-device transfer
          </h3>
          <p>
            This reviewer artifact separates shared clinical goals from device-specific navigation,
            displays, and alarm language. It is not a runnable or scored capstone.
          </p>
        </div>
        <span className={styles.lockedBadge}>
          <LockKeyhole aria-hidden="true" /> Learner runtime locked
        </span>
      </header>

      <div className={styles.boundary} role="note">
        <CircleAlert aria-hidden="true" />
        <p>
          <strong>No equivalence claim is available.</strong> The canonical comparison protocol,
          tolerance, exact Prismaflex configuration, and both device-review dispositions are still
          pending. Similar concepts must not be treated as identical controls or device behavior.
        </p>
      </div>

      <div className={styles.domainList}>
        {manifest.domains.map((domain, index) => {
          const headingId = `baxter-crrt-transfer-domain-${domain.id}`
          return (
            <article key={domain.id} className={styles.domainCard} aria-labelledby={headingId}>
              <div className={styles.domainHeading}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h4 id={headingId}>{domain.label}</h4>
              </div>
              <p className={styles.sharedConcept}>
                <strong>Shared clinical goal</strong>
                {domain.sharedClinicalConcept}
              </p>
              <div className={styles.deviceQuestions}>
                <section aria-label={`PrisMax question for ${domain.label}`}>
                  <span>PrisMax</span>
                  <p>{domain.prismaxDeviceSpecificQuestion}</p>
                </section>
                <section aria-label={`Prismaflex question for ${domain.label}`}>
                  <span>Prismaflex</span>
                  <p>{domain.prismaflexDeviceSpecificQuestion}</p>
                </section>
              </div>
              <p className={styles.equivalenceBoundary}>
                <strong>Boundary</strong>
                {domain.equivalenceBoundary}
              </p>
              <p className={styles.sources}>
                Pending source records: {domain.sourceRecordIds.join(', ')}
              </p>
            </article>
          )
        })}
      </div>

      <section className={styles.prerequisites} aria-labelledby="transfer-prerequisites-heading">
        <h4 id="transfer-prerequisites-heading">Required before a transfer capstone can run</h4>
        <ul>
          {manifest.prerequisites.map((prerequisite) => (
            <li key={prerequisite.id}>
              <LockKeyhole aria-hidden="true" />
              <span>{prerequisite.label}</span>
              <strong>Pending</strong>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
