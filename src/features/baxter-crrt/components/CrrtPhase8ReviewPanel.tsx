import { ArrowLeftRight, ChevronRight, FileWarning, LockKeyhole, PanelsTopLeft } from 'lucide-react'

import { baxterCrrtCrossDeviceTransferManifest } from '../content/crossDeviceTransfer'
import { prismaflexReviewCandidateDeviceProfile } from '../content/deviceProfiles'
import { CrrtCrossDeviceTransferReview } from './CrrtCrossDeviceTransferReview'
import { PrismaflexReviewerConsole } from './PrismaflexReviewerConsole'
import styles from './crrt-phase8-review-panel.module.css'

export function CrrtPhase8ReviewPanel() {
  return (
    <section
      className={styles.section}
      aria-labelledby="baxter-crrt-phase8-heading"
      data-reviewer-only="true"
      data-phase8-runtime="disabled"
      data-analytics="none"
      data-progress-write="none"
      data-scoring="none"
      data-competency="none"
    >
      <header className={styles.header}>
        <div>
          <span>Phase 8 development registry</span>
          <h2 id="baxter-crrt-phase8-heading">Prismaflex adapter—source-mapped, not activated</h2>
          <p>
            A separate reviewer profile, calculation adapter, setup map, alarm vocabulary, softkey
            console, and cross-device transfer plan are available for inspection only.
          </p>
        </div>
        <strong>
          <LockKeyhole aria-hidden="true" /> Learner runtime locked
        </strong>
      </header>

      <div className={styles.boundary} role="note">
        <FileWarning aria-hidden="true" />
        <p>
          <strong>Phase 8 activation prerequisites are not satisfied.</strong> The full reviewed
          PrisMax v1 is not frozen, the target Prismaflex configuration is unknown, no
          Prismaflex-trained reviewer disposition is recorded, and no equivalence tolerance is
          approved. These artifacts cannot be used as device training or competency evidence.
        </p>
      </div>

      <dl className={styles.metrics}>
        <div>
          <dt>Device profile</dt>
          <dd>{prismaflexReviewCandidateDeviceProfile.profileVersion}</dd>
        </div>
        <div>
          <dt>Source records</dt>
          <dd>{prismaflexReviewCandidateDeviceProfile.sourceRecordIds.length} pending</dd>
        </div>
        <div>
          <dt>Enabled therapies</dt>
          <dd>{prismaflexReviewCandidateDeviceProfile.enabledTherapies.length}</dd>
        </div>
        <div>
          <dt>Transfer tolerance</dt>
          <dd>{baxterCrrtCrossDeviceTransferManifest.outcomeTolerance ?? 'Not approved'}</dd>
        </div>
      </dl>

      <details className={styles.disclosure}>
        <summary aria-controls="baxter-crrt-prismaflex-review-console">
          <ChevronRight aria-hidden="true" />
          <div>
            <span>Prismaflex reviewer-only softkey console</span>
            <strong>Setup, profile, calculation, and alarm mapping</strong>
          </div>
          <small>
            <PanelsTopLeft aria-hidden="true" /> No device action
          </small>
        </summary>
        <div id="baxter-crrt-prismaflex-review-console" className={styles.content}>
          <PrismaflexReviewerConsole />
        </div>
      </details>

      <details className={styles.disclosure}>
        <summary aria-controls="baxter-crrt-cross-device-transfer-review">
          <ChevronRight aria-hidden="true" />
          <div>
            <span>Cross-device transfer composition plan</span>
            <strong>
              {baxterCrrtCrossDeviceTransferManifest.domains.length} comparison domains · no
              equivalence claim
            </strong>
          </div>
          <small>
            <ArrowLeftRight aria-hidden="true" /> No capstone runtime
          </small>
        </summary>
        <div id="baxter-crrt-cross-device-transfer-review" className={styles.content}>
          <CrrtCrossDeviceTransferReview />
        </div>
      </details>
    </section>
  )
}
