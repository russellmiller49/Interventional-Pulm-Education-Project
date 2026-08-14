/** @jest-environment node */

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  LITERATURE_ALL_MIGRATION_PATHS,
  LITERATURE_DEDICATED_TARGET,
  LITERATURE_DEFERRED_MIGRATIONS,
  LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS,
  LITERATURE_FOUNDATION_MIGRATION,
  LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT,
  LITERATURE_PROHIBITED_DEPLOYMENT_METHODS,
  LITERATURE_PROHIBITED_TARGET_REFS,
  LITERATURE_REPOSITORY_MIGRATION_TOTAL,
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
    targetHostname: `db.${APPROVED_REF}.supabase.co`,
    appliedMigrationVersions: [],
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

  it('expects an empty starting history and exactly one recorded version afterwards', () => {
    expect(LITERATURE_EXPECTED_PRE_APPLICATION_MIGRATION_VERSIONS).toEqual([])
    expect(LITERATURE_EXPECTED_POST_APPLICATION_MIGRATION_VERSIONS).toEqual(['20260727032621'])
    expect(LITERATURE_FOUNDATION_SELECTED_MIGRATION_COUNT).toBe(1)
  })

  describe('every Literature migration is accounted for', () => {
    it('lists the total migration count in the mixed directory', async () => {
      const entries = await readdir(resolve(ROOT, 'supabase/migrations'))
      expect(entries.filter((name) => name.endsWith('.sql'))).toHaveLength(
        LITERATURE_REPOSITORY_MIGRATION_TOTAL,
      )
    })

    it('defers nine Literature migrations, including the three whose filenames hide it', () => {
      expect(LITERATURE_DEFERRED_MIGRATIONS).toHaveLength(9)
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
      // Ten migrations touch Literature objects: the foundation plus the nine deferred ones.
      expect(literatureMigrations.sort()).toEqual([...LITERATURE_ALL_MIGRATION_PATHS].sort())
    })

    it('confirms the foundation migration references no deferred Literature object', async () => {
      const sql = (await migrationBytes()).toString('utf8')
      expect(sql).not.toMatch(/literature_gold/iu)
      expect(sql).not.toMatch(/save_literature_gold_review_v1/iu)
    })

    it('confirms the foundation migration is transactional and non-destructive', async () => {
      const sql = (await migrationBytes()).toString('utf8')
      expect(sql).not.toMatch(/create\s+index\s+concurrently/iu)
      expect(sql).not.toMatch(/\bvacuum\b/iu)
      expect(sql).not.toMatch(/alter\s+system/iu)
      expect(sql).not.toMatch(/\bdrop\s+(table|function|schema|index)\b/iu)
      expect(sql).not.toMatch(/\btruncate\b/iu)
      expect(sql).not.toMatch(/security\s+definer/iu)
    })
  })

  describe('selection contract', () => {
    it('approves exactly one unaltered foundation migration against the approved empty target', () => {
      expect(evaluateLiteratureFoundationSelection(candidate()).approved).toBe(true)
    })

    it('rejects zero selected migrations', () => {
      const result = evaluateLiteratureFoundationSelection(candidate({ migrationPaths: [] }))
      expect(result.approved).toBe(false)
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
      expect(result.approved).toBe(false)
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
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('multiple_migrations_selected')
    })

    it('rejects a one-byte drift in the migration contents', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({
          migrationSha256ByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: 'a'.repeat(64) },
        }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('migration_checksum_mismatch')
    })

    it('rejects a copied migration whose byte length differs', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({
          migrationByteLengthByPath: { [LITERATURE_FOUNDATION_MIGRATION.path]: 1 },
        }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('migration_byte_length_mismatch')
    })

    it('rejects a migration outside the approved path even with a matching hash', () => {
      const copied = 'supabase/migrations/99999999999999_copied_literature_explorer.sql'
      const result = evaluateLiteratureFoundationSelection(
        candidate({
          migrationPaths: [copied],
          migrationSha256ByPath: { [copied]: LITERATURE_FOUNDATION_MIGRATION.sha256 },
        }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('migration_path_not_approved')
    })

    it('rejects the main application project as a target', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ targetProjectRef: MAIN_REF }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('target_ref_prohibited')
    })

    it('rejects an unapproved project ref', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ targetProjectRef: 'abcdefghijklmnopqrst' }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('target_ref_not_approved')
    })

    it('rejects a missing target ref', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ targetProjectRef: undefined }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('target_ref_missing')
    })

    it('rejects loopback presented as production', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ targetHostname: '127.0.0.1' }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('target_is_loopback')
    })

    it('rejects an already-applied foundation migration', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ appliedMigrationVersions: [LITERATURE_FOUNDATION_MIGRATION.version] }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('pre_application_history_not_empty')
    })

    it('rejects later Literature migration history without the foundation', () => {
      const result = evaluateLiteratureFoundationSelection(
        candidate({ appliedMigrationVersions: ['20260809231651'] }),
      )
      expect(result.approved).toBe(false)
      expect(reasons(result)).toContain('pre_application_history_not_empty')
    })

    it('rejects every prohibited deployment mechanism by name', () => {
      for (const entry of LITERATURE_PROHIBITED_DEPLOYMENT_METHODS) {
        const result = evaluateLiteratureFoundationSelection(
          candidate({ deploymentMethod: entry.method }),
        )
        expect(result.approved).toBe(false)
        expect(reasons(result)).toContain('deployment_method_prohibited')
      }
    })

    it('names supabase db push and explains why bulk push is refused', () => {
      const push = LITERATURE_PROHIBITED_DEPLOYMENT_METHODS.find(
        (entry) => entry.method === 'supabase db push',
      )
      expect(push?.reason).toMatch(/every migration/iu)
    })
  })
})
