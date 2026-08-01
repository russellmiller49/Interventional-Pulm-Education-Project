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
import { getCurrentReleaseBundleForScenario } from '@/features/preference-cards/data/release-bundles.server'

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
  // Which release a new card is pinned to comes from the explicit current-release pointer and
  // from nowhere else — not the highest version, not the newest publication date, not the last
  // entry in the file. Null when nothing points at one, and the builder then refuses to save
  // rather than producing an unpinned card that looks pinned.
  const currentRelease = selected ? getCurrentReleaseBundleForScenario(selected.id) : null
  const bundle: PreferenceCardScenarioBundle | undefined = selected
    ? {
        definition: selected,
        context: buildDemoContext(selected.id),
        availableModifierCodes: selected.availableModifierCodes,
        releaseBundleId: currentRelease?.id ?? null,
      }
    : undefined

  return (
    <div className="container py-8 md:py-12">
      {/*
        Keyed on the scenario so choosing a different procedure remounts the builder.
        `selectScenario` navigates by search param only, and the App Router deliberately
        preserves segment state across that — without a key the wizard keeps the previous
        procedure's `useState` seeds, so a card saved after switching carries the *old*
        procedure's modules (rejected server-side) and a card built from the picker after
        landing here with no `?scenario=` saves with no default modules and no default
        modifiers at all.
      */}
      <PreferenceCardWizard
        key={scenarioParam ?? 'no-scenario'}
        scenarios={scenarios}
        bundle={bundle}
        initialScenarioId={scenarioParam}
      />
    </div>
  )
}
