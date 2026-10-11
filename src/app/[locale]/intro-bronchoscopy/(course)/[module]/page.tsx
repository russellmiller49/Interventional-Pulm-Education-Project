import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { IntroBronchoscopyModulePage } from '@/features/intro-bronchoscopy/components/IntroBronchoscopyModulePage'
import {
  getIntroBronchoscopyModule,
  introBronchoscopyModules,
} from '@/features/intro-bronchoscopy/content/modules'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

interface PageProps {
  params: Promise<{ locale: string; module: string }>
}

export function generateStaticParams() {
  return introBronchoscopyModules
    .filter((courseModule) => courseModule.slug !== 'airway-anatomy')
    .map((courseModule) => ({ module: courseModule.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, module: moduleSlug } = await params
  const courseModule = getIntroBronchoscopyModule(moduleSlug)

  if (!courseModule) {
    return localizeHandoffServerValue(locale, {
      title: 'Intro Bronchoscopy Module',
      description: 'Introductory bronchoscopy learning module.',
    })
  }

  return localizeHandoffServerValue(locale, {
    title: `${courseModule.title} - Intro to Bronchoscopy`,
    description: courseModule.summary,
  })
}

export default async function IntroBronchoscopyModuleRoute({ params }: PageProps) {
  const { module: moduleSlug } = await params
  const courseModule = getIntroBronchoscopyModule(moduleSlug)

  if (!courseModule || courseModule.slug === 'airway-anatomy') {
    notFound()
  }

  return <IntroBronchoscopyModulePage module={courseModule} />
}
