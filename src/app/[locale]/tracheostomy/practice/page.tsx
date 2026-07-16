import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import { TracheostomyModuleHeader } from '@/features/tracheostomy/components/TracheostomyModuleHeader'
import { TracheostomyNav } from '@/features/tracheostomy/components/TracheostomyNav'
import { TracheostomyPractice } from '@/features/tracheostomy/components/TracheostomyPractice'
import { HandoffContent } from '@/i18n/handoff'

export const metadata: Metadata = {
  title: 'Practice · Tracheostomy Knowledge Lab',
  description:
    'Interactive tube labeling, tube selection, procedural sequencing, rescue scenarios, and decannulation readiness practice.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function TracheostomyPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <TracheostomyModuleHeader
            title="Practice the shared mental model"
            description="Label the tube, choose features by anatomy, sequence critical workflows, and rehearse rescue decisions before feedback is revealed."
          />
          <TracheostomyNav activeHref={`${tracheostomyNavBase}/practice`} />
          <TracheostomyPractice />
          <ModuleProgressToggle
            moduleId="tracheostomy"
            section="practice"
            label="Mark Practice complete"
          />
        </div>
      }
    </HandoffContent>
  )
}
