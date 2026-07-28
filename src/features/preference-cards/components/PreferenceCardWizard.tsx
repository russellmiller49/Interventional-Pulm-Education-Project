'use client'

import { useMemo, useState, useTransition } from 'react'
import type { Route } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  FileCheck2,
  FlaskConical,
  ListChecks,
  Settings2,
  Stethoscope,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { saveUserCardAction } from '@/app/[locale]/preference-cards/new/actions'

import { resolveCard } from '../domain/resolve-card'
import type {
  BuildContext,
  ConditionalState,
  HospitalItem,
  HospitalRoleOption,
  ModifierGroup,
  ScenarioDefinition,
} from '../domain/types'
import { PreferenceCardTabs } from './PreferenceCardViews'
import { PrototypeBanner } from './PrototypeBanner'
import { ReadinessBadge } from './ReadinessBadge'
import { CatalogOptionPicker } from './CatalogOptionPicker'
import { catalogPickItemId, withCatalogPicks, type CatalogPick } from '../domain/catalog-pick'
import { withFamilyPicks, type FamilyPick } from '../domain/family-pick'
import { customItemId, withCustomItems, type CustomItem } from '../domain/custom-item'
import { CustomItemForm } from './CustomItemForm'
import { familyPickId } from '../domain/size-at-procedure'
import { equipmentSetIdFromItemId, withEquipmentSets } from '../domain/equipment-set'
import { useEquipmentSets } from '../hooks/useEquipmentSets'

export interface PreferenceCardScenarioBundle {
  definition: ScenarioDefinition
  context: BuildContext
  availableModifierCodes: string[]
}

interface PreferenceCardWizardProps {
  /** Lightweight summaries for the procedure picker; no build context attached. */
  scenarios: ScenarioDefinition[]
  /**
   * The one scenario the page resolved server-side. Only this context is serialized to the
   * client — building all of them would ship megabytes per page load.
   */
  bundle?: PreferenceCardScenarioBundle
  initialScenarioId?: string
}

const wizardSteps = [
  { key: 'procedure', icon: Stethoscope },
  { key: 'modifiers', icon: Settings2 },
  { key: 'requirements', icon: ListChecks },
  { key: 'review', icon: FileCheck2 },
] as const

const modifierGroupOrder: ModifierGroup[] = [
  'location',
  'anesthesia_airway',
  'imaging_navigation',
  'sampling',
  'therapeutic',
  'risk_rescue',
  'pleural',
]

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

interface BuilderLocalOption {
  item: HospitalItem
  option: HospitalRoleOption
}

function isNormalBuilderOption(item: HospitalItem): boolean {
  // Unverified products are selectable and badged rather than withheld, matching the
  // explorer and the resolver. Only an explicitly hidden item is kept out of the list —
  // otherwise a product added from the catalog would resolve the requirement while still
  // showing as "Unresolved" in the dropdown.
  return item.active && item.verificationState !== 'hidden'
}

function builderOptionText({ item, option }: BuilderLocalOption): string {
  return [
    humanize(option.substitutionClass),
    item.localDescription,
    item.catalogProduct?.manufacturer,
    item.catalogProduct?.catalogNumber,
    item.localItemNumber ? `Local #${item.localItemNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const emptyProductIds: Set<string> = new Set()
const emptyFamilyKeys: Set<string> = new Set()

export function PreferenceCardWizard({
  scenarios,
  bundle,
  initialScenarioId,
}: PreferenceCardWizardProps) {
  const t = useTranslations('preferenceCards')
  const locale = useLocale()
  const router = useRouter()
  const [step, setStep] = useState(bundle ? 1 : 0)
  const scenarioId = bundle?.definition.id ?? initialScenarioId ?? ''
  const [modifierCodes, setModifierCodes] = useState<string[]>(
    bundle?.definition.defaultModifierCodes ?? [],
  )
  const [conditionalStates, setConditionalStates] = useState<Record<string, ConditionalState>>({})
  const [selectedHospitalItemIds, setSelectedHospitalItemIds] = useState<
    Record<string, string | null>
  >({})
  const [localOptionSearches, setLocalOptionSearches] = useState<Record<string, string>>({})
  const [waiverDrafts, setWaiverDrafts] = useState<Record<string, string>>({})
  // Products promoted out of the catalog into this card's eligible local options.
  const [catalogPicks, setCatalogPicks] = useState<CatalogPick[]>([])
  // Whole product lines, for requirements whose size is decided during the procedure.
  const [familyPicks, setFamilyPicks] = useState<FamilyPick[]>([])
  // Free-text lines, for the requirements with nothing catalogued.
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  // Saved equipment sets are offered on every requirement they cover.
  const { sets: equipmentSets } = useEquipmentSets()
  const [setRoleBySetId, setSetRoleBySetId] = useState<Record<string, string>>({})
  const [isGenerating, startGenerating] = useTransition()
  const [title, setTitle] = useState(bundle?.definition.title ?? '')
  const [physicianName, setPhysicianName] = useState('')
  const [status, setStatus] = useState<'draft' | 'final'>('draft')
  const [saveError, setSaveError] = useState<string | null>(null)
  // Preview only. The server stamps the real value at save time, and the snapshot hash
  // excludes it, so a frozen constant here keeps the preview hash stable while typing.
  const generatedAt = '2026-07-25T12:00:00.000Z'
  const waivers = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(waiverDrafts)
          .map(([id, reason]) => [id, reason.trim()] as const)
          .filter(([, reason]) => reason.length >= 10),
      ),
    [waiverDrafts],
  )
  const resolveContext = useMemo(() => {
    if (!bundle) return null
    return withEquipmentSets(
      withCustomItems(
        withFamilyPicks(withCatalogPicks(bundle.context, catalogPicks), familyPicks),
        customItems,
      ),
      equipmentSets,
      setRoleBySetId,
    )
  }, [bundle, catalogPicks, familyPicks, customItems, equipmentSets, setRoleBySetId])

  const localOptionsByRole = useMemo(() => {
    const result = new Map<string, BuilderLocalOption[]>()
    if (!resolveContext) return result
    const hospitalItemById = new Map(resolveContext.hospitalItems.map((item) => [item.id, item]))
    for (const option of resolveContext.hospitalRoleOptions) {
      const item = hospitalItemById.get(option.hospitalItemId)
      if (!option.active || !item || !isNormalBuilderOption(item)) continue
      const existing = result.get(option.roleCode) ?? []
      existing.push({ item, option })
      result.set(option.roleCode, existing)
    }
    for (const options of result.values()) {
      options.sort(
        (left, right) =>
          left.option.preferenceRank - right.option.preferenceRank ||
          left.option.id.localeCompare(right.option.id),
      )
    }
    return result
  }, [resolveContext])

  const card = useMemo(() => {
    if (!bundle || !resolveContext) return null
    return resolveCard(
      {
        organizationId: bundle.context.hospitalItems[0]?.organizationId ?? 'demo',
        siteId: bundle.context.hospitalItems[0]?.siteId ?? 'demo',
        locationId: bundle.context.hospitalItems[0]?.locationId ?? 'demo',
        recipeVersionId: bundle.context.recipe.id,
        modifierCodes,
        variables: { generated_at: generatedAt },
        conditionalStates,
        selectedHospitalItemIds,
        waivers,
      },
      resolveContext,
    )
  }, [bundle, resolveContext, conditionalStates, modifierCodes, selectedHospitalItemIds, waivers])

  const availableModifiers = bundle
    ? bundle.context.modifiers.filter((modifier) =>
        bundle.availableModifierCodes.includes(modifier.code),
      )
    : []

  // Choosing a procedure reloads the page for that scenario so only its context is sent.
  const selectScenario = (nextId: string) => {
    router.push(`/${locale}/preference-cards/new?scenario=${encodeURIComponent(nextId)}` as Route)
  }

  const toggleModifier = (code: string) => {
    setModifierCodes((current) =>
      current.includes(code)
        ? current.filter((candidate) => candidate !== code)
        : [...current, code],
    )
  }

  const pickedProductIdsByRole = useMemo(() => {
    const result = new Map<string, Set<string>>()
    for (const pick of catalogPicks) {
      const existing = result.get(pick.roleCode) ?? new Set<string>()
      existing.add(pick.productId)
      result.set(pick.roleCode, existing)
    }
    return result
  }, [catalogPicks])

  const pickedFamilyKeysByRole = useMemo(() => {
    const result = new Map<string, Set<string>>()
    for (const pick of familyPicks) {
      const existing = result.get(pick.roleCode) ?? new Set<string>()
      existing.add(pick.familyKey)
      result.set(pick.roleCode, existing)
    }
    return result
  }, [familyPicks])

  /** Promote a catalog product into this requirement's options and select it. */
  const addCatalogPick = (slotId: string, pick: CatalogPick) => {
    setCatalogPicks((current) =>
      current.some(
        (candidate) =>
          candidate.productId === pick.productId && candidate.roleCode === pick.roleCode,
      )
        ? current
        : [...current, pick],
    )
    setSelectedHospitalItemIds((current) => ({
      ...current,
      [slotId]: catalogPickItemId(pick.productId),
    }))
  }

  /** Add a line the catalog does not have, and select it. */
  const addCustomItem = (slotId: string, item: CustomItem) => {
    setCustomItems((current) => [...current, item])
    setSelectedHospitalItemIds((current) => ({
      ...current,
      [slotId]: customItemId(item.id),
    }))
  }

  /** Promote a whole product line, leaving the size to the procedure. */
  const addFamilyPick = (slotId: string, pick: FamilyPick) => {
    const requiresRoleScopedIdentity = familyPicks.some(
      (candidate) => candidate.familyKey === pick.familyKey && candidate.roleCode !== pick.roleCode,
    )
    setFamilyPicks((current) =>
      current.some(
        (candidate) =>
          candidate.familyKey === pick.familyKey && candidate.roleCode === pick.roleCode,
      )
        ? current
        : [...current, pick],
    )
    setSelectedHospitalItemIds((current) => {
      const next = { ...current }
      if (requiresRoleScopedIdentity) {
        const legacyId = familyPickId(pick.familyKey)
        for (const [selectedSlotId, selectedItemId] of Object.entries(next)) {
          if (selectedItemId !== legacyId) continue
          const selectedRole = card?.items.find((item) => item.id === selectedSlotId)?.roleCode
          if (selectedRole) {
            next[selectedSlotId] = familyPickId(pick.familyKey, selectedRole)
          }
        }
      }
      next[slotId] = familyPickId(
        pick.familyKey,
        requiresRoleScopedIdentity ? pick.roleCode : undefined,
      )
      return next
    })
  }

  const saveCard = () => {
    if (!bundle || !card) return
    setSaveError(null)
    startGenerating(async () => {
      const result = await saveUserCardAction({
        title: title.trim() || bundle.definition.title,
        physicianName: physicianName.trim() || null,
        status,
        scenarioId: bundle.definition.id,
        catalogPicks: catalogPicks.map((pick) => ({
          productId: pick.productId,
          roleCode: pick.roleCode,
        })),
        familyPicks: familyPicks.map((pick) => ({
          familyKey: pick.familyKey,
          roleCode: pick.roleCode,
        })),
        customItems,
        equipmentSets: equipmentSets
          .filter((set) => setRoleBySetId[set.id])
          .map((set) => ({
            id: set.id,
            name: set.name,
            description: set.description,
            selectedRoleCode: setRoleBySetId[set.id],
            additionalCoveredRoles: set.additionalCoveredRoles,
            members: set.members.map((member) => ({
              productId: member.productId,
              roleCode: member.roleCode,
            })),
          })),
        input: {
          organizationId: bundle.context.hospitalItems[0]?.organizationId ?? 'personal',
          siteId: bundle.context.hospitalItems[0]?.siteId ?? 'personal',
          locationId: bundle.context.hospitalItems[0]?.locationId ?? 'personal',
          recipeVersionId: bundle.context.recipe.id,
          modifierCodes,
          variables: { generated_at: generatedAt },
          conditionalStates,
          selectedHospitalItemIds,
          waivers,
        },
      })
      // A failed save says so. It used to fall through to a URL that encoded the whole card,
      // which looked like success and lost the card as soon as the link was gone.
      if (!result.ok || !result.cardId) {
        setSaveError(result.error ?? t('saveFailed'))
        return
      }
      router.push(`/${locale}/preference-cards/${result.cardId}` as Route)
    })
  }

  return (
    <div className="space-y-6">
      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <nav aria-label={t('step', { step: step + 1, total: wizardSteps.length })}>
        <ol className="grid gap-2 md:grid-cols-4">
          {wizardSteps.map((wizardStep, index) => {
            const Icon = wizardStep.icon
            const active = index === step
            const complete = index < step
            return (
              <li key={wizardStep.key}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      active || complete
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background',
                    )}
                  >
                    {complete ? (
                      <Check aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    )}
                  </span>
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider">
                      {t('step', {
                        step: index + 1,
                        total: wizardSteps.length,
                      })}
                    </span>
                    <span className="block text-sm font-semibold text-foreground">
                      {t(`steps.${wizardStep.key}`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <section className="rounded-3xl border border-border/80 bg-card/60 p-5 shadow-sm md:p-7">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t(`steps.${wizardSteps[step].key}`)}
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t(
                step === 0
                  ? 'selectProcedureHelp'
                  : step === 1
                    ? 'configureModifiersHelp'
                    : step === 2
                      ? 'requirementsHelp'
                      : 'reviewHelp',
              )}
            </p>
          </div>
          {card ? (
            <ReadinessBadge
              state={card.readinessState}
              label={t(`readiness.${card.readinessState}`)}
            />
          ) : null}
        </div>

        {step === 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {scenarios.map((definition) => {
              const selected = definition.id === scenarioId
              return (
                <Card
                  key={definition.id}
                  className={cn(
                    'h-full',
                    selected && 'border-2 border-primary shadow-lg shadow-primary/10',
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={selected ? 'default' : 'outline'}>
                        {selected ? t('selected') : definition.governanceState}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2">{definition.title}</CardTitle>
                    <CardDescription>{definition.shortDescription}</CardDescription>
                    <div
                      className="mt-3 rounded-xl bg-muted/60 p-3 text-xs"
                      aria-describedby={`coverage-help-${definition.id}`}
                    >
                      <p className="font-semibold text-foreground">
                        {t('catalogAlternatives', {
                          count: definition.requiredCatalogCoverageCount,
                          total: definition.requiredSlotCount,
                        })}
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {t('curatedDefaults', {
                          count: definition.requiredDefaultOptionCoverageCount,
                          total: definition.requiredSlotCount,
                        })}
                      </p>
                      <p
                        id={`coverage-help-${definition.id}`}
                        className="mt-2 leading-5 text-muted-foreground"
                      >
                        {t('coverageMetricHelp')}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">{t('sourceRecipe')}:</span>{' '}
                      {definition.sourceProcedureCode}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">{t('owner')}:</span>{' '}
                      {definition.owner ?? t('ownerNotAssigned')}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => selectScenario(definition.id)}
                    >
                      {selected ? t('selected') : t('select')}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        ) : null}

        {step === 1 && bundle && card ? (
          <div className="space-y-8">
            {modifierGroupOrder.map((group) => {
              const modifiers = availableModifiers.filter(
                (modifier) => modifier.groupCode === group,
              )
              if (modifiers.length === 0) return null
              return (
                <section key={group}>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {t(`modifierGroups.${group}`)}
                  </h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {modifiers.map((modifier) => {
                      const selected = modifierCodes.includes(modifier.code)
                      return (
                        <button
                          key={modifier.code}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleModifier(modifier.code)}
                          className={cn(
                            'rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selected
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-border bg-background hover:border-primary/40',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card',
                              )}
                            >
                              {selected ? (
                                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {modifier.name}
                                </span>
                                <code className="text-[10px] text-muted-foreground">
                                  {modifier.code}
                                </code>
                              </span>
                              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                                {modifier.description}
                              </span>
                              <span className="mt-2 block space-y-1">
                                {modifier.preview.map((preview) => (
                                  <span
                                    key={preview}
                                    className="block text-xs font-medium text-primary"
                                  >
                                    + {preview}
                                  </span>
                                ))}
                              </span>
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}

        {step === 2 && bundle && card ? (
          <div className="space-y-5">
            {/*
              One card per requirement rather than a 13-column table. The table needed
              1,450px before it could be read at all, so on anything narrower than a desktop
              the selection controls sat off-screen behind a horizontal scrollbar.
            */}
            <ul className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {card.items.map((item) => {
                const allOptions = localOptionsByRole.get(item.roleCode) ?? []
                const search = localOptionSearches[item.id]?.trim().toLocaleLowerCase() ?? ''
                const matchingOptions = search
                  ? allOptions.filter((candidate) =>
                      builderOptionText(candidate).toLocaleLowerCase().includes(search),
                    )
                  : allOptions
                const selectedOption = allOptions.find(
                  (candidate) => candidate.item.id === item.selectedHospitalItemId,
                )
                const visibleOptions =
                  selectedOption &&
                  !matchingOptions.some((candidate) => candidate.item.id === selectedOption.item.id)
                    ? [selectedOption, ...matchingOptions]
                    : matchingOptions
                const facts: [string, string][] = [
                  [t('columns.quantity'), item.quantityDisplay],
                  [t('columns.zone'), t(`spatialZones.${item.setupZone}`)],
                  [t('columns.phase'), t(`phases.${item.proceduralPhase}`)],
                  [t('columns.openHold'), humanize(item.openHoldStatus)],
                  [t('columns.verification'), humanize(item.verificationState)],
                  [t('columns.compatibility'), humanize(item.compatibilityState)],
                ]
                const sourceLine =
                  [
                    item.selectedItemSnapshot?.catalogProduct?.manufacturer,
                    item.selectedItemSnapshot?.catalogProduct?.catalogNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ') || null

                return (
                  <li key={item.id}>
                    <article
                      className={cn(
                        'flex h-full flex-col rounded-2xl border border-border bg-background p-4 shadow-sm',
                        item.resolutionState === 'blocking' &&
                          'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/10',
                      )}
                    >
                      <header className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground">{item.label}</h3>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {item.roleCode}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" size="sm">
                            {humanize(item.effectiveRequiredness)}
                          </Badge>
                          <Badge
                            variant={
                              item.resolutionState === 'blocking'
                                ? 'destructive'
                                : item.resolutionState === 'resolved'
                                  ? 'success'
                                  : 'outline'
                            }
                            size="sm"
                          >
                            {humanize(item.resolutionState)}
                          </Badge>
                        </div>
                      </header>

                      {item.dependencyRule ? (
                        <div className="mt-3">
                          <label
                            htmlFor={`conditional-${item.id}`}
                            className="text-[11px] font-semibold text-foreground"
                          >
                            {t('conditional.label')}
                          </label>
                          <select
                            id={`conditional-${item.id}`}
                            value={item.conditionalState ?? 'undecided'}
                            onChange={(event) =>
                              setConditionalStates((current) => ({
                                ...current,
                                [item.id]: event.target.value as ConditionalState,
                              }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {(['undecided', 'include', 'exclude'] as const).map((state) => (
                              <option key={state} value={state}>
                                {t(`conditional.${state}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <label htmlFor={`local-option-search-${item.id}`} className="sr-only">
                          {t('searchLocalOptionsFor', { requirement: item.label })}
                        </label>
                        <input
                          id={`local-option-search-${item.id}`}
                          type="search"
                          value={localOptionSearches[item.id] ?? ''}
                          onChange={(event) =>
                            setLocalOptionSearches((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder={t('searchLocalOptions')}
                          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <label htmlFor={`local-option-${item.id}`} className="sr-only">
                          {t('selectLocalOptionFor', { requirement: item.label })}
                        </label>
                        <select
                          id={`local-option-${item.id}`}
                          value={item.selectedHospitalItemId ?? ''}
                          onChange={(event) => {
                            const value = event.target.value || null
                            setSelectedHospitalItemIds((current) => ({
                              ...current,
                              [item.id]: value,
                            }))
                            // A set becomes the kit for the requirement it was chosen on,
                            // and suppresses the other requirements it covers.
                            const setId = value ? equipmentSetIdFromItemId(value) : null
                            if (setId) {
                              setSetRoleBySetId((current) => ({
                                ...current,
                                [setId]: item.roleCode,
                              }))
                            }
                          }}
                          className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">{t('unresolved')}</option>
                          {visibleOptions.map((candidate) => (
                            <option key={candidate.option.id} value={candidate.item.id}>
                              {builderOptionText(candidate)}
                            </option>
                          ))}
                        </select>
                        {search && matchingOptions.length === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('noEligibleLocalOptions')}
                          </p>
                        ) : null}
                        <CatalogOptionPicker
                          roleCode={item.roleCode}
                          roleLabel={item.label}
                          existingProductIds={
                            pickedProductIdsByRole.get(item.roleCode) ?? emptyProductIds
                          }
                          onAdd={(pick) => addCatalogPick(item.id, pick)}
                          existingFamilyKeys={
                            pickedFamilyKeysByRole.get(item.roleCode) ?? emptyFamilyKeys
                          }
                          onAddFamily={(pick) => addFamilyPick(item.id, pick)}
                        />
                        <CustomItemForm
                          roleCode={item.roleCode}
                          roleLabel={item.label}
                          onAdd={(custom) => addCustomItem(item.id, custom)}
                        />
                      </div>

                      {sourceLine || item.selectedItemSnapshot?.localItemNumber ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {sourceLine}
                          {item.selectedItemSnapshot?.localItemNumber ? (
                            <span className="ml-2 font-mono">
                              {t('localNumberValue', {
                                number: item.selectedItemSnapshot.localItemNumber,
                              })}
                            </span>
                          ) : null}
                        </p>
                      ) : null}

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs sm:grid-cols-3">
                        {facts.map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="mt-0.5 break-words text-foreground">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          {t('whyIncluded')}
                        </summary>
                        <p className="mt-1 leading-5 text-muted-foreground">
                          {item.whyIncluded.join(' ')}
                        </p>
                      </details>
                    </article>
                  </li>
                )
              })}
            </ul>

            {card.warnings.some((warning) => warning.severity === 'blocking') ? (
              <section className="rounded-2xl border border-red-300 bg-red-50/60 p-5 dark:border-red-900 dark:bg-red-950/10">
                <h3 className="font-bold text-foreground">{t('adminWaiverTitle')}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('adminWaiverHelp')}
                </p>
                <div className="mt-4 space-y-4">
                  {card.warnings
                    .filter((warning) => warning.severity === 'blocking')
                    .map((warning) => {
                      const draft = waiverDrafts[warning.id] ?? ''
                      return (
                        <div
                          key={warning.id}
                          className="rounded-xl border border-border bg-background p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="destructive" size="sm">
                              {t('severity.blocking')}
                            </Badge>
                            <code className="text-xs text-muted-foreground">{warning.code}</code>
                            {warning.waiverReason ? (
                              <Badge variant="outline" size="sm">
                                {t('waiverRecorded')}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-foreground">{warning.message}</p>
                          <label
                            htmlFor={`waiver-${warning.id}`}
                            className="mt-3 block text-xs font-semibold text-foreground"
                          >
                            {t('adminWaiverReason')}
                          </label>
                          <textarea
                            id={`waiver-${warning.id}`}
                            value={draft}
                            minLength={10}
                            maxLength={500}
                            onChange={(event) =>
                              setWaiverDrafts((current) => ({
                                ...current,
                                [warning.id]: event.target.value,
                              }))
                            }
                            placeholder={t('adminWaiverPlaceholder')}
                            className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          {draft.length > 0 && draft.trim().length < 10 ? (
                            <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                              {t('adminWaiverMinimum')}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {step === 3 && bundle && card ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
              <div>
                <p className="font-semibold text-foreground">{bundle.definition.title}</p>
                <p className="text-xs text-muted-foreground">
                  {modifierCodes.length > 0 ? modifierCodes.join(' · ') : t('noModifiersSelected')}
                </p>
              </div>
              <Badge variant="outline">
                {t('requirementExceptionCount', {
                  requirements: card.items.length,
                  exceptions: card.warnings.length,
                })}
              </Badge>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border bg-background p-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-foreground">
                {t('cardTitleLabel')}
                <input
                  type="text"
                  value={title}
                  maxLength={160}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={bundle.definition.title}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                {t('physicianLabel')}
                <input
                  type="text"
                  value={physicianName}
                  maxLength={160}
                  onChange={(event) => setPhysicianName(event.target.value)}
                  placeholder={t('physicianPlaceholder')}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                {t('statusLabel')}
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as 'draft' | 'final')}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="draft">{t('status.draft')}</option>
                  <option value="final">{t('status.final')}</option>
                </select>
              </label>
            </div>

            {saveError ? (
              <p
                role="alert"
                className="rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              >
                {saveError}
              </p>
            ) : null}

            <PreferenceCardTabs card={card} />
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('back')}
          </Button>
          {step < wizardSteps.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((current) => Math.min(wizardSteps.length - 1, current + 1))}
            >
              {t('continue')}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={saveCard} disabled={isGenerating} elevated>
              <FlaskConical aria-hidden="true" className="h-4 w-4" />
              {isGenerating ? t('generating') : t('generate')}
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
