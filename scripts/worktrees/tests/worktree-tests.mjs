import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, test } from 'node:test'
import {
  WtError,
  acquireLease,
  canonicalLeaseResource,
  diffNameStatus,
  ensureCommonExclude,
  ensureGuardContext,
  globToRegExp,
  git,
  leaseOwnedForResource,
  loadRegistry,
  matchesPattern,
  normalizeRepoPath,
  orphanWorktreeDirectories,
  parseTaskBranch,
  processSnapshot,
  provisionMounts,
  releaseLease,
  removeDisposableWorktree,
  scopeReport,
  validateMounts,
  validateProcessRecord,
  worktreeExcludeRules,
  writeWorktreeState,
} from '../lib.mjs'
import { doctorSnapshot } from '../worktree.mjs'

const repositoryRoot = new URL('../../../', import.meta.url).pathname
const registry = loadRegistry(repositoryRoot)
const temporaryPaths = []

function temporaryDirectory() {
  const pathname = mkdtempSync(join(tmpdir(), 'wt-isolation-test-'))
  temporaryPaths.push(pathname)
  return pathname
}

function context(commonDir, suffix, module = 'platform') {
  return {
    role: 'active',
    agent: 'codex',
    module,
    branch: `codex/${module}/${suffix}`,
    detached: false,
    topLevel: join(commonDir, suffix),
    commonDir,
    gitDir: join(commonDir, '.git', suffix),
  }
}

async function availablePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  server.close()
  await once(server, 'close')
  assert.ok(port)
  return port
}

async function waitFor(predicate, message, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = predicate()
    if (value) return value
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
  }
  assert.fail(message)
}

function createDevFixture(port) {
  const root = temporaryDirectory()
  const repository = join(root, 'repository')
  const registryDirectory = join(repository, 'config', 'worktrees')
  const nextDirectory = join(repository, 'node_modules', 'next', 'dist', 'bin')
  const externalEnvironment = join(root, 'external.env')
  const localConfigPath = join(root, 'worktrees.local.json')
  const worktreesRoot = join(root, 'worktrees')
  mkdirSync(registryDirectory, { recursive: true })
  mkdirSync(nextDirectory, { recursive: true })
  mkdirSync(worktreesRoot)
  writeFileSync(
    join(registryDirectory, 'modules.json'),
    readFileSync(join(repositoryRoot, 'config', 'worktrees', 'modules.json')),
  )
  writeFileSync(join(repository, 'README.md'), 'dev lifecycle fixture\n')
  writeFileSync(externalEnvironment, 'EXAMPLE=value\n', { mode: 0o400 })
  chmodSync(externalEnvironment, 0o400)
  writeFileSync(
    localConfigPath,
    `${JSON.stringify({
      version: 1,
      worktreesRoot,
      controlCheckout: repository,
      maxProvisionedWorktrees: 5,
      inputs: { environment: externalEnvironment },
    })}\n`,
  )
  writeFileSync(
    join(nextDirectory, 'next'),
    `const { spawn } = require('node:child_process')
const { join } = require('node:path')
const child = spawn(process.execPath, [join(__dirname, 'next-server'), ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
})
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal))
}
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
`,
  )
  writeFileSync(
    join(nextDirectory, 'next-server'),
    `const { createServer } = require('node:net')
const portIndex = process.argv.indexOf('--port')
const port = Number(process.argv[portIndex + 1])
const startupDelay = Number(process.env.WT_TEST_START_DELAY || 0)
const shutdownDelay = Number(process.env.WT_TEST_SHUTDOWN_DELAY || 0)
let server = null
let startupTimer = setTimeout(() => {
  server = createServer((socket) => socket.end('ok'))
  server.listen(port, '127.0.0.1')
}, startupDelay)
const shutdown = () => {
  clearTimeout(startupTimer)
  if (!server) {
    process.exit(0)
    return
  }
  setTimeout(() => server.close(() => process.exit(0)), shutdownDelay)
}
for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) process.once(signal, shutdown)
`,
  )
  git(repository, ['init', '-b', 'main'])
  git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
  git(repository, ['config', 'user.name', 'Worktree Tests'])
  git(repository, ['add', 'README.md', 'config/worktrees/modules.json'])
  git(repository, ['commit', '-m', 'base'])
  git(repository, ['switch', '-c', 'codex/platform/dev-lifecycle'])
  git(repository, ['config', 'worktree.localConfigPath', localConfigPath])
  writeWorktreeState(join(repository, '.git'), {
    schemaVersion: 1,
    role: 'temporary',
    agent: 'codex',
    module: 'platform',
    task: 'dev-lifecycle',
    branch: 'codex/platform/dev-lifecycle',
    port,
    worktree: repository,
    base: 'origin/main',
    inputProfile: 'environment',
    acknowledgements: [],
    createdAt: new Date().toISOString(),
  })
  return {
    repository,
    localConfigPath,
    processRecord: join(repository, '.git', 'wt', 'processes', `port-${port}.json`),
  }
}

afterEach(() => {
  for (const pathname of temporaryPaths.splice(0)) {
    rmSync(pathname, { recursive: true, force: true })
  }
})

describe('registry and branch contracts', () => {
  test('doctor reports an unregistered control checkout without a module instead of throwing', () => {
    const root = temporaryDirectory()
    const repository = join(root, 'repository')
    const registryDirectory = join(repository, 'config', 'worktrees')
    const inputsDirectory = join(root, 'inputs')
    const worktreesRoot = join(root, 'worktrees')
    const localConfigPath = join(root, 'worktrees.local.json')
    const excludePath = join(root, 'control.exclude')
    mkdirSync(registryDirectory, { recursive: true })
    mkdirSync(inputsDirectory)
    mkdirSync(worktreesRoot)
    writeFileSync(
      join(registryDirectory, 'modules.json'),
      readFileSync(join(repositoryRoot, 'config', 'worktrees', 'modules.json')),
    )
    writeFileSync(join(repository, 'README.md'), 'test repository\n')
    writeFileSync(excludePath, '# local excludes\n')
    const inputs = {}
    for (const inputName of Object.keys(registry.inputMountTargets)) {
      const source = join(inputsDirectory, inputName)
      writeFileSync(source, `${inputName}\n`, { mode: 0o400 })
      chmodSync(source, 0o400)
      inputs[inputName] = source
    }
    writeFileSync(
      localConfigPath,
      `${JSON.stringify({
        version: 1,
        worktreesRoot,
        controlCheckout: repository,
        maxProvisionedWorktrees: 5,
        inputs,
      })}\n`,
    )
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Worktree Tests'])
    git(repository, ['add', 'README.md', 'config/worktrees/modules.json'])
    git(repository, ['commit', '-m', 'base'])
    git(repository, ['config', 'extensions.worktreeConfig', 'true'])
    git(repository, ['config', '--worktree', 'core.excludesFile', excludePath])
    git(repository, ['config', 'worktree.localConfigPath', localConfigPath])
    const liveProcess = processSnapshot(process.pid)
    assert.ok(liveProcess)
    const processDirectory = join(repository, '.git', 'wt', 'processes')
    mkdirSync(processDirectory, { recursive: true })
    writeFileSync(
      join(processDirectory, 'port-3130.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        status: 'starting',
        pid: liveProcess.pid,
        processStartTime: liveProcess.startTime,
        command: liveProcess.command,
        expectedCommand: liveProcess.command,
        worktree: repository,
        branch: 'main',
        port: 3130,
        leaseCreationTime: new Date().toISOString(),
      })}\n`,
    )

    const snapshot = doctorSnapshot(repository)

    assert.equal(snapshot.ok, false)
    assert.ok(snapshot.findings.some((finding) => finding.code === 'WT-DOCTOR-UNREGISTERED'))
    assert.ok(snapshot.findings.some((finding) => finding.code === 'WT-DOCTOR-PROCESS-STARTING'))
    assert.equal(
      snapshot.findings.some((finding) => finding.code === 'WT-DOCTOR-WRONG-PORT'),
      false,
    )
  })

  test('contains exactly the 35 learner modules and a separate platform scope', () => {
    assert.equal(registry.modules.length, 35)
    assert.equal(
      registry.modules.some((module) => module.id === 'platform'),
      false,
    )
    assert.equal(registry.platformScope.id, 'platform')
    assert.deepEqual(
      Object.fromEntries(
        [...new Set(registry.modules.map((module) => module.group))].map((group) => [
          group,
          registry.modules.filter((module) => module.group === group).length,
        ]),
      ),
      {
        'critical-care': 7,
        pleural: 11,
        'bronchoscopy-procedures': 9,
        other: 8,
      },
    )
  })

  test('parses only supported task branch forms', () => {
    assert.deepEqual(parseTaskBranch('codex/literature/fix-taxonomy'), {
      agent: 'codex',
      module: 'literature',
      task: 'fix-taxonomy',
    })
    assert.deepEqual(parseTaskBranch('claude/critical-care/ecmo/case-one'), {
      agent: 'claude',
      module: 'critical-care',
      task: 'ecmo/case-one',
    })
    assert.equal(parseTaskBranch('feature/literature'), null)
    assert.equal(parseTaskBranch('codex/Literature/task'), null)
    assert.equal(parseTaskBranch('codex/literature/task/'), null)
    assert.equal(parseTaskBranch('codex/literature/task//part'), null)
  })

  test('rejects repository paths that can escape the checkout', () => {
    assert.throws(() => normalizeRepoPath('../secret'), /Unsafe repository path/)
    assert.throws(() => normalizeRepoPath('safe/..'), /Unsafe repository path/)
    assert.throws(() => normalizeRepoPath('/absolute/path'), /Unsafe repository path/)
  })

  test('matches recursive and segment globs without crossing segment boundaries', () => {
    assert.equal(
      matchesPattern('src/features/literature/a/b.ts', 'src/features/literature/**'),
      true,
    )
    assert.equal(matchesPattern('messages/en.json', 'messages/*.json'), true)
    assert.equal(matchesPattern('messages/nested/en.json', 'messages/*.json'), false)
    assert.equal(
      globToRegExp('src/app/[locale]/literature/**').test('src/app/[locale]/literature/page.tsx'),
      true,
    )
  })
})

describe('scope enforcement', () => {
  test('uses a merge-base diff when the feature branch is behind the base branch', () => {
    const repository = temporaryDirectory()
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Worktree Tests'])
    writeFileSync(join(repository, 'shared.txt'), 'base\n')
    git(repository, ['add', 'shared.txt'])
    git(repository, ['commit', '-m', 'base'])
    git(repository, ['switch', '-c', 'codex/literature/test'])
    writeFileSync(join(repository, 'feature.txt'), 'feature\n')
    git(repository, ['add', 'feature.txt'])
    git(repository, ['commit', '-m', 'feature'])
    git(repository, ['switch', 'main'])
    writeFileSync(join(repository, 'main-only.txt'), 'main\n')
    git(repository, ['add', 'main-only.txt'])
    git(repository, ['commit', '-m', 'main advancement'])
    git(repository, ['switch', 'codex/literature/test'])

    assert.deepEqual(
      diffNameStatus(repository, ['main...HEAD']).map((entry) => entry.path),
      ['feature.txt'],
    )
    assert.deepEqual(
      diffNameStatus(repository, ['main', 'HEAD'])
        .map((entry) => entry.path)
        .sort(),
      ['feature.txt', 'main-only.txt'],
    )
  })

  test('accepts owned work and rejects another module’s exclusive path', () => {
    const commonDir = temporaryDirectory()
    const literatureContext = context(commonDir, 'scope', 'literature')
    const own = scopeReport({
      cwd: literatureContext.topLevel,
      registry,
      moduleId: 'literature',
      files: ['src/features/literature/components/GoldSetReviewWorkspace.tsx'],
      context: literatureContext,
    })
    assert.equal(own.errors.length, 0)

    const wrong = scopeReport({
      cwd: literatureContext.topLevel,
      registry,
      moduleId: 'literature',
      files: ['src/features/critical-care/components/CriticalCareHub.tsx'],
      context: literatureContext,
    })
    assert.equal(wrong.errors[0].code, 'WT-EXCLUSIVE-PATH')
  })

  test('always blocks private and generated paths', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'private', 'platform')
    const report = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['.env.local', 'local-data/inputs/gudid/device.txt'],
      context: taskContext,
    })
    assert.deepEqual(
      report.errors.map((error) => error.code),
      ['WT-BLOCKED-PATH', 'WT-BLOCKED-PATH'],
    )
  })

  test('allows an intentional deletion while externalizing a formerly tracked private path', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'private-removal', 'platform')
    const report = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: [{ path: 'IP_PubMed/nbib files/corpus.nbib', deleted: true, status: 'D' }],
      context: taskContext,
    })
    assert.equal(report.errors.length, 0)
    assert.equal(report.files[0].disposition, 'private-removal')
  })

  test('requires a local lease for protected shared paths but CI only checks declaration', () => {
    const commonDir = temporaryDirectory()
    const taskContext = context(commonDir, 'shared', 'platform')
    const local = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
    })
    assert.equal(local.errors[0].code, 'WT-SHARED-LEASE-REQUIRED')

    const ci = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
      ci: true,
    })
    assert.equal(ci.errors.length, 0)

    const descriptor = canonicalLeaseResource('package.json', registry)
    acquireLease(commonDir, taskContext, descriptor, 'test package script')
    assert.equal(leaseOwnedForResource(commonDir, taskContext, 'package.json'), true)
    const claimed = scopeReport({
      cwd: taskContext.topLevel,
      registry,
      moduleId: 'platform',
      files: ['package.json'],
      context: taskContext,
    })
    assert.equal(claimed.errors.length, 0)
  })

  test('blocks control and detached commit contexts', () => {
    assert.throws(
      () =>
        ensureGuardContext(
          {
            role: 'control',
            branch: 'main',
            detached: false,
            module: null,
            topLevel: temporaryDirectory(),
            gitDir: temporaryDirectory(),
          },
          registry,
        ),
      (error) => error instanceof WtError && error.code === 'WT-CONTROL-COMMIT',
    )
  })
})

describe('atomic leases', () => {
  test('allows exactly one owner for an exclusive shared path', () => {
    const commonDir = temporaryDirectory()
    const first = context(commonDir, 'first')
    const second = context(commonDir, 'second')
    const descriptor = canonicalLeaseResource('package.json', registry)
    acquireLease(commonDir, first, descriptor, 'first owner')
    assert.throws(
      () => acquireLease(commonDir, second, descriptor, 'second owner'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
    releaseLease(commonDir, first, descriptor)
    const secondLease = acquireLease(commonDir, second, descriptor, 'second after release')
    assert.equal(secondLease.owner.branch, second.branch)
  })

  test('permits multiple Supabase readers and excludes mutations in both directions', () => {
    const commonDir = temporaryDirectory()
    const first = context(commonDir, 'reader-one', 'literature')
    const second = context(commonDir, 'reader-two', 'preference-cards')
    const read = canonicalLeaseResource('supabase-read', registry)
    const mutate = canonicalLeaseResource('supabase-reset', registry)
    acquireLease(commonDir, first, read, 'read app one')
    acquireLease(commonDir, second, read, 'read app two')
    assert.throws(
      () => acquireLease(commonDir, first, mutate, 'reset database'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
    releaseLease(commonDir, first, read)
    releaseLease(commonDir, second, read)
    const mutation = acquireLease(commonDir, first, mutate, 'reset database')
    assert.equal(mutation.operation, 'reset')
    assert.throws(
      () => acquireLease(commonDir, second, read, 'read during reset'),
      (error) => error instanceof WtError && error.code === 'WT-LEASE-CONFLICT',
    )
  })
})

describe('disposable worktrees', () => {
  test('removes ignored artifacts and mount symlinks without touching external inputs', () => {
    const root = temporaryDirectory()
    const repository = join(root, 'repository')
    const worktreesRoot = join(root, 'worktrees')
    const target = join(worktreesRoot, 'active', 'codex-platform-disposal-test')
    const externalInput = join(root, 'external.env')
    mkdirSync(repository)
    mkdirSync(join(worktreesRoot, 'active'), { recursive: true })
    git(repository, ['init', '-b', 'main'])
    git(repository, ['config', 'user.email', 'worktree-tests@example.invalid'])
    git(repository, ['config', 'user.name', 'Worktree Tests'])
    writeFileSync(join(repository, '.gitignore'), 'node_modules/\n.env.local\n')
    writeFileSync(join(repository, 'README.md'), 'test repository\n')
    git(repository, ['add', '.gitignore', 'README.md'])
    git(repository, ['commit', '-m', 'base'])
    git(repository, ['worktree', 'add', '-b', 'codex/platform/disposal-test', target, 'main'])
    mkdirSync(join(target, 'node_modules'))
    writeFileSync(join(target, 'node_modules', 'cache.txt'), 'disposable\n')
    writeFileSync(externalInput, 'preserve me\n')
    symlinkSync(externalInput, join(target, '.env.local'))

    assert.deepEqual(orphanWorktreeDirectories(repository, worktreesRoot), [])
    const orphan = join(worktreesRoot, 'temporary', 'orphaned-task')
    mkdirSync(orphan, { recursive: true })
    assert.deepEqual(orphanWorktreeDirectories(repository, worktreesRoot), [orphan])
    rmSync(orphan, { recursive: true })

    assert.throws(
      () => removeDisposableWorktree(repository, repository, worktreesRoot),
      (error) => error instanceof WtError && error.code === 'WT-DISPOSAL-PATH',
    )
    removeDisposableWorktree(repository, target, worktreesRoot)

    assert.equal(existsSync(target), false)
    assert.equal(readFileSync(externalInput, 'utf8'), 'preserve me\n')
  })
})

describe('mount and process validation', () => {
  test('limits per-worktree excludes to the module input profile', () => {
    const literatureRules = worktreeExcludeRules(registry, 'literature')
    assert.ok(literatureRules.includes('/.env.local'))
    assert.ok(literatureRules.includes('/IP_PubMed/nbib files'))
    assert.equal(
      literatureRules.some((rule) => rule.includes('AccessGUDID')),
      false,
    )

    const preferenceRules = worktreeExcludeRules(registry, 'preference-cards')
    assert.ok(
      preferenceRules.includes(
        '/Preference_card_module/AccessGUDID_Delimited_Full_Release_20260723',
      ),
    )
    assert.ok(preferenceRules.includes('/Preference_card_module/UCSD'))
    assert.equal(preferenceRules.includes('/Preference_card_module/UCSD/IFU Documents'), false)
    assert.equal(preferenceRules.includes('/IP_PubMed/nbib files'), false)
  })

  test('updates the managed common exclude block without removing local rules', () => {
    const commonDir = temporaryDirectory()
    const exclude = join(commonDir, 'info', 'exclude')
    mkdirSync(join(commonDir, 'info'))
    writeFileSync(
      exclude,
      [
        '# local rule before',
        '*.machine-only',
        '# note: # BEGIN managed by wt (universal local-only paths) is reserved',
        '# BEGIN managed by wt (universal local-only paths)',
        '/old-managed-path/',
        '# END managed by wt',
        '# local rule after',
        '# note: # END managed by wt is reserved',
        '!/local-data/keep-this-file',
        '',
      ].join('\n'),
    )

    ensureCommonExclude(commonDir)

    const content = readFileSync(exclude, 'utf8')
    assert.match(content, /\*\.machine-only/)
    assert.match(content, /\/\.claude\/settings\.local\.json/)
    assert.match(
      content,
      /# note: # BEGIN managed by wt \(universal local-only paths\) is reserved/,
    )
    assert.match(content, /# note: # END managed by wt is reserved/)
    assert.doesNotMatch(content, /old-managed-path/)
    assert.ok(
      content.indexOf('# local rule before') <
        content.indexOf('# BEGIN managed by wt (universal local-only paths)'),
    )
    assert.ok(content.indexOf('# local rule after') > content.indexOf('# END managed by wt'))
    assert.equal(
      content
        .split(/\r?\n/)
        .filter((line) => line === '# BEGIN managed by wt (universal local-only paths)').length,
      1,
    )
  })

  test('rejects malformed common exclude markers without rewriting the file', () => {
    const commonDir = temporaryDirectory()
    const exclude = join(commonDir, 'info', 'exclude')
    mkdirSync(join(commonDir, 'info'))
    const malformed = [
      '# local rule',
      '# BEGIN managed by wt (universal local-only paths)',
      '/stale-managed-path/',
      '',
    ].join('\n')
    writeFileSync(exclude, malformed)

    assert.throws(
      () => ensureCommonExclude(commonDir),
      (error) => error instanceof WtError && error.code === 'WT-COMMON-EXCLUDE-MALFORMED',
    )
    assert.equal(readFileSync(exclude, 'utf8'), malformed)
  })

  test('provisions only symlinks to read-only approved inputs', () => {
    const root = temporaryDirectory()
    const source = join(root, 'external.env')
    const worktree = join(root, 'worktree')
    mkdirSync(worktree)
    writeFileSync(source, 'EXAMPLE=value\n', { mode: 0o400 })
    chmodSync(source, 0o400)
    const localConfig = { inputs: { environment: source } }
    const mounts = provisionMounts(worktree, registry, 'platform', localConfig)
    assert.equal(mounts[0].status, 'ok')
    assert.equal(lstatSync(join(worktree, '.env.local')).isSymbolicLink(), true)
    assert.equal(validateMounts(worktree, registry, 'platform', localConfig)[0].status, 'ok')
  })

  test('detects PID reuse using start time even when the PID still exists', () => {
    const snapshot = processSnapshot(process.pid)
    assert.ok(snapshot)
    const validation = validateProcessRecord({
      pid: process.pid,
      processStartTime: 'Mon Jan  1 00:00:00 1990',
      command: snapshot.command,
      expectedCommand: snapshot.command,
    })
    assert.equal(validation.valid, false)
    assert.equal(validation.reason, 'pid-reused')
  })

  test('detects listener PID reuse independently of the dev command owner', () => {
    const snapshot = processSnapshot(process.pid)
    assert.ok(snapshot)
    const validation = validateProcessRecord({
      pid: process.pid,
      processStartTime: snapshot.startTime,
      command: snapshot.command,
      expectedCommand: snapshot.command,
      listenerPid: process.pid,
      listenerProcessStartTime: 'Mon Jan  1 00:00:00 1990',
      listenerCommand: snapshot.command,
      expectedListenerCommand: snapshot.command,
    })
    assert.equal(validation.valid, false)
    assert.equal(validation.reason, 'listener-pid-reused')
  })

  test('retains the dev lease until a delayed listener shutdown completes', async () => {
    const port = await availablePort()
    const fixture = createDevFixture(port)
    const runner = spawn(
      process.execPath,
      [join(repositoryRoot, 'scripts', 'worktrees', 'worktree.mjs'), 'dev'],
      {
        cwd: fixture.repository,
        env: {
          ...process.env,
          WT_LOCAL_CONFIG: fixture.localConfigPath,
          WT_TEST_SHUTDOWN_DELAY: '600',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    runner.stdout.on('data', (chunk) => {
      output += chunk
    })
    runner.stderr.on('data', (chunk) => {
      output += chunk
    })
    const completion = new Promise((resolvePromise, rejectPromise) => {
      runner.once('error', rejectPromise)
      runner.once('exit', (code, signal) => resolvePromise({ code, signal }))
    })

    try {
      await waitFor(() => {
        if (!existsSync(fixture.processRecord)) return false
        return JSON.parse(readFileSync(fixture.processRecord, 'utf8')).status === 'running'
      }, `wt dev did not reach running state:\n${output}`)
      runner.kill('SIGTERM')
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25))
      runner.kill('SIGTERM')
      await waitFor(() => {
        if (!existsSync(fixture.processRecord)) return false
        return JSON.parse(readFileSync(fixture.processRecord, 'utf8')).status === 'stopping'
      }, `wt dev removed its lease before entering stopping state:\n${output}`)
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
      assert.equal(
        existsSync(fixture.processRecord),
        true,
        'the lease must remain while the listener delays shutdown',
      )
      const result = await completion
      assert.equal(result.code, 143, output)
      assert.equal(existsSync(fixture.processRecord), false, output)
    } finally {
      if (runner.exitCode === null && runner.signalCode === null) runner.kill('SIGKILL')
    }
  })

  test('keeps signal handlers active while an orphaned listener finishes shutting down', async () => {
    const port = await availablePort()
    const fixture = createDevFixture(port)
    const runner = spawn(
      process.execPath,
      [join(repositoryRoot, 'scripts', 'worktrees', 'worktree.mjs'), 'dev'],
      {
        cwd: fixture.repository,
        env: {
          ...process.env,
          WT_LOCAL_CONFIG: fixture.localConfigPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    let listenerPid = null
    runner.stdout.on('data', (chunk) => {
      output += chunk
    })
    runner.stderr.on('data', (chunk) => {
      output += chunk
    })
    const completion = new Promise((resolvePromise, rejectPromise) => {
      runner.once('error', rejectPromise)
      runner.once('exit', (code, signal) => resolvePromise({ code, signal }))
    })

    try {
      const runningRecord = await waitFor(() => {
        if (!existsSync(fixture.processRecord)) return false
        const record = JSON.parse(readFileSync(fixture.processRecord, 'utf8'))
        return record.status === 'running' ? record : false
      }, `wt dev did not reach running state:\n${output}`)
      listenerPid = runningRecord.listenerPid
      process.kill(runningRecord.pid, 'SIGKILL')
      await waitFor(
        () => !processSnapshot(runningRecord.pid),
        `the fake dev owner did not exit:\n${output}`,
      )
      await waitFor(() => {
        if (!existsSync(fixture.processRecord)) return false
        return JSON.parse(readFileSync(fixture.processRecord, 'utf8')).status === 'stopping'
      }, `wt dev did not retain a stopping lease:\n${output}`)

      runner.kill('SIGTERM')
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
      process.kill(listenerPid, 'SIGTERM')
      const result = await completion

      assert.equal(result.signal, null, output)
      assert.equal(existsSync(fixture.processRecord), false, output)
    } finally {
      if (listenerPid && processSnapshot(listenerPid)) process.kill(listenerPid, 'SIGKILL')
      if (runner.exitCode === null && runner.signalCode === null) runner.kill('SIGKILL')
    }
  })

  test('cancels listener discovery without writing a running lease after a signal', async () => {
    const port = await availablePort()
    const fixture = createDevFixture(port)
    const runner = spawn(
      process.execPath,
      [join(repositoryRoot, 'scripts', 'worktrees', 'worktree.mjs'), 'dev'],
      {
        cwd: fixture.repository,
        env: {
          ...process.env,
          WT_LOCAL_CONFIG: fixture.localConfigPath,
          WT_TEST_START_DELAY: '3000',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    runner.stdout.on('data', (chunk) => {
      output += chunk
    })
    runner.stderr.on('data', (chunk) => {
      output += chunk
    })
    const completion = new Promise((resolvePromise, rejectPromise) => {
      runner.once('error', rejectPromise)
      runner.once('exit', (code, signal) => resolvePromise({ code, signal }))
    })

    try {
      await waitFor(() => {
        if (!existsSync(fixture.processRecord)) return false
        return JSON.parse(readFileSync(fixture.processRecord, 'utf8')).status === 'starting'
      }, `wt dev did not create its startup lease:\n${output}`)
      const signalTime = Date.now()
      runner.kill('SIGTERM')
      const result = await Promise.race([
        completion,
        new Promise((_, rejectPromise) =>
          setTimeout(
            () => rejectPromise(new Error(`wt dev did not cancel startup promptly:\n${output}`)),
            1500,
          ),
        ),
      ])
      assert.equal(result.code, 143, output)
      assert.ok(Date.now() - signalTime < 1500, output)
      assert.equal(existsSync(fixture.processRecord), false, output)
    } finally {
      if (runner.exitCode === null && runner.signalCode === null) runner.kill('SIGKILL')
    }
  })
})
