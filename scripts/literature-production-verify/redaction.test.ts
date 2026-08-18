/** @jest-environment node */

/**
 * A verification tool that holds a privileged credential has exactly one unforgivable bug, and it
 * is not a wrong verdict. These tests are about the other one.
 */

import {
  REDACTED,
  assertNoCredentialInArgument,
  clearRegisteredSecretsForTesting,
  looksLikeCredential,
  redact,
  redactDeep,
  redactedJson,
  registerSecret,
} from './lib/redaction'

/** Structurally shaped like the real thing, and not a real credential. */
const SECRET_KEY = 'sb_secret_TESTONLYaaaaaaaaaaaaaaaaaaaaaaaa'
const PUBLISHABLE_KEY = 'sb_publishable_TESTONLYbbbbbbbbbbbbbbbb'
const LEGACY_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.TESTONLYsignature'

beforeEach(() => {
  clearRegisteredSecretsForTesting()
})

describe('shape-based redaction', () => {
  it('scrubs a secret key that was never registered', () => {
    // The point: a credential this process never took ownership of — one echoed back by the
    // target in an error body — is still scrubbed.
    expect(redact(`apikey=${SECRET_KEY} failed`)).not.toContain('TESTONLY')
  })

  it.each([
    ['secret key', SECRET_KEY],
    ['publishable key', PUBLISHABLE_KEY],
    ['legacy service-role JWT', LEGACY_JWT],
  ])('scrubs a %s', (_label, credential) => {
    const output = redact(`the value is ${credential} and nothing else`)
    expect(output).toContain(REDACTED)
    expect(output).not.toContain(credential)
  })

  it('scrubs a Supabase auth cookie', () => {
    const cookie = 'sb-itcttmkxdxvwmwcmzmey-auth-token=base64-TESTONLYsessionblob'
    expect(redact(`Cookie: ${cookie}`)).not.toContain('TESTONLYsessionblob')
  })
})

describe('registered-literal redaction', () => {
  it('scrubs a credential whose shape this file has never seen', () => {
    // A future key model, an opaque token, anything. Registration is what covers the unknown.
    const opaque = 'zzz-some-future-credential-model-0000'
    registerSecret(opaque)
    expect(redact(`header ${opaque} tail`)).toBe(`header ${REDACTED} tail`)
  })

  it('ignores values too short to be a credential', () => {
    registerSecret('ab')
    // Otherwise redaction becomes a find-and-replace that mangles every message it touches.
    expect(redact('abstract table')).toBe('abstract table')
  })

  it('replaces a longer registered secret whole rather than in pieces', () => {
    registerSecret('sb_secret_OUTER')
    registerSecret('sb_secret_OUTER_EXTENDED')
    expect(redact('sb_secret_OUTER_EXTENDED')).toBe(REDACTED)
  })
})

describe('structural redaction', () => {
  it('scrubs values, nested values, and array entries', () => {
    registerSecret(SECRET_KEY)
    const output = redactDeep({
      headers: { apikey: SECRET_KEY },
      trail: [{ note: `used ${SECRET_KEY}` }],
      count: 25,
    })
    expect(JSON.stringify(output)).not.toContain('TESTONLY')
    expect((output as { count: number }).count).toBe(25)
  })

  it('scrubs object keys too', () => {
    // A target's error body can put a credential in a key position, and a value-only redactor
    // would write it straight out.
    registerSecret(SECRET_KEY)
    const output = redactDeep({ [SECRET_KEY]: 'duplicate key value violates constraint' })
    expect(Object.keys(output as object)).toEqual([REDACTED])
  })

  it('produces receipts with no credential in them', () => {
    registerSecret(SECRET_KEY)
    const receipt = redactedJson({
      target: { url: 'https://itcttmkxdxvwmwcmzmey.supabase.co/', credentialPresent: true },
      detail: `Authorization: Bearer ${SECRET_KEY}`,
    })
    expect(receipt).not.toContain(SECRET_KEY)
    expect(receipt).toContain('credentialPresent')
  })
})

describe('credentials are refused on the command line', () => {
  it.each([
    ['a bare value', ['--secret', SECRET_KEY]],
    ['a joined value', [`--secret=${SECRET_KEY}`]],
    ['a legacy JWT', ['--key', LEGACY_JWT]],
  ])('refuses %s', (_label, argumentValues) => {
    const refusal = assertNoCredentialInArgument(argumentValues)
    expect(refusal).not.toBeNull()
    // The offending value is never echoed back, not even redacted.
    expect(refusal?.message).not.toContain('TESTONLY')
    expect(refusal?.message).toMatch(/environment/u)
  })

  it('refuses a registered secret passed as an ordinary-looking argument', () => {
    registerSecret('a-perfectly-ordinary-looking-token')
    expect(assertNoCredentialInArgument(['--pmid', 'a-perfectly-ordinary-looking-token'])).not.toBe(
      null,
    )
  })

  it('accepts the arguments the CLI actually takes', () => {
    expect(
      assertNoCredentialInArgument([
        '--scenario',
        'canary',
        '--pmid',
        '40123456',
        '--keyword',
        'bronchoscopy',
        '--receipt',
        'evidence/canary.json',
      ]),
    ).toBeNull()
  })

  it('does not treat the canonical project URL as a credential', () => {
    expect(looksLikeCredential('https://itcttmkxdxvwmwcmzmey.supabase.co/')).toBe(false)
  })

  it('is not confused by repeated checks', () => {
    // The patterns carry /g, so `test` is stateful via lastIndex. A second identical call must
    // give the same answer as the first.
    expect(looksLikeCredential(SECRET_KEY)).toBe(true)
    expect(looksLikeCredential(SECRET_KEY)).toBe(true)
  })
})
