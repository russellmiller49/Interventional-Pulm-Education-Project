import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { physicianReviewArtifactSchema } from '../../src/features/device-intelligence/domain/physician-review-schema'

const ROOT = path.resolve(__dirname, '../..')
export const REVIEW_PATH = 'data/ip-device-intelligence/reviewed/physician-review-2026-09-17.json'
export const REVIEW_OVERLAY_PATH =
  'data/ip-device-intelligence/generated/physician-review-overlay.json'
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const read = (relative: string) => readFileSync(path.join(ROOT, relative))

/** Authoring validation only. Raw response prose never enters the runtime artifact. */
export function validatePhysicianReview(input: unknown) {
  const artifact = physicianReviewArtifactSchema.parse(input)
  const decisions = new Map(artifact.decisions.map((decision) => [decision.check_id, decision]))
  if (decisions.size !== 442 || artifact.decisions.length !== decisions.size) {
    throw new Error('Expected 442 unique physician decisions')
  }
  for (const [name, pin] of Object.entries(artifact.source_pins)) {
    if (
      ![
        'batch.json',
        'udi-candidates-2026-09-12.json',
        'manufacturer-proposals.json',
        'web-sources.json',
      ].includes(name)
    ) {
      throw new Error('Unexpected review source pin')
    }
    if (sha(read(`docs/ip-device-intelligence/daily-reference-review/${name}`)) !== pin) {
      throw new Error(`Review source drift: ${name}`)
    }
  }
  if (Object.keys(artifact.source_pins).length !== 4) throw new Error('Missing review source pins')
  const batch = JSON.parse(
    read('docs/ip-device-intelligence/daily-reference-review/batch.json').toString(),
  )
  const expectedIds = batch.products.map((p: { product_id: string }) => p.product_id).sort()
  if (
    JSON.stringify(expectedIds) !==
    JSON.stringify(artifact.overlay.products.map((p) => p.product_id).sort())
  ) {
    throw new Error('Review coverage must match the frozen 50-product batch')
  }
  const catalog = new Map<string, Record<string, unknown>>(
    JSON.parse(read('data/ip-preference-cards/generated/catalog-products.json').toString()).map(
      (p: Record<string, unknown>) => [p.product_id, p],
    ),
  )
  const validateEvidence = (
    productId: string,
    field: { check_ids: string[] },
    allowed?: string[],
  ) => {
    for (const id of field.check_ids) {
      const decision = decisions.get(id)
      if (
        !id.startsWith(`${productId}:`) ||
        !decision ||
        (allowed && !allowed.includes(decision.status))
      ) {
        throw new Error(`Unsupported publication from ${id}`)
      }
    }
  }
  for (const product of artifact.overlay.products) {
    for (const field of [product.summary, product.configuration, ...product.specifications]) {
      if (field) validateEvidence(product.product_id, field, ['confirm'])
    }
    for (const correction of product.catalog_corrections) {
      validateEvidence(product.product_id, correction, ['confirm', 'refute'])
      if (catalog.get(product.product_id)?.[correction.field] !== correction.before) {
        throw new Error(
          `Catalog correction precondition changed: ${product.product_id}.${correction.field}`,
        )
      }
    }
    for (const record of product.udi_records) {
      validateEvidence(product.product_id, record)
      if (
        record.scope === 'exact' &&
        record.check_ids.some((id) => decisions.get(id)?.status === 'needs_evidence')
      ) {
        throw new Error(`Unresolved identity cannot become exact: ${product.product_id}`)
      }
    }
    for (const note of product.notes) validateEvidence(product.product_id, note)
    for (const exclusion of product.excluded_recalls) {
      validateEvidence(product.product_id, exclusion, ['refute'])
      if (
        !exclusion.check_ids.includes(`${product.product_id}:recall-${exclusion.recall_number}`)
      ) {
        throw new Error('Recall exclusion must cite the exact refuted applicability check')
      }
    }
    for (const notice of product.additional_notices) {
      if (
        !artifact.safety_receipts.some((receipt) => receipt.recall_number === notice.recall_number)
      ) {
        throw new Error(`Missing FDA receipt: ${notice.recall_number}`)
      }
    }
    const expectedUnresolved = artifact.decisions
      .filter(
        (d) => d.check_id.startsWith(`${product.product_id}:`) && d.status === 'needs_evidence',
      )
      .map((d) => d.check_id)
      .sort()
    if (
      JSON.stringify(expectedUnresolved) !==
      JSON.stringify(product.unresolved_checks.map((d) => d.check_id).sort())
    ) {
      throw new Error(`Lost unresolved findings: ${product.product_id}`)
    }
  }
  if (
    artifact.overlay.procedures.length !== 3 ||
    new Set(artifact.overlay.procedures.map((p) => p.code)).size !== 3
  ) {
    throw new Error('Expected all three draft procedures')
  }
  for (const procedure of artifact.overlay.procedures) {
    for (const id of procedure.unresolved_checks) {
      if (
        !id.startsWith(`PROCEDURE:${procedure.code}:`) ||
        decisions.get(id)?.status !== 'needs_evidence'
      ) {
        throw new Error('Procedure review must preserve unresolved local governance')
      }
    }
  }
  return artifact
}

export function verifyOriginalExport(
  raw: Buffer,
  artifact: ReturnType<typeof validatePhysicianReview>,
) {
  if (sha(raw) !== artifact.export_sha256) throw new Error('Review export SHA-256 mismatch')
  const review = JSON.parse(raw.toString())
  if (
    review.fingerprint !== artifact.packet_fingerprint ||
    sha(JSON.stringify(review.review_items)) !== artifact.review_items_sha256
  ) {
    throw new Error('Review packet fingerprint or item snapshot mismatch')
  }
  for (const decision of artifact.decisions) {
    const answer = review.answers[decision.check_id]
    if (
      !answer ||
      answer.status !== decision.status ||
      sha(answer.comment) !== decision.comment_sha256
    ) {
      throw new Error(`Review decision mismatch: ${decision.check_id}`)
    }
  }
}

function main() {
  const artifact = validatePhysicianReview(JSON.parse(read(REVIEW_PATH).toString()))
  const reviewArgument = process.argv.indexOf('--review')
  if (reviewArgument >= 0)
    verifyOriginalExport(readFileSync(process.argv[reviewArgument + 1]), artifact)
  const output = `${JSON.stringify(artifact.overlay, null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (read(REVIEW_OVERLAY_PATH).toString() !== output)
      throw new Error('Physician review overlay is stale')
  } else writeFileSync(path.join(ROOT, REVIEW_OVERLAY_PATH), output)
  process.stdout.write(
    `Validated ${artifact.decisions.length} decisions; 50 device reviews; 3 unresolved procedure reviews.\n`,
  )
}
if (require.main === module) main()
