import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { mkdtemp } from 'node:fs/promises'

import {
  ORDINARY_LITERATURE_MIGRATIONS,
  PROTECTED_FORWARD_LITERATURE_MIGRATIONS,
  defaultLocalSupabasePaths,
  prepareGeneratedLiteratureMigrations,
  runLocalSupabaseCommand,
  type LocalSupabaseCommandResult,
  type LocalSupabaseDependencies,
  type LocalSupabasePaths,
} from './local-supabase'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  classifyProtectedV2Ledger,
  type ProtectedMigrationLedgerEntry,
} from './protected-gold-import-contract-v2'

const STARTING_HEAD = '014359f8fe0b32046d137ecc027996cd2f6cb6f4'
const STATUS_OUTPUT = [
  'API_URL=http://127.0.0.1:55321',
  'ANON_KEY=local-anon',
  'SERVICE_ROLE_KEY=local-service',
  'STUDIO_URL=http://127.0.0.1:55323',
  '',
].join('\n')

interface Fixture {
  cleanup: () => Promise<void>
  paths: LocalSupabasePaths
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(resolve(tmpdir(), 'literature-protected-v2-'))
  const paths = defaultLocalSupabasePaths(root)
  await mkdir(paths.sourceMigrationsDirectory, { recursive: true })
  await mkdir(resolve(root, 'supabase'), { recursive: true })
  await writeFile(paths.sourceConfig, 'project_id = "source-project"\n', 'utf8')
  for (const migration of [
    ...ORDINARY_LITERATURE_MIGRATIONS,
    ...PROTECTED_FORWARD_LITERATURE_MIGRATIONS.map(({ filename }) => filename),
  ]) {
    await copyFile(
      resolve(process.cwd(), 'supabase/migrations', migration),
      resolve(paths.sourceMigrationsDirectory, migration),
    )
  }
  return { cleanup: () => rm(root, { force: true, recursive: true }), paths }
}

async function generatedSql(paths: LocalSupabasePaths) {
  return (await readdir(paths.generatedMigrationsDirectory).catch(() => []))
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function exactAppliedLedger(): ProtectedMigrationLedgerEntry[] {
  return [
    {
      name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
      version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
    },
  ]
}

function dependencies(input: {
  ledger?: ProtectedMigrationLedgerEntry[]
  onRun?: (arguments_: string[]) => Promise<void> | void
  paths: LocalSupabasePaths
}) {
  const calls: string[][] = []
  const logs: string[] = []
  const value: LocalSupabaseDependencies = {
    inspectProtectedLedger: async () => input.ledger ?? [],
    log: (message) => logs.push(message),
    paths: input.paths,
    runSupabase: async (arguments_): Promise<LocalSupabaseCommandResult> => {
      calls.push(arguments_)
      await input.onRun?.(arguments_)
      return { stderr: '', stdout: arguments_[0] === 'status' ? STATUS_OUTPUT : '' }
    },
  }
  return { calls, dependencies: value, logs }
}

describe('protected V2 local Supabase lifecycle', () => {
  let cleanups: Array<() => Promise<void>> = []

  afterEach(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
    cleanups = []
  })

  it('reproduces the starting-HEAD hazard without Docker or a database', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const legacyDefaultMigrations = [
      ...ORDINARY_LITERATURE_MIGRATIONS,
      PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
    ]
    await mkdir(current.paths.generatedMigrationsDirectory, { recursive: true })
    for (const migration of legacyDefaultMigrations) {
      await copyFile(
        resolve(current.paths.sourceMigrationsDirectory, migration),
        resolve(current.paths.generatedMigrationsDirectory, migration),
      )
    }
    const fakeCommands = [
      ['start', '--exclude', '...'],
      ['migration', 'up', '--local'],
    ]

    expect(STARTING_HEAD).toBe('014359f8fe0b32046d137ecc027996cd2f6cb6f4')
    expect(await generatedSql(current.paths)).toContain(PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename)
    expect(fakeCommands).toContainEqual(['migration', 'up', '--local'])
    expect(classifyProtectedV2Ledger([]).kind).toBe('v2_absent')
  })

  it('ordinary prepare excludes V2 and safely disarms an exact previously staged copy', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    await mkdir(current.paths.generatedMigrationsDirectory, { recursive: true })
    await copyFile(
      resolve(current.paths.sourceMigrationsDirectory, PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename),
      resolve(
        current.paths.generatedMigrationsDirectory,
        PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
      ),
    )
    const result = await prepareGeneratedLiteratureMigrations(current.paths)
    expect(result).toEqual({
      protectedMigrationIncluded: false,
      removedPreviouslyStagedProtectedMigration: true,
    })
    expect(await generatedSql(current.paths)).toEqual([...ORDINARY_LITERATURE_MIGRATIONS].sort())
  })

  it('ordinary start keeps first-start and migration-up unable to see absent V2', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const inventories: Array<{ command: string; files: string[] }> = []
    const fake = dependencies({
      onRun: async (arguments_) => {
        inventories.push({
          command: arguments_.join(' '),
          files: await generatedSql(current.paths),
        })
      },
      paths: current.paths,
    })
    const result = await runLocalSupabaseCommand('start', fake.dependencies)
    expect(result.protectedState).toBe('v2_absent_unarmed')
    expect(inventories.find(({ command }) => command.startsWith('start '))?.files).not.toContain(
      PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
    )
    expect(
      inventories.find(({ command }) => command === 'migration up --local')?.files,
    ).not.toContain(PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename)
    expect(fake.calls).toContainEqual(['migration', 'up', '--local'])
    expect(fake.logs.join('\n')).toContain('remains pending and unarmed')
  })

  it('status is file-observational and never invokes migration-up', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const fake = dependencies({ paths: current.paths })
    const before = await readdir(resolve(current.paths.root, 'supabase'))
    await runLocalSupabaseCommand('status', fake.dependencies)
    const after = await readdir(resolve(current.paths.root, 'supabase'))
    expect(after).toEqual(before)
    expect(fake.calls).toEqual([['status', '--output', 'env']])
    await expect(readdir(current.paths.generatedMigrationsDirectory)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('stop neither prepares nor stages a migration', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const fake = dependencies({ paths: current.paths })
    await runLocalSupabaseCommand('stop', fake.dependencies)
    expect(fake.calls).toEqual([['stop']])
    await expect(readdir(current.paths.generatedMigrationsDirectory)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('reset stays at the ordinary boundary and cannot silently introduce V2', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const snapshots: string[][] = []
    const fake = dependencies({
      onRun: async (arguments_) => {
        if (arguments_[0] === 'db') snapshots.push(await generatedSql(current.paths))
      },
      paths: current.paths,
    })
    await runLocalSupabaseCommand('reset', fake.dependencies)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).not.toContain(PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename)
    expect(fake.calls).toContainEqual(['db', 'reset', '--local', '--no-seed', '--yes'])
  })

  it('blocks routine reset once V2 has been applied', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const fake = dependencies({ ledger: exactAppliedLedger(), paths: current.paths })
    await expect(runLocalSupabaseCommand('reset', fake.dependencies)).rejects.toThrow(
      'Routine reset is blocked',
    )
    expect(fake.calls).toEqual([])
  })

  it('fails closed on a staged protected file with a wrong checksum', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    await mkdir(current.paths.generatedMigrationsDirectory, { recursive: true })
    await writeFile(
      resolve(
        current.paths.generatedMigrationsDirectory,
        PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
      ),
      '-- tampered\n',
      'utf8',
    )
    await expect(prepareGeneratedLiteratureMigrations(current.paths)).rejects.toThrow(
      'Generated protected V2 checksum mismatch',
    )
  })

  it('fails closed on duplicated and wrong-pairing ledger identities', () => {
    expect(classifyProtectedV2Ledger([...exactAppliedLedger(), ...exactAppliedLedger()]).kind).toBe(
      'v2_drifted_or_ambiguous',
    )
    expect(
      classifyProtectedV2Ledger([
        {
          name: 'wrong_name',
          version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
        },
      ]).kind,
    ).toBe('v2_drifted_or_ambiguous')
    expect(
      classifyProtectedV2Ledger([
        {
          name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
          version: '20260809231650',
        },
      ]).kind,
    ).toBe('v2_drifted_or_ambiguous')
  })

  it('allows ordinary start after exact application and restores a missing exact generated copy', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    const inventories: Array<{ command: string; files: string[] }> = []
    const fake = dependencies({
      ledger: exactAppliedLedger(),
      onRun: async (arguments_) => {
        inventories.push({
          command: arguments_.join(' '),
          files: await generatedSql(current.paths),
        })
      },
      paths: current.paths,
    })
    const result = await runLocalSupabaseCommand('start', fake.dependencies)
    expect(result.protectedState).toBe('v2_applied_exactly_once')
    expect(inventories.find(({ command }) => command.startsWith('start '))?.files).not.toContain(
      PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
    )
    expect(inventories.find(({ command }) => command === 'migration up --local')?.files).toContain(
      PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
    )
    expect(
      await readFile(
        resolve(
          current.paths.generatedMigrationsDirectory,
          PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
        ),
      ),
    ).toEqual(
      await readFile(
        resolve(
          current.paths.sourceMigrationsDirectory,
          PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
        ),
      ),
    )
  })

  it('rejects an unexpected generated migration before ordinary startup', async () => {
    const current = await fixture()
    cleanups.push(current.cleanup)
    await mkdir(current.paths.generatedMigrationsDirectory, { recursive: true })
    await writeFile(
      resolve(current.paths.generatedMigrationsDirectory, '20260810000000_unexpected.sql'),
      'select 1;\n',
      'utf8',
    )
    const fake = dependencies({ paths: current.paths })
    await expect(runLocalSupabaseCommand('start', fake.dependencies)).rejects.toThrow(
      'unmanaged or unexpected protected files',
    )
    expect(fake.calls).toEqual([])
  })
})
