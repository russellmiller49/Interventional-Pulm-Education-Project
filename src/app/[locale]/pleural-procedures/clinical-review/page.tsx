import type { Metadata } from 'next'

import { PleuralClinicalReviewTable } from '@/features/pleural-procedures/components/ClinicalReviewTable'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Pleural Clinical Review',
  description:
    'Reviewer-facing clinical statements, references, and review metadata across pleural modules.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function PleuralClinicalReviewPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <PleuralModuleHeader
            title="Pleural clinical review"
            description="A reviewer-facing packet of clinical statements, source IDs, citations, last-reviewed dates, and reviewer status across the pleural course."
          />
          <PleuralClinicalReviewTable />
        </div>
      }
    </HandoffContent>
  )
}
