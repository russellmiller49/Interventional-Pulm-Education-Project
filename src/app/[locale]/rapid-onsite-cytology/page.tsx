import type { Metadata } from 'next'

import { RoseLearningModule } from '@/features/rapid-onsite-cytology/components/RoseLearningModule'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'ROSE: Adequacy, Triage & Cytology',
  description:
    'High-yield rapid on-site evaluation module for target representativeness, specimen adequacy, triage, communication, and pulmonary cytology practice.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function RapidOnsiteCytologyPage() {
  return <HandoffContent>{<RoseLearningModule />}</HandoffContent>
}
