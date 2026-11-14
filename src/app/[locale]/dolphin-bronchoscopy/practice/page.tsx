import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { DolphinModuleFrame } from '@/features/dolphin-bronchoscopy/components/DolphinModuleFrame'
import { DolphinBranchDrill } from '@/features/dolphin-bronchoscopy/components/practice/DolphinBranchDrill'
import { DolphinCaseActivity } from '@/features/dolphin-bronchoscopy/components/practice/DolphinCaseActivity'
import { DolphinFrameDrill } from '@/features/dolphin-bronchoscopy/components/practice/DolphinFrameDrill'
import { DolphinPracticeLanding } from '@/features/dolphin-bronchoscopy/components/practice/DolphinPracticeLanding'
import { dolphinDrillSetById } from '@/features/dolphin-bronchoscopy/content/branchDrillSets'
import { dolphinFrameDrillById } from '@/features/dolphin-bronchoscopy/content/frameDrills'
import { dolphinMicroCaseById } from '@/features/dolphin-bronchoscopy/content/microCases'
import { DOLPHIN_PRACTICE_HREF } from '@/features/dolphin-bronchoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · Dolphin Bronchoscopy',
  description:
    'Short dolphin bronchoscopy cases with one decision each, branch-finding drills on the simulator, and frame drills.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    case?: string | string[]
    drill?: string | string[]
    branches?: string | string[]
  }>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function DolphinPracticePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = (await searchParams) ?? {}
  const caseId = first(query.case)
  const drillId = first(query.drill)
  const setId = first(query.branches)
  setRequestLocale(locale)

  const body =
    caseId && dolphinMicroCaseById.has(caseId) ? (
      <DolphinCaseActivity key={caseId} caseId={caseId} />
    ) : drillId && dolphinFrameDrillById.has(drillId) ? (
      <DolphinFrameDrill key={drillId} drillId={drillId} />
    ) : setId && dolphinDrillSetById.has(setId) ? (
      <DolphinBranchDrill key={setId} setId={setId} />
    ) : null

  return (
    <DolphinModuleFrame locale={locale} activeHref={DOLPHIN_PRACTICE_HREF}>
      {body ? (
        <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
          {body}
        </div>
      ) : (
        <DolphinPracticeLanding />
      )}
    </DolphinModuleFrame>
  )
}
