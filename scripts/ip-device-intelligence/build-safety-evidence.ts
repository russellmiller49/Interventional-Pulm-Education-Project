import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  usStatusEvidenceArtifactSchema,
  type UsStatusEvidenceArtifact,
} from '../ip-preference-cards/us-status/proposal-schemas'
import {
  statusOverlayArtifactSchema,
  type StatusOverlayArtifact,
} from '../../src/features/device-intelligence/domain/status-overlay-schema'
import {
  safetyEvidenceArtifactSchema,
  safetyRecordLinksSchema,
  type SafetyEvidenceArtifact,
  type SafetyEvidenceRow,
  type SafetyNotice,
} from '../../src/features/device-intelligence/domain/safety-notice-schema'
import { SAFETY_LINKS_PATH } from './acquire-safety-record-links'

const ROOT = path.resolve(__dirname, '../..')
const RESEARCH_PATH =
  'data/ip-preference-cards/research/us-status/2026-08-13/us-status-evidence-proposals.json'
const STATUS_PATH = 'data/ip-device-intelligence/generated/product-status-overlay.json'
export const SAFETY_EVIDENCE_PATH =
  'data/ip-device-intelligence/generated/product-safety-evidence.json'

/** An explicit allowlist of dated FDA fields, independent of market/selection status. */
export function buildSafetyEvidence(
  research: UsStatusEvidenceArtifact,
  statuses: StatusOverlayArtifact,
  links: ReturnType<typeof safetyRecordLinksSchema.parse>,
): SafetyEvidenceRow[] {
  const productById = new Map(
    research.products.map((product) => [product.canonical_identity.product_id, product]),
  )
  const linkByRecall = new Map(links.records.map((link) => [link.recall_number, link]))
  return statuses.rows.map((status) => {
    const product = productById.get(status.product_id)
    if (!product || research.research_as_of_date !== status.research_snapshot_date)
      throw new Error(`Status/research mismatch for ${status.product_id}`)
    const safety = product.layer_results.safety_action
    const sources = product.sources.filter(
      (source) =>
        source.layer === 'safety_action' &&
        source.source_type === 'official_fda_api' &&
        source.retrieval_status === 'retrieved',
    )
    const sourceChecks: SafetyEvidenceRow['source_checks'] = []
    for (const system of ['device_recall', 'device_enforcement'] as const) {
      const endpoint = `https://api.fda.gov/device/${system === 'device_recall' ? 'recall' : 'enforcement'}.json`
      const matching = sources.filter((source) => source.endpoint === endpoint)
      if (!matching.length) continue
      sourceChecks.push({
        system,
        // Oldest source date is intentional: a later page/request does not refresh earlier evidence.
        dataset_as_of:
          matching.flatMap((source) => (source.as_of_date ? [source.as_of_date] : [])).sort()[0] ??
          null,
        has_undated_responses: matching.some((source) => !source.as_of_date),
        retrieved_on: matching.map((source) => source.retrieved_at.slice(0, 10)).sort()[0],
      })
    }
    const groups = new Map<string, typeof safety.records>()
    for (const record of safety.records.filter(
      (record) => record.match_scope === 'exact_product',
    )) {
      groups.set(record.recall_number, [...(groups.get(record.recall_number) ?? []), record])
    }
    const notices: SafetyNotice[] = [...groups]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([recallNumber, records]) => {
        const preferred = records.find((record) => record.system === 'device_recall') ?? records[0]
        const link = linkByRecall.get(recallNumber)
        if (link && records.some((record) => record.event_id && record.event_id !== link.event_id))
          throw new Error(`Recall/event identity conflict: ${recallNumber}`)
        const reports = records
          .map((record) => {
            const endpoint = `https://api.fda.gov/device/${record.system === 'device_recall' ? 'recall' : 'enforcement'}.json`
            const matching = sources.filter(
              (source) =>
                record.source_ids.includes(source.source_id) && source.endpoint === endpoint,
            )
            if (!matching.length)
              throw new Error(`Missing FDA source for ${status.product_id} ${recallNumber}`)
            return {
              system: record.system,
              recorded_status: record.recall_status,
              classification:
                record.classification as SafetyNotice['reports'][number]['classification'],
              dataset_as_of: matching.some((source) => !source.as_of_date)
                ? null
                : matching.map((source) => source.as_of_date!).sort()[0],
              retrieved_on: matching.map((source) => source.retrieved_at.slice(0, 10)).sort()[0],
            }
          })
          .sort((left, right) => left.system.localeCompare(right.system))
        return {
          recall_number: recallNumber,
          event_id: preferred.event_id,
          match_scope: 'exact_product',
          recorded_state:
            new Set(records.map((record) => record.status_disposition)).size === 1
              ? preferred.status_disposition
              : 'conflicted',
          scope:
            new Set(records.map((record) => record.scope)).size === 1 ? preferred.scope : 'unknown',
          matched_identifiers: [
            ...new Set(records.flatMap((record) => record.matched_identifiers)),
          ].sort(),
          reason_for_recall: preferred.reason_for_recall,
          initiated_on: preferred.initiation_date,
          reports,
          official_record_url: link
            ? `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=${link.cfres_id}`
            : null,
        }
      })
    for (const reference of status.safety_reference_codes) {
      if (!notices.some((notice) => notice.recall_number === reference))
        throw new Error(`Missing notice detail for ${reference}`)
    }
    return {
      product_id: status.product_id,
      search_status: safety.search_status,
      source_checks: sourceChecks,
      notices,
    }
  })
}

export function generateSafetyEvidence(repoRoot = ROOT): string {
  const read = (relative: string) => readFileSync(path.join(repoRoot, relative))
  const research = read(RESEARCH_PATH),
    status = read(STATUS_PATH),
    links = read(SAFETY_LINKS_PATH)
  const pin = (relative: string, bytes: Buffer) => ({
    path: relative,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
  const parsedStatus = statusOverlayArtifactSchema.parse(JSON.parse(status.toString()))
  if (parsedStatus.source_artifact.sha256 !== pin(RESEARCH_PATH, research).sha256)
    throw new Error('Status and safety details must use the same pinned research bytes.')
  const artifact: SafetyEvidenceArtifact = safetyEvidenceArtifactSchema.parse({
    format_version: 1,
    artifact_kind: 'device_intelligence_safety_evidence',
    source_artifacts: {
      research: pin(RESEARCH_PATH, research),
      status: pin(STATUS_PATH, status),
      links: pin(SAFETY_LINKS_PATH, links),
    },
    rows: buildSafetyEvidence(
      usStatusEvidenceArtifactSchema.parse(JSON.parse(research.toString())),
      parsedStatus,
      safetyRecordLinksSchema.parse(JSON.parse(links.toString())),
    ),
  })
  return `${JSON.stringify(artifact, null, 2)}\n`
}

function main() {
  const next = generateSafetyEvidence()
  const target = path.join(ROOT, SAFETY_EVIDENCE_PATH)
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== next)
      throw new Error('Safety evidence is stale. Run npm run ip-intel:safety-evidence.')
    process.stdout.write(
      'Safety evidence matches its pinned inputs. External evidence was not refreshed.\n',
    )
  } else {
    writeFileSync(target, next)
    process.stdout.write(`Wrote ${SAFETY_EVIDENCE_PATH} (${Buffer.byteLength(next)} bytes).\n`)
  }
}
if (require.main === module) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`)
    process.exitCode = 1
  }
}
