'use client'

import type { ReactNode } from 'react'
import { EyeOff, Languages, ShieldAlert } from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'

import { MCS_RELEASE_STAGE } from '../content'
import { McsModuleNav } from './McsModuleNav'
import styles from './mechanical-circulatory-support.module.css'

export function McsModuleFrame({
  locale,
  activeHref,
  children,
}: {
  locale: string
  activeHref: string
  children: ReactNode
}) {
  return (
    <HandoffContent>
      <main className={styles.moduleShell} data-no-handoff-translate={locale !== 'en'}>
        <header className={styles.frameHeader}>
          <div>
            <span className={styles.kicker}>ADULT ICU · MECHANICAL CIRCULATORY SUPPORT</span>
            <strong>Pressure, flow, unloading, and bedside response</strong>
          </div>
          <span className={styles.previewBadge}>
            <EyeOff aria-hidden="true" /> {MCS_RELEASE_STAGE.replace('-', ' ')}
          </span>
        </header>
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note" data-no-handoff-translate>
            <Languages aria-hidden="true" />
            <span>
              <strong>Reviewed-English fallback.</strong> Localized clinical content remains hidden
              until specialty review is complete.
            </span>
          </div>
        ) : null}
        <McsModuleNav activeHref={activeHref} />
        <section className={styles.safetyBanner} aria-label="Educational safety boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>
              Educational model—not a clinical device, digital twin, certification, or
              patient-specific guide.
            </strong>
            <span>
              Use current manufacturer instructions, local policy, direct examination and imaging,
              and the responsible shock/LVAD team. Insertion, anticoagulation dosing, device
              selection, and operational competency are outside this lab.
            </span>
          </div>
        </section>
        {children}
      </main>
    </HandoffContent>
  )
}
