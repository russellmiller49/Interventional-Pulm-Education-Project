import 'server-only'

import manufacturersJson from '../../../../data/ip-preference-cards/generated/manufacturers.json'
import procedureSlotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import proceduresJson from '../../../../data/ip-preference-cards/generated/procedures.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import productSourcesJson from '../../../../data/ip-preference-cards/generated/product-sources.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import rolesJson from '../../../../data/ip-preference-cards/generated/roles.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import sourcesJson from '../../../../data/ip-preference-cards/generated/sources.json'
import externalReviewCorrectionsJson from '../../../../data/ip-preference-cards/reviewed/external-review-corrections.json'

import {
  buildCatalogStore,
  type CatalogProductRecord,
  type CatalogStore,
  type ManufacturerRecord,
  type ProcedureRecord,
  type ProcedureSlotRecord,
  type ProductGovernanceRecord,
  type ProductRoleRecord,
  type ProductSourceRecord,
  type RoleRecord,
  type SlotProductOptionRecord,
  type SourceRecord,
} from '@/features/preference-cards/server/catalog-store'
import { isAtlasCohortProduct } from '@/features/device-intelligence/domain/atlas-cohort'
import { assertExclusionsResolve } from '@/features/device-intelligence/domain/atlas-visibility-exclusions'

/**
 * The D2B atlas view of the governed catalog: the SAME statically imported generated JSON the
 * preference-card store reads (module imports are shared singletons — nothing is copied),
 * indexed through the SAME `buildCatalogStore` implementation, restricted to the owner's
 * inclusion-first cohort predicate: `verification_grade = verified_source`, minus explicit
 * reviewed owner exclusions (D2B, 2026-08-15, superseding the D1 predicate recorded under
 * D-07 as modified).
 *
 * `visibility_state` is NO LONGER a gate here. It remains governed canonical data driving the
 * preserved preference-card dropdown and admin surfaces — which this file does not touch —
 * but a hidden verified-source product is now inside the atlas, carrying a market-status and
 * safety overlay (`product-status.server.ts`) instead of being absent.
 *
 * Filtering happens at store construction, not per query, so *every* downstream path — search,
 * pagination, facet counts, role listings, related products, direct product-id lookups —
 * admits the same cohort by construction, and excludes candidate-grade and unknown-grade
 * products by construction. `buildCatalogStore` already drops role links, slot options, and
 * related indexes for products absent from its input, so there is no separate join to
 * remember to filter.
 *
 * This is deliberately not a second query implementation: the query layer stays
 * `catalog.ts`'s exported functions, every one of which takes a store parameter for exactly
 * this purpose. The full store (`getCatalogStore()`) remains what the preserved
 * preference-card and admin surfaces read; nothing about it changes.
 */

let cachedAtlasStore: CatalogStore | null = null

export function getAtlasCatalogStore(): CatalogStore {
  if (!cachedAtlasStore) {
    const allProducts = productsJson as unknown as CatalogProductRecord[]
    // An owner exclusion that names a product id the catalog does not contain is an
    // unreviewable claim, not a harmless no-op — fail loudly here, where the catalog is
    // already loaded.
    assertExclusionsResolve(new Set(allProducts.map((product) => product.product_id)))
    cachedAtlasStore = buildCatalogStore({
      products: allProducts.filter(isAtlasCohortProduct),
      productGovernance: (
        externalReviewCorrectionsJson as unknown as {
          productGovernance: ProductGovernanceRecord[]
        }
      ).productGovernance,
      roles: rolesJson as unknown as RoleRecord[],
      productRoles: productRolesJson as unknown as ProductRoleRecord[],
      procedures: proceduresJson as unknown as ProcedureRecord[],
      procedureSlots: procedureSlotsJson as unknown as ProcedureSlotRecord[],
      slotProductOptions: slotProductOptionsJson as unknown as SlotProductOptionRecord[],
      sources: sourcesJson as unknown as SourceRecord[],
      productSources: productSourcesJson as unknown as ProductSourceRecord[],
      manufacturers: manufacturersJson as unknown as ManufacturerRecord[],
    })
  }
  return cachedAtlasStore
}
