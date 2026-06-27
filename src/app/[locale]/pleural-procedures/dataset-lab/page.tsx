import type { Metadata } from 'next'

import { PleuralDatasetLab } from '@/features/pleural-dataset-lab/components/PleuralDatasetLab'
import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Pleural Dataset Source Lab',
  description:
    'Raw CC BY Mendeley and figshare lung ultrasound source-label lab for pleural education module review.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function PleuralDatasetLabPage() {
  return (
    <HandoffContent>
      {
        <div className="space-y-10 py-16">
          <PleuralModuleHeader
            title="Pleural dataset source lab"
            description="Review raw CC BY lung ultrasound examples from Mendeley and figshare, commit to source labels, and trace each embedded image back to its dataset, archive path, license, and checksum."
          />
          <PleuralDatasetLab />
        </div>
      }
    </HandoffContent>
  )
}
