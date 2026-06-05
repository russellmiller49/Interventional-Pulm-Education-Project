import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralFluidAnalysisNav } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisNav'
import {
  fluidBoardSectionIds,
  fluidBoardSlug,
  fluidCoreBlocks,
  fluidGoDeeperBlocks,
} from '@/features/pleural-fluid-analysis/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Pleural Fluid Analysis',
  description:
    "Light's criteria, the pseudoexudate trap, targeted pleural fluid tests, gross appearance, and turning numbers into a differential.",
}

export default function PleuralFluidAnalysisLearnPage() {
  const boardSections = getBoardSections(fluidBoardSlug, fluidBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn pleural fluid analysis"
        description="Classify the effusion, reconcile the pseudoexudate, and let the gross appearance and clinical story drive the targeted tests."
      />
      <PleuralFluidAnalysisNav activeHref="/pleural-procedures/pleural-fluid-analysis/learn" />

      <LearnSection
        intro={
          <p>
            The core blocks take you from Light’s criteria to a ranked differential. Open “Go
            deeper” for targeted-test pearls, the rare effusions, and the board-level pathway and
            tables.
          </p>
        }
        coreBlocks={fluidCoreBlocks}
        goDeeperBlocks={fluidGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Pleural Effusions and Pleural Interventions"
      />

      <ModuleProgressToggle
        moduleId="pleural-fluid-analysis"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
