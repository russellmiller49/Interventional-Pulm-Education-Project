/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_ALL_MIGRATION_PATHS,
  LITERATURE_APPROVED_APPLICATION_MECHANISM,
  LITERATURE_APPROVED_APPLICATION_OPERATION,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_DEFERRED_MIGRATIONS,
  LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT,
  LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_FOUNDATION_MIGRATION,
  LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT,
  LITERATURE_MIGRATION_HISTORY_FIDELITY,
  LITERATURE_PROHIBITED_DEPLOYMENT_METHODS,
  LITERATURE_PROHIBITED_TARGET_REFS,
  LITERATURE_RELATED_MIGRATION_TOTAL,
  LITERATURE_REPOSITORY_MIGRATION_TOTAL,
  LITERATURE_UNRELATED_MIGRATION_TOTAL,
  evaluateLiteratureFoundationSelection,
  type LiteratureSelectionCandidate,
} from './foundation-manifest'

const ROOT = process.cwd()
const APPROVED_REF = LITERATURE_DEDICATED_TARGET.projectRef
const MAIN_REF = 'tqnhxlwvkkswuckszlee'

async function migrationBytes() {
  return readFile(resolve(ROOT, LITERATURE_FOUNDATION_MIGRATION.path))
}

function candidate(
  overrides: Partial<LiteratureSelectionCandidate> = {},
): LiteratureSelectionCandidate {
  return {
    migrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path],
    migrationSha256ByPath: {
      [LITERATURE_FOUNDATION_MIGRATION.path]: LITERATURE_FOUNDATION_MIGRATION.sha256,
    },
    migrationByteLengthByPath: {
      [LITERATURE_FOUNDATION_MIGRATION.path]: LITERATURE_FOUNDATION_MIGRATION.byteLength,
    },
    targetProjectRef: APPROVED_REF,
    targetHostname: `${APPROVED_REF}.supabase.co`,
    appliedMigrationVersions: [],
    applicationMechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM,
    ...overrides,
  }
}

function reasons(result: ReturnType<typeof evaluateLiteratureFoundationSelection>) {
  return result.rejections.map((entry) => entry.reason)
}

describe('dedicated Literature foundation manifest', () => {
  it('binds the exact SHA-256 and byte length of the migration on disk', async () => {
    const bytes = await migrationBytes()
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      LITERATURE_FOUNDATION_MIGRATION.sha256,
    )
    expect(bytes.byteLength).toBe(LITERATURE_FOUNDATION_MIGRATION.byteLength)
  })

  it('targets the dedicated project and excludes the main application project', () => {
    expect(LITERATURE_DEDICATED_TARGET.projectRef).toBe('itcttmkxdxvwmwcmzmey')
    expect(LITERATURE_DEDICATED_TARGET.projectName).toBe('IP_Literature')
    expect(LITERATURE_PROHIBITED_TARGET_REFS).toContain(MAIN_REF)
    expect(LITERATURE_PROHIBITED_TARGET_REFS).not.toContain(APPROVED_REF)
  })

  it('expects an empty starting history and exactly one recorded migration afterwards', () => {
    expect(LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS).toEqual([])
    expect(LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_COUNT).toBe(1)
    expect(LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT).toBe(1)
  })

  it('does not assume the recorded version equals the historical filename version (H-5)', () => {
    expect(LITERATURE_MIGRATION_HISTORY_FIDELITY.versionStringIsProviderAssigned).toBe(true)
    expect(LITERATURE_MIGRATION_HISTORY_FIDELITY.filenameVersionMayNotBeRecorded).toBe(true)
    expect(LITERATURE_MIGRATION_HISTORY_FIDELITY.requiresExecutionTimeEvidence).toBe(true)
    expect(LITERATURE_MIGRATION_HISTORY_FIDELITY.note).toMatch(/Do not assume/u)
  })

  describe('migration inventory (L-2)', () => {
    it('records 33 total, 10 Literature-related, 9 deferred, 23 unrelated', async () => {
      const entries = await readdir(resolve(ROOT, 'supabase/migrations'))
      const sql = entries.filter((name) => name.endsWith('.sql'))
      expect(sql).toHaveLength(LITERATURE_REPOSITORY_MIGRATION_TOTAL)
      expect(LITERATURE_REPOSITORY_MIGRATION_TOTAL).toBe(33)
      expect(LITERATURE_RELATED_MIGRATION_TOTAL).toBe(10)
      expect(LITERATURE_UNRELATED_MIGRATION_TOTAL).toBe(23)
      expect(LITERATURE_DEFERRED_MIGRATIONS).toHaveLength(9)
      expect(LITERATURE_ALL_MIGRATION_PATHS).toHaveLength(LITERATURE_RELATED_MIGRATION_TOTAL)
      expect(LITERATURE_RELATED_MIGRATION_TOTAL + LITERATURE_UNRELATED_MIGRATION_TOTAL).toBe(
        LITERATURE_REPOSITORY_MIGRATION_TOTAL,
      )
    })

    it('states the correct counts in the db push rejection reason', () => {
      const push = LITERATURE_PROHIBITED_DEPLOYMENT_METHODS.find(
        (entry) => entry.method === 'supabase db push',
      )
      expect(push?.reason).toMatch(/nine deferred/u)
      expect(push?.reason).toMatch(/twenty-three unrelated/u)
      expect(push?.reason).not.toMatch(/six deferred|twenty-six/u)
    })

    it('defers the three migrations whose filenames hide that they are Literature', () => {
      for (const name of [
        '20260728170939_add_interactive_clinical_case_publication_status.sql',
        '20260728171212_add_immune_inflammatory_disease_tag.sql',
        '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
      ]) {
        expect(LITERATURE_DEFERRED_MIGRATIONS.some((entry) => entry.path.endsWith(name))).toBe(true)
      }
    })

    it('classifies every migration that references a Literature object', async () => {
      const directory = resolve(ROOT, 'supabase/migrations')
      const entries = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()
      const literatureMigrations: string[] = []
      for (const name of entries) {
        const sql = await readFile(resolve(directory, name), 'utf8')
        if (/literature/iu.test(sql)) literatureMigrations.push(`supabase/migrations/${name}`)
      }
      expect(literatureMigrations.sort()).toEqual([...LITERATURE_ALL_MIGRATION_PATHS].sort())
    })

    it('confirms the foundation migration is self-contained and non-destructive', async () => {
      const sql = (await migrationBytes()).toString('utf8')
      expect(sql).not.toMatch(/literature_gold/iu)
      expect(sql).not.toMatch(/create\s+index\s+concurrently/iu)
      expect(sql).not.toMatch(/\bvacuum\b/iu)
      expect(sql).not.toMatch(/alter\s+system/iu)
      expect(sql).not.toMatch(/\bdrop\s+(table|function|schema|index)\b/iu)
      expect(sql).not.toMatch(/\btruncate\b/iu)
      expect(sql).not.toMatch(/security\s+definer/iu)
    })
  })

  describe('selection contract', () => {
    it('approves exactly one unaltered foundation migration through the approved mechanism', () => {
      expect(evaluateLiteratureFoundationSelection(candidate()).approved).toBe(true)
    })

    it('rejects zero selected migrations', () => {
      const result = evaluateLiteratureFoundationSelection(candidate({ migrationPaths: [] }))
      expect(reasons(result)).toContain('no_migration_selected')
    })

    it('rejects more than one selected migration', () => {
      const second = 'supabase/migrations/20260727164510_add_literature_gold_set.sql'
      const result = evaluateLiteratureFoundationSelection(
        candidate({
          migrationPaths: [LITERATURE_FOUNDATION_MIGRATION.path, second],
          migrationSha256ByPath: {
            [LITERATURE_FOUNDATION_MIGRATION.path]: LITERATURE_FOUNDATION_MIGRATION.sha256,
            [second]: 'f'.repeat(64),
          },
        }),
      )
      expect(reasons(result)).toEqual(
        expect.arrayContaining(['multiple_migrations_selected', 'migration_path_not_approved']),
      )
    })

    it('rejects a bulk directory-scoped selection', () => {
      const all = LITERATURE_ALL_MIGRATION_PATHS
      const result = evaluateLiteratureFoundationSelection(
        candidate({
          migrationPaths: all,
          migrationSha256ByPath: Object.fromEntries(
            all.map((path) => [path, LITERATURE_FOUNDATION_MIGRATION.sha256]),
          ),
          migrationByteLengthByPath: {},
        }),
      )
      expect(reasons(result)).toContain('multiple_migrations_selected')
    })

    it('rejects drift, a wrong byte length, and a relocated copy', () => {
      expect(
        reasons(
          evaluateLiteratureFoundationSelection(
            candidate({
              migrationSha256ByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: 'a'.repeat(64) },
            }),
          ),
        ),
      ).toContain('migration_checksum_mismatch')

      expect(
        reasons(
          evaluateLiteratureFoundationSelection(
            candidate({ migrationByteLengthByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: 1 } }),
          ),
        ),
      ).toContain('migration_byte_length_mismatch')

      const copied = 'supabase/migrations/99999999999999_copied_literature_explorer.sql'
      expect(
        reasons(
          evaluateLiteratureFoundationSelection(
            candidate({
              migrationPaths: [copied],
              migrationSha256ByPath: { [copied]: LITERATURE_FOUNDATION_MIGRATION.sha256 },
            }),
          ),
        ),
      ).toContain('migration_path_not_approved')
    })

    it('rejects the main application project and any unapproved ref', () => {
      expect(
        reasons(evaluateLiteratureFoundationSelection(candidate({ targetProjectRef: MAIN_REF }))),
      ).toContain('target_ref_prohibited')
      expect(
        reasons(
          evaluateLiteratureFoundationSelection(
            candidate({ targetProjectRef: 'abcdefghijklmnopqrst' }),
          ),
        ),
      ).toContain('target_ref_not_approved')
      expect(
        reasons(evaluateLiteratureFoundationSelection(candidate({ targetProjectRef: undefined }))),
      ).toContain('target_ref_missing')
    })

    it('rejects loopback presented as production', () => {
      expect(
        reasons(evaluateLiteratureFoundationSelection(candidate({ targetHostname: '127.0.0.1' }))),
      ).toContain('target_is_loopback')
    })

    it('rejects any non-empty pre-application history', () => {
      for (const history of [[LITERATURE_FOUNDATION_MIGRATION.version], ['20260809231651']]) {
        expect(
          reasons(
            evaluateLiteratureFoundationSelection(candidate({ appliedMigrationVersions: history })),
          ),
        ).toContain('pre_application_history_not_empty')
      }
    })
  })

  describe('application mechanism is a required closed enum (H-5)', () => {
    it('names the approved connector operation and its bindings', () => {
      expect(LITERATURE_APPROVED_APPLICATION_MECHANISM).toBe(
        'supabase_connector_apply_migration_v1',
      )
      expect(LITERATURE_APPROVED_APPLICATION_OPERATION).toMatchObject({
        toolOperation: 'apply_migration',
        projectRef: 'itcttmkxdxvwmwcmzmey',
        exactToolCalls: 1,
        automaticRetryPermitted: false,
      })
    })

    it('rejects an omitted or empty mechanism with the controlled reason', () => {
      for (const mechanism of [undefined, '']) {
        expect(
          reasons(
            evaluateLiteratureFoundationSelection(candidate({ applicationMechanism: mechanism })),
          ),
        ).toContain('application_mechanism_not_approved')
      }
    })

    it('rejects every non-string runtime shape with the controlled reason, never a TypeError (H-5)', () => {
      // The evaluator is total: values arriving from deserialized input, casts, or `as any`
      // callers must produce application_mechanism_not_approved, not a thrown string-method
      // TypeError.
      const shapes: unknown[] = [
        null,
        [LITERATURE_APPROVED_APPLICATION_MECHANISM],
        { mechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM },
        42,
        0,
        true,
        false,
        Symbol('mechanism'),
      ]
      for (const mechanism of shapes) {
        const result = evaluateLiteratureFoundationSelection(
          candidate({ applicationMechanism: mechanism }),
        )
        expect(result.approved).toBe(false)
        expect(reasons(result)).toContain('application_mechanism_not_approved')
      }
    })

    it('rejects arbitrary, wrapped, and suffixed mechanisms', () => {
      for (const mechanism of [
        'anything',
        'supabase db push',
        'npx supabase db push',
        'supabase db push --linked',
        "bash -lc 'supabase db push'",
        'supabase migration repair',
        'supabase db reset',
        'dashboard SQL editor',
        'supabase_connector_apply_migration_v2',
        ' supabase_connector_apply_migration_v1',
        'SUPABASE_CONNECTOR_APPLY_MIGRATION_V1',
      ]) {
        const result = evaluateLiteratureFoundationSelection(
          candidate({ applicationMechanism: mechanism }),
        )
        expect(result.approved).toBe(false)
        expect(reasons(result)).toContain('application_mechanism_not_approved')
      }
    })

    it('accepts only the exact approved mechanism', () => {
      expect(
        evaluateLiteratureFoundationSelection(
          candidate({ applicationMechanism: LITERATURE_APPROVED_APPLICATION_MECHANISM }),
        ).approved,
      ).toBe(true)
    })
  })
})
