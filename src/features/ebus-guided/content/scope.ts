import type { Lesson } from './types'
import { question as q, matching } from './authoring'
import { BF_UC190F_VIEW_ANGLE, EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value

/**
 * The EBUS scope itself (owner decision of 2026-11-10 to add scope and balloon handling).
 *
 * A fellow who drives a diagnostic bronchoscope well meets three differences at once: the lens
 * looks obliquely forward, the transducer sees only where it touches, and the two views trade
 * places as the tip flexes. The live example is the course's linked console in demonstration
 * form. Since 2026-11-10 the same console is then a short task (find the airway view, then bring
 * the image back), followed by the matching.
 *
 * Sources. The view angle and field are the project's recorded nominal optics for the Olympus
 * BF-UC180F (`BF_UC180F_NOMINAL`), which is also what the simulated lens uses; they match the
 * manufacturer's product pages as read on 2026-11-14 and again on 2026-11-18 (BF-UC180F: 35°
 * forward oblique, 80° field; BF-UC190F: 20° forward oblique, 80° field). The statements about
 * passing the cords, the red-out on contact and clearing air from the balloon are practice
 * points written from the geometry and from the course's own procedural-technique module; none
 * is a guideline recommendation.
 *
 * Owner ruling `ebus-scope-lesson-points` (2026-11-14, "Correct"): both scope models are named
 * with their own figures; no single glottic approach or screen position is taught as holding for
 * every scope model and rotation; a red view on contact is read with tip position, ultrasound
 * contact and the patient, never as harmless by default; the balloon depends on the equipment and
 * the case; tip size and stiffness are general, and bending differs between models. He reads the
 * revised lesson before it is signed.
 */
export const scopeLesson: Lesson = {
  id: 'ebus-scope',
  title: 'The EBUS scope: lens, transducer and balloon',
  topic: 'Prepare',
  minutes: 9,
  objective:
    'Predict where the tip will travel from an oblique white-light view, and say what each part of the tip does.',
  recall:
    'A diagnostic bronchoscope looks straight ahead: what is centred on the screen is where the tip goes.',
  concept: 'One tip, three jobs, none of them straight ahead',
  paragraphs: [
    `The lens of a convex EBUS scope does not look straight ahead. It sits behind the transducer and looks obliquely forward, toward the side the transducer faces. The angle differs between scope models: on the Olympus BF-UC180F the direction of view is ${N('scope-view-angle')} forward oblique from the long axis of the scope, and on the newer BF-UC190F it is ${BF_UC190F_VIEW_ANGLE}; both have an ${N('scope-field-of-view')} field of view. The effect is the same in kind on both and greater on the BF-UC180F: the tip travels along the long axis of the scope, which points below the centre of the white-light image. Know which scope you are holding. The simulation in this lesson uses the BF-UC180F figures.`,
    'With the scope in its usual orientation the transducer faces anteriorly, so the lens looks forward and anteriorly. In the trachea you see more of the anterior wall, and the airway ahead sits low in the picture; a small downward flexion brings the carina toward the centre. The same offset matters at the vocal cords. The tip follows a line posterior to whatever is centred in the image, so a tip advanced on a centred glottic opening can meet the arytenoids. Find the anterior commissure and keep track of it as you advance, and steer by where the tip is travelling, not by what is centred. How far that line lies from the centre, and where the glottis sits on the screen, depend on the scope model and on how the scope is rotated in your hand: no single screen position holds for every scope.',
    'The transducer is at the very tip, on one side. It images only where that side touches the airway wall, as a thin slice along the length of the scope. Flexing the tip up presses it onto the wall: the ultrasound image appears, and the white-light view fills with mucosa and turns red. The two views trade places. White light takes you to the station; ultrasound takes over once the transducer is on the wall.',
    'A red white-light view is expected while the transducer is in contact, but red alone does not tell you that all is well: blood on the lens looks the same, and so does contact somewhere you did not intend. Read it with where the tip is, whether the ultrasound image shows the contact you expect, and how the patient is doing.',
    'A balloon can be fitted over the transducer and filled with saline to bridge the gap where the tip cannot lie flat against the wall. Whether one is used depends on the equipment and the clinical circumstances. When it is used, clear the air from it before the procedure: a bubble inside the balloon blocks ultrasound exactly as an air gap does. Because it carries the transducer, the distal end of a convex EBUS scope is larger and more rigid than the tip of a diagnostic bronchoscope. How far the tip bends differs between scope models, so check the specifications of the scope you use.',
  ],
  checklist: [
    'Expect the airway ahead low in the white-light image.',
    'At the cords, find the anterior commissure and steer by where the tip travels.',
    'Use white light to arrive and ultrasound once the transducer is on the wall.',
    'Read a red view with tip position, the ultrasound image and the patient.',
  ],
  worked: {
    context:
      'With the scope straight in the mid-trachea, the white-light view shows the anterior tracheal wall, and the lumen is a crescent at the bottom of the picture.',
    reasoning:
      'Nothing is wrong with the position. The lens looks obliquely forward toward the transducer side, so the view sits above the line the tip travels. Flex down a little to bring the carina to the centre; flex up when you want the transducer on the wall.',
  },
  question: {
    ...q(
      'scope-predict',
      'You advance an EBUS scope toward the vocal cords with the glottic opening centred on the screen. The tip meets the arytenoids instead of passing through. What explains it?',
      [
        'The lens looks obliquely forward, so the tip travels below the centre of the image',
        'The view is tilted toward the transducer side. With the scope in its usual orientation, what is centred on the screen lies anterior to the line the tip follows, so a tip advanced on a centred glottis arrives posteriorly. How large the offset is depends on the scope model.',
      ],
      [
        'The image is inverted, so the top of the screen is posterior',
        'The image is upright: anterior is still at the top with the scope held normally. The view is tilted forward, not turned over.',
      ],
      [
        'The distal end is too wide for the glottis and has to be rotated a quarter turn to pass',
        'The tip is wider than a diagnostic bronchoscope, but width is not what stopped it. The tip went where the scope was pointed, and that was posterior to the centred glottis.',
      ],
    ),
    imagePolicy: 'none',
  },
  matching: matching(
    'Match each part of the tip with what it means for the way you drive.',
    [
      [
        'The lens, looking obliquely forward',
        'The airway ahead sits low in the image, and the tip travels below what is centred',
      ],
      [
        'The transducer, at the very tip on one side',
        'It images only where that side touches the wall, in a slice along the scope',
      ],
      [
        'The working-channel outlet, just behind the transducer',
        'The needle leaves at an angle and crosses the ultrasound image from the side of the green dot',
      ],
      [
        'The balloon over the transducer',
        'When one is used, saline bridges a gap to the wall; a bubble inside it blocks the image',
      ],
    ],
    'Three things share one tip and none of them points straight ahead. The lens tells you where you are, the transducer shows what lies beside you, and the needle leaves between them into the plane the transducer is showing.',
  ),
  observation: {
    ...q(
      'scope-observe',
      'With the tip flexed up, the ultrasound image shows tissue and the white-light view is uniformly red. What does the white-light view tell you?',
      [
        'Probably mucosal contact, to be checked against tip position, the ultrasound image and the patient',
        'Contact brings the lens onto the mucosa too, so a red view with tissue on the ultrasound image is what the working position looks like. Red alone does not prove it: confirm that it appeared as the tip flexed onto the wall, that the ultrasound image is the one you expect, and that the patient is stable.',
      ],
      [
        'There is blood on the lens, and the scope should be withdrawn to clean it',
        'Blood is possible and the colour alone does not exclude it. Here the red appeared as the tip flexed onto the wall and the ultrasound image shows contact; easing the flexion tells the two apart before you withdraw.',
      ],
      [
        'The light source has failed and the examination should stop',
        'A failed light source leaves a dark picture, not a red one, and does not follow tip flexion.',
      ],
    ),
    imagePolicy: 'none',
  },
  transfer: {
    ...q(
      'scope-transfer',
      'The subcarinal node is on the ultrasound image and the white-light view shows only red mucosa. A colleague suggests flexing the tip down to get the airway view back before the needle goes in. What would that do?',
      [
        'Lift the transducer off the wall and lose the image the needle is guided by',
        'The lens and the transducer are on the same tip. Getting the airway view back means giving up contact. The needle is guided on ultrasound, so keep the window.',
      ],
      [
        'Nothing to the ultrasound image, since the two views are independent',
        'They are fixed to one tip. Moving it to improve one view changes the other.',
      ],
      [
        'Improve the ultrasound image, because the lens was shadowing the transducer',
        'The lens sits behind the transducer and is not in its path. The image comes from contact, which flexing down removes.',
      ],
      true,
    ),
    imagePolicy: 'none',
  },
  /*
   * The linked console in demonstration form: three views, tip flexion and rotation, no gate.
   * It carries the orientation lab's configuration because that is the console this unit shows.
   * Nothing on the demonstration is held or checked; the task that follows it is `transferLab`.
   */
  lab: {
    kind: 'simulator',
    linkedLesson: 'scope-orientation',
    goal: 'scan',
    presetKey: 'station_7_node_a::rms',
    controls: ['flexion', 'roll'],
    freeDrive: true,
    initialRoll: 0,
    instruction:
      'Move Tip flexion and watch the white-light view and the ultrasound image trade places.',
  },
  // The same console as a task (2026-11-10): flexion alone, and the two views found in turn.
  transferLab: {
    kind: 'simulator',
    linkedLesson: 'scope-orientation',
    linkedVariant: 'airway-view',
    goal: 'airway-view',
    presetKey: 'station_7_node_a::rms',
    controls: ['flexion'],
    freeDrive: true,
    initialRoll: 0,
    instruction:
      'Use Tip flexion only. First flex down until the airway ahead sits in the middle of the white-light view, and notice what happens to the ultrasound image. Then flex up until the wall fills the white-light view and tissue echoes return.',
  },
  takeaways: [
    'The tip travels below the centre of the white-light image, by an amount that depends on the scope model.',
    'White light to arrive; ultrasound once the transducer is on the wall.',
    'A red view on contact is expected, and is still read with tip position, the ultrasound image and the patient.',
  ],
  sources: ['olympus-uc180f', 'olympus-uc190f', 'simulation'],
}
