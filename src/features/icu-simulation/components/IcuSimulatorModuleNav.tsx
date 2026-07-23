import type { Route } from 'next'

import { Link } from '@/i18n/navigation'

import type { IcuSimulationMode } from '../engine'
import styles from './icu-simulation.module.css'

export type IcuSimulatorModuleSection = 'overview' | IcuSimulationMode

const moduleSections: readonly {
  id: IcuSimulatorModuleSection
  label: string
  href: Route
}[] = [
  { id: 'overview', label: 'Overview', href: '/icu-simulation' as Route },
  { id: 'learn', label: 'Learn', href: '/icu-simulation/learn' as Route },
  { id: 'practice', label: 'Practice', href: '/icu-simulation/practice' as Route },
  { id: 'assess', label: 'Assess', href: '/icu-simulation/assess' as Route },
  { id: 'sandbox', label: 'Sandbox', href: '/icu-simulation/sandbox' as Route },
]

export function IcuSimulatorModuleNav({
  activeSection,
  compact = false,
}: {
  readonly activeSection: IcuSimulatorModuleSection
  readonly compact?: boolean
}) {
  return (
    <nav
      className={styles.icuModuleNav}
      data-compact={compact || undefined}
      aria-label="ICU Simulator module sections"
    >
      {moduleSections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          aria-current={section.id === activeSection ? 'page' : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  )
}
