/** @jest-environment node */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { LUNA_CLI_COMMANDS, WITHHELD_COMMANDS } from './cli'

/**
 * The offline-surface closure.
 *
 * This release prepares model requests and never sends them, and that claim is only worth
 * something if it is checked structurally rather than by reading the CLI's command list.
 *
 * So this suite walks the **transitive relative-import closure** of the executable entry
 * points and asserts three things about every lane file inside it: it names no credential, it
 * names no remote host, and it contains no client-transport construct. A network capability
 * that is exported but unreachable from the CLI would still be a network capability in this
 * package, so the scan covers every non-test lane source, not merely the reachable ones.
 *
 * The closure itself is pinned too. A new cross-package import — a database client, an HTTP
 * library, a telemetry shim — changes the closure and fails here before anyone has to notice
 * it in a diff.
 */

const PACKAGE_DIR = resolve(process.cwd(), 'scripts', 'literature-luna-triage')
const CORE_DIR = resolve(process.cwd(), 'src', 'features', 'literature', 'classifier')
const REPO_ROOT = process.cwd()

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function laneSources(includeTests: boolean): string[] {
  const files: string[] = []
  for (const entry of readdirSync(PACKAGE_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
    if (!includeTests && entry.name.endsWith('.test.ts')) continue
    files.push(join(PACKAGE_DIR, entry.name))
  }
  return files.sort()
}

/** Resolve one relative specifier to a `.ts` file on disk, or null if it is not one. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    try {
      readFileSync(candidate, 'utf8')
      return candidate
    } catch {
      // Not this shape; try the next.
    }
  }
  return null
}

function relativeImports(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(/from\s+'([^']+)'/gu)) specifiers.push(match[1])
  for (const match of source.matchAll(/import\(\s*'([^']+)'\s*\)/gu)) specifiers.push(match[1])
  for (const match of source.matchAll(/require\(\s*'([^']+)'\s*\)/gu)) specifiers.push(match[1])
  return specifiers
}

/** Every `.ts` file reachable from the entry points by relative import. */
function importClosure(entryPoints: readonly string[]): Set<string> {
  const seen = new Set<string>()
  const queue = [...entryPoints]
  while (queue.length > 0) {
    const current = queue.pop() as string
    if (seen.has(current)) continue
    seen.add(current)
    for (const specifier of relativeImports(read(current))) {
      const resolved = resolveSpecifier(current, specifier)
      if (resolved) queue.push(resolved)
    }
  }
  return seen
}

const CLI_ENTRY = join(PACKAGE_DIR, 'cli.ts')
const CLOSURE = importClosure([CLI_ENTRY])

describe('the executable closure holds no credential and no remote host', () => {
  // Assembled at runtime so this file never matches its own assertions.
  const CREDENTIAL_NEEDLES = ['OPENAI' + '_API_KEY', 'process' + '.env', 'Bearer ' + '${']
  const HOST_NEEDLES = ['api.' + 'openai.com', 'openai.' + 'com', 'https://api.']

  it.each(laneSources(false).map((path) => [relative(REPO_ROOT, path), path]))(
    '%s names no credential',
    (_label, path) => {
      const source = read(path)
      for (const needle of CREDENTIAL_NEEDLES) {
        expect({ needle, found: source.includes(needle) }).toEqual({ needle, found: false })
      }
    },
  )

  it.each(laneSources(false).map((path) => [relative(REPO_ROOT, path), path]))(
    '%s names no remote host',
    (_label, path) => {
      const source = read(path)
      for (const needle of HOST_NEEDLES) {
        expect({ needle, found: source.includes(needle) }).toEqual({ needle, found: false })
      }
    },
  )

  it('names no credential or remote host anywhere in the classifier core either', () => {
    for (const entry of readdirSync(CORE_DIR)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue
      const source = read(join(CORE_DIR, entry))
      for (const needle of [...CREDENTIAL_NEEDLES, ...HOST_NEEDLES]) {
        expect({ entry, needle, found: source.includes(needle) }).toEqual({
          entry,
          needle,
          found: false,
        })
      }
    }
  })
})

/**
 * Transport constructs, not just hostnames. A generic client left in the package would be a
 * remote capability whatever URL it happened to be pointed at today.
 */
describe('the lane contains no client transport', () => {
  const TRANSPORT_PATTERNS: readonly [string, RegExp][] = [
    ['XMLHttpRequest', /XMLHttpRequest/u],
    ['WebSocket', /\bWebSocket\b/u],
    ['node:https', /['"]node:https['"]/u],
    ['node:http2', /['"]node:http2['"]/u],
    ['node:net', /['"]node:net['"]/u],
    ['node:tls', /['"]node:tls['"]/u],
    ['node:dgram', /['"]node:dgram['"]/u],
    ['undici', /['"]undici['"]/u],
    ['node-fetch', /['"]node-fetch['"]/u],
    ['axios', /['"]axios['"]/u],
    ['openai sdk', /['"]openai['"]/u],
    ['http(s).request', /\bhttps?\.request\s*\(/u],
    ['net/tls connect', /\b(?:net|tls)\.connect\s*\(/u],
    ['createConnection', /createConnection\s*\(/u],
    ['Agent construction', /new\s+(?:http|https)\.Agent\b/u],
  ]

  it.each(laneSources(false).map((path) => [relative(REPO_ROOT, path), path]))(
    '%s constructs no client transport',
    (_label, path) => {
      const source = read(path)
      for (const [label, pattern] of TRANSPORT_PATTERNS) {
        expect({ label, found: pattern.test(source) }).toEqual({ label, found: false })
      }
    },
  )

  it('confines fetch to the review page, and only to same-origin /api paths', () => {
    for (const path of laneSources(false)) {
      const source = read(path)
      if (path.endsWith('review-page.ts')) {
        const targets = [...source.matchAll(/fetch\(\s*(['"`])([^'"`]+)\1/gu)].map(
          (match) => match[2],
        )
        expect(targets.length).toBeGreaterThan(0)
        for (const target of targets) expect(target.startsWith('/api/')).toBe(true)
        continue
      }
      expect({ path: relative(REPO_ROOT, path), hasFetch: source.includes('fetch(') }).toEqual({
        path: relative(REPO_ROOT, path),
        hasFetch: false,
      })
    }
  })

  it('imports node:http only in the loopback review server, and only to create one', () => {
    for (const path of laneSources(false)) {
      const source = read(path)
      if (!source.includes("'node:http'")) continue
      expect(relative(REPO_ROOT, path)).toBe('scripts/literature-luna-triage/review-app.ts')
      expect(source).toMatch(/import\s*\{[^}]*createServer[^}]*\}\s*from\s*'node:http'/u)
      expect(source).not.toMatch(/\brequest\s*\(/u)
    }
  })
})

describe('the CLI import closure is pinned', () => {
  it('reaches only lane files and an allowlist of already-merged packages', () => {
    const outside = [...CLOSURE]
      .filter((path) => !path.startsWith(`${PACKAGE_DIR}/`))
      .map((path) => relative(REPO_ROOT, path))
      .sort()
    expect(outside).toEqual([
      'scripts/literature-production-ingest/canonical.ts',
      'scripts/literature-production-ingest/constants.ts',
      'scripts/literature-production-ingest/mapping.ts',
      'scripts/literature-production-ingest/source.ts',
      'scripts/literature-production-ingest/types.ts',
      'scripts/literature-reviewed-overlay/artifact.ts',
      'scripts/literature-reviewed-overlay/constants.ts',
      'scripts/literature/gold-import-compensation-compatibility.ts',
      'src/features/literature/classifier/packet-contract.ts',
      'src/features/literature/classifier/risk-lexicon.ts',
      'src/features/literature/classifier/stage-a-contract.ts',
      'src/features/literature/classifier/stage-b-contract.ts',
      'src/features/literature/gold-set/constants.ts',
      'src/features/literature/gold-set/export.ts',
      'src/features/literature/gold-set/import-artifact-validation.ts',
      'src/features/literature/gold-set/import-compensation.ts',
      'src/features/literature/gold-set/types.ts',
      'src/features/literature/ultra-screening/core.ts',
    ])
  })

  it('reaches no module that this release deleted', () => {
    for (const removed of ['openai.ts', 'qualify.ts', 'freeze.ts']) {
      expect([...CLOSURE].some((path) => path.endsWith(`/${removed}`))).toBe(false)
    }
    for (const path of laneSources(true)) {
      const source = read(path)
      for (const removed of ['openai', 'qualify', 'freeze']) {
        expect({
          path: relative(REPO_ROOT, path),
          removed,
          imported: source.includes(`from './${removed}'`),
        }).toEqual({ path: relative(REPO_ROOT, path), removed, imported: false })
      }
    }
  })
})

describe('the command inventory is exact and closed', () => {
  const cli = read(CLI_ENTRY)

  it('declares exactly the offline commands in its dispatch table', () => {
    const table = cli.slice(
      cli.indexOf('const COMMANDS: Record<string'),
      cli.indexOf('/** The exact set of commands this release can execute, sorted. */'),
    )
    const keys = [...table.matchAll(/^ {2}'?([a-z-]+)'?:/gmu)].map((match) => match[1]).sort()
    expect(keys).toEqual([...LUNA_CLI_COMMANDS])
    expect(keys).toEqual([
      'audit-sample',
      'batch-prepare',
      'estimate',
      'evaluate',
      'ingest',
      'inventory',
      'packets',
      'prepare-requests',
      'review-app',
      'review-queue',
      'route',
      'split',
    ])
  })

  it.each(['run-sync', 'run-locked', 'batch-submit', 'batch-status', 'batch-fetch', 'qualify'])(
    'withholds %s and defines no handler for it',
    (command) => {
      expect(LUNA_CLI_COMMANDS).not.toContain(command)
      expect(Object.keys(WITHHELD_COMMANDS)).toContain(command)
      // No function survives whose name is the camel-cased handler for a withheld command.
      const handler = `run${command
        .split('-')
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join('')}`
      expect(cli.includes(`function ${handler}(`)).toBe(false)
    },
  )

  it('gives every withheld command a reason rather than a bare refusal', () => {
    for (const [command, reason] of Object.entries(WITHHELD_COMMANDS)) {
      // A reason, not a shrug: long enough to explain, and explicit that the omission is
      // this release's decision rather than an oversight.
      expect({ command, explained: reason.length > 80 }).toEqual({ command, explained: true })
      expect(reason).toMatch(/this release/u)
      expect(reason.trimEnd().endsWith('.')).toBe(true)
    }
  })
})

/**
 * Evaluation is descriptive. Nothing in the lane may assert that a model passed: no aggregate
 * verdict, no release flag, and no field a caller could read as one.
 */
describe('no lane surface claims qualification', () => {
  // Prose may discuss why qualification is withheld; what may not exist is a *field, symbol,
  // or binding* that carries a verdict, because that is what a caller could read as one.
  const VERDICT_PATTERNS: readonly [string, RegExp][] = [
    ['a qualified field or binding', /\bqualified\s*[:=]/u],
    ['an isQualified predicate', /\bisQualified\b/u],
    ['a qualification identifier', /\bqualification[A-Z_(]/u],
    ['a passes/verdict release flag', /\b(?:releaseApproved|gatePassed|modelQualifies)\b/u],
  ]

  it.each(laneSources(false).map((path) => [relative(REPO_ROOT, path), path]))(
    '%s declares no qualification verdict',
    (_label, path) => {
      const source = read(path)
      for (const [label, pattern] of VERDICT_PATTERNS) {
        expect({ label, found: pattern.test(source) }).toEqual({ label, found: false })
      }
    },
  )

  it('exports no symbol whose name suggests a verdict', () => {
    for (const path of laneSources(false)) {
      const exported = [
        ...read(path).matchAll(
          /export\s+(?:const|function|class|interface|type|async function)\s+([A-Za-z0-9_]+)/gu,
        ),
      ].map((match) => match[1])
      for (const name of exported) {
        expect({ path: relative(REPO_ROOT, path), name }).toEqual({
          path: relative(REPO_ROOT, path),
          name: expect.not.stringMatching(/qualif/iu) as unknown as string,
        })
      }
    }
  })
})
