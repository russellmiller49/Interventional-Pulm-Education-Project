import type { Metadata } from 'next'
import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  PreferenceCardWizard,
  type PreferenceCardScenarioBundle,
} from '@/features/preference-cards/components/PreferenceCardWizard'
import { cardIdSchema } from '@/features/preference-cards/schemas/saved-card'
import {
  loadEditableUserCard,
  type EditableCardErrorCode,
} from '@/features/preference-cards/server/user-cards'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; cardId: string }>
}

export const metadata: Metadata = {
  title: 'Edit preference card',
  robots: { index: false, follow: false, noarchive: true },
}

/**
 * Why a card cannot be reopened, in the physician's terms.
 *
 * A card that will not reopen is not a broken card — its snapshot is intact and still
 * prints — so these read as an explanation rather than an error. `not_found` never reaches
 * here: an id that is not the caller's own is a 404, the same answer a nonexistent id
 * gets, so a probe cannot tell the two apart.
 */
const explanationKeyByCode: Record<Exclude<EditableCardErrorCode, 'not_found'>, string> = {
  legacy_builder_inputs: 'edit.unavailableLegacy',
  unknown_scenario: 'edit.unavailableProcedure',
  recipe_version_unavailable: 'edit.unavailableRecipeVersion',
  recipe_module_unavailable: 'edit.unavailableModule',
  scenario_recipe_mismatch: 'edit.unavailableRecipeVersion',
  module_not_offered: 'edit.unavailableModule',
  catalog_pick_unavailable: 'edit.unavailableCatalog',
  product_family_unavailable: 'edit.unavailableCatalog',
  equipment_set_unavailable: 'edit.unavailableCatalog',
}

export default async function EditPreferenceCardPage({ params }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  if (!cardIdSchema.safeParse(cardId).success) notFound()

  const t = await getTranslations('preferenceCards')
  // Row-level security scopes this to the caller's own cards, so someone else's id reaches
  // `not_found` and 404s exactly as an unknown id does.
  const editable = await loadEditableUserCard(cardId)
  const cardHref = `/${locale}/preference-cards/${cardId}` as Route

  if (!editable.ok) {
    if (editable.code === 'not_found') notFound()
    return (
      <div className="container max-w-3xl space-y-6 py-8 md:py-12">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-bold text-foreground">{t('edit.unavailableTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t(explanationKeyByCode[editable.code])}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t('edit.unavailableSnapshotIntact')}
          </p>
          {editable.message ? (
            <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 font-mono text-xs text-muted-foreground">
              {editable.message}
            </p>
          ) : null}
          <div className="mt-6">
            <Button asChild>
              <Link href={cardHref}>{t('edit.backToCard')}</Link>
            </Button>
          </div>
        </section>
      </div>
    )
  }

  const { record, builderInputs, rebuilt } = editable
  // The pinned recipe's context, not "whatever this scenario builds today" — `rebuilt`
  // resolved it from the card's own `recipeVersionId`.
  const bundle: PreferenceCardScenarioBundle = {
    definition: rebuilt.scenario,
    context: rebuilt.context,
    availableModifierCodes: rebuilt.scenario.availableModifierCodes,
  }

  return (
    <div className="container py-8 md:py-12">
      <PreferenceCardWizard
        mode="edit"
        // The procedure picker is not rendered in edit mode, so its fifteen definitions are
        // not serialized to the client either.
        scenarios={[]}
        bundle={bundle}
        initialScenarioId={rebuilt.scenario.id}
        initialState={{
          cardId: record.id,
          title: record.title,
          physicianName: record.physicianName,
          status: record.status,
          builderInputs,
          catalogPicks: rebuilt.catalogPicks,
          familyPicks: rebuilt.familyPicks,
          equipmentSets: rebuilt.equipmentSets,
        }}
      />
    </div>
  )
}
