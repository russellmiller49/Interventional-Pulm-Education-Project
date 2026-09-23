import { setRequestLocale } from 'next-intl/server'
import { z } from 'zod'
import { notFound } from 'next/navigation'
import {
  requireSocratesUser,
  loadTraining,
  curriculumCatalog,
} from '@/features/socrates-study/server/service'
import { StudyShell } from '@/features/socrates-study/components/shared'
import { moduleNavigation } from '@/features/socrates-study/curriculum'
import { ModuleNavigation } from '@/features/socrates-study/components/CurriculumDirectory'
import { TrainingCase } from '@/features/socrates-study/components/TrainingCase'
export const dynamic = 'force-dynamic'
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; caseId: string }>
  searchParams: Promise<{ module?: string }>
}) {
  const { locale, caseId } = await params
  const { module } = await searchParams
  setRequestLocale(locale)
  if (!z.string().uuid().safeParse(caseId).success) notFound()
  const data = await requireSocratesUser()
    .then((session) => loadTraining(caseId, session))
    .catch(() => null)
  const navigation = module
    ? await curriculumCatalog()
        .then((modules) => moduleNavigation(modules, module, caseId))
        .catch(() => null)
    : null
  return (
    <StudyShell locale={locale}>
      {data && (!module || navigation) ? (
        <>
          {navigation && <ModuleNavigation locale={locale} navigation={navigation} />}
          {!module && <a href={`/${locale}/socrates`}>Back to modules</a>}
          <TrainingCase initial={data} />
          {navigation && <ModuleNavigation locale={locale} navigation={navigation} />}
        </>
      ) : (
        <>
          <h1>Training case unavailable</h1>
          <a href={`/${locale}/socrates`}>Back to modules</a>
          <p>
            Authorized participant access, a reviewed published case, and valid selected module
            membership are required.
          </p>
        </>
      )}
    </StudyShell>
  )
}
