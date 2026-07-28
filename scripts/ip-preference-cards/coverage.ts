import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CatalogRecord } from './catalog-utils'
import { catalogValueAsString } from './catalog-utils'
import { formatJson } from './format-json'

const DEFAULT_DIRECTORY = 'data/ip-preference-cards/generated'
const COVERAGE_PROCEDURES = [
  'EBUS_TBNA',
  'CHEST_TUBE',
  'THERAPEUTIC_BRONCH',
  'RIGID_BRONCH',
] as const

async function readJson<T>(directory: string, filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(directory, filename), 'utf8')) as T
}

export interface SlotCoverage {
  slot_id: string
  role_code: string
  requiredness: string
  total_product_options: number
  selectable_product_options: number
  required_with_zero_selectable: boolean
}

export interface ProcedureCoverage {
  procedure_code: string
  slots: number
  required: number
  slots_with_zero_selectable_products: number
  required_slots_with_zero_selectable_products: number
  required_mapping_percentage: number
  slot_coverage: SlotCoverage[]
}

export interface CoverageReport {
  format_version: 1
  procedures: ProcedureCoverage[]
  roles_with_zero_selectable_products: string[]
  role_counts: {
    total: number
    zero_selectable: number
  }
}

export async function buildCoverageReport(options?: {
  generatedDirectory?: string
}): Promise<CoverageReport> {
  const generatedDirectory = path.resolve(
    process.cwd(),
    options?.generatedDirectory ?? process.env.IP_CARDS_OUTPUT_DIR ?? DEFAULT_DIRECTORY,
  )
  const [slots, optionsRows, productRoles, products, roles] = await Promise.all([
    readJson<CatalogRecord[]>(generatedDirectory, 'procedure-slots.json'),
    readJson<CatalogRecord[]>(generatedDirectory, 'slot-product-options.json'),
    readJson<CatalogRecord[]>(generatedDirectory, 'product-roles.json'),
    readJson<CatalogRecord[]>(generatedDirectory, 'catalog-products.json'),
    readJson<CatalogRecord[]>(generatedDirectory, 'roles.json'),
  ])

  const optionsBySlot = new Map<string, CatalogRecord[]>()
  for (const option of optionsRows) {
    const slotId = catalogValueAsString(option, 'slot_id')
    if (!slotId) continue
    optionsBySlot.set(slotId, [...(optionsBySlot.get(slotId) ?? []), option])
  }

  const procedures = COVERAGE_PROCEDURES.map((procedureCode): ProcedureCoverage => {
    const procedureSlots = slots
      .filter((slot) => catalogValueAsString(slot, 'procedure_code') === procedureCode)
      .sort((left, right) => Number(left.display_order ?? 0) - Number(right.display_order ?? 0))
    const slotCoverage = procedureSlots.map((slot): SlotCoverage => {
      const slotId = catalogValueAsString(slot, 'slot_id') ?? ''
      const productOptions = optionsBySlot.get(slotId) ?? []
      const selectableCount = productOptions.filter((option) => option.selectable === true).length
      const requiredness = catalogValueAsString(slot, 'requiredness') ?? 'unknown'
      return {
        slot_id: slotId,
        role_code: catalogValueAsString(slot, 'role_code') ?? '',
        requiredness,
        total_product_options: productOptions.length,
        selectable_product_options: selectableCount,
        required_with_zero_selectable: requiredness === 'required' && selectableCount === 0,
      }
    })
    const requiredSlots = slotCoverage.filter((slot) => slot.requiredness === 'required')
    const resolvedRequired = requiredSlots.filter(
      (slot) => slot.selectable_product_options > 0,
    ).length
    return {
      procedure_code: procedureCode,
      slots: slotCoverage.length,
      required: requiredSlots.length,
      slots_with_zero_selectable_products: slotCoverage.filter(
        (slot) => slot.selectable_product_options === 0,
      ).length,
      required_slots_with_zero_selectable_products: requiredSlots.filter(
        (slot) => slot.selectable_product_options === 0,
      ).length,
      required_mapping_percentage:
        requiredSlots.length === 0
          ? 100
          : Math.round((resolvedRequired / requiredSlots.length) * 1000) / 10,
      slot_coverage: slotCoverage,
    }
  })

  const visibilityByProductId = new Map(
    products.map((product) => [
      catalogValueAsString(product, 'product_id'),
      product.visibility_state,
    ]),
  )
  const selectableRoles = new Set(
    productRoles.flatMap((productRole) => {
      const productId = catalogValueAsString(productRole, 'product_id')
      const roleCode = catalogValueAsString(productRole, 'role_code')
      return productId && roleCode && visibilityByProductId.get(productId) === 'prototype_visible'
        ? [roleCode]
        : []
    }),
  )
  const roleCodes = roles.flatMap((role) => {
    const roleCode = catalogValueAsString(role, 'role_code')
    return roleCode ? [roleCode] : []
  })
  const rolesWithZeroSelectableProducts = roleCodes
    .filter((roleCode) => !selectableRoles.has(roleCode))
    .sort()

  return {
    format_version: 1,
    procedures,
    roles_with_zero_selectable_products: rolesWithZeroSelectableProducts,
    role_counts: {
      total: roleCodes.length,
      zero_selectable: rolesWithZeroSelectableProducts.length,
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
            procedure.procedure_code,
            `${procedure.slots} slots`,
            `${procedure.required} required`,
            `${procedure.slots_with_zero_selectable_products} slots with zero selectable`,
            `${procedure.required_slots_with_zero_selectable_products} required unresolved`,
          ].join(' · '),
        )
      }
      console.log(
        `${report.role_counts.zero_selectable}/${report.role_counts.total} roles have zero selectable products.`,
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
