import type { Metadata } from 'next'

import { IntroBronchoscopyCourseHub } from '@/features/intro-bronchoscopy/components/IntroBronchoscopyCourseHub'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Intro to Bronchoscopy Curriculum',
  description:
    'A 9-module interactive curriculum for bronchoscopy decision-making, scope handling, airway anatomy, diagnostics, therapeutics, ICU bronchoscopy, emergencies, and documentation.',
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default function IntroBronchoscopyPage() {
  return (
    <HandoffContent>
      {
        <div className="py-16">
          <IntroBronchoscopyCourseHub />
        </div>
      }
    </HandoffContent>
  )
}
