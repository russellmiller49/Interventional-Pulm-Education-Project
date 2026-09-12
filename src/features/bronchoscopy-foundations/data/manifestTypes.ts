/**
 * The shapes of the Bronchoscopy Foundations v2 implementation manifest, as the course reads them.
 *
 * The manifest (`Bronchoscopy_Foundations_Implementation_Manifest_v2.json`, outside this public
 * repository) is the index of stable ids: modules M01–M18 and E01–E04, their objectives, drills,
 * cases, question seeds, the 31-node anatomy profile, the local-policy inputs, the source catalog,
 * the transcript review register and the proposed acceptance tests. The generated files beside this
 * one are written by `scripts/bronchoscopy-foundations/import-manifest.mts`; the teaching text they
 * index lives in the knowledge specification, not here.
 */
export type ManifestTrack = 'core' | 'extension'

export interface ManifestModule {
  readonly id: string
  readonly title: string
  readonly track: ManifestTrack
  readonly optional: boolean
  readonly knowledgeSections: readonly number[]
  readonly prerequisites: readonly string[]
  readonly sourceIds: readonly string[]
  readonly primaryPractice: string | null
  readonly completionClaim: string | null
  readonly drillIds: readonly string[]
  readonly caseIds: readonly string[]
  readonly objectiveIds: readonly string[]
}

export interface ManifestObjective {
  readonly id: string
  readonly moduleId: string
  readonly track: ManifestTrack
  readonly text: string
  readonly assessmentEvidence: string
  readonly teachingSectionIds: readonly number[]
  readonly drillIds: readonly string[]
  readonly caseIds: readonly string[]
  readonly questionIds: readonly string[]
  readonly sourceIds: readonly string[]
  /** '2.0' for objectives added in the v2 expansion; absent for the v1 set. */
  readonly introducedIn: string | null
}

export interface ManifestDrill {
  readonly id: string
  readonly title: string
  readonly moduleIds: readonly string[]
  readonly specification: string
  readonly setting: string
  readonly evidenceBoundary: string
  readonly assessmentStatus: string
  readonly sourceIds: readonly string[]
  readonly track: ManifestTrack
}

export interface ManifestCase {
  readonly id: string
  readonly title: string
  readonly moduleIds: readonly string[]
  readonly stem: string
  readonly fourBox: {
    readonly initialEvaluation: string
    readonly proceduralStrategy: string
    readonly techniquesAndResults: string
    readonly subsequentManagement: string
  }
  readonly criticalError: string
  readonly debriefQuestion: string
  readonly sourceIds: readonly string[]
  readonly authorship: string
  readonly track: ManifestTrack
}

export interface ManifestQuestionSeed {
  readonly id: string
  readonly objectiveId: string
  readonly stem: string
  readonly options: readonly {
    readonly id: string
    readonly text: string
    readonly rationale: string
  }[]
  readonly correctOptionId: string
  readonly sourceIds: readonly string[]
  readonly track: ManifestTrack
}

export interface ManifestAnatomyNode {
  readonly id: string
  readonly label: string
  readonly parentId: string | null
  readonly type: 'trachea' | 'bronchus' | 'educational_group' | 'segmental_bronchus'
  readonly side: 'right' | 'left' | null
  readonly aliases: readonly string[]
}

export interface ManifestAnatomyProfile {
  readonly profileId: string
  readonly geometryStatus: string
  readonly notes: readonly string[]
  readonly sourceIds: readonly string[]
  readonly nodes: readonly ManifestAnatomyNode[]
}

export interface ManifestLocalPolicy {
  readonly id: string
  readonly description: string
  readonly status: string
  readonly missingBehavior: string
}

export interface ManifestSource {
  readonly id: string
  readonly kind: string
  readonly title: string
  readonly authors: string | null
  readonly organization: string | null
  readonly year: number | null
  readonly doi: string | null
  readonly url: string | null
  readonly reviewedScope: string | null
  readonly accessedDate: string | null
  /** Transcript sources only. */
  readonly transcript: {
    readonly collection: string
    readonly duration: string
    readonly durationSeconds: number
    readonly moduleIds: readonly string[]
    readonly adoptedContribution: string
    readonly audioVideoReviewed: boolean
    readonly slidesAvailable: boolean
    readonly speakerIdentityVerified: boolean
    readonly publicationPermission: string
  } | null
}

export interface ManifestAcceptanceTest {
  readonly id: string
  readonly title: string
  readonly requirement: string
  readonly scope: string
}

export interface ManifestProposedMedia {
  readonly id: string
  readonly sourceId: string
  readonly approximateStart: string
  readonly approximateEnd: string
  readonly teachingUse: string
  readonly moduleIds: readonly string[]
  readonly requiredAction: string
}

export interface ManifestReviewItem {
  readonly id: string
  readonly sourceIds: readonly string[]
  readonly sourceLocations: string
  readonly topic: string
  readonly sourceStatement: string
  readonly disposition: string
  readonly adoptedTreatment: string
  readonly verificationSourceIds: readonly string[]
  readonly priority: 'high' | 'medium'
}

export interface ManifestAssessmentPolicy {
  readonly rubricStatus: string
  readonly ratingAnchors: Readonly<Record<'0' | '1' | '2' | '3', string>>
  readonly nonNumericStates: readonly string[]
  readonly criticalErrorsNoncompensatory: boolean
  readonly facultyDecisionRequiredForClinicalReadiness: boolean
  readonly appTelemetryCannotProve: readonly string[]
  readonly domains: readonly string[]
  readonly allowedEvidenceTypes: readonly string[]
}

export interface ManifestControlModel {
  readonly distinctControls: readonly string[]
  readonly discloseAutomation: readonly string[]
  readonly allowedSimplification: string
  readonly unsupportedInferences: readonly string[]
}

export interface ManifestMeta {
  readonly documentVersion: string
  readonly preparedDate: string
  readonly manifestSha256: string
  readonly knowledgeDocumentSha256: string
  readonly scope: string
  readonly navigationPolicy: string
  readonly credentialingPolicy: string
  readonly clinicalReviewStatus: string
  readonly counts: Readonly<Record<string, number>>
  readonly excludedOperationalContent: readonly string[]
  readonly provenanceRules: readonly string[]
}
