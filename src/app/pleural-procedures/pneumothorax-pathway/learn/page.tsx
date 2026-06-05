import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PneumothoraxNav } from '@/features/pneumothorax-pathway/components/PneumothoraxNav'
import {
  pneumothoraxBoardSectionIds,
  pneumothoraxBoardSlug,
  pneumothoraxCoreBlocks,
  pneumothoraxGoDeeperBlocks,
} from '@/features/pneumothorax-pathway/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Pneumothorax',
  description:
    'Stability first, primary vs secondary, the ACCP-vs-BTS divergence, persistent air leak management, and recurrence prevention.',
}

export default function PneumothoraxLearnPage() {
  const boardSections = getBoardSections(pneumothoraxBoardSlug, pneumothoraxBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn the pneumothorax pathway"
        description="Start with physiology, separate primary from secondary, and understand exactly where the two major frameworks agree and diverge."
      />
      <PneumothoraxNav activeHref="/pleural-procedures/pneumothorax-pathway/learn" />

      <LearnSection
        intro={
          <p>
            The core blocks carry the whole decision, from the emergency to recurrence prevention.
            Open “Go deeper” for lung ultrasound signs, APF-vs-BPF, and the board-level algorithms
            and tables.
          </p>
        }
        coreBlocks={pneumothoraxCoreBlocks}
        goDeeperBlocks={pneumothoraxGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Pneumothorax, Prolonged Air Leaks, and Bronchopleural Fistula"
      />

      <ModuleProgressToggle
        moduleId="pneumothorax-pathway"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
