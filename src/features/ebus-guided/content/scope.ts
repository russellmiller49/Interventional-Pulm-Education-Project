import type { Lesson } from './types'
import { question as q, matching } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value

/**
 * The EBUS scope itself (owner decision of 2026-11-10 to add scope and balloon handling).
 *
 * A fellow who drives a diagnostic bronchoscope well meets three differences at once: the lens
 * looks obliquely forward, the transducer sees only where it touches, and the two views trade
 * places as the tip flexes. The live example is the course's linked console in demonstration
 * form; nothing here is gated, and the unit's task is the matching.
 *
 * Sources. The view angle and field are the project's recorded nominal optics for the Olympus
 * BF-UC180F (`BF_UC180F_NOMINAL`), which is also what the simulated lens uses. The statements
 * about passing the cords, the red-out on contact and clearing air from the balloon are practice
 * points written from the geometry and from the course's own procedural-technique module; none
 * is a guideline recommendation, and the owner reads them before they are signed.
 */
export const scopeLesson: Lesson = {
  id: 'ebus-scope',
  title: 'The EBUS scope: lens, transducer and balloon',
  topic: 'Prepare',
  minutes: 8,
  objective:
    'Predict where the tip will travel from an oblique white-light view, and say what each part of the tip does.',
  recall:
    'A diagnostic bronchoscope looks straight ahead: what is centred on the screen is where the tip goes.',
  concept: 'One tip, three jobs, none of them straight ahead',
  paragraphs: [
    `The lens of a convex EBUS scope does not look straight ahead. It sits behind the transducer and looks obliquely forward, toward the side the transducer faces: ${N('scope-view-angle')} from the long axis of the scope on the Olympus BF-UC180F, with an ${N('scope-field-of-view')} field. The angle differs between scope models; the consequence is the same. The tip travels below the centre of the white-light image.`,
    'With the scope straight in the trachea you therefore see the anterior wall, and the airway ahead sits low in the picture. A small downward flexion brings the carina to the centre. Passing the vocal cords, a tip aimed at the middle of the glottis arrives posteriorly, at the arytenoids: keep the anterior commissure in view and let the tip pass through the posterior glottis.',
    'The transducer is at the very tip, on one side. It images only where that side touches the airway wall, as a thin slice along the length of the scope. Flexing the tip up presses it onto the wall: the ultrasound image appears, and the white-light view fills with mucosa and turns red. The two views trade places. White light takes you to the station; ultrasound takes over once the transducer is on the wall.',
    'A balloon fits over the transducer and is filled with saline to bridge the gap where the tip cannot lie flat against the wall. Clear the air from it before the case: a bubble inside the balloon blocks ultrasound exactly as an air gap does. The distal end is also wider, longer and stiffer than the bronchoscope you are used to, and it bends less.',
  ],
  checklist: [
    'Expect the airway ahead low in the white-light image.',
    'Through the cords, keep the anterior commissure in view.',
    'Use white light to arrive and ultrasound once the transducer is on the wall.',
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
        'The view is tilted toward the transducer side. What is centred on the screen lies above the line the tip follows, so a tip aimed at the middle of the glottis arrives posteriorly.',
      ],
      [
        'The image is inverted, so the top of the screen is posterior',
        'The image is upright: anterior is still at the top with the scope held normally. The view is tilted forward, not turned over.',
      ],
      [
        'The distal end is too wide for the glottis and has to be rotated a quarter turn to pass',
        'The tip is wider than a diagnostic bronchoscope but passes an adult glottis without rotation. The tip went where it was pointed; it was pointed low.',
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
        'Saline bridges a gap to the wall; a bubble inside it blocks the image',
      ],
    ],
    'Three things share one tip and none of them points straight ahead. The lens tells you where you are, the transducer shows what lies beside you, and the needle leaves between them into the plane the transducer is showing.',
  ),
  observation: {
    ...q(
      'scope-observe',
      'With the tip flexed up, the ultrasound image shows tissue and the white-light view is uniformly red. What does the white-light view tell you?',
      [
        'The lens is against the wall, as expected once the transducer is in contact',
        'Contact brings the lens onto the mucosa too. A red view with a good ultrasound image is the working position, not a lost airway.',
      ],
      [
        'There is blood on the lens, and the scope should be withdrawn to clean it',
        'Blood is possible, but a red view that appears as the tip flexes onto the wall and clears as it flexes away is contact.',
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
   * It carries the orientation lab's configuration because that is the console this unit shows;
   * the unit has no acquisition step, so nothing here is held or checked.
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
  takeaways: [
    'The tip travels below the centre of the white-light image.',
    'White light to arrive; ultrasound once the transducer is on the wall.',
  ],
  sources: ['olympus-uc180f', 'simulation'],
}
