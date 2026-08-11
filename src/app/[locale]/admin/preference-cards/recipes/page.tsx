import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { ReadinessBadge } from '@/features/preference-cards/components/ReadinessBadge'
import { ReleaseBundleTable } from '@/features/preference-cards/components/ReleaseBundleTable'
import {
  getReleaseImpactReports,
  getReleasePointers,
  getRetainedReleaseBundles,
} from '@/features/preference-cards/data/release-bundles.server'
import {
  buildDemoContext,
  getComposedRecipeSlots,
  getProcedureCompositions,
  getRecipeModuleCatalog,
  getScenarioDefinitions,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'

export const metadata: Metadata = {
  title: 'Preference-card recipes',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function PreferenceCardRecipesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const scenarios = getScenarioDefinitions().map((scenario) => ({
    ...scenario,
    card: resolveDemoScenario(scenario.id),
    modules: buildDemoContext(scenario.id).recipeModules,
    // The effective preview: the procedure's own requirements plus everything it inherits,
    // each read-only and labelled with the module that owns it. Editing an inherited
    // requirement is a change to the module, not to the procedure.
    effectiveSlots: getComposedRecipeSlots(scenario.id),
  }))

  const compositions = getProcedureCompositions()
  const scenarioByProcedure = new Map(
    scenarios.map((scenario) => [scenario.sourceProcedureCode, scenario]),
  )
  // Which procedures a module version is actually reachable from, and whether any of them
  // currently resolves with a composition conflict. Both are computed from the same
  // resolved cards the table above shows, so the two halves of the page cannot disagree.
  const moduleRows = getRecipeModuleCatalog()
    .map((module) => {
      const usedBy = compositions
        .filter((composition) =>
          composition.moduleReferences.some((reference) => reference.moduleVersionId === module.id),
        )
        .map((composition) => composition.procedureCode)
        .sort()
      const conflicts = usedBy.reduce((total, procedureCode) => {
        const scenario = scenarioByProcedure.get(procedureCode)
        if (!scenario) return total
        return (
          total +
          scenario.card.warnings.filter(
            (warning) =>
              warning.code.startsWith('recipe_composition') && warning.sourceId === module.id,
          ).length
        )
      }, 0)
      return { module, usedBy, conflicts }
    })
    .sort(
      (left, right) =>
        left.module.kind.localeCompare(right.module.kind) ||
        left.module.code.localeCompare(right.module.code),
    )

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.recipesTitle')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('admin.adminDescription')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <ReleaseBundleTable
        bundles={getRetainedReleaseBundles()}
        pointers={getReleasePointers()}
        impact={getReleaseImpactReports()}
        labels={{
          heading: t('admin.releasesTitle'),
          description: t('admin.releasesDescription'),
          release: t('admin.release'),
          procedure: t('admin.procedure'),
          state: t('admin.releaseState'),
          published: t('admin.publishedRetired'),
          pins: t('admin.pinnedDefinitions'),
          impactColumn: t('admin.releaseImpact'),
          current: t('admin.currentRelease'),
          superseded: t('admin.supersedes'),
          noChange: t('admin.releaseNoChange'),
          initial: t('admin.releaseInitial'),
          modules: t('admin.modulePins'),
          recipe: t('admin.recipe'),
          requirementChanges: t('admin.requirementChanges'),
          modifierEffectChanges: t('admin.modifierEffectChanges'),
          modifierEffectNote: t('admin.modifierEffectNote'),
        }}
      />

      <p id="recipe-coverage-help" className="max-w-4xl text-sm text-muted-foreground">
        {t('coverageMetricHelp')}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t('admin.recipe')}</th>
              <th className="px-4 py-3">{t('admin.version')}</th>
              <th className="px-4 py-3">{t('admin.governance')}</th>
              <th className="px-4 py-3">{t('admin.owner')}</th>
              <th className="px-4 py-3">{t('admin.compositionColumn')}</th>
              <th className="px-4 py-3" aria-describedby="recipe-coverage-help">
                {t('admin.catalogAlternatives')}
              </th>
              <th className="px-4 py-3" aria-describedby="recipe-coverage-help">
                {t('admin.curatedDefaults')}
              </th>
              <th className="px-4 py-3">{t('admin.unresolved')}</th>
              <th className="px-4 py-3">{t('cardMetadata.readiness')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scenarios.map((scenario) => (
              <tr key={scenario.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{scenario.title}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {scenario.sourceProcedureCode}
                  </p>
                </td>
                <td className="px-4 py-4">0.1</td>
                <td className="px-4 py-4">
                  <Badge variant="outline">{scenario.governanceState}</Badge>
                </td>
                <td className="px-4 py-4">{scenario.owner ?? t('ownerNotAssigned')}</td>
                <td className="px-4 py-4">
                  <ul className="space-y-1">
                    {scenario.modules.map((module) => (
                      <li key={module.id} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-foreground">{module.name}</span>
                        <code className="text-[10px] text-muted-foreground">v{module.version}</code>
                        <Badge variant={module.kind === 'core' ? 'info' : 'outline'} size="sm">
                          {t(`modules.kind.${module.kind}`)}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          {module.governanceState}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      {t('admin.effectivePreview')}
                    </summary>
                    <p className="mt-1 max-w-md leading-5 text-muted-foreground">
                      {t('admin.effectivePreviewHelp')}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {scenario.effectiveSlots.map((slot) => {
                        const owner = scenario.modules.find((module) =>
                          (slot.sourceModuleVersionIds ?? []).includes(module.id),
                        )
                        return (
                          <li key={slot.id} className="flex flex-wrap items-baseline gap-2">
                            <span className="text-foreground">{slot.label}</span>
                            <code className="text-[10px] text-muted-foreground">
                              {slot.requirementKey}
                            </code>
                            {owner ? (
                              <Badge variant={owner.kind === 'core' ? 'info' : 'outline'} size="sm">
                                {owner.kind === 'core'
                                  ? t('admin.inheritedFrom', { module: owner.name })
                                  : owner.name}
                              </Badge>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                </td>
                <td
                  className="px-4 py-4"
                  aria-label={t('catalogAlternatives', {
                    count: scenario.requiredCatalogCoverageCount,
                    total: scenario.requiredSlotCount,
                  })}
                >
                  {t('coverageFraction', {
                    count: scenario.requiredCatalogCoverageCount,
                    total: scenario.requiredSlotCount,
                  })}
                </td>
                <td
                  className="px-4 py-4"
                  aria-label={t('curatedDefaults', {
                    count: scenario.requiredDefaultOptionCoverageCount,
                    total: scenario.requiredSlotCount,
                  })}
                >
                  {t('coverageFraction', {
                    count: scenario.requiredDefaultOptionCoverageCount,
                    total: scenario.requiredSlotCount,
                  })}
                </td>
                <td className="px-4 py-4">
                  {scenario.card.items.filter((item) => item.resolutionState === 'blocking').length}
                </td>
                <td className="px-4 py-4">
                  <ReadinessBadge
                    state={scenario.card.readinessState}
                    label={t(`readiness.${scenario.card.readinessState}`)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{t('admin.modulesTitle')}</h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t('admin.modulesDescription')}
          </p>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{t('admin.moduleImpact')}:</span>{' '}
            {t('admin.moduleImpactHelp')}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('admin.moduleCode')}</th>
                <th className="px-4 py-3">{t('admin.moduleKind')}</th>
                <th className="px-4 py-3">{t('admin.version')}</th>
                <th className="px-4 py-3">{t('admin.governance')}</th>
                <th className="px-4 py-3">{t('admin.owner')}</th>
                <th className="px-4 py-3">{t('admin.operationalOwner')}</th>
                <th className="px-4 py-3">{t('admin.moduleRequirements')}</th>
                <th className="px-4 py-3">{t('admin.moduleUsedBy')}</th>
                <th className="px-4 py-3">{t('admin.moduleConflicts')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {moduleRows.map(({ module, usedBy, conflicts }) => (
                <tr key={module.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-foreground">{module.name}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {module.code}
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                      {module.description}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={module.kind === 'core' ? 'info' : 'outline'}>
                      {t(`modules.kind.${module.kind}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">{module.version}</td>
                  <td className="px-4 py-4">
                    <Badge variant="outline">{module.governanceState}</Badge>
                  </td>
                  <td className="px-4 py-4">{module.clinicalOwner ?? t('ownerNotAssigned')}</td>
                  <td className="px-4 py-4">{module.operationalOwner ?? t('ownerNotAssigned')}</td>
                  <td className="px-4 py-4">{module.slots.length}</td>
                  <td className="px-4 py-4">
                    {usedBy.length === 0 ? (
                      t('admin.noModuleUse')
                    ) : (
                      <ul className="space-y-0.5 font-mono text-[11px]">
                        {usedBy.map((procedureCode) => (
                          <li key={procedureCode}>{procedureCode}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {conflicts === 0 ? t('admin.noConflicts') : conflicts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
