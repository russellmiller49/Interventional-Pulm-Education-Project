import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import catalogProductsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'

import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { D1_EXEMPLAR_PROCEDURE_CODES } from '@/features/device-intelligence/domain/exemplars'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  buildReadinessProjection,
  getCoverageLadderForProcedure,
  getProcedureWorkspace,
  getProcedureReadinessView,
} from '@/features/device-intelligence/server/procedures.server'
import { resolveDemoScenario } from '@/features/preference-cards/data/demo-context.server'
import { getScenarioDefinitions } from '@/features/preference-cards/data/demo-context.server'

/**
 * D2B procedure-workspace behavior. Hidden verified-source authored options become
 * identifiable; candidate/unknown options stay withheld; canonical selectability, eligibility,
 * release-pinned composition, coverage ladders, and readiness are untouched; and no automatic
 * default or recommendation mechanism is introduced.
 */

interface ProductRow {
  product_id: string
  verification_grade?: string | null
  visibility_state?: string | null
}
interface OptionRow {
  slot_id: string
  product_id: string
  selectable: boolean | null
  eligibility_status: string | null
}

const products = catalogProductsJson as unknown as ProductRow[]
const options = slotProductOptionsJson as unknown as OptionRow[]
const productById = new Map(products.map((product) => [product.product_id, product]))

const rawOptionsBySlot = (() => {
  const index = new Map<string, OptionRow[]>()
  for (const option of options) {
    const rows = index.get(option.slot_id)
    if (rows) rows.push(option)
    else index.set(option.slot_id, [option])
  }
  return index
})()

describe('D2B workspace — hidden verified-source options become identifiable', () => {
  it('identifies hidden verified-source authored options and still withholds candidate ones', () => {
    const atlas = getAtlasCatalogStore()
    let newlyIdentifiable = 0
    let stillWithheld = 0
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      for (const requirement of workspace.requirements) {
        for (const option of requirement.authoredOptions) {
          const product = productById.get(option.productId)!
          expect(product.verification_grade).toBe('verified_source')
          expect(atlas.productById.has(option.productId)).toBe(true)
          if (product.visibility_state !== 'prototype_visible') newlyIdentifiable += 1
        }
        const raw = requirement.sourceSlotId
          ? (rawOptionsBySlot.get(requirement.sourceSlotId) ?? [])
          : []
        for (const option of raw) {
          if (atlas.productById.has(option.product_id)) continue
          stillWithheld += 1
          const product = productById.get(option.product_id)!
          // Only candidate/unknown-grade options are withheld now.
          expect(['candidate', 'unknown']).toContain(product.verification_grade)
        }
      }
    }
    // The change is real, not vacuous, in both directions.
    expect(newlyIdentifiable).toBeGreaterThan(0)
    expect(stillWithheld).toBeGreaterThan(0)
  })

  it('reconciles withheld counts against the raw generated option rows', () => {
    const atlas = getAtlasCatalogStore()
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      for (const requirement of workspace.requirements) {
        const raw = requirement.sourceSlotId
          ? (rawOptionsBySlot.get(requirement.sourceSlotId) ?? [])
          : []
        const rawWithheld = raw.filter((option) => !atlas.productById.has(option.product_id))
        expect({
          procedure: code,
          requirement: requirement.id,
          exposed: requirement.authoredOptions.length,
          withheld: requirement.withheldAuthoredOptionCount,
          withheldSelectable: requirement.withheldSelectableOptionCount,
        }).toEqual({
          procedure: code,
          requirement: requirement.id,
          exposed: raw.length - rawWithheld.length,
          withheld: rawWithheld.length,
          withheldSelectable: rawWithheld.filter((option) => option.selectable === true).length,
        })
      }
    }
  })

  it('copies canonical selectability and eligibility verbatim', () => {
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      for (const requirement of workspace.requirements) {
        const raw = requirement.sourceSlotId
          ? (rawOptionsBySlot.get(requirement.sourceSlotId) ?? [])
          : []
        for (const option of requirement.authoredOptions) {
          const canonical = raw.find((row) => row.product_id === option.productId)!
          expect({
            productId: option.productId,
            selectable: option.selectable,
            eligibilityStatus: option.eligibilityStatus,
          }).toEqual({
            productId: option.productId,
            selectable: canonical.selectable === true,
            eligibilityStatus: canonical.eligibility_status,
          })
        }
      }
    }
  })

  it('attaches a status to every identified option without letting it change ordering', () => {
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      for (const requirement of workspace.requirements) {
        for (const option of requirement.authoredOptions) {
          expect(option.status).toBeDefined()
          expect(option.status.marketStatus).toBeDefined()
        }
        // The ordering rule is exactly "selectable first, then product name" — status is not
        // a term in it, so no market or safety label can promote or demote an option.
        const expectedOrder = [...requirement.authoredOptions].sort(
          (left, right) =>
            Number(right.selectable) - Number(left.selectable) ||
            left.productName.localeCompare(right.productName),
        )
        expect(requirement.authoredOptions.map((option) => option.productId)).toEqual(
          expectedOrder.map((option) => option.productId),
        )
      }
    }
  })
})

describe('D2B workspace — nothing governed moved', () => {
  it('leaves coverage ladders and readiness projections identical to the canonical inputs', () => {
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const ladder = getCoverageLadderForProcedure(code)
      const workspace = getProcedureWorkspace(code)!
      // The workspace reports the ladder it computed, unmodified.
      expect(workspace.ladder.summary).toEqual(ladder.summary)

      // Readiness is recomputed from the canonical resolver, and the D2B view agrees with a
      // projection built directly from `resolveDemoScenario` — i.e. no status input anywhere.
      const scenario = getScenarioDefinitions().find(
        (candidate) => candidate.sourceProcedureCode === code,
      )!
      const view = getProcedureReadinessView(code)!
      expect(view.projection).toEqual(
        buildReadinessProjection(code, resolveDemoScenario(scenario.id), ladder),
      )
    }
  })

  it('introduces no automatic default or recommendation mechanism', () => {
    // There is no such mechanism to change: the workspace never marks an option as chosen,
    // preferred, recommended, or default, and the readiness/ladder layers never read status.
    const featureDir = join(__dirname, '..')
    const readinessSources = [
      'domain/readiness.ts',
      'domain/coverage-ladder.ts',
      'domain/laser-pathway.ts',
    ].map((file) => readFileSync(join(featureDir, file), 'utf8'))
    for (const source of readinessSources) {
      expect(source).not.toContain('product-status')
      expect(source).not.toContain('getProductStatus')
    }
    // `getProductStatus` enters the workspace at exactly one site: the option link builder.
    const proceduresSource = readFileSync(join(featureDir, 'server/procedures.server.ts'), 'utf8')
    expect(proceduresSource.match(/getProductStatus\(/g)).toHaveLength(1)

    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const workspace = getProcedureWorkspace(code)!
      const serialized = JSON.stringify(workspace)
      for (const banned of [
        '"recommended"',
        '"isDefault"',
        '"defaultOption"',
        '"preferredOption"',
      ]) {
        expect({ code, banned, present: serialized.includes(banned) }).toEqual({
          code,
          banned,
          present: false,
        })
      }
      for (const requirement of workspace.requirements) {
        for (const option of requirement.authoredOptions) {
          expect(Object.keys(option).sort()).toEqual([
            'catalogNumber',
            'eligibilityStatus',
            'manufacturerDisplay',
            'productId',
            'productName',
            'selectable',
            'status',
          ])
        }
      }
    }
  })

  it('serializes no non-cohort product id into any exemplar workspace view model', () => {
    const nonCohortIds = products
      .filter((product) => !isAtlasCohortProduct(product))
      .map((product) => product.product_id)
    for (const code of D1_EXEMPLAR_PROCEDURE_CODES) {
      const serialized = JSON.stringify(getProcedureWorkspace(code))
      for (const productId of nonCohortIds) {
        if (serialized.includes(productId)) {
          throw new Error(`${code} workspace serializes non-cohort product id ${productId}`)
        }
      }
    }
  })
})
