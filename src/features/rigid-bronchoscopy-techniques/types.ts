/**
 * Rigid Bronchoscopy Technique Videos — production data model.
 *
 * This module SUPPLEMENTS supervised simulation and clinical instruction and
 * does NOT independently credential a learner to perform rigid bronchoscopy.
 *
 * Generative (Higgsfield) media is DRAFT until it has been reviewed by the
 * physician owner. Learner-facing production routes must never silently fall
 * back to draft clips — see `canPublishClip` in `./lib/validation`.
 */

export type ClinicalReviewStatus =
  | 'planned'
  | 'generated-draft'
  | 'faculty-review'
  | 'revision-required'
  | 'approved'
  | 'rejected'

export type MediaSourceType =
  | 'higgsfield-synthetic'
  | 'manikin-recording'
  | 'validated-3d-render'
  | 'faculty-approved-clinical'

export type AnatomicalSide = 'not-applicable' | 'left' | 'right' | 'bilateral'

/**
 * How the {@link TechniqueVideoPlayer} should mount the media.
 * `native` renders a `<video>` element; `iframe` embeds an external player
 * (preserving compatibility with the existing iframe-based videos).
 */
export type MediaContainer = 'native' | 'iframe'

/** A named seek point within a clip. Chapter labels are UI text, not baked into the video. */
export interface ChapterMarker {
  id: string
  label: string
  startSeconds: number
}

/**
 * A single reviewable media asset. Mirrors the schema in the production plan.
 * `videoPath`/`posterPath` are module-asset-relative paths resolved through
 * `resolveModuleAssetUrl`, or absolute/iframe URLs.
 */
export interface RigidBronchoscopyClip {
  id: string
  lessonId: string
  title: string
  objective: string
  sourceType: MediaSourceType
  anatomicalSide: AnatomicalSide
  cameraOrientation: string
  durationSeconds: number
  videoPath: string
  posterPath: string
  captionsPath?: string
  transcriptPath?: string
  /** Defaults to `native` when omitted. */
  container?: MediaContainer
  chapters?: ChapterMarker[]
  promptVersion?: string
  higgsfieldGenerationId?: string
  model?: string
  reviewStatus: ClinicalReviewStatus
  /** True when a persistent "Synthetic procedural visualization" label is required. */
  syntheticLabelRequired: boolean
  leftRightVerified: boolean
  medicalAccuracyVerified: boolean
  reviewer?: string
  /** ISO-8601 date string. */
  reviewDate?: string
  reviewerNotes?: string[]
  safetyNotes: string[]
}

export type RetrievalQuestionKind =
  | 'multiple-choice'
  | 'predict-distal-response'
  | 'safe-or-unsafe'
  | 'order-steps'

export interface RetrievalQuestion {
  id: string
  kind: RetrievalQuestionKind
  prompt: string
  /** Present for `multiple-choice` / `safe-or-unsafe`. */
  options?: string[]
  /** Index into `options` for the correct answer. */
  answerIndex?: number
  /** Ordered correct sequence for `order-steps`. */
  orderedSteps?: string[]
  explanation?: string
}

export interface TechniqueLesson {
  id: string
  order: number
  title: string
  /** Exactly one measurable objective. */
  objective: string
  approxDurationSeconds: number
  /** Short safety statement shown before the video. */
  safetyStatement: string
  /** The single key movement rule the learner should retain. */
  keyMovementRule: string
  /** The most common error this lesson guards against. */
  commonError: string
  /** Clip IDs, in playback order, belonging to this lesson. */
  clipIds: string[]
  retrievalQuestions: RetrievalQuestion[]
  /**
   * When true the lesson renders the synchronized external-view / directional-
   * diagram / synthetic-internal panels (single composed playback on mobile).
   */
  movementSync?: boolean
}
