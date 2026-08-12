import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertExclusiveOutputDirectoryIdentity,
  createExclusiveOutputDirectory,
  writeExclusiveOutputFiles,
} from './lib/exclusive-output'
import { assertKnownArguments, parseCliArguments } from './lib/cli'
import {
  SHADOW_RD_CORPUS_INVENTORY_SQL,
  assertShadowRdCorpusInventorySqlBoundary,
  parseShadowRdCorpusInventoryQueryOutput,
  renderShadowRdCorpusInventoryMarkdown,
  serializeShadowRdCorpusInventoryJson,
} from './shadow-rd-corpus-inventory-contract'

export const SHADOW_RD_CORPUS_INVENTORY_USAGE = `Usage:
  npm run literature:shadow-rd:inventory

This development-only command accepts no scope, target, queue, split, PMID, or output arguments.
It reads aggregate values from the fixed local Literature Supabase container in one repeatable-read,
read-only transaction, rolls back, and creates a JSON/Markdown pair under the fixed ignored output
root local-data/literature/shadow-rd-results.
` as const

export const SHADOW_RD_CORPUS_INVENTORY_BRANCH =
  'codex/ip-literature-autonomous-shadow-rd-v1' as const
export const SHADOW_RD_CORPUS_INVENTORY_OUTPUT_ROOT =
  'local-data/literature/shadow-rd-results' as const
export const SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT = 'default' as const
export const SHADOW_RD_CORPUS_INVENTORY_DATABASE_CONTAINER =
  'supabase_db_ip-literature-local' as const
export const SHADOW_RD_CORPUS_INVENTORY_PROJECT_ID = 'ip-literature-local' as const
export const SHADOW_RD_CORPUS_INVENTORY_DATABASE_PORT = '55322' as const

const DOCKER_CONTEXT_INSPECT_ARGUMENTS = [
  '--context',
  SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT,
  'context',
  'inspect',
  SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT,
  '--format',
  '{{json .Endpoints.docker.Host}}',
] as const

const DATABASE_CONTAINER_INSPECT_ARGUMENTS = [
  '--context',
  SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT,
  'inspect',
  '--format',
  '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}|{{index .Config.Labels "com.supabase.cli.project"}}',
  SHADOW_RD_CORPUS_INVENTORY_DATABASE_CONTAINER,
] as const

const FIXED_LOCAL_PSQL_ARGUMENTS = [
  '--context',
  SHADOW_RD_CORPUS_INVENTORY_DOCKER_CONTEXT,
  'exec',
  '--interactive',
  SHADOW_RD_CORPUS_INVENTORY_DATABASE_CONTAINER,
  'psql',
  '--no-psqlrc',
  '--set',
  'ON_ERROR_STOP=1',
  '--username',
  'postgres',
  '--dbname',
  'postgres',
  '--host',
  '/var/run/postgresql',
  '--port',
  '5432',
  '--tuples-only',
  '--no-align',
  '--quiet',
] as const

const OPERATIONAL_ENVIRONMENT_PATTERN =
  /^(?:DOCKER|CONTAINER|SUPABASE|PG|POSTGRES|DATABASE(?:_|$)|DB_)/iu
const COMMITTED_RUNTIME_PATHS = [
  'config/literature/pubmed-query-registry.v1.json',
  'package.json',
  'scripts/literature/collect-shadow-rd-corpus-inventory.ts',
  'scripts/literature/lib/cli.ts',
  'scripts/literature/lib/exclusive-output.ts',
  'scripts/literature/shadow-rd-corpus-inventory-contract.ts',
] as const

interface CommandResult {
  stderr: string
  stdout: string
}

export function validateShadowRdCorpusInventoryCliArguments(argv: readonly string[]): {
  help: boolean
} {
  const arguments_ = parseCliArguments([...argv])
  assertKnownArguments(arguments_, ['help'])
  if (arguments_.values.has('help')) throw new Error('--help does not accept a value.')
  if (arguments_.flags.size > 1 || (arguments_.flags.has('help') && argv.length !== 1)) {
    throw new Error('Corpus inventory accepts only a standalone --help flag or no arguments.')
  }
  return { help: arguments_.flags.has('help') }
}

function fixedOperationalEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !OPERATIONAL_ENVIRONMENT_PATTERN.test(name)),
  ) as NodeJS.ProcessEnv
}

function executeCommand(input: {
  arguments: readonly string[]
  command: 'docker' | 'git'
  cwd: string
  environment?: NodeJS.ProcessEnv
  stdin?: string
}): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(input.command, [...input.arguments], {
      cwd: input.cwd,
      env: input.environment ?? process.env,
      shell: false,
      stdio: [input.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const stdoutStream = child.stdout
    const stderrStream = child.stderr
    const stdinStream = child.stdin
    if (!stdoutStream || !stderrStream) {
      rejectPromise(new Error(`${input.command} did not expose its expected output streams.`))
      return
    }
    stdoutStream.setEncoding('utf8')
    stderrStream.setEncoding('utf8')
    stdoutStream.on('data', (chunk: string) => {
      stdout += chunk
    })
    stderrStream.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(
          new Error(
            `${input.command} exited with code ${String(code)}${
              stderr.trim() ? `: ${stderr.trim()}` : '.'
            }`,
          ),
        )
        return
      }
      resolvePromise({ stderr, stdout })
    })
    if (input.stdin !== undefined) {
      if (!stdinStream) {
        rejectPromise(new Error(`${input.command} did not expose its expected input stream.`))
        return
      }
      stdinStream.end(input.stdin)
    }
  })
}

async function git(cwd: string, arguments_: readonly string[]): Promise<string> {
  return (
    await executeCommand({
      arguments: arguments_,
      command: 'git',
      cwd,
    })
  ).stdout.trim()
}

async function assertProductionRepositoryAndEntrypoint(): Promise<string> {
  const cwd = await realpath(resolve(process.cwd()))
  const invokedPath = process.argv[1] ? await realpath(resolve(process.argv[1])) : null
  const canonicalModulePath = fileURLToPath(import.meta.url)
  if (
    invokedPath !== canonicalModulePath ||
    canonicalModulePath !== resolve(cwd, 'scripts/literature/collect-shadow-rd-corpus-inventory.ts')
  ) {
    throw new Error(
      'Corpus inventory execution requires the canonical module inside the current checkout.',
    )
  }
  const [root, branch, status, head, upstreamHead, upstreamRef] = await Promise.all([
    git(cwd, ['rev-parse', '--show-toplevel']),
    git(cwd, ['branch', '--show-current']),
    git(cwd, ['status', '--porcelain=v1', '--untracked-files=all']),
    git(cwd, ['rev-parse', 'HEAD']),
    git(cwd, ['rev-parse', '@{upstream}']),
    git(cwd, ['rev-parse', '--symbolic-full-name', '@{upstream}']),
  ])
  if (
    (await realpath(root)) !== cwd ||
    branch !== SHADOW_RD_CORPUS_INVENTORY_BRANCH ||
    upstreamRef !== `refs/remotes/origin/${SHADOW_RD_CORPUS_INVENTORY_BRANCH}` ||
    status !== '' ||
    !/^[a-f0-9]{40}$/u.test(head) ||
    head !== upstreamHead
  ) {
    throw new Error(
      'Corpus inventory requires the exact clean pushed Track B branch with HEAD equal to its origin upstream.',
    )
  }
  return cwd
}

async function assertExactCommittedRuntimeSources(cwd: string): Promise<void> {
  for (const path of COMMITTED_RUNTIME_PATHS) {
    const [workingTreeBlob, committedBlob] = await Promise.all([
      git(cwd, ['hash-object', '--', path]),
      git(cwd, ['rev-parse', `HEAD:${path}`]),
    ])
    if (!/^[a-f0-9]{40}$/u.test(workingTreeBlob) || workingTreeBlob !== committedBlob) {
      throw new Error(`Corpus inventory runtime source is not the exact committed blob: ${path}`)
    }
  }
}

async function executeFixedDocker(
  arguments_: readonly string[],
  cwd: string,
): Promise<CommandResult> {
  return executeCommand({
    arguments: arguments_,
    command: 'docker',
    cwd,
    environment: fixedOperationalEnvironment(),
  })
}

async function assertFixedLocalDockerTarget(cwd: string): Promise<void> {
  const context = (await executeFixedDocker(DOCKER_CONTEXT_INSPECT_ARGUMENTS, cwd)).stdout.trim()
  let endpoint: unknown
  try {
    endpoint = JSON.parse(context) as unknown
  } catch {
    throw new Error('Fixed Docker context endpoint could not be parsed.')
  }
  if (
    typeof endpoint !== 'string' ||
    (!endpoint.startsWith('unix:///') && !endpoint.startsWith('npipe://'))
  ) {
    throw new Error('Fixed Docker context does not resolve to a local socket endpoint.')
  }
  const databaseIdentity = (
    await executeFixedDocker(DATABASE_CONTAINER_INSPECT_ARGUMENTS, cwd)
  ).stdout.trim()
  const expectedIdentity = `/${SHADOW_RD_CORPUS_INVENTORY_DATABASE_CONTAINER}|true|${SHADOW_RD_CORPUS_INVENTORY_DATABASE_PORT}|${SHADOW_RD_CORPUS_INVENTORY_PROJECT_ID}`
  if (databaseIdentity !== expectedIdentity) {
    throw new Error('Fixed local Literature Supabase container identity or health check failed.')
  }
}

async function executeFixedLocalAggregateQuery(cwd: string): Promise<string> {
  assertShadowRdCorpusInventorySqlBoundary(SHADOW_RD_CORPUS_INVENTORY_SQL)
  const result = await executeCommand({
    arguments: FIXED_LOCAL_PSQL_ARGUMENTS,
    command: 'docker',
    cwd,
    environment: fixedOperationalEnvironment(),
    stdin: SHADOW_RD_CORPUS_INVENTORY_SQL,
  })
  return result.stdout
}

async function assertCanonicalDirectory(path: string, label: string): Promise<void> {
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
    throw new Error(`${label} must be a canonical non-symlink directory.`)
  }
}

async function ensureCanonicalDirectory(path: string, label: string): Promise<void> {
  try {
    await mkdir(path, { mode: 0o700, recursive: false })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
  }
  await assertCanonicalDirectory(path, label)
}

async function ensureFixedOutputRoot(cwd: string): Promise<string> {
  const localDataRoot = resolve(cwd, 'local-data')
  await ensureCanonicalDirectory(localDataRoot, 'Local-data root')
  const literatureRoot = resolve(cwd, 'local-data/literature')
  await ensureCanonicalDirectory(literatureRoot, 'Literature local-data root')
  const outputRoot = resolve(cwd, SHADOW_RD_CORPUS_INVENTORY_OUTPUT_ROOT)
  await ensureCanonicalDirectory(outputRoot, 'Shadow-R&D result root')
  return outputRoot
}

function outputDirectoryName(capturedAt: string): string {
  return `corpus-inventory-${capturedAt.replaceAll(/[^0-9]/gu, '')}-${randomUUID()}`
}

async function runProductionCorpusInventory(): Promise<void> {
  const cli = validateShadowRdCorpusInventoryCliArguments(process.argv.slice(2))
  if (cli.help) {
    console.log(SHADOW_RD_CORPUS_INVENTORY_USAGE)
    return
  }

  const cwd = await assertProductionRepositoryAndEntrypoint()
  await assertExactCommittedRuntimeSources(cwd)
  await assertFixedLocalDockerTarget(cwd)
  const artifact = parseShadowRdCorpusInventoryQueryOutput(
    await executeFixedLocalAggregateQuery(cwd),
  )
  await assertFixedLocalDockerTarget(cwd)
  const finalCwd = await assertProductionRepositoryAndEntrypoint()
  if (finalCwd !== cwd) throw new Error('Corpus inventory checkout identity changed during query.')
  await assertExactCommittedRuntimeSources(cwd)

  const outputRoot = await ensureFixedOutputRoot(cwd)
  const outputDirectory = resolve(outputRoot, outputDirectoryName(artifact.capturedAt))
  const identity = await createExclusiveOutputDirectory({ outputDirectory, outputRoot })
  await assertExclusiveOutputDirectoryIdentity(identity)
  writeExclusiveOutputFiles(identity, [
    {
      bytes: Buffer.from(serializeShadowRdCorpusInventoryJson(artifact), 'utf8'),
      name: 'corpus-inventory.json',
    },
    {
      bytes: Buffer.from(renderShadowRdCorpusInventoryMarkdown(artifact), 'utf8'),
      name: 'corpus-inventory.md',
    },
  ])
  await assertExclusiveOutputDirectoryIdentity(identity)
  console.log(`Corpus inventory JSON: ${resolve(outputDirectory, 'corpus-inventory.json')}`)
  console.log(`Corpus inventory Markdown: ${resolve(outputDirectory, 'corpus-inventory.md')}`)
  console.log('Database mutations: 0')
  console.log('Sealed evaluation identities accessed: false')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runProductionCorpusInventory().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
