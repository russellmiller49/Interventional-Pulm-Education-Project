/**
 * Pictures drawn from the course's own 3D models, for teaching screens that had none.
 *
 * The files are written by `scripts/bronchoscopy-foundations/render-teaching-stills.mjs` to
 * `public/bronchoscopy-foundations/renders/`, with `renders.json` beside them. A test holds every
 * id here to a file there. They are drawings: blood, a blocker, a tube and the scope are shapes
 * placed in the teaching airway to show where each one is; a narrowed bronchus, a closed glottis
 * and a lung drawn down from the chest wall are the same models reshaped; a monitor trace is a
 * line drawn to the shape the text describes. None is a photograph or a recording.
 *
 * `view` says how the picture is seen, so the screen can say it once under the pictures:
 * `front` is the airway tree from in front of the patient, `scope` is the view down the scope,
 * `right-side-down` is the tree with the patient lying on the right side, `chest` is the lungs and
 * airways from in front, and `monitor` is a drawn monitor trace.
 */
export type TeachingStillView = 'front' | 'scope' | 'right-side-down' | 'chest' | 'monitor'

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
  'deterioration-clear-view': {
    caption: 'A clear view in the lower lobe. It says nothing about how the patient is.',
    alt: 'The view down the scope at the top of the right lower lobe bronchus. The wall is clean and two round segmental openings lie ahead.',
    view: 'scope',
  },
  'deterioration-scope-in-lobe': {
    caption: 'Deep in the lower lobe, the scope takes up much of the airway it lies in.',
    alt: 'The airway tree from the front. The scope runs down the trachea and the right main bronchus, with its tip in the basal bronchus of the right lower lobe.',
    view: 'front',
  },
  'deterioration-scope-in-trachea': {
    caption: 'Withdrawn to the trachea. Air passes round the scope to both lungs.',
    alt: 'The airway tree from the front. The scope has been drawn back so its tip sits in the middle of the trachea, above the carina. Both main bronchi are empty.',
    view: 'front',
  },
  'deterioration-trace-sedated': {
    caption: 'Capnography. Above, breathing well. Below, too sedated: slower, smaller, then flat.',
    alt: 'Two capnography traces on one time scale. The upper, breathing well, is five even flat-topped waves. The lower, too sedated, is three waves, each later and lower than the one before, and then a flat line.',
    view: 'monitor',
  },
  'deterioration-cords-open': {
    caption: 'The cords from above, open for a breath in.',
    alt: 'The view down the scope just above the vocal cords. The two pale cords are apart, joined at the front, and the rings of the trachea show through the opening between them.',
    view: 'scope',
  },
  'deterioration-cords-shut': {
    caption: 'Laryngospasm: the cords are shut. No air passes.',
    alt: 'The view down the scope just above the vocal cords. The two pale cords meet along the midline from front to back. No opening is left between them and the trachea cannot be seen.',
    view: 'scope',
  },
  'deterioration-bronchi-narrowed': {
    caption: 'Bronchospasm: the bronchi narrow. Air still moves, slowly.',
    alt: 'The view down the scope at the top of the right lower lobe bronchus. The wall has drawn in and the two segmental openings ahead are small and slit-like, far smaller than in the clear view.',
    view: 'scope',
  },
  'deterioration-trace-spasm': {
    caption: 'Capnography. Above, laryngospasm: flat. Below, bronchospasm: each wave slopes up.',
    alt: 'Two capnography traces on one time scale. The upper, laryngospasm, is two flat-topped waves and then a flat line. The lower, bronchospasm, is four waves that each climb in a slow curve with no flat top.',
    view: 'monitor',
  },
  'deterioration-pneumothorax': {
    caption: 'Pneumothorax: air between the right lung and the chest wall. The lung is smaller.',
    alt: 'Both lungs and the airways from the front. The right lung has drawn in toward its hilum and is about two thirds of its size. The space it filled is outlined round it, empty. The left lung fills its side.',
    view: 'chest',
  },
  'deterioration-tension': {
    caption: 'Tension: trapped air pushes the trachea and the heart across. The heart cannot fill.',
    alt: 'Both lungs and the airways from the front. The right lung is small and lies against its hilum inside a large empty space. The trachea bends toward the patient’s left and the left lung is pressed toward the left chest wall.',
    view: 'chest',
  },
  'deterioration-oximeter-plateau': {
    caption:
      'Methemoglobinemia: oxygen is turned up (above). The oximeter reading (below) stays level.',
    alt: 'Two traces on one time scale. The upper, oxygen, rises in four steps. The lower, the oximeter reading, is a level line that does not change as the oxygen rises.',
    view: 'monitor',
  },
} as const satisfies Record<string, TeachingStill>

export type TeachingStillId = keyof typeof TEACHING_STILLS

export const teachingStillUrl = (id: TeachingStillId) =>
  `/bronchoscopy-foundations/renders/${id}.jpg`

/** What to say once under a group of pictures: what they are drawn from, and how they are seen. */
export function teachingStillsNote(ids: readonly TeachingStillId[]): string {
  const views = new Set(ids.map((id) => TEACHING_STILLS[id].view))
  const airway = views.has('front') || views.has('scope') || views.has('right-side-down')
  const parts: string[] = []
  if (airway && views.has('chest')) parts.push('Drawn from the course’s 3D models.')
  else if (airway) parts.push('Drawn from the course’s 3D airway.')
  else if (views.has('chest')) parts.push('Drawn from the course’s 3D chest.')
  if (views.has('monitor')) parts.push('The traces are drawings, not recordings.')
  if (views.has('front') || views.has('chest'))
    parts.push('From the front, the patient’s right is on the left.')
  if (views.has('right-side-down'))
    parts.push('In the side-down picture the patient’s right is at the bottom.')
  return parts.join(' ')
}
