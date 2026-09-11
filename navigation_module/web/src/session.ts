import type { WebCase, ScopeViewProfileId } from './types'
export interface TrainerSession {
  schema: 'trainer-session/v1'
  caseId: string
  source: string
  activeTargetId: string
  locationId: string
  targetLocationIndex: number
  mode: 'setup' | 'practice' | 'test'
  selectedEndpointId: number
  selectedEdgeId: number | null
  currentDecisionIndex: number
  driveDistanceMm: number
  committedPathEdgeIds: number[]
  remainingCorrectTerminalIds: number[]
  testAttemptResults: Record<string, boolean>
  scopeViewProfile: ScopeViewProfileId
}
export const sessionKey = (c: WebCase) => `bronchoedu:session:v1:${c.caseId}`
export const sessionSource = (c: WebCase) => c.ct.signedPreview?.sourceSha256 ?? c.initial.sourceCt
export function readTrainerSession(raw: string | null, c: WebCase): TrainerSession | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as TrainerSession,
      nodes = new Set(c.airway.nodes.map((n) => n.id)),
      edges = new Set(c.airway.edges.map((e) => e.id))
    if (
      s.schema !== 'trainer-session/v1' ||
      s.caseId !== c.caseId ||
      s.source !== sessionSource(c) ||
      !['setup', 'practice', 'test'].includes(s.mode)
    )
      return null
    if (
      !c.noduleTargets?.some((t) => t.id === s.activeTargetId) ||
      typeof s.locationId !== 'string' ||
      !nodes.has(s.selectedEndpointId)
    )
      return null
    if (s.selectedEdgeId !== null && !edges.has(s.selectedEdgeId)) return null
    if (
      !Number.isInteger(s.targetLocationIndex) ||
      s.targetLocationIndex < 0 ||
      !Number.isInteger(s.currentDecisionIndex) ||
      s.currentDecisionIndex < 0 ||
      s.currentDecisionIndex > c.airway.nodes.length
    )
      return null
    if (!Number.isFinite(s.driveDistanceMm) || s.driveDistanceMm < 0 || s.driveDistanceMm > 3000)
      return null
    if (
      !Array.isArray(s.committedPathEdgeIds) ||
      s.committedPathEdgeIds.length > 1000 ||
      s.committedPathEdgeIds.some((id) => !edges.has(id))
    )
      return null
    if (
      !Array.isArray(s.remainingCorrectTerminalIds) ||
      s.remainingCorrectTerminalIds.length > 1000 ||
      s.remainingCorrectTerminalIds.some((id) => !nodes.has(id))
    )
      return null
    if (
      !s.testAttemptResults ||
      typeof s.testAttemptResults !== 'object' ||
      Object.entries(s.testAttemptResults).some(
        ([key, value]) => !nodes.has(Number(key)) || typeof value !== 'boolean',
      )
    )
      return null
    if (!['flexible', 'robotic'].includes(s.scopeViewProfile)) return null
    return s
  } catch {
    return null
  }
}
