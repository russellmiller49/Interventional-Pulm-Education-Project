import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MechanicalVentilationLabPage } from '@/features/mechanical-ventilation/components/MechanicalVentilationLabPage'

export const metadata: Metadata = {
  title: 'Ventilator lab · Mechanical Ventilation',
  description:
    'Free exploration on the full ventilator console: any case, any console, any setting, with the simplified dynamic lung panel.',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function MechanicalVentilationLabRoute({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return <MechanicalVentilationLabPage locale={locale} />
}
