import type { Metadata, Route } from 'next'
import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import { EmbeddedTrainingModuleFrame } from '@/components/ebus-training/EmbeddedTrainingModuleFrame'
import {
  allEbusTrainingModules,
  getAnyEbusTrainingModule,
  getEbusTrainingModule,
} from '@/data/ebus-training'
import { HandoffContent } from '@/i18n/handoff'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'
import { defaultLocale, isActiveLocale } from '@/i18n/locale'

interface EbusTrainingModulePageProps {
  params: Promise<{ locale: string; module: string }>
}

export function generateStaticParams() {
  return allEbusTrainingModules.map((module) => ({ module: module.slug }))
}

export async function generateMetadata({ params }: EbusTrainingModulePageProps): Promise<Metadata> {
  const { locale: rawLocale, module: moduleSlug } = await params
  const locale = isActiveLocale(rawLocale) ? rawLocale : defaultLocale
  const trainingModule = getAnyEbusTrainingModule(moduleSlug)

  if (!trainingModule) {
    return localizeHandoffServerValue(locale, {
      title: 'EBUS training module not found',
    })
  }

  const localized = await localizeHandoffServerValue(locale, {
    description: trainingModule.description,
    sectionTitle: 'EBUS Training',
    title: trainingModule.title,
  })

  return {
    title: `${localized.title} | ${localized.sectionTitle}`,
    description: localized.description,
  }
}

export default async function EbusTrainingModulePage({ params }: EbusTrainingModulePageProps) {
  const { locale, module: moduleSlug } = await params
  setRequestLocale(locale)

  if (moduleSlug === 'virtual-bronchoscopy') {
    redirect('/ebus-training/simulator' as Route)
  }

  const trainingModule = getEbusTrainingModule(moduleSlug)

  if (!trainingModule) {
    notFound()
  }

  return (
    <HandoffContent>
      {
        <EmbeddedTrainingModuleFrame
          backHref="/ebus-training"
          backLabel="Back to EBUS Training"
          locale={locale}
          module={trainingModule}
        />
      }
    </HandoffContent>
  )
}
