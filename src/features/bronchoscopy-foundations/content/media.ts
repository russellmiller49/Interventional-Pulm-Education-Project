/**
 * The real teaching media the course can put in the Simulator panel, by id. The files already ship
 * under `public/`: three annotated bronchoscope photographs, thirty endoscopic stills from one
 * annotated normal survey, pre-rendered CT correlation slices for thirty-two structures, and the
 * survey video itself. A test holds these ids to the manifests on disk, so an authored id that
 * does not exist fails before a learner sees a broken image.
 *
 * Every item's asset-register fields (rights, de-identification, reviewer) are pending (A19); the
 * surfaces that show them say "authored teaching media, pending review" rather than presenting them
 * as reviewed clinical reference images.
 */
export const SCOPE_PHOTO_IDS = [
  'full-scope',
  'suction-valve-setup',
  'biopsy-adapter-setup',
] as const
export type ScopePhotoId = (typeof SCOPE_PHOTO_IDS)[number]

export const SCOPE_PHOTO_ATLAS_URL = '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json'

/** The annotation ids inside each photograph's polygon set. */
export const SCOPE_PHOTO_ANNOTATIONS: Readonly<Record<ScopePhotoId, readonly string[]>> = {
  'full-scope': [
    'full-scope-control-section-1',
    'full-scope-suction-valve-2',
    'full-scope-biopsy-valve-adapter-3',
    'full-scope-insertion-tube-4',
    'full-scope-universal-cord-5',
    'full-scope-rotary-function-6',
  ],
  'suction-valve-setup': [
    'suction-valve-setup-suction-valve-1',
    'suction-valve-setup-suction-valve-port-2',
  ],
  'biopsy-adapter-setup': [
    'biopsy-adapter-setup-biopsy-valve-adapter-1',
    'biopsy-adapter-setup-working-channel-port-2',
  ],
}

/** Lesson structure ids that have an endoscopic still (`/airway-lesson/airway-quiz-frames.json`). */
export const STILL_STRUCTURE_IDS = [
  'larynx',
  'trachea',
  'rmb',
  'lmb',
  'bronchus-intermedius',
  'rul',
  'rb1',
  'rb2',
  'rb3',
  'rml',
  'rb4',
  'rb5',
  'rll',
  'rb6',
  'rb7',
  'rb8',
  'rb9',
  'rb10',
  'lul',
  'lul-upper',
  'lb1-2',
  'lb3',
  'lingula',
  'lb4',
  'lb5',
  'lll',
  'lb6',
  'lb7-8',
  'lb9',
  'lb10',
] as const
export type StillStructureId = (typeof STILL_STRUCTURE_IDS)[number]

/**
 * Lesson structure ids with CT correlation slices (`/airway-lesson/airway-survey-ct.json`). The
 * lesson's separate `lb1` and `lb2` slices exist on disk but are not offered: this profile teaches
 * the combined LB1+2 apicoposterior bronchus, and offering both would conflate conventions (A04).
 */
export const CT_STRUCTURE_IDS = STILL_STRUCTURE_IDS
export type CtStructureId = StillStructureId

export type MediaRef =
  | {
      readonly kind: 'scope-photo'
      readonly imageId: ScopePhotoId
      /** One annotation outlined; its label is never printed before the learner commits. */
      readonly highlight?: string
    }
  | {
      readonly kind: 'endoscopic-still'
      readonly structureId: StillStructureId
      readonly outline: boolean
    }
  | {
      readonly kind: 'ct-slice'
      readonly structureId: CtStructureId
      readonly plane: 'axial' | 'coronal'
    }
  /** The annotated normal survey, cued to this structure's stop. */
  | { readonly kind: 'survey-clip'; readonly structureId: StillStructureId }

export function isStillStructureId(value: unknown): value is StillStructureId {
  return typeof value === 'string' && (STILL_STRUCTURE_IDS as readonly string[]).includes(value)
}

export function mediaRefErrors(where: string, media: MediaRef): readonly string[] {
  switch (media.kind) {
    case 'scope-photo':
      if (!(SCOPE_PHOTO_IDS as readonly string[]).includes(media.imageId))
        return [`${where} names an unknown scope photograph ${media.imageId}.`]
      if (media.highlight && !SCOPE_PHOTO_ANNOTATIONS[media.imageId].includes(media.highlight))
        return [`${where} outlines an unknown annotation ${media.highlight}.`]
      return []
    case 'endoscopic-still':
    case 'ct-slice':
    case 'survey-clip':
      return isStillStructureId(media.structureId)
        ? []
        : [`${where} names an unknown structure ${media.structureId}.`]
  }
}
