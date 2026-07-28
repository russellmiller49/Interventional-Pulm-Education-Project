import type { ReactNode } from 'react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import { icuHemodynamicsNavBase } from '@/features/learning-module/moduleRoutes'
import type { ModuleNavItem } from '@/features/learning-module/types'

export const ICU_HEMODYNAMICS_SAFETY_NOTICE = (
  <>
    <strong>Educational model—not a clinical device.</strong> Values and responses are synthetic and
    must not be used for patient-specific decisions. Use bedside evaluation, validated monitoring,
    current institutional protocols, manufacturer instructions, and qualified clinical supervision.
  </>
)

export const icuHemodynamicsModuleNavItems: readonly ModuleNavItem[] = [
  {
    title: 'Overview',
    href: icuHemodynamicsNavBase,
    description: 'Outcomes and orientation',
  },
  {
    title: 'Learn',
    href: `${icuHemodynamicsNavBase}/learn`,
    description: 'Guided signal skills',
  },
  {
    title: 'Practice',
    href: `${icuHemodynamicsNavBase}/practice`,
    description: 'Eight preserved cases',
  },
  {
    title: 'Challenge',
    href: `${icuHemodynamicsNavBase}/assess`,
    description: 'Harder case, less help',
  },
]

export function IcuHemodynamicsModuleFrameV2({
  activeHref,
  children,
}: {
  readonly activeHref: string
  readonly children: ReactNode
}) {
  return (
    <ModuleFrameV2
      eyebrow="Critical care · Hemodynamic reasoning"
      title="ICU Hemodynamics Lab"
      subtitle="Signal validation, PAC technique, shock physiology, and reassessment"
      releaseLabel="Unlisted preview"
      activeHref={activeHref}
      navItems={icuHemodynamicsModuleNavItems}
      navAriaLabel="ICU hemodynamics sections"
      safetyNotice={ICU_HEMODYNAMICS_SAFETY_NOTICE}
    >
      {children}
    </ModuleFrameV2>
  )
}
