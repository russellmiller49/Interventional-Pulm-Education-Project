import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import {
  PreferenceCardWizard,
  type PreferenceCardScenarioBundle,
} from '@/features/preference-cards/components/PreferenceCardWizard'
import {
  buildDemoContext,
  getScenarioDefinition,
  getScenarioDefinitions,
} from '@/features/preference-cards/data/demo-context.server'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ scenario?: string | string[] }>
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
  const scenarios = getScenarioDefinitions()
  // Only the selected scenario's context is built and serialized. Building all fifteen
  // would ship megabytes of recipe and hospital-item data on every page load.
  //
  // Looked up by id rather than found in the list, because the custom module composition is
  // a real scenario that is deliberately absent from the procedure picker — it is offered
  // as its own entry point instead.
  const selected = scenarioParam ? getScenarioDefinition(scenarioParam) : null
  const bundle: PreferenceCardScenarioBundle | undefined = selected
    ? {
        definition: selected,
        context: buildDemoContext(selected.id),
        availableModifierCodes: selected.availableModifierCodes,
      }
    : undefined

  return (
    <div className="container py-8 md:py-12">
      <PreferenceCardWizard
        scenarios={scenarios}
        bundle={bundle}
        initialScenarioId={scenarioParam}
      />
    </div>
  )
}
