export const ICU_SIMULATION_RELEASE = Object.freeze({
  stage: 'private-development' as const,
  listed: false as const,
  searchable: false as const,
  sitemap: false as const,
  noIndex: true as const,
  routeGuardRequired: true as const,
  integratedClinicalApproval: false as const,
  publicationGate:
    'Publish only after integrated case review, constituent-adapter review, accessibility QA, and authenticated pilot testing.',
})

export type IcuSimulationReleaseStage =
  | 'private-development'
  | 'sme-review'
  | 'tester-preview'
  | 'published'

export const ICU_SIMULATION_RELEASE_STAGE: IcuSimulationReleaseStage = ICU_SIMULATION_RELEASE.stage
