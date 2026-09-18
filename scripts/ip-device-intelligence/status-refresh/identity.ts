import type { CatalogProductRecord } from '../../../src/features/preference-cards/server/catalog-store'
import { getOpenFdaManufacturerAliasGroup } from '../../ip-preference-cards/openfda/manufacturer-aliases'
import { normalizeManufacturerName } from '../../ip-preference-cards/openfda/normalize'
import { identifiers, type BatchResult, type Receipt } from './acquire'

export type Product = CatalogProductRecord
export type RecordFields = Record<string, unknown>
export const string = (value: unknown): string => (typeof value === 'string' ? value : '')
export const objects = (value: unknown): RecordFields[] =>
  Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : []
export const exact = (value: unknown): string =>
  string(value).normalize('NFKC').trim().toUpperCase()

// Bounded research identities, not changes to canonical company ownership or procurement.
// Sources establish the company relationship only; they do not prove current distribution.
export const additionalIdentities = [
  {
    manufacturer: 'Cook Medical',
    names: ['Cook Incorporated', 'Cook Ireland Ltd.'],
    url: 'https://www.cookmedical.com/urology/urology-contracting/',
  },
  {
    manufacturer: 'Medtronic',
    names: ['Covidien LP'],
    url: 'https://investorrelations.medtronic.com/image/Medtronic%20plc%20FY16%2010-K%20and%20Shareholder%20Letter.pdf',
  },
  {
    manufacturer: 'Medtronic',
    names: ['Medtronic Xomed, Inc.'],
    url: 'https://investorrelations.medtronic.com/image/FY20%20Irish%20Report%20-%20FINAL.pdf',
  },
  {
    manufacturer: 'EFER',
    names: ['EFER Endoscopy'],
    url: 'https://www.efer.com/qui-sommes-nous/?lang=fr',
  },
  { manufacturer: 'Ambu', names: ['Ambu A/S'], url: 'https://www.ambu.com/nordics' },
  {
    manufacturer: 'Richard Wolf',
    names: ['Richard Wolf Medical Instruments Corporation'],
    url: 'https://www.richard-wolf.com/en-us/company',
  },
  {
    manufacturer: 'Olympus',
    names: [
      'Olympus America Inc.',
      'Olympus Corporation of the Americas',
      'Olympus Respiratory America',
      'Olympus Surgical Technologies America',
    ],
    url: 'https://www.olympusamerica.com/contact-us',
  },
  {
    manufacturer: 'Olympus',
    names: ['Aizu Olympus Co., Ltd.', 'Aomori Olympus Co., Ltd.'],
    url: 'https://www.olympus-global.com/company/base/grouplist/asia.html',
  },
  {
    manufacturer: 'Teleflex',
    names: ['Teleflex Medical', 'Arrow International LLC'],
    url: 'https://www.teleflex.com/usa/en/product-areas/vascular-access/EIF-000538-FSN-US.pdf',
  },
  {
    manufacturer: 'ICU Medical',
    names: ['Smiths Medical ASD Inc.', 'Smiths Medical'],
    url: 'https://ir.icumed.com/node/18456',
  },
] as const

export function companyNames(p: Product): string[] {
  return [
    ...new Set([
      ...getOpenFdaManufacturerAliasGroup(p.manufacturer_id ?? '', p.manufacturer).aliases,
      ...additionalIdentities
        .filter((a) => a.manufacturer === p.manufacturer)
        .flatMap((a) => [...a.names]),
    ]),
  ]
}
export function companyMatches(p: Product, value: unknown): boolean {
  const candidate = normalizeManufacturerName(value)
  return Boolean(
    candidate && companyNames(p).some((name) => normalizeManufacturerName(name) === candidate),
  )
}

/** Punctuation is significant. A catalog number shared by two firms is not a device match. */
export function udiIdentityMatches(p: Product, record: RecordFields): boolean {
  if (!companyMatches(p, record.company_name)) return false
  const ids = new Set(identifiers(p).map(exact))
  return [
    record.catalog_number,
    record.version_or_model_number,
    ...objects(record.identifiers).map((i) => i.id),
  ].some((id) => exact(id) && ids.has(exact(id)))
}

export interface SourcedRecord {
  record: RecordFields
  page: Receipt
  batchKey: string
}
export function recordsFor(p: Product, batches: BatchResult[]): SourcedRecord[] {
  return batches
    .filter((b) => b.product_ids.includes(p.product_id))
    .flatMap((b) =>
      b.pages.flatMap((page) => page.records.map((record) => ({ record, page, batchKey: b.key }))),
    )
}
export function matchedUdi(p: Product, batches: BatchResult[]): SourcedRecord[] {
  const unique = new Map<string, SourcedRecord>()
  for (const row of recordsFor(p, batches))
    if (udiIdentityMatches(p, row.record))
      unique.set(string(row.record.public_device_record_key), row)
  return [...unique.values()]
}

/** Literal token boundaries preserve dash/dot suffixes and prevent numeric substring matches.
 * FDA code_info uses slashes to separate REF/UDI/lot columns; a slash is a field boundary. */
const patterns = new Map<string, RegExp>()
export function identifierInText(text: string, id: string, normalized = false): boolean {
  const key = exact(id)
  if (!key) return false
  let pattern = patterns.get(key)
  if (!pattern) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    pattern = new RegExp(`(^|[^A-Z0-9._+-])${escaped}(?=$|[^A-Z0-9._+-])`, 'u')
    patterns.set(key, pattern)
  }
  return pattern.test(normalized ? text : exact(text))
}
