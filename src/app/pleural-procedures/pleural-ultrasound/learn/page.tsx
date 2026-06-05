import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { PleuralUltrasoundNav } from '@/features/pleural-ultrasound/components/PleuralUltrasoundNav'
import {
  ultrasoundBoardSectionIds,
  ultrasoundBoardSlug,
  ultrasoundCoreBlocks,
  ultrasoundGoDeeperBlocks,
} from '@/features/pleural-ultrasound/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Pleural Ultrasound',
  description:
    'Read the four pleural effusion patterns, choose a safe access window, and recognize dynamic pleural signs.',
}

export default function PleuralUltrasoundLearnPage() {
  // Server-only: pull the ultrasound-relevant sections from the board chapter.
  const boardSections = getBoardSections(ultrasoundBoardSlug, ultrasoundBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn pleural ultrasound"
        description="How to read the pleural space before you ever place a needle: technique, the four effusion patterns, and the signs that change the plan."
      />
      <PleuralUltrasoundNav activeHref="/pleural-procedures/pleural-ultrasound/learn" />

      <LearnSection
        intro={
          <p>
            Work through the core blocks first — they are everything you need to read a pleural scan
            and pick a safe window. Open the “Go deeper” items when you want the advanced dynamic
            signs and the board-level detail.
          </p>
        }
        coreBlocks={ultrasoundCoreBlocks}
        goDeeperBlocks={ultrasoundGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Pleural Effusions and Pleural Interventions"
      />

      <ModuleProgressToggle
        moduleId="pleural-ultrasound"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
