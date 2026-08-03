import type { Route } from 'next'
import Link from 'next/link'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ExactSlotReviewWorkbookControls } from '@/features/preference-cards/components/ExactSlotReviewWorkbookControls'
import { VerificationBadge } from '@/features/preference-cards/components/VerificationBadge'
import type {
  BacklogGudidAlignment,
  CatalogVerificationDetail,
  CatalogVerificationQueueRow,
} from '@/features/preference-cards/data/catalog-verification.server'
import type { SlotOptionReviewRow } from '@/features/preference-cards/data/slot-option-proposals.server'

function DefinitionRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-2 last:border-0 sm:grid-cols-[12rem_1fr]">
      <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

type EvidenceState = 'available' | 'review' | 'conflict' | 'separate'

function evidenceStateLabel(t: ReturnType<typeof useTranslations>, state: EvidenceState): string {
  return t(
    {
      available: 'admin.verificationEvidenceAvailable',
      review: 'admin.verificationReviewRequired',
      conflict: 'admin.verificationConflict',
      separate: 'admin.verificationSeparateProcess',
    }[state],
  )
}

function backlogGudidAlignmentLabel(
  t: ReturnType<typeof useTranslations>,
  alignment: BacklogGudidAlignment,
): string {
  return t(
    {
      not_applicable: 'admin.verificationBacklogGudidNotApplicable',
      agrees: 'admin.verificationBacklogGudidAgrees',
      different_current_strong: 'admin.verificationBacklogGudidDifferent',
      no_current_strong: 'admin.verificationBacklogGudidNoCurrentStrong',
    }[alignment],
  )
}

function evidenceSteps(t: ReturnType<typeof useTranslations>, row: CatalogVerificationQueueRow) {
  const distributionState: EvidenceState =
    row.distributionEvidence === 'conflicting'
      ? 'conflict'
      : row.distributionEvidence === 'unknown'
        ? 'review'
        : 'available'
  return [
    {
      key: 'manufacturer',
      title: t('admin.verificationStepManufacturer'),
      body:
        row.manufacturerEvidenceCount > 0
          ? t('admin.verificationStepManufacturerAvailable')
          : t('admin.verificationStepManufacturerMissing'),
      state: row.manufacturerEvidenceCount > 0 ? ('available' as const) : ('review' as const),
    },
    {
      key: 'identity',
      title: t('admin.verificationStepIdentity'),
      body:
        row.identityEvidence === 'strong_candidate'
          ? t('admin.verificationStepIdentityStrong')
          : row.identityEvidence === 'weak_candidate_only'
            ? t('admin.verificationStepIdentityWeak')
            : t('admin.verificationStepIdentityMissing'),
      state:
        row.identityEvidence === 'strong_candidate' ? ('available' as const) : ('review' as const),
    },
    {
      key: 'distribution',
      title: t('admin.verificationStepDistribution'),
      body: t(
        {
          in_distribution: 'admin.verificationStepDistributionIn',
          not_in_distribution: 'admin.verificationStepDistributionNot',
          conflicting: 'admin.verificationStepDistributionConflict',
          unknown: 'admin.verificationStepDistributionUnknown',
        }[row.distributionEvidence],
      ),
      state: distributionState,
    },
    {
      key: 'ifu',
      title: t('admin.verificationStepIfu'),
      body: row.hasCurrentIfuEvidence
        ? t('admin.verificationStepIfuAvailable')
        : t('admin.verificationStepIfuMissing'),
      state: row.hasCurrentIfuEvidence ? ('available' as const) : ('review' as const),
    },
    {
      key: 'formulary',
      title: t('admin.verificationStepFormulary'),
      body: t('admin.verificationStepFormularySeparate'),
      state: 'separate' as const,
    },
  ]
}

export function CatalogVerificationWorkspace({
  detail,
  slotProposals,
  locale,
}: {
  detail: CatalogVerificationDetail
  slotProposals: SlotOptionReviewRow[]
  locale: string
}) {
  const t = useTranslations('preferenceCards')
  const { queueRow: row, productDetail, confirmations } = detail
  const { product } = productDetail
  const backlog = row.backlog
  const hasBacklogGudidDrift = ['different_current_strong', 'no_current_strong'].includes(
    row.backlogGudidAlignment,
  )
  const verificationLabels = {
    verified: t('catalog.verification.verified'),
    candidate: t('catalog.verification.candidate'),
    unknown: t('catalog.verification.unknown'),
    usPending: t('catalog.verification.usPending'),
    notDistributed: t('catalog.verification.notDistributed'),
    conflictingDistribution: t('catalog.verification.conflictingDistribution'),
    legacyInstalledBase: t('catalog.verification.legacyInstalledBase'),
    legacyInstalledBaseHelp: t('catalog.verification.legacyInstalledBaseHelp'),
    regulatoryCleared510k: t('catalog.verification.regulatoryCleared510k'),
    regulatoryApprovedPma: t('catalog.verification.regulatoryApprovedPma'),
    regulatoryGrantedDeNovo: t('catalog.verification.regulatoryGrantedDeNovo'),
    regulatoryBreakthroughInvestigational: t(
      'catalog.verification.regulatoryBreakthroughInvestigational',
    ),
    regulatoryBreakthroughPremarketReview: t(
      'catalog.verification.regulatoryBreakthroughPremarketReview',
    ),
    regulatoryNotUsAuthorized: t('catalog.verification.regulatoryNotUsAuthorized'),
    regulatoryHelp: t('catalog.verification.regulatoryHelp'),
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/admin/preference-cards/catalog-qa` as Route}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {t('admin.verificationBackToQueue')}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              `/${locale}/preference-cards/catalog/product/${encodeURIComponent(row.productId)}` as Route
            }
          >
            {t('admin.verificationOpenCatalogRecord')}
          </Link>
        </Button>
      </div>

      <header className="max-w-5xl space-y-3">
        <div className="flex flex-wrap gap-2">
          {backlog?.priority ? (
            <Badge variant={backlog.priority === 'P0' ? 'destructive' : 'outline'}>
              {backlog.priority}
            </Badge>
          ) : (
            <Badge variant="secondary">{t('admin.verificationNotInBacklog')}</Badge>
          )}
          <VerificationBadge
            tier={product.verificationTier}
            usStatusPending={product.usStatusPending}
            distributionStatus={productDetail.distributionStatus}
            catalogLifecycleContext={product.catalogLifecycleContext}
            lifecycleNote={product.lifecycleNote}
            regulatoryStatus={product.regulatoryStatus}
            regulatoryNote={product.regulatoryNote}
            labels={verificationLabels}
          />
          <Badge variant="outline">
            {row.strongMatchCount} {t('admin.verificationStrongShort')}
          </Badge>
          <Badge variant="outline">
            {row.weakMatchCount} {t('admin.verificationWeakShort')}
          </Badge>
        </div>
        <p className="text-sm font-semibold text-primary">{product.manufacturerDisplay}</p>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">{product.product_name}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {[product.catalog_number, product.product_id].filter(Boolean).join(' · ')}
        </p>
      </header>

      <aside className="rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-bold">{t('admin.verificationSafetyTitle')}</p>
        <p className="mt-1">{t('admin.verificationSafety')}</p>
      </aside>

      <ExactSlotReviewWorkbookControls
        locale={locale}
        totalCount={slotProposals.length}
        filteredCount={slotProposals.length}
        requiredCount={
          slotProposals.filter((proposal) => proposal.requiredness === 'required').length
        }
        productId={row.productId}
        productName={row.productName}
        productProposalCount={slotProposals.length}
      />

      <section className="space-y-3" aria-labelledby="review-path-heading">
        <div>
          <h2 id="review-path-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.verificationReviewPath')}
          </h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t('admin.verificationReviewPathDescription')}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-5">
          {evidenceSteps(t, row).map((step, index) => (
            <Card key={step.key}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-black">
                    {index + 1}
                  </span>
                  <Badge
                    variant={
                      step.state === 'conflict'
                        ? 'destructive'
                        : step.state === 'available'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {evidenceStateLabel(t, step.state)}
                  </Badge>
                </div>
                <h3 className="font-bold">{step.title}</h3>
                <p className="text-xs leading-5 text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="text-xl font-bold tracking-tight">
              {t('admin.verificationCurrentCatalog')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('admin.verificationCurrentCatalogDescription')}
            </p>
            <dl className="mt-4">
              <DefinitionRow term={t('admin.manufacturer')}>
                {product.manufacturerDisplay}
              </DefinitionRow>
              <DefinitionRow term={t('admin.catalogNumber')}>
                <span className="font-mono">
                  {product.catalog_number ?? t('catalog.missingValue')}
                </span>
              </DefinitionRow>
              <DefinitionRow term={t('catalog.product.gtin')}>
                <span className="font-mono">{product.gtin ?? t('catalog.missingValue')}</span>
              </DefinitionRow>
              <DefinitionRow term={t('admin.verification')}>
                {product.verification_status ?? t('catalog.missingValue')}
              </DefinitionRow>
              <DefinitionRow term={t('admin.verificationVisibility')}>
                {product.live_dropdown_status ?? t('catalog.missingValue')}
              </DefinitionRow>
              <DefinitionRow term={t('admin.verificationPrimarySource')}>
                {[product.primary_source_id, product.primary_source_location]
                  .filter(Boolean)
                  .join(' · ') || t('catalog.missingValue')}
              </DefinitionRow>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-xl font-bold tracking-tight">
              {t('admin.verificationBacklogContext')}
            </h2>
            {backlog ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('admin.verificationBacklogSnapshotDescription')}
                </p>
                <dl className="mt-4">
                  <DefinitionRow term={t('admin.workstream')}>{backlog.workstream}</DefinitionRow>
                  <DefinitionRow term={t('admin.verificationIssue')}>
                    {backlog.qa_issue_type} · {backlog.qa_severity}
                  </DefinitionRow>
                  <DefinitionRow term={t('admin.reviewStatus')}>
                    {backlog.review_status} · {backlog.decision}
                  </DefinitionRow>
                  <DefinitionRow term={t('admin.gudid')}>{backlog.gudid_result}</DefinitionRow>
                  <DefinitionRow term={t('admin.verificationBacklogSuggestedDi')}>
                    <span className="font-mono">
                      {backlog.suggested_primary_di ?? t('catalog.missingValue')}
                    </span>
                  </DefinitionRow>
                  <DefinitionRow term={t('admin.verificationBacklogGudidAlignment')}>
                    {backlogGudidAlignmentLabel(t, row.backlogGudidAlignment)}
                  </DefinitionRow>
                  <DefinitionRow term={t('admin.verificationRemaining')}>
                    {backlog.verification_remaining}
                  </DefinitionRow>
                </dl>
                {row.backlogDriftFields.length > 0 || hasBacklogGudidDrift ? (
                  <div className="mt-4 rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-bold">{t('admin.verificationBacklogDriftTitle')}</p>
                    <p className="mt-1">{t('admin.verificationBacklogDriftBody')}</p>
                    {row.backlogDriftFields.length > 0 ? (
                      <p className="mt-2 font-mono text-xs">{row.backlogDriftFields.join(', ')}</p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-4 rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {t('admin.verificationNotInBacklogTitle')}
                </p>
                <p className="mt-1">{t('admin.verificationAdditionNote')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3" aria-labelledby="source-evidence-heading">
        <div>
          <h2 id="source-evidence-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.verificationSourceEvidence')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.verificationSourceEvidenceDescription')}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {productDetail.sources.map((source) => (
            <Card key={`${source.sourceId}-${source.sourceLocation ?? ''}`}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{source.sourceId}</Badge>
                  {source.reliabilityTier ? (
                    <Badge variant="secondary">{source.reliabilityTier}</Badge>
                  ) : null}
                </div>
                <h3 className="font-bold">{source.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {[
                    source.publisher,
                    source.filename,
                    source.sourceLocation,
                    source.revisionDate,
                    source.asOfDate,
                    source.sourceType,
                    source.claimType,
                    source.verificationStatus,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {source.usePolicy ? (
                  <div className="rounded-lg bg-muted/60 p-3 text-xs leading-5">
                    <p className="font-bold">{t('catalog.product.sourceUsePolicy')}</p>
                    <p className="mt-1 text-muted-foreground">{source.usePolicy}</p>
                  </div>
                ) : null}
                {source.linkNotes || source.sourceNotes ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {[source.linkNotes, source.sourceNotes].filter(Boolean).join(' ')}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="gudid-evidence-heading">
        <div>
          <h2 id="gudid-evidence-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.verificationGudidEvidence')}
          </h2>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            {t('admin.verificationGudidEvidenceDescription')}
          </p>
        </div>
        {confirmations.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {confirmations.map((confirmation) => {
              const strong = confirmation.match_strength === 'manufacturer_and_catalog_number'
              return (
                <Card
                  key={`${confirmation.gudid_primary_di}-${confirmation.gudid_gtin ?? ''}`}
                  className={strong ? undefined : 'border-amber-400/60'}
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={strong ? 'secondary' : 'outline'}>
                        {strong
                          ? t('admin.verificationIdentityStrong')
                          : t('admin.verificationIdentityWeak')}
                      </Badge>
                      <Badge
                        variant={
                          /^Not in Commercial Distribution$/i.test(
                            confirmation.gudid_distribution_status,
                          )
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {confirmation.gudid_distribution_status}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold">{confirmation.gudid_company}</p>
                      <p className="text-sm">{confirmation.gudid_brand}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {confirmation.gudid_description}
                      </p>
                    </div>
                    <dl>
                      <DefinitionRow term={t('admin.verificationPrimaryDi')}>
                        <span className="font-mono">{confirmation.gudid_primary_di}</span>
                      </DefinitionRow>
                      <DefinitionRow term={t('admin.verificationCurrentCatalogNumber')}>
                        <span className="font-mono">
                          {confirmation.catalog_number ?? t('catalog.missingValue')}
                        </span>
                      </DefinitionRow>
                      <DefinitionRow term={t('catalog.product.gtin')}>
                        <span className="font-mono">
                          {confirmation.gudid_gtin ?? t('catalog.missingValue')}
                        </span>
                      </DefinitionRow>
                    </dl>
                    {confirmation.proposals.length > 0 ? (
                      <ul className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs leading-5">
                        {confirmation.proposals.map((proposal) => (
                          <li key={proposal}>• {proposal}</li>
                        ))}
                      </ul>
                    ) : null}
                    {!strong ? (
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        {t('admin.verificationWeakWarning')}
                      </p>
                    ) : null}
                    <a
                      href={`https://accessgudid.nlm.nih.gov/devices/${encodeURIComponent(
                        confirmation.gudid_primary_di,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      {t('admin.verificationOpenGudid')}
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            {t('admin.verificationNoGudidCandidates')}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="slot-impact-heading">
        <div>
          <h2 id="slot-impact-heading" className="text-2xl font-bold tracking-tight">
            {t('admin.verificationProcedureImpact')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.verificationProcedureImpactDescription')}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold">{t('admin.verificationMappedUses')}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {productDetail.roles.map((role) => (
                  <Badge key={role.roleCode} variant="outline">
                    {role.roleName} · {t('admin.verificationRoleFit')}:{' '}
                    {role.roleFit ?? t('catalog.missingValue')} · {role.roleCode}
                  </Badge>
                ))}
              </div>
              {productDetail.slots.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {productDetail.slots.map((slot) => (
                    <li key={slot.slotId} className="rounded-lg bg-muted/60 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{slot.requiredness}</Badge>
                        <Badge variant={slot.selectable === true ? 'secondary' : 'outline'}>
                          {slot.selectable === true
                            ? t('admin.verificationSelectable')
                            : slot.selectable === false
                              ? t('admin.verificationNotSelectable')
                              : t('admin.verificationSelectionUnknown')}
                        </Badge>
                        {slot.eligibilityStatus ? (
                          <Badge variant="outline">{slot.eligibilityStatus}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 font-semibold">{slot.procedureName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{slot.slotLabel}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {slot.slotId}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('admin.verificationNoAuthoredSlots')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold">{t('admin.verificationUnreviewedSlotProposals')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.verificationUnreviewedSlotProposalsDescription')}
              </p>
              {slotProposals.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {slotProposals.map((proposal) => (
                    <li
                      key={`${proposal.slot_id}-${proposal.product_id}`}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{proposal.requiredness}</Badge>
                        <Badge variant="secondary">{t('admin.slotReviewUnreviewed')}</Badge>
                        <Badge variant="outline">
                          {t('admin.verificationRoleFit')}:{' '}
                          {proposal.role_fit ?? t('catalog.missingValue')}
                        </Badge>
                      </div>
                      <p className="mt-2 font-semibold">{proposal.procedureName}</p>
                      <p className="text-xs text-muted-foreground">
                        {proposal.slot_label} · {proposal.roleName}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('admin.verificationNoSlotProposals')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <aside className="rounded-2xl border border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
        <p className="font-bold text-foreground">{t('admin.verificationConceptBoundaryTitle')}</p>
        <p className="mt-1">{t('admin.verificationConceptBoundary')}</p>
      </aside>
    </div>
  )
}
