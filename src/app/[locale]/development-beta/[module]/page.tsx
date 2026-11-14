import { notFound } from 'next/navigation'
import { betaModuleById } from '@/features/module-beta/catalog'
import { betaRollout } from '@/features/module-beta/rollout'
import { BetaTestingFrame } from '@/features/module-beta/BetaTestingFrame'

export default async function BetaModulePage({
  params,
}: {
  params: Promise<{ locale: string; module: string }>
}) {
  const { locale, module: id } = await params
  const moduleEntry = betaModuleById(id)
  if (!moduleEntry) notFound()
  // Read here, on the server, so the hub's rollout notes stay out of the frame's client bundle.
  const note = betaRollout[moduleEntry.id].note
  return (
    <BetaTestingFrame
      moduleEntry={moduleEntry}
      locale={locale}
      reviewNote={note ? { audience: note.audience, prompts: note.lookFor } : null}
    />
  )
}
