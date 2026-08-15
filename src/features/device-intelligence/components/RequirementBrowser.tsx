import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import type {
  ProcedureWorkspace,
  WorkspaceRequirement,
} from '@/features/device-intelligence/server/procedures.server'
import { safetyDisplayIsMaterialOnCards } from '@/features/device-intelligence/domain/product-status'
import { EvidenceBadge } from './EvidenceBadge'
import { LinkTabs } from './LinkTabs'
import { SafetyBadge, type ProductStatusLabels } from './ProductStatus'

/**
 * The read-only requirement browser: one authored requirement list, viewable by setup zone
 * or by procedural phase (URL-param link tabs — keyboard-accessible anchors, no client JS).
 * Every card quotes the authored texts verbatim and badges the coverage-ladder state; links
 * go only to device pages inside the D2B atlas cohort.
 *
 * D2B: authored options now include products whose current availability is unestablished, and
 * an option carrying a matched FDA safety action gets a compact safety badge here. Market
 * status is deliberately NOT badged on these dense requirement cards — availability
 * uncertainty must never read as a compatibility or eligibility statement — and lives on the
 * device page one click away. The badge is display only: `selectable` and `eligibilityStatus`
 * remain the canonical governed values and no ordering or default changes because of it.
 */

export type RequirementView = 'zones' | 'phases'

/**
 * The one template section that describes a divergent long-term pathway rather than the
 * procedure itself (owner-review F-06): rendered as a separated, collapsed subsection so
 * indwelling-catheter equipment does not read as core chest-tube setup. Display-only; the
 * template membership is a governed-data question deferred to owner data review.
 */
export const DIVERGENT_PATHWAY_SECTION = 'Long-term drainage'

const COVERAGE_EVIDENCE = {
  selectable_authored: 'authored_selectable',
  non_selectable_authored_only: 'authored_non_selectable',
  proposals_only: 'unreviewed_proposal',
  no_option_no_proposal_role_mapped: 'unknown',
  no_option_no_proposal_unmapped: 'unknown',
} as const

export async function RequirementBrowser({
  locale,
  workspace,
  view,
  statusLabels,
}: {
  locale: string
  workspace: ProcedureWorkspace
  view: RequirementView
  statusLabels: ProductStatusLabels
}) {
  const t = await getTranslations('deviceIntelligence.workspace')
  const tCommon = await getTranslations('deviceIntelligence.common')

  const basePath = `/${locale}/procedures/${workspace.procedureCode}`
  const groups =
    view === 'zones'
      ? workspace.setupZoneOrder.map((zone) => ({
          key: zone,
          label: t(`setupZones.${zone}` as 'setupZones.unassigned'),
          requirements: workspace.requirements.filter(
            (requirement) => requirement.setupZone === zone,
          ),
        }))
      : workspace.proceduralPhaseOrder.map((phase) => ({
          key: phase,
          label: t(`proceduralPhases.${phase}` as 'proceduralPhases.unassigned'),
          requirements: workspace.requirements.filter(
            (requirement) => requirement.proceduralPhase === phase,
          ),
        }))

  const coverageLabels: Record<string, string> = {
    selectable_authored: t('coverage.selectableAuthored'),
    non_selectable_authored_only: t('coverage.nonSelectableAuthoredOnly'),
    proposals_only: t('coverage.proposalsOnly'),
    no_option_no_proposal_role_mapped: t('coverage.noOptionRoleMapped'),
    no_option_no_proposal_unmapped: t('coverage.noOptionUnmapped'),
  }

  return (
    <section aria-label={t('requirementsHeading')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('requirementsHeading')}</h2>
        <LinkTabs
          label={t('viewTabsLabel')}
          tabs={[
            {
              key: 'zones',
              label: t('viewZones'),
              href: basePath as Route,
              active: view === 'zones',
            },
            {
              key: 'phases',
              label: t('viewPhases'),
              href: `${basePath}?view=phases` as Route,
              active: view === 'phases',
            },
          ]}
        />
      </div>

      {groups
        .filter((group) => group.requirements.length > 0)
        .map((group) => {
          const coreRequirements = group.requirements.filter(
            (requirement) => requirement.section !== DIVERGENT_PATHWAY_SECTION,
          )
          const divergentRequirements = group.requirements.filter(
            (requirement) => requirement.section === DIVERGENT_PATHWAY_SECTION,
          )
          const renderCard = (requirement: WorkspaceRequirement) => (
            <RequirementCard
              key={requirement.id}
              locale={locale}
              requirement={requirement}
              coverageLabels={coverageLabels}
              statusLabels={statusLabels}
              labels={{
                order: t('requirement.order'),
                section: t('requirement.section'),
                role: t('requirement.role'),
                dependencyRule: t('requirement.dependencyRule'),
                selectionMode: t('requirement.selectionMode'),
                openHold: t('requirement.openHold'),
                zone: t('requirement.zone'),
                phase: t('requirement.phase'),
                allowCustom: t('requirement.allowCustom'),
                demoStandIn: tCommon('badges.demoStandIn'),
                proposals: t('requirement.proposals'),
                proposalsDisclaimer: t('requirement.proposalsDisclaimer'),
                authoredOptions: t('requirement.authoredOptions'),
                noAuthoredOptions: t('requirement.noAuthoredOptions'),
                optionsWithheld: t('requirement.optionsWithheld', {
                  count: requirement.withheldAuthoredOptionCount,
                  selectable: requirement.withheldSelectableOptionCount,
                }),
                optionSafetyNote: t('requirement.optionSafetyNote'),
                selectable: tCommon('badges.authoredSelectable'),
                nonSelectable: tCommon('badges.authoredNonSelectable'),
                zoneLabel: t(`setupZones.${requirement.setupZone}` as 'setupZones.unassigned'),
                phaseLabel: t(
                  `proceduralPhases.${requirement.proceduralPhase}` as 'proceduralPhases.unassigned',
                ),
              }}
            />
          )
          return (
            <div key={group.key} className="space-y-2">
              <h3 className="text-lg font-bold tracking-tight">{group.label}</h3>
              {coreRequirements.length > 0 ? (
                <ul className="grid gap-3 xl:grid-cols-2">{coreRequirements.map(renderCard)}</ul>
              ) : null}
              {divergentRequirements.length > 0 ? (
                <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t('divergentPathwayGroup', { count: divergentRequirements.length })}
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t('divergentPathwayCaption')}
                  </p>
                  <ul className="mt-3 grid gap-3 xl:grid-cols-2">
                    {divergentRequirements.map(renderCard)}
                  </ul>
                </details>
              ) : null}
            </div>
          )
        })}
    </section>
  )
}

function RequirementCard({
  locale,
  requirement,
  coverageLabels,
  statusLabels,
  labels,
}: {
  locale: string
  requirement: WorkspaceRequirement
  coverageLabels: Record<string, string>
  statusLabels: ProductStatusLabels
  labels: {
    order: string
    section: string
    role: string
    dependencyRule: string
    selectionMode: string
    openHold: string
    zone: string
    phase: string
    allowCustom: string
    demoStandIn: string
    proposals: string
    proposalsDisclaimer: string
    authoredOptions: string
    noAuthoredOptions: string
    optionsWithheld: string
    optionSafetyNote: string
    selectable: string
    nonSelectable: string
    zoneLabel: string
    phaseLabel: string
  }
}) {
  const coverage = requirement.coverage
  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">{requirement.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {labels.order} {requirement.authoredOrder}
            {requirement.section ? (
              <>
                {' '}
                · {labels.section} {requirement.section}
              </>
            ) : null}
          </p>
        </div>
        <Badge variant="outline" size="sm" className="normal-case tracking-normal">
          {requirement.requiredness}
        </Badge>
      </div>

      <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">
        “{requirement.genericRequirement}”
      </blockquote>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <dt className="text-muted-foreground">{labels.role}</dt>
          <dd>
            <Link
              href={
                `/${locale}/clinical-roles/${encodeURIComponent(requirement.roleCode)}` as Route
              }
              className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {requirement.roleName}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.selectionMode}</dt>
          <dd>
            {requirement.selectionMode}
            {requirement.allowCustom ? ` · ${labels.allowCustom}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{labels.openHold}</dt>
          <dd>{requirement.openHoldStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {labels.zone} / {labels.phase}
          </dt>
          <dd>
            {labels.zoneLabel} · {labels.phaseLabel}
          </dd>
        </div>
        {requirement.dependencyRule ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">{labels.dependencyRule}</dt>
            <dd className="italic">“{requirement.dependencyRule}”</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {coverage ? (
          <EvidenceBadge state={COVERAGE_EVIDENCE[coverage.coverage]}>
            {coverageLabels[coverage.coverage]}
          </EvidenceBadge>
        ) : null}
        {coverage?.demoStandIn ? (
          <EvidenceBadge state="demo_stand_in">{labels.demoStandIn}</EvidenceBadge>
        ) : null}
        {requirement.proposalCount > 0 ? (
          <EvidenceBadge
            state="unreviewed_proposal"
            title={labels.proposalsDisclaimer}
          >{`${labels.proposals}: ${requirement.proposalCount}`}</EvidenceBadge>
        ) : null}
      </div>

      {requirement.authoredOptions.length > 0 || requirement.withheldAuthoredOptionCount > 0 ? (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="text-xs font-semibold text-muted-foreground">{labels.authoredOptions}</p>
          {/* Every entry here is inside the D1 atlas cohort by construction (C-02): the
              server view model never carries a non-cohort identity, so every option links. */}
          {requirement.authoredOptions.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {requirement.authoredOptions.map((option) => (
                <li key={option.productId} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Link
                    href={`/${locale}/devices/${option.productId}` as Route}
                    className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {option.productName}
                  </Link>
                  {option.manufacturerDisplay ? (
                    <span className="text-muted-foreground">· {option.manufacturerDisplay}</span>
                  ) : null}
                  <EvidenceBadge
                    state={option.selectable ? 'authored_selectable' : 'authored_non_selectable'}
                  >
                    {option.selectable ? labels.selectable : labels.nonSelectable}
                  </EvidenceBadge>
                  <SafetyBadge status={option.status} labels={statusLabels} />
                </li>
              ))}
            </ul>
          ) : null}
          {requirement.authoredOptions.some((option) =>
            safetyDisplayIsMaterialOnCards(option.status.safetyDisplay),
          ) ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {labels.optionSafetyNote}
            </p>
          ) : null}
          {requirement.withheldAuthoredOptionCount > 0 ? (
            <p className="mt-1 text-xs italic text-muted-foreground">{labels.optionsWithheld}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
          {labels.noAuthoredOptions}
        </p>
      )}
    </li>
  )
}
