import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CriticalCareHub } from '@/features/critical-care/components/CriticalCareHub'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Critical Care Learning Center',
  description:
    'An unlisted collection of interactive critical care modules covering ICU hemodynamics, mechanical ventilation, mechanical circulatory support, ECMO, and CRRT.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CriticalCarePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <HandoffContent>
      <CriticalCareHub />
    </HandoffContent>
  )
}
