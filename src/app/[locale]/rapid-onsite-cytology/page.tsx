import type { Metadata } from 'next'

import { RapidOnsiteCytologyModule } from '@/features/rapid-onsite-cytology/components/RapidOnsiteCytologyModule'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Rapid Onsite Cytology Interpretation',
  description:
    'Interactive ROSE and Diff-Quik cytology teaching module with curated cell-level hotspots and quiz mode.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function RapidOnsiteCytologyPage() {
  return <HandoffContent>{<RapidOnsiteCytologyModule />}</HandoffContent>
}
