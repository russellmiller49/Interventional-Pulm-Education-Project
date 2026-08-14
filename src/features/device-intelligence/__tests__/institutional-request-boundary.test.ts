import {
  accessAllows,
  parseOverlayProjectionRequest,
} from '@/features/device-intelligence/institutional/contracts'
import { createFictionalInstitutionalOverlayReadAdapter } from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import {
  FICTIONAL_DEMO_CONTEXT,
  FICTIONAL_HARBOR_EAST_SCOPE,
} from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * D2A-C3: the access gate must parse, never coerce. Pre-correction, `accessAllows`
 * consulted `hasOwnProperty` with the raw value, so property-key coercion invoked
 * `toString`/`Symbol.toPrimitive` and arrays, boxed strings, and converter objects that
 * coerced to a valid classification were allowed.
 *
 * D2A-C4: projection requests must be plain own-property data objects. Pre-correction,
 * zod resolved inherited values, so `Object.create(validRequest)` — owning no field at
 * all — was accepted, as were reserved JavaScript property names as identifiers.
 */

const PROJECTION_TIMESTAMP = '2026-08-12T12:00:00.000Z'
const adapter = createFictionalInstitutionalOverlayReadAdapter()

const validInstitutionalRequest = () => ({
  contextKind: 'institutional' as const,
  scope: { ...FICTIONAL_HARBOR_EAST_SCOPE },
  accessClassification: 'institution_restricted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const validDemoRequest = () => ({
  contextKind: 'demo' as const,
  demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId,
  accessClassification: 'public_unlisted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

describe('D2A-C3 — access gate refuses every coercible non-string', () => {
  const coercibles: Array<[string, unknown]> = [
    ['array wrapping a valid value', ['institution_restricted']],
    ['boxed String', new String('institution_restricted')],
    ['Date', new Date(0)],
    ['number', 1],
    ['boolean', true],
    ['null', null],
    ['undefined', undefined],
    ['symbol', Symbol('institution_restricted')],
    ['toString carrier', { toString: () => 'institution_restricted' }],
    ['valueOf carrier', { valueOf: () => 'institution_restricted' }],
    ['Symbol.toPrimitive carrier', { [Symbol.toPrimitive]: () => 'institution_restricted' }],
    ['proxy over a plain object', new Proxy({}, { get: () => 'institution_restricted' })],
    ['empty string', ''],
    ['unknown string', 'institution_public'],
    ['case variant', 'INSTITUTION_RESTRICTED'],
    ['whitespace-padded valid value', ' institution_restricted '],
  ]

  it.each(coercibles)('denies %s in either position', (_label, value) => {
    expect(accessAllows(value, 'institution_restricted')).toBe(false)
    expect(accessAllows('institution_restricted', value)).toBe(false)
    expect(accessAllows(value, value)).toBe(false)
    expect(accessAllows('institution_confidential', value)).toBe(false)
    expect(accessAllows(value, 'public_unlisted')).toBe(false)
  })

  it('preserves the exact valid access matrix', () => {
    const matrix: Array<[string, string, boolean]> = [
      ['public_unlisted', 'public_unlisted', true],
      ['public_unlisted', 'institution_restricted', false],
      ['public_unlisted', 'institution_confidential', false],
      ['institution_restricted', 'public_unlisted', false],
      ['institution_restricted', 'institution_restricted', true],
      ['institution_restricted', 'institution_confidential', false],
      ['institution_confidential', 'public_unlisted', false],
      ['institution_confidential', 'institution_restricted', true],
      ['institution_confidential', 'institution_confidential', true],
    ]
    matrix.forEach(([projection, record, expected]) => {
      expect(accessAllows(projection, record)).toBe(expected)
    })
  })
})

describe('D2A-C4 — projection requests must be plain own-property data objects', () => {
  it('refuses a request whose every field is inherited', () => {
    expect(() => adapter.project(Object.create(validInstitutionalRequest()))).toThrow()
    expect(() => adapter.project(Object.create(validDemoRequest()))).toThrow()
    expect(() => parseOverlayProjectionRequest(Object.create(validDemoRequest()))).toThrow()
  })

  it('refuses class instances, functions, and exotic built-ins', () => {
    class RequestLike {
      contextKind = 'demo' as const
      demoContextId = FICTIONAL_DEMO_CONTEXT.demoContextId
      accessClassification = 'public_unlisted' as const
      projectionTimestamp = PROJECTION_TIMESTAMP
    }
    expect(() => adapter.project(new RequestLike())).toThrow()
    const requestFunction = Object.assign(() => undefined, validDemoRequest())
    expect(() => adapter.project(requestFunction)).toThrow()
    expect(() => adapter.project([validDemoRequest()])).toThrow()
    expect(() => adapter.project(new Date(0))).toThrow()
    expect(() => adapter.project(new Map(Object.entries(validDemoRequest())))).toThrow()
    expect(() => adapter.project(new Set([validDemoRequest()]))).toThrow()
    expect(() => adapter.project('institutional')).toThrow()
    expect(() => adapter.project(null)).toThrow()
    expect(() => adapter.project(undefined)).toThrow()
  })

  it('refuses a request with a partial own layer over an inherited valid request', () => {
    const partial = Object.create(validInstitutionalRequest()) as Record<string, unknown>
    partial.accessClassification = 'institution_confidential'
    expect(() => adapter.project(partial)).toThrow()
  })

  it('refuses a nested scope whose fields are inherited', () => {
    expect(() =>
      adapter.project({
        ...validInstitutionalRequest(),
        scope: Object.create({ ...FICTIONAL_HARBOR_EAST_SCOPE }),
      }),
    ).toThrow()
    class ScopeLike {
      tenantId = FICTIONAL_HARBOR_EAST_SCOPE.tenantId
      institutionId = FICTIONAL_HARBOR_EAST_SCOPE.institutionId
      siteId = FICTIONAL_HARBOR_EAST_SCOPE.siteId
    }
    expect(() =>
      adapter.project({ ...validInstitutionalRequest(), scope: new ScopeLike() }),
    ).toThrow()
  })

  it('refuses accessor, symbol-keyed, and non-enumerable properties', () => {
    const withGetter = {
      ...validDemoRequest(),
    }
    Object.defineProperty(withGetter, 'projectionTimestamp', {
      get: () => PROJECTION_TIMESTAMP,
      enumerable: true,
      configurable: true,
    })
    expect(() => adapter.project(withGetter)).toThrow()

    const withSymbol = { ...validDemoRequest(), [Symbol('extra')]: 'x' }
    expect(() => adapter.project(withSymbol)).toThrow()

    const withHidden = { ...validDemoRequest() }
    Object.defineProperty(withHidden, 'hidden', {
      value: 'x',
      enumerable: false,
      configurable: true,
    })
    expect(() => adapter.project(withHidden)).toThrow()
  })

  it('does not read a polluted Object.prototype to satisfy a missing field', () => {
    const pollutedKey = 'accessClassification'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Object.prototype as any)[pollutedKey] = 'institution_confidential'
    try {
      const request: Record<string, unknown> = validInstitutionalRequest()
      delete request[pollutedKey]
      expect(() => adapter.project(request)).toThrow()
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Object.prototype as any)[pollutedKey]
    }
  })

  it('refuses reserved JavaScript property names as scope identifiers', () => {
    for (const reserved of [
      'toString',
      'constructor',
      'valueOf',
      '__proto__',
      'hasOwnProperty',
      'prototype',
    ]) {
      expect(() =>
        adapter.project({
          contextKind: 'institutional',
          scope: { tenantId: reserved, institutionId: reserved, siteId: reserved },
          accessClassification: 'institution_restricted',
          projectionTimestamp: PROJECTION_TIMESTAMP,
        }),
      ).toThrow()
      expect(() =>
        adapter.project({
          contextKind: 'demo',
          demoContextId: reserved,
          accessClassification: 'public_unlisted',
          projectionTimestamp: PROJECTION_TIMESTAMP,
        }),
      ).toThrow()
    }
  })

  it('still accepts plain data requests, including a null-prototype object', () => {
    expect(() => adapter.project(validInstitutionalRequest())).not.toThrow()
    expect(() => adapter.project(validDemoRequest())).not.toThrow()
    // Object.create(null) cannot inherit anything, so it is an accepted prototype.
    const nullProto = Object.assign(Object.create(null), validDemoRequest())
    expect(() => adapter.project(nullProto)).not.toThrow()
    const nullProtoScope = Object.assign(Object.create(null), {
      ...FICTIONAL_HARBOR_EAST_SCOPE,
    })
    expect(() =>
      adapter.project({ ...validInstitutionalRequest(), scope: nullProtoScope }),
    ).not.toThrow()
  })

  it('is unaffected by request mutation after parsing, and failed requests alter nothing', () => {
    const request = validInstitutionalRequest()
    const first = adapter.project(request)
    request.accessClassification = 'institution_confidential' as never
    request.scope.siteId = 'fictional-site-west' as never
    const second = adapter.project(validInstitutionalRequest())
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))

    expect(() => adapter.project({})).toThrow()
    const third = adapter.project(validInstitutionalRequest())
    expect(JSON.stringify(third)).toBe(JSON.stringify(first))
  })
})

/**
 * D2A-R2-C4-001. A JSON payload whose only own key is `__proto__` reaches the plain-data
 * boundary legitimately: its prototype is `Object.prototype` and the key is an own,
 * enumerable data property. Copying it into a `{}` destination with `copy[key] = value`
 * routed that key through the setter inherited from `Object.prototype`, installing the
 * supplied request as the snapshot's prototype. The snapshot then had no own keys — so
 * strict unknown-key checking saw nothing — while every required field resolved through
 * the prototype, and a confidential projection was returned.
 */
describe('D2A-R2-C4-001 — __proto__ carriers cannot mutate the validation snapshot', () => {
  const CONFIDENTIAL_OR_FOREIGN = [
    'fictional-east-capability-beta',
    'fictional-east-capability-confidential-source',
    'fictional-east-diagnostic-confidential-capability',
    'fictional-site-west',
    'fictional-tenant-summit',
  ]

  function refusalText(run: () => unknown): string {
    try {
      run()
    } catch (error) {
      return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    }
    throw new Error('Expected the request to be refused.')
  }

  it('refuses a top-level JSON __proto__ carrier through both entry points', () => {
    const payload = JSON.parse(`{"__proto__":${JSON.stringify(validInstitutionalRequest())}}`)

    // The payload genuinely satisfies the advertised plain-data-object contract.
    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype)
    expect(Reflect.ownKeys(payload)).toEqual(['__proto__'])
    expect(Object.prototype.hasOwnProperty.call(payload, '__proto__')).toBe(true)

    expect(() => parseOverlayProjectionRequest(payload)).toThrow()
    expect(() => adapter.project(payload)).toThrow()

    const message = refusalText(() => adapter.project(payload))
    CONFIDENTIAL_OR_FOREIGN.forEach((value) => expect(message).not.toContain(value))
  })

  it('refuses a nested-scope JSON __proto__ carrier through both entry points', () => {
    const request = {
      ...validInstitutionalRequest(),
      scope: JSON.parse(`{"__proto__":${JSON.stringify(FICTIONAL_HARBOR_EAST_SCOPE)}}`),
    }
    expect(Reflect.ownKeys(request.scope)).toEqual(['__proto__'])

    expect(() => parseOverlayProjectionRequest(request)).toThrow()
    expect(() => adapter.project(request)).toThrow()

    const message = refusalText(() => adapter.project(request))
    CONFIDENTIAL_OR_FOREIGN.forEach((value) => expect(message).not.toContain(value))
  })

  it('refuses a null-prototype carrier whose defined __proto__ holds the request', () => {
    const payload = Object.create(null) as Record<string, unknown>
    Object.defineProperty(payload, '__proto__', {
      value: validInstitutionalRequest(),
      enumerable: true,
      writable: true,
      configurable: true,
    })
    expect(Reflect.ownKeys(payload)).toEqual(['__proto__'])

    expect(() => parseOverlayProjectionRequest(payload)).toThrow()
    expect(() => adapter.project(payload)).toThrow()

    const nestedPayload = Object.create(null) as Record<string, unknown>
    Object.defineProperty(nestedPayload, '__proto__', {
      value: { ...FICTIONAL_HARBOR_EAST_SCOPE },
      enumerable: true,
      writable: true,
      configurable: true,
    })
    expect(() =>
      adapter.project({ ...validInstitutionalRequest(), scope: nestedPayload }),
    ).toThrow()
  })

  it('leaves Object.prototype unpolluted after every refused carrier', () => {
    const probe = {} as Record<string, unknown>
    expect(probe.contextKind).toBeUndefined()
    expect(probe.scope).toBeUndefined()
    expect(probe.accessClassification).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'contextKind')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'scope')).toBe(false)
  })

  it('still accepts a valid request and a valid scope built on a null prototype', () => {
    // The correction must not close the hole by rejecting null-prototype data objects,
    // which the boundary contract explicitly accepts.
    const nullProtoRequest = Object.assign(Object.create(null), validInstitutionalRequest())
    expect(() => adapter.project(nullProtoRequest)).not.toThrow()

    const nullProtoScope = Object.assign(Object.create(null), { ...FICTIONAL_HARBOR_EAST_SCOPE })
    const projection = adapter.project({
      ...validInstitutionalRequest(),
      scope: nullProtoScope,
    })
    expect(projection.dataset.context.contextKind).toBe('institutional')
  })
})
