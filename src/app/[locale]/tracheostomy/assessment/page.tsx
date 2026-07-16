import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { AssessSection } from '@/features/learning-module/components/AssessSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import { TracheostomyModuleHeader } from '@/features/tracheostomy/components/TracheostomyModuleHeader'
import { TracheostomyNav } from '@/features/tracheostomy/components/TracheostomyNav'
import { getTracheostomyQuizQuestions } from '@/features/tracheostomy/content/quizItems'
import { HandoffContent } from '@/i18n/handoff'

export const metadata: Metadata = {
  title: 'Assessment · Tracheostomy Knowledge Lab',
  description: 'Commit-first adult tracheostomy knowledge assessment with explanatory feedback.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function TracheostomyAssessmentPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <TracheostomyModuleHeader
            title="Test the decisions that matter"
            description="Ten questions emphasize airway identity, tube mechanics, suction and cuff safety, emergency first moves, speaking valves, and decannulation readiness."
          />
          <TracheostomyNav activeHref={`${tracheostomyNavBase}/assessment`} />
          <AssessSection
            title="Tracheostomy knowledge check"
            intro="Choose one answer before revealing the explanation. The goal is to strengthen a safe shared mental model—not to confer procedural competency."
            questions={getTracheostomyQuizQuestions(locale)}
          />
          <ModuleProgressToggle
            moduleId="tracheostomy"
            section="assessment"
            label="Mark Assessment complete"
          />
        </div>
      }
    </HandoffContent>
  )
}
