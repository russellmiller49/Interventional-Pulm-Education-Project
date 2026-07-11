import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { AirwayStentMechanicsModule } from '@/features/airway-stent-mechanics/components/AirwayStentMechanicsModule'

export const metadata: Metadata = {
  title: 'Airway Stent Mechanics Lab',
  description:
    'Interactive 3D deep dive into airway stent radial support, chronic outward force, compression resistance, axial force, conformability, migration, tissue contact, and fatigue.',
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function AirwayStentMechanicsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)

  return <AirwayStentMechanicsModule />
}
