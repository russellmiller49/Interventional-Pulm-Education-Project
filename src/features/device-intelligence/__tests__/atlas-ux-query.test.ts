import {
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  serializeCatalogSearchQuery,
  type CatalogSearchQuery,
} from '@/features/preference-cards/schemas/catalog-search'
import { parseGaugeValues, searchCatalog } from '@/features/preference-cards/server/catalog'
import { normalizeIdentifier } from '@/features/preference-cards/server/catalog-store'
import {
  activeAtlasFilters,
  atlasIndexHref,
  deviceDetailHref,
  encodeReturnContext,
  normalizeAtlasQuery,
  parseReturnContext,
  returnToResultsHref,
  withDeviceClass,
  withDeviceSubtype,
  withoutAtlasFilter,
} from '@/features/device-intelligence/domain/atlas-query'
import {
  ATLAS_SPEC_FILTERS,
  DEVICE_DISPLAY_CONFIG,
  FEATURED_DEVICE_CLASSES,
  deviceDisplayConfigFor,
  familySpecSummary,
  formatSpecValue,
  modelSpecSummary,
  type AtlasSpecSource,
} from '@/features/device-intelligence/domain/device-display-config'
import {
  DEVICE_SUBTYPE_CLASS,
  isDeviceClassCode,
} from '@/features/device-intelligence/domain/product-taxonomy'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  getAtlasSubtypeFacets,
  searchAtlas,
  validateAtlasFilters,
} from '@/features/device-intelligence/server/atlas.server'
import { getProductTaxonomy } from '@/features/device-intelligence/server/product-taxonomy.server'
import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

/**
 * Device Atlas UX redesign — URL state, subtype filtering, exact-identifier priority, and
 * category-aware specification filters. Everything runs against the real governed cohort.
 */

const parse = (input: Record<string, unknown> = {}): CatalogSearchQuery =>
  catalogSearchSchema.parse(input)
const fromUrl = (queryString: string): CatalogSearchQuery =>
  catalogSearchSchema.parse(catalogSearchInputFromUrl(new URLSearchParams(queryString)))

/** ViziShot 2 EBUS-TBNA needle, 22G — a real catalog number with an exact identity. */
const EXACT_CATALOG_NUMBER = 'NA-U401SX-4022-A'
const EXACT_PRODUCT_ID = 'PRD-1BCD8D38BC'

describe('device subtype filtering', () => {
  it('restricts results to the subtype, and the subtype facet counts agree with the search', () => {
    const facets = getAtlasSubtypeFacets('needle')
    expect(facets.length).toBeGreaterThan(3)
    for (const facet of facets) {
      const results = searchAtlas(parse({ deviceSubtype: facet.code, pageSize: 100 }))
      expect(results.total).toBe(facet.productCount)
      for (const item of results.items) {
        expect(getProductTaxonomy(item.productId).deviceSubtypeCode).toBe(facet.code)
      }
    }
    // The subtype counts partition the class.
    const classTotal = searchAtlas(parse({ deviceClass: 'needle' })).total
    expect(facets.reduce((sum, facet) => sum + facet.productCount, 0)).toBe(classTotal)
  })

  it('lists subtypes in the controlled vocabulary order, never ranked by count', () => {
    const vocabularyOrder = Object.keys(DEVICE_SUBTYPE_CLASS)
    const codes = getAtlasSubtypeFacets('bronchoscope').map((facet) => facet.code as string)
    expect(codes).toEqual(
      [...codes].sort((a, b) => vocabularyOrder.indexOf(a) - vocabularyOrder.indexOf(b)),
    )
  })

  it('fails safely for an unknown or stale subtype instead of returning an empty shelf', () => {
    expect(validateAtlasFilters(parse({ deviceSubtype: 'retired_subtype_code' }))).toBe(
      'device subtype',
    )
    expect(validateAtlasFilters(parse({ deviceSubtype: 'ebus_tbna_needle' }))).toBeNull()
    expect(validateAtlasFilters(parse({ family: 'no|such|line' }))).toBe('product line')
    // An unknown code is left in place for that notice; normalization never invents a class.
    const normalized = normalizeAtlasQuery(parse({ deviceSubtype: 'retired_subtype_code' }))
    expect(normalized.query.deviceClass).toBeUndefined()
    expect(normalized.subtypeDroppedForClassMismatch).toBe(false)
  })

  it('reconciles subtype and class: a subtype implies its class, a contradiction drops the subtype', () => {
    const implied = normalizeAtlasQuery(parse({ deviceSubtype: 'ebus_tbna_needle' }))
    expect(implied.query.deviceClass).toBe('needle')
    expect(implied.query.deviceSubtype).toBe('ebus_tbna_needle')

    const contradiction = normalizeAtlasQuery(
      parse({ deviceClass: 'airway_stent', deviceSubtype: 'ebus_tbna_needle' }),
    )
    expect(contradiction.query.deviceClass).toBe('airway_stent')
    expect(contradiction.query.deviceSubtype).toBeUndefined()
    expect(contradiction.subtypeDroppedForClassMismatch).toBe(true)
  })

  it('degrades an unknown view or specUnknown value without discarding the rest of the link', () => {
    const query = fromUrl('deviceClass=needle&view=grid&specUnknown=maybe&gauge=21')
    expect(query.deviceClass).toBe('needle')
    expect(query.gauge).toBe(21)
    expect(query.view).toBeUndefined()
    expect(query.specUnknown).toBe('exclude')
  })
})

describe('shareable, deterministic URL state', () => {
  const full = parse({
    q: 'needle',
    manufacturers: ['MFR-954E57FBB9'],
    deviceClass: 'needle',
    deviceSubtype: 'ebus_tbna_needle',
    role: 'EBUS_TBNA_NEEDLE',
    gauge: 21,
    channelMax: 2.2,
    workingLengthMin: 60,
    sort: 'name',
    view: 'models',
    page: 2,
  })

  it('round-trips every atlas filter through the URL unchanged', () => {
    const serialized = serializeCatalogSearchQuery(full)
    expect(fromUrl(serialized)).toEqual(full)
    // Deterministic: the same query always serializes to the same string, in a fixed order.
    expect(serializeCatalogSearchQuery(fromUrl(serialized))).toBe(serialized)
    expect(serializeCatalogSearchQuery(parse())).toBe('')
  })

  it('removes one filter chip and preserves all the others', () => {
    const ids = activeAtlasFilters(full).map((filter) => filter.id)
    expect(ids).toEqual([
      'q',
      'deviceClass',
      'deviceSubtype',
      'manufacturer:MFR-954E57FBB9',
      'role',
      'workingLength',
      'channelMax',
      'gauge',
    ])
    for (const id of ids) {
      const next = withoutAtlasFilter(full, id)
      const remaining = activeAtlasFilters(next).map((filter) => filter.id)
      // Removing the class takes its dependent subtype with it; nothing else ever cascades.
      const expected = ids.filter(
        (other) => other !== id && !(id === 'deviceClass' && other === 'deviceSubtype'),
      )
      expect(remaining).toEqual(expected)
      expect(next.page).toBe(1)
      expect(next.sort).toBe('name')
      expect(next.view).toBe('models')
    }
  })

  it('keeps the search when browsing by class, and resets only class-scoped filters', () => {
    const next = withDeviceClass(full, 'airway_stent')
    expect(next.deviceClass).toBe('airway_stent')
    expect(next.deviceSubtype).toBeUndefined()
    expect(next.gauge).toBeUndefined()
    expect(next.channelMax).toBeUndefined()
    expect(next.q).toBe('needle')
    expect(next.manufacturers).toEqual(['MFR-954E57FBB9'])
    expect(next.role).toBe('EBUS_TBNA_NEEDLE')
    expect(next.sort).toBe('name')

    const subtype = withDeviceSubtype(parse({ q: 'x', gauge: 22 }), 'ebus_fnb_needle')
    expect(subtype.deviceClass).toBe('needle')
    expect(subtype.gauge).toBe(22)
    expect(atlasIndexHref('en', subtype)).toBe(
      '/en/devices?q=x&deviceClass=needle&deviceSubtype=ebus_fnb_needle&gauge=22',
    )
  })

  it('drops "unknown values only" once no specification filter is left to describe', () => {
    const query = parse({ deviceClass: 'needle', gauge: 21, specUnknown: 'only' })
    expect(withoutAtlasFilter(query, 'gauge').specUnknown).toBe('exclude')
  })
})

describe('back-to-results context', () => {
  it('returns to the exact query, filters, sort, page and view it came from', () => {
    const query = parse({
      q: 'ebus',
      deviceClass: 'needle',
      manufacturers: ['MFR-954E57FBB9'],
      sort: 'manufacturer',
      view: 'models',
      page: 3,
    })
    const context = encodeReturnContext(query)
    const href = deviceDetailHref('en', EXACT_PRODUCT_ID, context)
    const from = new URL(href, 'https://atlas.test').searchParams.get('from')
    const restored = parseReturnContext(from)
    expect(restored).toBe(context)
    expect(fromUrl(restored!)).toEqual(query)
    expect(returnToResultsHref('en', restored)).toBe(`/en/devices?${context}`)
  })

  it('links plainly when there is no context, so direct links and new tabs behave', () => {
    expect(deviceDetailHref('en', EXACT_PRODUCT_ID, null)).toBe(`/en/devices/${EXACT_PRODUCT_ID}`)
    expect(returnToResultsHref('en', null)).toBe('/en/devices')
    expect(parseReturnContext(undefined)).toBeNull()
    expect(parseReturnContext(['a', 'b'])).toBeNull()
  })

  it('can only ever produce a canonical atlas query string, whatever arrives', () => {
    for (const hostile of [
      'https://evil.example/phish',
      '//evil.example',
      'javascript:alert(1)',
      '/en/admin',
      '../../login',
    ]) {
      const restored = parseReturnContext(hostile)
      // Unknown keys are ignored: no context survives, and the back link is the plain index.
      expect(restored).toBeNull()
      expect(returnToResultsHref('en', restored)).toBe('/en/devices')
    }
    // A value that fails validation (page must be positive) yields no context at all.
    expect(parseReturnContext('deviceClass=needle&page=-4')).toBeNull()
    expect(parseReturnContext('x'.repeat(2000))).toBeNull()
    // Only recognized parameters survive, re-serialized canonically.
    expect(parseReturnContext('deviceClass=needle&next=https://evil.example')).toBe(
      'deviceClass=needle',
    )
  })
})

describe('exact identifier lookup stays model-first', () => {
  it('puts the exact catalog-number match first in both views and under every sort', () => {
    for (const view of ['models', 'families'] as const) {
      for (const sort of ['relevance', 'name', 'manufacturer', 'diameter', 'length'] as const) {
        const results = searchAtlas(parse({ q: EXACT_CATALOG_NUMBER, view, sort }))
        expect(results.exactMatches.map((item) => item.productId)).toEqual([EXACT_PRODUCT_ID])
        expect(results.exactIdentifierMatchIds).toContain(EXACT_PRODUCT_ID)
        expect(results.items[0].productId).toBe(EXACT_PRODUCT_ID)
      }
    }
  })

  it('marks only strict identifier equality as exact, never a prefix or a fuzzy hit', () => {
    const store = getAtlasCatalogStore()
    const prefix = EXACT_CATALOG_NUMBER.slice(0, 8)
    const results = searchAtlas(parse({ q: prefix, pageSize: 100 }))
    expect(results.total).toBeGreaterThan(0)
    for (const item of results.exactMatches) {
      expect(store.productById.get(item.productId)!.searchableIds).toContain(
        normalizeIdentifier(prefix),
      )
    }
    expect(results.exactMatches.map((item) => item.productId)).not.toContain(EXACT_PRODUCT_ID)
  })

  it('keeps the query layer default model-first so existing callers are unchanged', () => {
    const results = searchAtlas(parse({ deviceClass: 'guidewire' }))
    expect(results.view).toBe('models')
    expect(results.families).toEqual([])
    expect(results.familyTotal).toBeNull()
    expect(results.items).toHaveLength(results.total)
  })
})

describe('specification filters', () => {
  it('reads every gauge a record lists, including the string-valued rows', () => {
    expect(parseGaugeValues(21)).toEqual([21])
    expect(parseGaugeValues('22G')).toEqual([22])
    expect(parseGaugeValues('19G/21G')).toEqual([19, 21])
    expect(parseGaugeValues(null)).toEqual([])
    expect(parseGaugeValues('')).toEqual([])
  })

  it('filters numerically and keeps "not recorded" apart from "does not match"', () => {
    const store = getAtlasCatalogStore()
    const needles = searchAtlas(parse({ deviceClass: 'needle', pageSize: 100 }))
    const matched = searchAtlas(parse({ deviceClass: 'needle', gauge: 21, pageSize: 100 }))
    const unknown = searchAtlas(
      parse({ deviceClass: 'needle', gauge: 21, specUnknown: 'only', pageSize: 100 }),
    )
    expect(matched.total).toBeGreaterThan(0)
    for (const item of matched.items) {
      expect(parseGaugeValues(store.productById.get(item.productId)!.gauge)).toContain(21)
    }
    // The unknown listing is exactly the products whose gauge is not recorded...
    expect(unknown.total).toBe(matched.excludedMissingSpecCount)
    expect(unknown.total).toBeGreaterThan(0)
    for (const item of unknown.items) {
      expect(parseGaugeValues(store.productById.get(item.productId)!.gauge)).toEqual([])
    }
    // ...it never overlaps the matches, and recorded non-matches appear in neither list.
    const matchedIds = new Set(matched.items.map((item) => item.productId))
    expect(unknown.items.some((item) => matchedIds.has(item.productId))).toBe(false)
    const recordedNonMatches = needles.items.filter((item) => {
      const gauges = parseGaugeValues(store.productById.get(item.productId)!.gauge)
      return gauges.length > 0 && !gauges.includes(21)
    })
    expect(recordedNonMatches.length).toBeGreaterThan(0)
    expect(matched.total + unknown.total + recordedNonMatches.length).toBe(needles.total)
  })

  it('applies French-size and working-length ranges to the recorded columns', () => {
    const store = getAtlasCatalogStore()
    const french = searchAtlas(
      parse({ deviceClass: 'pleural_drainage', frenchMin: 12, frenchMax: 16, pageSize: 100 }),
    )
    expect(french.total).toBeGreaterThan(0)
    for (const item of french.items) {
      const value = store.productById.get(item.productId)!.french_size!
      expect(value).toBeGreaterThanOrEqual(12)
      expect(value).toBeLessThanOrEqual(16)
    }
    expect(french.excludedMissingSpecCount).toBeGreaterThan(0)

    const length = searchAtlas(parse({ deviceClass: 'needle', workingLengthMin: 100 }))
    for (const item of length.items) {
      expect(store.productById.get(item.productId)!.working_length_cm!).toBeGreaterThanOrEqual(100)
    }
    expect(catalogSearchSchema.safeParse({ frenchMin: 20, frenchMax: 10 }).success).toBe(false)
  })

  it('leaves the preserved preference-card search untouched when no new filter is set', () => {
    const before = searchCatalog(parse({ q: 'stent' }))
    expect(before.items.length).toBeGreaterThan(0)
    expect(before.excludedMissingSpecCount).toBe(0)
  })
})

describe('category-aware display configuration', () => {
  const source = (overrides: Partial<AtlasSpecSource>): AtlasSpecSource => ({
    diameterMm: null,
    lengthMm: null,
    frenchSize: null,
    gauge: null,
    workingLengthCm: null,
    minWorkingChannelMm: null,
    deliverySystemOdMm: null,
    material: null,
    coverage: null,
    reuseStatus: null,
    ...overrides,
  })

  it('keys on stable taxonomy codes and maps every filter onto a real URL parameter', () => {
    for (const code of [...Object.keys(DEVICE_DISPLAY_CONFIG), ...FEATURED_DEVICE_CLASSES]) {
      expect(isDeviceClassCode(code)).toBe(true)
    }
    for (const definition of Object.values(ATLAS_SPEC_FILTERS)) {
      const params =
        definition.kind === 'range'
          ? [definition.minParam, definition.maxParam]
          : [definition.param]
      // Each one is a parameter the shared schema parses and the URL round-trips.
      for (const param of params) {
        expect(serializeCatalogSearchQuery(parse({ [param]: 2 }))).toBe(`${param}=2`)
      }
    }
    expect(deviceDisplayConfigFor('needle').filterFields).toContain('gauge')
    expect(deviceDisplayConfigFor('pleural_drainage').filterFields).toEqual(['french'])
    // Unconfigured and unknown classes fall back to the generic set instead of failing.
    expect(deviceDisplayConfigFor('laser_system').filterFields).toEqual([
      'diameter',
      'length',
      'channelMax',
    ])
    expect(deviceDisplayConfigFor(undefined).summaryFields.length).toBeGreaterThan(0)
  })

  it('never presents a scope channel as a tool minimum-channel requirement', () => {
    const bronchoscope = deviceDisplayConfigFor('bronchoscope')
    expect(bronchoscope.summaryFields).not.toContain('minWorkingChannel')
    expect(bronchoscope.filterFields).not.toContain('channelMax')
  })

  it('shows only recorded values and never invents a missing one', () => {
    const needle = source({ gauge: '22G', workingLengthCm: 70 })
    expect(modelSpecSummary('needle', needle)).toEqual([
      { key: 'gauge', value: '22G' },
      { key: 'workingLength', value: '70 cm' },
    ])
    expect(formatSpecValue('minWorkingChannel', needle)).toBeNull()
    expect(modelSpecSummary('needle', source({}))).toEqual([])
  })

  it('summarizes a line from its listed models only and reports partial recording', () => {
    const summary = familySpecSummary('needle', [
      source({ gauge: 22, workingLengthCm: 70 }),
      source({ gauge: '21G' }),
      source({ gauge: '22G' }),
    ])
    expect(summary[0]).toMatchObject({ key: 'gauge', value: '21G, 22G', recordedCount: 3 })
    expect(summary[1]).toMatchObject({ key: 'workingLength', recordedCount: 1, modelCount: 3 })
    const range = familySpecSummary(
      'airway_stent',
      [8, 10, 12, 14, 16, 18].map((diameterMm) => source({ diameterMm })),
    )
    expect(range[0].value).toBe('8–18 mm')
  })
})

describe('copy guardrails for the new index strings', () => {
  const flatten = (node: unknown, prefix = ''): [string, string][] =>
    typeof node === 'string'
      ? [[prefix, node]]
      : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
          flatten(value, prefix ? `${prefix}.${key}` : key),
        )

  it('never words a numeric match as clinical compatibility', () => {
    for (const messages of [enMessages, esMessages, zhCnMessages]) {
      const devices = messages.deviceIntelligence.devices
      // Filter and spec labels describe RECORDED values; none claims a compatible/fits result.
      for (const [key, label] of flatten({
        specFilters: devices.specFilters,
        specs: devices.specs,
        chips: devices.chips,
      })) {
        expect({ key, claims: /compatib|兼容|\bfits?\b/i.test(label) }).toEqual({
          key,
          claims: false,
        })
      }
    }
    const en = enMessages.deviceIntelligence.devices
    // Where compatibility IS named, it is named in order to deny it.
    for (const text of [en.specMatchBoundary, en.form.channelMaxHelp]) {
      expect(text).toMatch(/compatib/i)
      expect(text).toMatch(/\bnot\b/i)
    }
    expect(en.specNotEvaluated).toMatch(/could not be evaluated/)
  })

  it('separates procedure discovery from devices listed for an equipment requirement', () => {
    const en = enMessages.deviceIntelligence
    expect(en.devices.procedureDiscoveryNote).toMatch(/^Devices related to this procedure/)
    expect(en.devices.procedureDiscoveryNote).toMatch(/discovery only/)
    expect(en.workspace.requirement.authoredOptions).toBe(
      'Devices listed for this equipment requirement',
    )
    expect(en.workspace.requirement.relatedDevices).toMatch(/not listed for this requirement/)
  })

  it('ships every new key in every locale', () => {
    const keysOf = (messages: typeof enMessages) =>
      flatten({
        devices: messages.deviceIntelligence.devices,
        compareSelection: messages.deviceIntelligence.compareSelection,
      })
        .map(([key]) => key)
        .sort()
    expect(keysOf(esMessages as typeof enMessages)).toEqual(keysOf(enMessages))
    expect(keysOf(zhCnMessages as typeof enMessages)).toEqual(keysOf(enMessages))
  })
})
