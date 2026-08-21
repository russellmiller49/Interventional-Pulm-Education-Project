import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { buildCalibrationCohort, calibrationCohortSchema } from '../build-calibration-cohort'
import { validatedCohortOutputPath } from '../build-cohort-manifest'
import { validateManufacturerSourceOutputPath } from '../fetch-manufacturer-sources'
import {
  usStatusEvidenceArtifactSchema,
  usStatusRunSummarySchema,
  usStatusSourceManifestSchema,
} from '../proposal-schemas'
import { parseResearchArgs } from '../run-us-status-research'
import { hiddenProductCohortManifestSchema } from '../schemas'
import { sourceCompletenessCount } from '../../source-completeness-intake'

const GENERATED_ROOT = 'data/ip-preference-cards/generated'
const RESEARCH_ROOT = 'data/ip-preference-cards/research/us-status'
const SAFETY_TEST_PATH = path.normalize(
  'scripts/ip-preference-cards/us-status/__tests__/safety-boundaries.test.ts',
)

// This work package is proposal-only. These canonical catalog hashes move only with a separately
// authorized governed intake such as Source Completeness V2, never a research-output refresh.
const PROHIBITED_CANONICAL_HASHES = {
  'Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx':
    'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
  'data/ip-preference-cards/generated/catalog-products.json':
    'a6fe291c9b863820c2f820540e4b1a5161c29065ed0b468ce2fde937daf69930',
  'data/ip-preference-cards/generated/roles.json':
    '8ec7c66cf5db225532c8195258f341af5644559689dd0b69cea7a56e2fd0b571',
  'data/ip-preference-cards/generated/product-roles.json':
    'aa1a3b19c1f09d3284048217efa76d0bfb0beb34528d1ed994ecaee161045224',
  'data/ip-preference-cards/generated/procedure-slots.json':
    'c11720c8d209b22c56813265ea53f70a348a0fd3af7b4cef9c6ca1a6b43a3ea7',
  'data/ip-preference-cards/generated/slot-product-options.json':
    'a2a85385f00584e0a52da3af638b3e02744cb24d7dca4c1110bc111f10da47c0',
  'data/ip-preference-cards/generated/hospital-formulary-staging.json':
    'f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73',
  'data/ip-preference-cards/generated/verification-backlog.json':
    '25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38',
  'data/ip-preference-cards/generated/gudid-confirmations.json':
    'd04822ac2afce88c38df69d8f90832de28a960dfcdb1a5b41fdcb2152a414c42',
  'data/ip-preference-cards/generated/gudid-index.json':
    '8067e825b884863f68335d4cc1463c1833a3faa5d72839c65d97d0b2aef14fb6',
  'data/ip-preference-cards/generated/catalog-release.json':
    'c0e2d3b4aedbb22b0f852e4c4c743ead4c5f293e629a45df08c3a9f1893d78e3',
  'data/ip-preference-cards/generated/resolver-release.json':
    '4efa3a30f47d7f9cdeda9e125b2693008037a766ff5379ba2cfaf9b8ee8eddbd',
  'data/ip-preference-cards/generated/catalog-rows.json':
    'f4c514330563ee8dbde6447236f823d262d36de7cfb5fb65465585f4aee240c8',
  'data/ip-preference-cards/generated/catalog-release-manifests.json':
    '8e2766e2d742f3a5c98c6a2de6c83649738974fed9dcb985a9cbee83c9359e41',
  'data/ip-preference-cards/generated/product-family-versions.json':
    '7fedea24f9594f21ec3256aba0b82199f597567f83c17cd763fcba759fc83baf',
  'data/ip-preference-cards/generated/module-ledger.json':
    'af3ee1c23c07e9e34e346923a054f6a61cbf042c9b044cbc6cfa3e112eebbee5',
  'data/ip-preference-cards/generated/composition-ledger.json':
    'abf3368ae06eca0362063f63fa769b12ca3dc49411378c742d81a4568e3e05f0',
  'data/ip-preference-cards/generated/definition-set-ledger.json':
    '855da98e16d1b240d407ae86257b26ec917db4265047d10c3f18781e938d5edb',
  'data/ip-preference-cards/generated/release-bundles.json':
    '0eb2610c01bf65db5ce140252d7a9d09e075dda3538d1ff458c7116e9eed829f',
  'data/ip-preference-cards/generated/release-impact-report.json':
    '272d8cec228d9e4d95d8796661984e726c3d298f97783201877caddad400df60',
  'data/ip-preference-cards/seed/catalog-additions.json':
    'eb29d7375d6bcae5686a65a47668bc8702f67efd6cc5099f12604b6938e4eed2',
  'data/ip-preference-cards/seed/release-bundles.json':
    '892780cb38695b71b8c6d258ca4915ae5bf74062e8e976dff050aa0ced9cdde2',
} as const

const catalogSafetySchema = z.array(
  z
    .object({
      product_id: z.string().min(1),
      visibility_state: z.enum(['prototype_visible', 'hidden']),
      live_dropdown_status: z.string().min(1),
    })
    .passthrough(),
)

const slotOptionSafetySchema = z.array(
  z
    .object({
      product_id: z.string().min(1),
      product_visibility: z.enum(['prototype_visible', 'hidden']),
      visible_by_default: z.boolean(),
      selectable: z.boolean(),
    })
    .passthrough(),
)

const formularySafetySchema = z.array(
  z
    .object({
      product_id: z.string().min(1),
      live_dropdown_status: z.string().min(1),
      hospital_carries: z.boolean(),
      preferred: z.boolean(),
    })
    .passthrough(),
)

const manufacturerSourceManifestSafetySchema = z
  .object({
    format_version: z.literal(1),
    snapshot: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    canonical_change_applied: z.literal(false),
    sources: z.array(
      z
        .object({
          catalog_source_id: z.string().min(1),
          canonical_change_applied: z.literal(false),
        })
        .passthrough(),
    ),
  })
  .passthrough()

/** Sheets that share the per-state column contract below. */
const STATE_CSV_FILENAMES = new Set([
  'current-us-supported.csv',
  'safety-action-holds.csv',
  'not-current-supported.csv',
  'historical-authorization-only.csv',
  'conflicts.csv',
  'identity-unresolved.csv',
  'insufficient-evidence.csv',
  'noncommercial-or-local.csv',
  'query-errors.csv',
])

/**
 * Every governed reviewer-facing CSV the research package emits.
 *
 * `safety-action-holds.csv` is one of them: it is the sheet a reviewer opens to see which
 * products are held for safety review, so it needs the same row, formula-safety, schema, and
 * non-applying protections as the state CSVs, not weaker ones because it was added later.
 */
const ARTIFACT_CSV_FILENAMES = new Set([
  ...STATE_CSV_FILENAMES,
  'clinician-review.csv',
  'calibration-review.csv',
])

/** The governed column contract for every per-state CSV, including the safety-hold sheet. */
const STATE_CSV_COLUMNS = [
  'product_id',
  'manufacturer',
  'product_name',
  'catalog_number',
  'model_number',
  'research_state',
  'confidence',
  'identity_match_method',
  'udi_assessment',
  'listing_assessment',
  'authorization_finding',
  'manufacturer_finding',
  'conflict_flags',
  'safety_search_status',
  'safety_action_state',
  'safety_action_scope',
  'safety_action_references',
  'visibility_review_eligibility',
  'rationale',
  'unresolved_questions',
  'proposed_human_review_disposition',
  'source_urls',
  'canonical_change_applied',
]

/**
 * A spreadsheet treats a leading `=`, `+`, `-`, `@`, tab, or carriage return as a formula. Every
 * emitted cell must be neutralized, or an FDA free-text field could execute on open.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

function sha256(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8')) as unknown
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filename = path.join(directory, entry.name)
      return entry.isDirectory() ? filesUnder(filename) : entry.isFile() ? [filename] : []
    })
    .sort((left, right) => left.localeCompare(right))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function canonicalChangeValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(canonicalChangeValues)
  if (!isRecord(value)) return []
  return [
    ...(Object.hasOwn(value, 'canonical_change_applied') ? [value.canonical_change_applied] : []),
    ...Object.values(value).flatMap(canonicalChangeValues),
  ]
}

function parseCsv(contents: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index]
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
      continue
    }
    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.endsWith('\r') ? cell.slice(0, -1) : cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell.length > 0 || row.length > 0) rows.push([...row, cell])
  return rows.filter((cells) => cells.some((value) => value.length > 0))
}

function productionScriptClosure(scripts: Record<string, string>): string[] {
  const selected = new Set(
    Object.keys(scripts).filter(
      (name) =>
        /^(?:pre|post)?(?:install|prepare|publish|pack)$/.test(name) ||
        /^(?:pre|post)?(?:build|start|dev)(?::|$)/.test(name) ||
        /^deploy(?::|$)/.test(name),
    ),
  )
  const pending = [...selected]
  while (pending.length > 0) {
    const name = pending.pop()
    if (!name) continue
    for (const match of scripts[name].matchAll(/\bnpm\s+(?:run|run-script)\s+([\w:-]+)/g)) {
      const dependency = match[1]
      if (!scripts[dependency] || selected.has(dependency)) continue
      selected.add(dependency)
      pending.push(dependency)
    }
  }
  return [...selected].sort((left, right) => left.localeCompare(right))
}

function referencedRepositoryFiles(command: string): string[] {
  return [...command.matchAll(/\b((?:scripts|src)\/[\w./-]+\.(?:[cm]?[jt]sx?|py))\b/g)].map(
    (match) => match[1],
  )
}

describe('current U.S. status research safety boundaries', () => {
  it.each(Object.entries(PROHIBITED_CANONICAL_HASHES))(
    'keeps prohibited canonical input %s byte-identical',
    (filename, expectedHash) => {
      expect(sha256(readFileSync(filename))).toBe(expectedHash)
    },
  )

  it('keeps every hidden catalog product hidden, nonselectable, and non-formulary', () => {
    const catalog = catalogSafetySchema.parse(
      readJson(path.join(GENERATED_ROOT, 'catalog-products.json')),
    )
    const slotOptions = slotOptionSafetySchema.parse(
      readJson(path.join(GENERATED_ROOT, 'slot-product-options.json')),
    )
    const formulary = formularySafetySchema.parse(
      readJson(path.join(GENERATED_ROOT, 'hospital-formulary-staging.json')),
    )
    const hiddenProducts = catalog.filter((product) => product.visibility_state === 'hidden')
    const hiddenIds = new Set(hiddenProducts.map((product) => product.product_id))

    expect(hiddenProducts).toHaveLength(sourceCompletenessCount('hidden_products_after'))
    expect(
      hiddenProducts.filter((product) => !product.live_dropdown_status.startsWith('Hidden')),
    ).toEqual([])
    expect(
      slotOptions.filter(
        (option) =>
          hiddenIds.has(option.product_id) &&
          (option.product_visibility !== 'hidden' ||
            option.visible_by_default !== false ||
            option.selectable !== false),
      ),
    ).toEqual([])
    expect(
      formulary.filter(
        (row) =>
          hiddenIds.has(row.product_id) &&
          (!row.live_dropdown_status.startsWith('Hidden') ||
            row.hospital_carries !== false ||
            row.preferred !== false),
      ),
    ).toEqual([])
  })

  it('keeps research code and openFDA endpoints out of application and production entrypoints', () => {
    const packageJson = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(readJson('package.json'))
    const productionScripts = productionScriptClosure(packageJson.scripts)
    const productionEntryFiles = new Set([
      'server.js',
      'next.config.js',
      'next.config.mjs',
      ...productionScripts.flatMap((name) => referencedRepositoryFiles(packageJson.scripts[name])),
    ])
    const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
    const applicationFiles = filesUnder('src').filter((filename) =>
      codeExtensions.has(path.extname(filename)),
    )
    const researchImport = /scripts[\\/]ip-preference-cards[\\/]us-status(?:[\\/]|\b)/i
    const fdaEndpoint =
      /api\.fda\.gov\/device\/(?:udi|registrationlisting|510k|pma|denovo|hde|recall|enforcement|classification)\.json/i
    const violations: string[] = []

    for (const filename of applicationFiles) {
      const contents = readFileSync(filename, 'utf8')
      if (researchImport.test(contents) || fdaEndpoint.test(contents)) violations.push(filename)
    }
    for (const scriptName of productionScripts) {
      const command = packageJson.scripts[scriptName]
      if (researchImport.test(command) || fdaEndpoint.test(command)) {
        violations.push(`package.json#scripts.${scriptName}`)
      }
    }
    for (const filename of productionEntryFiles) {
      if (!existsSync(filename)) continue
      const contents = readFileSync(filename, 'utf8')
      if (researchImport.test(contents) || fdaEndpoint.test(contents)) violations.push(filename)
    }

    expect([...new Set(violations)].sort()).toEqual([])
  })

  it('rejects generated, seed, runtime, and source-workbook roots as research outputs', async () => {
    const prohibitedRoots = [
      'data/ip-preference-cards/generated/us-status',
      'data/ip-preference-cards/seed/us-status',
      'src/generated/us-status',
      'Preference_card_module/us-status',
    ]

    for (const root of prohibitedRoots) {
      expect(() => validatedCohortOutputPath(path.join(root, 'cohort-manifest.json'))).toThrow()
      expect(() =>
        validateManufacturerSourceOutputPath('2026-08-13', path.join(root, 'source-manifest.json')),
      ).toThrow()
      expect(() =>
        parseResearchArgs([
          '--snapshot',
          '2026-08-13',
          '--cohort',
          path.join(RESEARCH_ROOT, '2026-08-13/cohort-manifest.json'),
          '--manufacturer-source-manifest',
          path.join(RESEARCH_ROOT, '2026-08-13/source-manifest.json'),
          '--output-dir',
          root,
        ]),
      ).toThrow()
      await expect(
        buildCalibrationCohort(
          'intentionally-missing-cohort-manifest.json',
          path.join(root, 'calibration-cohort.json'),
        ),
      ).rejects.toThrow()
    }
  })

  it('does not expose a configured or literal openFDA API key in research files', () => {
    const calibrationRoot = path.join(GENERATED_ROOT, 'openfda', 'calibration')
    const researchFiles = [
      ...filesUnder('scripts/ip-preference-cards/us-status'),
      ...filesUnder('data/ip-preference-cards/research'),
      ...filesUnder(calibrationRoot).filter((filename) =>
        path.basename(path.dirname(filename)).startsWith('us-status-'),
      ),
    ]
      .filter((filename) => path.normalize(filename) !== SAFETY_TEST_PATH)
      .filter((filename) =>
        ['.ts', '.tsx', '.json', '.csv', '.md'].includes(path.extname(filename)),
      )
    const literalCredentialPatterns = [
      /OPENFDA_API_KEY\s*[:=]\s*(['"])(?!redacted\b|<redacted>)[^'"\r\n]{8,}\1/i,
      /^\s*OPENFDA_API_KEY\s*=\s*(?!process\.env\b|redacted\b|<redacted>)[^\s#]{8,}/im,
      /[?&]api_key=(?!redacted\b|<redacted>|\$\{)[^&\s'"`]{8,}/i,
      /\bapiKey\s*:\s*(['"])(?!redacted\b|<redacted>|process\.env\b)[^'"\r\n]{8,}\1/i,
    ]
    const configuredKey = process.env.OPENFDA_API_KEY
    const literalCredentialFiles: string[] = []
    const configuredKeyFiles: string[] = []

    for (const filename of researchFiles) {
      const contents = readFileSync(filename, 'utf8')
      if (literalCredentialPatterns.some((pattern) => pattern.test(contents))) {
        literalCredentialFiles.push(filename)
      }
      if (typeof configuredKey === 'string' && configuredKey.length > 0) {
        const containsConfiguredKey = contents.includes(configuredKey)
        if (containsConfiguredKey) configuredKeyFiles.push(filename)
      }
    }

    // Only filenames and booleans can enter assertion output; the configured value never does.
    expect(literalCredentialFiles).toEqual([])
    expect(configuredKeyFiles).toEqual([])
  })

  it('schema-validates dated proposal artifacts when present and keeps every boundary nonapplying', () => {
    const jsonArtifacts = filesUnder(RESEARCH_ROOT).filter(
      (filename) => path.extname(filename) === '.json',
    )

    for (const filename of jsonArtifacts) {
      const artifact = readJson(filename)
      const basename = path.basename(filename)

      if (basename === 'cohort-manifest.json') {
        hiddenProductCohortManifestSchema.parse(artifact)
      } else if (basename === 'calibration-cohort.json') {
        calibrationCohortSchema.parse(artifact)
      } else if (basename === 'us-status-evidence-proposals.json') {
        usStatusEvidenceArtifactSchema.parse(artifact)
      } else if (basename === 'run-summary.json') {
        usStatusRunSummarySchema.parse(artifact)
      } else if (basename === 'source-manifest.json') {
        if (isRecord(artifact) && artifact.artifact_kind === 'current_us_status_source_manifest') {
          usStatusSourceManifestSchema.parse(artifact)
        } else {
          manufacturerSourceManifestSafetySchema.parse(artifact)
        }
      }

      const values = canonicalChangeValues(artifact)
      if (values.length > 0) expect(values.every((value) => value === false)).toBe(true)
    }

    const csvArtifacts = filesUnder(RESEARCH_ROOT).filter((filename) =>
      ARTIFACT_CSV_FILENAMES.has(path.basename(filename)),
    )
    for (const filename of csvArtifacts) {
      const rows = parseCsv(readFileSync(filename, 'utf8'))
      const header = rows[0] ?? []
      const canonicalColumn = header.indexOf('canonical_change_applied')
      expect(canonicalColumn).toBeGreaterThanOrEqual(0)
      if (STATE_CSV_FILENAMES.has(path.basename(filename))) {
        expect(header).toEqual(STATE_CSV_COLUMNS)
      }
      for (const row of rows.slice(1)) {
        expect(row).toHaveLength(header.length)
        expect(row[canonicalColumn]).toBe('false')
        expect(row.filter((cell) => FORMULA_TRIGGER.test(cell))).toEqual([])
      }
    }
  })

  it('protects the safety-action hold sheet exactly like every other governed review CSV', () => {
    const holdSheets = filesUnder(RESEARCH_ROOT).filter(
      (filename) => path.basename(filename) === 'safety-action-holds.csv',
    )
    expect(ARTIFACT_CSV_FILENAMES.has('safety-action-holds.csv')).toBe(true)
    expect(holdSheets.length).toBeGreaterThan(0)

    for (const filename of holdSheets) {
      const rows = parseCsv(readFileSync(filename, 'utf8'))
      expect(rows[0]).toEqual(STATE_CSV_COLUMNS)
      const eligibilityColumn = STATE_CSV_COLUMNS.indexOf('visibility_review_eligibility')
      const canonicalColumn = STATE_CSV_COLUMNS.indexOf('canonical_change_applied')
      const dispositionColumn = STATE_CSV_COLUMNS.indexOf('proposed_human_review_disposition')

      for (const row of rows.slice(1)) {
        expect(row).toHaveLength(STATE_CSV_COLUMNS.length)
        expect(row[canonicalColumn]).toBe('false')
        expect(row.filter((cell) => FORMULA_TRIGGER.test(cell))).toEqual([])
        // The sheet exists to list held products, so every row must actually be held.
        expect(['eligible_for_owner_review', 'not_applicable']).not.toContain(
          row[eligibilityColumn],
        )
        expect([
          'review_for_prototype_visibility',
          'review_as_not_currently_distributed',
        ]).not.toContain(row[dispositionColumn])
      }
    }
  })
})
