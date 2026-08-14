/**
 * @jest-environment node
 *
 * The request boundary's Proxy-rejection gate uses the host `structuredClone`, which the
 * jsdom test sandbox does not provide; this suite exercises `adapter.project`, so it runs
 * in the Node environment where `structuredClone` is present.
 */
import * as adapterModule from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import {
  assertFictionalCorpusProjectionSafe,
  createFictionalInstitutionalOverlayReadAdapter,
} from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import { fictionalInstitutionalOverlayBundleSchema } from '@/features/device-intelligence/institutional/contracts'
import { FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE } from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * D2A-C2 regression: "fictional only" must be structurally enforced, not self-asserted.
 * Pre-correction, `createFictionalInstitutionalOverlayReadAdapter(input)` accepted any
 * bundle that merely supplied `provenanceClass: 'fictional_fixture'`, so a real-shaped
 * bundle with arbitrary labels, locators, jurisdictions, and identifiers was validated,
 * projected, and served. Post-correction the factory takes no dataset input at all; the
 * canonical in-repository fixture is the only corpus the adapter can ever serve.
 */

const FIXTURE_MODULE = '@/features/device-intelligence/institutional/fictional-fixtures'
const ADAPTER_MODULE = '@/features/device-intelligence/institutional/fictional-readonly-adapter'

/** The exact real-shaped bundle from the pre-correction reproduction of D2A-C2. */
function realLikeBundle(): unknown {
  const scope = {
    tenantId: 'example-regional-health',
    institutionId: 'example-university-hospital',
    siteId: 'example-main-campus',
  }
  const context = { contextKind: 'institutional', scope }
  return {
    foundationLabels: [
      'INSTITUTIONAL CONTRACT FOUNDATION',
      'FICTIONAL DATA ONLY',
      'NOT A DEPLOYED INSTITUTION MODEL',
    ],
    fixturePolicy: 'fictional_only',
    demoDatasets: [],
    institutionalDatasets: [
      {
        context,
        capabilities: {
          sourceState: { state: 'available' },
          records: [
            {
              recordId: 'cap-001',
              context,
              accessClassification: 'institution_restricted',
              capabilityCode: 'ecmo-vv-adult',
              capabilityState: {
                state: 'available',
                statement: 'ECMO VV available in the medical ICU per capability registry.',
              },
              source: {
                sourceId: 'src-001',
                sourceKind: 'capability',
                sourceRevision: '2026-Q2-export',
                provenance: {
                  provenanceId: 'prov-001',
                  sourceLabel: 'Hospital capability registry export',
                  sourceLocator: 'https://intranet.example.org/capability-registry',
                  jurisdiction: 'US-CA',
                  provenanceClass: 'fictional_fixture',
                },
                lastVerifiedAt: '2026-08-02T12:00:00.000Z',
                context,
                accessClassification: 'institution_restricted',
              },
            },
          ],
        },
        formularies: { sourceState: { state: 'available' }, records: [] },
        inventories: { sourceState: { state: 'available' }, records: [] },
        diagnostics: [],
      },
    ],
  }
}

/**
 * Constructs the adapter against a substituted canonical-fixture module and returns the
 * construction error, or null when construction succeeded. This module-isolation path is
 * the only way to hand the adapter a different bundle, and it exists for tests alone.
 */
function constructionError(bundle: unknown): unknown {
  let captured: unknown = null
  jest.isolateModules(() => {
    jest.doMock(FIXTURE_MODULE, () => ({
      __esModule: true,
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE: bundle,
    }))
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require(ADAPTER_MODULE) as typeof adapterModule
      isolated.createFictionalInstitutionalOverlayReadAdapter()
    } catch (error) {
      captured = error
    } finally {
      jest.dontMock(FIXTURE_MODULE)
    }
  })
  return captured
}

describe('D2A-C2 — the fictional corpus is sealed', () => {
  it('exposes a zero-argument factory and rejects any runtime argument loudly', () => {
    expect(createFictionalInstitutionalOverlayReadAdapter.length).toBe(0)
    const callWithArgument = createFictionalInstitutionalOverlayReadAdapter as unknown as (
      input: unknown,
    ) => unknown
    expect(() => callWithArgument(realLikeBundle())).toThrow(/sealed/)
    expect(() => callWithArgument(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE)).toThrow(/sealed/)
    expect(() => callWithArgument(undefined)).toThrow(/sealed/)
  })

  it('exports no other production surface that could accept a bundle', () => {
    expect(Object.keys(adapterModule).sort()).toEqual(
      [
        'assertFictionalCorpusProjectionSafe',
        'createFictionalInstitutionalOverlayReadAdapter',
        'diagnosticVisibleInProjection',
        'lookupCapability',
        'lookupInventory',
      ].sort(),
    )
  })

  it('returns one frozen adapter whose only operation is project', () => {
    const adapter = createFictionalInstitutionalOverlayReadAdapter()
    expect(createFictionalInstitutionalOverlayReadAdapter()).toBe(adapter)
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.keys(adapter)).toEqual(['project'])
  })

  it('keeps the canonical fixture itself deeply frozen', () => {
    expect(Object.isFrozen(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE)).toBe(true)
    expect(Object.isFrozen(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets)).toBe(true)
    expect(
      Object.isFrozen(
        FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0].capabilities.records[0]
          .source.provenance,
      ),
    ).toBe(true)
  })

  it('refuses the real-shaped bundle as a request too', () => {
    const adapter = createFictionalInstitutionalOverlayReadAdapter()
    expect(() => adapter.project(realLikeBundle())).toThrow()
  })

  it('rejects the real-shaped bundle at the schema even with the fictional label', () => {
    // Free-text statements, flat provenance prose, and unregistered identifier shapes no
    // longer exist in the contract, so self-asserting provenanceClass cannot help.
    expect(fictionalInstitutionalOverlayBundleSchema.safeParse(realLikeBundle()).success).toBe(
      false,
    )
  })

  it('refuses construction when the canonical fixture module is substituted with a real-like bundle', () => {
    expect(constructionError(realLikeBundle())).toBeTruthy()
  })

  it('refuses construction when the substituted fixture reproduces the original leak shape', () => {
    const canonical = JSON.parse(JSON.stringify(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE))
    canonical.institutionalDatasets[0].diagnostics[0].relatedRecordId =
      canonical.institutionalDatasets[1].capabilities.records[0].recordId
    expect(constructionError(canonical)).toBeTruthy()
  })

  it('refuses construction when the substituted fixture carries an unreadable instant', () => {
    const canonical = JSON.parse(JSON.stringify(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE))
    canonical.institutionalDatasets[0].capabilities.records[0].source.lastVerifiedAt =
      '2026-08-01T00:00:00+99:99'
    expect(constructionError(canonical)).toBeTruthy()
  })

  it('constructs from an unmodified canonical corpus (the seal test is not vacuous)', () => {
    expect(
      constructionError(JSON.parse(JSON.stringify(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE))),
    ).toBeNull()
  })
})

describe('D2A defense in depth — corpus projection-safety validator', () => {
  it('passes the canonical corpus', () => {
    const parsed = fictionalInstitutionalOverlayBundleSchema.parse(
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
    )
    expect(() => assertFictionalCorpusProjectionSafe(parsed)).not.toThrow()
  })

  it('refuses a corpus whose projection would embed a foreign identifier, even past the schema', () => {
    // Poison the already-parsed structure directly, simulating a future schema gap: an
    // east record id that embeds the sibling site's record id as a substring.
    const parsed = fictionalInstitutionalOverlayBundleSchema.parse(
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
    )
    const poisoned = JSON.parse(JSON.stringify(parsed)) as typeof parsed
    poisoned.institutionalDatasets[0].capabilities.records[0].recordId =
      'zz-fictional-west-capability-alpha'
    expect(() => assertFictionalCorpusProjectionSafe(poisoned)).toThrow(/forbidden|foreign/)
  })

  it('refuses a corpus whose lower-tier projection would embed a higher-tier identifier', () => {
    const parsed = fictionalInstitutionalOverlayBundleSchema.parse(
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
    )
    const poisoned = JSON.parse(JSON.stringify(parsed)) as typeof parsed
    poisoned.institutionalDatasets[0].formularies.records[0].recordId =
      'zz-fictional-east-capability-beta'
    expect(() => assertFictionalCorpusProjectionSafe(poisoned)).toThrow(/forbidden|foreign/)
  })
})
