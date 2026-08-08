import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const WORKDIR = resolve(ROOT, 'local-data/literature/supabase-local')
const GENERATED_SUPABASE_DIRECTORY = resolve(WORKDIR, 'supabase')
const GENERATED_MIGRATIONS_DIRECTORY = resolve(GENERATED_SUPABASE_DIRECTORY, 'migrations')
const SOURCE_CONFIG = resolve(ROOT, 'supabase/config.toml')
const ENV_FILE = resolve(ROOT, '.env.local')
const LOCAL_PROJECT_ID = 'ip-literature-local'
const MANAGED_ENV_START = '# BEGIN managed local Literature Supabase'
const MANAGED_ENV_END = '# END managed local Literature Supabase'
const MIGRATIONS = [
  '20260727032621_add_literature_explorer.sql',
  '20260727164510_add_literature_gold_set.sql',
  '20260727190000_add_literature_gold_review_categories.sql',
  '20260727193432_add_literature_full_text_categorization_flag.sql',
  '20260728170939_add_interactive_clinical_case_publication_status.sql',
  '20260728171212_add_immune_inflammatory_disease_tag.sql',
  '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  '20260730194025_add_literature_gold_test_unlock.sql',
  '20260808035633_add_literature_gold_import_compensation_contract.sql',
] as const
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

type LocalCommand = 'prepare' | 'start' | 'status' | 'reset' | 'stop'

function usage() {
  return `
Manage the isolated local Supabase stack used only by the Literature Explorer.

Usage:
  npm run literature:local:prepare
  npm run literature:local:start
  npm run literature:local:status
  npm run literature:local:reset
  npm run literature:local:stop

The generated stack lives under local-data/literature/supabase-local and includes only the
canonical literature migrations. Starting or resetting it updates the dedicated
LITERATURE_SUPABASE_* entries in .env.local without changing the site's main Supabase settings.
`.trim()
}

async function ensureSupabaseBinary() {
  const binary = resolve(ROOT, 'node_modules/.bin/supabase')
  await access(binary)
  return binary
}

function redactCliOutput(output: string) {
  return output
    .replaceAll(/eyJ[A-Za-z0-9._-]+/gu, '<redacted-local-key>')
    .replaceAll(
      /(ANON_KEY|PUBLISHABLE_KEY|SECRET_KEY|SERVICE_ROLE_KEY)=("[^"]*"|'[^']*'|\S+)/gu,
      '$1=<redacted-local-key>',
    )
}

async function runSupabase(arguments_: string[]) {
  const binary = await ensureSupabaseBinary()
  return new Promise<{ stderr: string; stdout: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(binary, ['--workdir', WORKDIR, ...arguments_], {
      cwd: ROOT,
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

async function prepareWorkdir() {
  await mkdir(GENERATED_MIGRATIONS_DIRECTORY, { recursive: true })

  const generatedMigrations = (await readdir(GENERATED_MIGRATIONS_DIRECTORY)).filter((name) =>
    name.endsWith('.sql'),
  )
  const unexpectedMigrations = generatedMigrations.filter(
    (name) => !MIGRATIONS.includes(name as (typeof MIGRATIONS)[number]),
  )
  if (unexpectedMigrations.length > 0) {
    throw new Error(
      `Refusing to replace a generated migration directory containing unmanaged files: ${unexpectedMigrations.join(
        ', ',
      )}`,
    )
  }

  const sourceConfig = await readFile(SOURCE_CONFIG, 'utf8')
  const generatedConfig = sourceConfig.replace(
    /^project_id\s*=\s*"[^"]+"/mu,
    `project_id = "${LOCAL_PROJECT_ID}"`,
  )
  await writeFile(resolve(GENERATED_SUPABASE_DIRECTORY, 'config.toml'), generatedConfig, 'utf8')

  for (const migration of MIGRATIONS) {
    await copyFile(
      resolve(ROOT, 'supabase/migrations', migration),
      resolve(GENERATED_MIGRATIONS_DIRECTORY, migration),
    )
  }

  console.log(`Prepared isolated literature migrations in ${WORKDIR}`)
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

async function localStatus() {
  const { stdout } = await runSupabase(['status', '--output', 'env'])
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

async function updateEnvironmentFile(status: Awaited<ReturnType<typeof localStatus>>) {
  const existing = await readFile(ENV_FILE, 'utf8').catch(() => '')
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
  await writeFile(ENV_FILE, updated, 'utf8')
}

async function reportStatus() {
  const status = await localStatus()
  console.log('Local Literature Supabase is running.')
  console.log(`API: ${status.apiUrl}`)
  console.log(`Studio: ${status.studioUrl}`)
  return status
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
  const command = rawCommand as LocalCommand

  if (command === 'prepare') {
    await prepareWorkdir()
    return
  }
  if (command === 'stop') {
    await prepareWorkdir()
    await runSupabase(['stop'])
    console.log('Stopped the isolated local Literature Supabase stack; its data was preserved.')
    return
  }

  await prepareWorkdir()
  if (command === 'start') {
    await runSupabase(['start', '--exclude', EXCLUDED_SERVICES.join(',')])
    await runSupabase(['migration', 'up', '--local'])
    const status = await reportStatus()
    await updateEnvironmentFile(status)
    console.log('Updated the dedicated LITERATURE_SUPABASE_* values in .env.local.')
    console.log('Restart the Next.js development server if it was already running.')
    return
  }
  if (command === 'reset') {
    await runSupabase(['db', 'reset', '--local', '--no-seed', '--yes'])
    const status = await reportStatus()
    await updateEnvironmentFile(status)
    console.log('Reset the isolated literature database and refreshed .env.local.')
    return
  }

  await reportStatus()
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
