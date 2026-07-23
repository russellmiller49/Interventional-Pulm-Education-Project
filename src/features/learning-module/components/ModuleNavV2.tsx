import type { Route } from 'next'

import { Link } from '@/i18n/navigation'

import type { ModuleNavItem } from '../types'
import styles from './learning-module-v2.module.css'

export interface ModuleNavV2Props {
  readonly items: readonly ModuleNavItem[]
  readonly activeHref: string
  readonly ariaLabel?: string
}

export function ModuleNavV2({
  items,
  activeHref,
  ariaLabel = 'Module sections',
}: ModuleNavV2Props) {
  return (
    <nav className={styles.moduleNav} aria-label={ariaLabel}>
      <ol className={styles.moduleNavList}>
        {items.map((item, index) => {
          const active = item.href === activeHref
          return (
            <li key={item.href}>
              <Link
                href={item.href as Route}
                className={styles.moduleNavLink}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.moduleNavIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={styles.moduleNavCopy}>
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
