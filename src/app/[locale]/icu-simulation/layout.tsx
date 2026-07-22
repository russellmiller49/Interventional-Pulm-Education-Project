import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { ICU_SIMULATION_RELEASE_STAGE } from '@/features/icu-simulation/content'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { assertDraftModulesEnabled } from '@/lib/draft-module-guard'

const isPublished = ICU_SIMULATION_RELEASE_STAGE === 'published'

const handoffMetadata: Metadata = {
  title: 'ICU Simulator',
  description:
    'An integrated adult critical care simulation for longitudinal shock assessment, mechanical ventilation, ECMO, mechanical circulatory support, and CRRT practice.',
  robots: {
    index: isPublished,
    follow: isPublished,
    noarchive: !isPublished,
  },
}

interface LayoutProps {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Pick<LayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function IcuSimulationLayout({ children }: LayoutProps) {
  if (!isPublished) {
    await assertDraftModulesEnabled()
  }

  return children
}
