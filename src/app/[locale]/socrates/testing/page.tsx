import { setRequestLocale } from 'next-intl/server'
import { requireSocratesUser } from '@/features/socrates-study/server/service'
import { StudyShell } from '@/features/socrates-study/components/shared'
import { StudyDirectory } from '@/features/socrates-study/components/StudyDirectory'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await requireSocratesUser().catch(() => null)
  return (
    <StudyShell locale={locale}>
      {session ? (
        <StudyDirectory locale={locale} />
      ) : (
        <>
          <h1>Study access required</h1>
          <p>Sign in with your authorized study account to enter testing.</p>
          <a href={`/${locale}/login?next=/${locale}/socrates/testing`}>Sign in</a>
        </>
      )}
    </StudyShell>
  )
}
