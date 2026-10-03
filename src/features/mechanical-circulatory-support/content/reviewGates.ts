export type McsReleaseGateId =
  | 'advanced-hf-physician'
  | 'multidisciplinary-mcs-clinician'
  | 'labeling-revision'
  | 'recall-check-content-freeze'
  | 'recall-check-prepublication'
  | 'simulation-verification'
  | 'three-dimensional-provenance'
  | 'accessibility-and-browser-qa'
  | 'analytics-privacy'
  | 'educational-disclaimer'

export interface McsReleaseGate {
  id: McsReleaseGateId
  label: string
  owner: string
  complete: boolean
  evidence: string | null
}

export const mcsReleaseGates: readonly McsReleaseGate[] = [
  {
    id: 'advanced-hf-physician',
    label: 'Advanced-heart-failure/MCS physician clinical review',
    owner: 'Clinical review',
    complete: false,
    evidence: null,
  },
  {
    id: 'multidisciplinary-mcs-clinician',
    label: 'ICU nurse, APP, perfusionist, or clinical-engineer review',
    owner: 'Clinical review',
    complete: false,
    evidence: null,
  },
  {
    id: 'labeling-revision',
    label: 'IABP, Impella, and durable-LVAD revision verification',
    owner: 'Content lead',
    complete: false,
    evidence:
      'FDA PMA indexes and manufacturer pages are registered but were not opened for this module; current local IFUs still require signed reconciliation.',
  },
  {
    id: 'recall-check-content-freeze',
    label: 'Recall and field-safety notice check at content freeze',
    owner: 'Content lead',
    complete: false,
    evidence:
      'FDA Impella CP, Impella RP sensor, Impella controller, and HeartMate power-system notice records are registered, not opened; current status is unverified and a formal all-device content-freeze sweep remains required.',
  },
  {
    id: 'recall-check-prepublication',
    label: 'Repeat recall and field-safety notice check immediately before publication',
    owner: 'Release owner',
    complete: false,
    evidence: null,
  },
  {
    id: 'simulation-verification',
    label: 'Clinical directionality, safe paths, bounds, and critical errors verified',
    owner: 'Clinical + engineering',
    complete: false,
    evidence: null,
  },
  {
    id: 'three-dimensional-provenance',
    label: '3D provenance, derivative rights, landmark placement, and payload reviewed',
    owner: 'Design + legal',
    complete: false,
    evidence:
      'Project-authored vessel/IABP assets and generated payload manifest are recorded; redistribution approval for the supplied Impella/LVAD derivatives remains pending.',
  },
  {
    id: 'accessibility-and-browser-qa',
    label: 'Keyboard, reduced motion, contrast, mobile, WebGL fallback, and rendered QA',
    owner: 'QA',
    complete: false,
    evidence: null,
  },
  {
    id: 'analytics-privacy',
    label: 'Aggregate-only analytics contract verified',
    owner: 'Privacy + engineering',
    complete: true,
    evidence: 'Automated payload allowlist test.',
  },
  {
    id: 'educational-disclaimer',
    label: 'Scope and educational disclaimers approved',
    owner: 'Clinical + legal',
    complete: false,
    evidence: null,
  },
] as const

export function isMcsPublicationReady(gates: readonly McsReleaseGate[] = mcsReleaseGates): boolean {
  return gates.length > 0 && gates.every((gate) => gate.complete && Boolean(gate.evidence))
}
