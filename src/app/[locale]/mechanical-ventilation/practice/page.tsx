import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationCaseActivityLoader } from '@/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityLoader'
import { MechanicalVentilationModuleFrameV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2'
import { MechanicalVentilationPracticeSetupV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationPracticeSetupV2'
import { mechanicalVentilationCaseById } from '@/features/mechanical-ventilation/content'
import {
  ventilatorDeviceIds,
  type VentilatorDeviceId,
} from '@/features/mechanical-ventilation/engine'
import type { CriticalCareActivityMode } from '@/features/learning-module/activity'

export const metadata: Metadata = {
  title: 'Practice · Mechanical Ventilation',
  description:
    'All fifteen preserved mechanical-ventilation cases with sequential device, support, and case setup.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    case?: string | string[]
    device?: string | string[]
    mode?: string | string[]
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

  const hadIncompleteQuery = Boolean(caseId || requestedDevice || requestedMode)
  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation/practice">
      <MechanicalVentilationPracticeSetupV2
        compatibilityNotice={
          hadIncompleteQuery
            ? 'The case, console, or support parameters were missing or incompatible. No simulator state was guessed.'
            : undefined
        }
      />
    </MechanicalVentilationModuleFrameV2>
  )
}
