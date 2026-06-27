import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { ClinicalReviewTable } from '@/features/chest-drainage/components/ClinicalReviewTable'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Chest Drainage References',
  description:
    'References, source notes, and clinical review packet for the chest drainage module.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ChestDrainageReferencesPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ChestDrainageHeader
            title="References and clinical review"
            description="Source notes, review metadata, and clinical statements for reviewers without searching through the component tree."
          />
          <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/references" />
          <ClinicalReviewTable />
        </div>
      }
    </HandoffContent>
  )
}
