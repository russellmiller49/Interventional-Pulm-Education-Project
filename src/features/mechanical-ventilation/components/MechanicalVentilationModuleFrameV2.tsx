import type { ReactNode } from 'react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { mechanicalVentilationPublicationStatus } from '../content'

export const MECHANICAL_VENTILATION_NAV_BASE = mechanicalVentilationNavBase

export const MECHANICAL_VENTILATION_SAFETY_NOTICE = (
  <>
    <strong>Educational simulation—not a clinical device or treatment recommendation.</strong>{' '}
    Synthetic values, waveforms, alarms, and responses must not guide care for a real patient. Use
    bedside assessment, the applicable operator manual, current institutional protocols, and
    qualified clinical supervision.
  </>
)

export const mechanicalVentilationModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: MECHANICAL_VENTILATION_NAV_BASE,
    description: 'Outcomes and orientation',
  },
  {
    title: 'Learn',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/learn`,
    description: 'Focused guided lessons',
  },
  {
    title: 'Practice',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/practice`,
    description: 'Fifteen preserved cases',
  },
  {
    title: 'Assess',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/assess`,
    description: 'Seeded masked challenge',
  },
]

const releaseLabel =
  mechanicalVentilationPublicationStatus === 'published'
    ? 'Reviewed release'
    : mechanicalVentilationPublicationStatus === 'tester-preview'
      ? 'Unlisted tester preview'
      : 'Authenticated draft'

export function MechanicalVentilationModuleFrameV2({
  activeHref,
  children,
}: {
  readonly activeHref: string
  readonly children: ReactNode
}) {
  return (
    <ModuleFrameV2
      eyebrow="Critical care · Respiratory support"
      title="Mechanical Ventilation"
      subtitle="Mechanics, waveforms, patient–ventilator interaction, troubleshooting, and reassessment"
      releaseLabel={releaseLabel}
      activeHref={activeHref}
      navItems={mechanicalVentilationModuleNavItems}
      navAriaLabel="Mechanical ventilation sections"
      safetyNotice={MECHANICAL_VENTILATION_SAFETY_NOTICE}
      theme="dark"
    >
      {children}
    </ModuleFrameV2>
  )
}
