import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · ECMO Management · CARDIOHELP console lab',
  description:
    'Self-paced CARDIOHELP-i clinical cases for adult VV and peripheral VA ECMO, with optional predictions and explanations available at any time.',
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

export default async function CardiohelpEcmoPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <CardiohelpWorkbench section="practice" locale={locale} />
}
