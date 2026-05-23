import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { ClinicalReviewTable } from '@/features/chest-drainage/components/ClinicalReviewTable'

export const metadata: Metadata = {
  title: 'Chest Drainage References',
  description:
    'References, source notes, and clinical review packet for the chest drainage module.',
}

export default function ChestDrainageReferencesPage() {
  return (
    <div className="space-y-10 py-16">
      <ChestDrainageHeader
        title="References and clinical review"
        description="Source notes, review metadata, and clinical statements for reviewers without searching through the component tree."
      />
      <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/references" />
      <ClinicalReviewTable />
    </div>
  )
}
