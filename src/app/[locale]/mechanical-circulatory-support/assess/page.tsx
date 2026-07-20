import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { McsWorkbench } from '@/features/mechanical-circulatory-support/components/McsWorkbench'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Assess · Mechanical Circulatory Support ICU Lab',
  description:
    'Locked IABP, Impella, and durable-LVAD capstones with no coaching and safety-gated mastery.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}
export default async function MechanicalCirculatorySupportAssessPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <McsWorkbench section="assess" locale={locale} />
}
