import type { Metadata } from 'next'

import { ChestDrainageHeader } from '@/features/chest-drainage/components/ChestDrainageHeader'
import { ChestDrainageNav } from '@/features/chest-drainage/components/ChestDrainageNav'
import { DrySealDrainageSimulator } from '@/features/chest-drainage/components/DrySealDrainageSimulator'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Chest Drainage Simulators',
  description:
    'Interactive dry-seal drainage simulator with fluid filling, air leak bubbling, dry suction, and clamp controls.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function ChestDrainageSimulatorsPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <ChestDrainageHeader
            title="Chest drainage simulators"
            description="Manipulate the dry-seal drainage unit directly and watch the chamber, suction indicator, air leak meter, patient pressure float, and clamp state update."
          />
          <ChestDrainageNav activeHref="/pleural-procedures/chest-drainage/simulators" />
          <DrySealDrainageSimulator />
        </div>
      }
    </HandoffContent>
  )
}
