import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { EmbeddedTrainingModuleFrame } from '@/components/ebus-training/EmbeddedTrainingModuleFrame'
import { tnm9TrainingModule } from '@/data/ebus-training'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'TNM-9 Staging',
  description:
    'Standalone TNM-9 lung cancer staging module with searchable descriptors, interactive stage grouping, T descriptor builder, N map, and cases.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function Tnm9StagingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {<EmbeddedTrainingModuleFrame locale={locale} module={tnm9TrainingModule} />}
    </HandoffContent>
  )
}
