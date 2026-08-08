import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const ROOT = process.cwd()
const POSTGRES_IMAGE = 'postgres:17-alpine'
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
const VERIFICATION = '20260808035633_verify_literature_gold_import_compensation_contract.sql'
const CONTAINER = `ip-gold-compensation-${process.pid}-${randomBytes(4).toString('hex')}`
const DATABASE = 'gold_compensation_rehearsal'
const PASSWORD = randomBytes(24).toString('hex')

interface CommandResult {
  stdout: string
  stderr: string
}

function command(commandName: string, arguments_: string[], stdin?: string) {
  return new Promise<CommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(commandName, arguments_, {
      cwd: ROOT,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
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
      rejectPromise(
        new Error(
          `${commandName} ${arguments_.join(' ')} exited with ${code ?? 'unknown'}:\n${stderr || stdout}`,
        ),
      )
    })
    child.stdin.end(stdin)
  })
}

function sha256(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function waitForDatabase() {
  let lastError = ''
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await command('docker', [
      'exec',
      CONTAINER,
      'psql',
      '--no-psqlrc',
      '-U',
      'postgres',
      '-d',
      DATABASE,
      '--tuples-only',
      '--command',
      'select 1',
    ]).catch((error: unknown) => {
      lastError = error instanceof Error ? error.message : String(error)
      return null
    })
    if (result) return
    await new Promise<void>((resolvePromise) => {
      setTimeout(resolvePromise, 250)
    })
  }
  throw new Error(`Disposable PostgreSQL did not become ready. ${lastError}`)
}

async function applySql(label: string, sql: string) {
  const result = await command(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      DATABASE,
    ],
    sql,
  )
  const output = `${result.stdout}\n${result.stderr}`.trim()
  if (output) console.log(`[${label}]\n${output}`)
}

async function main() {
  const files = [
    ...MIGRATIONS.map((migration) => resolve(ROOT, 'supabase/migrations', migration)),
    resolve(ROOT, 'supabase/verification', VERIFICATION),
  ]
  const inputs = await Promise.all(
    files.map(async (path) => ({ path, bytes: await readFile(path) })),
  )
  const inputManifest = inputs.map(({ path, bytes }) => ({
    path: path.slice(ROOT.length + 1),
    sha256: sha256(bytes),
  }))
  const rehearsalSha256 = sha256(
    inputManifest.map(({ path, sha256: digest }) => `${path}\0${digest}\n`).join(''),
  )

  console.log(`Rehearsal input SHA-256: ${rehearsalSha256}`)
  for (const input of inputManifest) console.log(`${input.sha256}  ${input.path}`)

  await command('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    CONTAINER,
    '--env',
    `POSTGRES_PASSWORD=${PASSWORD}`,
    '--env',
    `POSTGRES_DB=${DATABASE}`,
    POSTGRES_IMAGE,
  ])

  try {
    await waitForDatabase()
    await applySql(
      'isolated-prelude',
      `
        create schema if not exists extensions;
        do $roles$
        begin
          if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
          if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
          if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
            create role service_role nologin bypassrls;
          end if;
        end
        $roles$;
      `,
    )
    for (const { path, bytes } of inputs.slice(0, -1)) {
      await applySql(basename(path), bytes.toString('utf8'))
    }
    const verification = inputs.at(-1)
    if (!verification) throw new Error('Verification SQL is missing.')
    await applySql(basename(verification.path), verification.bytes.toString('utf8'))
    console.log(`PASS isolated gold import-compensation rehearsal ${rehearsalSha256}`)
  } finally {
    await command('docker', ['rm', '--force', CONTAINER]).catch(() => null)
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
