import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · CARDIOHELP-i Adult VV & VA ECMO Lab',
  description:
    'Guided, unscored CARDIOHELP-i lessons: step-by-step console, circuit, gas, and patient reasoning for adult VV and peripheral VA ECMO.',
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

export default async function CardiohelpEcmoLearnPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CardiohelpWorkbench section="learn" locale={locale} />
}
