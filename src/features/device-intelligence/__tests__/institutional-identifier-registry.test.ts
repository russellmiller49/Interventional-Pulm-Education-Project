import {
  fictionalInstitutionalOverlayBundleSchema,
  globalGovernedCodeSchema,
  institutionalOverlayDatasetSchema,
  scopeComponentIdentifierSchema,
  scopeLocalIdentifierSchema,
} from '@/features/device-intelligence/institutional/contracts'
import { FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE } from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * The closed identifier grammar and the bundle-wide scope-local identifier registry:
 * every domain identifier registers to exactly one scope, tier, and kind, and JavaScript
 * property names are never usable as domain identifiers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const clone = (): any => JSON.parse(JSON.stringify(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE))
/* eslint-enable @typescript-eslint/no-explicit-any */

const parses = (bundle: unknown): boolean =>
  fictionalInstitutionalOverlayBundleSchema.safeParse(bundle).success

describe('closed identifier grammar', () => {
  it.each([
    ['reserved __proto__', '__proto__'],
    ['reserved prototype', 'prototype'],
    ['reserved constructor', 'constructor'],
    ['reserved toString', 'toString'],
    ['reserved valueOf', 'valueOf'],
    ['reserved hasOwnProperty', 'hasOwnProperty'],
    ['reserved isPrototypeOf', 'isPrototypeOf'],
    ['reserved propertyIsEnumerable', 'propertyIsEnumerable'],
    ['reserved toLocaleString', 'toLocaleString'],
    ['reserved __defineGetter__', '__defineGetter__'],
    ['uppercase', 'Fictional-Id'],
    ['leading whitespace', ' fictional-id'],
    ['trailing whitespace', 'fictional-id '],
    ['inner whitespace', 'fictional id'],
    ['doubled separator', 'fictional--id'],
    ['leading separator', '-fictional-id'],
    ['trailing separator', 'fictional-id-'],
    ['empty string', ''],
    ['cyrillic lookalike', 'fictionаl-id'],
    ['overlong', `fictional-${'x'.repeat(80)}`],
    ['dot separator', 'fictional.id'],
    ['slash', 'fictional/id'],
  ])('rejects %s in every identifier schema', (_label, value) => {
    expect(scopeLocalIdentifierSchema.safeParse(value).success).toBe(false)
    expect(scopeComponentIdentifierSchema.safeParse(value).success).toBe(false)
    expect(globalGovernedCodeSchema.safeParse(value).success).toBe(false)
  })

  it('rejects control characters embedded in an identifier', () => {
    // Built programmatically so no raw control byte lives in this source file.
    for (const code of [0x00, 0x09, 0x1f, 0x7f]) {
      const value = `fictional-${String.fromCharCode(code)}id`
      expect(scopeLocalIdentifierSchema.safeParse(value).success).toBe(false)
      expect(scopeComponentIdentifierSchema.safeParse(value).success).toBe(false)
      expect(globalGovernedCodeSchema.safeParse(value).success).toBe(false)
    }
  })

  it('accepts the closed lowercase grammar', () => {
    for (const value of ['fictional-id-1', 'fictional_id_2', 'a', 'a1-b2_c3']) {
      expect(scopeLocalIdentifierSchema.safeParse(value).success).toBe(true)
    }
  })
})

describe('bundle-wide scope-local identifier registry', () => {
  it('rejects the same identifier value registered under two scopes', () => {
    const bundle = clone()
    bundle.institutionalDatasets[1].capabilities.records[0].recordId =
      bundle.institutionalDatasets[0].formularies.records[0].recordId
    expect(parses(bundle)).toBe(false)
  })

  it('rejects the same identifier value registered under two kinds in one scope', () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].diagnostics[0].diagnosticId =
      bundle.institutionalDatasets[0].formularies.records[0].formularyEvidence.formularyEntryId
    expect(parses(bundle)).toBe(false)
  })

  it('rejects the same source identifier registered under two tiers in one scope', () => {
    const bundle = clone()
    const east = bundle.institutionalDatasets[0]
    east.capabilities.records[0].source.sourceId = 'fictional-east-shared-source'
    east.capabilities.records[0].source.provenance.provenanceId =
      'fictional-east-shared-source-provenance'
    east.capabilities.records[1].source.sourceId = 'fictional-east-shared-source'
    east.capabilities.records[1].source.provenance.provenanceId =
      'fictional-east-shared-source-provenance'
    expect(parses(bundle)).toBe(false)
  })

  it('accepts one source legitimately cited by two same-tier records in one scope', () => {
    const bundle = clone()
    const east = bundle.institutionalDatasets[0]
    east.formularies.records[1].source = JSON.parse(
      JSON.stringify(east.formularies.records[0].source),
    )
    expect(parses(bundle)).toBe(true)
  })

  it('rejects an identifier equal to any scope identity component', () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].capabilities.records[0].recordId = 'fictional-site-east'
    expect(parses(bundle)).toBe(false)
  })

  it("rejects an identifier containing another scope's identity component", () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].capabilities.records[0].recordId =
      'fictional-east-fictional-site-west-echo'
    expect(parses(bundle)).toBe(false)
  })

  it('rejects a lower-tier identifier containing a same-scope higher-tier identifier', () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].inventories.records[0].recordId =
      'fictional-east-capability-beta-echo'
    expect(parses(bundle)).toBe(false)
  })

  it('rejects a governed code containing a scope-local identifier or component', () => {
    const withIdentifier = clone()
    withIdentifier.institutionalDatasets[0].capabilities.records[0].capabilityCode =
      'code-fictional-east-capability-beta'
    expect(parses(withIdentifier)).toBe(false)

    const withComponent = clone()
    withComponent.institutionalDatasets[0].capabilities.records[0].capabilityCode =
      'code-fictional-site-west'
    expect(parses(withComponent)).toBe(false)
  })

  it('rejects a scope component reused in a different structural position', () => {
    const freshDataset = (siteId: string) => ({
      context: {
        contextKind: 'institutional',
        scope: {
          tenantId: 'fictional-tenant-fresh',
          institutionId: 'fictional-institution-fresh',
          siteId,
        },
      },
      capabilities: { sourceState: { state: 'available' }, records: [] },
      formularies: { sourceState: { state: 'available' }, records: [] },
      inventories: { sourceState: { state: 'available' }, records: [] },
      diagnostics: [],
    })

    const crossPosition = clone()
    crossPosition.institutionalDatasets.push(freshDataset('fictional-tenant-northstar'))
    expect(parses(crossPosition)).toBe(false)

    const control = clone()
    control.institutionalDatasets.push(freshDataset('fictional-site-fresh'))
    expect(parses(control)).toBe(true)
  })

  it("rejects internal authoring text containing another scope's identifier or component", () => {
    const withIdentifier = clone()
    withIdentifier.institutionalDatasets[0].diagnostics[0].message =
      'Mentions fictional-west-capability-alpha explicitly.'
    expect(parses(withIdentifier)).toBe(false)

    const withComponent = clone()
    withComponent.institutionalDatasets[0].diagnostics[0].message =
      'Mentions fictional-site-west explicitly.'
    expect(parses(withComponent)).toBe(false)
  })

  it('rejects lower-tier internal authoring text containing a higher-tier identifier', () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].diagnostics[0].message =
      'Mentions fictional-east-capability-beta explicitly.'
    expect(parses(bundle)).toBe(false)
  })

  it('accepts internal authoring text naming a same-scope, same-tier identifier', () => {
    const bundle = clone()
    bundle.institutionalDatasets[0].diagnostics[0].message =
      'Mentions fictional-east-formulary-alpha explicitly.'
    expect(parses(bundle)).toBe(true)
  })

  it('rejects duplicate diagnostic identifiers within one dataset', () => {
    const east = clone().institutionalDatasets[0]
    east.diagnostics = [east.diagnostics[0], { ...east.diagnostics[0] }]
    expect(institutionalOverlayDatasetSchema.safeParse(east).success).toBe(false)
  })
})
