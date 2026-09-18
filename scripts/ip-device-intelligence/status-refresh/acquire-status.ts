import { readFileSync } from 'node:fs'
import path from 'node:path'
import { exactOpenFdaSearch } from '../../ip-preference-cards/openfda/normalize'
import {
  acquireGroups,
  acquireSnapshots,
  CACHE_ROOT,
  identifiers,
  refreshProducts,
  type BatchResult,
} from './acquire'
import { companyNames, matchedUdi, objects, string } from './identity'

async function main() {
  const products = refreshProducts()
  const udi = JSON.parse(
    readFileSync(path.join(CACHE_ROOT, 'udi-batches.json'), 'utf8'),
  ) as BatchResult[]
  const byFirm = new Map<string, typeof products>()
  for (const p of products)
    byFirm.set(p.manufacturer ?? '', [...(byFirm.get(p.manufacturer ?? '') ?? []), p])
  for (const endpoint of ['registrationlisting', 'recall', 'enforcement']) {
    const field =
      endpoint === 'registrationlisting'
        ? 'registration.name'
        : endpoint === 'recall'
          ? 'recalling_firm'
          : 'recalling_firm'
    const firmGroups = [...byFirm.values()].map((rows) => {
      const firms = companyNames(rows[0])
        .map((name) => exactOpenFdaSearch(field, name))
        .join(' OR ')
      const codes = [
        ...new Set(
          rows.flatMap((p) =>
            matchedUdi(p, udi).flatMap(({ record }) =>
              objects(record.product_codes).map((c) => string(c.code)),
            ),
          ),
        ),
      ]
      return {
        ids: rows.map((p) => p.product_id),
        search:
          endpoint === 'registrationlisting' && codes.length
            ? `(${firms}) AND (${codes.map((c) => exactOpenFdaSearch('products.product_code', c)).join(' OR ')})`
            : firms,
      }
    })
    console.log(`Searching ${endpoint} manufacturer records (${firmGroups.length} groups)`)
    await acquireGroups(endpoint, firmGroups, `${endpoint}-firms.json`)
    const groups: { search: string; ids: string[] }[] = []
    let clauses: string[] = [],
      ids: string[] = []
    for (const p of products) {
      const deviceIds = [
        ...new Set([
          ...identifiers(p),
          ...(endpoint === 'registrationlisting'
            ? []
            : matchedUdi(p, udi).flatMap(({ record }) =>
                objects(record.identifiers).map((i) => string(i.id)),
              )),
        ]),
      ]
      const extra = deviceIds.flatMap((id) =>
        endpoint === 'registrationlisting'
          ? [exactOpenFdaSearch('proprietary_name', id)]
          : [exactOpenFdaSearch('code_info', id), exactOpenFdaSearch('product_description', id)],
      )
      if (ids.length && encodeURIComponent([...clauses, ...extra].join(' OR ')).length > 6500) {
        groups.push({ search: [...new Set(clauses)].join(' OR '), ids })
        clauses = []
        ids = []
      }
      clauses.push(...extra)
      ids.push(p.product_id)
    }
    if (clauses.length) groups.push({ search: [...new Set(clauses)].join(' OR '), ids })
    console.log(`Searching ${endpoint} identifiers (${groups.length} groups)`)
    await acquireGroups(endpoint, groups, `${endpoint}-identifiers.json`)
  }
  await acquireSnapshots()
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
