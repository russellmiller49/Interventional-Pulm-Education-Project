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

// Add a row only through an explicit revision approval. See docs/module-beta-versioning.md.
export const betaModuleRevisions: readonly BetaModuleRevision[] = [
  {
    moduleId: 'baxter-crrt',
    revisionId: 'baxter-crrt-1',
    sequence: 1,
    displayVersion: 'Beta v0.1',
    category: 'educational',
    changelog: [
      'Expanded the lessons on when to use CRRT, how to prescribe the dose, how to choose and monitor anticoagulation, and when to transition off CRRT.',
      'The liver failure practice case now states the signs of shock in the case stem and explains how hemodynamic instability affects modality choice.',
    ],
    affectedSections: [
      {
        id: 'crrt-indications-modality',
        title: 'Indications and modality choice',
        path: '/baxter-crrt/learn?lesson=crrt-indications-modality',
      },
      {
        id: 'crrt-prescription-dosing',
        title: 'Prescription and dosing',
        path: '/baxter-crrt/learn?lesson=crrt-prescription-dosing',
      },
      {
        id: 'crrt-anticoagulation',
        title: 'Anticoagulation',
        path: '/baxter-crrt/learn?lesson=crrt-anticoagulation',
      },
      {
        id: 'crrt-fluid-liberation',
        title: 'Fluid management and liberation',
        path: '/baxter-crrt/learn?lesson=crrt-fluid-liberation',
      },
      {
        id: 'crrt-03',
        title: 'CRRT-03 practice case',
        path: '/baxter-crrt/practice?case=CRRT-03',
      },
    ],
    rereviewRecommended: true,
  },
]

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
