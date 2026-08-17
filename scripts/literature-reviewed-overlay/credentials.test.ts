/** @jest-environment node */

/**
 * Generic-credential kill tests: the production path must be unable to read, fall back to, or
 * even mention any credential surface other than the three dedicated variables.
 *
 * Two layers, because a mutation reviewer showed each alone is insufficient:
 *
 *   1. OPERATIONAL partial-configuration tests — realistic environments where a partial
 *      dedicated configuration sits beside a generic value that a fallback would silently
 *      adopt. Every one must fail closed and construct no transport. These are the tests that
 *      die when a fallback is inserted: the mutation matrix below proves it by compiling each
 *      realistic fallback edit of the real resolver source and showing the operational
 *      expectation fails against it.
 *   2. Source-text discipline — the production modules name no generic variable, and the
 *      resolver reads the environment only through the dedicated names. Defense in depth, not
 *      a substitute for layer 1.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveDestinationBinding } from '../literature-production-ingest/config'
import { DESTINATION_ENV_NAMES } from './constants'
import { PostgrestOverlayTransport } from './transport'

const PACKAGE_ROOT = join(process.cwd(), 'scripts/literature-reviewed-overlay')
const CONFIG_PATH = join(process.cwd(), 'scripts/literature-production-ingest/config.ts')

const FORBIDDEN_VARIABLES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

const APPROVED_URL = 'https://itcttmkxdxvwmwcmzmey.supabase.co/'
const APPROVED_REF = 'itcttmkxdxvwmwcmzmey'
const APPROVED = {
  [DESTINATION_ENV_NAMES.url]: APPROVED_URL,
  [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
  [DESTINATION_ENV_NAMES.secret]: 'sb_secret_test_only_value',
}

type Resolver = typeof resolveDestinationBinding

/**
 * The complete operational expectation for one hostile environment, mirroring the CLI's
 * createTransport flow: the resolver must throw (fail closed), no binding may exist, and no
 * transport — and therefore no network client — may be constructed.
 */
function expectFailClosedWithoutTransport(
  resolver: Resolver,
  environment: Record<string, string>,
): void {
  let fetchCalls = 0
  const trapFetch = (() => {
    fetchCalls += 1
    throw new Error('the transport trap must never be reached')
  }) as unknown as typeof fetch

  let transportConstructed = 0
  expect(() => {
    const binding = resolver(environment, true)
    if (binding !== null) {
      transportConstructed += 1
      void new PostgrestOverlayTransport({ binding, fetchImplementation: trapFetch })
    }
    return binding
  }).toThrow()
  expect(transportConstructed).toBe(0)
  expect(fetchCalls).toBe(0)
}

/**
 * The eight realistic partial/generic configurations. Each is a dedicated configuration with
 * exactly one leg missing and a generic variable holding a value a fallback would accept —
 * or a fully generic environment. Every one must fail closed as partial or prohibited.
 */
const PARTIAL_FALLBACK_SCENARIOS: ReadonlyArray<{
  name: string
  environment: Record<string, string>
}> = [
  {
    name: 'dedicated URL/ref present, secret only in SUPABASE_SERVICE_ROLE_KEY',
    environment: {
      [DESTINATION_ENV_NAMES.url]: APPROVED_URL,
      [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_generic_service_role',
    },
  },
  {
    name: 'dedicated URL/ref present, secret only in SUPABASE_SECRET_KEY',
    environment: {
      [DESTINATION_ENV_NAMES.url]: APPROVED_URL,
      [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
      SUPABASE_SECRET_KEY: 'sb_secret_generic_secret',
    },
  },
  {
    name: 'dedicated secret/ref present, URL only in NEXT_PUBLIC_SUPABASE_URL',
    environment: {
      [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
      [DESTINATION_ENV_NAMES.secret]: 'sb_secret_dedicated_value',
      NEXT_PUBLIC_SUPABASE_URL: APPROVED_URL,
    },
  },
  {
    name: 'dedicated secret/ref present, URL only in generic SUPABASE_URL',
    environment: {
      [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
      [DESTINATION_ENV_NAMES.secret]: 'sb_secret_dedicated_value',
      SUPABASE_URL: APPROVED_URL,
    },
  },
  {
    name: 'dedicated URL/secret present, ref only in generic SUPABASE_PROJECT_REF',
    environment: {
      [DESTINATION_ENV_NAMES.url]: APPROVED_URL,
      [DESTINATION_ENV_NAMES.secret]: 'sb_secret_dedicated_value',
      SUPABASE_PROJECT_REF: APPROVED_REF,
    },
  },
  {
    name: 'partial dedicated configuration beside NEXT_PUBLIC_SUPABASE_ANON_KEY',
    environment: {
      [DESTINATION_ENV_NAMES.url]: APPROVED_URL,
      [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOi.eyJpc3Mi.c2lnbmF0dXJl',
    },
  },
  {
    name: 'Endoreels generic URL/ref/key',
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
      SUPABASE_PROJECT_REF: 'tqnhxlwvkkswuckszlee',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_endoreels_value',
    },
  },
  {
    name: 'arbitrary generic project URL/ref/key',
    environment: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://someotherproject.supabase.co/',
      SUPABASE_PROJECT_REF: 'someotherproject',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_arbitrary_value',
    },
  },
]

describe('destination binding resolution', () => {
  it('accepts exactly the three dedicated variables', () => {
    const binding = resolveDestinationBinding(APPROVED, true)
    expect(binding?.projectRef).toBe(APPROVED_REF)
  })

  it.each(FORBIDDEN_VARIABLES.map((name) => [name] as const))(
    'refuses to fall back to %s alone',
    (name) => {
      expect(() =>
        resolveDestinationBinding({ [name]: 'sb_secret_or_url_whatever' }, true),
      ).toThrow(/Legacy destination configuration is not accepted|not configured/u)
      // Even when nothing is required, a legacy-only environment is an error, never a
      // silent null.
      expect(() =>
        resolveDestinationBinding({ [name]: 'sb_secret_or_url_whatever' }, false),
      ).toThrow(/Legacy destination configuration is not accepted/u)
    },
  )

  it('never reconciles a legacy variable beside the dedicated trio', () => {
    // The dedicated trio resolves; the legacy variable is not consulted at all — the binding
    // is built from the approved constants, not from any environment URL.
    const binding = resolveDestinationBinding(
      { ...APPROVED, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_other' },
      true,
    )
    expect(binding?.secret).toBe(APPROVED[DESTINATION_ENV_NAMES.secret])
  })

  it.each([
    [
      'an Endoreels URL',
      { ...APPROVED, [DESTINATION_ENV_NAMES.url]: 'https://tqnhxlwvkkswuckszlee.supabase.co/' },
    ],
    [
      'an Endoreels ref',
      { ...APPROVED, [DESTINATION_ENV_NAMES.projectRef]: 'tqnhxlwvkkswuckszlee' },
    ],
    ['a generic URL', { ...APPROVED, [DESTINATION_ENV_NAMES.url]: 'https://example.supabase.co/' }],
    ['a generic ref', { ...APPROVED, [DESTINATION_ENV_NAMES.projectRef]: 'someotherproject' }],
    ['a publishable key', { ...APPROVED, [DESTINATION_ENV_NAMES.secret]: 'sb_publishable_x' }],
    ['a JWT credential', { ...APPROVED, [DESTINATION_ENV_NAMES.secret]: 'eyJa.eyJb.c' }],
  ])('refuses %s', (_label, environment) => {
    expect(() => resolveDestinationBinding(environment, true)).toThrow(
      /Endoreels|does not match|sb_secret_/u,
    )
  })
})

describe('operational partial-configuration kill tests', () => {
  it.each(PARTIAL_FALLBACK_SCENARIOS.map((scenario) => [scenario.name, scenario] as const))(
    'fails closed and constructs no transport: %s',
    (_name, scenario) => {
      expectFailClosedWithoutTransport(resolveDestinationBinding, scenario.environment)
    },
  )
})

describe('realistic fallback mutations are killed by the operational tests', () => {
  // The TypeScript compiler compiles mutated resolver sources in-memory (jest CJS context).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const typescript = require('typescript') as {
    transpileModule: (
      source: string,
      options: { compilerOptions: Record<string, unknown> },
    ) => { outputText: string }
    ModuleKind: { CommonJS: number }
    ScriptTarget: { ES2022: number }
  }
  const configSource = readFileSync(CONFIG_PATH, 'utf8')

  function compileResolver(source: string): Resolver {
    const output = typescript.transpileModule(source, {
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2022,
      },
    }).outputText
    const moduleObject = { exports: {} as Record<string, unknown> }
    const localRequire = (specifier: string): unknown => {
      if (specifier === './constants') {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- sandbox linkage
        return require('../literature-production-ingest/constants')
      }
      throw new Error(`unexpected require from mutated resolver: ${specifier}`)
    }
    new Function('require', 'module', 'exports', output)(
      localRequire,
      moduleObject,
      moduleObject.exports,
    )
    return moduleObject.exports.resolveDestinationBinding as Resolver
  }

  const SECRET_READ = '  const secret = environment[DESTINATION_ENV_NAMES.secret]'
  const URL_READ = '  const url = environment[DESTINATION_ENV_NAMES.url]'
  const REF_READ = '  const projectRef = environment[DESTINATION_ENV_NAMES.projectRef]'
  const SECRET_PATTERN_LINE = 'const SERVER_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9._-]+$/u'

  interface FallbackMutation {
    name: string
    mutate: (source: string) => string
    /** Index into PARTIAL_FALLBACK_SCENARIOS whose expectation must kill this mutant. */
    killedByScenario: number
  }

  const MUTATIONS: FallbackMutation[] = [
    {
      name: 'secret falls back to SUPABASE_SERVICE_ROLE_KEY',
      mutate: (source) =>
        source.replace(SECRET_READ, `${SECRET_READ} ?? environment['SUPABASE_SERVICE_ROLE_KEY']`),
      killedByScenario: 0,
    },
    {
      name: 'secret falls back to SUPABASE_SECRET_KEY',
      mutate: (source) =>
        source.replace(SECRET_READ, `${SECRET_READ} ?? environment['SUPABASE_SECRET_KEY']`),
      killedByScenario: 1,
    },
    {
      name: 'URL falls back to NEXT_PUBLIC_SUPABASE_URL',
      mutate: (source) =>
        source.replace(URL_READ, `${URL_READ} ?? environment['NEXT_PUBLIC_SUPABASE_URL']`),
      killedByScenario: 2,
    },
    {
      name: 'URL falls back to generic SUPABASE_URL',
      mutate: (source) => source.replace(URL_READ, `${URL_READ} ?? environment['SUPABASE_URL']`),
      killedByScenario: 3,
    },
    {
      name: 'project ref falls back to generic SUPABASE_PROJECT_REF',
      mutate: (source) =>
        source.replace(REF_READ, `${REF_READ} ?? environment['SUPABASE_PROJECT_REF']`),
      killedByScenario: 4,
    },
    {
      name: 'secret falls back to the anon key with a weakened credential pattern',
      mutate: (source) =>
        source
          .replace(SECRET_READ, `${SECRET_READ} ?? environment['NEXT_PUBLIC_SUPABASE_ANON_KEY']`)
          .replace(
            SECRET_PATTERN_LINE,
            'const SERVER_SECRET_PATTERN = ' +
              '/^(?:sb_secret_[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.' +
              '[A-Za-z0-9_-]+)$/u',
          ),
      killedByScenario: 5,
    },
    {
      name: 'full generic-trio fallback with the legacy refusal removed',
      mutate: (source) =>
        source
          .replace(URL_READ, `${URL_READ} ?? environment['NEXT_PUBLIC_SUPABASE_URL']`)
          .replace(REF_READ, `${REF_READ} ?? environment['SUPABASE_PROJECT_REF']`)
          .replace(SECRET_READ, `${SECRET_READ} ?? environment['SUPABASE_SERVICE_ROLE_KEY']`)
          .replace('if (legacyConfigured) {', 'if (legacyConfigured && false) {'),
      killedByScenario: 2,
    },
  ]

  it('the pristine resolver source contains every mutation anchor', () => {
    // If the resolver is refactored, the mutations must be re-anchored rather than silently
    // testing nothing.
    expect(configSource).toContain(SECRET_READ)
    expect(configSource).toContain(URL_READ)
    expect(configSource).toContain(REF_READ)
    expect(configSource).toContain(SECRET_PATTERN_LINE)
  })

  it('the pristine resolver, recompiled the same way, passes every operational test', () => {
    const pristine = compileResolver(configSource)
    for (const scenario of PARTIAL_FALLBACK_SCENARIOS) {
      expectFailClosedWithoutTransport(pristine, scenario.environment)
    }
  })

  it.each(MUTATIONS.map((mutation) => [mutation.name, mutation] as const))(
    'is killed by the partial-configuration suite: %s',
    (_name, mutation) => {
      const mutated = mutation.mutate(configSource)
      expect(mutated).not.toBe(configSource)
      const mutant = compileResolver(mutated)
      const scenario = PARTIAL_FALLBACK_SCENARIOS[mutation.killedByScenario]!

      // The fallback silently completes the partial configuration: the mutant resolves a
      // binding where the operational suite demands a refusal…
      expect(mutant(scenario.environment, true)).not.toBeNull()

      // …so the operational expectation itself fails against the mutant. This is the kill:
      // landing this fallback in the real resolver makes the suite above go red.
      expect(() => expectFailClosedWithoutTransport(mutant, scenario.environment)).toThrow()
    },
  )

  it('a fallback cannot reach Endoreels even when inserted: the identity pins still refuse', () => {
    // Wall two. Even with the URL fallback landed, a fallback value naming Endoreels is
    // refused by the byte-exact identity pins — and the suite still detects the mutant
    // itself through the approved-shaped scenario above.
    const urlFallbackMutant = compileResolver(MUTATIONS[2]!.mutate(configSource))
    expect(() =>
      urlFallbackMutant(
        {
          [DESTINATION_ENV_NAMES.projectRef]: APPROVED_REF,
          [DESTINATION_ENV_NAMES.secret]: 'sb_secret_dedicated_value',
          NEXT_PUBLIC_SUPABASE_URL: 'https://tqnhxlwvkkswuckszlee.supabase.co/',
        },
        true,
      ),
    ).toThrow(/Endoreels/u)

    // And a fully generic Endoreels environment stays refused even by the generic-trio
    // mutant: the dedicated names are entirely absent, so the resolver's absent-configuration
    // branch fails closed before any fallback value is trusted.
    const trioMutant = compileResolver(MUTATIONS[6]!.mutate(configSource))
    const endoreels = PARTIAL_FALLBACK_SCENARIOS[6]!
    expect(() => trioMutant(endoreels.environment, true)).toThrow(/not configured/u)
  })
})

describe('production source discipline', () => {
  it('names no generic credential variable anywhere in the production modules', () => {
    for (const moduleName of [
      'cli.ts',
      'transport.ts',
      'engine.ts',
      'constants.ts',
      'checkpoint.ts',
      'plan.ts',
      'projection.ts',
      'artifact.ts',
      'reviewed-set.ts',
      'identity.ts',
    ]) {
      const source = readFileSync(join(PACKAGE_ROOT, moduleName), 'utf8')
      const code = source
        .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/u, ''))
        .join('\n')
      for (const forbidden of FORBIDDEN_VARIABLES) {
        expect(code).not.toContain(forbidden)
      }
      // No direct environment reads outside the CLI either; the engine takes an injected
      // environment record.
      if (moduleName !== 'cli.ts') {
        expect(code).not.toMatch(/process\.env/u)
      }
    }
  })

  it('the resolver reads the environment only through the dedicated names', () => {
    // Defense in depth beside the operational tests: every realistic fallback edit indexes
    // the environment with a string literal (`environment['SUPABASE_…']`), while the pristine
    // resolver indexes only through DESTINATION_ENV_NAMES members and the legacy-refusal loop
    // variable. The credential-class pattern is likewise pinned byte-exactly.
    const code = readFileSync(CONFIG_PATH, 'utf8')
      .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/u, ''))
      .join('\n')
    expect(code).not.toMatch(/environment\[\s*['"`]/u)
    expect(code).toContain('const SERVER_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9._-]+$/u')
  })
})
