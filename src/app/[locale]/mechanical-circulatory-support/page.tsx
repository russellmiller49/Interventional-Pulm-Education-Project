import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { McsHub } from '@/features/mechanical-circulatory-support/components/McsHub'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Mechanical Circulatory Support ICU Lab',
  description:
    'Unlisted adult ICU learning lab for IABP counterpulsation, Impella CP-family support, and durable continuous-flow LVAD assessment.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}

export default async function MechanicalCirculatorySupportPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <McsHub locale={locale} />
}
