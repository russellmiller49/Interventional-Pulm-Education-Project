import type { Metadata } from 'next'

import { PleuralClinicalReviewTable } from '@/features/pleural-procedures/components/ClinicalReviewTable'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'

export const metadata: Metadata = {
  title: 'Pleural Clinical Review',
  description:
    'Reviewer-facing clinical statements, references, and review metadata across pleural modules.',
}

export default function PleuralClinicalReviewPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Pleural clinical review"
        description="A reviewer-facing packet of clinical statements, source IDs, citations, last-reviewed dates, and reviewer status across the pleural course."
      />
      <PleuralClinicalReviewTable />
    </div>
  )
}
