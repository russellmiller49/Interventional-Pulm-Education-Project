'use client'

import { Link } from '@/i18n/navigation'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'

import styles from './mechanical-circulatory-support.module.css'

export const mcsModuleNavItems = [
  {
    href: mechanicalCirculatorySupportNavBase,
    title: 'Overview',
    description: 'Tracks, boundaries, and progress',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/learn`,
    title: 'Learn',
    description: 'Eight guided lessons',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/practice`,
    title: 'Practice',
    description: 'Mechanism Studio + nine cases',
  },
  {
    href: `${mechanicalCirculatorySupportNavBase}/assess`,
    title: 'Assess',
    description: 'Three locked capstones',
  },
] as const

export function McsModuleNav({ activeHref }: { activeHref: string }) {
  return (
    <nav className={styles.moduleNav} aria-label="Mechanical circulatory support module sections">
      <ol>
        {mcsModuleNavItems.map((item, index) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={activeHref === item.href ? 'page' : undefined}
              data-active={activeHref === item.href}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
