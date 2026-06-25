import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { TroubleshootingCaseTrainer } from '@/features/chest-drainage/components/TroubleshootingCaseTrainer'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Chest Drainage Troubleshooting',
  description:
    'Patient-first branching cases for bubbling, no tidaling, high output, high negativity, blocked-tube alarms, and re-expansion risk.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ChestDrainageTroubleshootingPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ChestDrainageHeader
            title="Troubleshooting rounds"
            description="Practice patient-first reasoning before moving through tube, unit, suction source, and disease physiology."
          />
          <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/troubleshooting" />
          <TroubleshootingCaseTrainer />
        </div>
      }
    </HandoffContent>
  )
}
