import generatedReleaseBundlesJson from '../../../../data/ip-preference-cards/generated/release-bundles.json'
import seedReleaseBundlesJson from '../../../../data/ip-preference-cards/seed/release-bundles.json'

import {
  comparePublicationOrder,
  validateReleasePublicationInstants,
} from '../domain/definition-set-ledger'
import { parsePublishedReleaseInstant } from '../domain/published-instant'

/**
 * The canonical publication-instant contract (P92-C2b).
 *
 * Before this contract, publication order was a `localeCompare` over raw strings guarded
 * only by a null check: `"zzzz-not-a-date"` on a published release was accepted, sorted
 * after every real timestamp, participated in first-publisher attribution, and was written
 * into the generated bundle file by a zero-exit release generation. These tests pin the
 * whole grammar — what parses, what every rejection class looks like, that the valid string
 * survives byte-for-byte, and that ordering is chronological over parsed instants with the
 * release id as the deterministic tiebreak — plus the committed-data invariant that every
 * frozen release in the repository actually satisfies the contract.
 */

describe('parsePublishedReleaseInstant', () => {
  const REJECTED: Array<[label: string, value: unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['the empty string', ''],
    ['a whitespace-only string', ' '],
    ['unparseable text (the Codex reproduction)', 'zzzz-not-a-date'],
    ['a date-only value', '2026-08-11'],
    ['a timezone-less datetime', '2026-08-11T12:00:00'],
    ['an impossible month', '2026-13-01T00:00:00.000Z'],
    ['an impossible day', '2026-04-31T00:00:00.000Z'],
    ['an impossible leap day (2026 is not a leap year)', '2026-02-29T00:00:00.000Z'],
    ['hour 24', '2026-08-11T24:00:00.000Z'],
    ['minute 60', '2026-08-11T12:60:00.000Z'],
    ['second 60 (leap seconds are outside the contract)', '2026-08-11T12:00:60.000Z'],
    ['an impossible offset', '2026-08-11T12:00:00.000+99:99'],
    [
      'a valid-looking offset form (the contract is UTC-designated only)',
      '2026-08-11T12:00:00.000+01:00',
    ],
    ['a negative offset form', '2026-08-11T12:00:00.000-05:00'],
    ['trailing text', '2026-08-11T12:00:00.000Z (frozen)'],
    ['leading whitespace', ' 2026-08-11T12:00:00.000Z'],
    ['trailing whitespace', '2026-08-11T12:00:00.000Z '],
    ['a number', 1785456000000],
    ['a boolean', true],
    ['an object', { publishedAt: '2026-08-11T12:00:00.000Z' }],
    ['an array', ['2026-08-11T12:00:00.000Z']],
    ['a fractional point with no digits', '2026-08-11T12:00:00.Z'],
    ['a comma as the fraction separator', '2026-08-11T12:00:00,000Z'],
    ['a missing seconds component', '2026-08-11T12:00Z'],
    ['a lowercase time designator', '2026-08-11t12:00:00.000Z'],
    ['a lowercase UTC designator', '2026-08-11T12:00:00.000z'],
    ['a space in place of the T designator', '2026-08-11 12:00:00.000Z'],
    ['a two-digit year', '26-08-11T12:00:00.000Z'],
    ['a five-digit year', '02026-08-11T12:00:00.000Z'],
  ]

  it.each(REJECTED)('rejects %s', (_label, value) => {
    const parsed = parsePublishedReleaseInstant(value)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    // Every failure carries the raw value and a reason precise enough to act on.
    expect(parsed.raw).toBe(value)
    expect(parsed.reason.length).toBeGreaterThan(0)
    if (typeof value === 'string' && value.length > 0) {
      expect(parsed.reason).toContain(value)
    }
  })

  const ACCEPTED: Array<[value: string, epochMilliseconds: number]> = [
    // The three exact forms the committed release universe uses.
    ['2026-07-31T00:00:00.000Z', Date.UTC(2026, 6, 31, 0, 0, 0, 0)],
    ['2026-08-09T00:00:00.000Z', Date.UTC(2026, 7, 9, 0, 0, 0, 0)],
    ['2026-08-10T00:00:00.000Z', Date.UTC(2026, 7, 10, 0, 0, 0, 0)],
    // The plain UTC `Z` form without fractional seconds.
    ['2026-08-11T12:34:56Z', Date.UTC(2026, 7, 11, 12, 34, 56, 0)],
    // Fractional-second forms: shorter and longer than milliseconds, right-padded/truncated.
    ['2026-08-11T12:34:56.5Z', Date.UTC(2026, 7, 11, 12, 34, 56, 500)],
    ['2026-08-11T12:34:56.123456789Z', Date.UTC(2026, 7, 11, 12, 34, 56, 123)],
    // A real leap day parses (2024 is a leap year) — the calendar check is exact, not a ban.
    ['2024-02-29T23:59:59.999Z', Date.UTC(2024, 1, 29, 23, 59, 59, 999)],
    // The epoch itself, so the derivation is pinned at zero.
    ['1970-01-01T00:00:00Z', 0],
    ['1970-01-01T00:00:00.001Z', 1],
  ]

  it.each(ACCEPTED)('accepts %s at the exact instant', (value, epochMilliseconds) => {
    const parsed = parsePublishedReleaseInstant(value)
    expect(parsed).toEqual({ ok: true, raw: value, epochMilliseconds })
  })

  it('preserves the authored string byte-for-byte', () => {
    const value = '2026-07-31T00:00:00.000Z'
    const parsed = parsePublishedReleaseInstant(value)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    // `toBe` on purpose: the raw field is the same string, not a normalization of it.
    expect(parsed.raw).toBe(value)
  })

  it('derives four-digit years below 100 without the Date constructor 1900 remapping', () => {
    const parsed = parsePublishedReleaseInstant('0026-01-01T00:00:00Z')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(new Date(parsed.epochMilliseconds).getUTCFullYear()).toBe(26)
  })
})

describe('comparePublicationOrder over parsed instants (P92-C2b)', () => {
  it('orders chronologically, not lexicographically', () => {
    const releases = [
      { releaseBundleId: 'release-later', publishedAt: '2026-08-10T00:00:00.000Z' },
      { releaseBundleId: 'release-earlier', publishedAt: '2026-08-09T00:00:00.000Z' },
      { releaseBundleId: 'release-earliest', publishedAt: '2026-07-31T00:00:00.000Z' },
    ]
    expect([...releases].sort(comparePublicationOrder).map((r) => r.releaseBundleId)).toEqual([
      'release-earliest',
      'release-earlier',
      'release-later',
    ])
  })

  it('compares two formats of the same instant as equal and breaks the tie by release id', () => {
    // Raw-string comparison would put release-b first ("." sorts before "Z"); the canonical
    // ordering parses both to the same instant and falls to the id tiebreak.
    const left = { releaseBundleId: 'release-b-v1-0', publishedAt: '2026-08-11T00:00:00.000Z' }
    const right = { releaseBundleId: 'release-a-v1-0', publishedAt: '2026-08-11T00:00:00Z' }
    expect(comparePublicationOrder(left, right)).toBeGreaterThan(0)
    expect(comparePublicationOrder(right, left)).toBeLessThan(0)
    expect([left, right].sort(comparePublicationOrder)[0].releaseBundleId).toBe('release-a-v1-0')
  })

  it('orders sub-second precision chronologically across different fraction lengths', () => {
    const half = { releaseBundleId: 'release-half', publishedAt: '2026-08-11T00:00:00.5Z' }
    const tenth = { releaseBundleId: 'release-tenth', publishedAt: '2026-08-11T00:00:00.10Z' }
    expect(comparePublicationOrder(tenth, half)).toBeLessThan(0)
  })

  it('throws on a malformed instant, naming the release and the raw value', () => {
    const malformed = { releaseBundleId: 'release-ebus-tbna-v1-1', publishedAt: 'zzzz-not-a-date' }
    const valid = { releaseBundleId: 'release-a-v1-0', publishedAt: '2026-07-31T00:00:00.000Z' }
    for (const [left, right] of [
      [malformed, valid],
      [valid, malformed],
    ] as const) {
      expect(() => comparePublicationOrder(left, right)).toThrow('release-ebus-tbna-v1-1')
      expect(() => comparePublicationOrder(left, right)).toThrow('zzzz-not-a-date')
    }
  })

  it('throws on a null instant rather than ordering it', () => {
    const missing = { releaseBundleId: 'release-undated', publishedAt: null }
    const valid = { releaseBundleId: 'release-a-v1-0', publishedAt: '2026-07-31T00:00:00.000Z' }
    expect(() => comparePublicationOrder(missing, valid)).toThrow('release-undated')
  })
})

describe('validateReleasePublicationInstants', () => {
  it('passes a fully orderable frozen universe', () => {
    expect(
      validateReleasePublicationInstants([
        {
          releaseBundleId: 'release-a-v1-0',
          releaseState: 'published',
          publishedAt: '2026-07-31T00:00:00.000Z',
        },
        {
          releaseBundleId: 'release-b-v1-0',
          releaseState: 'retired',
          publishedAt: '2026-08-09T00:00:00Z',
        },
      ]),
    ).toEqual([])
  })

  it.each([
    ['a malformed value', 'zzzz-not-a-date'],
    ['a timezone-less value', '2026-08-09T00:00:00'],
    ['an impossible date', '2026-02-29T00:00:00.000Z'],
    ['null', null],
  ] as Array<[string, string | null]>)(
    'fails %s with the typed unorderable code naming release and value',
    (_label, publishedAt) => {
      const messages = validateReleasePublicationInstants([
        { releaseBundleId: 'release-broken-v1-0', releaseState: 'published', publishedAt },
      ])
      expect(messages.map((message) => message.code)).toEqual([
        'definition_set_attribution_unorderable_release',
      ])
      expect(messages[0].message).toContain('release-broken-v1-0')
      if (publishedAt !== null) expect(messages[0].message).toContain(publishedAt)
      expect(messages[0].message).toContain('publication order')
    },
  )

  it('reports one failure per unorderable release, alongside orderable ones', () => {
    const messages = validateReleasePublicationInstants([
      {
        releaseBundleId: 'release-fine-v1-0',
        releaseState: 'published',
        publishedAt: '2026-07-31T00:00:00.000Z',
      },
      { releaseBundleId: 'release-null-v1-0', releaseState: 'published', publishedAt: null },
      {
        releaseBundleId: 'release-junk-v1-0',
        releaseState: 'retired',
        publishedAt: 'zzzz-not-a-date',
      },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[0].message).toContain('release-null-v1-0')
    expect(messages[1].message).toContain('release-junk-v1-0')
  })
})

describe('committed frozen releases satisfy the publication-instant contract', () => {
  interface ReleaseLifecycleRecord {
    id: string
    releaseState: string
    publishedAt: string | null
  }

  const seedReleases = (seedReleaseBundlesJson as unknown as { releases: ReleaseLifecycleRecord[] })
    .releases
  const generatedBundles = (
    generatedReleaseBundlesJson as unknown as { bundles: ReleaseLifecycleRecord[] }
  ).bundles

  it('every frozen release in the authored seed carries a valid publication instant', () => {
    const frozen = seedReleases.filter((release) => release.releaseState !== 'draft')
    expect(frozen.length).toBeGreaterThan(0)
    for (const release of frozen) {
      const parsed = parsePublishedReleaseInstant(release.publishedAt)
      expect(`${release.id}: ${parsed.ok ? 'ok' : parsed.reason}`).toBe(`${release.id}: ok`)
    }
  })

  it('every frozen release in the generated bundles carries the identical valid instant', () => {
    const frozen = generatedBundles.filter((bundle) => bundle.releaseState !== 'draft')
    expect(frozen.length).toBeGreaterThan(0)
    const seedById = new Map(seedReleases.map((release) => [release.id, release]))
    for (const bundle of frozen) {
      const parsed = parsePublishedReleaseInstant(bundle.publishedAt)
      expect(`${bundle.id}: ${parsed.ok ? 'ok' : parsed.reason}`).toBe(`${bundle.id}: ok`)
      // The generated file carries the authored value byte-for-byte — generation validates
      // publication instants, it never rewrites them.
      expect(bundle.publishedAt).toBe(seedById.get(bundle.id)?.publishedAt)
    }
  })
})
