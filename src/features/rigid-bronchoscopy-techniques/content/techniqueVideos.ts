import {
  canPublishClip,
  getLearnerVisibleClips,
  type LearnerVisibilityOptions,
} from '@/features/rigid-bronchoscopy-techniques/lib/validation'
import type { RigidBronchoscopyClip } from '@/features/rigid-bronchoscopy-techniques/types'

/**
 * The technique-video clip manifest (repo-convention-adapted from the plan's
 * `manifest/videos.json`). It is authored as typed TS so the compiler enforces
 * the {@link RigidBronchoscopyClip} shape; runtime cross-field invariants are
 * checked in `__tests__/manifest.test.ts` and by the media-manifest script.
 *
 * EVERY entry is `reviewStatus: 'planned'` — no media has been generated yet
 * (the Higgsfield MCP server is not authenticated). Planned clips have empty
 * media paths; their intended asset locations are documented in
 * `docs/rigid-bronchoscopy-video/production-plan.md`.
 */

type PlannedClipInput = Pick<
  RigidBronchoscopyClip,
  | 'id'
  | 'lessonId'
  | 'title'
  | 'objective'
  | 'sourceType'
  | 'anatomicalSide'
  | 'cameraOrientation'
  | 'durationSeconds'
> &
  Partial<RigidBronchoscopyClip>

/** Build a planned clip with safe defaults (unverified, unpublishable, no media). */
function planned(input: PlannedClipInput): RigidBronchoscopyClip {
  const isSynthetic =
    input.sourceType === 'higgsfield-synthetic' || input.sourceType === 'validated-3d-render'
  return {
    videoPath: '',
    posterPath: '',
    container: 'native',
    reviewStatus: 'planned',
    syntheticLabelRequired: isSynthetic,
    leftRightVerified: false,
    medicalAccuracyVerified: false,
    safetyNotes: [],
    ...input,
  }
}

export const techniqueClips: RigidBronchoscopyClip[] = [
  // ── Lesson 1: Equipment and patient positioning ──────────────────────────
  planned({
    id: 'RB-POS-001',
    lessonId: 'positioning',
    title: 'Manikin supine, head at the working end of the table',
    objective: 'Show the baseline positioning of manikin, table, and operator before intubation.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Overhead, foot-of-bed toward camera; operator at head of bed.',
    durationSeconds: 6,
    safetyNotes: ['Adult airway training manikin; explicitly synthetic. No patient identifiers.'],
  }),
  planned({
    id: 'RB-POS-002',
    lessonId: 'positioning',
    title: 'Dental protection in place',
    objective: 'Demonstrate placement of the dental guard before scope entry.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Three-quarter from patient right; mouth and guard visible.',
    durationSeconds: 5,
  }),
  planned({
    id: 'RB-POS-003',
    lessonId: 'positioning',
    title: 'Scope and telescope assembly; suction and ventilation connection',
    objective: 'Show assembly of the rigid barrel, telescope, suction, and ventilation.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Tabletop close view of gloved hands; barrel diameter constant.',
    durationSeconds: 8,
  }),

  // ── Lesson 2: Oral entry and epiglottis identification ───────────────────
  planned({
    id: 'RB-ORAL-001',
    lessonId: 'oral-entry',
    title: 'Midline oral entry, tongue controlled without dental levering',
    objective: 'Demonstrate controlled midline entry over the tongue with tooth protection.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Head-of-bed operator view; incisors and barrel in frame.',
    durationSeconds: 7,
    safetyNotes: ['Freeze/stop if the expected landmark is not visible; no blind force.'],
  }),
  planned({
    id: 'RB-ORAL-002',
    lessonId: 'oral-entry',
    title: 'Simplified sagittal cutaway to the epiglottis',
    objective: 'Relate external advancement to a validated sagittal view of the epiglottis.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Sagittal cutaway; deterministic 3D airway model, not photoreal larynx.',
    durationSeconds: 6,
  }),

  // ── Lesson 3: Glottic exposure and cord passage ──────────────────────────
  planned({
    id: 'RB-GLOTTIS-001',
    lessonId: 'glottic-passage',
    title: 'Glottic exposure with a small deliberate lift',
    objective: 'Show exposure of the glottis while maintaining upper-tooth protection.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Head-of-bed operator view.',
    durationSeconds: 6,
  }),
  planned({
    id: 'RB-GLOTTIS-002',
    lessonId: 'glottic-passage',
    title: 'Approximately 90° rotation before passing the opening',
    objective: 'Demonstrate aligning the narrower barrel dimension with the glottic opening.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Head-of-bed operator view; rotation of the straight barrel visible.',
    durationSeconds: 6,
  }),
  planned({
    id: 'RB-GLOTTIS-003',
    lessonId: 'glottic-passage',
    title: 'Controlled passage and return to working orientation',
    objective: 'Show atraumatic passage into the trachea and return to working orientation.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Head-of-bed operator view.',
    durationSeconds: 7,
    safetyNotes: ['No forceful advancement; continuously visualized.'],
  }),

  // ── Lesson 4: Tracheal advancement and carinal orientation ───────────────
  planned({
    id: 'RB-TRACH-001',
    lessonId: 'tracheal-advancement',
    title: 'Neutral tracheal alignment and bevel orientation',
    objective: 'Relate proximal barrel, distal bevel, and airway centerline in neutral position.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Overhead external; barrel centerline visible.',
    durationSeconds: 6,
  }),
  planned({
    id: 'RB-TRACH-002',
    lessonId: 'tracheal-advancement',
    title: 'Controlled advancement to the carina; stop when anatomy is lost',
    objective: 'Show maintained visualization to the carina and recentering when anatomy is lost.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Validated 3D airway model; carina identified.',
    durationSeconds: 8,
    safetyNotes: ['Stop and recenter when the lumen is lost; advance only when visualized.'],
  }),

  // ── Lesson 5: Scope-manipulation movement map ────────────────────────────
  planned({
    id: 'RB-MOVE-001',
    lessonId: 'scope-manipulation',
    title: 'Axial advancement and withdrawal',
    objective: 'Predict distal-tip response to isolated axial advance and withdrawal.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Deterministic animation with movement vectors (arrows added in post).',
    durationSeconds: 8,
  }),
  planned({
    id: 'RB-MOVE-002',
    lessonId: 'scope-manipulation',
    title: 'Clockwise and counterclockwise rotation',
    objective: 'Predict distal-tip response to isolated barrel rotation.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Deterministic animation; bevel orientation tracked.',
    durationSeconds: 8,
  }),
  planned({
    id: 'RB-MOVE-003',
    lessonId: 'scope-manipulation',
    title: 'Proximal barrel left/right and head-position adjustment',
    objective: 'Predict distal-tip response to proximal-barrel and head-position changes.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Deterministic animation; proximal vs distal motion contrasted.',
    durationSeconds: 9,
  }),

  // ── Lesson 6 (PROTOTYPE): Directing into the mainstem bronchi ────────────
  planned({
    id: 'RB-NAV-001',
    lessonId: 'mainstem-direction',
    title: 'Neutral distal tracheal position',
    objective: 'Establish the neutral hero frame: scope centered, head neutral, hands stable.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'External three-quarter / overhead; scope centered; no advancement.',
    durationSeconds: 5,
    promptVersion: 'mainstem-direction@v1',
  }),
  planned({
    id: 'RB-NAV-L-001',
    lessonId: 'mainstem-direction',
    title: 'Prepare for left-mainstem alignment (external)',
    objective:
      'Show head-toward-patient-right and proximal-barrel-toward-patient-right for the left mainstem.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'left',
    cameraOrientation: 'External three-quarter from patient right; asymmetric landmark in frame.',
    durationSeconds: 8,
    promptVersion: 'mainstem-direction@v1',
    safetyNotes: [
      'External movement only; no incisor levering; no blind advancement.',
      'Requires explicit patient-left/right orientation check before approval.',
    ],
  }),
  planned({
    id: 'RB-NAV-L-002',
    lessonId: 'mainstem-direction',
    title: 'Left-mainstem validated internal consequence',
    objective: 'Show proximal barrel moving right and distal tip aligning left (validated).',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'left',
    cameraOrientation: 'Validated 3D airway model / vector diagram.',
    durationSeconds: 6,
    safetyNotes: [
      'No claim that head movement alone guarantees entry.',
      'Advancement only after direct visualization and alignment.',
    ],
  }),
  planned({
    id: 'RB-NAV-R-001',
    lessonId: 'mainstem-direction',
    title: 'Prepare for right-mainstem alignment (external, separately validated)',
    objective:
      'Show the mirrored maneuver for the right mainstem via separately validated references.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'right',
    cameraOrientation: 'External three-quarter from patient left; asymmetric landmark in frame.',
    durationSeconds: 8,
    safetyNotes: [
      'Do NOT flip the left clip — produce from separately validated references.',
      'Requires explicit patient-left/right orientation check before approval.',
    ],
  }),
  planned({
    id: 'RB-NAV-R-002',
    lessonId: 'mainstem-direction',
    title: 'Right-mainstem validated internal consequence',
    objective: 'Show proximal barrel moving left and distal tip aligning right (validated).',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'right',
    cameraOrientation: 'Validated 3D airway model / vector diagram.',
    durationSeconds: 6,
  }),
  planned({
    id: 'RB-NAV-ERR-001',
    lessonId: 'mainstem-direction',
    title: 'Dental fulcrum error (synthetic, freeze before force)',
    objective: 'Recognize the incisor-fulcrum error; freeze before force; then show correction.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Three-quarter showing proximal barrel against the dental guard.',
    durationSeconds: 6,
    safetyNotes: [
      'Freeze BEFORE force is applied.',
      'Postproduction overlay: "Do not use the incisors as a fulcrum."',
    ],
  }),
  planned({
    id: 'RB-NAV-QUIZ-001',
    lessonId: 'mainstem-direction',
    title: 'Mainstem-direction retrieval freeze frame',
    objective: 'Provide a clean freeze frame (no generated text) for a retrieval question.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'External neutral freeze frame; no generated text.',
    durationSeconds: 4,
  }),

  // ── Lesson 7: Apple-coring mechanics ─────────────────────────────────────
  planned({
    id: 'RB-CORE-001',
    lessonId: 'apple-coring',
    title: 'Apple-coring external mechanics',
    objective: 'Show stable proximal control, short axial movement, controlled rotation, reassess.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'External operator view; rigid barrel; hands stable.',
    durationSeconds: 9,
    safetyNotes: ['Pause and reassess; withdraw for extraction; no bending of the barrel.'],
  }),
  planned({
    id: 'RB-CORE-002',
    lessonId: 'apple-coring',
    title: 'Apple-coring synthetic internal mechanics',
    objective:
      'Show the bevel separating a synthetic lesion while the airway wall remains stationary.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Synthetic 3D cutaway; lumen and airway wall clearly distinguishable.',
    durationSeconds: 10,
    safetyNotes: [
      'Persistent postproduction label: "Synthetic procedural visualization".',
      'No gore, no uncontrolled bleeding, no blind advancement.',
    ],
  }),

  // ── Lesson 8: Unsafe apple-coring mechanics ──────────────────────────────
  planned({
    id: 'RB-UNSAFE-001',
    lessonId: 'unsafe-mechanics',
    title: 'Unsafe cue: airway wall moving with the lesion',
    objective: 'Recognize the airway wall moving with the lesion as a stop-and-reassess cue.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Synthetic 3D cutaway; freeze before injury.',
    durationSeconds: 6,
    safetyNotes: [
      'Freeze before serious injury is depicted.',
      'Overlay: Stop / Withdraw / Suction / Re-establish anatomy / Reassess the tissue plane.',
    ],
  }),
  planned({
    id: 'RB-UNSAFE-002',
    lessonId: 'unsafe-mechanics',
    title: 'Unsafe cue: loss of the distal lumen / advancing without visualization',
    objective: 'Recognize loss of the distal lumen and continued advancement as stop cues.',
    sourceType: 'validated-3d-render',
    anatomicalSide: 'not-applicable',
    cameraOrientation: 'Synthetic 3D cutaway; freeze before injury.',
    durationSeconds: 6,
    safetyNotes: ['Freeze before serious injury is depicted.'],
  }),

  // ── Lesson 9: Integrated manikin sequence ────────────────────────────────
  planned({
    id: 'RB-SEQ-001',
    lessonId: 'integrated-sequence',
    title: 'Integrated sequence (assembled from approved clips)',
    objective: 'Rehearse the full sequence from positioning through bilateral mainstem navigation.',
    sourceType: 'higgsfield-synthetic',
    anatomicalSide: 'bilateral',
    cameraOrientation: 'Assembled from previously approved clips with learner-prediction pauses.',
    durationSeconds: 10,
    safetyNotes: ['Assemble approved clips; do not generate the whole procedure in one job.'],
  }),
]

export function getTechniqueClip(id: string | null | undefined): RigidBronchoscopyClip | null {
  const normalized = id?.trim()
  if (!normalized) {
    return null
  }
  return techniqueClips.find((clip) => clip.id === normalized) ?? null
}

/** Clips belonging to a lesson, in manifest order. */
export function getTechniqueClipsForLesson(lessonId: string): RigidBronchoscopyClip[] {
  return techniqueClips.filter((clip) => clip.lessonId === lessonId)
}

/** Clips a learner may see. Production (default) returns only publishable clips. */
export function getLearnerTechniqueClips(
  options?: LearnerVisibilityOptions,
): RigidBronchoscopyClip[] {
  return getLearnerVisibleClips(techniqueClips, options)
}

/** True when at least one clip in the manifest is publishable on a production route. */
export function hasPublishableTechniqueClips(): boolean {
  return techniqueClips.some(canPublishClip)
}
