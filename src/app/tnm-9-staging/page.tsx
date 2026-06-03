import type { Metadata } from 'next'

import { EmbeddedTrainingModuleFrame } from '@/components/ebus-training/EmbeddedTrainingModuleFrame'
import { tnm9TrainingModule } from '@/data/ebus-training'

export const metadata: Metadata = {
  title: 'TNM-9 Staging',
  description:
    'Standalone TNM-9 lung cancer staging module with searchable descriptors, interactive stage grouping, T descriptor builder, N map, and cases.',
}

export default function Tnm9StagingPage() {
  return <EmbeddedTrainingModuleFrame module={tnm9TrainingModule} />
}
