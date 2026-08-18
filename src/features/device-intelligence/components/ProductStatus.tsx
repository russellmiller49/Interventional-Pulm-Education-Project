import { AlertTriangle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import {
  safetyDisplayIsMaterialOnCards,
  type MarketConfidence,
  type MarketStatus,
  type ProductStatusView,
  type SafetyActionScope,
  type SafetyDisplay,
  type StatusRecommendationGate,
} from '@/features/device-intelligence/domain/product-status'

/**
 * D2B market-status and safety presentation.
 *
 * The owner policy is that these are OVERLAYS, so the visual weight has to match: on index
 * and discovery surfaces a product gets one compact market badge, plus a safety badge only
 * when a safety action was actually matched. Nothing here may outweigh the device's name,
 * manufacturer, role, or catalog number, and no card carries a warning block.
 *
 * The full statement — including the two disclaimers the owner requires, the research
 * snapshot date, and the recommendation gate — lives in `MarketSafetyPanel` on the product
 * page, where there is room to say it precisely.
 *
 * Color is never the only signal: every badge carries its label as text, and the active
 * safety notice carries an icon and a heading as well.
 *
 * Every label arrives pre-resolved and parameter-free (see `server/status-labels.server.ts`);
 * values like the snapshot date are appended after a locale-owned label rather than
 * interpolated into a sentence, so no message here can ever be rendered without its
 * arguments.
 */

export interface ProductStatusLabels {
  market: Record<MarketStatus, string>
  marketBadge: Record<MarketStatus, string>
  safety: Record<SafetyDisplay, string>
  safetyDetail: Record<SafetyDisplay, string>
  scope: Record<SafetyActionScope, string>
  gate: Record<StatusRecommendationGate, string>
  gateDetail: Record<StatusRecommendationGate, string>
  confidenceValue: Record<MarketConfidence, string>
  panelHeading: string
  marketHeading: string
  safetyHeading: string
  gateHeading: string
  gateNote: string
  confidenceLabel: string
  snapshotLabel: string
  notResearched: string
  orderabilityNote: string
  lotSpecificNote: string
  referenceCodesLabel: string
  activeNoticeHeading: string
  /** Accessible prefix so a badge reads as "Market status: …" to a screen reader. */
  marketBadgeA11yPrefix: string
  safetyBadgeA11yPrefix: string
}

const MARKET_BADGE_STYLES: Record<MarketStatus, string> = {
  confirmed_current_us:
    'border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  likely_current_us: 'border-sky-600/50 bg-sky-500/10 text-sky-900 dark:text-sky-200',
  current_status_unverified: 'border-border bg-muted text-muted-foreground',
  current_status_conflicted:
    'border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  historical_or_discontinued: 'border-border bg-muted/60 text-foreground/80',
  not_applicable_noncommercial_or_local: 'border-border bg-muted text-muted-foreground',
}

const SAFETY_BADGE_STYLES: Record<SafetyDisplay, string> = {
  active_safety_notice: 'border-rose-600/60 bg-rose-500/10 text-rose-900 dark:text-rose-200',
  historical_safety_notice: 'border-border bg-muted/60 text-foreground/80',
  safety_identity_review_required:
    'border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  safety_status_unverified: 'border-border bg-muted text-muted-foreground',
  no_exact_action_found_as_of_snapshot: 'border-border bg-muted text-muted-foreground',
}

/**
 * `relative` is load-bearing, not decoration. The screen-reader prefixes below are `sr-only`,
 * which is `position: absolute`; without a positioned ancestor their containing block is the
 * initial containing block, so the table's `overflow-x-auto` scroller could not clip them and
 * their 1px boxes — sitting at the last column's x offset inside a 900px-wide table — extended
 * the DOCUMENT's scrollable width (390 -> 837 at 390px, review finding PR107-D2B-UI-001).
 * Making the badge the containing block keeps them inside the intentionally scrollable region.
 * With no offsets set it moves nothing and creates no stacking context.
 */
const BADGE_BASE =
  'relative inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4'

export function MarketStatusBadge({
  status,
  labels,
}: {
  status: ProductStatusView
  labels: ProductStatusLabels
}) {
  return (
    <span
      data-market-status={status.marketStatus}
      className={cn(BADGE_BASE, MARKET_BADGE_STYLES[status.marketStatus])}
    >
      <span className="sr-only">{labels.marketBadgeA11yPrefix} </span>
      {labels.marketBadge[status.marketStatus]}
    </span>
  )
}

/**
 * Renders only when a safety action was actually matched (active, historical, or
 * identity-ambiguous). "Not verified" and "no exact action found" are deliberately NOT badged
 * across the whole atlas — they would be noise on every row, and neither may be read as a
 * clean bill of health. Both are stated in full on the product page instead.
 */
export function SafetyBadge({
  status,
  labels,
}: {
  status: ProductStatusView
  labels: ProductStatusLabels
}) {
  if (!safetyDisplayIsMaterialOnCards(status.safetyDisplay)) return null
  return (
    <span
      data-safety-display={status.safetyDisplay}
      className={cn(BADGE_BASE, SAFETY_BADGE_STYLES[status.safetyDisplay])}
    >
      <span className="sr-only">{labels.safetyBadgeA11yPrefix} </span>
      {labels.safety[status.safetyDisplay]}
    </span>
  )
}

/** Market badge plus the safety badge when material — the compact card/table treatment. */
export function ProductStatusBadges({
  status,
  labels,
}: {
  status: ProductStatusView
  labels: ProductStatusLabels
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <MarketStatusBadge status={status} labels={labels} />
      <SafetyBadge status={status} labels={labels} />
    </div>
  )
}

function SafetyFacts({
  status,
  labels,
}: {
  status: ProductStatusView
  labels: ProductStatusLabels
}) {
  return (
    <>
      <p className="text-sm leading-6">{labels.safetyDetail[status.safetyDisplay]}</p>
      {status.safetyReferenceCodes.length > 0 ? (
        <p className="text-sm">
          {labels.referenceCodesLabel}{' '}
          <span className="font-mono text-xs">{status.safetyReferenceCodes.join(', ')}</span>
        </p>
      ) : null}
      {status.safetyActionScope ? (
        <p className="text-sm">{labels.scope[status.safetyActionScope]}</p>
      ) : null}
    </>
  )
}

/**
 * The product-detail "Market and safety status" panel: a clearly separated section carrying
 * the controlled market label, the research confidence where it means something, the snapshot
 * date, the safety statement with its recall numbers and scope, the recommendation gate, and
 * the two statements the owner requires on every product — that market status does not
 * establish present orderability, and that safety notices may be lot-specific.
 *
 * Research rationales, unresolved-question prose, and raw FDA text are not available here:
 * the compact overlay never carried them into the runtime at all.
 */
export function MarketSafetyPanel({
  status,
  labels,
}: {
  status: ProductStatusView
  labels: ProductStatusLabels
}) {
  const active = status.safetyDisplay === 'active_safety_notice'
  const showConfidence =
    status.marketConfidence !== null &&
    (status.marketStatus === 'confirmed_current_us' || status.marketStatus === 'likely_current_us')

  return (
    <section className="space-y-3" aria-label={labels.panelHeading}>
      <h2 className="text-2xl font-semibold tracking-tight">{labels.panelHeading}</h2>

      {active ? (
        // Prominent but not alarmist: a bordered notice with an icon and a heading, not a
        // full-bleed red banner. The product itself stays visible and fully described.
        <Card className="border-rose-600/50 bg-rose-500/5">
          <CardContent className="flex gap-3 p-5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
            />
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-foreground">{labels.activeNoticeHeading}</p>
              <SafetyFacts status={status} labels={labels} />
              <p className="text-xs leading-5 text-muted-foreground">{labels.lotSpecificNote}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="text-xs text-muted-foreground">
            {status.researchSnapshotDate ? (
              <>
                {labels.snapshotLabel}{' '}
                <span className="font-mono">{status.researchSnapshotDate}</span>
              </>
            ) : (
              labels.notResearched
            )}
          </p>

          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-tight">{labels.marketHeading}</h3>
            <p className="text-sm leading-6">{labels.market[status.marketStatus]}</p>
            {showConfidence && status.marketConfidence ? (
              <p className="text-xs text-muted-foreground">
                {labels.confidenceLabel} {labels.confidenceValue[status.marketConfidence]}
              </p>
            ) : null}
          </div>

          {active ? null : (
            <div className="space-y-1">
              <h3 className="text-sm font-bold tracking-tight">{labels.safetyHeading}</h3>
              <SafetyFacts status={status} labels={labels} />
            </div>
          )}

          <div className="space-y-1">
            <h3 className="text-sm font-bold tracking-tight">{labels.gateHeading}</h3>
            <p className="text-sm leading-6">
              <span data-status-gate={status.statusRecommendationGate} className="font-semibold">
                {labels.gate[status.statusRecommendationGate]}
              </span>
              {' — '}
              {labels.gateDetail[status.statusRecommendationGate]}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{labels.gateNote}</p>
          </div>

          <div className="space-y-1 border-t border-border/60 pt-3">
            <p className="text-xs leading-5 text-muted-foreground">{labels.orderabilityNote}</p>
            {active ? null : (
              <p className="text-xs leading-5 text-muted-foreground">{labels.lotSpecificNote}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
