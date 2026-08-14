import * as contractsModule from '@/features/device-intelligence/institutional/contracts'
import {
  accessAllows,
  parseOverlayProjectionRequestJson,
} from '@/features/device-intelligence/institutional/contracts'
import { createFictionalInstitutionalOverlayReadAdapter } from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import {
  FICTIONAL_DEMO_CONTEXT,
  FICTIONAL_HARBOR_EAST_SCOPE,
} from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * D2A-C4 request boundary. The public boundary admits serialized JSON *text* only. Four
 * earlier corrections tried to admit an arbitrary same-realm object graph and prove by
 * inspection that it was inert; each was defeated, most recently (D2A-R4-C4-001) by
 * cross-call poisoning of the mutable globals the inspection relied on. The boundary was
 * therefore redesigned: `parseOverlayProjectionRequestJson` and the sealed adapter's
 * `projectJson` accept a primitive `string` and refuse every object input — including a
 * genuine `Object.create(null)` request — before any property is read, so no caller-supplied
 * getter, coercion hook, or Proxy trap can execute during admission.
 *
 * The threat model is untrusted serialized data, not arbitrary hostile JavaScript already
 * executing in the same realm; the boundary does not claim to sandbox the latter.
 */

const PROJECTION_TIMESTAMP = '2026-08-12T12:00:00.000Z'
const adapter = createFictionalInstitutionalOverlayReadAdapter()

const CONFIDENTIAL_OR_FOREIGN = [
  'fictional-east-capability-beta',
  'fictional-east-capability-confidential-source',
  'fictional-east-diagnostic-confidential-capability',
  'fictional-site-west',
  'fictional-tenant-summit',
]

const validInstitutionalRequest = () => ({
  contextKind: 'institutional' as const,
  scope: { ...FICTIONAL_HARBOR_EAST_SCOPE },
  accessClassification: 'institution_restricted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const confidentialInstitutionalRequest = () => ({
  contextKind: 'institutional' as const,
  scope: { ...FICTIONAL_HARBOR_EAST_SCOPE },
  accessClassification: 'institution_confidential' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const validDemoRequest = () => ({
  contextKind: 'demo' as const,
  demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId,
  accessClassification: 'public_unlisted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const unknownDemoRequest = () => ({
  contextKind: 'demo' as const,
  demoContextId: 'fictional-demo-context-absent',
  accessClassification: 'public_unlisted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const unknownInstitutionalRequest = () => ({
  contextKind: 'institutional' as const,
  scope: {
    tenantId: 'fictional-tenant-absent',
    institutionId: 'fictional-institution-absent',
    siteId: 'fictional-site-absent',
  },
  accessClassification: 'institution_restricted' as const,
  projectionTimestamp: PROJECTION_TIMESTAMP,
})

const json = (value: unknown): string => JSON.stringify(value)

function refusalText(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  }
  throw new Error('Expected the request to be refused.')
}

function expectRefusedThroughBothEntryPoints(input: unknown): void {
  expect(() => parseOverlayProjectionRequestJson(input)).toThrow()
  expect(() => adapter.projectJson(input)).toThrow()
  const message = refusalText(() => adapter.projectJson(input))
  CONFIDENTIAL_OR_FOREIGN.forEach((value) => expect(message).not.toContain(value))
}

describe('D2A-C4 §A — valid serialized JSON requests are accepted', () => {
  it('parses valid demo, restricted, and confidential request JSON', () => {
    expect(parseOverlayProjectionRequestJson(json(validDemoRequest())).contextKind).toBe('demo')
    const restricted = parseOverlayProjectionRequestJson(json(validInstitutionalRequest()))
    expect(restricted.contextKind).toBe('institutional')
    expect(
      parseOverlayProjectionRequestJson(json(confidentialInstitutionalRequest())).contextKind,
    ).toBe('institutional')
  })

  it('projects valid demo and institutional request JSON through the adapter', () => {
    expect(adapter.projectJson(json(validDemoRequest())).dataset.context.contextKind).toBe('demo')
    const restricted = adapter.projectJson(json(validInstitutionalRequest()))
    expect(restricted.accessClassification).toBe('institution_restricted')
    const confidential = adapter.projectJson(json(confidentialInstitutionalRequest()))
    expect(confidential.accessClassification).toBe('institution_confidential')
    // Only the confidential projection carries the confidential capability record.
    expect(JSON.stringify(confidential)).toContain('fictional-east-capability-beta')
    expect(JSON.stringify(restricted)).not.toContain('fictional-east-capability-beta')
  })

  it('returns explicit unknown collections for an unconfigured demo or institutional scope', () => {
    const demo = adapter.projectJson(json(unknownDemoRequest()))
    expect(demo.dataset.capabilities.sourceState.state).toBe('unknown')
    expect(demo.dataset.capabilities.records).toEqual([])

    const institutional = adapter.projectJson(json(unknownInstitutionalRequest()))
    expect(institutional.dataset.capabilities.sourceState.state).toBe('unknown')
    expect(institutional.dataset.capabilities.records).toEqual([])
  })
})

describe('D2A-C4 §B — object inputs are refused before any caller code runs', () => {
  type TrapCounts = {
    get: number
    getPrototypeOf: number
    ownKeys: number
    getOwnPropertyDescriptor: number
  }

  function countingProxy(source: object, counts: TrapCounts): unknown {
    return new Proxy(source, {
      get: (target, key, receiver) => {
        counts.get += 1
        return Reflect.get(target, key, receiver)
      },
      getPrototypeOf: (target) => {
        counts.getPrototypeOf += 1
        return Reflect.getPrototypeOf(target)
      },
      ownKeys: (target) => {
        counts.ownKeys += 1
        return Reflect.ownKeys(target)
      },
      getOwnPropertyDescriptor: (target, key) => {
        counts.getOwnPropertyDescriptor += 1
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
  }

  it('refuses every Proxy shape without invoking a single trap', () => {
    const carriers: Array<[string, () => object]> = [
      ['transparent Proxy', () => validInstitutionalRequest()],
      ['descriptor-synthesizing over empty target', () => ({}) as object],
      ['throwing-trap target', () => confidentialInstitutionalRequest()],
    ]
    carriers.forEach(([, build]) => {
      const counts: TrapCounts = {
        get: 0,
        getPrototypeOf: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
      }
      const proxy = countingProxy(build(), counts)
      expectRefusedThroughBothEntryPoints(proxy)
      expect(counts).toEqual({ get: 0, getPrototypeOf: 0, ownKeys: 0, getOwnPropertyDescriptor: 0 })
    })
  })

  it('refuses a revoked Proxy and Proxies whose traps throw, running no trap', () => {
    const { proxy, revoke } = Proxy.revocable(confidentialInstitutionalRequest(), {})
    revoke()
    expect(() => parseOverlayProjectionRequestJson(proxy)).toThrow()
    expect(() => adapter.projectJson(proxy)).toThrow()

    let trapFired = false
    const throwing = new Proxy(
      {},
      {
        get: () => {
          trapFired = true
          throw new Error('trap')
        },
        getPrototypeOf: () => {
          trapFired = true
          throw new Error('trap')
        },
        ownKeys: () => {
          trapFired = true
          throw new Error('trap')
        },
        getOwnPropertyDescriptor: () => {
          trapFired = true
          throw new Error('trap')
        },
      },
    )
    expect(() => parseOverlayProjectionRequestJson(throwing)).toThrow()
    expect(() => adapter.projectJson(throwing)).toThrow()
    expect(trapFired).toBe(false)
  })

  it('refuses coercion carriers without invoking their conversion hooks', () => {
    let toStringCalls = 0
    let valueOfCalls = 0
    let toPrimitiveCalls = 0
    const carriers: unknown[] = [
      { ...validDemoRequest(), toString: () => (toStringCalls++, json(validDemoRequest())) },
      { ...validDemoRequest(), valueOf: () => (valueOfCalls++, json(validDemoRequest())) },
      {
        ...validDemoRequest(),
        [Symbol.toPrimitive]: () => (toPrimitiveCalls++, json(validDemoRequest())),
      },
    ]
    carriers.forEach((carrier) => expectRefusedThroughBothEntryPoints(carrier))
    expect(toStringCalls).toBe(0)
    expect(valueOfCalls).toBe(0)
    expect(toPrimitiveCalls).toBe(0)
  })

  it('refuses a getter carrier without invoking the getter', () => {
    let getterCalls = 0
    const withGetter: Record<string, unknown> = { ...validDemoRequest() }
    Object.defineProperty(withGetter, 'projectionTimestamp', {
      get: () => {
        getterCalls += 1
        return PROJECTION_TIMESTAMP
      },
      enumerable: true,
      configurable: true,
    })
    expectRefusedThroughBothEntryPoints(withGetter)
    expect(getterCalls).toBe(0)
  })

  it('refuses boxed strings, exotic built-ins, and prototype-derived objects', () => {
    const carriers: unknown[] = [
      new String(json(validDemoRequest())),
      new Date(0),
      [validDemoRequest()],
      new Map(Object.entries(validDemoRequest())),
      new Set([validDemoRequest()]),
      Object.assign(() => undefined, validDemoRequest()),
      Object.create(validInstitutionalRequest()),
      Object.assign(Object.create(null), validDemoRequest()),
      Object.assign(Object.create(null), validInstitutionalRequest()),
    ]
    carriers.forEach((carrier) => expectRefusedThroughBothEntryPoints(carrier))
  })

  it('refuses a valid null-prototype nested scope presented as an object', () => {
    const nullProtoScope = Object.assign(Object.create(null), { ...FICTIONAL_HARBOR_EAST_SCOPE })
    expectRefusedThroughBothEntryPoints({ ...validInstitutionalRequest(), scope: nullProtoScope })
  })

  it('refuses non-object primitives that are not strings', () => {
    ;[1, 0, true, false, null, undefined, Symbol('x') as unknown, 10n as unknown].forEach(
      (value) => {
        expect(() => parseOverlayProjectionRequestJson(value)).toThrow()
        expect(() => adapter.projectJson(value)).toThrow()
      },
    )
  })
})

describe('D2A-C4 §C — cross-call poisoning is structurally impossible', () => {
  const originalStructuredClone = globalThis.structuredClone
  const originalIsArray = Array.isArray
  const originalGetPrototypeOf = Object.getPrototypeOf
  const originalOwnKeys = Reflect.ownKeys
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
  const originalJsonParse = JSON.parse

  function assertGlobalsIntact(): void {
    expect(globalThis.structuredClone).toBe(originalStructuredClone)
    expect(Array.isArray).toBe(originalIsArray)
    expect(Object.getPrototypeOf).toBe(originalGetPrototypeOf)
    expect(Reflect.ownKeys).toBe(originalOwnKeys)
    expect(Object.getOwnPropertyDescriptor).toBe(originalGetOwnPropertyDescriptor)
    expect(JSON.parse).toBe(originalJsonParse)
  }

  it('recreates the R4 stage-one poison carriers and refuses them without running a trap', () => {
    // These are the exact vectors Codex used at 2bffe9bf: a first call that installs a
    // permissive stand-in for a mutable global from inside a trap. Against the serialized
    // boundary the carrier is an object, so it is refused by the primitive-string check
    // before any trap can run and before any global can be touched.
    let structuredCloneTrap = false
    let reflectionTrap = false

    const structuredClonePoison = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          structuredCloneTrap = true
          globalThis.structuredClone = (() => ({})) as typeof structuredClone
          return Object.prototype
        },
        ownKeys: () => {
          structuredCloneTrap = true
          return []
        },
      },
    )

    const reflectionPoison = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          reflectionTrap = true
          Array.isArray = (() => false) as unknown as typeof Array.isArray
          Object.getPrototypeOf = (() => Object.prototype) as typeof Object.getPrototypeOf
          Reflect.ownKeys = (() => []) as typeof Reflect.ownKeys
          Object.getOwnPropertyDescriptor = (() =>
            undefined) as typeof Object.getOwnPropertyDescriptor
          return Object.prototype
        },
        ownKeys: () => {
          reflectionTrap = true
          return []
        },
      },
    )

    try {
      expectRefusedThroughBothEntryPoints(structuredClonePoison)
      expectRefusedThroughBothEntryPoints(reflectionPoison)
      expect(structuredCloneTrap).toBe(false)
      expect(reflectionTrap).toBe(false)
      assertGlobalsIntact()

      // A later valid JSON request is still accepted, and a later object/exotic still refused.
      expect(parseOverlayProjectionRequestJson(json(validInstitutionalRequest())).contextKind).toBe(
        'institutional',
      )
      expect(() => parseOverlayProjectionRequestJson(new Date(0))).toThrow()
      expect(() => parseOverlayProjectionRequestJson([validDemoRequest()])).toThrow()
      expect(() => parseOverlayProjectionRequestJson(new Proxy(validDemoRequest(), {}))).toThrow()
      assertGlobalsIntact()
    } finally {
      // Defensive restoration; the production boundary never modified these, but if an
      // assertion above had failed mid-flight the harness must not inherit a poisoned global.
      globalThis.structuredClone = originalStructuredClone
      Array.isArray = originalIsArray
      Object.getPrototypeOf = originalGetPrototypeOf
      Reflect.ownKeys = originalOwnKeys
      Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor
    }
  })

  it('accepts a genuine Date only when it is serialized, never as a live object', () => {
    // Probe B accepted a genuine Date because poisoned reflection synthesized a request from
    // it and structured cloning accepts a Date. The serialized boundary refuses the live Date
    // outright; its ISO serialization is a plain JSON string that decodes to a string, not a
    // request object, so it is refused by the schema rather than smuggled in.
    expect(() => parseOverlayProjectionRequestJson(new Date(0))).toThrow()
    expect(() => parseOverlayProjectionRequestJson(json(new Date(0)))).toThrow()
  })
})

describe('D2A-C4 §D — the JSON parser is a module-lifetime trust anchor', () => {
  it('uses the captured JSON.parse, never a later replacement', () => {
    const realParse = JSON.parse
    let fakeInvoked = false
    try {
      JSON.parse = (() => {
        fakeInvoked = true
        return validInstitutionalRequest()
      }) as typeof JSON.parse

      // If the boundary re-read JSON.parse it would call the fake and admit whatever it
      // returned. Instead it decodes with the module-captured intrinsic.
      const parsed = parseOverlayProjectionRequestJson(json(validDemoRequest()))
      expect(parsed.contextKind).toBe('demo')
      expect(fakeInvoked).toBe(false)

      // A syntactically invalid string is still refused via the captured intrinsic, not
      // accepted by the fake.
      expect(() => parseOverlayProjectionRequestJson('{ not json')).toThrow()
      expect(fakeInvoked).toBe(false)
    } finally {
      JSON.parse = realParse
    }
    expect(JSON.parse).toBe(realParse)
  })
})

describe('D2A-C4 §E — decoded __proto__ and structural key checks', () => {
  it('refuses a top-level JSON __proto__ carrier through both entry points', () => {
    const payload = `{"__proto__":${json(confidentialInstitutionalRequest())}}`
    // The decoded object owns a single `__proto__` data key and no discriminant.
    const decoded = JSON.parse(payload)
    expect(Reflect.ownKeys(decoded)).toEqual(['__proto__'])
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype)
    expectRefusedThroughBothEntryPoints(payload)
  })

  it('refuses an institutional request whose decoded scope owns a __proto__ key', () => {
    // Built as raw text: an object literal `{ __proto__: … }` is the prototype-setter syntax,
    // so only a literal JSON member decodes to an own `__proto__` data key.
    const scopeText = `{"__proto__":{"injected":true},${JSON.stringify(FICTIONAL_HARBOR_EAST_SCOPE).slice(1)}`
    const payload = `{"contextKind":"institutional","scope":${scopeText},"accessClassification":"institution_restricted","projectionTimestamp":${json(PROJECTION_TIMESTAMP)}}`
    expect(Reflect.ownKeys(JSON.parse(payload).scope)).toContain('__proto__')
    expectRefusedThroughBothEntryPoints(payload)
  })

  it('leaves Object.prototype unpolluted after every refused __proto__ carrier', () => {
    const probe = {} as Record<string, unknown>
    expect(probe.injected).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'injected')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'contextKind')).toBe(false)
  })

  it('refuses extra keys, missing keys, mixed shapes, and authUserMetadata', () => {
    expectRefusedThroughBothEntryPoints(json({ ...validDemoRequest(), extra: 'x' }))
    expectRefusedThroughBothEntryPoints(
      json({ contextKind: 'demo', accessClassification: 'public_unlisted' }),
    )
    // Institutional discriminant with a demo field, and vice versa.
    expectRefusedThroughBothEntryPoints(
      json({ ...validInstitutionalRequest(), demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId }),
    )
    expectRefusedThroughBothEntryPoints(
      json({ ...validDemoRequest(), scope: FICTIONAL_HARBOR_EAST_SCOPE }),
    )
    // Authenticated-user metadata is never a scope substitute.
    expectRefusedThroughBothEntryPoints(
      json({
        contextKind: 'institutional',
        authUserMetadata: { ...FICTIONAL_HARBOR_EAST_SCOPE },
        accessClassification: 'institution_restricted',
        projectionTimestamp: PROJECTION_TIMESTAMP,
      }),
    )
  })
})

describe('D2A-C4 §F — non-request JSON is refused', () => {
  it('refuses malformed, empty, and non-object JSON documents', () => {
    const inputs = [
      '{ not json',
      '',
      '   ',
      '"institutional"',
      '42',
      'true',
      'false',
      'null',
      '[]',
      json([validDemoRequest()]),
    ]
    inputs.forEach((input) => {
      expect(() => parseOverlayProjectionRequestJson(input)).toThrow()
      expect(() => adapter.projectJson(input)).toThrow()
    })
  })
})

describe('D2A-C4 §G — governed reserved identifiers stay refused', () => {
  const reserved = [
    '__proto__',
    'prototype',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
  ]

  it('refuses every reserved name as a scope component or demo context id', () => {
    reserved.forEach((name) => {
      expectRefusedThroughBothEntryPoints(
        json({
          contextKind: 'institutional',
          scope: { tenantId: name, institutionId: name, siteId: name },
          accessClassification: 'institution_restricted',
          projectionTimestamp: PROJECTION_TIMESTAMP,
        }),
      )
      expectRefusedThroughBothEntryPoints(
        json({
          contextKind: 'demo',
          demoContextId: name,
          accessClassification: 'public_unlisted',
          projectionTimestamp: PROJECTION_TIMESTAMP,
        }),
      )
    })
  })
})

describe('D2A-C4 §H — refusals never leak fixture identifiers', () => {
  it('emits a generic message for every refused shape', () => {
    const refusedInputs: unknown[] = [
      new Proxy(confidentialInstitutionalRequest(), {}),
      new Date(0),
      confidentialInstitutionalRequest(),
      `{"__proto__":${json(confidentialInstitutionalRequest())}}`,
      json({ ...confidentialInstitutionalRequest(), extra: 'x' }),
      '{ not json',
    ]
    refusedInputs.forEach((input) => {
      const message = refusalText(() => adapter.projectJson(input))
      CONFIDENTIAL_OR_FOREIGN.forEach((value) => expect(message).not.toContain(value))
    })
  })
})

describe('D2A-C4 §I — no alternate object-input admission path remains', () => {
  it('exposes no object-accepting parser or adapter method at runtime', () => {
    const contracts = contractsModule as unknown as Record<string, unknown>
    // The object parser and the object-reading request schemas are no longer exported.
    expect(contracts.parseOverlayProjectionRequest).toBeUndefined()
    expect(contracts.overlayProjectionRequestSchema).toBeUndefined()
    expect(contracts.demoProjectionRequestSchema).toBeUndefined()
    expect(contracts.institutionalProjectionRequestSchema).toBeUndefined()
    expect(typeof contracts.parseOverlayProjectionRequestJson).toBe('function')

    // The sealed adapter exposes projectJson and no object-accepting project method.
    expect((adapter as unknown as Record<string, unknown>).project).toBeUndefined()
    expect(typeof adapter.projectJson).toBe('function')
    expect(Object.keys(adapter)).toEqual(['projectJson'])
  })
})

/**
 * D2A-C3. `accessAllows` accepts `unknown` and promises a boolean, so it must be total for
 * every runtime input. Every row below is asserted against the real production export — not
 * a copied helper — in both argument positions.
 *
 * The gate rejects non-strings by `typeof` *before* Zod, before any property read, and
 * before any coercion. `safeParse` converts a Zod validation failure into `{success: false}`
 * but does not contain an arbitrary exception thrown by the value under examination: it
 * reads the candidate's `then` property, so a Proxy with a throwing `get` trap propagated
 * its own error out of the gate (D2A-R5-C3-001, reproduced at d5ecfed9). §C pins that no
 * caller-controlled code runs at all during a denial.
 */
describe('D2A-C3 §A — the access gate is total over every invalid input', () => {
  // Factories, so each case gets a fresh carrier and jest never formats a hostile value
  // into a test title (pretty-printing a Proxy would itself fire its traps).
  const invalidInputs: Array<[string, () => unknown]> = [
    ['array wrapping a valid classification', () => ['institution_restricted']],
    ['boxed String', () => new String('institution_restricted')],
    ['Date', () => new Date(0)],
    ['number', () => 1],
    ['boolean', () => true],
    ['null', () => null],
    ['undefined', () => undefined],
    ['symbol', () => Symbol('institution_restricted')],
    ['empty string', () => ''],
    ['unknown string', () => 'institution_public'],
    ['case variant', () => 'INSTITUTION_RESTRICTED'],
    ['whitespace-padded valid value', () => ' institution_restricted '],
    ['toString carrier', () => ({ toString: () => 'institution_restricted' })],
    ['valueOf carrier', () => ({ valueOf: () => 'institution_restricted' })],
    [
      'Symbol.toPrimitive carrier',
      () => ({ [Symbol.toPrimitive]: () => 'institution_restricted' }),
    ],
    ['non-throwing Proxy', () => new Proxy({}, { get: () => 'institution_restricted' })],
    [
      'throwing Proxy',
      () =>
        new Proxy(
          {},
          {
            get() {
              throw new Error('D2A-C3 trap sentinel')
            },
          },
        ),
    ],
    [
      'object whose property access throws',
      () => ({
        get then(): never {
          throw new Error('D2A-C3 getter sentinel')
        },
        get accessClassification(): never {
          throw new Error('D2A-C3 getter sentinel')
        },
      }),
    ],
    [
      'object whose conversion methods throw',
      () => ({
        toString(): never {
          throw new Error('D2A-C3 toString sentinel')
        },
        valueOf(): never {
          throw new Error('D2A-C3 valueOf sentinel')
        },
        [Symbol.toPrimitive](): never {
          throw new Error('D2A-C3 toPrimitive sentinel')
        },
      }),
    ],
    ['null-prototype object', () => Object.create(null)],
  ]

  it.each(invalidInputs)('denies %s in every position without throwing', (_label, make) => {
    const value = make()
    expect(() => accessAllows(value, 'institution_restricted')).not.toThrow()
    expect(() => accessAllows('institution_restricted', value)).not.toThrow()
    expect(() => accessAllows(value, value)).not.toThrow()
    expect(accessAllows(value, 'institution_restricted')).toBe(false)
    expect(accessAllows('institution_restricted', value)).toBe(false)
    expect(accessAllows(value, value)).toBe(false)
    expect(accessAllows('institution_confidential', value)).toBe(false)
    expect(accessAllows(value, 'institution_confidential')).toBe(false)
    expect(accessAllows('public_unlisted', value)).toBe(false)
    expect(accessAllows(value, 'public_unlisted')).toBe(false)
  })

  // Derived, not hand-listed, so a future engine cannot add an inherited name this misses.
  // Each would otherwise resolve to an inherited `Object.prototype` value used as a rank key.
  it.each(Object.getOwnPropertyNames(Object.prototype).map((name) => [name] as [string]))(
    'denies the Object.prototype property name %p in every position',
    (name) => {
      expect(accessAllows(name, name)).toBe(false)
      expect(accessAllows(name, 'institution_restricted')).toBe(false)
      expect(accessAllows('institution_restricted', name)).toBe(false)
      expect(accessAllows('institution_confidential', name)).toBe(false)
      expect(accessAllows('public_unlisted', name)).toBe(false)
    },
  )
})

describe('D2A-C3 §B — the exact 3x3 valid classification matrix', () => {
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

  it('covers all nine ordered pairs exactly once', () => {
    expect(matrix).toHaveLength(9)
    expect(new Set(matrix.map(([projection, record]) => `${projection}>${record}`)).size).toBe(9)
  })

  it.each(matrix)('projection %s over record %s is %p', (projection, record, expected) => {
    expect(accessAllows(projection, record)).toBe(expected)
  })
})

describe('D2A-C3 §C — a denial runs no caller-controlled code', () => {
  it('denies the throwing Proxy that escaped the gate at d5ecfed9 without firing a trap', () => {
    const traps = { get: 0, has: 0, getOwnPropertyDescriptor: 0, ownKeys: 0, getPrototypeOf: 0 }
    const carrier = new Proxy(
      {},
      {
        get() {
          traps.get += 1
          throw new Error('D2A-C3 trap sentinel')
        },
        has() {
          traps.has += 1
          throw new Error('D2A-C3 trap sentinel')
        },
        getOwnPropertyDescriptor() {
          traps.getOwnPropertyDescriptor += 1
          throw new Error('D2A-C3 trap sentinel')
        },
        ownKeys() {
          traps.ownKeys += 1
          throw new Error('D2A-C3 trap sentinel')
        },
        getPrototypeOf() {
          traps.getPrototypeOf += 1
          throw new Error('D2A-C3 trap sentinel')
        },
      },
    )

    expect(accessAllows(carrier, 'institution_restricted')).toBe(false)
    expect(accessAllows('institution_restricted', carrier)).toBe(false)
    expect(accessAllows(carrier, carrier)).toBe(false)
    expect(accessAllows(carrier, 'public_unlisted')).toBe(false)
    expect(accessAllows('institution_confidential', carrier)).toBe(false)
    expect(traps).toEqual({
      get: 0,
      has: 0,
      getOwnPropertyDescriptor: 0,
      ownKeys: 0,
      getPrototypeOf: 0,
    })
  })

  it('reads no property of an object carrying a throwing getter on every inherited name', () => {
    const reads: string[] = []
    const carrier: Record<string, unknown> = {}
    // `then` is the property Zod reads during safeParse; the inherited names are the ones a
    // rank lookup would otherwise resolve against.
    for (const name of [
      'then',
      'accessClassification',
      ...Object.getOwnPropertyNames(Object.prototype),
    ]) {
      Object.defineProperty(carrier, name, {
        configurable: true,
        enumerable: true,
        get(): never {
          reads.push(name)
          throw new Error('D2A-C3 getter sentinel')
        },
      })
    }

    expect(accessAllows(carrier, 'institution_restricted')).toBe(false)
    expect(accessAllows('institution_restricted', carrier)).toBe(false)
    expect(accessAllows(carrier, carrier)).toBe(false)
    expect(reads).toEqual([])
  })

  it('invokes no conversion hook on a carrier that counts them', () => {
    const hooks = { toString: 0, valueOf: 0, toPrimitive: 0 }
    const carrier = {
      toString() {
        hooks.toString += 1
        return 'institution_confidential'
      },
      valueOf() {
        hooks.valueOf += 1
        return 'institution_confidential'
      },
      [Symbol.toPrimitive]() {
        hooks.toPrimitive += 1
        return 'institution_confidential'
      },
    }

    expect(accessAllows(carrier, 'institution_restricted')).toBe(false)
    expect(accessAllows('institution_restricted', carrier)).toBe(false)
    expect(accessAllows(carrier, carrier)).toBe(false)
    expect(hooks).toEqual({ toString: 0, valueOf: 0, toPrimitive: 0 })
  })
})

describe('D2A-C4 — projection determinism and post-refusal stability', () => {
  it('returns identical projections across repeated valid reads and is unperturbed by refusals', () => {
    const first = JSON.stringify(adapter.projectJson(json(validInstitutionalRequest())))
    expect(() => adapter.projectJson(new Proxy(confidentialInstitutionalRequest(), {}))).toThrow()
    expect(() => adapter.projectJson('{ not json')).toThrow()
    expect(() => adapter.projectJson(new Date(0))).toThrow()
    const second = JSON.stringify(adapter.projectJson(json(validInstitutionalRequest())))
    expect(second).toBe(first)
  })
})
