import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { McsLearnLanding } from '@/features/mechanical-circulatory-support/components/McsLearnLanding'
import { McsModuleFrame } from '@/features/mechanical-circulatory-support/components/McsModuleFrame'
import { McsWorkbench } from '@/features/mechanical-circulatory-support/components/McsWorkbench'
import type { McsDeviceKind } from '@/features/mechanical-circulatory-support/engine'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Learn · Mechanical Circulatory Support ICU Lab',
  description:
    'An ordered nine-section MCS pathway: two shared foundations, three device pairs, and a cross-device selection capstone.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ device?: string | string[]; lesson?: string | string[] }>
}

function requestedDevice(value: string | string[] | undefined): McsDeviceKind | undefined {
  const device = Array.isArray(value) ? value[0] : value
  return device === 'iabp' || device === 'impella' || device === 'lvad' ? device : undefined
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  return localizeHandoffServerValue(locale, pageMetadata)
}
export default async function MechanicalCirculatorySupportLearnPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params
  const query = searchParams ? await searchParams : undefined
  const initialDevice = requestedDevice(query?.device)
  const initialActivityId = typeof query?.lesson === 'string' ? query.lesson : undefined
  setRequestLocale(locale)

  // With no section or device selected, show the pathway landing rather than dropping the learner
  // into the workbench at section one.
  if (!initialActivityId && !initialDevice) {
    return (
      <McsModuleFrame locale={locale} activeHref={`${mechanicalCirculatorySupportNavBase}/learn`}>
        <McsLearnLanding />
      </McsModuleFrame>
    )
  }

  return (
    <McsWorkbench
      key={initialActivityId ?? initialDevice ?? 'overview'}
      section="learn"
      locale={locale}
      initialDevice={initialDevice}
      initialActivityId={initialActivityId}
    />
  )
}
