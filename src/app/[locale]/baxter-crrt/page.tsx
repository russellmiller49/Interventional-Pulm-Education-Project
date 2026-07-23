import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtHub } from '@/features/baxter-crrt/components/BaxterCrrtHub'
import { baxterCrrtIsPublic, baxterCrrtReleaseStage } from '@/features/baxter-crrt/content/release'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const isPublic = baxterCrrtIsPublic(baxterCrrtReleaseStage)

const handoffMetadata: Metadata = {
  title: 'CRRT · PrisMax console lab',
  description:
    'A high-yield PrisMax CRRT curriculum with seven lessons, a ten-case core path, five safety drills, two concept labs, and a masked capstone.',
  robots: {
    index: isPublic,
    follow: isPublic,
    noarchive: !isPublic,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BaxterCrrtPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <BaxterCrrtHub locale={locale} />
}
