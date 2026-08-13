import { fictionalInstitutionalOverlayBundleSchema } from '@/features/device-intelligence/institutional/contracts'
import { FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE } from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * D2A-C1 adversarial matrix, preserved from the Codex finding: 27 formerly
 * projection-visible string fields × 6 forbidden identifiers = 162 injection cases.
 *
 * Pre-correction (head f6b725e9): 153/162 cases validated, projected, and SERIALIZED the
 * forbidden identifier into a permitted projection; the remaining 9 were refused only by
 * incidental pre-existing rules (3 intra-dataset recordId duplicates, 6 dataset-context
 * echoes), not by any identifier-scoping defense.
 *
 * Post-correction requirement: 162/162 refused at the schema or bundle-sealing layer,
 * 0/162 serialized. Fields that were free text pre-correction (statements, source-state
 * reasons, unit) are now controlled enums, so the injection lands in the same conceptual
 * position with the corrected field shape.
 */

const FORBIDDEN: ReadonlyArray<readonly [string, string]> = [
  ['sibling-site siteId', 'fictional-site-west'],
  ['sibling-site recordId', 'fictional-west-capability-alpha'],
  ['sibling-site sourceId', 'fictional-west-capability-source'],
  ['cross-tenant tenantId', 'fictional-tenant-summit'],
  ['confidential-tier recordId', 'fictional-east-capability-beta'],
  ['confidential-tier sourceId', 'fictional-east-capability-confidential-source'],
]

/* eslint-disable @typescript-eslint/no-explicit-any */
const clone = (): any => JSON.parse(JSON.stringify(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE))

const FIELDS: ReadonlyArray<{ name: string; inject: (bundle: any, value: string) => void }> = [
  {
    name: 'capability recordId',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].recordId = v
    },
  },
  {
    name: 'capability capabilityCode',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].capabilityCode = v
    },
  },
  {
    name: 'capability unavailable reason',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].capabilityState = {
        state: 'unavailable',
        reason: v,
      }
    },
  },
  {
    name: 'capability sourceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.sourceId = v
    },
  },
  {
    name: 'capability sourceRevision',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.sourceRevision = v
    },
  },
  {
    name: 'capability provenanceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.provenance.provenanceId = v
    },
  },
  {
    name: 'capability sourceLabel',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.provenance.internalAuthoring.sourceLabel =
        v
    },
  },
  {
    name: 'capability sourceLocator',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.provenance.internalAuthoring.sourceLocator =
        v
    },
  },
  {
    name: 'capability jurisdiction',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities.records[0].source.provenance.internalAuthoring.jurisdiction =
        v
    },
  },
  {
    name: 'formulary recordId',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].recordId = v
      b.institutionalDatasets[0].diagnostics[0].relatedRecordId = v
    },
  },
  {
    name: 'formulary subjectId',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].subjectId = v
    },
  },
  {
    name: 'formulary formularyEntryId',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].formularyEvidence = {
        state: 'listed',
        formularyEntryId: v,
      }
    },
  },
  {
    name: 'formulary not-listed reason',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].formularyEvidence = {
        state: 'not_listed',
        reason: v,
      }
    },
  },
  {
    name: 'approval pending reviewReference',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].approvalState = {
        state: 'pending_review',
        reviewReference: v,
      }
    },
  },
  {
    name: 'formulary sourceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].source.sourceId = v
    },
  },
  {
    name: 'formulary provenanceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies.records[0].source.provenance.provenanceId = v
    },
  },
  {
    name: 'inventory recordId',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].recordId = v
    },
  },
  {
    name: 'inventory subjectId',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].subjectId = v
    },
  },
  {
    name: 'inventory quantity unit',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].inventoryState.quantity.unit = v
    },
  },
  {
    name: 'inventory absent reason',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].inventoryState = {
        state: 'absent',
        reason: v,
      }
    },
  },
  {
    name: 'inventory sourceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].source.sourceId = v
    },
  },
  {
    name: 'inventory provenanceId',
    inject: (b, v) => {
      b.institutionalDatasets[0].inventories.records[0].source.provenance.provenanceId = v
    },
  },
  {
    name: 'diagnostic diagnosticId',
    inject: (b, v) => {
      b.institutionalDatasets[0].diagnostics[0].diagnosticId = v
    },
  },
  {
    name: 'diagnostic message',
    inject: (b, v) => {
      b.institutionalDatasets[0].diagnostics[0].message = v
    },
  },
  {
    name: 'capabilities sourceState reason',
    inject: (b, v) => {
      b.institutionalDatasets[0].capabilities = {
        sourceState: { state: 'unknown', reason: v },
        records: [],
      }
      b.institutionalDatasets[0].diagnostics = []
    },
  },
  {
    name: 'formularies sourceState reason',
    inject: (b, v) => {
      b.institutionalDatasets[0].formularies = {
        sourceState: { state: 'unavailable', reason: v },
        records: [],
      }
      b.institutionalDatasets[0].diagnostics = []
    },
  },
  {
    name: 'dataset context siteId',
    inject: (b, v) => {
      b.institutionalDatasets[0].context = {
        contextKind: 'institutional',
        scope: { ...b.institutionalDatasets[0].context.scope, siteId: v },
      }
    },
  },
]
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('D2A-C1 matrix — 27 fields × 6 forbidden identifiers', () => {
  it('pins the preserved matrix dimensions', () => {
    expect(FIELDS).toHaveLength(27)
    expect(FORBIDDEN).toHaveLength(6)
  })

  it('accepts the canonical corpus itself (the matrix is not vacuous)', () => {
    expect(
      fictionalInstitutionalOverlayBundleSchema.safeParse(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE)
        .success,
    ).toBe(true)
  })

  it('refuses all 162 forbidden-identifier injections at the sealing boundary', () => {
    const survivors: string[] = []
    let refused = 0
    FIELDS.forEach((field) => {
      FORBIDDEN.forEach(([label, value]) => {
        const bundle = clone()
        field.inject(bundle, value)
        const result = fictionalInstitutionalOverlayBundleSchema.safeParse(bundle)
        if (result.success) {
          survivors.push(`${field.name} <- ${label}`)
        } else {
          refused += 1
        }
      })
    })
    expect(survivors).toEqual([])
    expect(refused).toBe(FIELDS.length * FORBIDDEN.length)
    expect(refused).toBe(162)
  })

  it.each(FORBIDDEN.map(([label, value]) => [label, value]))(
    'field-level control: a well-formed bundle still refuses %s in a governed code',
    (_label, value) => {
      const bundle = clone()
      bundle.institutionalDatasets[0].capabilities.records[0].capabilityCode = value
      expect(fictionalInstitutionalOverlayBundleSchema.safeParse(bundle).success).toBe(false)
    },
  )
})
