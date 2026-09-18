import type {
  MarketEvidence,
  StatusRefreshRow,
} from '../../../src/features/device-intelligence/domain/status-refresh-schema'
import type { SafetyNotice } from '../../../src/features/device-intelligence/domain/safety-notice-schema'
import {
  safetyStatusDisposition,
  normalizeSafetyDate,
  safetyActionScopeFor,
} from '../../ip-preference-cards/us-status/acquire-fda-safety-actions'
import { identifiers, SNAPSHOT, type BatchResult, type Receipt } from './acquire'
import {
  companyMatches,
  exact,
  identifierInText,
  matchedUdi,
  objects,
  recordsFor,
  string,
  type Product,
  type RecordFields,
  type SourcedRecord,
} from './identity'
import { manufacturerSources, novatechRestriction } from './manufacturer-sources'

export interface Inputs {
  udi: BatchResult[]
  registration: BatchResult[]
  recall: BatchResult[]
  enforcement: BatchResult[]
  snapshots: Record<string, Receipt>
}
const dateOf = (page: Receipt) => page.datasetLastUpdated?.slice(0, 10) ?? null
export function completeFor(p: Product, batches: BatchResult[]): boolean {
  const matching = batches.filter((b) => b.product_ids.includes(p.product_id))
  return matching.length > 0 && matching.every((b) => b.complete && !b.error && b.pages.length > 0)
}
function datasetDate(p: Product, batches: BatchResult[], snapshot?: Receipt): string | null {
  const dates = [
    ...new Set(
      [
        ...batches
          .filter((b) => b.product_ids.includes(p.product_id))
          .flatMap((b) => b.pages.map(dateOf)),
        snapshot ? dateOf(snapshot) : null,
      ].filter(Boolean),
    ),
  ]
  return dates.length === 1 ? dates[0] : null
}
export function marketFinding(p: Product, input: Inputs) {
  const rows = matchedUdi(p, input.udi)
  const identifiersSet = new Set(identifiers(p).map(exact))
  const sources = manufacturerSources.filter(
    (s) =>
      s.manufacturer === p.manufacturer &&
      s.identifiers.some((id) => identifiersSet.has(exact(id))),
  )
  const restricted =
    p.manufacturer === 'Novatech' &&
    /\b(GSS|EWS|NOVATECH 3D)\b/i.test(`${p.brand_family} ${p.product_name}`)
  const evidence: MarketEvidence = {
    basis: 'identity_unresolved',
    checked_on: SNAPSHOT,
    udi_dataset_as_of: datasetDate(p, input.udi, input.snapshots.udi),
    listing_dataset_as_of: datasetDate(p, input.registration, input.snapshots.registrationlisting),
    records: rows
      .flatMap(({ record }) =>
        objects(record.identifiers)
          .filter((id) => id.type === 'Primary')
          .map((id) => ({
            primary_di: string(id.id),
            distribution_status:
              record.commercial_distribution_status === 'In Commercial Distribution'
                ? ('In Commercial Distribution' as const)
                : record.commercial_distribution_status === 'Not in Commercial Distribution'
                  ? ('Not in Commercial Distribution' as const)
                  : ('Unknown' as const),
          })),
      )
      .sort((a, b) => a.primary_di.localeCompare(b.primary_di)),
    manufacturer_sources: [
      ...sources.map(({ title, url }) => ({ title, url })),
      ...(restricted ? [novatechRestriction] : []),
    ],
    listing_sources: [],
  }
  const result: Pick<StatusRefreshRow, 'market_status' | 'market_confidence' | 'market_evidence'> =
    { market_status: null, market_confidence: null, market_evidence: evidence }
  if (
    !completeFor(p, input.udi) ||
    !completeFor(p, input.registration) ||
    !evidence.udi_dataset_as_of ||
    !evidence.listing_dataset_as_of
  ) {
    evidence.basis = 'incomplete_search'
    return result
  }
  if (!rows.length) {
    if (restricted) evidence.basis = 'manufacturer_restriction'
    return result
  }
  const states = new Set(rows.map(({ record }) => record.commercial_distribution_status))
  // An exact package identifier is evaluated at its own level. Never replace an ended package
  // with a different active configuration sharing the same catalog/model identifier.
  for (const { record } of rows)
    for (const id of objects(record.identifiers))
      if (id.type === 'Package' && identifiersSet.has(exact(id.id))) states.add(id.package_status)
  const active = states.has('In Commercial Distribution')
  const ended = states.has('Not in Commercial Distribution')
  if (active && (ended || states.size > 1 || restricted)) {
    result.market_status = 'current_status_conflicted'
    evidence.basis = restricted ? 'manufacturer_restriction' : 'mixed_distribution'
    return result
  }
  if (!active) {
    evidence.basis = ended ? 'ended_udi_only' : 'identity_unresolved'
    return result
  }
  // Registration is corroborating context, never clearance/approval or proof of orderability.
  const exactListing = recordsFor(p, input.registration).filter(({ record }) => {
    const registration = record.registration as RecordFields | undefined
    return (
      registration &&
      companyMatches(p, registration.name) &&
      ['1', '5'].includes(string(registration.status_code)) &&
      Number(registration.reg_expiry_date_year) >= Number(SNAPSHOT.slice(0, 4)) &&
      Array.isArray(record.proprietary_name) &&
      record.proprietary_name.some((name) =>
        identifiers(p).some(
          (id) => id.length >= 5 && /\d/.test(id) && identifierInText(string(name), id),
        ),
      )
    )
  })
  evidence.listing_sources = [...new Set(exactListing.map(({ page }) => page.requestUrl))].sort()
  const high = Boolean(sources.length || exactListing.length)
  result.market_status = high ? 'confirmed_current_us' : 'likely_current_us'
  result.market_confidence = high ? 'high' : 'moderate'
  evidence.basis = high ? 'corroborated_current' : 'active_udi'
  return result
}

/** The recall database maintains lifecycle updates. Enforcement statuses are frozen at
 * publication, so a dated termination in the recall database supersedes old "ongoing" text. */
export function noticeState(
  recall: RecordFields | undefined,
  enforcement: RecordFields | undefined,
): SafetyNotice['recorded_state'] {
  const r = recall
    ? safetyStatusDisposition(
        string(recall.recall_status),
        normalizeSafetyDate(recall.event_date_terminated),
      )
    : null
  const e = enforcement
    ? safetyStatusDisposition(
        string(enforcement.status),
        normalizeSafetyDate(enforcement.termination_date),
      )
    : null
  if (r === 'historical') return 'historical'
  if (r && e && r !== e && r !== 'unknown' && e !== 'unknown') return 'conflicted'
  return r ?? e ?? 'unknown'
}
const preparedSafetyText = new WeakMap<RecordFields, string>()
export function safetyFinding(p: Product, input: Inputs) {
  const udi = matchedUdi(p, input.udi)
  const allIds = [
    ...new Set([
      ...identifiers(p),
      ...udi.flatMap(({ record }) => objects(record.identifiers).map((id) => string(id.id))),
    ]),
  ]
  const ids = allIds.filter((id) => id.length >= 5 && /\d/.test(id))
  const familyNames = allIds.filter((id) => id.length >= 8 && !/\d/.test(id))
  const notices = new Map<string, Map<string, SourcedRecord>>()
  const ambiguous: { recall_number: string; firm: string; identifiers: string[] }[] = []
  for (const [endpoint, batches] of [
    ['recall', input.recall],
    ['enforcement', input.enforcement],
  ] as const) {
    for (const row of recordsFor(p, batches)) {
      const rec = row.record
      const number = string(endpoint === 'recall' ? rec.product_res_number : rec.recall_number)
      if (!/^Z-\d{4}-\d{4}$/.test(number)) continue
      let text = preparedSafetyText.get(rec)
      if (!text) {
        text = exact(`${string(rec.product_description)}\n${string(rec.code_info)}`)
        preparedSafetyText.set(rec, text)
      }
      const matched = ids.filter((id) => identifierInText(text, id, true))
      if (!matched.length) {
        const families = familyNames.filter((id) => identifierInText(text, id, true))
        if (families.length && companyMatches(p, rec.recalling_firm))
          ambiguous.push({
            recall_number: number,
            firm: string(rec.recalling_firm),
            identifiers: families,
          })
        continue
      }
      if (!companyMatches(p, rec.recalling_firm)) {
        // An unqualified recalling firm is retained for identity review, never auto-attached.
        // Even apparently unrelated number collisions cannot establish a negative finding.
        ambiguous.push({
          recall_number: number,
          firm: string(rec.recalling_firm),
          identifiers: matched,
        })
        continue
      }
      const bySystem = notices.get(number) ?? new Map<string, SourcedRecord>()
      bySystem.set(endpoint, row)
      notices.set(number, bySystem)
    }
  }
  const projected: SafetyNotice[] = [...notices]
    .map(([number, bySystem]) => {
      const recall = bySystem.get('recall'),
        enforcement = bySystem.get('enforcement')
      const rec = (recall ?? enforcement)!.record
      const cfres = string(recall?.record.cfres_id)
      const event = string(recall?.record.res_event_number ?? enforcement?.record.event_id)
      const description = [...bySystem.values()]
        .map(({ record }) => `${string(record.product_description)}\n${string(record.code_info)}`)
        .join('\n')
      return {
        recall_number: number,
        event_id: /^\d+$/.test(event) ? event : null,
        match_scope: 'exact_product' as const,
        recorded_state: noticeState(recall?.record, enforcement?.record),
        scope: safetyActionScopeFor(string(rec.code_info), 0),
        matched_identifiers: ids.filter((id) => identifierInText(description, id)).sort(),
        reason_for_recall: string(rec.reason_for_recall).trim().slice(0, 2000) || null,
        initiated_on: normalizeSafetyDate(rec.event_date_initiated ?? rec.recall_initiation_date),
        reports: [...bySystem]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([endpoint, { record, page }]) => ({
            system:
              endpoint === 'recall' ? ('device_recall' as const) : ('device_enforcement' as const),
            recorded_status:
              string(endpoint === 'recall' ? record.recall_status : record.status) || 'Unknown',
            classification: ['Class I', 'Class II', 'Class III', 'Not Yet Classified'].includes(
              string(record.classification),
            )
              ? (record.classification as
                  | 'Class I'
                  | 'Class II'
                  | 'Class III'
                  | 'Not Yet Classified')
              : null,
            dataset_as_of: dateOf(page),
            retrieved_on: page.retrievedAt.slice(0, 10),
          })),
        official_record_url: /^\d+$/.test(cfres)
          ? `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=${cfres}`
          : null,
      }
    })
    .sort((a, b) => a.recall_number.localeCompare(b.recall_number))
  const complete =
    completeFor(p, input.recall) && completeFor(p, input.enforcement) && ids.length > 0
  const checks = (['recall', 'enforcement'] as const).map((endpoint) => {
    const date = datasetDate(p, input[endpoint], input.snapshots[endpoint])
    const retrieved =
      input[endpoint]
        .filter((b) => b.product_ids.includes(p.product_id))
        .flatMap((b) => b.pages.map((page) => page.retrievedAt.slice(0, 10)))
        .sort()
        .at(-1) ?? SNAPSHOT
    return {
      system: endpoint === 'recall' ? ('device_recall' as const) : ('device_enforcement' as const),
      dataset_as_of: date,
      has_undated_responses: !date,
      retrieved_on: retrieved,
    }
  })
  return {
    safety: {
      product_id: p.product_id,
      search_status: complete
        ? ('searched' as const)
        : !ids.length
          ? ('not_searched' as const)
          : ('query_error' as const),
      source_checks: checks,
      notices: projected,
    },
    safety_identity_review_required: ambiguous.length > 0,
    ambiguous,
  }
}
