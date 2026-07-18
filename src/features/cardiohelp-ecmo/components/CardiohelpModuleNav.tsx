'use client'

import { Link } from '@/i18n/navigation'
import type { ModuleNavItem } from '@/features/learning-module/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import styles from './cardiohelp-ecmo.module.css'

// Same IA contract as the shared learning-module ModuleNav, restyled with the
// module's own dark design system (the Tailwind spine nav would render as a
// light strip inside .moduleShell).
export const cardiohelpModuleNavItems: readonly ModuleNavItem[] = [
  {
    href: cardiohelpEcmoNavBase,
    title: 'Overview',
    description: 'Curriculum map, tracks, and progress',
  },
  {
    href: `${cardiohelpEcmoNavBase}/learn`,
    title: 'Learn',
    description: 'Guided lessons · unscored',
  },
  {
    href: `${cardiohelpEcmoNavBase}/practice`,
    title: 'Practice',
    description: 'Clinical cases · scored',
  },
  {
    href: `${cardiohelpEcmoNavBase}/assess`,
    title: 'Assess',
    description: 'Capstone · unlocked by lessons',
  },
]

interface CardiohelpModuleNavProps {
  activeHref: string
}

export function CardiohelpModuleNav({ activeHref }: CardiohelpModuleNavProps) {
  return (
    <nav className={styles.moduleNav} aria-label="CARDIOHELP module sections">
      <ol>
        {cardiohelpModuleNavItems.map((item, index) => {
          const isActive = item.href === activeHref
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive}
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
