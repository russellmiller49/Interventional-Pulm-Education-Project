import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtLearn } from '@/features/baxter-crrt/components/BaxterCrrtLearn'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · Baxter CRRT',
  description:
    'Seven focused CRRT lessons covering modality selection, transport, prescription, circuit pressures, anticoagulation, alarms, fluid management, and liberation.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ lesson?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BaxterCrrtLearnPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const lesson = (await searchParams)?.lesson
  setRequestLocale(locale)
  return (
    <BaxterCrrtLearn
      locale={locale}
      initialLessonId={typeof lesson === 'string' ? lesson : undefined}
    />
  )
}
