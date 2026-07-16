import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import BaxterCrrtLab from '@/features/baxter-crrt/components/BaxterCrrtLab'
import { baxterCrrtPublicationStatus } from '@/features/baxter-crrt/content'

export const metadata: Metadata = {
  title: 'CRRT Learn & Practice Workspace',
  description:
    baxterCrrtPublicationStatus === 'published'
      ? 'Reviewed adult CRRT learning and case-practice workspace.'
      : 'Authenticated draft scaffold for a source-bound adult CRRT learning and case-practice workspace.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function BaxterCrrtPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <BaxterCrrtLab locale={locale} />
}
