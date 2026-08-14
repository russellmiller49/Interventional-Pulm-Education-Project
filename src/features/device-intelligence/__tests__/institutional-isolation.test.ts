import {
  DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE,
  type DemoOverlayProjection,
  type InstitutionScopeIdentity,
  type InstitutionalAccessClassification,
  type InstitutionalOverlayProjection,
} from '@/features/device-intelligence/institutional/contracts'
import {
  createFictionalInstitutionalOverlayReadAdapter,
  diagnosticVisibleInProjection,
  lookupCapability,
  lookupInventory,
} from '@/features/device-intelligence/institutional/fictional-readonly-adapter'
import {
  FICTIONAL_DEMO_CONTEXT,
  FICTIONAL_HARBOR_EAST_SCOPE,
  FICTIONAL_HARBOR_WEST_SCOPE,
  FICTIONAL_SUMMIT_SCOPE,
} from '@/features/device-intelligence/institutional/fictional-fixtures'

const PROJECTION_TIMESTAMP = '2026-08-12T12:00:00.000Z'
const adapter = createFictionalInstitutionalOverlayReadAdapter()

// D2A-C4: the public boundary admits serialized JSON text only. These suites exercise the
// projection semantics with valid request objects, so they serialize each request and call
// the JSON entry point rather than passing a live object.
const projectViaJson = (request: unknown) => adapter.projectJson(JSON.stringify(request))

function projectInstitution(
  scope: InstitutionScopeIdentity,
  accessClassification: InstitutionalAccessClassification = 'institution_restricted',
) {
  const projection = projectViaJson({
    contextKind: 'institutional',
    scope,
    accessClassification,
    projectionTimestamp: PROJECTION_TIMESTAMP,
  })
  if (projection.dataset.context.contextKind !== 'institutional') {
    throw new Error('The institutional request returned a demo projection.')
  }
  return projection as InstitutionalOverlayProjection
}

function projectDemo() {
  const projection = projectViaJson({
    contextKind: 'demo',
    demoContextId: FICTIONAL_DEMO_CONTEXT.demoContextId,
    accessClassification: 'public_unlisted',
    projectionTimestamp: PROJECTION_TIMESTAMP,
  })
  if (projection.dataset.context.contextKind !== 'demo') {
    throw new Error('The demo request returned an institutional projection.')
  }
  return projection as DemoOverlayProjection
}

describe('D2A fictional adapter isolation and no-leak behavior', () => {
  it('returns records only for the exact tenant/institution/site tuple', () => {
    const east = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const west = projectInstitution(FICTIONAL_HARBOR_WEST_SCOPE)

    expect(east.dataset.capabilities.records.map((record) => record.recordId)).toEqual([
      'fictional-east-capability-alpha',
    ])
    expect(west.dataset.capabilities.records.map((record) => record.recordId)).toEqual([
      'fictional-west-capability-alpha',
    ])
    expect(
      east.dataset.capabilities.records.every(
        (record) => record.context.scope.siteId === FICTIONAL_HARBOR_EAST_SCOPE.siteId,
      ),
    ).toBe(true)
    expect(
      west.dataset.capabilities.records.every(
        (record) => record.context.scope.siteId === FICTIONAL_HARBOR_WEST_SCOPE.siteId,
      ),
    ).toBe(true)
  })

  it('does not infer a dataset from a partially matching institution or site', () => {
    const wrongTenant = projectInstitution({
      ...FICTIONAL_HARBOR_EAST_SCOPE,
      tenantId: 'fictional-tenant-not-authorized',
    })
    expect(wrongTenant.dataset.capabilities.records).toEqual([])
    expect(wrongTenant.dataset.formularies.records).toEqual([])
    expect(wrongTenant.dataset.inventories.records).toEqual([])
    expect(wrongTenant.dataset.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'scope_not_configured',
    ])
  })

  it('fails closed for an unknown institution scope without falling back to demo', () => {
    const projection = projectInstitution({
      tenantId: 'fictional-unknown-tenant',
      institutionId: 'fictional-unknown-institution',
      siteId: 'fictional-unknown-site',
    })
    expect(projection.dataset.context.contextKind).toBe('institutional')
    expect(projection.accessClassification).toBe('institution_restricted')
    expect(projection.dataset.capabilities.sourceState.state).toBe('unknown')
    expect(projection.dataset.capabilities.records).toEqual([])
    expect(JSON.stringify(projection)).not.toContain(FICTIONAL_DEMO_CONTEXT.demoContextId)
  })

  it('keeps public-unlisted demo projections free of every institutional record', () => {
    const projection = projectDemo()
    const records = [
      ...projection.dataset.capabilities.records,
      ...projection.dataset.formularies.records,
      ...projection.dataset.inventories.records,
    ]
    expect(projection.accessClassification).toBe('public_unlisted')
    expect(projection.dataset.context.contextKind).toBe('demo')
    expect(records.length).toBeGreaterThan(0)
    expect(records.every((record) => record.context.contextKind === 'demo')).toBe(true)
    expect(records.every((record) => record.accessClassification === 'public_unlisted')).toBe(true)
    expect(JSON.stringify(projection)).not.toContain(FICTIONAL_HARBOR_EAST_SCOPE.institutionId)
  })

  it('refuses an institutional request for a public-unlisted projection', () => {
    expect(() =>
      projectViaJson({
        contextKind: 'institutional',
        scope: FICTIONAL_HARBOR_EAST_SCOPE,
        accessClassification: 'public_unlisted',
        projectionTimestamp: PROJECTION_TIMESTAMP,
      }),
    ).toThrow()
  })

  it('filters confidential records from a restricted projection without widening scope', () => {
    const restricted = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_restricted')
    const confidential = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_confidential')
    expect(
      restricted.dataset.capabilities.records.some(
        (record) => record.recordId === 'fictional-east-capability-beta',
      ),
    ).toBe(false)
    expect(
      confidential.dataset.capabilities.records.some(
        (record) => record.recordId === 'fictional-east-capability-beta',
      ),
    ).toBe(true)
    expect(
      restricted.dataset.diagnostics.some(
        (diagnostic) =>
          diagnostic.diagnosticId === 'fictional-east-diagnostic-confidential-capability',
      ),
    ).toBe(false)
    expect(
      confidential.dataset.diagnostics.some(
        (diagnostic) =>
          diagnostic.diagnosticId === 'fictional-east-diagnostic-confidential-capability',
      ),
    ).toBe(true)
    expect(
      confidential.dataset.capabilities.records.every(
        (record) => record.context.scope.siteId === FICTIONAL_HARBOR_EAST_SCOPE.siteId,
      ),
    ).toBe(true)
  })

  it('defensively omits an otherwise-visible diagnostic when its target was excluded', () => {
    expect(
      diagnosticVisibleInProjection(
        {
          accessClassification: 'institution_restricted',
          relatedRecordId: 'fictional-east-capability-beta',
        },
        'institution_restricted',
        new Set(['fictional-east-capability-alpha']),
      ),
    ).toBe(false)
  })

  it('treats a missing capability as unknown, never unavailable', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const result = lookupCapability(projection, 'fictional-capability-not-recorded')
    expect(result.lookupState).toBe('unknown')
    expect(result.lookupState).not.toBe('unavailable')
  })

  it('requires an observed capability record to state explicit unavailability', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE, 'institution_confidential')
    const result = lookupCapability(projection, 'fictional-capability-beta')
    expect(result.lookupState).toBe('observed')
    if (result.lookupState !== 'observed') throw new Error('Expected observed capability fixture.')
    expect(result.record.capabilityState.state).toBe('unavailable')
  })

  it('treats missing inventory as unknown, never absent', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const result = lookupInventory(projection, 'fictional-subject-not-recorded')
    expect(result.lookupState).toBe('unknown')
    expect(result.lookupState).not.toBe('absent')
  })

  it('requires an observed inventory record to state explicit absence', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_WEST_SCOPE)
    const result = lookupInventory(projection, 'fictional-subject-alpha')
    expect(result.lookupState).toBe('observed')
    if (result.lookupState !== 'observed') throw new Error('Expected observed inventory fixture.')
    expect(result.record.inventoryState.state).toBe('absent')
  })

  it('preserves source-unavailable separately from an unknown record', () => {
    const projection = projectInstitution(FICTIONAL_SUMMIT_SCOPE)
    expect(lookupCapability(projection, 'fictional-capability-alpha').lookupState).toBe(
      'unavailable',
    )
    expect(lookupInventory(projection, 'fictional-subject-alpha').lookupState).toBe('unknown')
  })

  it('does not convert formulary evidence into institutional approval', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const row = projection.dataset.formularies.records[0]
    expect(row.formularyEvidence.state).toBe('listed')
    expect(row.approvalState.state).toBe('unknown')
  })

  it('preserves pending review as a scoped reference, not prose', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const pending = projection.dataset.formularies.records.find(
      (record) => record.recordId === 'fictional-east-formulary-pending',
    )
    expect(pending).toBeDefined()
    if (!pending || pending.approvalState.state !== 'pending_review') {
      throw new Error('Expected the explicit fictional pending-review fixture.')
    }
    expect(pending.approvalState.reviewReference).toBe('fictional-east-review-entry')
    expect(pending.formularyEvidence.state).toBe('unknown')
  })

  it('projects diagnostics as controlled template keys without authoring messages', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const diagnostic = projection.dataset.diagnostics[0]
    expect(diagnostic.messageTemplateKey).toBe(
      DIAGNOSTIC_MESSAGE_TEMPLATE_KEY_BY_CODE[diagnostic.code],
    )
    expect('message' in diagnostic).toBe(false)
  })

  it('preserves revision, provenance, verification, projection time, and diagnostics', () => {
    const projection = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const source = projection.dataset.capabilities.records[0].source
    expect(projection.projectionTimestamp).toBe(PROJECTION_TIMESTAMP)
    expect(source.sourceRevision).toBe('fictional-revision-1')
    expect(source.provenance.provenanceClass).toBe('fictional_fixture')
    expect(source.lastVerifiedAt).toBe('2026-08-02T12:00:00.000Z')
    expect(projection.dataset.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'approval_unverified',
    )
  })

  it('is deterministic, deeply frozen, and exposes no write operation', () => {
    const first = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    const second = projectInstitution(FICTIONAL_HARBOR_EAST_SCOPE)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.dataset)).toBe(true)
    expect(Object.isFrozen(first.dataset.capabilities.records)).toBe(true)
    expect(Object.keys(adapter)).toEqual(['projectJson'])
    expect(Object.isFrozen(adapter)).toBe(true)
  })

  it('rejects evidence or diagnostics from after the projection timestamp', () => {
    expect(() =>
      projectViaJson({
        contextKind: 'institutional',
        scope: FICTIONAL_HARBOR_EAST_SCOPE,
        accessClassification: 'institution_restricted',
        projectionTimestamp: '2026-08-01T00:00:00.000Z',
      }),
    ).toThrow()
  })
})
