import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationCourseCheck } from '@/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck'
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
  title: 'Final check · Mechanical Ventilation',
  description:
    'An independent mixed knowledge check after the mechanical ventilation learning path.',
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

  return (
    <MechanicalVentilationModuleFrameV2 activeHref="/mechanical-ventilation/assess">
      <MechanicalVentilationCourseCheck kind="final" />
    </MechanicalVentilationModuleFrameV2>
  )
}
