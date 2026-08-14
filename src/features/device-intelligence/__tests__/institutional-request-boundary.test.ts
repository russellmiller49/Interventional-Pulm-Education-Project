/**
 * @jest-environment node
 *
 * The request boundary's Proxy-rejection gate uses the host `structuredClone`, which the
 * jsdom test sandbox does not provide; these suites exercise `parseOverlayProjectionRequest`
 * and `adapter.project`, so they run in the Node environment where `structuredClone` is
 * present. Node 20 (the repository's pinned runtime) rejects Proxy exotic objects with a
 * `DataCloneError`, which is the structural boundary this file pins.
 */
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

/**
 * D2A-R3-C4-001. The plain-data snapshot is built entirely from reflection —
 * `Object.getPrototypeOf`, `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor` — and every
 * one of those operations is controlled by a Proxy's traps. A Proxy over an empty target can
 * therefore report `Object.prototype`, report the four keys of a valid confidential East
 * request, and return enumerable data descriptors carrying the corresponding values: it
 * passes the reflection-only snapshot and the strict schema while its underlying target owns
 * nothing. Before the correction both `parseOverlayProjectionRequest` and the sealed
 * adapter's `project` accepted such a Proxy — top level and nested — and returned the
 * confidential East projection with two capability records.
 *
 * A coherent Proxy can satisfy any finite reflection-only interrogation, so the correction
 * adds a structural non-Proxy gate: the request must survive `structuredClone`, which walks
 * the whole graph and refuses Proxy exotic objects with a `DataCloneError` no trap can
 * intercept. It runs only after the descriptor and schema checks, so ordinary getters are
 * still rejected as accessors rather than silently resolved into accepted data.
 */
describe('D2A-R3-C4-001 — Proxy carriers cannot synthesize a request accepted as plain data', () => {
  const CONFIDENTIAL_OR_FOREIGN = [
    'fictional-east-capability-beta',
    'fictional-east-capability-confidential-source',
    'fictional-east-diagnostic-confidential-capability',
    'fictional-site-west',
    'fictional-tenant-summit',
  ]

  const confidentialEastRequest = () => ({
    contextKind: 'institutional' as const,
    scope: { ...FICTIONAL_HARBOR_EAST_SCOPE },
    accessClassification: 'institution_confidential' as const,
    projectionTimestamp: PROJECTION_TIMESTAMP,
  })

  function refusalText(run: () => unknown): string {
    try {
      run()
    } catch (error) {
      return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    }
    throw new Error('Expected the request to be refused.')
  }

  function expectRefusedThroughBothEntryPoints(build: () => unknown): void {
    // A fresh carrier per entry point: a revoked or single-use vector cannot be replayed.
    expect(() => parseOverlayProjectionRequest(build())).toThrow()
    expect(() => adapter.project(build())).toThrow()
    const message = refusalText(() => adapter.project(build()))
    CONFIDENTIAL_OR_FOREIGN.forEach((value) => expect(message).not.toContain(value))
  }

  const dataDescriptor = (value: unknown): PropertyDescriptor => ({
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })

  const descriptorSynthesizingProxy = (source: Record<string, unknown>, target: object = {}) =>
    new Proxy(target, {
      getPrototypeOf: () => Object.prototype,
      ownKeys: () => Reflect.ownKeys(source),
      getOwnPropertyDescriptor: (_target, key) => dataDescriptor(Reflect.get(source, key)),
    })

  it('A. refuses a descriptor-synthesizing top-level Proxy over an empty target', () => {
    const target = {}
    // The underlying target owns nothing; only the traps synthesize the request shape.
    expect(Reflect.ownKeys(target)).toEqual([])
    expectRefusedThroughBothEntryPoints(() =>
      descriptorSynthesizingProxy(confidentialEastRequest(), target),
    )
    // Interrogation must not have populated the target either.
    expect(Reflect.ownKeys(target)).toEqual([])
  })

  it('B. refuses a transparent top-level Proxy around a valid request', () => {
    expectRefusedThroughBothEntryPoints(() => new Proxy(confidentialEastRequest(), {}))
    // The same holds for a transparent Proxy around a valid demo request.
    expectRefusedThroughBothEntryPoints(() => new Proxy(validDemoRequest(), {}))
  })

  it('C. refuses a descriptor-synthesizing nested-scope Proxy over an empty target', () => {
    const scopeTarget = {}
    expect(Reflect.ownKeys(scopeTarget)).toEqual([])
    expectRefusedThroughBothEntryPoints(() => ({
      ...confidentialEastRequest(),
      scope: descriptorSynthesizingProxy({ ...FICTIONAL_HARBOR_EAST_SCOPE }, scopeTarget),
    }))
    expect(Reflect.ownKeys(scopeTarget)).toEqual([])
  })

  it('D. refuses a transparent nested-scope Proxy around a valid scope', () => {
    expectRefusedThroughBothEntryPoints(() => ({
      ...confidentialEastRequest(),
      scope: new Proxy({ ...FICTIONAL_HARBOR_EAST_SCOPE }, {}),
    }))
  })

  it('E. refuses a descriptor-synthesizing Proxy over a null-prototype target', () => {
    // A Proxy that reports a null prototype is still a Proxy exotic object; the null-proto
    // acceptance contract is for genuine Object.create(null) data, not for a Proxy claiming
    // to be one.
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(Object.create(null) as object, {
          getPrototypeOf: () => null,
          ownKeys: () => Reflect.ownKeys(confidentialEastRequest()),
          getOwnPropertyDescriptor: (_target, key) =>
            dataDescriptor(Reflect.get(confidentialEastRequest(), key)),
        }),
    )
  })

  it('refuses a revoked Proxy through both entry points', () => {
    expect(() => {
      const { proxy, revoke } = Proxy.revocable(confidentialEastRequest(), {})
      revoke()
      return parseOverlayProjectionRequest(proxy)
    }).toThrow()
    expect(() => {
      const { proxy, revoke } = Proxy.revocable(confidentialEastRequest(), {})
      revoke()
      return adapter.project(proxy)
    }).toThrow()
  })

  it('refuses Proxies whose getPrototypeOf, ownKeys, or getOwnPropertyDescriptor traps throw', () => {
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => {
              throw new Error('trap-refused-get-prototype-of')
            },
          },
        ),
    )
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => Object.prototype,
            ownKeys: () => {
              throw new Error('trap-refused-own-keys')
            },
          },
        ),
    )
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => Object.prototype,
            ownKeys: () => ['contextKind'],
            getOwnPropertyDescriptor: () => {
              throw new Error('trap-refused-get-own-property-descriptor')
            },
          },
        ),
    )
  })

  it('refuses a Proxy that returns accessor descriptors', () => {
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => Object.prototype,
            ownKeys: () => ['contextKind'],
            getOwnPropertyDescriptor: () => ({
              get: () => 'demo',
              enumerable: true,
              configurable: true,
            }),
          },
        ),
    )
  })

  it('refuses a Proxy that returns non-enumerable descriptors', () => {
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => Object.prototype,
            ownKeys: () => ['contextKind'],
            getOwnPropertyDescriptor: () => ({
              value: 'demo',
              enumerable: false,
              configurable: true,
              writable: true,
            }),
          },
        ),
    )
  })

  it('refuses a Proxy that returns symbol keys', () => {
    const symbolKey = Symbol('contextKind')
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(
          {},
          {
            getPrototypeOf: () => Object.prototype,
            ownKeys: () => [symbolKey],
            getOwnPropertyDescriptor: () => dataDescriptor('demo'),
          },
        ),
    )
  })

  it('refuses a Proxy whose reported key set violates Proxy invariants', () => {
    // A non-extensible target forces ownKeys to report exactly the target's keys; reporting
    // extra keys makes the engine itself throw a TypeError when the trap result is read.
    expectRefusedThroughBothEntryPoints(
      () =>
        new Proxy(Object.preventExtensions({ contextKind: 'institutional' }), {
          ownKeys: () => ['contextKind', 'scope', 'accessClassification', 'projectionTimestamp'],
        }),
    )
  })

  it('still accepts ordinary valid requests and genuine null-prototype data', () => {
    // The gate must not narrow the accepted contract: plain and Object.create(null) data,
    // top level and nested scope, remain accepted.
    expect(() => adapter.project(validInstitutionalRequest())).not.toThrow()
    expect(() => adapter.project(validDemoRequest())).not.toThrow()

    const nullProtoRequest = Object.assign(Object.create(null), validInstitutionalRequest())
    expect(() => adapter.project(nullProtoRequest)).not.toThrow()

    const nullProtoScope = Object.assign(Object.create(null), { ...FICTIONAL_HARBOR_EAST_SCOPE })
    const projection = adapter.project({ ...validInstitutionalRequest(), scope: nullProtoScope })
    expect(projection.dataset.context.contextKind).toBe('institutional')

    const parsedDemo = parseOverlayProjectionRequest(validDemoRequest())
    expect(parsedDemo.contextKind).toBe('demo')
  })

  it('leaves adapter state unperturbed after a refused Proxy request', () => {
    const baseline = JSON.stringify(adapter.project(validInstitutionalRequest()))
    expect(() => adapter.project(new Proxy(confidentialEastRequest(), {}))).toThrow()
    expect(() =>
      adapter.project(descriptorSynthesizingProxy(confidentialEastRequest(), {})),
    ).toThrow()
    const after = JSON.stringify(adapter.project(validInstitutionalRequest()))
    expect(after).toBe(baseline)
  })
})
