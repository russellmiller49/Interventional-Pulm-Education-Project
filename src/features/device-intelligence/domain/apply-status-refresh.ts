import type { SafetyEvidenceRow } from './safety-notice-schema'
import type { StatusRefreshRow } from './status-refresh-schema'
import {
  toStatusRecommendationGate,
  type ProductStatusView,
  type SafetyDisplay,
} from './product-status'

export function mergeSafetyRefresh(
  previous: SafetyEvidenceRow | null,
  refresh: StatusRefreshRow,
): SafetyEvidenceRow {
  const notices = new Map((previous?.notices ?? []).map((notice) => [notice.recall_number, notice]))
  // A negative search cannot erase known actions. Only a newly matched record updates one.
  for (const notice of refresh.safety.notices) notices.set(notice.recall_number, notice)
  return {
    ...refresh.safety,
    notices: [...notices.values()].sort((a, b) => a.recall_number.localeCompare(b.recall_number)),
  }
}

export function applyStatusRefresh(
  previous: ProductStatusView,
  refresh: StatusRefreshRow,
  evidence: SafetyEvidenceRow | null,
  physicianHold = false,
): ProductStatusView {
  const notices = evidence?.notices ?? []
  const active = notices.filter((n) => n.recorded_state === 'active')
  const retainedActive =
    previous.safetyDisplay === 'active_safety_notice' &&
    previous.safetyReferenceCodes.some((code) => !notices.some((n) => n.recall_number === code))
  const uncertain =
    refresh.safety_identity_review_required ||
    notices.some((n) => ['unknown', 'conflicted'].includes(n.recorded_state))
  const complete =
    evidence?.search_status === 'searched' &&
    evidence.source_checks.length === 2 &&
    evidence.source_checks.every((c) => c.dataset_as_of && !c.has_undated_responses)
  const safetyDisplay: SafetyDisplay =
    active.length || retainedActive
      ? 'active_safety_notice'
      : uncertain || previous.safetyDisplay === 'safety_identity_review_required'
        ? 'safety_identity_review_required'
        : notices.length
          ? 'historical_safety_notice'
          : complete
            ? 'no_exact_action_found_as_of_snapshot'
            : 'safety_status_unverified'
  const scoped = active.length ? active : notices
  const scopes = new Set(scoped.map((n) => n.scope))
  const marketStatus = refresh.market_status ?? previous.marketStatus
  const gate = toStatusRecommendationGate(marketStatus, safetyDisplay)
  return {
    ...previous,
    researched: true,
    researchSnapshotDate: refresh.market_evidence.checked_on,
    marketStatus,
    marketConfidence: refresh.market_status ? refresh.market_confidence : previous.marketConfidence,
    safetyDisplay,
    safetyActionScope: scoped.length
      ? scopes.size === 1
        ? scoped[0].scope
        : 'unknown'
      : safetyDisplay === 'safety_identity_review_required'
        ? (previous.safetyActionScope ?? 'unknown')
        : retainedActive
          ? previous.safetyActionScope
          : null,
    safetyReferenceCodes: [
      ...new Set([
        ...notices.map((n) => n.recall_number),
        ...(retainedActive ? previous.safetyReferenceCodes : []),
      ]),
    ].sort(),
    statusRecommendationGate:
      gate === 'blocked_active_safety_action' ? gate : physicianHold ? 'review_required' : gate,
  }
}
