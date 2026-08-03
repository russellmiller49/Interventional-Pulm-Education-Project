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
  // Parseable, exact about its recipe and modules, and still unable to back an edit: the
  // whole-set dependencies underneath were never pinned, so re-resolving would substitute
  // today's for the ones the card was built against.
  superseded_builder_inputs: 'edit.unavailableSuperseded',
  unknown_scenario: 'edit.unavailableProcedure',
  // Reconstruction requires a release pin; an input without one is refused rather than
  // rebuilt by a weaker route.
  builder_inputs_not_release_pinned: 'edit.unavailableSuperseded',
  // A product line recorded as a catalog-browsing key rather than a reviewed family. Reopening
  // would mean deciding which products that key stands for today, which is a guess about what the
  // physician is asking the room for — so the card stays exactly as it was saved.
  legacy_family_identity: 'edit.unavailableLegacyFamily',
  scenario_recipe_mismatch: 'edit.unavailableRecipeVersion',
  module_not_offered: 'edit.unavailableModule',
  modifier_not_offered: 'edit.unavailableModifier',
  // The catalog release this card was saved against is no longer retrievable intact, so product
  // and role identity cannot be reconstructed. Substituting today's catalog is the one thing the
  // pin exists to prevent.
  historical_catalog_unavailable: 'edit.unavailableCatalogRelease',
  catalog_pick_unavailable: 'edit.unavailableCatalog',
  product_family_unavailable: 'edit.unavailableCatalog',
  equipment_set_unavailable: 'edit.unavailableCatalog',
  // A pinned release that is gone, incomplete, or no longer hashes to what it published.
  // Each says the card was not rebuilt against something its author never reviewed, which is
  // the reason the builder is closed rather than an apology for closing it.
  release_unknown: 'edit.unavailableReleaseMissing',
  release_pin_missing: 'edit.unavailableReleaseMissing',
  release_definition_mutated: 'edit.unavailableReleaseChanged',
  release_not_selectable: 'edit.unavailableReleaseChanged',
  release_scenario_unavailable: 'edit.unavailableProcedure',
  release_scenario_mismatch: 'edit.unavailableRecipeVersion',
  release_recipe_mismatch: 'edit.unavailableRecipeVersion',
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
    // The card's *own* release, not the procedure's current one. Reopening a card is not an
    // occasion to move it forward, and a newer release existing changes nothing about it.
    releaseBundleId: rebuilt.releaseBundle?.id ?? null,
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
          // The content version this editor was opened against. It travels back with the save so
          // the database can refuse to apply it to a state somebody has since replaced.
          updatedAt: record.updatedAt,
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
