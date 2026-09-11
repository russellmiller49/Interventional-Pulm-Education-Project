'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE } from '../content/release'
import {
  BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
  BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF,
  BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
  BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
  BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
} from '../content/routes'
import styles from './bronchoscopy-foundations-module.module.css'

/**
 * Overview | Learn | Practice | Assess | Reference — the navigation grammar the critical-care
 * modules share, with one more door: the tables, the template, the glossary and the sources a
 * learner wants beside the procedure rather than inside a section.
 */
export const bronchoscopyFoundationsModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: BRONCHOSCOPY_FOUNDATIONS_NAV_BASE,
    description: 'Pathway map and progress',
  },
  {
    title: 'Learn',
    href: BRONCHOSCOPY_FOUNDATIONS_LEARN_HREF,
    description: 'Sections on one airway model',
  },
  {
    title: 'Practice',
    href: BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
    description: 'Short cases, one decision each',
  },
  {
    title: 'Assess',
    href: BRONCHOSCOPY_FOUNDATIONS_ASSESS_HREF,
    description: 'The eight-case capstone',
  },
  {
    title: 'Reference',
    href: BRONCHOSCOPY_FOUNDATIONS_REFERENCE_HREF,
    description: 'Tables, template, glossary, sources',
  },
]

export const BRONCHOSCOPY_FOUNDATIONS_SAFETY_NOTICE = (
  <>
    <strong>Learn the reasoning. Build the hand skill under supervision.</strong>{' '}
    <span>
      For education only. The simulator is an authored teaching model on one de-identified anatomy
      profile. No dose, device dimension, ventilator setting or sampling rule here is a
      recommendation. Follow current device instructions, local policy and supervising judgment.
    </span>
  </>
)

/**
 * What the module is right now, in the learner's words. The stage is the authority: while it is
 * `unlisted-preview` the course is reachable by direct link only and is not part of the public
 * site, so the label says so rather than implying an account is required.
 *
 * Keep it to a few words. The shared frame renders this badge `white-space: nowrap`, so a long
 * label does not wrap — it widens the document and every section under it.
 */
const releaseLabel =
  BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE === 'unlisted-preview'
    ? 'In development · direct link'
    : 'Published'

/**
 * Shared shell for the hub and every section page: module identity row, section nav, and the
 * safety boundary. In activity mode the shell hands the viewport to the lesson stage inside it.
 */
export function BronchoscopyFoundationsModuleFrame({
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
        eyebrow="Interventional pulmonology · Bronchoscopy foundations"
        title="Bronchoscopy Foundations"
        subtitle="Know where you are. Claim only what you saw."
        releaseLabel={releaseLabel}
        activeHref={activeHref}
        navItems={bronchoscopyFoundationsModuleNavItems}
        navAriaLabel="Bronchoscopy foundations sections"
        safetyNotice={BRONCHOSCOPY_FOUNDATIONS_SAFETY_NOTICE}
        theme="dark"
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishFallback} role="note">
            <Languages aria-hidden="true" />
            Reviewed English content fallback: Spanish and Simplified Chinese clinical translations
            are not yet approved for this module.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
