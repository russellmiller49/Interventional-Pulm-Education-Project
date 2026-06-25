import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { LessonOverview } from '@/features/chest-drainage/components/LessonOverview'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn Chest Drainage',
  description:
    'Pressure physiology, water seal, dry suction, air leak, and troubleshooting concepts.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ChestDrainageLearnPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ChestDrainageHeader
            title="Learn chest drainage"
            description="Core concepts for pressure, one-way seal function, dry suction controls, visible bubbling, and patient-first interpretation."
          />
          <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/learn" />
          <LessonOverview />
        </div>
      }
    </HandoffContent>
  )
}
