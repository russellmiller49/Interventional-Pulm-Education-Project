import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { requireSocratesUser } from '@/features/socrates-study/server/service'
import { StudyShell } from '@/features/socrates-study/components/shared'
import { AdminDashboard } from '@/features/socrates-study/components/AdminDashboard'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'SOCRATES study administration',
  robots: { index: false, follow: false, noarchive: true },
}
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await requireSocratesUser(true).catch(() => null)
  return (
    <StudyShell locale={locale}>
      {session ? <AdminDashboard locale={locale} /> : <h1>Study administrator access required</h1>}
    </StudyShell>
  )
}
