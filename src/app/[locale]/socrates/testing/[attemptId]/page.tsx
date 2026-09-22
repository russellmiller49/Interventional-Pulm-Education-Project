import { setRequestLocale } from 'next-intl/server'
import { z } from 'zod'
import { notFound } from 'next/navigation'
import { requireSocratesUser, loadAttempt } from '@/features/socrates-study/server/service'
import { StudyShell } from '@/features/socrates-study/components/shared'
import { TestingCase } from '@/features/socrates-study/components/TestingCase'
export const dynamic = 'force-dynamic'
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; attemptId: string }>
}) {
  const { locale, attemptId } = await params
  setRequestLocale(locale)
  if (!z.string().uuid().safeParse(attemptId).success) notFound()
  const data = await requireSocratesUser()
    .then((session) => loadAttempt(attemptId, session))
    .catch(() => null)
  return (
    <StudyShell locale={locale}>
      {data ? (
        <TestingCase initial={data.dto} />
      ) : (
        <>
          <h1>Test case unavailable</h1>
          <p>
            The case may be on hold or unavailable to this account. Your study administrator can
            check its status.
          </p>
        </>
      )}
    </StudyShell>
  )
}
