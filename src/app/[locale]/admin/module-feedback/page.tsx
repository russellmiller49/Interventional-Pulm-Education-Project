import type { Metadata } from 'next'
import { FeedbackWorkspace } from '@/features/module-beta/FeedbackWorkspace'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Module feedback workspace',
  robots: { index: false, follow: false, noarchive: true },
}
export default async function FeedbackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <FeedbackWorkspace locale={locale} />
}
