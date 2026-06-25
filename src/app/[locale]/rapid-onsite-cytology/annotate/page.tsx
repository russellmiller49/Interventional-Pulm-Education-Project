import type { Metadata } from 'next'

import { AnnotationWorkbench } from '@/features/rapid-onsite-cytology/components/AnnotationWorkbench'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Rapid Onsite Cytology Annotation Workbench',
  description: 'Offline development workbench for calibrating ROSE cytology hotspot coordinates.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function RapidOnsiteCytologyAnnotationPage() {
  return <HandoffContent>{<AnnotationWorkbench />}</HandoffContent>
}
