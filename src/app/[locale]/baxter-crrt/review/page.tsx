import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'

import { CrrtPhase7ReviewPanel } from '@/features/baxter-crrt/components/CrrtPhase7ReviewPanel'
import { CrrtPhase8ReviewPanel } from '@/features/baxter-crrt/components/CrrtPhase8ReviewPanel'
import styles from '@/features/baxter-crrt/components/baxter-crrt.module.css'
import { resolveBaxterCrrtReviewBuildIdentity } from '@/features/baxter-crrt/reviewBuildIdentity'

export const metadata: Metadata = {
  title: 'CRRT Reviewer Workspace',
  description:
    'Guarded reviewer-only CRRT cases, tools, device adapters, manifests, and activation boundaries.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function BaxterCrrtReviewPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const reviewBuild = resolveBaxterCrrtReviewBuildIdentity(process.env)
  const declaredCandidate =
    reviewBuild.state === 'declared-candidate-requires-manifest-verification'

  return (
    <main
      className={styles.moduleShell}
      data-reviewer-route="true"
      data-analytics="none"
      data-progress-write="none"
      data-candidate-state={reviewBuild.state}
    >
      <nav className={styles.reviewerRouteNav} aria-label="CRRT workspace navigation">
        <Link href={`/${locale}/baxter-crrt`}>← Return to protected learner workspace</Link>
        <span>Reviewer/admin route · pending content only</span>
      </nav>
      <section
        className={styles.reviewCandidateIdentity}
        aria-labelledby="crrt-review-candidate-heading"
        data-formal-review-eligible="false"
      >
        <div>
          <p className={styles.eyebrow}>Exact review build</p>
          <h1 id="crrt-review-candidate-heading">
            {declaredCandidate ? 'Declared candidate — verify manifest' : 'Unfrozen working build'}
          </h1>
          <p>
            {declaredCandidate
              ? 'Compare every value below with the independently supplied manifest before recording findings. This banner alone is not a freeze or approval.'
              : 'Do not sign this build. A clean candidate ID and manifest digest have not been supplied to the guarded review environment.'}
          </p>
        </div>
        <dl>
          <div>
            <dt>Candidate ID</dt>
            <dd>{reviewBuild.candidateId ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Manifest SHA-256</dt>
            <dd>{reviewBuild.manifestSha256 ?? 'Not supplied'}</dd>
          </div>
          <div>
            <dt>Build ID</dt>
            <dd>{reviewBuild.buildId ?? 'Not supplied'}</dd>
          </div>
        </dl>
      </section>
      <CrrtPhase7ReviewPanel />
      <CrrtPhase8ReviewPanel />
    </main>
  )
}
