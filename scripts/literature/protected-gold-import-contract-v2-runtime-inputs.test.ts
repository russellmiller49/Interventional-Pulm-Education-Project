/** @jest-environment node */

import { mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import {
  buildProtectedV2RuntimeInputAudit,
  discoverProtectedV2RuntimeCallSites,
  type ProtectedV2PackageScriptDeclaration,
  type ProtectedV2RuntimeCallSiteDeclaration,
} from './protected-gold-import-contract-v2-runtime-inputs'

interface RuntimeFixture {
  cwd: string
  sealedPaths: Set<string>
  trackedPaths: Set<string>
  writeTracked: (path: string, bytes: string) => Promise<void>
}

describe('protected V2 non-module runtime-input declarations', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true })))
  })

  async function fixture(source: string): Promise<RuntimeFixture> {
    const cwd = await mkdtemp(resolve(tmpdir(), 'protected-v2-runtime-inputs-'))
    cleanup.push(cwd)
    const trackedPaths = new Set<string>()
    const sealedPaths = new Set<string>()
    const writeTracked = async (path: string, bytes: string) => {
      await mkdir(dirname(resolve(cwd, path)), { recursive: true })
      await writeFile(resolve(cwd, path), bytes, 'utf8')
      trackedPaths.add(path)
      sealedPaths.add(path)
    }
    await writeTracked(
      'package.json',
      JSON.stringify({ devDependencies: { tsx: '4.21.0' }, scripts: {} }),
    )
    await writeTracked(
      'package-lock.json',
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { devDependencies: { tsx: '4.21.0' } },
          'node_modules/tsx': {
            integrity: 'sha512-YQ==',
            resolved: 'https://registry.npmjs.org/tsx/-/tsx-4.21.0.tgz',
            version: '4.21.0',
          },
        },
      }),
    )
    await writeTracked('src/root.ts', source)
    return { cwd, sealedPaths, trackedPaths, writeTracked }
  }

  function audit(
    test: RuntimeFixture,
    input: {
      declarations?: readonly ProtectedV2RuntimeCallSiteDeclaration[]
      packageScripts?: readonly ProtectedV2PackageScriptDeclaration[]
      sourcePaths?: readonly string[]
    } = {},
  ) {
    return buildProtectedV2RuntimeInputAudit({
      callSiteDeclarations: input.declarations ?? [],
      cwd: test.cwd,
      packageJsonPath: 'package.json',
      packageLockPath: 'package-lock.json',
      packageScripts: input.packageScripts ?? [],
      sealedPaths: test.sealedPaths,
      sourcePaths: input.sourcePaths ?? ['src/root.ts'],
      trackedPaths: test.trackedPaths,
    })
  }

  function declaration(
    callSite: ReturnType<typeof discoverProtectedV2RuntimeCallSites>[number],
    disposition: ProtectedV2RuntimeCallSiteDeclaration['disposition'],
    overrides: Partial<ProtectedV2RuntimeCallSiteDeclaration> = {},
  ): ProtectedV2RuntimeCallSiteDeclaration {
    return {
      api: callSite.api,
      disposition,
      executables: [],
      fingerprint: callSite.fingerprint,
      packages: [],
      repositoryInputs: [],
      sourcePath: callSite.sourcePath,
      ...overrides,
    }
  }

  it('seals static repository-relative reads, import-meta URLs, and spawned entry points', async () => {
    const test = await fixture(`
      import { readFile } from 'node:fs/promises'
      import { resolve } from 'node:path'
      import { fork, spawn } from 'node:child_process'
      void readFile(resolve(process.cwd(), 'data.json'))
      void new URL('./url-data.json', import.meta.url)
      void spawn('node', ['src/worker.ts'])
      void fork('src/fork-worker.ts')
    `)
    await test.writeTracked('data.json', '{"data":true}\n')
    await test.writeTracked('src/url-data.json', '{"url":true}\n')
    await test.writeTracked('src/worker.ts', 'export const worker = true\n')
    await test.writeTracked('src/fork-worker.ts', 'export const forkWorker = true\n')

    const first = audit(test)
    const repeated = audit(test)
    expect(repeated).toEqual(first)
    expect(first.repositoryInputs).toEqual([
      'data.json',
      'src/fork-worker.ts',
      'src/url-data.json',
      'src/worker.ts',
    ])
    expect(first.callSites).toContainEqual(
      expect.objectContaining({
        disposition: 'repository_entry_point',
        repositoryInputs: ['src/worker.ts'],
      }),
    )
  })

  it('models multi-segment, parent, and later-absolute path.resolve semantics exactly', async () => {
    const test = await fixture('export {}\n')
    const absoluteTarget = resolve(await realpath(test.cwd), 'absolute', 'target.json')
    await test.writeTracked(
      'src/root.ts',
      `
        import { readFile } from 'node:fs/promises'
        import { resolve } from 'node:path'
        void readFile(resolve(process.cwd(), 'nested', 'input.json'))
        void readFile(resolve(process.cwd(), 'nested', '..', 'parent.json'))
        void readFile(resolve(process.cwd(), 'decoy', ${JSON.stringify(absoluteTarget)}))
      `,
    )
    await test.writeTracked('nested/input.json', '{}\n')
    await test.writeTracked('parent.json', '{}\n')
    await test.writeTracked('absolute/target.json', '{}\n')
    await test.writeTracked('input.json', '{"decoy":true}\n')
    const result = audit(test)
    expect(result.repositoryInputs).toEqual([
      'absolute/target.json',
      'nested/input.json',
      'parent.json',
    ])
  })

  it('rejects composed static untracked files, leaf symlinks, and symlinked ancestors', async () => {
    const untracked = await fixture(`
      import { readFile } from 'node:fs/promises'
      import { resolve } from 'node:path'
      void readFile(resolve(process.cwd(), 'untracked.json'))
    `)
    await writeFile(resolve(untracked.cwd, 'untracked.json'), '{}\n', 'utf8')
    expect(() => audit(untracked)).toThrow('not an exact Git-tracked file')

    const leaf = await fixture(`
      import { readFile } from 'node:fs/promises'
      void readFile('data.json')
    `)
    await leaf.writeTracked('data.json', '{}\n')
    await rm(resolve(leaf.cwd, 'data.json'))
    await symlink('package.json', resolve(leaf.cwd, 'data.json'))
    expect(() => audit(leaf)).toThrow(/non-symlink|symlinked repository path/u)

    const ancestor = await fixture(
      "import { readFile } from 'node:fs/promises'; void readFile('data.json')\n",
    )
    await ancestor.writeTracked('data.json', '{}\n')
    await rename(resolve(ancestor.cwd, 'src'), resolve(ancestor.cwd, 'actual-src'))
    await symlink('actual-src', resolve(ancestor.cwd, 'src'), 'dir')
    expect(() => audit(ancestor)).toThrow('symlinked repository path')
  })

  it('recognizes import-equals, default, CommonJS, fs.promises, and direct API aliases', async () => {
    const test = await fixture(`
      import fsDefault from 'node:fs'
      import fsEquals = require('node:fs')
      import childProcess = require('node:child_process')
      const commonFs = require('node:fs')
      const readAlias = fsEquals.readFileSync
      const spawnAlias = childProcess.spawn
      void fsDefault.existsSync('data.json')
      void fsEquals.promises.readFile('data.json')
      void commonFs.readFileSync('data.json')
      void readAlias('data.json')
      void spawnAlias('node', ['src/worker.ts'])
    `)
    await test.writeTracked('data.json', '{}\n')
    await test.writeTracked('src/worker.ts', 'export {}\n')
    const result = audit(test)
    expect(result.callSites.filter(({ api }) => api.startsWith('fs.'))).toHaveLength(4)
    expect(result.repositoryInputs).toEqual(['data.json', 'src/worker.ts'])
  })

  it.each([
    [
      `import * as fs from 'node:fs'; const method = 'readFileSync'; const read = fs[method]; void read('data.json')`,
      'Unsupported runtime namespace alias',
    ],
    [
      `import * as fs from 'node:fs'; void fs.someFutureReader('data.json')`,
      'Unsupported protected runtime input API',
    ],
    [
      `import * as childProcess from 'node:child_process'; void childProcess.someFutureSpawn('node')`,
      'Unsupported protected runtime input API',
    ],
  ])('fails closed for unsupported filesystem/process binding syntax', async (source, error) => {
    const test = await fixture(source)
    await test.writeTracked('data.json', '{}\n')
    expect(() => audit(test)).toThrow(error)
  })

  it('fails every nonliteral filesystem call closed until its exact fingerprint is declared', async () => {
    const test = await fixture(`
      import { readFile } from 'node:fs/promises'
      export async function load(path: string) { return readFile(path) }
    `)
    const [callSite] = discoverProtectedV2RuntimeCallSites({
      cwd: test.cwd,
      sourcePaths: ['src/root.ts'],
      trackedPaths: test.trackedPaths,
    })
    expect(callSite?.nonliteral).toBe(true)
    expect(() => audit(test)).toThrow('has no exact declaration')

    const declared = audit(test, {
      declarations: [declaration(callSite!, 'operator_evidence')],
    })
    expect(declared.callSites).toContainEqual(
      expect.objectContaining({
        disposition: 'operator_evidence',
        fingerprint: callSite!.fingerprint,
      }),
    )

    await test.writeTracked(
      'src/root.ts',
      `import { readFile } from 'node:fs/promises'\nexport async function load(path: string) { return readFile(resolveInput(path)) }\nfunction resolveInput(path: string) { return path }\n`,
    )
    expect(() =>
      audit(test, { declarations: [declaration(callSite!, 'operator_evidence')] }),
    ).toThrow('has no exact declaration')
  })

  it('does not allow a declaration to waive a statically resolved repository input', async () => {
    const test = await fixture(`
      import { readFile } from 'node:fs/promises'
      void readFile('data.json')
    `)
    await test.writeTracked('data.json', '{}\n')
    const [callSite] = discoverProtectedV2RuntimeCallSites({
      cwd: test.cwd,
      sourcePaths: ['src/root.ts'],
      trackedPaths: test.trackedPaths,
    })
    expect(callSite?.nonliteral).toBe(false)
    expect(() =>
      audit(test, { declarations: [declaration(callSite!, 'operator_evidence')] }),
    ).toThrow('stale call sites')
    expect(audit(test).repositoryInputs).toEqual(['data.json'])
  })

  it('requires exact declarations for nonliteral URL and child-process forms', async () => {
    const test = await fixture(`
      import { spawn } from 'node:child_process'
      export function run(command: string, path: string) {
        void spawn(command, [path])
        return new URL(path, import.meta.url)
      }
    `)
    await test.writeTracked('src/worker.ts', 'export const worker = true\n')
    const callSites = discoverProtectedV2RuntimeCallSites({
      cwd: test.cwd,
      sourcePaths: ['src/root.ts'],
      trackedPaths: test.trackedPaths,
    })
    expect(callSites).toHaveLength(2)
    expect(() => audit(test)).toThrow('has no exact declaration')
    const declarations = callSites.map((callSite) =>
      callSite.api === 'url.import_meta'
        ? declaration(callSite, 'operator_evidence')
        : declaration(callSite, 'repository_entry_point', {
            executables: ['node'],
            repositoryInputs: ['src/worker.ts'],
          }),
    )
    const result = audit(test, { declarations })
    expect(result.repositoryInputs).toEqual(['src/worker.ts'])
  })

  it('binds protected package scripts through the primary guard, tsx, and sealed entry points', async () => {
    const test = await fixture('export const entry = true\n')
    await test.writeTracked('scripts/require-primary-checkout.mjs', 'export {}\n')
    await test.writeTracked('scripts/literature/operator.ts', 'export {}\n')
    const packageJson = {
      devDependencies: { tsx: '4.21.0' },
      scripts: {
        'protected:operator':
          'node scripts/require-primary-checkout.mjs -- tsx scripts/literature/operator.ts',
      },
    }
    await test.writeTracked('package.json', JSON.stringify(packageJson))
    const packageScripts = [
      {
        arguments: [],
        entryPoint: 'scripts/literature/operator.ts',
        name: 'protected:operator',
        requiresPrimaryCheckout: true,
      },
    ] as const
    const result = audit(test, { packageScripts, sourcePaths: [] })
    expect(result.packageScripts).toHaveLength(1)

    await test.writeTracked(
      'package.json',
      JSON.stringify({
        ...packageJson,
        scripts: {
          'protected:operator':
            'node scripts/require-primary-checkout.mjs -- tsx scripts/literature/operator.ts unexpected',
        },
      }),
    )
    expect(() => audit(test, { packageScripts, sourcePaths: [] })).toThrow('arguments drifted')

    await test.writeTracked(
      'package.json',
      JSON.stringify({
        ...packageJson,
        scripts: { 'protected:operator': 'tsx scripts/literature/operator.ts' },
      }),
    )
    expect(() => audit(test, { packageScripts, sourcePaths: [] })).toThrow(
      'primary-checkout guard drifted',
    )
  })

  it('rejects unsupported package-script shell syntax and unsealed entry points', async () => {
    const test = await fixture('export const entry = true\n')
    await test.writeTracked(
      'package.json',
      JSON.stringify({
        devDependencies: { tsx: '4.21.0' },
        scripts: { 'protected:operator': 'tsx scripts/operator.ts && echo unsafe' },
      }),
    )
    const packageScripts = [
      {
        arguments: [],
        entryPoint: 'scripts/operator.ts',
        name: 'protected:operator',
        requiresPrimaryCheckout: false,
      },
    ]
    expect(() => audit(test, { packageScripts, sourcePaths: [] })).toThrow(
      'unsupported shell syntax',
    )
  })
})
