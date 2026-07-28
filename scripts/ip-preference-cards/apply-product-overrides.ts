import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CatalogRecord } from './catalog-utils'

/**
 * Corrections applied to workbook product rows at import time.
 *
 * The workbook stays the source of truth, but some of its rows describe the same product
 * line inconsistently — a vendor name recorded two different ways, or two generations of one
 * platform filed under different brand families so they never group together in the explorer.
 * Editing the binary workbook would fix the symptom without leaving a record of why, and the
 * next workbook refresh would silently drop the fix.
 *
 * Each override therefore carries its own reason, matches exactly one row, and fails loudly
 * if the workbook changes underneath it: a match that hits zero rows, several rows, or a row
 * whose current value is not what the override expected is an error, not a silent no-op.
 */

const SEED_FILE = 'data/ip-preference-cards/seed/product-overrides.json'

export interface ProductOverride {
  /** Column/value pairs identifying exactly one product row. */
  match: Record<string, string>
  /** Why the workbook value is wrong. Recorded in the import report. */
  reason: string
  /** Column/value pairs to write. Numbers are allowed for dimensional columns. */
  set: Record<string, string | number | null>
  /**
   * Optional guard: the values these columns must currently hold. A mismatch means the
   * workbook already changed and the override needs review rather than blind application.
   */
  expect?: Record<string, string | number | null>
}

export interface ProductOverridesFile {
  format_version: string
  notes: string
  overrides: ProductOverride[]
}

export interface OverridesReport {
  applied: boolean
  products_changed: number
  fields_changed: number
  reasons: string[]
  errors: string[]
}

export async function readProductOverrides(
  filePath = SEED_FILE,
): Promise<ProductOverridesFile | null> {
  try {
    return JSON.parse(await readFile(path.resolve(process.cwd(), filePath), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function describe(match: Record<string, string>): string {
  return Object.entries(match)
    .map(([column, value]) => `${column}=${value}`)
    .join(', ')
}

/** Applies overrides to product records in place and returns a report. */
export function applyProductOverrides(
  products: CatalogRecord[],
  overrides: ProductOverridesFile | null,
): OverridesReport {
  const report: OverridesReport = {
    applied: false,
    products_changed: 0,
    fields_changed: 0,
    reasons: [],
    errors: [],
  }
  if (!overrides) return report

  for (const override of overrides.overrides) {
    const matched = products.filter((product) =>
      Object.entries(override.match).every(([column, value]) => product[column] === value),
    )
    if (matched.length !== 1) {
      report.errors.push(
        `Override for ${describe(override.match)} matched ${matched.length} products; expected exactly 1.`,
      )
      continue
    }

    const product = matched[0]
    let mismatched = false
    for (const [column, expected] of Object.entries(override.expect ?? {})) {
      if (product[column] !== expected) {
        report.errors.push(
          `Override for ${describe(override.match)} expected ${column}=${JSON.stringify(expected)} but found ${JSON.stringify(product[column])}; the workbook changed and this override needs review.`,
        )
        mismatched = true
      }
    }
    if (mismatched) continue

    let changed = 0
    for (const [column, value] of Object.entries(override.set)) {
      if (product[column] === value) continue
      product[column] = value
      changed += 1
    }
    if (changed > 0) {
      report.products_changed += 1
      report.fields_changed += changed
      report.reasons.push(`${describe(override.match)}: ${override.reason}`)
    }
  }

  report.applied = report.errors.length === 0
  return report
}
