import { notFound } from 'next/navigation'
import { betaModuleById } from '@/features/module-beta/catalog'
import { BetaTestingFrame } from '@/features/module-beta/BetaTestingFrame'

export default async function BetaModulePage({
  params,
}: {
  params: Promise<{ locale: string; module: string }>
}) {
  const { locale, module: id } = await params
  const moduleEntry = betaModuleById(id)
  if (!moduleEntry) notFound()
  return <BetaTestingFrame moduleEntry={moduleEntry} locale={locale} />
}
