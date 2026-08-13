import {
  type InstitutionScopeIdentity,
  type InstitutionalAccessClassification,
  type InstitutionalOverlayDataset,
  institutionalOverlayDatasetSchema,
} from '@/features/device-intelligence/institutional/contracts'
import { createFictionalInstitutionalOverlayReadAdapter } from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import {
  FICTIONAL_DEMO_CONTEXT,
  FICTIONAL_HARBOR_EAST_SCOPE,
  FICTIONAL_HARBOR_WEST_SCOPE,
  FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
  FICTIONAL_SUMMIT_SCOPE,
} from '@/features/device-intelligence/institutional/fictional-fixtures'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION — FICTIONAL DATA ONLY.
 *
 * Regression coverage for the exact cross-reference leak shape closed by the D2A
 * correction commit, plus serialization scans asserting that a permitted projection's
 * JSON never carries an identifier belonging to a scope the caller cannot read.
 *
 * These assertions run against the serialized projection rather than a display component,
 * so a future change that filters only in JSX still fails here.
 */

const PROJECTION_TIMESTAMP = '2026-08-12T12:00:00.000Z'
const adapter = createFictionalInstitutionalOverlayReadAdapter(
  FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
)

const [eastDataset, westDataset, summitDataset] =
  FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets
const demoDataset = FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.demoDatasets[0]

function projectInstitution(
  scope: InstitutionScopeIdentity,
  accessClassification: InstitutionalAccessClassification = 'institution_restricted',
) {
  return adapter.project({
    contextKind: 'institutional',
    scope,
    accessClassification,
    projectionTimestamp: PROJECTION_TIMESTAMP,
  })
}

function projectDemo() {
  return adapter.project({
    contextKind: 'demo',
    demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId,
    accessClassification: 'public_unlisted',
    projectionTimestamp: PROJECTION_TIMESTAMP,
  })
}

type AnyDataset = (typeof FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE.institutionalDatasets)[number]

/**
 * Identifiers that name a specific scope's own rows, sources, and evidence. `subjectId` is
 * deliberately excluded: it names a device subject shared across every scope by design, so
 * it carries no institutional identity and would make the scan vacuous.
 */
function scopeDistinctiveIdentifiers(dataset: AnyDataset | typeof demoDataset): string[] {
  const records = [
    ...dataset.capabilities.records,
    ...dataset.formularies.records,
    ...dataset.inventories.records,
  ]
  const values: string[] = []
  records.forEach((record) => {
    values.push(record.recordId, record.source.sourceId, record.source.provenance.provenanceId)
    values.push(record.source.provenance.sourceLocator)
    if ('formularyEvidence' in record && record.formularyEvidence.state === 'listed') {
      values.push(record.formularyEvidence.formularyEntryId)
    }
    if ('approvalState' in record && 'decisionId' in record.approvalState) {
      values.push(record.approvalState.decisionId)
      values.push(record.approvalState.decisionSource.sourceId)
      values.push(record.approvalState.decisionSource.provenance.provenanceId)
    }
  })
  dataset.diagnostics.forEach((diagnostic) => values.push(diagnostic.diagnosticId))
  return Array.from(new Set(values))
}

describe('D2A regression — the exact original cross-reference leak shape', () => {
  it('refuses a bundle whose diagnostic points at a sibling-site record', () => {
    const westRecordId = westDataset.capabilities.records[0].recordId
    const leaking = {
      ...FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE,
      institutionalDatasets: [
        {
          ...eastDataset,
          diagnostics: [{ ...eastDataset.diagnostics[0], relatedRecordId: westRecordId }],
        },
        westDataset,
        summitDataset,
      ],
    }
    expect(() => createFictionalInstitutionalOverlayReadAdapter(leaking)).toThrow()
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...eastDataset,
        diagnostics: [{ ...eastDataset.diagnostics[0], relatedRecordId: westRecordId }],
      }).success,
    ).toBe(false)
  })

  it('refuses a bundle whose diagnostic points at a cross-tenant record', () => {
    const summitRecordId = summitDataset.inventories.records[0].recordId
    expect(
      institutionalOverlayDatasetSchema.safeParse({
        ...eastDataset,
        diagnostics: [{ ...eastDataset.diagnostics[0], relatedRecordId: summitRecordId }],
      }).success,
    ).toBe(false)
  })

  it('never serializes a confidential record id into a restricted projection', () => {
    const confidentialRecordId = 'fictional-east-capability-beta'
    const confidential = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_confidential')
    const restricted = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_restricted')

    // the confidential tier can see the row, so the fixture genuinely exercises exclusion
    expect(JSON.stringify(confidential)).toContain(confidentialRecordId)
    // ...and the restricted tier sees neither the row nor any reference to it
    expect(JSON.stringify(restricted)).not.toContain(confidentialRecordId)
    expect(JSON.stringify(restricted)).not.toContain(
      'fictional-east-capability-confidential-source',
    )
    expect(JSON.stringify(restricted)).not.toContain(
      'fictional-east-diagnostic-confidential-capability',
    )
  })

  it('filters before projection rather than relying on a display-layer check', () => {
    // The excluded diagnostic is absent from the parsed data structure itself, so no
    // consumer — JSX, analytics, logging, or RSC payload — can reach it.
    const restricted = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_restricted')
    const dataset = restricted.dataset as InstitutionalOverlayDataset
    expect(dataset.diagnostics.map((diagnostic) => diagnostic.relatedRecordId)).not.toContain(
      'fictional-east-capability-beta',
    )
    expect(
      dataset.diagnostics.every((diagnostic) =>
        diagnostic.relatedRecordId === null
          ? true
          : [
              ...dataset.capabilities.records,
              ...dataset.formularies.records,
              ...dataset.inventories.records,
            ].some((record) => record.recordId === diagnostic.relatedRecordId),
      ),
    ).toBe(true)
  })
})

describe('D2A serialization scans — no identifier crosses a scope boundary', () => {
  it('keeps every institutional identifier out of the public-unlisted demo projection', () => {
    const serialized = JSON.stringify(projectDemo())
    const forbidden = [
      FICTIONAL_HARBOR_EAST_SCOPE.tenantId,
      FICTIONAL_HARBOR_EAST_SCOPE.institutionId,
      FICTIONAL_HARBOR_EAST_SCOPE.siteId,
      FICTIONAL_HARBOR_WEST_SCOPE.siteId,
      FICTIONAL_SUMMIT_SCOPE.tenantId,
      FICTIONAL_SUMMIT_SCOPE.institutionId,
      FICTIONAL_SUMMIT_SCOPE.siteId,
      ...scopeDistinctiveIdentifiers(eastDataset),
      ...scopeDistinctiveIdentifiers(westDataset),
      ...scopeDistinctiveIdentifiers(summitDataset),
    ]
    expect(forbidden.length).toBeGreaterThan(10)
    forbidden.forEach((value) => expect(serialized).not.toContain(value))
    expect(serialized).toContain('public_unlisted')
    expect(serialized).not.toContain('institution_restricted')
    expect(serialized).not.toContain('institution_confidential')
  })

  it('keeps sibling-site identifiers out of a same-institution projection', () => {
    const east = JSON.stringify(projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE))
    // the caller legitimately shares tenant and institution with the sibling site...
    expect(east).toContain(FICTIONAL_HARBOR_WEST_SCOPE.tenantId)
    expect(east).toContain(FICTIONAL_HARBOR_WEST_SCOPE.institutionId)
    // ...but must see nothing that names the sibling site or its rows
    expect(east).not.toContain(FICTIONAL_HARBOR_WEST_SCOPE.siteId)
    scopeDistinctiveIdentifiers(westDataset).forEach((value) => expect(east).not.toContain(value))
  })

  it('keeps cross-tenant identifiers out of a projection entirely', () => {
    const east = JSON.stringify(projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE))
    ;[
      FICTIONAL_SUMMIT_SCOPE.tenantId,
      FICTIONAL_SUMMIT_SCOPE.institutionId,
      FICTIONAL_SUMMIT_SCOPE.siteId,
      ...scopeDistinctiveIdentifiers(summitDataset),
    ].forEach((value) => expect(east).not.toContain(value))
  })

  it('exposes no sibling scope through an unconfigured-scope projection', () => {
    const serialized = JSON.stringify(
      projectInstitution({
        tenantId: 'fictional-unknown-tenant',
        institutionId: 'fictional-unknown-institution',
        siteId: 'fictional-unknown-site',
      }),
    )
    ;[
      FICTIONAL_HARBOR_EAST_SCOPE.tenantId,
      FICTIONAL_HARBOR_EAST_SCOPE.institutionId,
      FICTIONAL_HARBOR_EAST_SCOPE.siteId,
      FICTIONAL_HARBOR_WEST_SCOPE.siteId,
      FICTIONAL_SUMMIT_SCOPE.tenantId,
      FICTIONAL_DEMO_CONTEXT.demoContextId,
      ...scopeDistinctiveIdentifiers(eastDataset),
      ...scopeDistinctiveIdentifiers(westDataset),
      ...scopeDistinctiveIdentifiers(summitDataset),
      ...scopeDistinctiveIdentifiers(demoDataset),
    ].forEach((value) => expect(serialized).not.toContain(value))
  })

  it('reveals no other scope through diagnostic counts or ordering', () => {
    // An aggregate difference must not disclose that a sibling scope exists or how large it
    // is: every scope's diagnostics are drawn only from its own dataset.
    const east = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const west = projectInstitution(FICTIONAL_HARBOR_WEST_SCOPE)
    const unknown = projectInstitution({
      tenantId: 'fictional-unknown-tenant',
      institutionId: 'fictional-unknown-institution',
      siteId: 'fictional-unknown-site',
    })
    expect(east.dataset.diagnostics).toHaveLength(1)
    expect(west.dataset.diagnostics).toHaveLength(0)
    expect(unknown.dataset.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'scope_not_configured',
    ])
    // repeated reads are byte-identical, so no timing or ordering channel varies the output
    expect(JSON.stringify(projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE))).toBe(
      JSON.stringify(east),
    )
  })

  it('names no inaccessible scope in a refusal error', () => {
    let message = ''
    try {
      adapter.project({
        contextKind: 'institutional',
        scope: FICTIONAL_HARBOR_EAST_SCOPE,
        accessClassification: 'public_unlisted',
        projectionTimestamp: PROJECTION_TIMESTAMP,
      })
    } catch (error) {
      message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    }
    expect(message).not.toBe('')
    ;[
      FICTIONAL_HARBOR_WEST_SCOPE.siteId,
      FICTIONAL_SUMMIT_SCOPE.tenantId,
      FICTIONAL_SUMMIT_SCOPE.institutionId,
      ...scopeDistinctiveIdentifiers(westDataset),
      ...scopeDistinctiveIdentifiers(summitDataset),
      ...scopeDistinctiveIdentifiers(eastDataset),
    ].forEach((value) => expect(message).not.toContain(value))
  })
})
