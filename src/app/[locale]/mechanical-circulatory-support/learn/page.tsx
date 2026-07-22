import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { McsWorkbench } from '@/features/mechanical-circulatory-support/components/McsWorkbench'
import type { McsDeviceKind } from '@/features/mechanical-circulatory-support/engine'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const pageMetadata: Metadata = {
  title: 'Learn · Mechanical Circulatory Support ICU Lab',
  description:
    'Eight guided lessons on signals, support mechanisms, IABP, Impella, and durable LVAD ICU assessment.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ device?: string | string[] }>
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
  setRequestLocale(locale)
  return (
    <McsWorkbench
      key={initialDevice ?? 'overview'}
      section="learn"
      locale={locale}
      initialDevice={initialDevice}
    />
  )
}
