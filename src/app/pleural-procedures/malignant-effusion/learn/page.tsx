import type { Metadata } from 'next'

import { getBoardSections } from '@/lib/board-section-loader'
import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { LearnSection } from '@/features/learning-module/components/LearnSection'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import {
  mpeBoardSectionIds,
  mpeBoardSlug,
  mpeCoreBlocks,
  mpeGoDeeperBlocks,
} from '@/features/malignant-effusion/content/learnContent'

export const metadata: Metadata = {
  title: 'Learn Malignant Pleural Effusion',
  description:
    'Diagnostic escalation after nondiagnostic taps, lung expandability, talc pleurodesis, indwelling pleural catheters, and patient-goals endpoints.',
}

export default function MalignantEffusionLearnPage() {
  const boardSections = getBoardSections(mpeBoardSlug, mpeBoardSectionIds)

  return (
    <div className="space-y-10 py-16">
      <ModuleHeader
        title="Learn malignant pleural effusion"
        description="Why a negative tap is not the end, how lung expandability chooses the definitive path, and how to weigh IPC, pleurodesis, and combined strategies against patient goals."
      />
      <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/learn" />

      <LearnSection
        intro={
          <p>
            The core blocks take you from a nondiagnostic tap to a definitive plan. Open “Go deeper”
            for IPC complications, the key trials, and the board-level algorithms and tables.
          </p>
        }
        coreBlocks={mpeCoreBlocks}
        goDeeperBlocks={mpeGoDeeperBlocks}
        boardSections={boardSections}
        boardSourceLabel="From the board chapter: Indwelling Pleural Catheters and Pleurodesis"
      />

      <ModuleProgressToggle
        moduleId="malignant-effusion"
        section="learn"
        label="Mark Learn complete"
      />
    </div>
  )
}
