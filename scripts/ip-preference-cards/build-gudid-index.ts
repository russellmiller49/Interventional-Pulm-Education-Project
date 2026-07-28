import { createReadStream, existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'

/**
 * Distils the AccessGUDID full delimited release into a small, committed index of the
 * manufacturers this catalog covers.
 *
 * The release is ~5.6 GB and is not in the repo (see docs/ip-preference-cards/data-import.md
 * for where to download it). This script streams it once and writes a subset keyed by
 * normalized catalog number so product entries can be confirmed against FDA-published
 * device records: real DI/GTIN, current distribution status, sterility, and single-use.
 *
 *   npx tsx scripts/ip-preference-cards/build-gudid-index.ts <releaseDirectory>
 */

const DEFAULT_RELEASE_DIRECTORY =
  'Preference_card_module/AccessGUDID_Delimited_Full_Release_20260723'
const OUTPUT_DIRECTORY = 'data/ip-preference-cards/generated'

/**
 * Companies whose whole GUDID listing is worth keeping because their catalogue is
 * thoracic/airway-specific. Everything else is kept only when its catalog number matches a
 * product we already list — otherwise a broad-line supplier such as Cardinal Health drags in
 * hundreds of thousands of gloves and gowns.
 */
const DISCOVERY_COMPANY_KEYS = new Set([
  'Atrium Medical (Getinge)',
  'Atos Medical',
  'Auris Health (Johnson & Johnson)',
  'FUJIFILM',
  'ERBE',
  'Getinge',
  'Medela',
  'Noah Medical',
  'Novatech',
  // Bronchoscopes are the core of this catalog and Olympus is its largest scope vendor;
  // catalog-number-only matching kept just 49 of its 2,816 records and no BF-* scope at all.
  'Olympus',
  'Pulmonx',
  'Redax',
  'Rocket Medical',
  'TRACOE',
  'Verathon',
])

/**
 * Brands worth keeping in full even when their labeler is a broad-line supplier whose whole
 * listing would be far too large to index. Matched against GUDID `brandName`.
 */
const DISCOVERY_BRAND_PATTERNS: { key: string; pattern: RegExp }[] = [
  // Teleflex lists ~29,000 devices; only the Pleur-evac chest drainage line is relevant.
  { key: 'Teleflex', pattern: /^pleur.?evac$/i },
  // Portex is an ICU Medical brand, and ICU Medical is not otherwise a catalog manufacturer,
  // so the brand carries its own key.
  { key: 'Portex (ICU Medical)', pattern: /^portex$/i },
]

/**
 * Brands kept only for an explicit list of catalog numbers.
 *
 * Bivona alone lists ~53,000 devices, mostly paediatric and custom configurations, so
 * keeping the whole brand is not an option — but the tubes transcribed from the Bivona
 * catalogue still deserve the same in-commercial-distribution check every other addition
 * gets. The allowed keys come from the transcribed product codes, so this stays in step with
 * the seed file rather than being a hand-maintained list.
 */
const TARGETED_BRAND_PATTERNS: { key: string; pattern: RegExp; codesFrom: string }[] = [
  {
    key: 'Bivona (ICU Medical)',
    pattern: /^bivona$/i,
    codesFrom: 'data/ip-preference-cards/seed/bivona-catalog.json',
  },
]

interface TargetedBrand {
  key: string
  pattern: RegExp
  allowedCatalogKeys: Set<string>
}

function resolveBrandKey(brandName: string): string | null {
  for (const { key, pattern } of DISCOVERY_BRAND_PATTERNS) {
    if (pattern.test(brandName.trim())) return key
  }
  return null
}

/** The targeted brand this name belongs to, if any. */
function resolveTargetedBrand(brandName: string, brands: TargetedBrand[]): TargetedBrand | null {
  const trimmed = brandName.trim()
  return brands.find((brand) => brand.pattern.test(trimmed)) ?? null
}

async function loadTargetedBrands(): Promise<TargetedBrand[]> {
  const brands: TargetedBrand[] = []
  for (const entry of TARGETED_BRAND_PATTERNS) {
    const parsed = JSON.parse(await readFile(entry.codesFrom, 'utf8')) as {
      tubes?: { productCode?: string }[]
    }
    const allowedCatalogKeys = new Set<string>()
    for (const tube of parsed.tubes ?? []) {
      if (!tube.productCode) continue
      const key = normalizeCatalogKey(tube.productCode)
      if (key.length >= 3) allowedCatalogKeys.add(key)
    }
    brands.push({ key: entry.key, pattern: entry.pattern, allowedCatalogKeys })
  }
  return brands
}

/**
 * Company-name patterns for manufacturers in the catalog plus the thoracic-drainage
 * vendors being added. Matched case-insensitively against GUDID `companyName`.
 */
const COMPANY_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: 'Ambu', pattern: /^ambu\b/i },
  { key: 'Atos Medical', pattern: /^atos medical/i },
  { key: 'Atrium Medical (Getinge)', pattern: /^atrium medical/i },
  // Robotic bronchoscopy platforms. Both are small specialist labelers, so their whole
  // listing is worth keeping — Ion (Intuitive Surgical) is already matched below.
  { key: 'Auris Health (Johnson & Johnson)', pattern: /^auris health/i },
  { key: 'Noah Medical', pattern: /^noah medical/i },
  { key: 'BD', pattern: /^becton,? dickinson/i },
  { key: 'Boston Scientific', pattern: /^boston scientific/i },
  { key: 'Butterfly Network', pattern: /^butterfly network/i },
  { key: 'Cardinal Health', pattern: /^cardinal health/i },
  { key: 'Cook Medical', pattern: /^cook (medical|incorporated)/i },
  { key: 'ERBE', pattern: /^erbe /i },
  { key: 'Ethicon', pattern: /^ethicon/i },
  { key: 'FUJIFILM SonoSite', pattern: /^(fujifilm )?sonosite/i },
  // FUJIFILM Corporation is the endoscopy arm (EB-series bronchoscopes, VP/EP processors);
  // SonoSite is the separate ultrasound business already matched above.
  { key: 'FUJIFILM', pattern: /^fujifilm (corporation|healthcare|medwork)/i },
  { key: 'Getinge', pattern: /^getinge/i },
  { key: 'Intuitive Surgical', pattern: /^intuitive surgical/i },
  { key: 'Karl Storz', pattern: /^karl storz/i },
  { key: 'Medela', pattern: /^medela/i },
  { key: 'Medtronic', pattern: /^(medtronic|covidien)/i },
  { key: 'Merit Medical', pattern: /^merit medical/i },
  { key: 'Micro-Tech', pattern: /^micro-?tech/i },
  { key: 'Novatech', pattern: /^(novatech|boston medical products)/i },
  { key: 'Olympus', pattern: /^olympus/i },
  { key: 'Pulmonx', pattern: /^pulmonx/i },
  { key: 'Redax', pattern: /^redax/i },
  { key: 'Richard Wolf', pattern: /^richard wolf/i },
  { key: 'Rocket Medical', pattern: /^rocket medical/i },
  { key: 'Teleflex', pattern: /^teleflex/i },
  { key: 'TRACOE', pattern: /^tracoe/i },
  { key: 'Verathon', pattern: /^verathon/i },
]

export interface GudidIndexEntry {
  primaryDi: string
  companyName: string
  companyKey: string
  brandName: string
  catalogNumber: string
  versionModelNumber: string
  /** Normalized catalog number used as the join key. */
  catalogKey: string
  description: string
  distributionStatus: string
  singleUse: boolean
  sterile: boolean
  rx: boolean
  /** GTINs published for this device record, from identifiers.txt. */
  gtins: string[]
}

export function normalizeCatalogKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isTrue(value: string): boolean {
  return value?.trim().toLowerCase() === 'true'
}

function resolveCompanyKey(companyName: string): string | null {
  for (const { key, pattern } of COMPANY_PATTERNS) {
    if (pattern.test(companyName.trim())) return key
  }
  return null
}

async function streamLines(filePath: string, onLine: (line: string, index: number) => void) {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let index = 0
  for await (const line of rl) {
    onLine(line, index)
    index += 1
  }
}

async function main() {
  const releaseDirectory = process.argv[2] ?? DEFAULT_RELEASE_DIRECTORY
  const devicePath = path.join(releaseDirectory, 'device.txt')
  const identifiersPath = path.join(releaseDirectory, 'identifiers.txt')

  if (!existsSync(devicePath) || !existsSync(identifiersPath)) {
    throw new Error(
      `AccessGUDID release not found at "${releaseDirectory}". Pass the release directory as the first argument.`,
    )
  }

  // Catalog numbers already in our product list, so broad-line suppliers contribute only
  // devices we can actually confirm.
  const catalogProducts = JSON.parse(
    await readFile(path.join(OUTPUT_DIRECTORY, 'catalog-products.json'), 'utf8'),
  ) as { catalog_number: string | null; global_part_number: string | null }[]
  const knownCatalogKeys = new Set<string>()
  for (const product of catalogProducts) {
    for (const value of [product.catalog_number, product.global_part_number]) {
      if (!value) continue
      const key = normalizeCatalogKey(value)
      if (key.length >= 3) knownCatalogKeys.add(key)
    }
  }

  const targetedBrands = await loadTargetedBrands()

  const entriesByDi = new Map<string, GudidIndexEntry>()
  let deviceRows = 0

  await streamLines(devicePath, (line, index) => {
    if (index === 0) return
    deviceRows += 1
    const fields = line.split('|')
    const companyName = fields[13] ?? ''
    if (!companyName) return
    const brandName = (fields[9] ?? '').trim()
    // A discovery brand is kept even when its labeler is not a catalog manufacturer, which
    // is how Portex (labelled by ICU Medical) reaches the index.
    const brandKey = resolveBrandKey(brandName)
    const targetedBrand = brandKey ? null : resolveTargetedBrand(brandName, targetedBrands)
    const companyKey = brandKey ?? targetedBrand?.key ?? resolveCompanyKey(companyName)
    if (!companyKey) return

    const primaryDi = (fields[0] ?? '').trim()
    if (!primaryDi) return
    const catalogNumber = (fields[11] ?? '').trim()
    const versionModelNumber = (fields[10] ?? '').trim()
    const catalogKey = normalizeCatalogKey(catalogNumber || versionModelNumber)

    // A targeted brand contributes only the catalog numbers we transcribed, so Bivona's
    // ~53,000 listings do not land in the index wholesale.
    if (targetedBrand && !targetedBrand.allowedCatalogKeys.has(catalogKey)) return

    if (
      !brandKey &&
      !targetedBrand &&
      !DISCOVERY_COMPANY_KEYS.has(companyKey) &&
      !knownCatalogKeys.has(catalogKey)
    ) {
      return
    }

    entriesByDi.set(primaryDi, {
      primaryDi,
      companyName: companyName.trim(),
      companyKey,
      brandName,
      catalogNumber,
      versionModelNumber,
      catalogKey,
      description: (fields[15] ?? '').trim(),
      distributionStatus: (fields[8] ?? '').trim(),
      singleUse: isTrue(fields[21] ?? ''),
      sterile: isTrue(fields[32] ?? ''),
      rx: isTrue(fields[30] ?? ''),
      gtins: [],
    })
  })

  await streamLines(identifiersPath, (line, index) => {
    if (index === 0) return
    const fields = line.split('|')
    const primaryDi = (fields[0] ?? '').trim()
    const entry = entriesByDi.get(primaryDi)
    if (!entry) return
    const deviceId = (fields[1] ?? '').trim()
    const issuingAgency = (fields[3] ?? '').trim()
    if (deviceId && /gs1/i.test(issuingAgency) && !entry.gtins.includes(deviceId)) {
      entry.gtins.push(deviceId)
    }
  })

  const entries = [...entriesByDi.values()].sort(
    (left, right) =>
      left.companyKey.localeCompare(right.companyKey) ||
      left.catalogKey.localeCompare(right.catalogKey) ||
      left.primaryDi.localeCompare(right.primaryDi),
  )
  for (const entry of entries) entry.gtins.sort()

  await writeFile(
    path.join(OUTPUT_DIRECTORY, 'gudid-index.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
    'utf8',
  )

  const byCompany = new Map<string, number>()
  for (const entry of entries) {
    byCompany.set(entry.companyKey, (byCompany.get(entry.companyKey) ?? 0) + 1)
  }
  console.log(
    `Scanned ${deviceRows.toLocaleString()} GUDID device records; kept ${entries.length.toLocaleString()} for ${byCompany.size} manufacturers.`,
  )
  for (const [company, count] of [...byCompany.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${company}`)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
