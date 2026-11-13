'use client'
import type { ReactNode } from 'react'
import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { BASE } from '../content/curriculum'
import styles from './eus-b-guided.module.css'

export type CourseSection = 'Overview' | 'Learn'

export const COURSE_NAV: { title: CourseSection; href: string; description: string }[] = [
  { title: 'Overview', href: BASE, description: 'Course overview and survey route' },
  { title: 'Learn', href: BASE + '/learn', description: 'Guided lessons' },
]

/** The course's own frame: the shared module frame with this course's name, tabs and boundary. */
export function EusbModuleFrame({
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
        title="EUS-B: Guided Course"
        subtitle="The EBUS scope in the esophagus. One survey, six landmarks."
        releaseLabel="In development · direct link"
        theme="dark"
        activityMode={activity}
        hideSiteHeader
        activeHref={COURSE_NAV.find((item) => item.title === active)!.href}
        navItems={COURSE_NAV.map(({ title, href, description }) => ({ title, href, description }))}
        safetyNotice={
          <>
            <strong>A teaching course, not a clinical device.</strong> Its ultrasound images are
            simulated from one patient’s CT. It teaches where the landmarks lie and how to find
            them; hands-on skill comes from supervised practice.
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
