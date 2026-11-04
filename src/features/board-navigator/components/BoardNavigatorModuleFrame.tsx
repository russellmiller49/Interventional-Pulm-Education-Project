'use client'

import type { ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { ModuleFrameV2 } from '@/features/learning-module/components/ModuleFrameV2'
import type { ModuleNavItem } from '@/features/learning-module/types'

import { BOARD_NAVIGATOR_RELEASE_STAGE } from '../content/release'
import {
  BOARD_NAVIGATOR_CURRICULUM_HREF,
  BOARD_NAVIGATOR_LAB_HREF,
  BOARD_NAVIGATOR_MAP_HREF,
  BOARD_NAVIGATOR_NAV_BASE,
  BOARD_NAVIGATOR_PROGRESS_HREF,
} from '../content/routes'

/** Today | Knowledge map | Repair lab | Progress | Curriculum: the five screens of the vision. */
export const boardNavigatorNavItems: readonly ModuleNavItem[] = [
  { title: 'Today', href: BOARD_NAVIGATOR_NAV_BASE, description: 'Your next best move and why' },
  {
    title: 'Knowledge map',
    href: BOARD_NAVIGATOR_MAP_HREF,
    description: 'Every objective and its evidence',
  },
  {
    title: 'Repair lab',
    href: BOARD_NAVIGATOR_LAB_HREF,
    description: 'Diagnose, repair, apply, review',
  },
  {
    title: 'Progress',
    href: BOARD_NAVIGATOR_PROGRESS_HREF,
    description: 'What changed, what is due',
  },
  {
    title: 'Curriculum',
    href: BOARD_NAVIGATOR_CURRICULUM_HREF,
    description: 'The whole blueprint, browsable',
  },
]

export const BOARD_NAVIGATOR_SAFETY_NOTICE = (
  <>
    <strong>A learning navigator, not an assessment.</strong>{' '}
    <span>
      For professional education. It does not give patient-specific advice, and it is not an AABIP
      product or endorsed by the AABIP.
    </span>
  </>
)

const releaseLabel =
  BOARD_NAVIGATOR_RELEASE_STAGE === 'unlisted-preview'
    ? 'In development · direct link'
    : 'Published'

export function BoardNavigatorModuleFrame({
  locale = 'en',
  activeHref,
  children,
}: {
  readonly locale?: string
  readonly activeHref: string
  readonly children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ModuleFrameV2
        eyebrow="Interventional pulmonology · Board preparation"
        title="IP Board Navigator"
        subtitle="Find the gap. Repair the concept. Show it holds."
        releaseLabel={releaseLabel}
        activeHref={activeHref}
        navItems={boardNavigatorNavItems}
        navAriaLabel="Board Navigator screens"
        safetyNotice={BOARD_NAVIGATOR_SAFETY_NOTICE}
      >
        {locale !== 'en' ? (
          <div
            className="mx-auto mt-4 flex w-full max-w-5xl items-center gap-2 rounded-xl border border-border/70 px-4 py-2 text-sm text-muted-foreground"
            role="note"
          >
            <Languages aria-hidden="true" className="size-4 shrink-0" />
            English content fallback: Spanish and Simplified Chinese clinical translations are not
            yet approved for this module.
          </div>
        ) : null}
        {children}
      </ModuleFrameV2>
    </main>
  )
}
