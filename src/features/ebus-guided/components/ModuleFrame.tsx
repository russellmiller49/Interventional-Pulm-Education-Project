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
}: {
  children: ReactNode
  active?: CourseSection
  activity?: boolean
  locale?: string
}) {
  return (
    <main className={styles.moduleShell} data-activity-mode={activity || undefined}>
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
