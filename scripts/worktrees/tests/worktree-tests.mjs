import assert from 'node:assert/strict'
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
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
  parseTaskBranch,
  processSnapshot,
  provisionMounts,
  releaseLease,
  normalizeRepoPath,
  scopeReport,
  validateMounts,
  validateProcessRecord,
} from '../lib.mjs'

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

afterEach(() => {
  for (const pathname of temporaryPaths.splice(0)) {
    rmSync(pathname, { recursive: true, force: true })
  }
})

describe('registry and branch contracts', () => {
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

describe('mount and process validation', () => {
  test('updates the managed common exclude block without removing local rules', () => {
    const commonDir = temporaryDirectory()
    const exclude = join(commonDir, 'info', 'exclude')
    mkdirSync(join(commonDir, 'info'))
    writeFileSync(
      exclude,
      [
        '# local rule before',
        '*.machine-only',
        '# BEGIN managed by wt (universal local-only paths)',
        '/old-managed-path/',
        '# END managed by wt',
        '# local rule after',
        '!/local-data/keep-this-file',
        '',
      ].join('\n'),
    )

    ensureCommonExclude(commonDir)

    const content = readFileSync(exclude, 'utf8')
    assert.match(content, /\*\.machine-only/)
    assert.match(content, /\/\.claude\/settings\.local\.json/)
    assert.doesNotMatch(content, /old-managed-path/)
    assert.ok(
      content.indexOf('# local rule before') <
        content.indexOf('# BEGIN managed by wt (universal local-only paths)'),
    )
    assert.ok(content.indexOf('# local rule after') > content.indexOf('# END managed by wt'))
    assert.equal(content.match(/# BEGIN managed by wt \(universal local-only paths\)/g)?.length, 1)
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
})
