'use client'
import type { ReactNode } from 'react'
import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { BASE } from '../content/curriculum'
import styles from './course.module.css'

export type CourseSection = 'Overview' | 'Learn' | 'Practice' | 'Cases'
/** The four course addresses. `/assess` keeps its address; it opens the integrated cases. */
export const COURSE_NAV: { title: CourseSection; href: string; description: string }[] = [
  { title: 'Overview', href: BASE, description: 'Course overview and map' },
  { title: 'Learn', href: BASE + '/learn', description: 'Guided lessons' },
  { title: 'Practice', href: BASE + '/practice', description: 'Optional practice cases and labs' },
  { title: 'Cases', href: BASE + '/assess', description: 'Integrated cases' },
]
export function EbusModuleFrame({
  children,
  active = 'Overview',
  activity = false,
  locale = 'en',
  onReselectSection,
}: {
  children: ReactNode
  active?: CourseSection
  activity?: boolean
  locale?: string
  /**
   * What selecting the section that is already open should do, when the page holds something
   * inside that section (EBUS-PRE-REVIEW-01, PR-7).
   *
   * The course tabs are ordinary links to the four course addresses. Practice and Cases open a
   * case inside the page they are already on, so the tab for the open section points at the
   * address in the address bar: the router has nothing to do and the case stays up, with no way
   * back to the list but the debrief or a reload.
   *
   * Given this callback, a click on the tab already marked `aria-current="page"` — and only that
   * tab — is handled here instead of by the router. The address does not change, because the
   * learner is already at it; the page returns to its list. Every other tab, and every link in
   * the page, is untouched, and a frame without this prop behaves exactly as before. The shared
   * nav is not modified: this is one EBUS-local capture handler over this module's own frame.
   */
  onReselectSection?: () => void
}) {
  return (
    <main
      className={styles.moduleShell}
      data-activity-mode={activity || undefined}
      onClickCapture={
        onReselectSection
          ? (event) => {
              if (!(event.target instanceof Element)) return
              const link = event.target.closest('a[aria-current="page"]')
              if (!link || !link.closest('nav')) return
              event.preventDefault()
              onReselectSection()
            }
          : undefined
      }
    >
      <ModuleFrameV2
        eyebrow="Interventional pulmonology · Guided education"
        title="EBUS: Guided Course"
        subtitle="Prepare. Locate. Sample. Interpret."
        releaseLabel="In development · direct link"
        theme="dark"
        activityMode={activity}
        activeHref={COURSE_NAV.find((item) => item.title === active)!.href}
        navItems={COURSE_NAV.map(({ title, href, description }) => ({ title, href, description }))}
        safetyNotice={
          <>
            <strong>For education and supervised training.</strong> This self-paced course teaches
            clinical reasoning and simulated acquisition. It does not establish procedural
            competence. Follow current device instructions, local protocols, and supervising
            judgment. Clinical content is in development.
          </>
        }
      >
        {locale !== 'en' && (
          <p className={styles.notice} role="note">
            English course content. Spanish and Simplified Chinese clinical translations have not
            been reviewed.
          </p>
        )}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
