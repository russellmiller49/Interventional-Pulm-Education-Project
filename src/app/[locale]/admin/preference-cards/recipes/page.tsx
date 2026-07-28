import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { ReadinessBadge } from '@/features/preference-cards/components/ReadinessBadge'
import {
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
  }))

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.recipesTitle')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('admin.adminDescription')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

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
    </div>
  )
}
