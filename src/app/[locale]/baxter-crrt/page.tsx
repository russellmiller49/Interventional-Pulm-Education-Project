import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import BaxterCrrtLab from '@/features/baxter-crrt/components/BaxterCrrtLab'
import { baxterCrrtIsPublic, baxterCrrtReleaseStage } from '@/features/baxter-crrt/content'

const isPublic = baxterCrrtIsPublic(baxterCrrtReleaseStage)

export const metadata: Metadata = {
  title: 'CRRT Learn, Practice & Mastery Workspace',
  description:
    'Adult CRRT educational workspace with 18 cases, seven drills, six tools, two device profiles, and PrisMax Mastery.',
  robots: {
    index: isPublic,
    follow: isPublic,
    noarchive: !isPublic,
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
