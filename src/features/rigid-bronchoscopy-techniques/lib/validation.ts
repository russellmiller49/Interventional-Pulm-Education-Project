import { z } from 'zod'

import type {
  RigidBronchoscopyClip,
  TechniqueLesson,
} from '@/features/rigid-bronchoscopy-techniques/types'

/**
 * Runtime validation for the technique-video manifest plus the deterministic
 * publication rule. The rule is the single source of truth for whether a clip
 * may appear on a production learner route.
 */

export const clinicalReviewStatusSchema = z.enum([
  'planned',
  'generated-draft',
  'faculty-review',
  'revision-required',
  'approved',
  'rejected',
])

export const mediaSourceTypeSchema = z.enum([
  'higgsfield-synthetic',
  'manikin-recording',
  'validated-3d-render',
  'faculty-approved-clinical',
])

export const anatomicalSideSchema = z.enum(['not-applicable', 'left', 'right', 'bilateral'])

export const mediaContainerSchema = z.enum(['native', 'iframe'])

export const chapterMarkerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  startSeconds: z.number().min(0),
})

export const rigidBronchoscopyClipSchema = z.object({
  id: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1),
  objective: z.string().min(1),
  sourceType: mediaSourceTypeSchema,
  anatomicalSide: anatomicalSideSchema,
  cameraOrientation: z.string(),
  durationSeconds: z.number().min(0),
  videoPath: z.string(),
  posterPath: z.string(),
  captionsPath: z.string().optional(),
  transcriptPath: z.string().optional(),
  container: mediaContainerSchema.optional(),
  chapters: z.array(chapterMarkerSchema).optional(),
  promptVersion: z.string().optional(),
  higgsfieldGenerationId: z.string().optional(),
  model: z.string().optional(),
  reviewStatus: clinicalReviewStatusSchema,
  syntheticLabelRequired: z.boolean(),
  leftRightVerified: z.boolean(),
  medicalAccuracyVerified: z.boolean(),
  reviewer: z.string().optional(),
  reviewDate: z.string().optional(),
  reviewerNotes: z.array(z.string()).optional(),
  safetyNotes: z.array(z.string()),
})

export const retrievalQuestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['multiple-choice', 'predict-distal-response', 'safe-or-unsafe', 'order-steps']),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answerIndex: z.number().int().min(0).optional(),
  orderedSteps: z.array(z.string()).optional(),
  explanation: z.string().optional(),
})

export const techniqueLessonSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  title: z.string().min(1),
  objective: z.string().min(1),
  approxDurationSeconds: z.number().min(0),
  safetyStatement: z.string().min(1),
  keyMovementRule: z.string().min(1),
  commonError: z.string().min(1),
  clipIds: z.array(z.string().min(1)),
  retrievalQuestions: z.array(retrievalQuestionSchema),
  movementSync: z.boolean().optional(),
})

/** Parse and validate a raw clip manifest. Throws `ZodError` on malformed data. */
export function parseClipManifest(data: unknown): RigidBronchoscopyClip[] {
  return z.array(rigidBronchoscopyClipSchema).parse(data)
}

/** Parse and validate a raw lesson manifest. Throws `ZodError` on malformed data. */
export function parseLessonManifest(data: unknown): TechniqueLesson[] {
  return z.array(techniqueLessonSchema).parse(data)
}

/**
 * The deterministic publication rule. A clip may be shown on a production
 * learner route ONLY when it is approved, medically verified, and — if it is
 * side-specific — has passed an explicit left/right orientation check.
 */
export function canPublishClip(clip: RigidBronchoscopyClip): boolean {
  return (
    clip.reviewStatus === 'approved' &&
    clip.medicalAccuracyVerified &&
    (clip.anatomicalSide === 'not-applicable' || clip.leftRightVerified)
  )
}

export interface LearnerVisibilityOptions {
  /**
   * Development / admin only. When true, draft clips are returned so the UI can
   * show them behind a prominent review badge. NEVER pass true on a production
   * learner route.
   */
  includeDrafts?: boolean
}

/** Clips visible to a learner. Production (default) yields only publishable clips. */
export function getLearnerVisibleClips(
  clips: readonly RigidBronchoscopyClip[],
  { includeDrafts = false }: LearnerVisibilityOptions = {},
): RigidBronchoscopyClip[] {
  if (includeDrafts) {
    return [...clips]
  }
  return clips.filter(canPublishClip)
}

/**
 * Cross-field integrity checks over the whole manifest. Returns a list of human
 * readable problems (empty ⇒ valid). Used by tests and the media-manifest
 * validation script so bad records fail loudly rather than silently.
 */
export function collectManifestIssues(
  clips: readonly RigidBronchoscopyClip[],
  lessons: readonly TechniqueLesson[] = [],
): string[] {
  const issues: string[] = []

  const clipIds = new Set<string>()
  for (const clip of clips) {
    if (clipIds.has(clip.id)) {
      issues.push(`Duplicate clip id: ${clip.id}`)
    }
    clipIds.add(clip.id)

    // Data-level enforcement of the publication invariant: an "approved" record
    // that is not fully verified is inconsistent and must never ship.
    if (clip.reviewStatus === 'approved') {
      if (!clip.medicalAccuracyVerified) {
        issues.push(`Clip ${clip.id} is approved but medicalAccuracyVerified is false`)
      }
      if (clip.anatomicalSide !== 'not-applicable' && !clip.leftRightVerified) {
        issues.push(`Clip ${clip.id} is approved and side-specific but leftRightVerified is false`)
      }
    }

    // Generated synthetic media must be flagged for the synthetic-content label.
    if (clip.sourceType === 'higgsfield-synthetic' && !clip.syntheticLabelRequired) {
      issues.push(`Clip ${clip.id} is higgsfield-synthetic but syntheticLabelRequired is false`)
    }

    // Side-specific clips must document their camera orientation (mirroring guard).
    if (clip.anatomicalSide === 'left' || clip.anatomicalSide === 'right') {
      if (clip.cameraOrientation.trim().length === 0) {
        issues.push(`Side-specific clip ${clip.id} is missing a documented cameraOrientation`)
      }
    }
  }

  const lessonIds = new Set<string>()
  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id)) {
      issues.push(`Duplicate lesson id: ${lesson.id}`)
    }
    lessonIds.add(lesson.id)

    for (const clipId of lesson.clipIds) {
      if (!clipIds.has(clipId)) {
        issues.push(`Lesson ${lesson.id} references unknown clip id: ${clipId}`)
      }
    }
  }

  if (lessons.length > 0) {
    for (const clip of clips) {
      if (!lessonIds.has(clip.lessonId)) {
        issues.push(`Clip ${clip.id} references unknown lesson id: ${clip.lessonId}`)
      }
    }
  }

  return issues
}
