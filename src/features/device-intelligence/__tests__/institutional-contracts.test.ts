import {
  INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS,
  accessAllows,
  dataSourceStateSchema,
  demoCapabilityRecordSchema,
  demoFormularyRecordSchema,
  demoOverlayDatasetSchema,
  fictionalInstitutionalOverlayBundleSchema,
  institutionScopeIdentitySchema,
  institutionalApprovalStateSchema,
  institutionalCapabilityRecordSchema,
  institutionalOverlayDatasetSchema,
  institutionalProjectionRequestSchema,
  institutionalSourceReferenceSchema,
} from '@/features/device-intelligence/institutional/contracts'
import {
  FICTIONAL_DEMO_CONTEXT,
  FICTIONAL_HARBOR_EAST_SCOPE,
  FICTIONAL_HARBOR_WEST_SCOPE,
  FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
  FICTIONAL_SUMMIT_SCOPE,
} from '@/features/device-intelligence/institutional/fictional-fixtures'

describe('D2A institutional overlay contracts', () => {
  it('carries the three mandatory foundation labels exactly', () => {
    expect(INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS).toEqual([
      'INSTITUTIONAL CONTRACT FOUNDATION',
      'FICTIONAL DATA ONLY',
      'NOT A DEPLOYED INSTITUTION MODEL',
    ])
    expect(
      fictionalInstitutionalOverlayBundleSchema.parse(FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE)
        .foundationLabels,
    ).toEqual(INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS)
  })

  it('validates the complete fictional bundle without admitting real provenance', () => {
    const parsed = fictionalInstitutionalOverlayBundleSchema.parse(
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
    )
    expect(parsed.fixturePolicy).toBe('fictional_only')
    expect(parsed.demoDatasets).toHaveLength(1)
    expect(parsed.institutionalDatasets).toHaveLength(3)
  })

  it.each(['tenantId', 'institutionId', 'siteId'] as const)(
    'requires explicit %s on every institutional scope',
    (field) => {
      expect(
        institutionScopeIdentitySchema.safeParse({
          ...FICTIONAL_HARBOR_EAST_SCOPE,
          [field]: undefined,
        }).success,
      ).toBe(false)
    },
  )

  it('keeps demo identity disjoint from institutional identity', () => {
    const demoRecord =
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.demoDatasets[0].capabilities.records[0]
    expect(
      demoCapabilityRecordSchema.safeParse({
        ...demoRecord,
        context: {
          ...FICTIONAL_DEMO_CONTEXT,
          scope: FICTIONAL_HARBOR_EAST_SCOPE,
        },
      }).success,
    ).toBe(false)
    expect(
      institutionalCapabilityRecordSchema.safeParse({
        ...demoRecord,
        context: {
          contextKind: 'institutional',
          scope: FICTIONAL_HARBOR_EAST_SCOPE,
          demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId,
        },
        accessClassification: 'institution_restricted',
      }).success,
    ).toBe(false)
  })

  it('does not allow demo data to carry an institutional access label', () => {
    const record = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.demoDatasets[0].capabilities.records[0]
    expect(
      demoCapabilityRecordSchema.safeParse({
        ...record,
        accessClassification: 'institution_restricted',
      }).success,
    ).toBe(false)
  })

  it('does not allow a demo formulary row to claim institutional approval', () => {
    const record = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.demoDatasets[0].formularies.records[0]
    expect(record.approvalState.state).toBe('not_applicable_demo')
    expect(
      demoFormularyRecordSchema.safeParse({
        ...record,
        approvalState: {
          state: 'approved',
          decisionId: 'fictional-demo-decision',
          decisionSource: record.source,
        },
      }).success,
    ).toBe(false)
  })

  it('does not allow institutional data or requests to be public-unlisted', () => {
    const record =
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0].capabilities.records[0]
    expect(
      institutionalCapabilityRecordSchema.safeParse({
        ...record,
        accessClassification: 'public_unlisted',
      }).success,
    ).toBe(false)
    expect(
      institutionalProjectionRequestSchema.safeParse({
        contextKind: 'institutional',
        scope: FICTIONAL_HARBOR_EAST_SCOPE,
        accessClassification: 'public_unlisted',
        projectionTimestamp: '2026-08-12T12:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(accessAllows('public_unlisted', 'institution_restricted')).toBe(false)
  })

  it('rejects authenticated-user metadata as a substitute for explicit scope', () => {
    expect(
      institutionalProjectionRequestSchema.safeParse({
        contextKind: 'institutional',
        authUserMetadata: {
          tenantId: FICTIONAL_HARBOR_EAST_SCOPE.tenantId,
          institutionId: FICTIONAL_HARBOR_EAST_SCOPE.institutionId,
          siteId: FICTIONAL_HARBOR_EAST_SCOPE.siteId,
        },
        accessClassification: 'institution_restricted',
        projectionTimestamp: '2026-08-12T12:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      institutionalProjectionRequestSchema.safeParse({
        contextKind: 'institutional',
        scope: FICTIONAL_HARBOR_EAST_SCOPE,
        authUserMetadata: { institutionId: FICTIONAL_HARBOR_WEST_SCOPE.institutionId },
        accessClassification: 'institution_restricted',
        projectionTimestamp: '2026-08-12T12:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects a row whose exact site scope differs from its dataset scope', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    const capability = east.capabilities.records[0]
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...east,
        capabilities: {
          ...east.capabilities,
          records: [
            {
              ...capability,
              context: {
                contextKind: 'institutional',
                scope: FICTIONAL_HARBOR_WEST_SCOPE,
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects a source whose exact scope differs from its record scope', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    const capability = east.capabilities.records[0]
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...east,
        capabilities: {
          ...east.capabilities,
          records: [
            {
              ...capability,
              source: {
                ...capability.source,
                context: {
                  contextKind: 'institutional',
                  scope: FICTIONAL_HARBOR_WEST_SCOPE,
                },
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects a source access classification that differs from its record', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    const capability = east.capabilities.records[0]
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...east,
        capabilities: {
          ...east.capabilities,
          records: [
            {
              ...capability,
              source: {
                ...capability.source,
                accessClassification: 'institution_confidential',
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it.each([
    [
      'sibling site',
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[1].inventories.records[0]
        .recordId,
    ],
    [
      'different tenant',
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[2].inventories.records[0]
        .recordId,
    ],
  ])('rejects a diagnostic reference into a %s dataset', (_description, relatedRecordId) => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...east,
        diagnostics: [{ ...east.diagnostics[0], relatedRecordId }],
      }).success,
    ).toBe(false)
  })

  it('rejects a public demo diagnostic that discloses an institutional record ID', () => {
    const demo = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.demoDatasets[0]
    const institutionalRecordId =
      FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0].capabilities.records[0]
        .recordId
    expect(
      demoOverlayDatasetSchema.safeParse({
        ...demo,
        diagnostics: [{ ...demo.diagnostics[0], relatedRecordId: institutionalRecordId }],
      }).success,
    ).toBe(false)
  })

  it('rejects a restricted diagnostic that references a confidential record', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    const confidentialDiagnostic = east.diagnostics.find(
      (diagnostic) => diagnostic.relatedRecordId === 'fictional-east-capability-beta',
    )
    expect(confidentialDiagnostic).toBeDefined()
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...east,
        diagnostics: [
          {
            ...confidentialDiagnostic,
            accessClassification: 'institution_restricted',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('accepts a diagnostic at the same classification as its local record', () => {
    const summit = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets.find(
      (dataset) => dataset.context.scope.tenantId === FICTIONAL_SUMMIT_SCOPE.tenantId,
    )
    expect(summit).toBeDefined()
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...summit,
        diagnostics: [
          {
            diagnosticId: 'fictional-summit-inventory-diagnostic',
            code: 'missing_inventory_record',
            severity: 'warning',
            message: 'Fictional local-reference validation fixture.',
            observedAt: '2026-08-03T12:00:00.000Z',
            relatedRecordId: 'fictional-summit-inventory-only',
            context: {
              contextKind: 'institutional',
              scope: FICTIONAL_SUMMIT_SCOPE,
            },
            accessClassification: 'institution_restricted',
          },
        ],
      }).success,
    ).toBe(true)
  })

  it.each(['sourceRevision', 'provenance', 'lastVerifiedAt'] as const)(
    'requires source %s',
    (field) => {
      const source =
        FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0].capabilities.records[0]
          .source
      expect(
        institutionalSourceReferenceSchema.safeParse({
          ...source,
          [field]: undefined,
        }).success,
      ).toBe(false)
    },
  )

  it('models source unknown and source unavailable as separate first-class states', () => {
    expect(dataSourceStateSchema.parse({ state: 'unknown', reason: 'Not checked' }).state).toBe(
      'unknown',
    )
    expect(
      dataSourceStateSchema.parse({ state: 'unavailable', reason: 'Source offline' }).state,
    ).toBe('unavailable')
  })

  it('refuses asserted records when their source is unknown or unavailable', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    for (const state of ['unknown', 'unavailable'] as const) {
      expect(
        institutionalOverlayDatasetSchema.safeParse({
          ...east,
          capabilities: {
            sourceState: { state, reason: 'Fictional test reason' },
            records: east.capabilities.records,
          },
        }).success,
      ).toBe(false)
    }
  })

  it('requires a separate institutional decision source for approval', () => {
    expect(
      institutionalApprovalStateSchema.safeParse({
        state: 'approved',
        decisionId: 'fictional-decision-without-source',
      }).success,
    ).toBe(false)
    expect(
      institutionalApprovalStateSchema.safeParse({
        state: 'unknown',
        reason: 'not_verified',
      }).success,
    ).toBe(true)
  })

  it('requires an approval source to match the record scope and access classification', () => {
    const west = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[1]
    const formulary = west.formularies.records[0]
    if (formulary.approvalState.state !== 'not_approved') {
      throw new Error('Expected explicit fictional not-approved fixture.')
    }
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...west,
        formularies: {
          ...west.formularies,
          records: [
            {
              ...formulary,
              approvalState: {
                ...formulary.approvalState,
                decisionSource: {
                  ...formulary.approvalState.decisionSource,
                  context: {
                    contextKind: 'institutional',
                    scope: FICTIONAL_HARBOR_EAST_SCOPE,
                  },
                  accessClassification: 'institution_confidential',
                },
              },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects non-fictional provenance at the fictional adapter boundary', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    const capability = east.capabilities.records[0]
    expect(
      fictionalInstitutionalOverlayBundleSchema.safeParse({
        ...FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
        institutionalDatasets: [
          {
            ...east,
            capabilities: {
              ...east.capabilities,
              records: [
                {
                  ...capability,
                  source: {
                    ...capability.source,
                    provenance: {
                      ...capability.source.provenance,
                      provenanceClass: 'institution_record',
                    },
                  },
                },
              ],
            },
          },
          ...FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets.slice(1),
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate full-scope institutional datasets', () => {
    const east = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets[0]
    expect(
      fictionalInstitutionalOverlayBundleSchema.safeParse({
        ...FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
        institutionalDatasets: [
          ...FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets,
          east,
        ],
      }).success,
    ).toBe(false)
  })
})
