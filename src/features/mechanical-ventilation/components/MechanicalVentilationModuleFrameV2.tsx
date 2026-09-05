import type { ReactNode } from 'react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { mechanicalVentilationNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { mechanicalVentilationPublicationStatus } from '../content'

export const MECHANICAL_VENTILATION_NAV_BASE = mechanicalVentilationNavBase

export const MECHANICAL_VENTILATION_SAFETY_NOTICE = (
  <>
    <strong>For supervised clinical learning.</strong> Cases, waveforms, and responses are
    synthetic. Use current clinical guidance, device manuals, local protocols, and qualified
    supervision for patient care.
  </>
)

export const mechanicalVentilationModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: MECHANICAL_VENTILATION_NAV_BASE,
    description: 'Outcomes and orientation',
  },
  {
    title: 'Learning path',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/learn`,
    description: 'A staged path from the normal breath to clinical reasoning',
  },
  {
    title: 'Practice',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/practice`,
    description: 'Apply the learning in a clinical teaching case',
  },
  {
    title: 'Final check',
    href: `${MECHANICAL_VENTILATION_NAV_BASE}/assess`,
    description: 'Independent mixed knowledge check',
  },
]

const releaseLabel =
  mechanicalVentilationPublicationStatus === 'published'
    ? 'Reviewed release'
    : mechanicalVentilationPublicationStatus === 'tester-preview'
      ? 'Unlisted reviewer preview'
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
      subtitle="Read the breath. Explain the change. Reassess the patient."
      releaseLabel={releaseLabel}
      activeHref={activeHref}
      navItems={mechanicalVentilationModuleNavItems}
      navAriaLabel="Mechanical ventilation sections"
      safetyNotice={MECHANICAL_VENTILATION_SAFETY_NOTICE}
      theme="light"
    >
      {children}
    </ModuleFrameV2>
  )
}
