import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'
import { ModuleProgressToggle } from '@/features/learning-module/components/ModuleProgressToggle'
import { MalignantEffusionNav } from '@/features/malignant-effusion/components/MalignantEffusionNav'
import { MalignantEffusionPathway } from '@/features/malignant-effusion/components/MalignantEffusionPathway'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'malignantEffusion.practice' })

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function MalignantEffusionPracticePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('malignantEffusion')
  const nav = await getTranslations('navigation')

  return (
    <div className="space-y-10 py-16">
      {/* Disclaimer is rendered by the pathway's LessonScaffold, so suppress it here. */}
      <ModuleHeader
        eyebrow={nav('items.pleuralProcedures.title')}
        title={t('practice.headerTitle')}
        description={t('practice.headerDescription')}
        showDisclaimer={false}
      />
      <MalignantEffusionNav activeHref="/pleural-procedures/malignant-effusion/practice" />

      <MalignantEffusionPathway />

      <ModuleProgressToggle
        moduleId="malignant-effusion"
        section="practice"
        label={t('practice.progressLabel')}
      />
    </div>
  )
}
