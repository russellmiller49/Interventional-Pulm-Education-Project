import { setRequestLocale } from 'next-intl/server'
import { IntegratedCasesPage } from '@/features/ebus-guided/components/IntegratedCasesPage'
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ case?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const query = (await searchParams).case,
    caseId = Array.isArray(query) ? query[0] : query
  return <IntegratedCasesPage locale={locale} caseId={caseId} />
}
