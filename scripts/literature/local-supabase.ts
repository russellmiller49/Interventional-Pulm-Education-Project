import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  classifyProtectedV2State,
  collectProtectedV2LedgerEntries,
  defaultLocalLifecycleState,
  type ProtectedMigrationLedgerEntry,
  type ProtectedV2AuthorizationContext,
  type ProtectedV2OperatorAuthorization,
} from './protected-gold-import-contract-v2'

export const ORDINARY_LITERATURE_MIGRATIONS = [
  '20260727032621_add_literature_explorer.sql',
  '20260727164510_add_literature_gold_set.sql',
  '20260727190000_add_literature_gold_review_categories.sql',
  '20260727193432_add_literature_full_text_categorization_flag.sql',
  '20260728170939_add_interactive_clinical_case_publication_status.sql',
  '20260728171212_add_immune_inflammatory_disease_tag.sql',
  '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  '20260730194025_add_literature_gold_test_unlock.sql',
  PROTECTED_GOLD_IMPORT_CONTRACT_V1.filename,
] as const

export const PROTECTED_FORWARD_LITERATURE_MIGRATIONS = [PROTECTED_GOLD_IMPORT_CONTRACT_V2] as const

const ROOT = process.cwd()
const LOCAL_PROJECT_ID = 'ip-literature-local'
const MANAGED_ENV_START = '# BEGIN managed local Literature Supabase'
const MANAGED_ENV_END = '# END managed local Literature Supabase'
const EXCLUDED_SERVICES = [
  'realtime',
  'storage-api',
  'imgproxy',
  'mailpit',
  'edge-runtime',
  'logflare',
  'vector',
  'supavisor',
]

export type LocalCommand = 'prepare' | 'start' | 'status' | 'reset' | 'stop'

export interface LocalSupabasePaths {
  environmentFile: string
  generatedMigrationsDirectory: string
  generatedSupabaseDirectory: string
  root: string
  sourceConfig: string
  sourceMigrationsDirectory: string
  workdir: string
}

export interface LocalSupabaseCommandResult {
  stderr: string
  stdout: string
}

export interface LocalSupabaseDependencies {
  inspectProtectedLedger: () => Promise<ProtectedMigrationLedgerEntry[]>
  log: (message: string) => void
  paths: LocalSupabasePaths
  runSupabase: (arguments_: string[]) => Promise<LocalSupabaseCommandResult>
}

export interface PreparedMigrationInventory {
  protectedMigrationIncluded: boolean
  removedPreviouslyStagedProtectedMigration: boolean
}

export function defaultLocalSupabasePaths(root = ROOT): LocalSupabasePaths {
  const workdir = resolve(root, 'local-data/literature/supabase-local')
  const generatedSupabaseDirectory = resolve(workdir, 'supabase')
  return {
    environmentFile: resolve(root, '.env.local'),
    generatedMigrationsDirectory: resolve(generatedSupabaseDirectory, 'migrations'),
    generatedSupabaseDirectory,
    root,
    sourceConfig: resolve(root, 'supabase/config.toml'),
    sourceMigrationsDirectory: resolve(root, 'supabase/migrations'),
    workdir,
  }
}

function usage() {
  return `
Manage the isolated local Supabase stack used only by the Literature Explorer.

Usage:
  npm run literature:local:prepare
  npm run literature:local:start
  npm run literature:local:status
  npm run literature:local:reset
  npm run literature:local:stop

The generated stack lives under local-data/literature/supabase-local. Ordinary lifecycle commands
keep protected pending migrations unarmed. In particular, contract V2 migration
${PROTECTED_GOLD_IMPORT_CONTRACT_V2.id} remains pending while its ledger occurrence is zero; only
the separately authorized protected-V2 operator command may apply it.
`.trim()
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

function redactCliOutput(output: string) {
  return output
    .replaceAll(/eyJ[A-Za-z0-9._-]+/gu, '<redacted-local-key>')
    .replaceAll(
      /(ANON_KEY|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)=("[^"]*"|'[^']*'|\S+)/gu,
      '$1=<redacted-local-key>',
    )
}

async function ensureSupabaseBinary(paths: LocalSupabasePaths) {
  const binary = resolve(paths.root, 'node_modules/.bin/supabase')
  await access(binary)
  return binary
}

export function createSupabaseRunner(paths: LocalSupabasePaths) {
  return async (arguments_: string[]): Promise<LocalSupabaseCommandResult> => {
    const binary = await ensureSupabaseBinary(paths)
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(binary, ['--workdir', paths.workdir, ...arguments_], {
        cwd: paths.root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk
      })
      child.on('error', rejectPromise)
      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr })
          return
        }
        const detail = redactCliOutput(`${stdout}\n${stderr}`).trim()
        rejectPromise(
          new Error(
            `Supabase CLI exited with code ${code ?? 'unknown'}${detail ? `:\n${detail}` : '.'}`,
          ),
        )
      })
    })
  }
}

async function assertRegularFile(path: string, label: string) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file.`)
}

async function assertProtectedSourceIdentities(paths: LocalSupabasePaths) {
  for (const migration of [PROTECTED_GOLD_IMPORT_CONTRACT_V1, PROTECTED_GOLD_IMPORT_CONTRACT_V2]) {
    const path = resolve(paths.sourceMigrationsDirectory, migration.filename)
    await assertRegularFile(path, `Source migration ${migration.filename}`)
    const actual = sha256(await readFile(path))
    if (actual !== migration.sha256) {
      throw new Error(
        `Source migration checksum mismatch for ${migration.filename}: expected ${migration.sha256}, received ${actual}.`,
      )
    }
  }
}

async function inspectGeneratedSqlFiles(paths: LocalSupabasePaths, createIfMissing: boolean) {
  if (createIfMissing) await mkdir(paths.generatedMigrationsDirectory, { recursive: true })
  const names = (
    await readdir(paths.generatedMigrationsDirectory).catch((error: NodeJS.ErrnoException) => {
      if (!createIfMissing && error.code === 'ENOENT') return []
      throw error
    })
  ).filter((name) => name.endsWith('.sql'))
  const allowed = new Set([
    ...ORDINARY_LITERATURE_MIGRATIONS,
    ...PROTECTED_FORWARD_LITERATURE_MIGRATIONS.map(({ filename }) => filename),
  ])
  const unexpected = names.filter((name) => !allowed.has(name as never))
  if (unexpected.length > 0) {
    throw new Error(
      `Refusing a generated migration directory containing unmanaged or unexpected protected files: ${unexpected.join(', ')}.`,
    )
  }
  const protectedPath = resolve(
    paths.generatedMigrationsDirectory,
    PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename,
  )
  const protectedPresent = names.includes(PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename)
  if (protectedPresent) {
    await assertRegularFile(protectedPath, 'Generated protected V2 migration')
    const actual = sha256(await readFile(protectedPath))
    if (actual !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256) {
      throw new Error(
        `Generated protected V2 checksum mismatch: expected ${PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256}, received ${actual}.`,
      )
    }
  }
  return { names, protectedPath, protectedPresent }
}

export async function inspectGeneratedProtectedMigration(paths: LocalSupabasePaths) {
  await assertProtectedSourceIdentities(paths)
  const inventory = await inspectGeneratedSqlFiles(paths, false)
  return { present: inventory.protectedPresent, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 }
}

async function prepareGeneratedLiteratureMigrationsInternal(input: {
  includeAppliedProtectedV2: boolean
  paths: LocalSupabasePaths
}): Promise<PreparedMigrationInventory> {
  const { paths } = input
  await assertProtectedSourceIdentities(paths)
  const inventory = await inspectGeneratedSqlFiles(paths, true)
  let removedPreviouslyStagedProtectedMigration = false
  if (inventory.protectedPresent && !input.includeAppliedProtectedV2) {
    await unlink(inventory.protectedPath)
    removedPreviouslyStagedProtectedMigration = true
  }

  const sourceConfig = await readFile(paths.sourceConfig, 'utf8')
  const generatedConfig = sourceConfig.replace(
    /^project_id\s*=\s*"[^"]+"/mu,
    `project_id = "${LOCAL_PROJECT_ID}"`,
  )
  await writeFile(resolve(paths.generatedSupabaseDirectory, 'config.toml'), generatedConfig, 'utf8')

  for (const migration of ORDINARY_LITERATURE_MIGRATIONS) {
    await copyFile(
      resolve(paths.sourceMigrationsDirectory, migration),
      resolve(paths.generatedMigrationsDirectory, migration),
    )
  }
  if (input.includeAppliedProtectedV2) {
    await copyFile(
      resolve(paths.sourceMigrationsDirectory, PROTECTED_GOLD_IMPORT_CONTRACT_V2.filename),
      inventory.protectedPath,
    )
    const copiedSha256 = sha256(await readFile(inventory.protectedPath))
    if (copiedSha256 !== PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256) {
      throw new Error('Generated protected V2 copy changed during staging; refusing to continue.')
    }
  }
  return {
    protectedMigrationIncluded: input.includeAppliedProtectedV2,
    removedPreviouslyStagedProtectedMigration,
  }
}

export async function prepareGeneratedLiteratureMigrations(paths: LocalSupabasePaths) {
  return prepareGeneratedLiteratureMigrationsInternal({
    includeAppliedProtectedV2: false,
    paths,
  })
}

export async function restoreAppliedProtectedV2Migration(input: {
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  paths: LocalSupabasePaths
}) {
  const state = classifyProtectedV2State({ ledgerEntries: input.ledgerEntries })
  if (state.kind !== 'v2_applied_exactly_once') {
    throw new Error('Protected V2 generated restoration requires its exact applied ledger state.')
  }
  return prepareGeneratedLiteratureMigrationsInternal({
    includeAppliedProtectedV2: true,
    paths: input.paths,
  })
}

export async function stageAuthorizedProtectedV2Migration(input: {
  authorization: ProtectedV2OperatorAuthorization
  authorizationContext: ProtectedV2AuthorizationContext
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  paths: LocalSupabasePaths
}) {
  const state = classifyProtectedV2State({
    authorization: input.authorization,
    authorizationContext: input.authorizationContext,
    ledgerEntries: input.ledgerEntries,
  })
  if (state.kind !== 'v2_absent_explicitly_armed') {
    throw new Error('Protected V2 staging requires an exact current operator authorization.')
  }
  return prepareGeneratedLiteratureMigrationsInternal({
    includeAppliedProtectedV2: true,
    paths: input.paths,
  })
}

function parseEnvironmentOutput(output: string) {
  const values = new Map<string, string>()
  for (const line of output.split(/\r?\n/u)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u)
    if (!match) continue
    const value = match[2].trim().replace(/^(['"])(.*)\1$/u, '$2')
    values.set(match[1], value)
  }
  return values
}

async function localStatus(dependencies: LocalSupabaseDependencies) {
  const { stdout } = await dependencies.runSupabase(['status', '--output', 'env'])
  const values = parseEnvironmentOutput(stdout)
  const apiUrl = values.get('API_URL')
  const anonKey = values.get('ANON_KEY') ?? values.get('PUBLISHABLE_KEY')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY') ?? values.get('SECRET_KEY')
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error('The local Supabase status did not return the expected API credentials.')
  }
  return {
    anonKey,
    apiUrl,
    serviceRoleKey,
    studioUrl: values.get('STUDIO_URL') ?? 'http://127.0.0.1:55323',
  }
}

async function updateEnvironmentFile(
  paths: LocalSupabasePaths,
  status: Awaited<ReturnType<typeof localStatus>>,
) {
  const existing = await readFile(paths.environmentFile, 'utf8').catch(() => '')
  const managedBlock = [
    MANAGED_ENV_START,
    '# Written by npm run literature:local:start. Local machine only; never commit this file.',
    `LITERATURE_SUPABASE_URL=${status.apiUrl}`,
    `LITERATURE_SUPABASE_ANON_KEY=${status.anonKey}`,
    `LITERATURE_SUPABASE_SERVICE_ROLE_KEY=${status.serviceRoleKey}`,
    MANAGED_ENV_END,
  ].join('\n')
  const managedPattern = new RegExp(
    `${MANAGED_ENV_START.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')}[\\s\\S]*?${MANAGED_ENV_END.replaceAll(
      /[.*+?^${}()|[\]\\]/gu,
      '\\$&',
    )}`,
    'u',
  )
  const updated = managedPattern.test(existing)
    ? existing.replace(managedPattern, managedBlock)
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${managedBlock}\n`
  await writeFile(paths.environmentFile, updated, 'utf8')
}

async function reportStatus(dependencies: LocalSupabaseDependencies) {
  const status = await localStatus(dependencies)
  dependencies.log('Local Literature Supabase is running.')
  dependencies.log(`API: ${status.apiUrl}`)
  dependencies.log(`Studio: ${status.studioUrl}`)
  return status
}

function assertUsableState(entries: readonly ProtectedMigrationLedgerEntry[]) {
  const state = defaultLocalLifecycleState(entries)
  if (state.kind === 'v2_drifted_or_ambiguous') throw new Error(state.ledger.reason)
  return state
}

function pendingMessage() {
  return `Protected contract V2 remains pending and unarmed (${PROTECTED_GOLD_IMPORT_CONTRACT_V2.id}); routine local lifecycle commands cannot apply it.`
}

export async function runLocalSupabaseCommand(
  command: LocalCommand,
  dependencies: LocalSupabaseDependencies,
) {
  const { log, paths, runSupabase } = dependencies
  if (command === 'prepare') {
    const prepared = await prepareGeneratedLiteratureMigrations(paths)
    log(`Prepared ordinary isolated literature migrations in ${paths.workdir}.`)
    if (prepared.removedPreviouslyStagedProtectedMigration) {
      log(
        'Removed the exact previously staged protected V2 generated copy; source bytes were untouched.',
      )
    }
    log(pendingMessage())
    return { prepared, protectedState: 'v2_absent_unarmed' as const }
  }
  if (command === 'stop') {
    await runSupabase(['stop'])
    log('Stopped the isolated local Literature Supabase stack; its data was preserved.')
    log('Stop did not prepare or change the generated migration inventory.')
    return { protectedState: 'not_inspected' as const }
  }
  if (command === 'status') {
    const status = await reportStatus(dependencies)
    const state = assertUsableState(await dependencies.inspectProtectedLedger())
    await inspectGeneratedProtectedMigration(paths)
    log(
      state.kind === 'v2_applied_exactly_once'
        ? 'Protected contract V2 is recorded exactly once; status made no file or database changes.'
        : `${pendingMessage()} Status made no file or database changes.`,
    )
    return { protectedState: state.kind, status }
  }
  if (command === 'reset') {
    const state = assertUsableState(await dependencies.inspectProtectedLedger())
    if (state.kind === 'v2_applied_exactly_once') {
      throw new Error(
        'Routine reset is blocked after protected V2 application; use a separately reviewed protected reset workflow so the applied boundary cannot be silently downgraded or replayed.',
      )
    }
    const prepared = await prepareGeneratedLiteratureMigrations(paths)
    await runSupabase(['db', 'reset', '--local', '--no-seed', '--yes'])
    const status = await reportStatus(dependencies)
    await updateEnvironmentFile(paths, status)
    log('Reset the isolated literature database only through the ordinary V1 boundary.')
    log(pendingMessage())
    return { prepared, protectedState: state.kind, status }
  }

  // First-start initialization receives only the ordinary inventory. This ordering is deliberate:
  // a new container cannot see protected V2 before a ledger state exists to authenticate it.
  const initialPreparation = await prepareGeneratedLiteratureMigrations(paths)
  await runSupabase(['start', '--exclude', EXCLUDED_SERVICES.join(',')])
  const ledgerEntries = await dependencies.inspectProtectedLedger()
  const state = assertUsableState(ledgerEntries)
  if (state.kind === 'v2_applied_exactly_once') {
    await restoreAppliedProtectedV2Migration({ ledgerEntries, paths })
    log('Restored the exact protected V2 generated copy to match its already-applied ledger row.')
  } else {
    const inventory = await inspectGeneratedProtectedMigration(paths)
    if (inventory.present) {
      throw new Error('Unarmed ordinary start unexpectedly exposed protected V2 to migration-up.')
    }
  }
  await runSupabase(['migration', 'up', '--local'])
  const status = await reportStatus(dependencies)
  await updateEnvironmentFile(paths, status)
  log('Updated the dedicated LITERATURE_SUPABASE_* values in .env.local.')
  log('Restart the Next.js development server if it was already running.')
  if (state.kind === 'v2_applied_exactly_once') {
    log(
      'Protected contract V2 was already applied exactly once; ordinary start did not reapply it.',
    )
  } else {
    log(pendingMessage())
  }
  return { initialPreparation, protectedState: state.kind, status }
}

export function createDefaultLocalSupabaseDependencies(
  paths = defaultLocalSupabasePaths(),
): LocalSupabaseDependencies {
  return {
    inspectProtectedLedger: () => collectProtectedV2LedgerEntries(),
    log: console.log,
    paths,
    runSupabase: createSupabaseRunner(paths),
  }
}

async function main() {
  const rawCommand = process.argv[2] ?? 'status'
  if (rawCommand === '--help' || rawCommand === '-h' || rawCommand === 'help') {
    console.log(usage())
    return
  }
  if (!['prepare', 'start', 'status', 'reset', 'stop'].includes(rawCommand)) {
    throw new Error(`Unknown local Supabase command: ${rawCommand}\n\n${usage()}`)
  }
  await runLocalSupabaseCommand(
    rawCommand as LocalCommand,
    createDefaultLocalSupabaseDependencies(),
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
