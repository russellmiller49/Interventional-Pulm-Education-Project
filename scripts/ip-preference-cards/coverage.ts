import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  calculateProcedureCoverage,
  type CoverageProductRoleRow,
  type CoverageProductRow,
  type CoverageProcedureRow,
  type CoverageSlotOptionRow,
  type CoverageSlotRow,
  type ProcedureCoverageMetrics,
} from './coverage-metrics'
import { formatJson } from './format-json'

const DEFAULT_DIRECTORY = 'data/ip-preference-cards/generated'

interface RoleRow {
  role_code: string
}

export interface SlotCoverage {
  slotId: string
  roleCode: string
  requiredness: string
  allowCustom: boolean
  catalogProductCount: number
  curatedDefaultOptionCount: number
  hasCatalogProducts: boolean
  hasCuratedDefault: boolean
}

export interface ProcedureCoverage extends ProcedureCoverageMetrics {
  slotCount: number
  slotCoverage: SlotCoverage[]
}

export interface CoverageReport {
  formatVersion: 2
  semantics: {
    catalogCoverage: 'required_slots_with_existing_product_role'
    curatedDefaultCoverage: 'required_slots_with_selectable_canonical_option'
  }
  procedures: ProcedureCoverage[]
  rolesWithoutCatalogProducts: string[]
  roleCounts: {
    total: number
    withoutCatalogProducts: number
  }
}

async function readJson<T>(directory: string, filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(directory, filename), 'utf8')) as T
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export async function buildCoverageReport(options?: {
  generatedDirectory?: string
}): Promise<CoverageReport> {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_DIRECTORY,
  )
  const [procedures, slots, optionRows, productRoles, products, roles] = await Promise.all([
    readJson<CoverageProcedureRow[]>(generatedDirectory, 'procedures.json'),
    readJson<CoverageSlotRow[]>(generatedDirectory, 'procedure-slots.json'),
    readJson<CoverageSlotOptionRow[]>(generatedDirectory, 'slot-product-options.json'),
    readJson<CoverageProductRoleRow[]>(generatedDirectory, 'product-roles.json'),
    readJson<CoverageProductRow[]>(generatedDirectory, 'catalog-products.json'),
    readJson<RoleRow[]>(generatedDirectory, 'roles.json'),
  ])

  const metrics = calculateProcedureCoverage({
    products,
    productRoles,
    procedures,
    slots,
    slotProductOptions: optionRows,
  })
  const productIds = new Set(products.map((product) => product.product_id))
  const catalogProductIdsByRole = new Map<string, Set<string>>()
  for (const relationship of productRoles) {
    if (!productIds.has(relationship.product_id)) continue
    const existing = catalogProductIdsByRole.get(relationship.role_code) ?? new Set()
    existing.add(relationship.product_id)
    catalogProductIdsByRole.set(relationship.role_code, existing)
  }
  const selectableOptionsBySlot = new Map<string, number>()
  for (const option of optionRows) {
    if (option.selectable !== true) continue
    selectableOptionsBySlot.set(
      option.slot_id,
      (selectableOptionsBySlot.get(option.slot_id) ?? 0) + 1,
    )
  }

  const proceduresWithDetails = metrics.map((procedure): ProcedureCoverage => {
    const procedureSlots = slots
      .filter((slot) => slot.procedure_code === procedure.procedureCode)
      .sort(
        (left, right) =>
          (left.display_order ?? 0) - (right.display_order ?? 0) ||
          compareText(left.slot_id, right.slot_id),
      )
    return {
      ...procedure,
      slotCount: procedureSlots.length,
      slotCoverage: procedureSlots.map((slot) => {
        const catalogProductCount = catalogProductIdsByRole.get(slot.role_code)?.size ?? 0
        const curatedDefaultOptionCount = selectableOptionsBySlot.get(slot.slot_id) ?? 0
        return {
          slotId: slot.slot_id,
          roleCode: slot.role_code,
          requiredness: slot.requiredness,
          allowCustom: slot.allow_custom === true,
          catalogProductCount,
          curatedDefaultOptionCount,
          hasCatalogProducts: catalogProductCount > 0,
          hasCuratedDefault: curatedDefaultOptionCount > 0,
        }
      }),
    }
  })

  const roleCodes = roles.map((role) => role.role_code)
  const rolesWithoutCatalogProducts = roleCodes
    .filter((roleCode) => !catalogProductIdsByRole.has(roleCode))
    .sort(compareText)

  return {
    formatVersion: 2,
    semantics: {
      catalogCoverage: 'required_slots_with_existing_product_role',
      curatedDefaultCoverage: 'required_slots_with_selectable_canonical_option',
    },
    procedures: proceduresWithDetails,
    rolesWithoutCatalogProducts,
    roleCounts: {
      total: roleCodes.length,
      withoutCatalogProducts: rolesWithoutCatalogProducts.length,
    },
  }
}

export async function writeCoverageReport(options?: { generatedDirectory?: string }) {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_DIRECTORY,
  )
  const report = await buildCoverageReport({ generatedDirectory })
  await mkdir(generatedDirectory, { recursive: true })
  await writeFile(path.join(generatedDirectory, 'coverage-report.json'), await formatJson(report))
  return report
}

if (process.argv[1] && /coverage\.(?:ts|js)$/.test(process.argv[1])) {
  writeCoverageReport()
    .then((report) => {
      for (const procedure of report.procedures) {
        console.log(
          [
            procedure.procedureCode,
            `${procedure.requiredCatalogCoverageCount}/${procedure.requiredSlotCount} required catalog alternatives`,
            `${procedure.requiredDefaultOptionCoverageCount}/${procedure.requiredSlotCount} required curated defaults`,
            `${procedure.requiredCustomAllowedCount} required lines allow custom items`,
          ].join(' · '),
        )
      }
      console.log(
        `${report.roleCounts.withoutCatalogProducts}/${report.roleCounts.total} roles have no catalog products.`,
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
