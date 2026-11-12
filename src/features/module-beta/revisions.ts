import type { BetaModule } from './catalog'

export type BetaRevisionId = string
export type BetaRevisionCategory =
  | 'clinical'
  | 'educational'
  | 'simulation'
  | 'usability'
  | 'technical'

export interface BetaRevisionSection {
  readonly id: string
  readonly title: string
  /** Existing, unlocalized module navigation target. Omit when there is no supported link. */
  readonly path?: `/${string}`
}

export interface BetaModuleRevision {
  readonly moduleId: BetaModule['id']
  /** Stable across deployments and never reused. Feedback and reviews can reference it in V2. */
  readonly revisionId: BetaRevisionId
  /** Explicit order within this module. A higher number is a later approved revision. */
  readonly sequence: number
  readonly displayVersion: string
  /** Verified release date in YYYY-MM-DD format, when known. */
  readonly releasedOn?: string
  readonly category: BetaRevisionCategory
  readonly changelog: readonly [string, ...string[]]
  readonly affectedSections?: readonly BetaRevisionSection[]
  readonly rereviewRecommended: boolean
}

// The owner approves each module baseline against the content intended for beta testing.
export const betaModuleRevisions: readonly BetaModuleRevision[] = []

export function betaRevisionHistory(
  moduleId: BetaModule['id'],
  revisions: readonly BetaModuleRevision[] = betaModuleRevisions,
): BetaModuleRevision[] {
  return revisions
    .filter((revision) => revision.moduleId === moduleId)
    .sort((a, b) => b.sequence - a.sequence)
}

/** Resolve only an approved section ID for this module. Use the newest entry for a repeated ID. */
export function betaRevisionSectionPath(
  revisions: readonly BetaModuleRevision[],
  sectionId: string | string[] | undefined,
) {
  if (typeof sectionId !== 'string') return undefined
  return revisions
    .flatMap((revision) => revision.affectedSections ?? [])
    .find((section) => section.id === sectionId)?.path
}
