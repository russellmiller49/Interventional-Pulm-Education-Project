import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isAtlasCohortProduct } from '../../src/features/device-intelligence/domain/atlas-cohort'
import { D1_EXEMPLAR_PROCEDURE_CODES } from '../../src/features/device-intelligence/domain/exemplars'
import { profileOverlayArtifactSchema } from '../../src/features/device-intelligence/domain/profile-overlay-schema'
import { safetyEvidenceArtifactSchema } from '../../src/features/device-intelligence/domain/safety-notice-schema'
import { statusOverlayArtifactSchema } from '../../src/features/device-intelligence/domain/status-overlay-schema'
import type {
  CatalogProductRecord,
  ProcedureRecord,
  ProcedureSlotRecord,
  ProductRoleRecord,
  ProductSourceRecord,
  SlotProductOptionRecord,
  SourceRecord,
} from '../../src/features/preference-cards/server/catalog-store'

const ROOT = path.resolve(__dirname, '../..')
export const DAILY_REVIEW_PATH = 'docs/ip-device-intelligence/daily-reference-review/batch.json'
const generated = 'data/ip-preference-cards/generated/'
const intelligence = 'data/ip-device-intelligence/generated/'
const INPUTS = [
  `${generated}catalog-products.json`,
  `${generated}procedures.json`,
  `${generated}procedure-slots.json`,
  `${generated}slot-product-options.json`,
  `${generated}product-roles.json`,
  `${generated}sources.json`,
  `${generated}product-sources.json`,
  `${intelligence}product-status-overlay.json`,
  `${intelligence}product-safety-evidence.json`,
  `${intelligence}product-profile-overlay.json`,
  'data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json',
] as const
const hash = (bytes: string) => createHash('sha256').update(bytes).digest('hex')

export function buildDailyReferenceReview(root = ROOT) {
  const files = new Map(INPUTS.map((file) => [file, readFileSync(path.join(root, file), 'utf8')]))
  const read = <T>(file: (typeof INPUTS)[number]): T => JSON.parse(files.get(file)!) as T
  const products = read<CatalogProductRecord[]>(`${generated}catalog-products.json`).filter(
    isAtlasCohortProduct,
  )
  const slots = read<ProcedureSlotRecord[]>(`${generated}procedure-slots.json`)
  const procedures = read<ProcedureRecord[]>(`${generated}procedures.json`)
  const options = read<SlotProductOptionRecord[]>(`${generated}slot-product-options.json`)
  const roles = read<ProductRoleRecord[]>(`${generated}product-roles.json`)
  const sources = new Map(
    read<SourceRecord[]>(`${generated}sources.json`).map((source) => [source.source_id, source]),
  )
  const productSources = read<ProductSourceRecord[]>(`${generated}product-sources.json`)
  const profiles = new Map(
    profileOverlayArtifactSchema
      .parse(read(`${intelligence}product-profile-overlay.json`))
      .rows.map((row) => [row.product_id, row]),
  )
  const statuses = new Map(
    statusOverlayArtifactSchema
      .parse(read(`${intelligence}product-status-overlay.json`))
      .rows.map((row) => [row.product_id, row]),
  )
  const safety = new Map(
    safetyEvidenceArtifactSchema
      .parse(read(`${intelligence}product-safety-evidence.json`))
      .rows.map((row) => [row.product_id, row]),
  )
  const exemplarSlots = slots.filter((slot) =>
    (D1_EXEMPLAR_PROCEDURE_CODES as readonly string[]).includes(slot.procedure_code),
  )
  const exemplarSlotIds = new Set(exemplarSlots.map((slot) => slot.slot_id))
  const exemplarRoles = new Set(exemplarSlots.map((slot) => slot.role_code))
  const rows = products
    .map((product) => {
      const authored = options.filter(
        (option) => option.product_id === product.product_id && exemplarSlotIds.has(option.slot_id),
      )
      const related = roles.filter(
        (role) => role.product_id === product.product_id && exemplarRoles.has(role.role_code),
      )
      const status = statuses.get(product.product_id)
      const profile = profiles.get(product.product_id)
      const active =
        safety
          .get(product.product_id)
          ?.notices.some((notice) => notice.recorded_state === 'active') ?? false
      const priority = active ? 0 : authored.length ? 1 : related.length ? 2 : 3
      const catalog = product as CatalogProductRecord & {
        brand_family?: string
        manufacturer?: string
      }
      return {
        product_id: product.product_id,
        manufacturer: catalog.manufacturer ?? product.manufacturer_id,
        product_name: product.product_name,
        catalog_number: product.catalog_number,
        size_display: product.size_display,
        gtin: product.gtin,
        family_group: `${catalog.manufacturer ?? product.manufacturer_id} · ${catalog.brand_family || product.subcategory || product.product_name}`,
        priority,
        priority_reason: active
          ? 'recorded_active_safety_notice'
          : authored.length
            ? 'authored_exemplar_option'
            : 'exemplar_role_discovery',
        exemplar_procedures: [
          ...new Set(
            authored.flatMap((option) =>
              exemplarSlots
                .filter((slot) => slot.slot_id === option.slot_id)
                .map((slot) => slot.procedure_code),
            ),
          ),
        ].sort(),
        reviewed_description_as_of: profile?.as_of_date ?? null,
        existing_reviewed_summary: profile?.summary_claims[0]?.text ?? null,
        market_safety_assessment_as_of: status?.research_snapshot_date ?? null,
        safety_notices:
          safety.get(product.product_id)?.notices.map((notice) => ({
            recall_number: notice.recall_number,
            recorded_state: notice.recorded_state,
            url: notice.official_record_url,
          })) ?? [],
        catalog_sources: productSources
          .filter((link) => link.product_id === product.product_id)
          .map((link) => {
            const source = sources.get(link.source_id)
            return {
              source_id: link.source_id,
              title: source?.title ?? link.source_id,
              locator: link.source_location,
              revision_date: source?.revision_date ?? null,
              as_of_date: source?.as_of_date ?? null,
            }
          }),
        discovery_query: `${catalog.manufacturer ?? ''} "${product.catalog_number ?? product.product_name}" manufacturer instructions for use specifications`,
        review_status: 'pending_clinical_owner_review' as const,
        required_review: [
          'exact_model_and_package_identity',
          'current_manufacturer_labeling',
          'description_claims_and_locators',
          'category_specific_specifications',
          'FDA_and_manufacturer_safety_scope',
          'model_specific_dependencies',
        ],
      }
    })
    .filter((row) => row.priority < 3)
  // Safety entries all lead. Remaining slots rotate through families before taking another
  // variant, so a large manufacturer's SKU block cannot consume the whole pilot.
  const activeRows = rows
    .filter((row) => row.priority === 0)
    .sort((a, b) => a.product_id.localeCompare(b.product_id))
  const pending = rows
    .filter((row) => row.priority > 0 && !row.reviewed_description_as_of)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.family_group.localeCompare(b.family_group) ||
        a.product_id.localeCompare(b.product_id),
    )
  const chosen = [...activeRows]
  const familyCounts = new Map<string, number>()
  while (chosen.length < 50 && pending.length > 0) {
    pending.sort(
      (a, b) =>
        a.priority - b.priority ||
        (familyCounts.get(a.family_group) ?? 0) - (familyCounts.get(b.family_group) ?? 0) ||
        a.family_group.localeCompare(b.family_group) ||
        a.product_id.localeCompare(b.product_id),
    )
    const row = pending.shift()!
    chosen.push(row)
    familyCounts.set(row.family_group, (familyCounts.get(row.family_group) ?? 0) + 1)
  }
  if (chosen.length !== 50) throw new Error('Review batch must contain 50 cohort products')
  return {
    format_version: 1,
    purpose: 'editorial_review_only_no_runtime_publication',
    selection_policy:
      'Recorded active notices first; then authored exemplar options and mapped roles, rotating families. This is a proposed pilot, not measured usage or device preference.',
    input_sha256: Object.fromEntries([...files].map(([file, bytes]) => [file, hash(bytes)])),
    products: chosen,
    procedures: D1_EXEMPLAR_PROCEDURE_CODES.map((code) => {
      const procedure = procedures.find((item) => item.procedure_code === code)!
      const requirements = exemplarSlots.filter((slot) => slot.procedure_code === code)
      const bySlot = requirements.map((slot) => ({
        slot,
        options: options.filter((option) => option.slot_id === slot.slot_id),
      }))
      return {
        code,
        name: procedure.procedure_name,
        status: procedure.status,
        template_version: procedure.template_version,
        scope: 'base_authored_template_only; composed scenario findings are shown in the worksheet',
        required_slots_without_selectable_option: bySlot
          .filter(
            ({ slot, options: slotOptions }) =>
              slot.requiredness === 'required' && !slotOptions.some((option) => option.selectable),
          )
          .map(({ slot }) => ({ slot_id: slot.slot_id, label: slot.slot_label })),
        review_status: 'pending_clinical_and_operational_review',
      }
    }),
  }
}

export function writeDailyReferenceReview(check = false, root = ROOT) {
  const batch = buildDailyReferenceReview(root)
  const output = `${JSON.stringify(batch, null, 2)}\n`
  const destination = path.join(root, DAILY_REVIEW_PATH)
  if (check) {
    if (readFileSync(destination, 'utf8') !== output)
      throw new Error('Daily-reference review batch is stale')
  } else {
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, output)
  }
  return batch
}

if (require.main === module) {
  const batch = writeDailyReferenceReview(process.argv.includes('--check'))
  console.log(
    `Daily-reference batch: ${batch.products.length} products; ${batch.products.filter((row) => row.priority === 0).length} recorded active-notice products; ${batch.procedures.length} draft procedures.`,
  )
}
