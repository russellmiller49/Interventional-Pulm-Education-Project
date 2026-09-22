import { setRequestLocale } from 'next-intl/server'
import { z } from 'zod'
import { notFound } from 'next/navigation'
import { requireSocratesUser, loadTraining } from '@/features/socrates-study/server/service'
import { StudyShell } from '@/features/socrates-study/components/shared'
import { TrainingCase } from '@/features/socrates-study/components/TrainingCase'
export const dynamic = 'force-dynamic'
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; caseId: string }>
}) {
  const { locale, caseId } = await params
  setRequestLocale(locale)
  if (!z.string().uuid().safeParse(caseId).success) notFound()
  const data = await requireSocratesUser()
    .then((session) => loadTraining(caseId, session))
    .catch(() => null)
  return (
    <StudyShell locale={locale}>
      {data ? (
        <TrainingCase initial={data} />
      ) : (
        <>
          <h1>Training case unavailable</h1>
          <p>Authorized participant access and a reviewed, published case are required.</p>
        </>
      )}
    </StudyShell>
  )
}
