/** @jest-environment node */

import { mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import {
  PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS,
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

  it('pins the current PR #97 backup file/runtime evidence call sites', () => {
    const fingerprints = new Set([
      'df0e471a668e29785a6625df51cdc1bf992c38436ae77f37c05a26273bb488a6',
      '3037831f0d0d1c22bab8689991bb994394b02c9abb84a589d16742cdb2cb4e39',
      'ab773e4503b53e1f701f5ab26fbcc0a094beb6e21e63b882f10fec82b2e085db',
      '9f16daaae3502a48131eace86c7bb3d9109d619314d0671dce2161a4d887d066',
      'c7b79b6137cd071126c297a9875cf3b446d9a2f7a52e157e2164bcf55cdaec10',
      '1afacdeea9d5c7568710ed4dcd26e8f6309731fd61f652fd2f4beb9b5cfc21d6',
      '738e8a4f1fe28744dd53f222af5c3b0e6c61bf2eb6f306369d7f2e85e6ee287c',
      '8ef81688d72d9897c0ac5094e6ef28b31e7d1a353e1defe4c030de679f982e73',
      '32d10f03e830cd38806be1c3a9c48bd682fd0426ddb115e850f74e1b3509d68e',
      'babff8aa9ccc6c58de9f32ff402739f90e5ea9c898a95b8e9a27021b23ddb684',
    ])
    const declarations = PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS.filter(({ fingerprint }) =>
      fingerprints.has(fingerprint),
    )
    expect(declarations).toHaveLength(fingerprints.size)
    expect(declarations).toEqual(
      expect.arrayContaining(
        [...fingerprints].map((fingerprint) =>
          expect.objectContaining({
            fingerprint,
            packages: [],
            repositoryInputs: [],
            sourcePath: 'scripts/literature/create-gold-import-v2-postmigration-backup.ts',
          }),
        ),
      ),
    )
  })

  it('pins the file-only package verifier reads reached by forward-backup validation', () => {
    expect(PROTECTED_V2_RUNTIME_CALL_SITE_DECLARATIONS).toEqual(
      expect.arrayContaining(
        [
          ['fs.lstat', 'adebd41b2218dd68c7a11e7d72be73805b305c839c1902d83162cabf40a36f6b'],
          ['fs.readFile', '67db3219501da47e1e7c76779376de5ecce17f105babcda4e49b998c4ccee15d'],
        ].map(([api, fingerprint]) => ({
          api,
          disposition: 'operator_evidence',
          executables: [],
          fingerprint,
          packages: [],
          repositoryInputs: [],
          sourcePath: 'scripts/literature/generate-gold-import-compensation-package-v2.ts',
        })),
      ),
    )
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

  it('allows only analyzer-understood namespace and API aliases', async () => {
    const test = await fixture(`
      import * as fs from 'node:fs'
      import * as childProcess from 'node:child_process'
      const fsAlias = fs
      const readAlias = fsAlias.readFileSync
      const wrappedReadAlias = (fsAlias.readFileSync)
      const promisesAlias = (fsAlias.promises)
      const childProcessAlias = childProcess
      const spawnAlias = childProcessAlias.spawn
      void fsAlias.readFileSync('data.json')
      void readAlias('data.json')
      void wrappedReadAlias('data.json')
      void promisesAlias.readFile('data.json')
      void spawnAlias('node', ['src/worker.ts'])
    `)
    await test.writeTracked('data.json', '{}\n')
    await test.writeTracked('src/worker.ts', 'export {}\n')
    const result = audit(test)
    expect(result.callSites.filter(({ api }) => api.startsWith('fs.'))).toHaveLength(4)
    expect(result.repositoryInputs).toEqual(['data.json', 'src/worker.ts'])
  })

  it('tracks transparent CommonJS, promisified child-process, and created-require aliases', async () => {
    const test = await fixture(`
      import { execFile } from 'node:child_process'
      import { createRequire } from 'node:module'
      import { promisify } from 'node:util'
      const fs = (require('node:fs') as typeof import('node:fs'))
      const read = (require('node:fs').readFileSync)
      const { existsSync } = (require('node:fs'))
      const execFileAsync = (promisify((execFile)))
      const localRequire = createRequire(import.meta.url)
      const createdFs = localRequire('node:fs')
      void fs.readFileSync('data.json')
      void read('data.json')
      void existsSync('data.json')
      void createdFs.readFileSync('data.json')
      void execFileAsync('node', ['src/worker.ts'])
    `)
    await test.writeTracked('data.json', '{}\n')
    await test.writeTracked('src/worker.ts', 'export {}\n')
    const result = audit(test)
    expect(result.callSites.filter(({ api }) => api.startsWith('fs.'))).toHaveLength(4)
    expect(result.repositoryInputs).toEqual(['data.json', 'src/worker.ts'])
  })

  it.each([
    [
      'filesystem namespace as a call argument',
      `
        import * as fs from 'node:fs'
        function consumeFilesystem(namespace: typeof fs): void {
          void namespace.readFileSync('outside-protected-boundary.json', 'utf8')
        }
        consumeFilesystem(fs)
      `,
    ],
    [
      'runtime API as a call argument',
      `import { readFileSync } from 'node:fs'; function consume(value: unknown) { void value }; consume(readFileSync)`,
    ],
    [
      'filesystem namespace as a new argument',
      `import * as fs from 'node:fs'; class Holder { constructor(value: unknown) { void value } }; new Holder(fs)`,
    ],
    [
      'destructured namespace member',
      `import * as fs from 'node:fs'; const { readFileSync } = fs; void readFileSync`,
    ],
    [
      'namespace in an object',
      `import * as fs from 'node:fs'; const wrapped = { fs }; void wrapped`,
    ],
    [
      'API in an array',
      `import { readFileSync } from 'node:fs'; const wrapped = [readFileSync]; void wrapped`,
    ],
    [
      'returned namespace',
      `import * as fs from 'node:fs'; function expose() { return fs }; void expose`,
    ],
    [
      'returned API',
      `import { readFileSync } from 'node:fs'; const expose = () => readFileSync; void expose`,
    ],
    [
      'assigned namespace',
      `import * as fs from 'node:fs'; let escaped: unknown; escaped = fs; void escaped`,
    ],
    [
      'assigned API',
      `import { readFileSync } from 'node:fs'; let escaped: unknown; escaped = readFileSync; void escaped`,
    ],
    [
      'default-parameter namespace capture',
      `import * as fs from 'node:fs'; function consume(namespace = fs) { void namespace }; void consume`,
    ],
    [
      'callback API capture',
      `import { readFileSync } from 'node:fs'; function register(callback: () => unknown) { void callback }; register(() => readFileSync)`,
    ],
    [
      'child-process namespace as a call argument',
      `import * as childProcess from 'node:child_process'; function consume(value: unknown) { void value }; consume(childProcess)`,
    ],
    [
      'partially bound runtime API',
      `import { readFileSync } from 'node:fs'; const read = readFileSync.bind(undefined, 'outside-protected-boundary.json'); void read()`,
    ],
    [
      'immediately invoked promisified API',
      `import { exec } from 'node:child_process'; import { promisify } from 'node:util'; void promisify(exec)('cat /etc/passwd')`,
    ],
    [
      'returned promisified API',
      `import { exec } from 'node:child_process'; import { promisify } from 'node:util'; function expose() { return promisify(exec) }; void expose`,
    ],
    [
      'passed promisified API',
      `import { exec } from 'node:child_process'; import { promisify } from 'node:util'; function consume(value: unknown) { void value }; consume(promisify(exec))`,
    ],
    [
      'assigned promisified API',
      `import { exec } from 'node:child_process'; import { promisify } from 'node:util'; const holder: { run?: unknown } = {}; holder.run = promisify(exec)`,
    ],
    [
      'multi-argument promisify call',
      `import { exec, spawn } from 'node:child_process'; import { promisify } from 'node:util'; const run = promisify(exec, spawn); void run`,
    ],
  ])('rejects a bound runtime escape through %s', async (_label, source) => {
    const test = await fixture(source)
    expect(() => audit(test)).toThrow('Unsupported protected runtime binding escape')
  })

  it.each([
    ['inline CommonJS filesystem call', `void require('node:fs').readFileSync('/etc/passwd')`],
    [
      'inline CommonJS child-process call',
      `void require('node:child_process').execSync('cat /etc/passwd')`,
    ],
    [
      'inline created-require child-process call',
      `import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); void localRequire('node:child_process').execSync('cat /etc/passwd')`,
    ],
    ['dynamic filesystem import', `async function load() { return import('node:fs') }; void load`],
    ['direct filesystem re-export', `export { readFileSync as read } from 'node:fs'`],
    ['filesystem namespace re-export', `export * as fs from 'node:fs'`],
  ])('rejects unsupported runtime namespace acquisition through %s', async (_label, source) => {
    const test = await fixture(source)
    expect(() => audit(test)).toThrow(/Unsupported .*runtime namespace/u)
  })

  it.each([
    [
      'process getBuiltinModule filesystem acquisition',
      `void process.getBuiltinModule('fs').readFileSync('/etc/passwd')`,
    ],
    [
      'computed process getBuiltinModule alias',
      `const property = 'getBuiltin' + 'Module'; const getBuiltin = process[property]; const fs = getBuiltin('fs'); void fs.readFileSync('/etc/passwd')`,
    ],
    [
      'globalThis process getBuiltinModule',
      `const fs = globalThis.process.getBuiltinModule('fs'); void fs.readFileSync('/etc/passwd')`,
    ],
    [
      'assembled process mainModule require',
      `const property = 're' + 'quire'; const localRequire = process.mainModule[property]; void localRequire('./dependency')`,
    ],
    [
      'bracket process mainModule require',
      `const property = 're' + 'quire'; const localRequire = process['mainModule'][property]; void localRequire('./dependency')`,
    ],
    [
      'imported process namespace',
      `import processApi from 'node:process'; const fs = processApi.getBuiltinModule('fs'); void fs.readFileSync('/etc/passwd')`,
    ],
    [
      'created-require process namespace',
      `import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const processApi = localRequire('node:process'); void processApi`,
    ],
    [
      'created-require node:module namespace',
      `import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const moduleApi = localRequire('node:module'); const property = 'create' + 'Require'; const nestedRequire = moduleApi[property](import.meta.url); void nestedRequire('./dependency')`,
    ],
    [
      'created-require bare module namespace',
      `import { createRequire } from 'node:module'; const localRequire = createRequire(import.meta.url); const moduleApi = localRequire('module'); const property = 'create' + 'Require'; const nestedRequire = moduleApi[property](import.meta.url); void nestedRequire('./dependency')`,
    ],
  ])('rejects runtime loader acquisition through %s', async (_label, source) => {
    const test = await fixture(source)
    expect(() => audit(test)).toThrow(
      /Unsupported (?:.*runtime-loader|.*process namespace|.*runtime module namespace|node:process)/u,
    )
  })

  it.each([
    [
      `import * as fs from 'node:fs'; const method = 'readFileSync'; const read = fs[method]; void read('data.json')`,
      'Unsupported protected runtime binding escape',
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
