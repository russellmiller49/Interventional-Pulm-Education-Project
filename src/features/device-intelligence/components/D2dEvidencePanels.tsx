import type { ReactNode } from 'react'
import { ExternalLink, Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type {
  DescriptionScope,
  D2dConfidence,
  ProfileEvidenceScope,
} from '@/features/device-intelligence/domain/product-profile'
import type {
  CommercialDistributionState,
  DeviceClass,
  RegulatoryConclusionCode,
  RegulatoryEvidenceScope,
  RegulatoryMatchLevel,
  RegulatoryResearchState,
} from '@/features/device-intelligence/domain/product-regulatory'
import type {
  D2dRuntimeSource,
  ReviewedProductProfile,
  ReviewedProductRegulatoryEvidence,
} from '@/features/device-intelligence/server/d2d-evidence.server'
import { cn } from '@/lib/cn'

type D2dEvidenceScope = ProfileEvidenceScope | RegulatoryEvidenceScope
type D2dSourceKind = D2dRuntimeSource['source_kind']
type RegulatoryPathway = ReviewedProductRegulatoryEvidence['pathways'][number]
type RegulatoryPathwayKind = RegulatoryPathway['pathway']
type RegulatoryPathwayDecision = RegulatoryPathway['decision']
type RegistrationListingStatus =
  ReviewedProductRegulatoryEvidence['registration_listing_evidence'][number]['status']

/**
 * Localized chrome for both D2D panels.
 *
 * Every controlled vocabulary is represented as an exhaustive `Record`, so adding a domain
 * value cannot silently leak an internal code into the UI. The reviewed profile prose, source
 * titles, identifiers, units, and locators are data rather than chrome and intentionally do not
 * pass through these labels.
 */
export interface D2dEvidenceLabels {
  shared: {
    confidenceLabel: string
    asOfDateLabel: string
    evidenceScopeLabel: string
    confidence: Record<D2dConfidence, string>
    evidenceScope: Record<D2dEvidenceScope, string>
  }
  profile: {
    heading: string
    summaryHeading: string
    scopeLabel: string
    scope: Record<DescriptionScope, string>
    scopeNotice: Record<'configuration_variant' | 'family_inherited', string>
    contentLanguageNotice: string
    physicalDeviceTypeLabel: string
    intendedFunctionLabel: string
    exactConfigurationLabel: string
    keySpecificationsHeading: string
  }
  regulatory: {
    heading: string
    researchStateLabel: string
    researchState: Record<RegulatoryResearchState, string>
    researchAsOfDateLabel: string
    matchLevelLabel: string
    matchLevel: Record<RegulatoryMatchLevel, string>
    conclusionsHeading: string
    conclusion: Record<RegulatoryConclusionCode, string>
    familyLevelNotice: string
    udiHeading: string
    udiRecordLabel: string
    classificationsHeading: string
    classificationRecordLabel: string
    pathwaysHeading: string
    pathwayRecordLabel: string
    registrationListingHeading: string
    registrationListingRecordLabel: string
    commercialDistributionHeading: string
    commercialDistributionRecordLabel: string
    commercialDistributionDisclaimer: string
    fields: {
      primaryDi: string
      packageDis: string
      issuingAgency: string
      legalManufacturer: string
      brandName: string
      modelCatalogNumber: string
      publishDate: string
      productCode: string
      deviceClass: string
      regulationNumber: string
      classificationName: string
      pathway: string
      submissionNumber: string
      decision: string
      decisionDate: string
      establishmentRegistrationNumber: string
      listingNumber: string
      proprietaryName: string
      status: string
      recordAsOfDate: string
    }
    deviceClass: Record<DeviceClass, string>
    pathway: Record<RegulatoryPathwayKind, string>
    pathwayDecision: Record<RegulatoryPathwayDecision, string>
    registrationListingStatus: Record<RegistrationListingStatus, string>
    commercialDistribution: Record<CommercialDistributionState, string>
  }
  citations: {
    heading: string
    referenceLabel: string
    sourceKindLabel: string
    sourceKind: Record<D2dSourceKind, string>
    organizationLabel: string
    snapshotDateLabel: string
    locatorsLabel: string
    openOfficialSource: string
    externalSiteLabel: string
  }
  fallback: {
    heading: string
    profileUnavailable: string
    regulatoryNotResearched: string
  }
}

interface CitationSource extends Omit<D2dRuntimeSource, 'locators'> {
  locators: readonly string[]
}

interface SourceReference {
  readonly source_id: string
  readonly locator: string
}

/** Defensive presentation-layer deduplication, preserving source and locator encounter order. */
function dedupeCitationSources(sources: readonly D2dRuntimeSource[]): CitationSource[] {
  const byId = new Map<string, CitationSource>()
  for (const source of sources) {
    const existing = byId.get(source.source_id)
    if (!existing) {
      byId.set(source.source_id, {
        ...source,
        locators: [...new Set(source.locators)],
      })
      continue
    }
    byId.set(source.source_id, {
      ...existing,
      locators: [...new Set([...existing.locators, ...source.locators])],
    })
  }
  return [...byId.values()]
}

function citationIndex(sources: readonly CitationSource[]) {
  return new Map(
    sources.map((source, index) => [source.source_id, { number: index + 1, title: source.title }]),
  )
}

function SourceMarkers({
  sourceRefs,
  index,
  idPrefix,
  labels,
}: {
  sourceRefs: readonly SourceReference[]
  index: ReadonlyMap<string, { number: number; title: string }>
  idPrefix: string
  labels: D2dEvidenceLabels['citations']
}) {
  const references = [...new Set(sourceRefs.map((reference) => reference.source_id))]
    .map((sourceId) => index.get(sourceId))
    .filter((reference): reference is { number: number; title: string } => Boolean(reference))

  if (references.length === 0) return null
  return (
    <sup className="ml-1 inline-flex flex-wrap gap-x-1 align-super text-[10px] font-semibold leading-none text-sky-700 dark:text-sky-300">
      {references.map((reference) => (
        <a
          key={reference.number}
          href={`#${idPrefix}-source-${reference.number}`}
          aria-label={`${labels.referenceLabel} ${reference.number}: ${reference.title}`}
          className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          [{reference.number}]
        </a>
      ))}
    </sup>
  )
}

function D2dCitationList({
  sources,
  idPrefix,
  labels,
}: {
  sources: readonly CitationSource[]
  idPrefix: string
  labels: D2dEvidenceLabels['citations']
}) {
  if (sources.length === 0) return null

  return (
    <div className="min-w-0 space-y-3">
      <h3 id={`${idPrefix}-sources-heading`} className="text-base font-bold tracking-tight">
        {labels.heading}
      </h3>
      <ol className="list-decimal space-y-3 pl-5 marker:text-xs marker:font-semibold marker:text-slate-600 dark:marker:text-slate-300">
        {sources.map((source, index) => (
          <li
            key={source.source_id}
            id={`${idPrefix}-source-${index + 1}`}
            className="min-w-0 scroll-mt-24 rounded-xl border border-border/70 bg-background/60 p-3 pl-4 text-sm"
          >
            <p className="break-words font-semibold text-foreground [overflow-wrap:anywhere]">
              {source.title}
            </p>
            <dl className="mt-2 grid min-w-0 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="font-medium text-foreground/80">{labels.organizationLabel}</dt>
                <dd className="break-words [overflow-wrap:anywhere]">{source.organization}</dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-foreground/80">{labels.sourceKindLabel}</dt>
                <dd className="break-words [overflow-wrap:anywhere]">
                  {labels.sourceKind[source.source_kind]}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-foreground/80">{labels.snapshotDateLabel}</dt>
                <dd>
                  <time dateTime={source.snapshot_date} className="font-mono">
                    {source.snapshot_date}
                  </time>
                </dd>
              </div>
            </dl>
            <div className="mt-3 min-w-0">
              <p className="text-xs font-medium text-foreground/80">{labels.locatorsLabel}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {source.locators.map((locator) => (
                  <li
                    key={locator}
                    className="min-w-0 break-words font-mono [overflow-wrap:anywhere]"
                  >
                    {locator}
                  </li>
                ))}
              </ul>
            </div>
            {source.official_url ? (
              <a
                href={source.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex max-w-full items-center gap-1.5 break-words text-xs font-semibold text-sky-700 underline-offset-2 [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300"
              >
                <span>
                  {labels.openOfficialSource}{' '}
                  <span className="font-normal text-slate-600 dark:text-slate-300">
                    ({labels.externalSiteLabel})
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

function EvidenceScopeBadge({
  scope,
  labels,
}: {
  scope: D2dEvidenceScope
  labels: D2dEvidenceLabels['shared']
}) {
  return (
    <Badge
      data-evidence-scope={scope}
      variant="outline"
      size="sm"
      className="max-w-full whitespace-normal break-words text-left normal-case tracking-normal [overflow-wrap:anywhere]"
    >
      {labels.evidenceScopeLabel}: {labels.evidenceScope[scope]}
    </Badge>
  )
}

function DefinitionRow({
  term,
  children,
  mono = false,
  termLang,
}: {
  term: string
  children: ReactNode
  mono?: boolean
  termLang?: string
}) {
  return (
    <div className="grid min-w-0 gap-0.5 border-b border-border/50 py-2 last:border-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
      <dt lang={termLang} className="text-sm text-muted-foreground">
        {term}
      </dt>
      <dd
        className={cn(
          'min-w-0 break-words text-sm text-foreground [overflow-wrap:anywhere]',
          mono ? 'font-mono text-xs' : undefined,
        )}
      >
        {children}
      </dd>
    </div>
  )
}

function ScopeNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2 rounded-xl border border-amber-600/40 bg-amber-500/10 p-3 text-sm leading-6 text-foreground">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <p className="min-w-0 break-words [overflow-wrap:anywhere]">{children}</p>
    </div>
  )
}

/** Reviewed, source-derived profile content for one D2D pilot product. */
export function ProductProfilePanel({
  profile,
  labels,
  showEnglishContentNotice,
}: {
  profile: ReviewedProductProfile
  labels: D2dEvidenceLabels
  showEnglishContentNotice: boolean
}) {
  const sources = dedupeCitationSources(profile.sources)
  const sourceIndex = citationIndex(sources)
  const scopeNotice =
    profile.description_scope === 'configuration_variant' ||
    profile.description_scope === 'family_inherited'
      ? labels.profile.scopeNotice[profile.description_scope]
      : null

  return (
    <section
      className="min-w-0 space-y-3"
      aria-labelledby="d2d-profile-heading"
      data-d2d-profile-scope={profile.description_scope}
    >
      <h2 id="d2d-profile-heading" className="text-2xl font-semibold tracking-tight">
        {labels.profile.heading}
      </h2>
      <Card className="min-w-0">
        <CardContent className="min-w-0 space-y-5 p-5">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.profile.scopeLabel}
              </dt>
              <dd className="mt-1">
                <Badge
                  variant="outline"
                  size="sm"
                  className="max-w-full whitespace-normal break-words text-left normal-case tracking-normal [overflow-wrap:anywhere]"
                >
                  {labels.profile.scope[profile.description_scope]}
                </Badge>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.shared.confidenceLabel}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {labels.shared.confidence[profile.confidence]}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.shared.asOfDateLabel}
              </dt>
              <dd className="mt-1 text-sm">
                <time dateTime={profile.as_of_date} className="font-mono text-xs">
                  {profile.as_of_date}
                </time>
              </dd>
            </div>
          </dl>

          {scopeNotice ? <ScopeNotice>{scopeNotice}</ScopeNotice> : null}
          {showEnglishContentNotice ? (
            <p className="rounded-xl border border-sky-600/30 bg-sky-500/5 p-3 text-xs leading-5 text-muted-foreground">
              {labels.profile.contentLanguageNotice}
            </p>
          ) : null}

          <div className="min-w-0 space-y-5">
            {profile.summary_claims.length > 0 ? (
              <section className="min-w-0 space-y-2" aria-labelledby="d2d-profile-summary-heading">
                <h3 id="d2d-profile-summary-heading" className="text-base font-bold tracking-tight">
                  {labels.profile.summaryHeading}
                </h3>
                <ul className="list-disc space-y-3 pl-5 text-sm leading-6">
                  {profile.summary_claims.map((claim, index) => (
                    <li
                      key={`${claim.text}-${index}`}
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      <p>
                        <span lang={profile.content_locale}>{claim.text}</span>
                        <SourceMarkers
                          sourceRefs={claim.source_refs}
                          index={sourceIndex}
                          idPrefix="d2d-profile"
                          labels={labels.citations}
                        />
                      </p>
                      <div className="mt-1">
                        <EvidenceScopeBadge scope={claim.evidence_scope} labels={labels.shared} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {profile.physical_device_type ||
            profile.intended_function ||
            profile.exact_configuration_summary ? (
              <dl className="min-w-0">
                {profile.physical_device_type ? (
                  <DefinitionRow term={labels.profile.physicalDeviceTypeLabel}>
                    <p>
                      <span lang={profile.content_locale}>{profile.physical_device_type.text}</span>
                      <SourceMarkers
                        sourceRefs={profile.physical_device_type.source_refs}
                        index={sourceIndex}
                        idPrefix="d2d-profile"
                        labels={labels.citations}
                      />
                    </p>
                    <div className="mt-1">
                      <EvidenceScopeBadge
                        scope={profile.physical_device_type.evidence_scope}
                        labels={labels.shared}
                      />
                    </div>
                  </DefinitionRow>
                ) : null}
                {profile.intended_function ? (
                  <DefinitionRow term={labels.profile.intendedFunctionLabel}>
                    <p>
                      <span lang={profile.content_locale}>{profile.intended_function.text}</span>
                      <SourceMarkers
                        sourceRefs={profile.intended_function.source_refs}
                        index={sourceIndex}
                        idPrefix="d2d-profile"
                        labels={labels.citations}
                      />
                    </p>
                    <div className="mt-1">
                      <EvidenceScopeBadge
                        scope={profile.intended_function.evidence_scope}
                        labels={labels.shared}
                      />
                    </div>
                  </DefinitionRow>
                ) : null}
                {profile.exact_configuration_summary ? (
                  <DefinitionRow term={labels.profile.exactConfigurationLabel}>
                    <p>
                      <span lang={profile.content_locale}>
                        {profile.exact_configuration_summary.text}
                      </span>
                      <SourceMarkers
                        sourceRefs={profile.exact_configuration_summary.source_refs}
                        index={sourceIndex}
                        idPrefix="d2d-profile"
                        labels={labels.citations}
                      />
                    </p>
                    <div className="mt-1">
                      <EvidenceScopeBadge
                        scope={profile.exact_configuration_summary.evidence_scope}
                        labels={labels.shared}
                      />
                    </div>
                  </DefinitionRow>
                ) : null}
              </dl>
            ) : null}

            {profile.key_specifications.length > 0 ? (
              <section
                className="min-w-0 space-y-2"
                aria-labelledby="d2d-profile-specifications-heading"
              >
                <h3
                  id="d2d-profile-specifications-heading"
                  className="text-base font-bold tracking-tight"
                >
                  {labels.profile.keySpecificationsHeading}
                </h3>
                <dl className="min-w-0">
                  {profile.key_specifications.map((specification) => (
                    <DefinitionRow
                      key={specification.key}
                      term={specification.label}
                      termLang={profile.content_locale}
                    >
                      <p>
                        <span lang={profile.content_locale} className="font-medium">
                          {String(specification.value)}
                          {specification.unit ? ` ${specification.unit}` : ''}
                        </span>
                        <SourceMarkers
                          sourceRefs={specification.source_refs}
                          index={sourceIndex}
                          idPrefix="d2d-profile"
                          labels={labels.citations}
                        />
                      </p>
                      <div className="mt-1">
                        <EvidenceScopeBadge
                          scope={specification.evidence_scope}
                          labels={labels.shared}
                        />
                      </div>
                    </DefinitionRow>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          <D2dCitationList sources={sources} idPrefix="d2d-profile" labels={labels.citations} />
        </CardContent>
      </Card>
    </section>
  )
}

function RegulatoryRecordCard({
  label,
  scope,
  sourceRefs,
  sourceIndex,
  children,
  labels,
}: {
  label: string
  scope: RegulatoryEvidenceScope
  sourceRefs: readonly SourceReference[]
  sourceIndex: ReadonlyMap<string, { number: number; title: string }>
  children: ReactNode
  labels: D2dEvidenceLabels
}) {
  return (
    <li className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 break-words text-sm font-bold [overflow-wrap:anywhere]">{label}</h4>
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <EvidenceScopeBadge scope={scope} labels={labels.shared} />
          <SourceMarkers
            sourceRefs={sourceRefs}
            index={sourceIndex}
            idPrefix="d2d-regulatory"
            labels={labels.citations}
          />
        </div>
      </div>
      <dl className="mt-2 min-w-0">{children}</dl>
    </li>
  )
}

function RegulatoryRecordSection({
  id,
  heading,
  children,
  footer,
}: {
  id: string
  heading: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section className="min-w-0 space-y-2" aria-labelledby={id}>
      <h3 id={id} className="text-base font-bold tracking-tight">
        {heading}
      </h3>
      <ol className="min-w-0 space-y-3">{children}</ol>
      {footer}
    </section>
  )
}

/** Independent regulatory-identity, pathway, listing, and distribution evidence axes. */
export function RegulatoryEvidencePanel({
  evidence,
  labels,
}: {
  evidence: ReviewedProductRegulatoryEvidence
  labels: D2dEvidenceLabels
}) {
  const sources = dedupeCitationSources(evidence.sources)
  const sourceIndex = citationIndex(sources)
  const familyLevelEvidence =
    evidence.match_level === 'family_level_match' ||
    [
      ...evidence.udi_identities,
      ...evidence.classifications,
      ...evidence.pathways,
      ...evidence.registration_listing_evidence,
      ...evidence.commercial_distribution_evidence,
    ].some((record) => record.evidence_scope === 'family')

  return (
    <section
      className="min-w-0 space-y-3"
      aria-labelledby="d2d-regulatory-heading"
      data-d2d-regulatory-match={evidence.match_level}
    >
      <h2 id="d2d-regulatory-heading" className="text-2xl font-semibold tracking-tight">
        {labels.regulatory.heading}
      </h2>
      <Card className="min-w-0">
        <CardContent className="min-w-0 space-y-5 p-5">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.regulatory.researchStateLabel}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {labels.regulatory.researchState[evidence.research_state]}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.regulatory.matchLevelLabel}
              </dt>
              <dd className="mt-1">
                <Badge
                  data-regulatory-match-level={evidence.match_level}
                  variant={evidence.research_state === 'unresolved' ? 'warning' : 'outline'}
                  size="sm"
                  className={cn(
                    'max-w-full whitespace-normal break-words text-left normal-case tracking-normal [overflow-wrap:anywhere]',
                    evidence.research_state === 'unresolved'
                      ? 'border-amber-600/50 text-amber-800 dark:border-amber-400/50 dark:text-amber-200'
                      : undefined,
                  )}
                >
                  {labels.regulatory.matchLevel[evidence.match_level]}
                </Badge>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.shared.confidenceLabel}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {labels.shared.confidence[evidence.confidence]}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">
                {labels.regulatory.researchAsOfDateLabel}
              </dt>
              <dd className="mt-1 text-sm">
                <time dateTime={evidence.research_as_of_date} className="font-mono text-xs">
                  {evidence.research_as_of_date}
                </time>
              </dd>
            </div>
          </dl>

          {familyLevelEvidence ? (
            <ScopeNotice>{labels.regulatory.familyLevelNotice}</ScopeNotice>
          ) : null}

          {evidence.conclusion_codes.length > 0 ? (
            <section
              className="min-w-0 space-y-2"
              aria-labelledby="d2d-regulatory-conclusions-heading"
            >
              <h3
                id="d2d-regulatory-conclusions-heading"
                className="text-base font-bold tracking-tight"
              >
                {labels.regulatory.conclusionsHeading}
              </h3>
              <ul className="flex min-w-0 flex-wrap gap-2">
                {evidence.conclusion_codes.map((conclusion) => (
                  <li key={conclusion} className="max-w-full">
                    <Badge
                      data-regulatory-conclusion={conclusion}
                      variant={conclusion === 'exact_identity_unresolved' ? 'warning' : 'info'}
                      className={cn(
                        'max-w-full whitespace-normal break-words text-left normal-case tracking-normal [overflow-wrap:anywhere]',
                        conclusion === 'exact_identity_unresolved'
                          ? 'border-amber-600/50 text-amber-800 dark:border-amber-400/50 dark:text-amber-200'
                          : undefined,
                      )}
                    >
                      {labels.regulatory.conclusion[conclusion]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {evidence.udi_identities.length > 0 ? (
            <RegulatoryRecordSection
              id="d2d-regulatory-udi-heading"
              heading={labels.regulatory.udiHeading}
            >
              {evidence.udi_identities.map((record) => (
                <RegulatoryRecordCard
                  key={`${record.primary_di}-${record.evidence_scope}`}
                  label={labels.regulatory.udiRecordLabel}
                  scope={record.evidence_scope}
                  sourceRefs={record.source_refs}
                  sourceIndex={sourceIndex}
                  labels={labels}
                >
                  <DefinitionRow term={labels.regulatory.fields.primaryDi} mono>
                    {record.primary_di}
                  </DefinitionRow>
                  {record.package_dis.length > 0 ? (
                    <DefinitionRow term={labels.regulatory.fields.packageDis} mono>
                      <ul className="space-y-1">
                        {record.package_dis.map((identifier) => (
                          <li key={identifier}>{identifier}</li>
                        ))}
                      </ul>
                    </DefinitionRow>
                  ) : null}
                  {record.issuing_agency ? (
                    <DefinitionRow term={labels.regulatory.fields.issuingAgency}>
                      {record.issuing_agency}
                    </DefinitionRow>
                  ) : null}
                  <DefinitionRow term={labels.regulatory.fields.legalManufacturer}>
                    {record.legal_manufacturer}
                  </DefinitionRow>
                  {record.brand_name ? (
                    <DefinitionRow term={labels.regulatory.fields.brandName}>
                      {record.brand_name}
                    </DefinitionRow>
                  ) : null}
                  {record.model_catalog_number ? (
                    <DefinitionRow term={labels.regulatory.fields.modelCatalogNumber} mono>
                      {record.model_catalog_number}
                    </DefinitionRow>
                  ) : null}
                  {record.publish_date ? (
                    <DefinitionRow term={labels.regulatory.fields.publishDate} mono>
                      <time dateTime={record.publish_date}>{record.publish_date}</time>
                    </DefinitionRow>
                  ) : null}
                </RegulatoryRecordCard>
              ))}
            </RegulatoryRecordSection>
          ) : null}

          {evidence.classifications.length > 0 ? (
            <RegulatoryRecordSection
              id="d2d-regulatory-classifications-heading"
              heading={labels.regulatory.classificationsHeading}
            >
              {evidence.classifications.map((record, index) => (
                <RegulatoryRecordCard
                  key={`${record.product_code}-${record.regulation_number ?? ''}-${index}`}
                  label={labels.regulatory.classificationRecordLabel}
                  scope={record.evidence_scope}
                  sourceRefs={record.source_refs}
                  sourceIndex={sourceIndex}
                  labels={labels}
                >
                  <DefinitionRow term={labels.regulatory.fields.productCode} mono>
                    {record.product_code}
                  </DefinitionRow>
                  <DefinitionRow term={labels.regulatory.fields.deviceClass}>
                    {labels.regulatory.deviceClass[record.device_class]}
                  </DefinitionRow>
                  {record.regulation_number ? (
                    <DefinitionRow term={labels.regulatory.fields.regulationNumber} mono>
                      {record.regulation_number}
                    </DefinitionRow>
                  ) : null}
                  {record.classification_name ? (
                    <DefinitionRow term={labels.regulatory.fields.classificationName}>
                      {record.classification_name}
                    </DefinitionRow>
                  ) : null}
                </RegulatoryRecordCard>
              ))}
            </RegulatoryRecordSection>
          ) : null}

          {evidence.pathways.length > 0 ? (
            <RegulatoryRecordSection
              id="d2d-regulatory-pathways-heading"
              heading={labels.regulatory.pathwaysHeading}
            >
              {evidence.pathways.map((record, index) => (
                <RegulatoryRecordCard
                  key={`${record.pathway}-${record.submission_number ?? 'exempt'}-${index}`}
                  label={labels.regulatory.pathwayRecordLabel}
                  scope={record.evidence_scope}
                  sourceRefs={record.source_refs}
                  sourceIndex={sourceIndex}
                  labels={labels}
                >
                  <DefinitionRow term={labels.regulatory.fields.pathway}>
                    {labels.regulatory.pathway[record.pathway]}
                  </DefinitionRow>
                  {record.submission_number ? (
                    <DefinitionRow term={labels.regulatory.fields.submissionNumber} mono>
                      {record.submission_number}
                    </DefinitionRow>
                  ) : null}
                  <DefinitionRow term={labels.regulatory.fields.decision}>
                    {labels.regulatory.pathwayDecision[record.decision]}
                  </DefinitionRow>
                  {record.decision_date ? (
                    <DefinitionRow term={labels.regulatory.fields.decisionDate} mono>
                      <time dateTime={record.decision_date}>{record.decision_date}</time>
                    </DefinitionRow>
                  ) : null}
                </RegulatoryRecordCard>
              ))}
            </RegulatoryRecordSection>
          ) : null}

          {evidence.registration_listing_evidence.length > 0 ? (
            <RegulatoryRecordSection
              id="d2d-regulatory-registration-listing-heading"
              heading={labels.regulatory.registrationListingHeading}
            >
              {evidence.registration_listing_evidence.map((record, index) => (
                <RegulatoryRecordCard
                  key={`${record.listing_number ?? 'no-listing'}-${record.as_of_date}-${index}`}
                  label={labels.regulatory.registrationListingRecordLabel}
                  scope={record.evidence_scope}
                  sourceRefs={record.source_refs}
                  sourceIndex={sourceIndex}
                  labels={labels}
                >
                  {record.establishment_registration_number ? (
                    <DefinitionRow
                      term={labels.regulatory.fields.establishmentRegistrationNumber}
                      mono
                    >
                      {record.establishment_registration_number}
                    </DefinitionRow>
                  ) : null}
                  {record.listing_number ? (
                    <DefinitionRow term={labels.regulatory.fields.listingNumber} mono>
                      {record.listing_number}
                    </DefinitionRow>
                  ) : null}
                  {record.proprietary_name ? (
                    <DefinitionRow term={labels.regulatory.fields.proprietaryName}>
                      {record.proprietary_name}
                    </DefinitionRow>
                  ) : null}
                  {record.product_code ? (
                    <DefinitionRow term={labels.regulatory.fields.productCode} mono>
                      {record.product_code}
                    </DefinitionRow>
                  ) : null}
                  <DefinitionRow term={labels.regulatory.fields.status}>
                    {labels.regulatory.registrationListingStatus[record.status]}
                  </DefinitionRow>
                  <DefinitionRow term={labels.regulatory.fields.recordAsOfDate} mono>
                    <time dateTime={record.as_of_date}>{record.as_of_date}</time>
                  </DefinitionRow>
                </RegulatoryRecordCard>
              ))}
            </RegulatoryRecordSection>
          ) : null}

          {evidence.commercial_distribution_evidence.length > 0 ? (
            <RegulatoryRecordSection
              id="d2d-regulatory-commercial-distribution-heading"
              heading={labels.regulatory.commercialDistributionHeading}
              footer={
                <p className="min-w-0 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  {labels.regulatory.commercialDistributionDisclaimer}
                </p>
              }
            >
              {evidence.commercial_distribution_evidence.map((record, index) => (
                <RegulatoryRecordCard
                  key={`${record.status}-${record.as_of_date}-${index}`}
                  label={labels.regulatory.commercialDistributionRecordLabel}
                  scope={record.evidence_scope}
                  sourceRefs={record.source_refs}
                  sourceIndex={sourceIndex}
                  labels={labels}
                >
                  <DefinitionRow term={labels.regulatory.fields.status}>
                    {labels.regulatory.commercialDistribution[record.status]}
                  </DefinitionRow>
                  <DefinitionRow term={labels.regulatory.fields.recordAsOfDate} mono>
                    <time dateTime={record.as_of_date}>{record.as_of_date}</time>
                  </DefinitionRow>
                </RegulatoryRecordCard>
              ))}
            </RegulatoryRecordSection>
          ) : null}

          <D2dCitationList sources={sources} idPrefix="d2d-regulatory" labels={labels.citations} />
        </CardContent>
      </Card>
    </section>
  )
}

/** Compact, subordinate status for Atlas products outside the reviewed ten-product pilot. */
export function D2dEnrichmentStatusCard({ labels }: { labels: D2dEvidenceLabels }) {
  return (
    <section
      className="min-w-0 space-y-2"
      aria-labelledby="d2d-enrichment-status-heading"
      data-d2d-enrichment-fallback="true"
    >
      <h2
        id="d2d-enrichment-status-heading"
        className="text-lg font-semibold tracking-tight text-slate-600 dark:text-slate-300"
      >
        {labels.fallback.heading}
      </h2>
      <Card className="min-w-0 border-border/60 bg-muted/20 shadow-none hover:shadow-none">
        <CardContent className="min-w-0 gap-2 p-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p className="break-words [overflow-wrap:anywhere]">
            {labels.fallback.profileUnavailable}
          </p>
          <p className="break-words [overflow-wrap:anywhere]">
            {labels.fallback.regulatoryNotResearched}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
