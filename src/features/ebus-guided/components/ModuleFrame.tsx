'use client'
import type { ReactNode } from 'react'
import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { BASE } from '../content/curriculum'
import styles from './course.module.css'
export function EbusModuleFrame({
  children,
  active = 'Overview',
  activity = false,
  locale = 'en',
}: {
  children: ReactNode
  active?: string
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
        activeHref={BASE + (active === 'Overview' ? '' : '/' + active.toLowerCase())}
        navItems={['Overview', 'Learn', 'Practice', 'Assess'].map((title) => ({
          title,
          href: BASE + (title === 'Overview' ? '' : '/' + title.toLowerCase()),
          description: title + ' EBUS',
        }))}
        safetyNotice={
          <>
            <strong>For education and supervised training.</strong> This course teaches clinical
            reasoning and simulated acquisition. It does not establish procedural competence. Follow
            current device instructions, local protocols, and supervising judgment. Clinical content
            is in development.
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
