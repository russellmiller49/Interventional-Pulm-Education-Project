import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { ThoracentesisNav } from '@/features/thoracentesis-planner/components/ThoracentesisNav'
import {
  thoracentesisBoardSectionIds,
  thoracentesisBoardSlug,
  thoracentesisCoreBlocks,
  thoracentesisGoDeeperBlocks,
} from '@/features/thoracentesis-planner/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Thoracentesis',
  description:
    'Safe pleural access, intercostal vessel risk, individualized bleeding risk, pleural manometry, and when to stop draining.',
}

export default function ThoracentesisLearnPage() {
  const boardSections = getBoardSections(thoracentesisBoardSlug, thoracentesisBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn thoracentesis"
        description="Plan the tap before you do it: where it is safe to enter, how to think about bleeding risk, and what pleural pressure reveals about the lung."
      />
      <ThoracentesisNav activeHref="/pleural-procedures/thoracentesis-planner/learn" />

      <LearnSection
        intro={
          <p>
            The core blocks are everything you need to plan a safe tap and read a manometry curve.
            Open “Go deeper” for re-expansion pulmonary edema, special situations, and the
            board-level technique detail.
          </p>
        }
        coreBlocks={thoracentesisCoreBlocks}
        goDeeperBlocks={thoracentesisGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Pleural Effusions and Pleural Interventions"
      />

      <ModuleProgressToggle
        moduleId="thoracentesis-planner"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
