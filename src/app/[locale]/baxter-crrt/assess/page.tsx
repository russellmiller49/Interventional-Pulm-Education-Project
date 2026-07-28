import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtAssess } from '@/features/baxter-crrt/components/BaxterCrrtAssess'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Challenge · CRRT · PrisMax console lab',
  description: 'A harder PrisMax CRRT case with a causal debrief, open from the start.',
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
