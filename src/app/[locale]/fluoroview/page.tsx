import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { PeripheralImagingCourse } from '@/features/peripheral-imaging/components/PeripheralImagingCourse'

const handoffMetadata: Metadata = {
  title: 'Peripheral Bronchoscopy Imaging | FluoroView',
  description:
    'A complete interactive course on optimizing 2D fluoroscopy, digital tomosynthesis, fixed and mobile cone-beam CT, tool confirmation and radiation protection in peripheral bronchoscopy.',
}
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}
export default async function FluoroViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <HandoffContent>
      <div className="mx-auto w-full max-w-[1664px] px-0 py-6 sm:px-5 md:py-10">
        <PeripheralImagingCourse />
      </div>
    </HandoffContent>
  )
}
