import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { SocratesDemo } from '@/features/socrates-demo/components/SocratesDemo'

export const metadata: Metadata = {
  title: 'SOCRATES Deep-Slide Annotation Demo',
  description:
    'Unlisted functional demonstration of live deep-zoom pathology imagery with illustrative nested annotations.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function SocratesDemoPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <SocratesDemo />
}
