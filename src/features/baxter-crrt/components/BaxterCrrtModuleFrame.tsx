'use client'

import { EyeOff, Languages, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { HandoffContent } from '@/i18n/handoff'

import { baxterCrrtPublicationStatus, baxterCrrtReleaseStage } from '../content/release'
import { BaxterCrrtModuleNav } from './BaxterCrrtModuleNav'
import styles from './baxter-crrt.module.css'

interface BaxterCrrtModuleFrameProps {
  readonly locale: string
  readonly activeHref: string
  readonly children: ReactNode
}

export function BaxterCrrtModuleFrame({
  locale,
  activeHref,
  children,
}: BaxterCrrtModuleFrameProps) {
  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-release-stage={baxterCrrtReleaseStage}
        data-publication-status={baxterCrrtPublicationStatus}
        data-analytics="allowlisted"
        data-progress-write="v3"
        data-no-handoff-translate={locale === 'en' ? undefined : 'true'}
      >
        <header className={styles.frameHeader}>
          <div>
            <span className={styles.kicker}>Adult ICU CRRT · PrisMax</span>
            <strong>Baxter CRRT learning module</strong>
          </div>
          <span className={styles.frameBadge}>
            <EyeOff aria-hidden="true" />
            {baxterCrrtReleaseStage === 'published' ? 'Reviewed release' : 'SME review'}
          </span>
        </header>

        {locale !== 'en' ? (
          <div className={styles.languageFallback} role="note" data-no-handoff-translate="true">
            <Languages aria-hidden="true" />
            <div>
              <strong>Reviewed-English fallback</strong>
              <p>English remains authoritative while localized CRRT content is unavailable.</p>
            </div>
          </div>
        ) : null}

        <BaxterCrrtModuleNav activeHref={activeHref} />

        <section className={styles.safetyBanner} role="note" aria-label="Educational safety notice">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>
              Education only—never patient-specific advice or a local operating policy.
            </strong>
            <p>
              Patient values, device responses, and scores are simulated. Use current manufacturer
              instructions, authorized local protocols, supervision, and clinical judgment for
              patient care. This module does not establish competency or certification.
            </p>
          </div>
        </section>

        {children}
      </main>
    </HandoffContent>
  )
}
