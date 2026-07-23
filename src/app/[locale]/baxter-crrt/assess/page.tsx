import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtAssess } from '@/features/baxter-crrt/components/BaxterCrrtAssess'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Assess · CRRT · PrisMax console lab',
  description:
    'A masked, unassisted PrisMax CRRT capstone unlocked after completion of the ten-case core path.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BaxterCrrtAssessPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <BaxterCrrtAssess locale={locale} />
}
