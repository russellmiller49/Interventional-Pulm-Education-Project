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
import { generatePreferenceCardAction } from '@/app/[locale]/preference-cards/new/actions'

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

export interface PreferenceCardScenarioBundle {
  definition: ScenarioDefinition
  context: BuildContext
  availableModifierCodes: string[]
}

interface PreferenceCardWizardProps {
  bundles: PreferenceCardScenarioBundle[]
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
  if (!item.active || item.verificationState === 'hidden') return false
  if (!item.catalogProduct) return true
  return (
    item.catalogProduct.visibilityState === 'prototype_visible' &&
    ['locally_approved', 'prototype_visible'].includes(item.verificationState)
  )
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

export function PreferenceCardWizard({ bundles, initialScenarioId }: PreferenceCardWizardProps) {
  const t = useTranslations('preferenceCards')
  const locale = useLocale()
  const router = useRouter()
  const initialBundle =
    bundles.find((bundle) => bundle.definition.id === initialScenarioId) ?? bundles[0]
  const [step, setStep] = useState(initialScenarioId ? 1 : 0)
  const [scenarioId, setScenarioId] = useState(initialBundle?.definition.id ?? '')
  const [modifierCodes, setModifierCodes] = useState<string[]>(
    initialBundle?.definition.defaultModifierCodes ?? [],
  )
  const [conditionalStates, setConditionalStates] = useState<Record<string, ConditionalState>>({})
  const [selectedHospitalItemIds, setSelectedHospitalItemIds] = useState<
    Record<string, string | null>
  >({})
  const [localOptionSearches, setLocalOptionSearches] = useState<Record<string, string>>({})
  const [waiverDrafts, setWaiverDrafts] = useState<Record<string, string>>({})
  const [isGenerating, startGenerating] = useTransition()
  const generatedAt = '2026-07-25T12:00:00.000Z'
  const bundle =
    bundles.find((candidate) => candidate.definition.id === scenarioId) ?? initialBundle
  const waivers = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(waiverDrafts)
          .map(([id, reason]) => [id, reason.trim()] as const)
          .filter(([, reason]) => reason.length >= 10),
      ),
    [waiverDrafts],
  )
  const localOptionsByRole = useMemo(() => {
    const result = new Map<string, BuilderLocalOption[]>()
    if (!bundle) return result
    const hospitalItemById = new Map(bundle.context.hospitalItems.map((item) => [item.id, item]))
    for (const option of bundle.context.hospitalRoleOptions) {
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
  }, [bundle])

  const card = useMemo(() => {
    if (!bundle) return null
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
      bundle.context,
    )
  }, [bundle, conditionalStates, modifierCodes, selectedHospitalItemIds, waivers])

  if (!bundle || !card) return null

  const availableModifiers = bundle.context.modifiers.filter((modifier) =>
    bundle.availableModifierCodes.includes(modifier.code),
  )

  const selectScenario = (nextId: string) => {
    const next = bundles.find((candidate) => candidate.definition.id === nextId)
    if (!next) return
    setScenarioId(nextId)
    setModifierCodes([...next.definition.defaultModifierCodes])
    setConditionalStates({})
    setSelectedHospitalItemIds({})
    setLocalOptionSearches({})
    setWaiverDrafts({})
  }

  const toggleModifier = (code: string) => {
    setModifierCodes((current) =>
      current.includes(code)
        ? current.filter((candidate) => candidate !== code)
        : [...current, code],
    )
  }

  const generateSnapshot = () => {
    const query = new URLSearchParams()
    query.set('modifiers', modifierCodes.join(','))
    query.set('generatedAt', generatedAt)
    if (Object.keys(conditionalStates).length > 0) {
      query.set('conditions', JSON.stringify(conditionalStates))
    }
    if (Object.keys(selectedHospitalItemIds).length > 0) {
      query.set('items', JSON.stringify(selectedHospitalItemIds))
    }
    if (Object.keys(waivers).length > 0) {
      query.set('waivers', JSON.stringify(waivers))
    }
    const demoTarget = `/${locale}/preference-cards/demo-${bundle.definition.id}-${card.snapshotHash.slice(
      0,
      12,
    )}?${query.toString()}`
    startGenerating(async () => {
      const result = await generatePreferenceCardAction({
        scenarioId: bundle.definition.id,
        input: {
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
      })
      router.push(
        result.ok && result.cardId
          ? (`/${locale}/preference-cards/${result.cardId}` as Route)
          : (demoTarget as Route),
      )
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
          <ReadinessBadge
            state={card.readinessState}
            label={t(`readiness.${card.readinessState}`)}
          />
        </div>

        {step === 0 ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {bundles.map((candidate) => {
              const selected = candidate.definition.id === scenarioId
              return (
                <Card
                  key={candidate.definition.id}
                  className={cn(
                    'h-full',
                    selected && 'border-2 border-primary shadow-lg shadow-primary/10',
                  )}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={selected ? 'default' : 'outline'}>
                        {selected ? t('selected') : candidate.definition.governanceState}
                      </Badge>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t('mapped', {
                          percent: candidate.definition.requiredRoleMappingPercentage,
                        })}
                      </span>
                    </div>
                    <CardTitle className="mt-2">{candidate.definition.title}</CardTitle>
                    <CardDescription>{candidate.definition.shortDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground">{t('sourceRecipe')}:</span>{' '}
                      {candidate.definition.sourceProcedureCode}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">{t('owner')}:</span>{' '}
                      {candidate.definition.owner ?? t('ownerNotAssigned')}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      onClick={() => selectScenario(candidate.definition.id)}
                    >
                      {selected ? t('selected') : t('select')}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        ) : null}

        {step === 1 ? (
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

        {step === 2 ? (
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[1450px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-muted/95 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {[
                      'requirement',
                      'requiredness',
                      'why',
                      'localItem',
                      'manufacturerCatalog',
                      'localNumber',
                      'quantity',
                      'zone',
                      'phase',
                      'openHold',
                      'verification',
                      'compatibility',
                      'resolution',
                    ].map((column) => (
                      <th key={column} scope="col" className="px-3 py-3 font-bold">
                        {t(`columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
                      !matchingOptions.some(
                        (candidate) => candidate.item.id === selectedOption.item.id,
                      )
                        ? [selectedOption, ...matchingOptions]
                        : matchingOptions
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'align-top',
                          item.resolutionState === 'blocking' && 'bg-red-50/60 dark:bg-red-950/10',
                        )}
                      >
                        <td className="max-w-64 px-3 py-3">
                          <p className="font-semibold text-foreground">{item.label}</p>
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {item.roleCode}
                          </p>
                          {item.dependencyRule ? (
                            <div className="mt-2">
                              <label htmlFor={`conditional-${item.id}`} className="sr-only">
                                {t('conditional.label')} — {item.label}
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
                                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {(['undecided', 'include', 'exclude'] as const).map((state) => (
                                  <option key={state} value={state}>
                                    {t(`conditional.${state}`)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" size="sm">
                            {humanize(item.effectiveRequiredness)}
                          </Badge>
                        </td>
                        <td className="max-w-72 px-3 py-3 text-xs leading-5 text-muted-foreground">
                          {item.whyIncluded.join(' ')}
                        </td>
                        <td className="w-80 px-3 py-3">
                          <label htmlFor={`local-option-search-${item.id}`} className="sr-only">
                            {t('searchLocalOptionsFor', {
                              requirement: item.label,
                            })}
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
                            {t('selectLocalOptionFor', {
                              requirement: item.label,
                            })}
                          </label>
                          <select
                            id={`local-option-${item.id}`}
                            value={item.selectedHospitalItemId ?? ''}
                            onChange={(event) =>
                              setSelectedHospitalItemIds((current) => ({
                                ...current,
                                [item.id]: event.target.value || null,
                              }))
                            }
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
                        </td>
                        <td className="max-w-48 px-3 py-3 text-xs text-muted-foreground">
                          {[
                            item.selectedItemSnapshot?.catalogProduct?.manufacturer,
                            item.selectedItemSnapshot?.catalogProduct?.catalogNumber,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {item.selectedItemSnapshot?.localItemNumber ?? '—'}
                        </td>
                        <td className="px-3 py-3">{item.quantityDisplay}</td>
                        <td className="px-3 py-3 text-xs">{t(`spatialZones.${item.setupZone}`)}</td>
                        <td className="px-3 py-3 text-xs">{t(`phases.${item.proceduralPhase}`)}</td>
                        <td className="px-3 py-3 text-xs">{humanize(item.openHoldStatus)}</td>
                        <td className="px-3 py-3 text-xs">{humanize(item.verificationState)}</td>
                        <td className="px-3 py-3 text-xs">{humanize(item.compatibilityState)}</td>
                        <td className="px-3 py-3">
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

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

        {step === 3 ? (
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
            <Button type="button" onClick={generateSnapshot} disabled={isGenerating} elevated>
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
