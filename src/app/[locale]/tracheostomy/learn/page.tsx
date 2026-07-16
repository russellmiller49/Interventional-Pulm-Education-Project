import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { tracheostomyNavBase } from '@/features/learning-module/moduleRoutes'
import { AirflowAndCuffLab } from '@/features/tracheostomy/components/AirflowAndCuffLab'
import { Tracheostomy3DLabDynamic } from '@/features/tracheostomy/components/Tracheostomy3DLabDynamic'
import { TracheostomyModuleHeader } from '@/features/tracheostomy/components/TracheostomyModuleHeader'
import { TracheostomyNav } from '@/features/tracheostomy/components/TracheostomyNav'
import {
  getTracheostomyAdvancedBlocks,
  getTracheostomyCoreBlocks,
} from '@/features/tracheostomy/content/learnContent'
import { HandoffContent } from '@/i18n/handoff'

export const metadata: Metadata = {
  title: 'Learn · Tracheostomy Knowledge Lab',
  description:
    'Interactive anatomy, tube mechanics, adult tracheostomy care, and emergency concepts.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function TracheostomyLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <TracheostomyModuleHeader
            title="Build the airway mental model"
            description="Start with tube anatomy and airflow, then connect those mechanics to placement, routine care, communication, complications, and decannulation."
          />
          <TracheostomyNav activeHref={`${tracheostomyNavBase}/learn`} />

          <section className="container">
            <Tracheostomy3DLabDynamic />
          </section>

          <section className="container">
            <AirflowAndCuffLab />
          </section>

          <LearnSection
            intro={
              <p>
                Read the core cards for the common mental model. Open “Go deeper” for procedure,
                manometry, team systems, and evidence nuance. Exact device instructions and local
                algorithms always supersede a general module.
              </p>
            }
            coreBlocks={getTracheostomyCoreBlocks(locale)}
            goDeeperBlocks={getTracheostomyAdvancedBlocks(locale)}
          />

          <ModuleProgressToggle
            moduleId="tracheostomy"
            section="learn"
            label="Mark Learn complete"
          />
        </div>
      }
    </HandoffContent>
  )
}
