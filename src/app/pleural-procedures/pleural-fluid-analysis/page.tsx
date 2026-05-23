import type { Metadata } from 'next'

import { PleuralAnalysisHeader } from '@/features/pleural-fluid-analysis/components/PleuralAnalysisHeader'
import { PleuralFluidAnalysisModule } from '@/features/pleural-fluid-analysis/components/PleuralFluidAnalysisModule'

export const metadata: Metadata = {
  title: 'Pleural Fluid Analysis',
  description:
    'Interactive module for interpreting pleural fluid analysis with ranked differentials, quiz mode, Light criteria, pseudoexudates, targeted testing, rare diseases, and diagnostic pitfalls.',
}

export default function PleuralFluidAnalysisPage() {
  return (
    <div className="space-y-10 py-16">
      <PleuralAnalysisHeader
        title="Pleural fluid analysis"
        description="An advanced case, quiz, and differential-ranking module for pairing pleural fluid results with bedside context, ultrasound pattern, serum data, and targeted diagnostic tests."
      />
      <PleuralFluidAnalysisModule />
    </div>
  )
}
