import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtPractice } from '@/features/baxter-crrt/components/BaxterCrrtPractice'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · CRRT · PrisMax console lab',
  description:
    'Scored PrisMax CRRT cases and cause-first safety drills across six high-yield curriculum stations.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ case?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BaxterCrrtPracticePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const caseId = (await searchParams)?.case
  setRequestLocale(locale)
  return (
    <BaxterCrrtPractice
      locale={locale}
      initialCaseId={typeof caseId === 'string' ? caseId : undefined}
    />
  )
}
