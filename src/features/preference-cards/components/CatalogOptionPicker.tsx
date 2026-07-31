'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Layers, Loader2, PackageSearch, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

import type { CatalogPick } from '../domain/catalog-pick'
import type { FamilyPick, FamilySpecRange } from '../domain/family-pick'
import { allowsSizeAtProcedure } from '../domain/size-at-procedure'
import type { CatalogDistributionStatus } from '../server/catalog'
import type {
  CatalogLifecycleContext,
  RegulatoryStatus,
  SlottingScope,
} from '../server/catalog-store'
import { VerificationBadge, type VerificationBadgeLabels } from './VerificationBadge'

/** Mirrors RolePickerOption from server/catalog.ts, which the API returns verbatim. */
export interface CatalogPickerOption {
  productId: string
  manufacturerDisplay: string
  productName: string
  catalogNumber: string | null
  gtin: string | null
  sizeDisplay: string | null
  subcategory: string | null
  verificationTier: 'verified' | 'candidate' | 'unknown'
  usStatusPending: boolean
  distributionStatus: CatalogDistributionStatus | null
  catalogLifecycleContext: CatalogLifecycleContext
  slottingScope: SlottingScope
  preferredNewPurchase: boolean | null
  lifecycleNote: string | null
  regulatoryStatus: RegulatoryStatus
  regulatoryNote: string | null
  roleFit: string | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  sourceId: string | null
  sourceLocation: string | null
}

/** Mirrors RoleFamilyOption from server/catalog.ts. */
export interface CatalogPickerFamily {
  familyKey: string
  familyName: string
  manufacturerDisplay: string
  manufacturerGroupId: string
  variantCount: number
  verifiedCount: number
  verificationTier: 'verified' | 'candidate' | 'unknown'
  usStatusPending: boolean
  distributionStatus: CatalogDistributionStatus | null
  catalogLifecycleContext: CatalogLifecycleContext | null
  regulatoryStatus: RegulatoryStatus | null
  specRanges: FamilySpecRange[]
  placementMethods: string[]
  sourceId: string | null
  sourceLocation: string | null
  variants: CatalogPickerOption[]
}

type PickerView = 'product' | 'family'

interface CatalogOptionPickerProps {
  roleCode: string
  roleLabel: string
  /** Product ids already available as local options for this requirement. */
  existingProductIds: Set<string>
  onAdd: (pick: CatalogPick) => void
  /** Family keys already added as whole-line options for this requirement. */
  existingFamilyKeys?: Set<string>
  /**
   * Omitted by callers that cannot carry a family — the equipment-set manager builds sets of
   * specific products, so the whole-line button is hidden there.
   */
  onAddFamily?: (pick: FamilyPick) => void
  /** Overrides the add-button wording, e.g. "Add to set" in the set manager. */
  addLabel?: string
  className?: string
}

export function toCatalogPick(option: CatalogPickerOption, roleCode: string): CatalogPick {
  return {
    productId: option.productId,
    roleCode,
    manufacturerDisplay: option.manufacturerDisplay,
    productName: option.productName,
    catalogNumber: option.catalogNumber,
    gtin: option.gtin,
    sizeDisplay: option.sizeDisplay,
    verificationTier: option.verificationTier,
    usStatusPending: option.usStatusPending,
    minWorkingChannelMm: option.minWorkingChannelMm,
    deliverySystemOdMm: option.deliverySystemOdMm,
    sourceId: option.sourceId,
    sourceLocation: option.sourceLocation,
  }
}

export function toFamilyPick(family: CatalogPickerFamily, roleCode: string): FamilyPick {
  return {
    familyKey: family.familyKey,
    roleCode,
    familyName: family.familyName,
    manufacturerDisplay: family.manufacturerDisplay,
    variantCount: family.variantCount,
    specRanges: family.specRanges,
    verificationTier: family.verificationTier,
    usStatusPending: family.usStatusPending,
    sourceId: family.sourceId,
    sourceLocation: family.sourceLocation,
  }
}

const emptyFamilyKeys: Set<string> = new Set()

/**
 * Searches the whole product catalog for one requirement's role and lets the user promote a
 * result into the eligible local options for this card.
 *
 * Two views. The flat product list answers "what else could go here?"; the product-line view
 * collapses size variants so a crowded role stays readable — silicone straight stents alone
 * hold 105 products that are really four Dumon lines. Roles whose size is decided
 * intraoperatively open on the line view and can be added as a whole line, with the size
 * left to the procedure.
 */
export function CatalogOptionPicker({
  roleCode,
  roleLabel,
  existingProductIds,
  onAdd,
  existingFamilyKeys = emptyFamilyKeys,
  onAddFamily,
  addLabel,
  className,
}: CatalogOptionPickerProps) {
  // Translating here keeps ICU formatting (the result count is plural) inside next-intl and
  // avoids passing functions across the server/client boundary.
  const t = useTranslations('preferenceCards.catalog.picker')
  const tVerification = useTranslations('preferenceCards.catalog.verification')
  const tSpecs = useTranslations('preferenceCards.catalog.specs')
  const sizeAtProcedure = allowsSizeAtProcedure(roleCode) && Boolean(onAddFamily)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PickerView>(sizeAtProcedure ? 'family' : 'product')
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CatalogPickerOption[]>([])
  const [families, setFamilies] = useState<CatalogPickerFamily[]>([])
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const verificationLabels: VerificationBadgeLabels = useMemo(
    () => ({
      verified: tVerification('verified'),
      candidate: tVerification('candidate'),
      unknown: tVerification('unknown'),
      usPending: tVerification('usPending'),
      notDistributed: tVerification('notDistributed'),
      conflictingDistribution: tVerification('conflictingDistribution'),
      legacyInstalledBase: tVerification('legacyInstalledBase'),
      legacyInstalledBaseHelp: tVerification('legacyInstalledBaseHelp'),
      regulatoryCleared510k: tVerification('regulatoryCleared510k'),
      regulatoryApprovedPma: tVerification('regulatoryApprovedPma'),
      regulatoryGrantedDeNovo: tVerification('regulatoryGrantedDeNovo'),
      regulatoryBreakthroughInvestigational: tVerification('regulatoryBreakthroughInvestigational'),
      regulatoryBreakthroughPremarketReview: tVerification('regulatoryBreakthroughPremarketReview'),
      regulatoryNotUsAuthorized: tVerification('regulatoryNotUsAuthorized'),
      regulatoryHelp: tVerification('regulatoryHelp'),
    }),
    [tVerification],
  )

  const formatRanges = useCallback(
    (ranges: FamilySpecRange[]) =>
      ranges
        .map(
          (range) =>
            `${tSpecs(range.key as 'diameter_mm')} ${
              range.min === range.max ? range.min : `${range.min}–${range.max}`
            }`,
        )
        .join(' · '),
    [tSpecs],
  )

  const runSearch = useCallback(
    async (search: string, mode: PickerView) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      setFailed(false)
      try {
        const params = new URLSearchParams({ role: roleCode, limit: '25' })
        if (search) params.set('q', search)
        if (mode === 'family') params.set('group', 'family')
        const response = await fetch(`/api/preference-cards/catalog-search?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Catalog search failed: ${response.status}`)
        const body = (await response.json()) as {
          options?: CatalogPickerOption[]
          families?: CatalogPickerFamily[]
        }
        if (mode === 'family') setFamilies(body.families ?? [])
        else setOptions(body.options ?? [])
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setFailed(true)
        setOptions([])
        setFamilies([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    },
    [roleCode],
  )

  // Debounce typing; an immediate first load happens when the panel opens or the view flips.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void runSearch(query, view), query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [open, query, view, runSearch])

  useEffect(() => () => abortRef.current?.abort(), [])

  const resultCount = view === 'family' ? families.length : options.length
  const empty = !loading && !failed && resultCount === 0

  function renderVariantRow(option: CatalogPickerOption, indented: boolean) {
    const alreadyAdded = existingProductIds.has(option.productId)
    return (
      <li
        key={option.productId}
        className={cn(
          'rounded-lg border border-border/70 bg-background p-2',
          indented && 'border-l-2 border-l-primary/30',
        )}
      >
        {indented ? null : (
          <p className="text-[11px] font-semibold text-primary">{option.manufacturerDisplay}</p>
        )}
        <p className="text-xs font-medium text-foreground">{option.productName}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {option.catalogNumber ?? '—'}
          {option.sizeDisplay ? ` · ${option.sizeDisplay}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <VerificationBadge
            tier={option.verificationTier}
            usStatusPending={option.usStatusPending}
            distributionStatus={option.distributionStatus}
            catalogLifecycleContext={option.catalogLifecycleContext}
            lifecycleNote={option.lifecycleNote}
            regulatoryStatus={option.regulatoryStatus}
            regulatoryNote={option.regulatoryNote}
            labels={verificationLabels}
          />
          {option.roleFit ? (
            <Badge variant="outline" size="sm" className="normal-case tracking-normal">
              {option.roleFit}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant={alreadyAdded ? 'ghost' : 'default'}
          size="sm"
          disabled={alreadyAdded}
          className="mt-1.5 h-7 w-full gap-1 text-[11px]"
          onClick={() => onAdd(toCatalogPick(option, roleCode))}
        >
          {alreadyAdded ? (
            t('added')
          ) : (
            <>
              <Plus aria-hidden="true" className="h-3 w-3" />
              {addLabel ?? t('addToLocal')}
            </>
          )}
        </Button>
      </li>
    )
  }

  return (
    <div className={cn('mt-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-full justify-center gap-1.5 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <PackageSearch aria-hidden="true" className="h-3.5 w-3.5" />
        {open ? t('hide') : t('browse')}
      </Button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/20 p-2">
          <label className="sr-only" htmlFor={`catalog-search-${roleCode}`}>
            {roleLabel}
          </label>
          <input
            id={`catalog-search-${roleCode}`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-center gap-1.5 text-[11px]"
            onClick={() => setView((current) => (current === 'family' ? 'product' : 'family'))}
          >
            <Layers aria-hidden="true" className="h-3 w-3" />
            {view === 'family' ? t('viewProducts') : t('viewFamilies')}
          </Button>

          {loading ? (
            <p className="flex items-center gap-1.5 px-1 py-2 text-xs text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              {t('searching')}
            </p>
          ) : failed ? (
            <p className="px-1 py-2 text-xs text-destructive">{t('error')}</p>
          ) : empty ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">{t('noResults')}</p>
          ) : view === 'family' ? (
            <>
              <p className="px-1 text-[11px] text-muted-foreground">
                {t('familyCount', { count: families.length })}
              </p>
              <ul className="max-h-96 space-y-1.5 overflow-y-auto">
                {families.map((family) => {
                  const expanded = expandedFamilies[family.familyKey] ?? false
                  const lineAdded = existingFamilyKeys.has(family.familyKey)
                  const ranges = formatRanges(family.specRanges)
                  return (
                    <li
                      key={family.familyKey}
                      className="rounded-lg border border-border/70 bg-background p-2"
                    >
                      <p className="text-[11px] font-semibold text-primary">
                        {family.manufacturerDisplay}
                      </p>
                      <p className="text-xs font-medium text-foreground">{family.familyName}</p>
                      {ranges ? (
                        <p className="text-[11px] text-muted-foreground">{ranges}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge
                          variant="secondary"
                          size="sm"
                          className="normal-case tracking-normal"
                        >
                          {t('familyVariantCount', { count: family.variantCount })}
                        </Badge>
                        <VerificationBadge
                          tier={family.verificationTier}
                          usStatusPending={family.usStatusPending}
                          distributionStatus={family.distributionStatus}
                          catalogLifecycleContext={family.catalogLifecycleContext ?? 'unknown'}
                          regulatoryStatus={family.regulatoryStatus ?? 'unknown'}
                          labels={verificationLabels}
                        />
                      </div>

                      {sizeAtProcedure && onAddFamily ? (
                        <>
                          <Button
                            type="button"
                            variant={lineAdded ? 'ghost' : 'default'}
                            size="sm"
                            disabled={lineAdded}
                            className="mt-1.5 h-7 w-full gap-1 text-[11px]"
                            onClick={() => onAddFamily(toFamilyPick(family, roleCode))}
                          >
                            {lineAdded ? (
                              t('familyAdded')
                            ) : (
                              <>
                                <Plus aria-hidden="true" className="h-3 w-3" />
                                {t('addFamily')}
                              </>
                            )}
                          </Button>
                          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                            {t('addFamilyHelp')}
                          </p>
                        </>
                      ) : null}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={expanded}
                        className="mt-1.5 h-7 w-full justify-center gap-1 text-[11px]"
                        onClick={() =>
                          setExpandedFamilies((current) => ({
                            ...current,
                            [family.familyKey]: !expanded,
                          }))
                        }
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
                        />
                        {expanded ? t('hideSizes') : t('showSizes')}
                      </Button>

                      {expanded ? (
                        <ul className="mt-1.5 space-y-1.5">
                          {family.variants.map((variant) => renderVariantRow(variant, true))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="px-1 text-[11px] text-muted-foreground">
                {t('resultCount', { count: options.length })}
              </p>
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {options.map((option) => renderVariantRow(option, false))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
