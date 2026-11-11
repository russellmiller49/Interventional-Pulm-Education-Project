/**
 * Pictures drawn from the course's own 3D airway, for teaching screens that had none.
 *
 * The files are written by `scripts/bronchoscopy-foundations/render-teaching-stills.mjs` to
 * `public/bronchoscopy-foundations/renders/`, with `renders.json` beside them. A test holds every
 * id here to a file there. They are drawings: blood, a blocker, a tube and the scope are shapes
 * placed in the teaching airway to show where each one is. None is a photograph.
 *
 * `view` says how the picture is seen, so the screen can say it once under the pictures:
 * `front` is the airway tree from in front of the patient, `scope` is the view down the scope,
 * and `right-side-down` is the tree with the patient lying on the right side.
 */
export type TeachingStillView = 'front' | 'scope' | 'right-side-down'

export interface TeachingStill {
  /** One line under the picture: what it shows and why it matters here. */
  readonly caption: string
  /** The picture in words, for a reader who cannot see it. */
  readonly alt: string
  readonly view: TeachingStillView
}

export const TEACHING_STILL_SIZE = { width: 1200, height: 900 } as const

export const TEACHING_STILLS = {
  'bleeding-held-in-segment': {
    caption: 'Tip wedged. The blood stays in the airways it started in.',
    alt: 'The airway tree from the front. The scope runs down the trachea into the right lower lobe, with its tip wedged in the basal bronchus. Only the airways beyond the tip are red.',
    view: 'front',
  },
  'bleeding-floods-both-lungs': {
    caption: 'Not held. Blood reaches the carina and runs into the left lung.',
    alt: 'The airway tree from the front. Red fills the right lower and middle lobe airways, the right main bronchus, the carina, the left main bronchus and the left lower lobe airways.',
    view: 'front',
  },
  'bleeding-scope-wells-up': {
    caption: 'From the scope: blood wells up out of the segment.',
    alt: 'The view down the scope in the right lower lobe. Blood rises from the airway ahead and lies along the lower wall. The upper wall is still clear.',
    view: 'scope',
  },
  'bleeding-wedge-close': {
    caption: 'Stay in and wedge. The tip fills the airway and the blood is held beyond it.',
    alt: 'A close view of the right lower lobe from the front. The scope tip sits in the mouth of the basal bronchus, filling it. The airways beyond the tip are red and the airways above it are clear.',
    view: 'front',
  },
  'bleeding-side-down': {
    caption: 'Bleeding side down. On the right side, blood stays in the right lung.',
    alt: 'The airway tree with the patient lying on the right side, seen from in front. The right lung is at the bottom of the picture and its lower airways are red. The left lung is above it and clear.',
    view: 'right-side-down',
  },
  'bleeding-scope-at-carina': {
    caption: 'From the scope: blood at the carina, coming up from the right.',
    alt: 'The view down the scope above the carina. Blood lies in the right main bronchus and across the lower wall of the trachea in front of the carina. The left main bronchus is nearly clear.',
    view: 'scope',
  },
  'bleeding-blocker': {
    caption: 'A blocker in the bleeding bronchus. The balloon holds the blood beyond it.',
    alt: 'The carina and both main bronchi from the front. A thin catheter runs down the trachea to a balloon inflated in the bronchus intermedius. The airways beyond the balloon are red. The right upper lobe and the left lung are clear.',
    view: 'front',
  },
  'bleeding-tube-in-other-lung': {
    caption: 'A tube in the left main bronchus. Its cuff keeps blood out of the left lung.',
    alt: 'The carina and both main bronchi from the front. A tracheal tube runs down the trachea into the left main bronchus, with its cuff inflated there. The right lung’s airways and the carina are red. The left lung beyond the cuff is clear.',
    view: 'front',
  },
} as const satisfies Record<string, TeachingStill>

export type TeachingStillId = keyof typeof TEACHING_STILLS

export const teachingStillUrl = (id: TeachingStillId) =>
  `/bronchoscopy-foundations/renders/${id}.jpg`

/** What to say once under a group of pictures, for the ways they are seen. */
export function teachingStillsNote(ids: readonly TeachingStillId[]): string | null {
  const views = new Set(ids.map((id) => TEACHING_STILLS[id].view))
  const parts: string[] = []
  if (views.has('front')) parts.push('From the front, the patient’s right is on the left.')
  if (views.has('right-side-down'))
    parts.push('In the side-down picture the patient’s right is at the bottom.')
  return parts.length ? parts.join(' ') : null
}
