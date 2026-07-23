import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CardiohelpWorkbench } from '@/features/cardiohelp-ecmo/components/CardiohelpWorkbench'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Assess · ECMO Management · CARDIOHELP console lab',
  description:
    'Unseen scored CARDIOHELP-i capstone scenarios for adult VV and peripheral VA ECMO, unlocked by completing every lesson in a track.',
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
