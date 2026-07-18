import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'

import BaxterCrrtLab from '@/features/baxter-crrt/components/BaxterCrrtLab'
import styles from '@/features/baxter-crrt/components/baxter-crrt.module.css'
import { BAXTER_CRRT_CONTENT_VERSION, baxterCrrtReleaseStage } from '@/features/baxter-crrt/content'

export const metadata: Metadata = {
  title: 'CRRT Final SME Preview',
  description:
    'Protected full-function Baxter CRRT v1 preview with sources, limitations, and write suppression.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function BaxterCrrtReviewPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <nav className={styles.reviewerRouteNav} aria-label="CRRT workspace navigation">
        <Link href={`/${locale}/baxter-crrt`}>← Return to protected learner workspace</Link>
        <span>Final SME preview · full functionality · no telemetry or progress writes</span>
      </nav>
      <section
        className={styles.reviewCandidateIdentity}
        aria-labelledby="crrt-sme-preview-heading"
      >
        <div>
          <p className={styles.eyebrow}>Lightweight final SME pass</p>
          <h1 id="crrt-sme-preview-heading">Baxter CRRT v1 preview</h1>
          <p>
            Exercise the complete private module, inspect claim-level sources and limitations, and
            record feedback using the final-SME checklist. Review metadata is informational and does
            not disable any preview feature.
          </p>
        </div>
        <dl>
          <div>
            <dt>Release stage</dt>
            <dd>{baxterCrrtReleaseStage}</dd>
          </div>
          <div>
            <dt>Build version</dt>
            <dd>{BAXTER_CRRT_CONTENT_VERSION}</dd>
          </div>
          <div>
            <dt>Persistence</dt>
            <dd>Suppressed</dd>
          </div>
          <div>
            <dt>Telemetry</dt>
            <dd>Suppressed</dd>
          </div>
        </dl>
      </section>
      <section className={styles.smeChecklist} aria-labelledby="crrt-sme-checklist-heading">
        <div>
          <p className={styles.eyebrow}>Feedback guide · no signature or approval record</p>
          <h2 id="crrt-sme-checklist-heading">Final SME review prompts</h2>
          <p>
            Note the artifact/location, observed issue, clinical or educational rationale, suggested
            correction, and whether it should block a later public release.
          </p>
        </div>
        <ul>
          <li>Clinical coherence of safe, alternative, unsafe, reassessment, and debrief paths</li>
          <li>PrisMax and Prismaflex manual-reference fidelity and visible limitations</li>
          <li>No implied institutional configuration or cross-device interchangeability</li>
          <li>Citrate content remains recognition, checks, reassessment, and escalation only</li>
          <li>Source clarity, accessibility, responsive behavior, and educational boundaries</li>
        </ul>
      </section>
      <BaxterCrrtLab locale={locale} sessionMode="review-preview" />
    </>
  )
}
