import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EmbeddedTrainingModuleFrame } from '@/components/ebus-training/EmbeddedTrainingModuleFrame'
import { getPublicEbusTrainingModule, publicEbusTrainingModules } from '@/data/ebus-training'

interface EbusTrainingModulePageProps {
  params: Promise<{ module: string }>
}

export function generateStaticParams() {
  return publicEbusTrainingModules.map((module) => ({ module: module.slug }))
}

export async function generateMetadata({ params }: EbusTrainingModulePageProps): Promise<Metadata> {
  const { module: moduleSlug } = await params
  const trainingModule = getPublicEbusTrainingModule(moduleSlug)

  if (!trainingModule) {
    return {
      title: 'EBUS training module not found',
    }
  }

  return {
    title: `${trainingModule.title} | EBUS Training`,
    description: trainingModule.description,
  }
}

export default async function EbusTrainingModulePage({ params }: EbusTrainingModulePageProps) {
  const { module: moduleSlug } = await params
  const trainingModule = getPublicEbusTrainingModule(moduleSlug)

  if (!trainingModule) {
    notFound()
  }

  return (
    <EmbeddedTrainingModuleFrame
      backHref="/ebus-training"
      backLabel="Back to EBUS Training"
      module={trainingModule}
    />
  )
}
