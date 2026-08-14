import {
  INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS,
  type DemoContextIdentity,
  type InstitutionScopeIdentity,
  type InstitutionalContextIdentity,
} from './contracts'

/**
 * INSTITUTIONAL CONTRACT FOUNDATION
 * FICTIONAL DATA ONLY
 * NOT A DEPLOYED INSTITUTION MODEL
 *
 * Every name and identifier in this file is invented. Nothing here describes a real
 * institution, site, formulary, inventory system, capability, product, or approval.
 *
 * This module is the canonical sealed corpus: the fictional read adapter imports it
 * directly and accepts no runtime dataset input. Adding or changing fictional data means
 * editing this file and passing the sealed-bundle registry and projection-safety checks.
 */

export const FICTIONAL_DEMO_CONTEXT: DemoContextIdentity = {
  contextKind: 'demo',
  demoContextId: 'fictional-device-intelligence-demo-v1',
}

export const FICTIONAL_HARBOR_EAST_SCOPE: InstitutionScopeIdentity = {
  tenantId: 'fictional-tenant-northstar',
  institutionId: 'fictional-institution-harbor',
  siteId: 'fictional-site-east',
}

export const FICTIONAL_HARBOR_WEST_SCOPE: InstitutionScopeIdentity = {
  tenantId: 'fictional-tenant-northstar',
  institutionId: 'fictional-institution-harbor',
  siteId: 'fictional-site-west',
}

export const FICTIONAL_SUMMIT_SCOPE: InstitutionScopeIdentity = {
  tenantId: 'fictional-tenant-summit',
  institutionId: 'fictional-institution-lakeside',
  siteId: 'fictional-site-main',
}

const harborEastContext: InstitutionalContextIdentity = {
  contextKind: 'institutional',
  scope: FICTIONAL_HARBOR_EAST_SCOPE,
}
const harborWestContext: InstitutionalContextIdentity = {
  contextKind: 'institutional',
  scope: FICTIONAL_HARBOR_WEST_SCOPE,
}
const summitContext: InstitutionalContextIdentity = {
  contextKind: 'institutional',
  scope: FICTIONAL_SUMMIT_SCOPE,
}

function fictionalProvenance(id: string, label: string) {
  return {
    provenanceId: id,
    provenanceClass: 'fictional_fixture' as const,
    internalAuthoring: {
      sourceLabel: label,
      sourceLocator: 'fixture://device-intelligence/' + id,
      jurisdiction: 'Fictional jurisdiction for contract testing only',
    },
  }
}

function demoSource(sourceId: string, sourceKind: 'capability' | 'formulary' | 'inventory') {
  return {
    sourceId,
    sourceKind,
    sourceRevision: 'fictional-revision-1',
    provenance: fictionalProvenance(sourceId + '-provenance', 'Invented demo source'),
    lastVerifiedAt: '2026-08-01T12:00:00.000Z',
    context: FICTIONAL_DEMO_CONTEXT,
    accessClassification: 'public_unlisted' as const,
  }
}

function institutionalSource(
  context: InstitutionalContextIdentity,
  sourceId: string,
  sourceKind: 'capability' | 'formulary' | 'inventory' | 'institutional_approval',
  accessClassification:
    | 'institution_restricted'
    | 'institution_confidential' = 'institution_restricted',
) {
  return {
    sourceId,
    sourceKind,
    sourceRevision: 'fictional-revision-1',
    provenance: fictionalProvenance(sourceId + '-provenance', 'Invented institutional source'),
    lastVerifiedAt: '2026-08-02T12:00:00.000Z',
    context,
    accessClassification,
  }
}

const demoDataset = {
  context: FICTIONAL_DEMO_CONTEXT,
  capabilities: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-demo-capability-room-orientation',
        context: FICTIONAL_DEMO_CONTEXT,
        accessClassification: 'public_unlisted' as const,
        capabilityCode: 'fictional-capability-training-room',
        capabilityState: { state: 'available' as const },
        source: demoSource('fictional-demo-capability-source', 'capability'),
      },
    ],
  },
  formularies: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-demo-formulary-alpha',
        context: FICTIONAL_DEMO_CONTEXT,
        accessClassification: 'public_unlisted' as const,
        subjectId: 'fictional-subject-alpha',
        formularyEvidence: {
          state: 'listed' as const,
          formularyEntryId: 'fictional-demo-formulary-entry-alpha',
        },
        approvalState: {
          state: 'not_applicable_demo' as const,
          reason: 'demo_context' as const,
        },
        source: demoSource('fictional-demo-formulary-source', 'formulary'),
      },
    ],
  },
  inventories: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-demo-inventory-alpha',
        context: FICTIONAL_DEMO_CONTEXT,
        accessClassification: 'public_unlisted' as const,
        subjectId: 'fictional-subject-alpha',
        inventoryState: {
          state: 'unknown' as const,
          reason: 'not_reported' as const,
        },
        source: demoSource('fictional-demo-inventory-source', 'inventory'),
      },
    ],
  },
  diagnostics: [
    {
      diagnosticId: 'fictional-demo-diagnostic-approval',
      code: 'approval_unverified' as const,
      severity: 'warning' as const,
      message: 'A fictional formulary listing has no separate approval decision.',
      observedAt: '2026-08-03T12:00:00.000Z',
      relatedRecordId: 'fictional-demo-formulary-alpha',
      context: FICTIONAL_DEMO_CONTEXT,
      accessClassification: 'public_unlisted' as const,
    },
  ],
}

const harborEastDataset = {
  context: harborEastContext,
  capabilities: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-east-capability-alpha',
        context: harborEastContext,
        accessClassification: 'institution_restricted' as const,
        capabilityCode: 'fictional-capability-alpha',
        capabilityState: { state: 'available' as const },
        source: institutionalSource(
          harborEastContext,
          'fictional-east-capability-source',
          'capability',
        ),
      },
      {
        recordId: 'fictional-east-capability-beta',
        context: harborEastContext,
        accessClassification: 'institution_confidential' as const,
        capabilityCode: 'fictional-capability-beta',
        capabilityState: {
          state: 'unavailable' as const,
          reason: 'not_offered' as const,
        },
        source: institutionalSource(
          harborEastContext,
          'fictional-east-capability-confidential-source',
          'capability',
          'institution_confidential',
        ),
      },
    ],
  },
  formularies: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-east-formulary-alpha',
        context: harborEastContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-alpha',
        formularyEvidence: {
          state: 'listed' as const,
          formularyEntryId: 'fictional-east-formulary-entry-alpha',
        },
        approvalState: {
          state: 'unknown' as const,
          reason: 'not_verified' as const,
        },
        source: institutionalSource(
          harborEastContext,
          'fictional-east-formulary-source',
          'formulary',
        ),
      },
      {
        recordId: 'fictional-east-formulary-pending',
        context: harborEastContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-gamma',
        formularyEvidence: {
          state: 'unknown' as const,
          reason: 'not_verified' as const,
        },
        approvalState: {
          state: 'pending_review' as const,
          reviewReference: 'fictional-east-review-entry',
        },
        source: institutionalSource(
          harborEastContext,
          'fictional-east-formulary-pending-source',
          'formulary',
        ),
      },
    ],
  },
  inventories: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-east-inventory-alpha',
        context: harborEastContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-alpha',
        inventoryState: {
          state: 'present' as const,
          quantity: {
            state: 'known' as const,
            value: 4,
            unit: 'each' as const,
          },
        },
        source: institutionalSource(
          harborEastContext,
          'fictional-east-inventory-source',
          'inventory',
        ),
      },
    ],
  },
  diagnostics: [
    {
      diagnosticId: 'fictional-east-diagnostic-approval',
      code: 'approval_unverified' as const,
      severity: 'warning' as const,
      message: 'Fictional formulary evidence remains separate from approval.',
      observedAt: '2026-08-03T12:00:00.000Z',
      relatedRecordId: 'fictional-east-formulary-alpha',
      context: harborEastContext,
      accessClassification: 'institution_restricted' as const,
    },
    {
      diagnosticId: 'fictional-east-diagnostic-confidential-capability',
      code: 'source_unavailable' as const,
      severity: 'warning' as const,
      message: 'A confidential fictional diagnostic tied to a confidential record.',
      observedAt: '2026-08-03T12:00:00.000Z',
      relatedRecordId: 'fictional-east-capability-beta',
      context: harborEastContext,
      accessClassification: 'institution_confidential' as const,
    },
  ],
}

const harborWestDataset = {
  context: harborWestContext,
  capabilities: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-west-capability-alpha',
        context: harborWestContext,
        accessClassification: 'institution_restricted' as const,
        capabilityCode: 'fictional-capability-alpha',
        capabilityState: {
          state: 'unknown' as const,
          reason: 'not_verified' as const,
        },
        source: institutionalSource(
          harborWestContext,
          'fictional-west-capability-source',
          'capability',
        ),
      },
    ],
  },
  formularies: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-west-formulary-alpha',
        context: harborWestContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-alpha',
        formularyEvidence: {
          state: 'not_listed' as const,
          reason: 'confirmed_not_listed' as const,
        },
        approvalState: {
          state: 'not_approved' as const,
          decisionId: 'fictional-west-decision-alpha',
          decisionSource: institutionalSource(
            harborWestContext,
            'fictional-west-approval-source',
            'institutional_approval',
          ),
        },
        source: institutionalSource(
          harborWestContext,
          'fictional-west-formulary-source',
          'formulary',
        ),
      },
    ],
  },
  inventories: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-west-inventory-alpha',
        context: harborWestContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-alpha',
        inventoryState: {
          state: 'absent' as const,
          reason: 'stock_zero_confirmed' as const,
        },
        source: institutionalSource(
          harborWestContext,
          'fictional-west-inventory-source',
          'inventory',
        ),
      },
    ],
  },
  diagnostics: [],
}

const summitDataset = {
  context: summitContext,
  capabilities: {
    sourceState: {
      state: 'unavailable' as const,
      reason: 'source_offline' as const,
    },
    records: [],
  },
  formularies: {
    sourceState: {
      state: 'unknown' as const,
      reason: 'source_not_configured' as const,
    },
    records: [],
  },
  inventories: {
    sourceState: { state: 'available' as const },
    records: [
      {
        recordId: 'fictional-summit-inventory-only',
        context: summitContext,
        accessClassification: 'institution_restricted' as const,
        subjectId: 'fictional-subject-summit-only',
        inventoryState: {
          state: 'unknown' as const,
          reason: 'not_reported' as const,
        },
        source: institutionalSource(
          summitContext,
          'fictional-summit-inventory-source',
          'inventory',
        ),
      },
    ],
  },
  diagnostics: [
    {
      diagnosticId: 'fictional-summit-diagnostic-source',
      code: 'source_unavailable' as const,
      severity: 'warning' as const,
      message: 'An invented source-unavailable state used for contract tests.',
      observedAt: '2026-08-03T12:00:00.000Z',
      relatedRecordId: null,
      context: summitContext,
      accessClassification: 'institution_restricted' as const,
    },
  ],
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child))
    Object.freeze(value)
  }
  return value
}

export const FICTIONAL_INSTITUTIONAL_OVERLAY_BUNDLE = deepFreeze({
  foundationLabels: [...INSTITUTIONAL_CONTRACT_FOUNDATION_LABELS],
  fixturePolicy: 'fictional_only' as const,
  demoDatasets: [demoDataset],
  institutionalDatasets: [harborEastDataset, harborWestDataset, summitDataset],
})
