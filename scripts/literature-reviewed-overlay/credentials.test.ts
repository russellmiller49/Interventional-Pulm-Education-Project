/** @jest-environment node */

/**
 * Generic-credential kill tests: the production path must be unable to read, fall back to, or
 * even mention any credential surface other than the three dedicated variables. These exist
 * because a mutation reviewer showed that adding a generic service-role fallback would not
 * have failed the previous suites.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { resolveDestinationBinding } from '../literature-production-ingest/config'
import { DESTINATION_ENV_NAMES } from './constants'

const PACKAGE_ROOT = join(process.cwd(), 'scripts/literature-reviewed-overlay')

const FORBIDDEN_VARIABLES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'LITERATURE_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

describe('destination binding resolution', () => {
  const APPROVED = {
    [DESTINATION_ENV_NAMES.url]: 'https://itcttmkxdxvwmwcmzmey.supabase.co/',
    [DESTINATION_ENV_NAMES.projectRef]: 'itcttmkxdxvwmwcmzmey',
    [DESTINATION_ENV_NAMES.secret]: 'sb_secret_test_only_value',
  }

  it('accepts exactly the three dedicated variables', () => {
    const binding = resolveDestinationBinding(APPROVED, true)
    expect(binding?.projectRef).toBe('itcttmkxdxvwmwcmzmey')
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
})
