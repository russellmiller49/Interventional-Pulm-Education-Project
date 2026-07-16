import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import CardiohelpEcmoLab from '@/features/cardiohelp-ecmo/components/CardiohelpEcmoLab'
import { cardiohelpEcmoPublicationStatus } from '@/features/cardiohelp-ecmo/content/deviceProfile'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'CARDIOHELP-i Adult VV & VA ECMO Learn & Practice Lab',
  description:
    cardiohelpEcmoPublicationStatus === 'published'
      ? 'Reviewed step-by-step learning and independent adult VV and peripheral VA ECMO console, circuit, sweep, pressure-reasoning, and troubleshooting practice.'
      : 'Draft-gated step-by-step learning and independent adult VV and peripheral VA ECMO console, circuit, sweep, pressure-reasoning, and troubleshooting practice.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function CardiohelpEcmoPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CardiohelpEcmoLab locale={locale} />
}
