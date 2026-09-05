import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationCaseActivityLoader } from '@/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityLoader'
import { MechanicalVentilationPracticePicker } from '@/features/mechanical-ventilation/components/MechanicalVentilationPracticePicker'
import { mechanicalVentilationCaseById } from '@/features/mechanical-ventilation/content'
import {
  ventilatorDeviceIds,
  type VentilatorDeviceId,
} from '@/features/mechanical-ventilation/engine'
import type { CriticalCareActivityMode } from '@/features/learning-module/activity'

export const metadata: Metadata = {
  title: 'Practice · Mechanical Ventilation',
  description:
    'Fifteen clinical mechanical-ventilation cases, each paired to the section that taught its mechanism, with console and prompting chosen once.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    case?: string | string[]
    device?: string | string[]
    mode?: string | string[]
    focus?: string | string[]
  }>
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function MechanicalVentilationPracticePage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const query = (await searchParams) ?? {}
  const caseId = single(query.case)
  const requestedDevice = single(query.device)
  const requestedMode = single(query.mode)
  const deviceId = ventilatorDeviceIds.includes(requestedDevice as VentilatorDeviceId)
    ? (requestedDevice as VentilatorDeviceId)
    : undefined
  const mode =
    requestedMode === 'guided' || requestedMode === 'practice'
      ? (requestedMode as CriticalCareActivityMode)
      : undefined
  const validCase = caseId ? mechanicalVentilationCaseById.has(caseId) : false
  setRequestLocale(locale)

  if (caseId && validCase && deviceId && mode) {
    return (
      <MechanicalVentilationCaseActivityLoader
        locale={locale}
        caseId={caseId}
        deviceId={deviceId}
        mode={mode}
        section="practice"
      />
    )
  }

  // A case named without a console or a prompting level opens the picker on that case rather than
  // guessing either; anything else incomplete is said so.
  const hadIncompleteQuery = Boolean((caseId && !validCase) || requestedDevice || requestedMode)
  return (
    <MechanicalVentilationPracticePicker
      locale={locale}
      requestedCaseId={validCase ? caseId : undefined}
      focusUnitId={single(query.focus)}
      compatibilityNotice={
        hadIncompleteQuery
          ? 'The case, console, or prompting parameters were missing or incompatible. No simulator state was guessed.'
          : undefined
      }
    />
  )
}
