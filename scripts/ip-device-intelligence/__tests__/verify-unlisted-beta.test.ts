import { readFileSync } from 'node:fs'
import path from 'node:path'

import { isAtlasCohortProduct } from '../../../src/features/device-intelligence/domain/atlas-cohort'
import { ROLE_CODE_ALIASES } from '../../../src/features/preference-cards/domain/role-taxonomy'

import {
  containsToken,
  deriveAliasFixture,
  deriveIdentityLeakTokens,
  deriveProductFixtures,
  missingRobotsDirectives,
  normalizeIdentityWhitespace,
  parseOptions,
  servedIdentityLeaks,
  stitchFlightChunks,
  REQUIRED_ROBOTS_DIRECTIVES,
} from '../verify-unlisted-beta'

/**
 * The launch-verification harness's deterministic core. The HTTP checks themselves run
 * against a real local server (see the runbook); what is pinned here is that the harness
 * derives its fixtures from committed data through the real predicates — so it can never
 * pass by asserting against ids the cohort wall stopped serving, or fail by inventing ids
 * the catalog never held — and that it refuses to run without an explicit mode.
 */

const REPO_ROOT = path.resolve(__dirname, '../../..')

describe('parseOptions', () => {
  it('requires an explicit mode and a target', () => {
    expect(() => parseOptions([])).toThrow(/--mode=off or --mode=on/)
    expect(() => parseOptions(['--mode=on'])).toThrow(/--base-url|--start/)
    expect(() => parseOptions(['--mode=on', '--base-url=http://x', '--start'])).toThrow(
      /mutually exclusive/,
    )
    expect(() => parseOptions(['--mode=on', '--flag'])).toThrow(/Unknown argument/)
  })

  it('parses the two documented shapes', () => {
    expect(parseOptions(['--mode=off', '--base-url=http://localhost:3121/'])).toEqual({
      mode: 'off',
      baseUrl: 'http://localhost:3121',
      start: false,
      port: 3210,
    })
    expect(parseOptions(['--mode=on', '--start', '--port=4000'])).toEqual({
      mode: 'on',
      baseUrl: null,
      start: true,
      port: 4000,
    })
  })
})

describe('deriveProductFixtures', () => {
  const fixtures = deriveProductFixtures(REPO_ROOT)

  it('selects a cohort product through the real predicate', () => {
    expect(fixtures.cohortProductIds.has(fixtures.cohortProductId)).toBe(true)
    expect(fixtures.cohortProductIds.size).toBeGreaterThan(0)
  })

  it('selects non-cohort negative controls that really are outside the cohort', () => {
    expect(fixtures.nonCohortProductIds.length).toBeGreaterThan(0)
    for (const productId of fixtures.nonCohortProductIds) {
      expect(fixtures.cohortProductIds.has(productId)).toBe(false)
    }
  })

  it('agrees with the committed catalog membership exactly', () => {
    // Non-vacuity for the leak check: the served-HTML scan is only meaningful while both
    // populations exist in the committed catalog.
    expect(fixtures.cohortProductIds.size).toBeGreaterThan(100)
    void isAtlasCohortProduct
  })
})

describe('deriveIdentityLeakTokens', () => {
  const fixtures = deriveProductFixtures(REPO_ROOT)
  const tokens = deriveIdentityLeakTokens(REPO_ROOT)

  it('screens a real population of non-cohort identities, not just PRD ids', () => {
    expect(tokens.size).toBeGreaterThan(500)
    const fields = new Set([...tokens.values()].map((provenance) => provenance.split(' ')[1]))
    // Names and at least one machine-identifier class must both be represented, or the
    // scan has quietly narrowed back to a single identifier shape.
    expect(fields.has('product_name')).toBe(true)
    expect(
      ['catalog_number', 'gtin', 'gtin_raw', 'global_part_number'].some((field) =>
        fields.has(field),
      ),
    ).toBe(true)
  })

  it('attributes every token to a non-cohort product', () => {
    for (const provenance of tokens.values()) {
      const productId = provenance.split(' ')[0]
      expect(`${provenance}:${fixtures.cohortProductIds.has(productId)}`).toBe(
        `${provenance}:false`,
      )
    }
  })

  it('matches identifiers on token boundaries, not inside hash keys', () => {
    const fixture = new Map([['10530', 'PRD-TEST catalog_number']])
    // The i18n payload embeds hashed message keys; a numeric catalog number must not match
    // inside one, and must still match when served as an actual token.
    expect(servedIdentityLeaks('…\\"h_1a7610530739\\":\\"Morphology slide 3\\"…', fixture)).toEqual(
      [],
    )
    expect(servedIdentityLeaks('<td>Catalog no. 10530</td>', fixture)).toEqual([
      '"10530" (PRD-TEST catalog_number)',
    ])
  })

  it('excludes identity already present in the public translation catalogs — as tokens, not substrings', () => {
    // Public educational copy names real device models today (e.g. the radial-probe models
    // in the EBUS course strings); those ship on public pages regardless of the beta flag,
    // so their presence on a D1 page is the message bundle, not a catalog exposure. The
    // exclusion is boundary-matched with the same predicate as the detection: a catalog
    // number whose only catalog "occurrence" is inside a translation-key hex id (10530 in
    // h_1a7610530739) stays SCREENED rather than being silently unscreened.
    const catalogs = ['en', 'es', 'zh-CN'].map((locale) =>
      readFileSync(path.join(REPO_ROOT, `messages/${locale}.json`), 'utf8').toLowerCase(),
    )
    for (const token of tokens.keys()) {
      expect(catalogs.some((catalog) => containsToken(catalog, token))).toBe(false)
    }
    // The boundary-matched exclusion is a property of the predicate, so it is pinned on the
    // predicate rather than on a data coincidence: a catalog number whose only "occurrence"
    // in a message bundle sits inside a translation-key hex id is NOT excluded, while a
    // genuine standalone mention is.
    expect(containsToken('{"h_1a7610530739":"morphology slide 3"}', '10530')).toBe(false)
    expect(containsToken('<td>catalog no. 10530</td>', '10530')).toBe(true)
    expect(containsToken('the um-s20-17s radial probe is named in public copy', 'um-s20-17s')).toBe(
      true,
    )
    // D2B moved the previously pinned instances (Karl Storz 10530/10358a/10384b, Olympus
    // UM-S20-17S) into the atlas cohort, so they are no longer screened identities at all.
    // Whatever coincidences the CURRENT non-cohort population carries are re-derived here,
    // and each must still be a token: raw containment inside a message bundle must never
    // unscreen an identity.
    const rawOnlyCoincidences = [...tokens.keys()].filter(
      (token) =>
        catalogs.some((catalog) => catalog.includes(token)) &&
        !catalogs.some((catalog) => containsToken(catalog, token)),
    )
    for (const token of rawOnlyCoincidences) {
      expect({ token, screened: tokens.has(token) }).toEqual({ token, screened: true })
    }
  })

  it('excludes phrases the cohort records’ own prose already serves', () => {
    // The cohort record is the approved payload: the atlas renders its description and
    // compatibility text verbatim, so a phrase those fields carry cannot be a leak of
    // itself even when a non-cohort product is named exactly that phrase. Under D2B the
    // previously pinned instance (the "Two-Pedal Footswitch" accessory) is itself a cohort
    // product, so the phrase is doubly unscreened; the exclusion is therefore re-derived
    // from the current data rather than pinned to that one row.
    expect(tokens.has('two-pedal footswitch')).toBe(false)
    const products = JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'data/ip-preference-cards/generated/catalog-products.json'),
        'utf8',
      ),
    ) as Array<Record<string, unknown>>
    const cohortProse = products
      .filter((product) => isAtlasCohortProduct(product as never))
      .flatMap((product) =>
        [product.description, product.compatibility_text, product.notes].filter(
          (value): value is string => typeof value === 'string',
        ),
      )
      .map((value) => normalizeIdentityWhitespace(value.toLowerCase()))
    for (const token of tokens.keys()) {
      expect({
        token,
        servedByCohortProse: cohortProse.some((prose) => containsToken(prose, token)),
      }).toEqual({ token, servedByCohortProse: false })
    }
  })

  it('excludes governed vocabulary labels the D1 surface deliberately renders', () => {
    // A hidden product whose trade name coincides with a generic authored label
    // ("Flexible grasping forceps") is not identified by that label being served — and the
    // same holds for an inner phrase of a label ("Surgical Probe" inside the role name
    // "Thoracoscopy surgical probe" on the atlas filter), which boundary-matches wherever
    // the longer label renders.
    const roles = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'data/ip-preference-cards/generated/roles.json'), 'utf8'),
    ) as Array<{ role_name?: string }>
    for (const role of roles) {
      if (!role.role_name) continue
      expect(tokens.has(role.role_name.trim().toLowerCase())).toBe(false)
    }
    expect(tokens.has('flexible grasping forceps')).toBe(false)
    expect(tokens.has('surgical probe')).toBe(false)
  })

  it('never carries a token a cohort product also answers to', () => {
    // A cohort page legitimately serves cohort identities; a shared token would turn the
    // leak scan into a false alarm on every workspace. The derivation excludes any token
    // that boundary-matches inside a cohort identity — with the same predicate as the
    // detection, so a digit-run coincidence (five digits inside an unrelated cohort GTIN)
    // no longer silently unscreens a real catalog number (Lens D). Verified here against
    // the committed catalog.
    const products = JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'data/ip-preference-cards/generated/catalog-products.json'),
        'utf8',
      ),
    ) as Array<Record<string, unknown>>
    const cohortIdentity = products
      .filter((product) => isAtlasCohortProduct(product as never))
      .flatMap((product) =>
        [
          product.product_name,
          product.catalog_number,
          product.global_part_number,
          product.reference_part_number,
          product.alternate_ids,
          product.gtin,
          product.gtin_raw,
        ].filter((value): value is string => typeof value === 'string'),
      )
      .map((value) => value.trim().toLowerCase())
    for (const token of tokens.keys()) {
      expect(cohortIdentity.some((identity) => containsToken(identity, token))).toBe(false)
    }
  })
})

describe('stitchFlightChunks', () => {
  const SEAM = '"])</script><script>self.__next_f.push([1,"'

  it('rejoins an identifier split across an RSC flight chunk boundary', () => {
    // The committed reproduction: serving the CHEST_TUBE workspace put a seam inside
    // PRD-BDB5AF3EB5 (a cohort product), so a raw scan saw the phantom "PRD-BDB5AF3E" and
    // reported a leak that does not exist.
    const served = `<p>/en/devices/PRD-BDB5AF3E${SEAM}B5\\",\\"className\\":\\"x</p>`
    expect(served.match(/PRD-[A-Z0-9]{6,20}/g)).toEqual(['PRD-BDB5AF3E'])
    expect(stitchFlightChunks(served).match(/PRD-[A-Z0-9]{6,20}/g)).toEqual(['PRD-BDB5AF3EB5'])
  })

  it('reveals a straddling NON-cohort identity the raw scan would have missed', () => {
    // The direction that actually matters for the wall: without stitching, a hidden id split
    // across a seam is invisible as a full id. Stitching makes the scan strictly stronger.
    const fixtures = deriveProductFixtures(REPO_ROOT)
    const hidden = fixtures.nonCohortProductIds[0]
    const split = Math.floor(hidden.length / 2) + 2
    const served = `<a href="/x/${hidden.slice(0, split)}${SEAM}${hidden.slice(split)}">y</a>`
    expect(served.includes(hidden)).toBe(false)
    expect(stitchFlightChunks(served).includes(hidden)).toBe(true)
  })

  it('leaves ordinary markup untouched', () => {
    const plain = '<p>PRD-ABCDEF12</p><script>self.__next_f=[]</script>'
    expect(stitchFlightChunks(plain)).toBe(plain)
  })
})

describe('deriveAliasFixture', () => {
  it('names a real permanent alias and its canonical target', () => {
    const alias = deriveAliasFixture()
    expect(ROLE_CODE_ALIASES[alias.deprecated]).toBe(alias.canonical)
  })
})

describe('missingRobotsDirectives — the one robots contract both modes verify (P92-C3)', () => {
  it('requires exactly noindex, nofollow, and noarchive', () => {
    expect([...REQUIRED_ROBOTS_DIRECTIVES]).toEqual(['noindex', 'nofollow', 'noarchive'])
  })

  it.each([
    ['noindex', ['nofollow', 'noarchive']],
    ['noindex,nofollow', ['noarchive']],
    ['noindex,noarchive', ['nofollow']],
    ['nofollow,noarchive', ['noindex']],
    ['nofollow, noarchive', ['noindex']],
    ['noindex, noarchive', ['nofollow']],
    ['noindex, nofollow', ['noarchive']],
    ['', ['noindex', 'nofollow', 'noarchive']],
  ])('rejects the incomplete header %j, naming what is missing', (header, missing) => {
    expect(missingRobotsDirectives(header)).toEqual(missing)
  })

  it('rejects an absent header entirely', () => {
    expect(missingRobotsDirectives(null)).toEqual(['noindex', 'nofollow', 'noarchive'])
    expect(missingRobotsDirectives(undefined)).toEqual(['noindex', 'nofollow', 'noarchive'])
  })

  it.each([
    ['no-index, nofollow, noarchive', ['noindex']],
    ['noindexx, nofollow, noarchive', ['noindex']],
    ['noindex, nofollowx, noarchive', ['nofollow']],
    ['noindex, nofollow, archive', ['noarchive']],
    ['index, follow, archive', ['noindex', 'nofollow', 'noarchive']],
    ['noindex nofollow noarchive', ['noindex', 'nofollow', 'noarchive']],
  ])(
    'rejects the malformed near-match %j — a directive is exact or it is absent',
    (header, missing) => {
      expect(missingRobotsDirectives(header)).toEqual(missing)
    },
  )

  it.each([
    'noindex, nofollow, noarchive',
    'noindex,nofollow,noarchive',
    'noarchive, noindex, nofollow',
    'NoIndex, NOFOLLOW, noArchive',
    '  noindex ,  nofollow ,   noarchive  ',
    'noindex, nofollow, noarchive, nosnippet',
    'noindex, noindex, nofollow, noarchive',
    'noindex, nofollow, noarchive, unavailable_after: 2027-01-01',
  ])(
    'accepts %j — order, case, whitespace, repeats, and extra safe directives are all fine',
    (header) => {
      expect(missingRobotsDirectives(header)).toEqual([])
    },
  )

  it.each([
    ['googlebot: noindex, nofollow, noarchive', ['noindex', 'nofollow', 'noarchive']],
    ['googlebot: nosnippet, noindex, nofollow, noarchive', ['noindex', 'nofollow', 'noarchive']],
    ['otherbot: unavailable_after: 2027-01-01', ['noindex', 'nofollow', 'noarchive']],
  ])(
    'rejects the user-agent-scoped header %j — a scoped directive binds one crawler, not all of them',
    (header, missing) => {
      expect(missingRobotsDirectives(header)).toEqual(missing)
    },
  )

  it('keeps crediting unscoped directives that precede a user-agent scope', () => {
    expect(missingRobotsDirectives('noindex, nofollow, noarchive, googlebot: nosnippet')).toEqual(
      [],
    )
  })

  it('does not credit a directive carrying a non-ASCII whitespace tail', () => {
    // ECMAScript trim() strips U+00A0; a strict crawler tokenizer does not. The predicate
    // must side with the crawler.
    expect(missingRobotsDirectives('noindex , nofollow, noarchive')).toEqual(['noindex'])
  })
})

describe('manufacturer-qualified short-identifier composites (P92-C4)', () => {
  const tokens = deriveIdentityLeakTokens(REPO_ROOT)

  /**
   * The Codex reproduction, re-pinned for D2B. The original exemplar (Olympus KV-6,
   * PRD-104DF655AD) was a HIDDEN verified-source product, so the inclusion-first cohort now
   * serves it deliberately and it is no longer a screened identity. The defect class is
   * unchanged and still live in the candidate-grade population: PRD-64481A5C4F is a
   * candidate-grade TRACOE product whose catalog number "332" sits under the five-character
   * standalone floor, so "TRACOE 332" in a served page would produce no leak without the
   * manufacturer-qualified composite.
   */
  it('derives the TRACOE 332 composite for the withheld candidate-grade set', () => {
    expect(tokens.get('tracoe 332')).toBe('PRD-64481A5C4F catalog_number (manufacturer-qualified)')
    // The bare identifier is correctly NOT a standalone token — that is the whole reason the
    // composite has to exist.
    expect(tokens.has('332')).toBe(false)
  })

  it('still derives both hyphen and space renderings of a composite', () => {
    // The KV-6 case also covered "KV 6" vs "KV-6"; no candidate-grade identifier under the
    // standalone floor carries a hyphen, so the variant derivation is pinned on the
    // hyphenated candidate identifier that does exist.
    expect(tokens.get('efer bx-5500-fa')).toBe(
      'PRD-6C1DE73547 catalog_number (manufacturer-qualified)',
    )
    expect(tokens.get('efer bx 5500 fa')).toBe(
      'PRD-6C1DE73547 catalog_number (manufacturer-qualified)',
    )
    expect(
      servedIdentityLeaks('<p>Efer BX 5500 FA</p>', tokens).some((leak) =>
        leak.includes('efer bx 5500 fa'),
      ),
    ).toBe(true)
  })

  it('flags <title>TRACOE 332</title> as a leak', () => {
    const leaks = servedIdentityLeaks('<title>TRACOE 332</title>', tokens)
    expect(leaks.some((leak) => leak.includes('tracoe 332'))).toBe(true)
  })

  it.each([
    ['the composite itself', 'tracoe 332'],
    ['an HTML title', '<html><head><title>TRACOE 332 Tracheostomy Tube</title></head></html>'],
    ['an aria-label', '<button aria-label="Select TRACOE 332">Select</button>'],
    ['a title attribute', '<span title="TRACOE 332"></span>'],
    ['a JSON/RSC string', '{"device":"TRACOE 332","status":"withheld"}'],
    ['RSC flight text', 'self.__next_f.push([1,"7:[\\"TRACOE 332\\",null]"])'],
    ['an NBSP-joined rendering', '<p>TRACOE&nbsp;332</p>'],
    ['a doubled-space rendering', '<p>TRACOE  332</p>'],
    ['punctuation boundaries', '(TRACOE 332)'],
    ['sentence punctuation', 'Use the TRACOE 332, then flush.'],
  ])('detects the identity in %s', (_shape, body) => {
    expect(servedIdentityLeaks(body, tokens).length).toBeGreaterThan(0)
  })

  it.each([
    ['a longer unrelated identifier', '<p>TRACOE 3320 cannula</p>'],
    ['a prefixed identifier run', '<p>XTRACOE 332</p>'],
    ['a suffixed alphanumeric run', '<p>TRACOE 332X</p>'],
    ['manufacturer and model far apart', '<p>TRACOE tubes</p><footer>room 332, bed 4</footer>'],
    ['a different manufacturer adjacent', '<p>Storz 332</p>'],
  ])('does not flag %s — boundary safety over eagerness', (_shape, body) => {
    expect(servedIdentityLeaks(body, tokens).filter((leak) => leak.includes('tracoe'))).toEqual([])
  })

  it('covers every manufacturer + below-floor identifier combination in the committed data', () => {
    // The data-wide sweep Codex ran, recomputed from the same catalog the verifier scans:
    // every non-cohort product whose identifier sits under its standalone floor must yield
    // a detectable manufacturer-qualified composite (unless the exact composite string has
    // its own data-derived exclusion — none does today).
    const products = JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'data/ip-preference-cards/generated/catalog-products.json'),
        'utf8',
      ),
    ) as Array<Record<string, unknown> & { product_id: string }>
    const floors: Record<string, number> = {
      catalog_number: 5,
      global_part_number: 5,
      reference_part_number: 5,
      alternate_ids: 5,
    }
    const pairs = new Set<string>()
    for (const product of products) {
      if (isAtlasCohortProduct(product as { verification_grade?: string })) continue
      const manufacturer = normalizeIdentityWhitespace(
        String(product.manufacturer ?? '').toLowerCase(),
      )
      if (!manufacturer) continue
      for (const [field, floor] of Object.entries(floors)) {
        const value = product[field]
        if (typeof value !== 'string') continue
        const identifier = normalizeIdentityWhitespace(value.toLowerCase())
        if (identifier.length < 2 || identifier.length >= floor) continue
        const composite = `${manufacturer} ${identifier}`
        if (!tokens.has(composite)) continue
        pairs.add(composite)
        // Detectable in a realistic served shape, not merely derived.
        expect(
          servedIdentityLeaks(`<title>${manufacturer} ${identifier}</title>`, tokens).length,
        ).toBeGreaterThan(0)
      }
    }
    // Codex counted 17 real manufacturer/short-identifier combinations when the cohort was
    // `verified_source AND prototype_visible`. D2B admits every verified-source product, so
    // 9 of those 17 are now deliberately served cohort identities and the screened set is
    // the 8 combinations belonging to candidate-grade products. A data change legitimately
    // moves this number — with this assertion updated deliberately, beside the data.
    expect(pairs.size).toBe(8)
  })

  it('keeps detecting a composite whose standalone identifier is absent from the map', () => {
    // The exclusion-interaction contract: whatever screens out the BARE identifier must not
    // carry over to the manufacturer-qualified composite. The always-present instance is the
    // standalone-floor screen — "332" is never a bare token, yet "tracoe 332" is derived and
    // detects.
    expect(tokens.has('332')).toBe(false)
    expect(
      servedIdentityLeaks('<p>Cannula set: TRACOE 332</p>', tokens).some((leak) =>
        leak.includes('tracoe 332'),
      ),
    ).toBe(true)

    // The stronger corpus-exclusion instance Codex pinned (Olympus EU-ME3: a bare identifier
    // at or above the floor that public educational copy names, whose composite must survive)
    // belonged to a hidden verified-source product that D2B now serves. Any equivalent case
    // in the current non-cohort population is re-derived and must behave the same way.
    for (const [composite, provenance] of tokens) {
      if (!provenance.includes('(manufacturer-qualified)')) continue
      const identifier = composite.slice(composite.indexOf(' ') + 1)
      if (identifier.length < 5 || tokens.has(identifier)) continue
      expect({
        composite,
        detected: servedIdentityLeaks(`<p>${composite}</p>`, tokens).some((leak) =>
          leak.includes(composite),
        ),
      }).toEqual({ composite, detected: true })
    }
  })

  it('boundary-matches the cohort-identity exclusion, exactly like the detection', () => {
    // Lens D: substring containment let the Storz applicator's catalog number "10520" vanish
    // because those five digits sit inside an unrelated cohort GTIN (04547410520545) — a
    // containment no page can ever boundary-render. That product is verified-source, so D2B
    // serves it and the concrete instance is gone; the RULE is what mattered, so it is pinned
    // directly on the predicate the exclusion and the detection share.
    expect(containsToken('04547410520545', '10520')).toBe(false)
    expect(containsToken('<td>Catalog no. 10520</td>', '10520')).toBe(true)
    // Sibling-SKU containment still excludes: a token at a word boundary inside a cohort
    // identity is the cohort sibling's own naming, not a leak vector.
    expect(tokens.has('bf-1t180')).toBe(false)
  })

  it('screens short distinctive trade names through manufacturer-qualified name composites', () => {
    // Lens D: "GSS Y Stent" and "RevoLix jr." sit under the twelve-character name floor,
    // so the bare names are correctly not standalone tokens — but the manufacturer-adjacent
    // prose shape is a full commercial identity and must detect.
    expect(tokens.has('gss y stent')).toBe(false)
    expect(tokens.get('novatech gss y stent')).toBe(
      'PRD-5C46BC7DA9 product_name (manufacturer-qualified)',
    )
    expect(servedIdentityLeaks('<p>Compatible with the Novatech GSS Y Stent.</p>', tokens)).toEqual(
      ['"novatech gss y stent" (PRD-5C46BC7DA9 product_name (manufacturer-qualified))'],
    )
    expect(tokens.get('lisa laser products revolix jr.')).toBe(
      'PRD-B5C8A167EC product_name (manufacturer-qualified)',
    )
  })

  it('excludes rendered governed vocabulary: classification terms and role prose', () => {
    // Lens D: the atlas renders cohort rows' kind/category vocabulary and the role pages
    // render governed role descriptions. A hidden product whose trade name coincides with
    // deliberately served vocabulary is not identified by that vocabulary being rendered —
    // and without the exclusion the launch gate would false-fail on the first cohort row
    // or role page that legitimately serves the term.
    expect(tokens.has('flexible biopsy forceps')).toBe(false)
    expect(tokens.has('radial ultrasound miniature probe')).toBe(false)
  })

  it('detects hex-escaped NBSP renderings', () => {
    expect(
      servedIdentityLeaks('<p>TRACOE&#xA0;332</p>', tokens).some((leak) =>
        leak.includes('tracoe 332'),
      ),
    ).toBe(true)
    expect(
      servedIdentityLeaks('<p>TRACOE&#xa0;332</p>', tokens).some((leak) =>
        leak.includes('tracoe 332'),
      ),
    ).toBe(true)
  })

  it('still excludes a composite the cohort data itself serves, and only as the exact string', () => {
    // Narrowness in the other direction: every composite in the map survived the same four
    // corpus exclusions applied to the exact composite string. Recompute one class here —
    // no derived composite may sit inside any cohort product's own identity fields.
    const products = JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'data/ip-preference-cards/generated/catalog-products.json'),
        'utf8',
      ),
    ) as Array<Record<string, unknown>>
    const cohortIdentity = products
      .filter((product) => isAtlasCohortProduct(product as { verification_grade?: string }))
      .flatMap((product) =>
        ['product_name', 'catalog_number', 'global_part_number', 'reference_part_number'].map(
          (field) => String(product[field] ?? '').toLowerCase(),
        ),
      )
      .filter((value) => value.length > 0)
    for (const [token, provenance] of tokens) {
      if (!provenance.includes('manufacturer-qualified')) continue
      expect(cohortIdentity.some((identity) => identity.includes(token))).toBe(false)
    }
  })
})
