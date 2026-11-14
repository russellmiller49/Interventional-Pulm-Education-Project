import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BoardNavigatorModuleFrame } from '@/features/board-navigator/components/BoardNavigatorModuleFrame'
import { LabLanding } from '@/features/board-navigator/components/LabLanding'
import { RepairLab } from '@/features/board-navigator/components/RepairLab'
import { isObjectiveId } from '@/features/board-navigator/content/objectives'
import { BOARD_NAVIGATOR_LAB_HREF, type LabMode } from '@/features/board-navigator/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Repair lab · IP Board Navigator',
  description:
    'Diagnose, explain, manipulate, apply to a new case, and schedule the review: one objective at a time.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ objective?: string | string[]; mode?: string | string[] }>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function BoardNavigatorLabPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  const objectiveId = first(query?.objective)
  const mode: LabMode = first(query?.mode) === 'review' ? 'review' : 'repair'
  setRequestLocale(locale)

  return (
    <BoardNavigatorModuleFrame locale={locale} activeHref={BOARD_NAVIGATOR_LAB_HREF}>
      {objectiveId && isObjectiveId(objectiveId) ? (
        <RepairLab key={`${objectiveId}-${mode}`} objectiveId={objectiveId} mode={mode} />
      ) : (
        <LabLanding unknownObjective={objectiveId} />
      )}
    </BoardNavigatorModuleFrame>
  )
}
