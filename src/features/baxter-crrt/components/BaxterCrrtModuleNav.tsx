'use client'

import { Link } from '@/i18n/navigation'
import { baxterCrrtNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import styles from './baxter-crrt.module.css'

export const baxterCrrtModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: baxterCrrtNavBase,
    title: 'Overview',
    description: 'Core path and progress',
  },
  {
    href: `${baxterCrrtNavBase}/learn`,
    title: 'Learn',
    description: 'Seven didactic lessons',
  },
  {
    href: `${baxterCrrtNavBase}/practice`,
    title: 'Practice',
    description: 'Cases and safety drills',
  },
  {
    href: `${baxterCrrtNavBase}/assess`,
    title: 'Assess',
    description: 'Gated PrisMax capstone',
  },
]

export function BaxterCrrtModuleNav({ activeHref }: { readonly activeHref: string }) {
  return (
    <nav className={styles.moduleNav} aria-label="Baxter CRRT module sections">
      <ol>
        {baxterCrrtModuleNavItems.map((item, index) => {
          const active = item.href === activeHref
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                data-active={active}
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
