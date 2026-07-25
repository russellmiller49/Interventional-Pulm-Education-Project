import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import {
  PreferenceCardWizard,
  type PreferenceCardScenarioBundle,
} from '@/features/preference-cards/components/PreferenceCardWizard'
import {
  buildDemoContext,
  getScenarioDefinitions,
} from '@/features/preference-cards/data/demo-context.server'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ scenario?: string | string[] }>
}

const modifiersByScenario: Record<string, string[]> = {
  'ebus-rose-molecular': ['ROSE', 'SPEC_MOLECULAR'],
  'central-airway-obstruction': [
    'RIGID_AIRWAY',
    'APC',
    'BALLOON_DILATION',
    'STENT_PLACE',
    'JET_VENT',
    'FLUOROSCOPY',
    'HIGH_BLEED_RISK',
  ],
  'chest-tube': ['TECH_CHEST_TUBE_SMALL_BORE', 'TECH_CHEST_TUBE_LARGE_BORE', 'DIGITAL_DRAINAGE'],
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards' })
  return {
    title: t('createNewCard'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false },
  }
}

export default async function NewPreferenceCardPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const query = await searchParams
  setRequestLocale(locale)
  const scenarioParam = Array.isArray(query.scenario) ? query.scenario[0] : query.scenario
  const bundles: PreferenceCardScenarioBundle[] = getScenarioDefinitions().map((definition) => ({
    definition,
    context: buildDemoContext(definition.id),
    availableModifierCodes: modifiersByScenario[definition.id] ?? [],
  }))

  return (
    <div className="container py-8 md:py-12">
      <PreferenceCardWizard bundles={bundles} initialScenarioId={scenarioParam} />
    </div>
  )
}
