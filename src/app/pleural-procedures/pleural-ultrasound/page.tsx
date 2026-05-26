import type { Metadata } from 'next'

import { PleuralModuleHeader } from '@/features/pleural-procedures/components/PleuralModuleHeader'
import { PatternRecognitionLab } from '@/features/pleural-ultrasound/components/PatternRecognitionLab'

export const metadata: Metadata = {
  title: 'Pleural Ultrasound Pattern Lab',
  description:
    'Interactive pleural ultrasound pattern recognition lab for effusion complexity and management implications.',
}

export default function PleuralUltrasoundPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralModuleHeader
        title="Pleural ultrasound pattern lab"
        description="Classify pleural effusion patterns, then connect the visual finding to sampling, drainage, and source-control thinking without treating ultrasound appearance as a diagnosis by itself."
      />
      <PatternRecognitionLab />
    </div>
  )
}
