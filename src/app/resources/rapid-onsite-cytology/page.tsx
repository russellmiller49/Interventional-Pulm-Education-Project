import type { Metadata } from 'next'

import { RapidOnsiteCytologyModule } from '@/features/rapid-onsite-cytology/components/RapidOnsiteCytologyModule'

export const metadata: Metadata = {
  title: 'Rapid Onsite Cytology Interpretation',
  description:
    'Interactive ROSE and Diff-Quik cytology teaching module with curated cell-level hotspots and quiz mode.',
}

export default function RapidOnsiteCytologyPage() {
  return <RapidOnsiteCytologyModule />
}
