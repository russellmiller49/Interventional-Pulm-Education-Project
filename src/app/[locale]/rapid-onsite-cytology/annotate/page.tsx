import type { Metadata } from 'next'

import { AnnotationWorkbench } from '@/features/rapid-onsite-cytology/components/AnnotationWorkbench'

export const metadata: Metadata = {
  title: 'Rapid Onsite Cytology Annotation Workbench',
  description: 'Offline development workbench for calibrating ROSE cytology hotspot coordinates.',
}

export default function RapidOnsiteCytologyAnnotationPage() {
  return <AnnotationWorkbench />
}
