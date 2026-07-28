import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BaxterCrrtLearn } from '@/features/baxter-crrt/components/BaxterCrrtLearn'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · CRRT · PrisMax console lab',
  description:
    'An ordered eight-section CRRT pathway: treatment goal, circuit anatomy, transport, prescription, anticoagulation, alarms, fluid management, and a pressure-profile integration capstone.',
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

  // With no section selected, BaxterCrrtLearn renders the pathway landing instead of dropping
  // the learner straight into the workbench at section one.
  return (
    <BaxterCrrtLearn
      locale={locale}
      initialLessonId={typeof lesson === 'string' ? lesson : undefined}
    />
  )
}
