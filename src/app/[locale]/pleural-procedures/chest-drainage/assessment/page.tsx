import type { Metadata } from 'next'

import { AssessmentPanel } from '@/features/chest-drainage/components/AssessmentPanel'
import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Chest Drainage Assessment',
  description: 'Quiz and scenario checks for chest drainage knobology and troubleshooting.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ChestDrainageAssessmentPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ChestDrainageHeader
            title="Chest drainage assessment"
            description="Short checks for dry suction setup, air leak interpretation, no-tidaling reasoning, and re-expansion risk."
          />
          <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/assessment" />
          <AssessmentPanel />
        </div>
      }
    </HandoffContent>
  )
}
