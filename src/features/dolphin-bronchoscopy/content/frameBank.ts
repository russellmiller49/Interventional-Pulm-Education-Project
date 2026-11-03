import type { ScopeStartId } from './types'

/**
 * Stills of the bronchoscope view, for identification items and the frame drills.
 *
 * Most frames are renders of the module's own simulator at an authored pose
 * (`scripts/dolphin-bronchoscopy/render-frames.mts`). Photographs from real bronchoscopy have a
 * rights slot: an entry stays `pending` — and is never shown — until a grant is recorded here.
 */
export type FrameRights =
  | {
      readonly kind: 'simulator-render'
      readonly caseId: 'dolphin-001'
      /** The pose the script drove to: a named start, or an edge and distance. */
      readonly pose:
        | { readonly start: ScopeStartId }
        | {
            readonly edgeId: number
            readonly distanceMm: number
            readonly yawDeg?: number
            readonly pitchDeg?: number
          }
      readonly builtOn: string
      readonly script: 'scripts/dolphin-bronchoscopy/render-frames.mts'
    }
  | {
      /** A still or photograph from program bronchoscopy (U.S. Navy Marine Mammal Program). */
      readonly kind: 'nmmp-still'
      readonly holder: string
      readonly permission: 'pending' | 'granted'
      readonly grantedOn?: string
      readonly reference: string
    }

export interface DolphinFrame {
  readonly id: string
  /** Served path under `public/`. */
  readonly src: string
  readonly width: number
  readonly height: number
  /** The centerline label the scope tip is in. */
  readonly location: string
  readonly orientation: 'sternal'
  /** Before an answer: what the image shows, without the name it asks for. */
  readonly preCommitAlt: string
  /** After an answer: what it shows, named. */
  readonly postCommitAlt: string
  readonly rights: FrameRights
}

const RENDER = {
  kind: 'simulator-render',
  caseId: 'dolphin-001',
  builtOn: '2026-11-03',
  script: 'scripts/dolphin-bronchoscopy/render-frames.mts',
} as const

const SIZE = { width: 960, height: 720 } as const

/**
 * Program photographs of entering the goosebeak, supplied by the module owner, who granted their
 * use on 2026-11-03. Cropped square from the video frame.
 */
const NMMP_PHOTO = {
  kind: 'nmmp-still',
  holder: 'U.S. Navy Marine Mammal Program',
  permission: 'granted',
  grantedOn: '2026-11-03',
} as const

/** Every frame, rendered or pending. Learner surfaces read `learnerVisibleFrames()`. */
export const DOLPHIN_FRAMES: readonly DolphinFrame[] = [
  {
    id: 'naris-start',
    src: '/dolphin-bronchoscopy/frames/naris-start.png',
    ...SIZE,
    location: 'LNP',
    orientation: 'sternal',
    preCommitAlt: 'A narrow, mucus-lined bony passage running ahead and slightly down.',
    postCommitAlt: 'The left bony nasal passage, just below the nasal plugs.',
    rights: { ...RENDER, pose: { start: 'naris' } },
  },
  {
    id: 'spout-approach',
    src: '/dolphin-bronchoscopy/frames/spout-approach.png',
    ...SIZE,
    location: 'NPX',
    orientation: 'sternal',
    preCommitAlt:
      'A pale, rounded mound fills the view; at its center a triangular opening, apex up, leads into a narrower tube.',
    postCommitAlt:
      'The foot of the nasopharynx, facing the tip of the laryngeal spout: the triangular opening, apex dorsal, is the glottis.',
    rights: { ...RENDER, pose: { edgeId: 1, distanceMm: 41.5, pitchDeg: -20 } },
  },
  {
    id: 'spout-tip-photo',
    src: '/dolphin-bronchoscopy/frames/spout-tip-photo.jpg',
    width: 960,
    height: 960,
    location: 'NPX',
    orientation: 'sternal',
    preCommitAlt:
      'Bronchoscopy photograph: pale tissue around a triangular opening, apex up; inside, two rounded folds either side of a midline cleft, and a dark, glossy rounded surface at the lower left.',
    postCommitAlt:
      'Bronchoscopy photograph from the foot of the nasopharynx: the glottis at the tip of the laryngeal spout, a triangular opening with its apex dorsal. The dark, glossy swelling in the lower part of the opening is the laryngeal gland.',
    rights: {
      ...NMMP_PHOTO,
      reference: 'Bronchoscopy photographs of entering the spout, 1 of 11',
    },
  },
  {
    id: 'spout-close-photo',
    src: '/dolphin-bronchoscopy/frames/spout-close-photo.jpg',
    width: 960,
    height: 960,
    location: 'NPX',
    orientation: 'sternal',
    preCommitAlt:
      'Bronchoscopy photograph, close: a tall triangular opening, apex up, between pale walls, with a fold and a dark, glossy rounded surface in its lower half.',
    postCommitAlt:
      'Bronchoscopy photograph close to the tip of the laryngeal spout: the triangular glottis, apex dorsal, just before the scope enters, with the laryngeal gland filling the lower part of the opening.',
    rights: {
      ...NMMP_PHOTO,
      reference: 'Bronchoscopy photographs of entering the spout, 7 of 11',
    },
  },
  {
    id: 'spout-from-above',
    src: '/dolphin-bronchoscopy/frames/spout-from-above.png',
    ...SIZE,
    location: 'NPX',
    orientation: 'sternal',
    preCommitAlt:
      'A rounded projection rises into the chamber with an opening at its tip, and spaces open beyond and beside it.',
    postCommitAlt:
      'The laryngeal spout rising into the nasopharynx, seen from above: the glottis is at its tip, the fornices beside and beyond it.',
    rights: { ...RENDER, pose: { edgeId: 1, distanceMm: 20 } },
  },
  {
    id: 'larynx',
    src: '/dolphin-bronchoscopy/frames/larynx.png',
    ...SIZE,
    location: 'LX',
    orientation: 'sternal',
    preCommitAlt: 'A smooth cavity that narrows ahead into a ringed tube.',
    postCommitAlt: 'Inside the larynx, looking down toward the trachea.',
    rights: { ...RENDER, pose: { start: 'larynx' } },
  },
  {
    id: 'trachea-rtb',
    src: '/dolphin-bronchoscopy/frames/trachea-rtb.png',
    ...SIZE,
    location: 'TRA',
    orientation: 'sternal',
    preCommitAlt:
      'A wide ringed tube with a single opening in one side wall, ahead of a far division.',
    postCommitAlt:
      'The trachea with the right tracheal bronchus opening on the screen left, above the carina.',
    rights: { ...RENDER, pose: { edgeId: 5, distanceMm: 66 } },
  },
  {
    id: 'carina',
    src: '/dolphin-bronchoscopy/frames/carina.png',
    ...SIZE,
    location: 'TRA',
    orientation: 'sternal',
    preCommitAlt: 'A sharp ridge dividing the tube into two nearly parallel openings.',
    postCommitAlt:
      'The carina: the right main bronchus on the screen left, the left main bronchus on the screen right.',
    rights: { ...RENDER, pose: { start: 'carina' } },
  },
  {
    id: 'rmb-origin',
    src: '/dolphin-bronchoscopy/frames/rmb-origin.png',
    ...SIZE,
    location: 'RMB',
    orientation: 'sternal',
    preCommitAlt: 'A long airway running ahead, with the first side openings far down it.',
    postCommitAlt:
      'The right main bronchus just past the carina, RB1 ahead in its dorsolateral wall.',
    rights: { ...RENDER, pose: { start: 'rmb-origin' } },
  },
  {
    id: 'lmb-origin',
    src: '/dolphin-bronchoscopy/frames/lmb-origin.png',
    ...SIZE,
    location: 'LMB',
    orientation: 'sternal',
    preCommitAlt: 'An airway with a side opening close ahead in its lateral wall.',
    postCommitAlt: 'The left main bronchus just past the carina, with LB1 close ahead.',
    rights: { ...RENDER, pose: { start: 'lmb-origin' } },
  },
  {
    // Edge 9 (RMB) runs 110.6 mm from the carina to the RB1 origin; 92 mm stops about 19 mm short.
    id: 'rmb-rb1',
    src: '/dolphin-bronchoscopy/frames/rmb-rb1.png',
    ...SIZE,
    location: 'RMB',
    orientation: 'sternal',
    preCommitAlt:
      'A long airway running ahead, with a single side opening close ahead and the lumen going on beyond it.',
    postCommitAlt:
      'The right main bronchus far below the carina, with RB1, its first branch, close ahead.',
    rights: { ...RENDER, pose: { edgeId: 9, distanceMm: 92 } },
  },
  {
    // Edge 13 (LMB) runs 63.4 mm from the LB1 origin to the LB2 origin; 45 mm stops about 18 mm short.
    id: 'lmb-lb2',
    src: '/dolphin-bronchoscopy/frames/lmb-lb2.png',
    ...SIZE,
    location: 'LMB',
    orientation: 'sternal',
    preCommitAlt: 'An airway running ahead, with a side opening close ahead in its wall.',
    postCommitAlt: 'The left main bronchus beyond LB1, with LB2, its second branch, close ahead.',
    rights: { ...RENDER, pose: { edgeId: 13, distanceMm: 45 } },
  },
]

export const dolphinFrameById: ReadonlyMap<string, DolphinFrame> = new Map(
  DOLPHIN_FRAMES.map((frame) => [frame.id, frame] as const),
)

export function isLearnerVisible(frame: DolphinFrame): boolean {
  return frame.rights.kind === 'simulator-render' || frame.rights.permission === 'granted'
}

/** Frames a learner may see: every render, and any photograph whose grant is recorded. */
export function learnerVisibleFrames(): readonly DolphinFrame[] {
  return DOLPHIN_FRAMES.filter(isLearnerVisible)
}
