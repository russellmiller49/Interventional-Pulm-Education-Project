import { BAXTER_CRRT_PHASE_7_CONTENT_VERSION } from './versions'

export type CrrtPhase7EvidenceState =
  | 'product-requirement-only'
  | 'missing-authoritative-source'
  | 'candidate-authoritative-sources-pending-review'
  | 'missing-local-protocol'

export interface CrrtPhase7EvidenceRequirement {
  readonly id: string
  readonly contentVersion: typeof BAXTER_CRRT_PHASE_7_CONTENT_VERSION
  readonly domain: 'clinical' | 'device-safety' | 'local-protocol' | 'learning-design'
  readonly purpose: string
  readonly evidenceState: CrrtPhase7EvidenceState
  readonly sourceTitle: string | null
  readonly sourceLocation: string | null
  readonly reviewer: null
  readonly reviewStatus: 'pending'
  readonly activationAllowed: false
}

const missingSafetyRecord = (id: string, purpose: string): CrrtPhase7EvidenceRequirement =>
  Object.freeze({
    id,
    contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
    domain: 'device-safety' as const,
    purpose,
    evidenceState: 'missing-authoritative-source' as const,
    sourceTitle: null,
    sourceLocation: null,
    reviewer: null,
    reviewStatus: 'pending' as const,
    activationAllowed: false as const,
  })

/**
 * Missing evidence is represented as data instead of being filled with an
 * invented recommendation. These records cannot activate behavior.
 */
export const baxterCrrtPhase7EvidenceRequirements: readonly CrrtPhase7EvidenceRequirement[] =
  Object.freeze([
    Object.freeze({
      id: 'CLIN-001',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      domain: 'clinical' as const,
      purpose:
        'Reviewed evidence set for indications, modalities, solute and fluid goals, complications, and liberation.',
      evidenceState: 'candidate-authoritative-sources-pending-review' as const,
      sourceTitle: 'Phase 7 candidate clinical source registry',
      sourceLocation: 'content/phase7ReviewSources.ts',
      reviewer: null,
      reviewStatus: 'pending' as const,
      activationAllowed: false as const,
    }),
    Object.freeze({
      id: 'PROTO-001',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      domain: 'local-protocol' as const,
      purpose:
        'Versioned local anticoagulation and citrate/calcium rules, concentrations, monitoring, and escalation.',
      evidenceState: 'missing-local-protocol' as const,
      sourceTitle: null,
      sourceLocation: null,
      reviewer: null,
      reviewStatus: 'pending' as const,
      activationAllowed: false as const,
    }),
    Object.freeze({
      id: 'BRIEF-MASTERY-001',
      contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
      domain: 'learning-design' as const,
      purpose:
        'Candidate Mastery requirements: unseen multi-hit state, no hints, score at least 80, no critical error, and reassessment.',
      evidenceState: 'product-requirement-only' as const,
      sourceTitle: 'CRRT AI Coding Assistant Instructions',
      sourceLocation: 'Sections 5.1, 16, and Phase 7',
      reviewer: null,
      reviewStatus: 'pending' as const,
      activationAllowed: false as const,
    }),
    missingSafetyRecord(
      'SAFETY-001',
      'Separate acknowledgement from correction of the underlying fault.',
    ),
    missingSafetyRecord('SAFETY-002', 'Enforce setup, prime, review, and connect gates.'),
    missingSafetyRecord(
      'SAFETY-003',
      'Review candidate blood-return decisions against device evidence and local policy.',
    ),
    missingSafetyRecord(
      'SAFETY-005',
      'Review incompatible set or solution handling against the local configuration.',
    ),
    missingSafetyRecord(
      'SAFETY-006',
      'Review air and blood-leak alarm cause, response, escalation, and reassessment.',
    ),
    missingSafetyRecord(
      'SAFETY-007',
      'Review repeated gain/loss and bag/scale responses before scoring.',
    ),
    missingSafetyRecord(
      'SAFETY-009',
      'Review actions during unresolved access limitation before scoring.',
    ),
    missingSafetyRecord(
      'SAFETY-010',
      'Review escalation for repeated high-risk alarms before scoring.',
    ),
    missingSafetyRecord(
      'SAFETY-011',
      'Review responses to simulated hemodynamic intolerance before scoring.',
    ),
    missingSafetyRecord(
      'SAFETY-012',
      'Keep calcium-verification behavior disabled until local citrate approval.',
    ),
    missingSafetyRecord(
      'SAFETY-013',
      'Review wrong-line, wrong-scale, and wrong-bag configuration handling.',
    ),
  ])

if (
  new Set(baxterCrrtPhase7EvidenceRequirements.map((record) => record.id)).size !==
  baxterCrrtPhase7EvidenceRequirements.length
) {
  throw new Error('Phase 7 evidence requirement IDs must be unique.')
}
