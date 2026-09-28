'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { approvedDisclosure } from '@/lib/sponsorship/policy'

import {
  MEDICAL_THORACOSCOPY_MODULE_ID,
  MEDICAL_THORACOSCOPY_RELEASE_STAGE,
} from '../content/release'
import {
  MEDICAL_THORACOSCOPY_CASES_HREF,
  MEDICAL_THORACOSCOPY_LEARN_HREF,
  MEDICAL_THORACOSCOPY_NAV_BASE,
  MEDICAL_THORACOSCOPY_PRACTICE_HREF,
  MEDICAL_THORACOSCOPY_REFERENCE_HREF,
} from '../content/routes'
import styles from './medical-thoracoscopy-module.module.css'

/** Overview | Learn | Practice | Cases | Reference: the navigation the sibling courses share. */
export const medicalThoracoscopyNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: MEDICAL_THORACOSCOPY_NAV_BASE,
    description: 'The course and where you left off',
  },
  {
    title: 'Learn',
    href: MEDICAL_THORACOSCOPY_LEARN_HREF,
    description: 'Nineteen sections in five chapters',
  },
  {
    title: 'Practice',
    href: MEDICAL_THORACOSCOPY_PRACTICE_HREF,
    description: 'Scenarios paired with the sections',
  },
  {
    title: 'Cases',
    href: MEDICAL_THORACOSCOPY_CASES_HREF,
    description: 'Four cases across the whole procedure',
  },
  {
    title: 'Reference',
    href: MEDICAL_THORACOSCOPY_REFERENCE_HREF,
    description: 'Tables, glossary and sources',
  },
]

export const MEDICAL_THORACOSCOPY_SAFETY_NOTICE = (
  <>
    <strong>Learn the reasoning. Build the hand skill under supervision.</strong>{' '}
    <span>
      For education only. The simulation is an authored teaching model on one de-identified CT, with
      no haptics, tissue forces or bleeding physiology. Sedation, energy settings and reprocessing
      follow the device instructions for use and local protocol. Completing the course is not
      competence.
    </span>
  </>
)

/**
 * What the module is right now, in the learner's words. Keep it short: the shared frame renders
 * this badge without wrapping.
 */
const releaseLabel =
  MEDICAL_THORACOSCOPY_RELEASE_STAGE === 'unlisted-preview'
    ? 'In development · direct link'
    : 'Published'

/**
 * Shared shell for the hub and every page of the course: identity row, section tabs, the safety
 * boundary and, once the owner approves its wording, the sponsorship disclosure. The course is
 * written in English only, so its content is marked `lang="en"` whatever the site's locale, and a
 * visitor on another locale is told so. In activity mode the shell hands the viewport to the lesson.
 */
export function MedicalThoracoscopyModuleFrame({
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
    <main className={styles.moduleShell} data-activity-mode={activityMode || undefined} lang="en">
      <ModuleFrameV2
        eyebrow="Interventional pulmonology · Pleural procedures"
        title="Medical Thoracoscopy"
        subtitle="Prepare for supervised single-port medical thoracoscopy: the instrument, the port, a systematic survey and what to do with what you see."
        releaseLabel={releaseLabel}
        activeHref={activeHref}
        navItems={medicalThoracoscopyNavItems}
        navAriaLabel="Medical thoracoscopy sections"
        safetyNotice={MEDICAL_THORACOSCOPY_SAFETY_NOTICE}
        sponsorNotice={approvedDisclosure(MEDICAL_THORACOSCOPY_MODULE_ID)}
        theme="dark"
        activityMode={activityMode}
      >
        {locale !== 'en' ? (
          <div className={styles.englishOnly} role="note">
            <Languages aria-hidden="true" />
            This course is written in English only. It has not been translated.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
