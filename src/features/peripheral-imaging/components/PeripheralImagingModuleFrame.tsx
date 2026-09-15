'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import type { ModuleNavItem } from '@/features/learning-module/types'

import {
  PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
  PERIPHERAL_IMAGING_LEARN_HREF,
  PERIPHERAL_IMAGING_NAV_BASE,
  PERIPHERAL_IMAGING_PRACTICE_HREF,
} from '../content/routes'
import { PERIPHERAL_IMAGING_RELEASE_STAGE } from '../content/release'
import styles from './peripheral-imaging-module.module.css'

/**
 * Overview | Learn | Practice | Integrated cases. The fourth tab was Assess, the eight-case
 * capstone; the owner's self-paced decision (PI-01) retired the capstone standard, and the same
 * address now opens the integrated cases.
 */
export const peripheralImagingModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: PERIPHERAL_IMAGING_NAV_BASE,
    description: 'Pathway map and where you left off',
  },
  {
    title: 'Learn',
    href: PERIPHERAL_IMAGING_LEARN_HREF,
    description: 'Sections on the imaging suite',
  },
  {
    title: 'Practice',
    href: PERIPHERAL_IMAGING_PRACTICE_HREF,
    description: 'Short cases, one decision each',
  },
  {
    title: 'Integrated cases',
    href: PERIPHERAL_IMAGING_INTEGRATED_CASES_HREF,
    description: 'Eight cases that combine the sections',
  },
]

export const PERIPHERAL_IMAGING_SAFETY_NOTICE = (
  <>
    <strong>Learn the reasoning. Build the practical skill under supervision.</strong>{' '}
    <span>
      For education only. The models combine CT-derived anatomy with authored targets and
      illustrative values, and do not predict patient dose, safe tool placement, diagnostic yield or
      actual equipment performance. Follow current device instructions, local protocols, and
      operator, anesthesia and medical-physics judgment.
    </span>
  </>
)

/**
 * What the module is right now, in the learner's words. The stage is the authority: while it is
 * `unlisted-preview` the course is reachable by direct link only and is not part of the public
 * site, so the label says so rather than implying an account is required.
 *
 * Keep it to a few words. The shared frame renders this badge `white-space: nowrap`, so a long
 * label does not wrap — it widens the document and every section under it. Publication alone
 * does not establish clinical review; the education-only boundary remains in the safety notice.
 */
const releaseLabel =
  PERIPHERAL_IMAGING_RELEASE_STAGE === 'unlisted-preview'
    ? 'In development · direct link'
    : 'Public release'

/**
 * Shared shell for the hub and every section page: module identity row, section nav, and the
 * safety boundary. In activity mode the shell hands the viewport to the lesson stage inside it.
 */
export function PeripheralImagingModuleFrame({
  locale = 'en',
  activeHref,
  activityMode = false,
  children,
}: {
  readonly locale?: string
  readonly activeHref: string
  readonly activityMode?: boolean
  readonly children: ReactNode
}) {
  return (
    <main className={styles.moduleShell} data-activity-mode={activityMode || undefined}>
      <ModuleFrameV2
        eyebrow="Interventional pulmonology · Peripheral bronchoscopy imaging"
        title="Peripheral Bronchoscopy Imaging"
        subtitle="See the target. Understand the image."
        releaseLabel={releaseLabel}
        activeHref={activeHref}
        navItems={peripheralImagingModuleNavItems}
        navAriaLabel="Peripheral bronchoscopy imaging sections"
        safetyNotice={PERIPHERAL_IMAGING_SAFETY_NOTICE}
        theme="dark"
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note">
            <Languages aria-hidden="true" />
            English content fallback: Spanish and Simplified Chinese clinical translations are not
            yet approved for this module.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
