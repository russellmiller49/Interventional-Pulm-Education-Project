/** @jest-environment node */

import {
  APPROVED_PROJECT_REF,
  APPROVED_PROJECT_URL,
  DESTINATION_ENV_NAMES,
  PROHIBITED_ENDOREELS_REF,
} from './constants'
import { assertNoCredentialArguments, resolveDestinationBinding } from './config'

const VALID_SECRET = 'sb_secret_SYNTHETIC_TEST_VALUE'

function validEnvironment(): Record<string, string> {
  return {
    [DESTINATION_ENV_NAMES.url]: APPROVED_PROJECT_URL,
    [DESTINATION_ENV_NAMES.projectRef]: APPROVED_PROJECT_REF,
    [DESTINATION_ENV_NAMES.secret]: VALID_SECRET,
  }
}

function capturedError(operation: () => unknown): string {
  try {
    operation()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('Expected operation to fail.')
}

describe('destination binding', () => {
  it('allows entirely absent optional configuration', () => {
    expect(resolveDestinationBinding({}, false)).toBeNull()
  })

  it('requires the complete dedicated configuration when requested', () => {
    expect(() => resolveDestinationBinding({}, true)).toThrow(/not configured/u)
    expect(() =>
      resolveDestinationBinding({ [DESTINATION_ENV_NAMES.url]: APPROVED_PROJECT_URL }, false),
    ).toThrow(/partial/iu)
    expect(() => resolveDestinationBinding({ [DESTINATION_ENV_NAMES.url]: '' }, false)).toThrow(
      /partial/iu,
    )
  })

  it('returns only the exact approved destination', () => {
    expect(resolveDestinationBinding(validEnvironment(), true)).toEqual({
      url: APPROVED_PROJECT_URL,
      projectRef: APPROVED_PROJECT_REF,
      secret: VALID_SECRET,
    })
  })

  it.each([
    'http://itcttmkxdxvwmwcmzmey.supabase.co/',
    'https://itcttmkxdxvwmwcmzmey.supabase.co',
    'https://example.invalid/',
    'https://itcttmkxdxvwmwcmzmey.supabase.co/rest/v1',
    'https://user@example.invalid/',
  ])('rejects arbitrary or altered URL %s', (url) => {
    expect(() =>
      resolveDestinationBinding({ ...validEnvironment(), [DESTINATION_ENV_NAMES.url]: url }, true),
    ).toThrow(/destination URL/u)
  })

  it('rejects Endoreels by URL or project ref', () => {
    expect(() =>
      resolveDestinationBinding(
        {
          ...validEnvironment(),
          [DESTINATION_ENV_NAMES.url]: `https://${PROHIBITED_ENDOREELS_REF}.supabase.co/`,
        },
        true,
      ),
    ).toThrow(/Endoreels/u)
    expect(() =>
      resolveDestinationBinding(
        {
          ...validEnvironment(),
          [DESTINATION_ENV_NAMES.projectRef]: PROHIBITED_ENDOREELS_REF,
        },
        true,
      ),
    ).toThrow(/Endoreels/u)
  })

  it.each([
    'sb_publishable_SYNTHETIC',
    'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.SYNTHETIC',
    'legacy-service-role-value',
    'anon',
    '',
  ])('rejects non-secret key form without reflecting it: %s', (secret) => {
    const message = capturedError(() =>
      resolveDestinationBinding(
        { ...validEnvironment(), [DESTINATION_ENV_NAMES.secret]: secret },
        true,
      ),
    )
    if (secret) expect(message).not.toContain(secret)
  })

  it('rejects legacy-only environment names without reading their values', () => {
    const legacyValue = 'legacy-value-that-must-not-appear'
    const message = capturedError(() =>
      resolveDestinationBinding({ SUPABASE_SERVICE_ROLE_KEY: legacyValue }, false),
    )
    expect(message).toMatch(/Legacy destination configuration/u)
    expect(message).not.toContain(legacyValue)
  })
})

describe('credential argument rejection', () => {
  it('allows ordinary operator arguments', () => {
    expect(() =>
      assertNoCredentialArguments(['canary', '--checkpoint', '/tmp/synthetic-checkpoint.json']),
    ).not.toThrow()
  })

  it.each([
    ['--secret', VALID_SECRET],
    [`--secret=${VALID_SECRET}`],
    ['--supabase-url=https://example.invalid'],
    ['--project-ref=synthetic'],
    [`${DESTINATION_ENV_NAMES.secret}=anon`],
    ['--unrelated', 'sb_publishable_SYNTHETIC'],
  ])('rejects target or credential arguments without exposing values', (...arguments_) => {
    const message = capturedError(() => assertNoCredentialArguments(arguments_))
    for (const argument of arguments_) {
      if (argument.includes('sb_')) expect(message).not.toContain(argument)
    }
    expect(message).toMatch(/environment variables/u)
  })
})
