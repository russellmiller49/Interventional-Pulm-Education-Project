import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationAssessSetupV2 } from '@/features/mechanical-ventilation/components/MechanicalVentilationAssessSetupV2'
import { MechanicalVentilationCaseActivityLoader } from '@/features/mechanical-ventilation/components/MechanicalVentilationCaseActivityLoader'
import { MechanicalVentilationCourseCheck } from '@/features/mechanical-ventilation/components/MechanicalVentilationCourseCheck'
import { MechanicalVentilationModuleFrame } from '@/features/mechanical-ventilation/components/MechanicalVentilationModuleFrame'
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
    'An independent knowledge check after the mechanical ventilation pathway, and challenge cases with less prompting.',
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
    <MechanicalVentilationModuleFrame locale={locale} activeHref="/mechanical-ventilation/assess">
      <MechanicalVentilationCourseCheck kind="final" />
      <MechanicalVentilationAssessSetupV2
        compatibilityNotice={
          hadIncompleteQuery
            ? 'The challenge parameters were missing or incompatible. Set up the challenge again below.'
            : undefined
        }
      />
    </MechanicalVentilationModuleFrame>
  )
}
