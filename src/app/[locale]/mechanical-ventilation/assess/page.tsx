import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationAssessSetupV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationAssessSetupV2'
import { MechanicalVentilationCaseActivityLoader } from '@/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityLoader'
import { MechanicalVentilationModuleFrameV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrameV2'
import {
  MECHANICAL_VENTILATION_ASSESSMENT_ID,
  mechanicalVentilationCases,
  selectVentilationAssessmentCaseId,
} from '@/features/mechanical-ventilation/content'
import {
  ventilatorDeviceIds,
  type VentilatorDeviceId,
} from '@/features/mechanical-ventilation/engine'

export const metadata: Metadata = {
  title: 'Assess · Mechanical Ventilation',
  description:
    'A seeded, masked mechanical-ventilation challenge using the preserved case engine, scoring, and mastery rules.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    case?: string | string[]
    seed?: string | string[]
    device?: string | string[]
  }>
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export default async function MechanicalVentilationAssessPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = (await searchParams) ?? {}
  const assessmentId = single(query.case)
  const seed = single(query.seed)
  const requestedDevice = single(query.device)
  const deviceId = ventilatorDeviceIds.includes(requestedDevice as VentilatorDeviceId)
    ? (requestedDevice as VentilatorDeviceId)
    : undefined
  const validSeed = seed && /^[a-z0-9-]{1,64}$/i.test(seed) ? seed : undefined
  const selectedCaseId = validSeed
    ? selectVentilationAssessmentCaseId(
        validSeed,
        mechanicalVentilationCases.map((definition) => definition.id),
      )
    : null
  setRequestLocale(locale)

  if (
    assessmentId === MECHANICAL_VENTILATION_ASSESSMENT_ID &&
    validSeed &&
    deviceId &&
    selectedCaseId
  ) {
    return (
      <MechanicalVentilationCaseActivityLoader
        locale={locale}
        caseId={selectedCaseId}
        deviceId={deviceId}
        mode="challenge"
        section="assess"
        seedToken={validSeed}
      />
    )
  }

  const hadIncompleteQuery = Boolean(assessmentId || seed || requestedDevice)
  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation/assess">
      <MechanicalVentilationAssessSetupV2
        compatibilityNotice={
          hadIncompleteQuery
            ? 'The assessment seed or console was missing or incompatible. A new challenge must be launched from setup.'
            : undefined
        }
      />
    </MechanicalVentilationModuleFrameV2>
  )
}
