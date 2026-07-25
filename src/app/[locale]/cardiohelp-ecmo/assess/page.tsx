import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Challenge · ECMO Management · CARDIOHELP console lab',
  description:
    'Harder CARDIOHELP-i cases for adult VV and peripheral VA ECMO, open from the start.',
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

export default async function CardiohelpEcmoAssessPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CardiohelpWorkbench section="assess" locale={locale} />
}
