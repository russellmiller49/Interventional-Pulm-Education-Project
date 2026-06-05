import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralInfectionNav } from '@/features/pleural-infection/components/PleuralInfectionNav'
import {
  infectionBoardSectionIds,
  infectionBoardSlug,
  infectionCoreBlocks,
  infectionGoDeeperBlocks,
} from '@/features/pleural-infection/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Pleural Infection',
  description:
    'Parapneumonic staging, drainage thresholds, antibiotics, intrapleural tPA + DNase (MIST2), surgery, and the irrigation fallback.',
}

export default function PleuralInfectionLearnPage() {
  const boardSections = getBoardSections(infectionBoardSlug, infectionBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn pleural infection"
        description="Stage the effusion, drain and dose early, and know exactly where intrapleural therapy, surgery, and irrigation fit on one reassessment pathway."
      />
      <PleuralInfectionNav activeHref="/pleural-procedures/pleural-infection/learn" />

      <LearnSection
        intro={
          <p>
            The core blocks take you from staging to source control. Open “Go deeper” for the RAPID
            mortality score, bleeding considerations, and the board-level algorithms and tables.
          </p>
        }
        coreBlocks={infectionCoreBlocks}
        goDeeperBlocks={infectionGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Pleural Infections"
      />

      <ModuleProgressToggle
        moduleId="pleural-infection"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
