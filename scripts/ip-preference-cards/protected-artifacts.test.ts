import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const PROTECTED_FILE_HASHES = {
  'Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx':
    'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
  'data/ip-preference-cards/generated/catalog-products.json':
    '1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe',
  'data/ip-preference-cards/generated/product-roles.json':
    'df1f416cecc440ef165ad3f7ee52eff242a429fc816dad6f01ab61cd085fb8c8',
  'data/ip-preference-cards/generated/verification-backlog.json':
    '25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38',
  'data/ip-preference-cards/generated/hospital-formulary-staging.json':
    'f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73',
  'data/ip-preference-cards/generated/slot-product-options.json':
    '73a08536f2c9a9dab9b92f554acb87c4bc7bd707b9d65eafa939d96835c44091',
  'data/ip-preference-cards/generated/procedure-slots.json':
    'b7b85083951c1401b353e54f40b0f1b2d7166d60008ac77e2a3ea463b1209f73',
  'data/ip-preference-cards/generated/roles.json':
    '26b499846b59a2d067585e52251f99c7f133339bce8673f2713ac51deec786a4',
  'data/ip-preference-cards/seed/openfda-calibration-cohort.json':
    '823969347c7cf85a1b13e10c76ebc9aad2cbcbfc1233b582c29d0670f73141d2',
  'docs/ip-preference-cards/openfda-live-calibration-report.md':
    '7c9a35944211351c63d4f95b28b3178059b4202f4ea545ed95f49982865abdea',
  'scripts/ip-preference-cards/openfda/manufacturer-aliases.ts':
    '6dff7acd53a5825330bfcc984832a3071c369621a6b80a4b88d42f03d28da902',
  'src/features/preference-cards/server/manufacturer-aliases.ts':
    'aad9ff0026583744dc77c71f58395dd48167c04a9c358b7549aa67cd80bfeddd',
  'scripts/ip-preference-cards/openfda/classify-match.ts':
    '863c3bf58f2a7e2fd9ca8b616fcf4a25dcc8526bbf5899024970b3c95a69ff7a',
  'scripts/ip-preference-cards/openfda/query-plan.ts':
    '7fe7af1615adc84ed39b2e12db042bdb3e63d61e01cf95ac808e69e6a6d71f84',
} as const

const OPENFDA_DIRECTORY = 'data/ip-preference-cards/generated/openfda'
const OPENFDA_FILE_COUNT = 48
const OPENFDA_MANIFEST_SHA256 = '4cc03adac07ad4f7e2d455559377017af9f2c9048240e3637ced4d46e9add61c'

function sha256(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filename = path.join(directory, entry.name)
      return entry.isDirectory() ? filesUnder(filename) : [filename]
    })
    .sort()
}

describe('Phase 0.5 protected preference-card artifacts', () => {
  it.each(Object.entries(PROTECTED_FILE_HASHES))(
    'keeps %s byte-identical to its recorded baseline',
    (filename, expectedHash) => {
      expect(sha256(readFileSync(filename))).toBe(expectedHash)
    },
  )

  it('keeps the complete OpenFDA proposal, summary, and calibration artifact set unchanged', () => {
    const files = filesUnder(OPENFDA_DIRECTORY)
    const manifest = files
      .map((filename) => `${sha256(readFileSync(filename))}  ${filename}\n`)
      .join('')

    expect(files).toHaveLength(OPENFDA_FILE_COUNT)
    expect(sha256(manifest)).toBe(OPENFDA_MANIFEST_SHA256)
  })
})
