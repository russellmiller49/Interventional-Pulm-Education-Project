import type { AirwayLabel } from '../components/scope/types'
import type { BronchLearnUnit } from './learnUnit'
import type { BronchSectionId } from './sectionIds'

/** Learn presentation and disclosure are independent of item identity and engine phases. */
export type CoursePresentation = 'illustrated' | 'skill' | 'inspection' | 'case' | 'report'
export type CourseActivity =
  | 'teaching'
  | 'demonstration'
  | 'guided-practice'
  | 'independent-check'
  | 'debrief'
export type CourseVisual =
  | 'none'
  | 'instrument'
  | 'section'
  | 'tour'
  | 'baseline'
  | 'sequence'
  | 'sort-example'
  | 'worked-decision'
  | 'tube-geometry'
  | 'two-diameters'
  | 'room-setup'
export interface CourseChunk {
  readonly id: string
  readonly title: string
  readonly kind: 'teach' | 'practice' | 'observe' | 'check' | 'transfer' | 'debrief'
  readonly presentation: CoursePresentation
  readonly blocks: readonly string[]
  readonly visual: CourseVisual
  readonly instruction?: string
  readonly anchor?: boolean
  readonly grammar?: boolean
  readonly demonstration?: BronchLearnUnit['demonstration']
  readonly learnerRecord?: boolean
  /** A practice screen that runs one of the section's further activities (`moreActs`), by key. */
  readonly act?: string
  /** The stops of the section's labelled tour this screen walks, in the section's order. */
  readonly tour?: readonly AirwayLabel[]
}

const teach = (
  id: string,
  title: string,
  blocks: readonly string[],
  visual: CourseVisual = 'none',
): CourseChunk => ({ id, title, kind: 'teach', presentation: 'illustrated', blocks, visual })
const practice = (
  title: string,
  presentation: CoursePresentation,
  instruction: string,
): CourseChunk => ({
  id: 'application',
  title,
  kind: 'practice',
  presentation,
  blocks: [],
  visual: 'none',
  instruction,
})
const check = (id: 'check' | 'transfer', title = 'Use what you learned'): CourseChunk => ({
  id,
  title,
  kind: id,
  presentation: 'case',
  blocks: [],
  visual: 'none',
})
const debrief = (blocks: readonly string[]): CourseChunk => ({
  id: 'review',
  title: 'Review the reasoning',
  kind: 'debrief',
  presentation: 'illustrated',
  blocks,
  visual: 'none',
  anchor: true,
  grammar: true,
})

// ── Rewritten sections ───────────────────────────────────────────────────────────────────────────
// Hook, prediction, teaching screens with a picture, activities, a check with new details, and a
// close that repeats the hook's checklist (`authoringRules.ts` holds a rewritten section to this).

/** The opening screen: the clinical question and the memory hook, with no cards. */
const hook = (title: string): CourseChunk => ({
  id: 'hook',
  title,
  kind: 'teach',
  presentation: 'illustrated',
  blocks: [],
  visual: 'none',
  anchor: true,
  instruction: 'Start with the question. The checklist comes back at the end.',
})
const screen = (
  id: string,
  title: string,
  instruction: string,
  blocks: readonly string[],
  extra: Partial<CourseChunk> = {},
): CourseChunk => ({
  id,
  title,
  kind: 'teach',
  presentation: 'illustrated',
  blocks,
  visual: 'none',
  instruction,
  ...extra,
})
/** The closing screen: the common errors, then the checklist again. */
const close = (blocks: readonly string[]): CourseChunk => ({
  id: 'review',
  title: 'Before you move on',
  kind: 'debrief',
  presentation: 'illustrated',
  blocks,
  visual: 'none',
  anchor: true,
  instruction: 'Read the errors to expect, then run the checklist once more.',
})

/** This maps presentations only. The canonical section registry still owns course order. */
export const COURSE_FLOWS: Partial<Readonly<Record<BronchSectionId, readonly CourseChunk[]>>> = {
  'clinical-question': [
    hook('Should this patient have a bronchoscopy today?'),
    check('check', 'Why do this bronchoscopy?'),
    screen(
      'whole-case',
      'One bronchoscopy, start to finish',
      'Follow one patient through. These steps are the map of the course.',
      ['whole-case'],
    ),
    screen('indications', 'When to look', 'Read what a bronchoscopy is for.', ['indications']),
    screen('risk', 'What makes it unsafe today', 'Read what you fix first.', ['risk']),
    screen(
      'bleeding-plan',
      'Platelets and blood thinners',
      'Learn the thresholds and the holds. You will use them on the referrals that follow.',
      ['bleeding-plan'],
    ),
    practice(
      'Three referrals',
      'case',
      'Read each referral, then decide: go ahead, hold or modify. A plan that goes badly plays out, then you decide again.',
    ),
    screen(
      'consent',
      'Consent, then the time-out',
      'Read the last two checks before the scope goes in.',
      ['consent-and-time-out'],
    ),
    check('transfer', 'Plan the medicines for a different patient'),
    close(['common-errors']),
  ],
  'pre-use-check': [
    hook('Is this scope ready?'),
    check('check', 'Suction that does not draw'),
    screen('parts', 'The parts of the scope', 'Find each part on the photograph.', ['parts'], {
      visual: 'instrument',
    }),
    practice(
      'Name the parts',
      'illustrated',
      'No names this time. Name the outlined part in each of the eight views.',
    ),
    screen(
      'two-diameters',
      'Every scope has two diameters',
      'Read what each diameter decides, then the sizes of the scopes you will use.',
      ['two-diameters'],
      { visual: 'two-diameters' },
    ),
    screen('readiness', 'The pre-use check', 'Learn the five checks. Run them in this order.', [
      'pre-use-check',
    ]),
    screen('suction-path', 'When suction does not draw', 'Read how suction fails, and where.', [
      'suction-path',
    ]),
    {
      ...practice(
        'Find the failed check',
        'case',
        'Six scopes each fail one check. Match what you find to the check that has failed.',
      ),
      id: 'find-the-fault',
      act: 'faults',
    },
    screen(
      'room',
      'The room and the release',
      'Read what must be true before the first sedative.',
      ['room', 'released'],
      { visual: 'room-setup' },
    ),
    check('transfer', 'Choose a scope for a biopsy'),
    close(['common-errors']),
  ],
  // Driving the scope. Each bench screen is one unit of `fiveControlsLearn.ts`, which adds the
  // demonstration and the cue; the chunk ids are the unit ids.
  'five-controls': [
    hook('Making the tip go where you look'),
    check('check', 'Before you touch it: what does turning do?'),
    screen('instrument', 'Hold the scope', 'Find each part your hands will use.', ['grip'], {
      visual: 'instrument',
    }),
    screen(
      'stance',
      'Where you stand',
      'Read how your position sets left and right on the screen.',
      ['stance'],
      {
        visual: 'room-setup',
      },
    ),
    {
      ...practice(
        'Advance and withdraw',
        'skill',
        'Watch the example, then move the tip forward and back yourself.',
      ),
      id: 'depth',
      blocks: ['depth'],
      act: 'depth',
    },
    {
      ...practice(
        'Depth again, without the cue',
        'skill',
        'Make the card look closer, then return to the starting depth.',
      ),
      id: 'depth-repeat',
      blocks: [],
      act: 'depth-repeat',
    },
    {
      ...practice(
        'Bend the tip',
        'skill',
        'Watch the lever and the tip, then bend and release the tip yourself.',
      ),
      id: 'bend',
      blocks: ['bend'],
      act: 'bend',
    },
    {
      ...practice(
        'The bend again, without the cue',
        'skill',
        'Change the direction the tip faces, then bring it back to straight.',
      ),
      id: 'bend-repeat',
      blocks: [],
      act: 'bend-repeat',
    },
    {
      ...practice(
        'Rotate the scope',
        'skill',
        'Watch the image and the bend turn together, then turn, bend and turn again yourself.',
      ),
      id: 'rotation',
      blocks: ['rotation'],
    },
    {
      ...practice(
        'Rotation again, without the cue',
        'skill',
        'The tip starts bent. Turn it without changing its bend or its depth.',
      ),
      id: 'rotation-repeat',
      blocks: [],
      act: 'rotation-repeat',
    },
    {
      ...practice(
        'Aim at a target',
        'skill',
        'Keep the gold target centered as you advance into the depth band.',
      ),
      id: 'combine',
      blocks: ['combine'],
      act: 'combine',
    },
    {
      ...practice(
        'Suction',
        'skill',
        'Watch the suction valve, then apply and release it yourself.',
      ),
      id: 'suction',
      blocks: ['suction'],
      act: 'suction',
    },
    {
      ...practice(
        'Suction again, without the cue',
        'skill',
        'Apply suction, then release it. Watch whether the tip moves.',
      ),
      id: 'suction-repeat',
      blocks: [],
      act: 'suction-repeat',
    },
    screen(
      'in-the-airway',
      'Into an opening, and back',
      'Read how the same three movements enter an airway, and how you come back.',
      ['in-the-airway'],
    ),
    {
      ...practice(
        'A target in a new place',
        'skill',
        'The target has moved. Decide which movements you need, then center it and advance.',
      ),
      id: 'changed-target',
      blocks: [],
      act: 'changed-target',
    },
    check('transfer', 'An opening at the edge of the image'),
    close(['common-errors']),
  ],
  'right-side': [
    hook('Which airway is this?'),
    check('check', 'Where is the scope?'),
    screen(
      'upper-lobe',
      'The right main bronchus and the upper lobe',
      'Walk the stills. Each outline marks the opening the button names.',
      ['standard-view', 'upper-lobe'],
      { visual: 'tour', tour: ['RMSB', 'RUL', 'RB1', 'RB2', 'RB3'] },
    ),
    screen(
      'middle-and-lower',
      'The middle and lower lobes',
      'Walk the stills from the bronchus intermedius to the basal segments.',
      ['two-lobes', 'basal-segments'],
      {
        visual: 'tour',
        tour: ['BI', 'RML', 'RB4', 'RB5', 'RLL', 'RB6', 'RB7', 'RB8', 'RB9', 'RB10'],
      },
    ),
    {
      ...practice(
        'Name six views',
        'illustrated',
        'No names this time. Click the opening each view asks for. One view is rotated.',
      ),
      id: 'name-the-views',
      act: 'images',
    },
    practice(
      'Drive into the middle lobe and the superior segment',
      'inspection',
      'The scope starts where the bronchus intermedius ends, with opening names off. Meet the three goals.',
    ),
    check('transfer', 'Count the basal openings'),
    close(['common-errors']),
  ],
  'sedation-and-monitoring': [
    hook('Comfortable, counted and breathing'),
    check('check', 'A clear view and a quiet monitor'),
    screen('topical', 'Numb the airway', 'Read where the lidocaine goes.', ['topical']),
    screen(
      'lidocaine-count',
      'Count every milligram',
      'Learn the conversion and the limit. You will use both on the record that follows.',
      ['lidocaine-count'],
    ),
    practice(
      'Add up one patient’s lidocaine',
      'case',
      'Enter the milligrams for each measured line. Then say what the record tells you.',
    ),
    screen('toxicity', 'Too much local anesthetic', 'Read the signs to act on.', ['toxicity']),
    screen('sedation-drugs', 'Sedation', 'Read what each drug does, and what it does not.', [
      'sedation-drugs',
    ]),
    screen('monitoring', 'Monitoring', 'Read what to watch, and in what order.', ['monitoring']),
    {
      ...practice(
        'One patient, three decisions',
        'case',
        'Read the patient and the monitor, then decide. A move that makes things worse plays out, then you decide again.',
      ),
      id: 'sedation-case',
      act: 'drift',
    },
    screen(
      'before-and-after',
      'Before, and after',
      'Read the fasting times and the reversal doses.',
      ['before-and-after'],
    ),
    check('transfer', 'A patient in recovery'),
    close(['common-errors']),
  ],
  'view-loss': [
    teach(
      'normal-view',
      'Begin with a usable view',
      ['lumen-disappears', 'what-to-read', 'usable-view'],
      'tour',
    ),
    {
      ...teach('recovery', 'Distinguish the causes of a lost view', [
        'one-sign-five-problems',
        'recovery-routine',
        'darkness-not-a-direction',
      ]),
      grammar: true,
    },
    practice(
      'Recover a recognizable lumen',
      'inspection',
      'Use the scope controls to recover the view and return to a named parent airway. Keep forward movement stopped until the lumen is visible.',
    ),
    {
      id: 'lens',
      title: 'Now inspect a different cause of degraded vision',
      kind: 'observe',
      presentation: 'inspection',
      blocks: [],
      visual: 'none',
      instruction:
        'The next authored view has a different source of obscuration. Read the observations and use the available controls to recover the view.',
    },
    teach('exceptions', 'Account for an accessory or a protective scope position', [
      'accessory-out',
      'scope-holding-a-bleed',
    ]),
    check('check', 'Interpret a lost view'),
    debrief(['common-errors']),
    check('transfer', 'Choose recovery in a changed context'),
  ],
  'larynx-and-entry': [
    hook('The cords are in view'),
    check('check', 'A pink view at the back of the inlet'),
    screen('larynx', 'The larynx from above', 'Name each structure before you aim.', ['larynx']),
    {
      ...practice(
        'Name four views',
        'illustrated',
        'No names this time. Click the structure or the opening each view asks for.',
      ),
      id: 'name-the-views',
      act: 'images',
    },
    screen(
      'crossing',
      'Getting to the cords, and through them',
      'Read the route in, then when to cross.',
      ['route', 'crossing'],
      { visual: 'section' },
    ),
    practice(
      'Cross the cords',
      'inspection',
      'Watch the cords through a few breaths, then cross as they part. Below them, name the trachea.',
    ),
    screen(
      'trachea-and-carina',
      'The trachea and the carina',
      'Walk the three stills, then read why the carina is home base.',
      ['trachea-and-carina'],
      { visual: 'tour', tour: ['TR', 'RMSB', 'LMSB'] },
    ),
    {
      ...practice(
        'Into each main bronchus, and back',
        'inspection',
        'Start in the trachea. Reach the carina, enter the right main bronchus, come back, then enter the left.',
      ),
      id: 'carina',
      act: 'carina',
    },
    screen('holding', 'Hold the view', 'Read how to keep the scope still while others work.', [
      'holding-the-view',
    ]),
    {
      ...practice(
        'Hold above the carina',
        'inspection',
        'The assistant will speak. Acknowledge, capture an image, and stay where you are until the hold ends.',
      ),
      id: 'hold-view',
      act: 'hold',
    },
    check('transfer', 'Lost after a cough'),
    close(['common-errors']),
  ],
  'left-side': [
    hook('Which lobe owns this airway?'),
    check('check', 'A long way with no opening'),
    screen(
      'main-and-upper',
      'The left main bronchus and the upper lobe',
      'Walk the stills. Each outline marks the opening the button names.',
      ['left-main', 'upper-lobe'],
      { visual: 'tour', tour: ['LMSB', 'LUL', 'LUL-UD', 'LB1+2', 'LB3', 'LB4+5', 'LB4', 'LB5'] },
    ),
    screen(
      'lower-lobe',
      'The lower lobe',
      'Walk the stills from the lower lobe opening to the basal segments.',
      ['lower-lobe'],
      { visual: 'tour', tour: ['LLL', 'LB6', 'LB7+8', 'LB9', 'LB10'] },
    ),
    {
      ...practice(
        'Name six views',
        'illustrated',
        'No names this time. Click the opening each view asks for. One view is rotated.',
      ),
      id: 'name-the-views',
      act: 'images',
    },
    practice(
      'Drive into the lingula and the superior segment',
      'inspection',
      'The scope starts in the left main bronchus, upright, with opening names off. Meet the four goals.',
    ),
    check('transfer', 'Two openings after a cough'),
    close(['common-errors']),
  ],
  'systematic-survey': [
    teach('survey-order', 'Plan a systematic inspection', [
      'what-a-survey-leaves',
      'what-the-record-rests-on',
      'default-order',
    ]),
    teach('worked-record', 'Follow one lower lobe into the record', [
      'separate-observations',
      'lower-lobe-worked',
      'withdrawal-and-return',
      'when-the-survey-yields',
    ]),
    practice(
      'Inspect and maintain the examination record',
      'inspection',
      'Navigate the authored survey and declare what you actually inspected. Record nonvisualized or inaccessible regions explicitly. Entering an airway does not complete its inspection.',
    ),
    check('check', 'Distinguish an entry from an inspection'),
    debrief(['common-errors']),
    check('transfer', 'Decide how to record a limited view'),
  ],
  'describe-findings': [
    teach(
      'normal',
      'Establish the normal comparison',
      ['something-unexpected', 'normal-right-main', 'structure-mucosa-contents'],
      'section',
    ),
    teach('written-finding', 'Describe the finding in this written vignette', [
      'the-finding',
      'finding-described',
      'still-and-screen',
    ]),
    practice(
      'Construct a supported description',
      'report',
      'The abnormal finding is supplied in words. Use those observations to build the description; no abnormal image is being shown.',
    ),
    check('check', 'Separate observation from inference'),
    debrief(['findings-that-pause', 'common-errors']),
    check('transfer', 'Describe a different finding'),
  ],
  'washing-and-lavage': [
    teach('purposes', 'Distinguish saline procedures by their purpose', [
      'saline-in-the-airway',
      'what-to-notice',
      'four-procedures',
    ]),
    teach(
      'worked-sequence',
      'Follow a lavage from planning to specimen',
      ['lavage-worked', 'gentle-seal', 'volumes-recorded'],
      'sequence',
    ),
    practice(
      'Arrange a supported procedural sequence',
      'case',
      'Order the procedural steps using their purposes and safety dependencies. This exercise represents reasoning, not a measured wedge or fluid return.',
    ),
    check('check', 'Identify what the procedure samples'),
    debrief(['therapeutic-aspiration', 'common-errors']),
    check('transfer', 'Adapt to a different sampling purpose'),
  ],
  'poor-return': [
    teach(
      'baseline',
      'Establish the expected return and tolerance',
      ['little-comes-back', 'where-to-look', 'going-to-plan'],
      'baseline',
    ),
    {
      ...teach('reasoning', 'Work through reduced return', ['two-more-causes', 'patient-first']),
      grammar: true,
    },
    practice(
      'Now interpret changing return and patient signals',
      'case',
      'Read the current observations before choosing what to do. Consider the suction path, position and patient tolerance; more fluid is not an automatic next action.',
    ),
    check('check', 'Interpret low return'),
    debrief(['common-errors', 'protocol']),
    check('transfer', 'Respond when the patient’s tolerance changes'),
  ],
  'protected-accessories': [
    teach(
      'instrument-state',
      'Locate the accessory and its protection',
      ['one-channel', 'team-signals', 'where-it-sits'],
      'section',
    ),
    teach('exchange', 'Follow a protected exchange', [
      'brush-exchange-worked',
      'forceps-short-supported',
      'en-bloc',
      'needle-rule',
    ]),
    {
      ...practice(
        'Now manage the accessory states',
        'skill',
        'Watch the protected exchange, then use the instrument state and controls to manage it yourself. Protect the accessory before the next movement and verify its state.',
      ),
      demonstration: [
        {
          command: { type: 'accessory-move', to: 'in-channel' },
          caption: 'The protected brush enters the channel. The brush remains sheathed.',
        },
        {
          command: { type: 'accessory-move', to: 'extended' },
          caption: 'Advance the protected tip beyond the channel before exposing the brush.',
        },
        {
          command: { type: 'accessory', state: 'brush-exposed' },
          caption:
            'The brush is now exposed beyond the channel. Its position and protection are separate states.',
        },
        {
          command: { type: 'accessory', state: 'brush-sheathed' },
          caption:
            'The operator commands the sheath back over the bristles, and the assistant reports it done. A command and a report, not yet a state.',
        },
        {
          command: { type: 'verify-accessory' },
          caption:
            'Checked against the image, the report does not hold: the bristles are still out, so nothing moves through the channel yet.',
        },
        {
          command: { type: 'accessory', state: 'brush-sheathed' },
          caption:
            'The operator commands the sheath again. This time the model shows the bristles covered.',
        },
        {
          command: { type: 'verify-accessory' },
          caption:
            'Checked against the image a second time: the brush is inside its sheath, and only now may it move.',
        },
        {
          command: { type: 'accessory-move', to: 'in-channel' },
          caption:
            'The protected brush returns into the channel. This playback is the example, not your own attempt.',
        },
      ],
    },
    check('check', 'Interpret the accessory’s position'),
    debrief(['common-errors']),
    check('transfer', 'Manage a changed accessory situation'),
  ],
  'specimen-pathway': [
    teach('question-to-lab', 'Connect the clinical question to the specimen', [
      'a-sample-leaves-the-room',
      'what-travels',
      'plan-from-the-question',
      'container-before-sample',
    ]),
    teach(
      'identity',
      'Follow identity, site and handling to the laboratory',
      ['identity-site-handling', 'what-a-result-can-say', 'quality-travels-with-the-result'],
      'sort-example',
    ),
    practice(
      'Build a specimen plan from the available options',
      'case',
      'Match each specimen task to the clinical question and the handling it requires. Keep unresolved laboratory policy explicit.',
    ),
    check('check', 'Choose handling for a specimen'),
    debrief(['common-errors']),
    check('transfer', 'Interpret what another specimen can establish'),
  ],
  deterioration: [
    teach(
      'baseline',
      'Establish the patient’s baseline',
      ['breathing-changes', 'what-can-change', 'inspection-to-plan'],
      'baseline',
    ),
    teach('priorities', 'Work through a change in breathing', [
      'response-bundle',
      'causes-and-escalation',
      'before-resuming',
    ]),
    practice(
      'Now respond to the changing patient',
      'case',
      'Compare the current observations with the baseline. Pause to interpret them, then choose the next action. Unsafe choices receive immediate feedback.',
    ),
    check('check', 'Interpret a change during inspection'),
    debrief(['common-errors', 'institution-supplies']),
    check('transfer', 'Apply the priorities in another situation'),
  ],
  'bleeding-priorities': [
    hook('Blood fills the view'),
    check('check', 'What matters most?'),
    screen('threat', 'Why a small bleed matters', 'Read why the first moves are what they are.', [
      'the-threat',
    ]),
    screen(
      'first-moves',
      'The first moves, in order',
      'Learn the card. You will use it on the patient who follows.',
      ['first-moves'],
    ),
    screen('escalation', 'When the first moves fail', 'Read what comes after the card.', [
      'escalation',
    ]),
    practice(
      'One patient, four decisions',
      'case',
      'Read the monitor, then decide. A move that makes things worse plays out, then you decide again.',
    ),
    screen('grade', 'Grade the bleed', 'Four grades, by what it took to stop the bleeding.', [
      'nashville',
    ]),
    check('transfer', 'Grade a different bleed'),
    close(['common-errors']),
  ],
  'scope-in-a-tube': [
    teach(
      'geometry',
      'Separate available area from ventilation',
      [
        'one-tube',
        'what-the-team-can-read',
        'steady-procedure',
        'space-worked',
        'fitting-is-not-ventilating',
      ],
      'tube-geometry',
    ),
    practice(
      'Inspect the scope and tube geometry',
      'skill',
      'Use the scope and cross-sectional views to inspect available area. The readout describes ideal-circle geometry; it does not select a device or predict ventilation.',
    ),
    {
      id: 'changed-tube',
      title: 'Compare a changed tube geometry',
      kind: 'observe',
      presentation: 'skill',
      blocks: [],
      visual: 'none',
      instruction:
        'The authored tube size changes for this comparison. Read the available-area display and complete the observation goals.',
    },
    check('check', 'Interpret the geometry’s clinical limit'),
    debrief(['plan-before', 'when-ventilation-worsens', 'common-errors']),
    check('transfer', 'Respond to changed ventilation'),
  ],
  'icu-physiology': [
    teach(
      'baseline',
      'Read the ventilator and the patient together',
      ['inside-the-breath', 'ventilator-signals', 'breath-at-baseline', 'what-ends-the-breath'],
      'baseline',
    ),
    check('check', 'Explain the pressure-control breath'),
    teach(
      'procedure-purpose',
      'Connect the compartment, tool and guidance',
      ['compartment-and-guidance', 'own-training'],
      'sort-example',
    ),
    practice(
      'Match procedures to their targets',
      'case',
      'Match each procedure to the compartment and guidance described. This exercise does not teach the technique of the advanced procedures.',
    ),
    debrief(['fluoroscopy-principles', 'radiation-and-staff', 'common-errors']),
    check('transfer', 'Interpret changed resistance during a breath'),
  ],
  'honest-report': [
    teach('record', 'Write from the examination record', [
      'what-a-report-is-for',
      'what-the-report-rests-on',
      'uncomplicated-report',
      'four-states',
    ]),
    teach('worked-report', 'Follow a report from evidence to statement', [
      'template-line-by-line',
      'describe-what-was-done',
    ]),
    practice(
      'Build the report for the written case',
      'report',
      'Read the written case evidence beside each report field and choose a statement it supports. An airway entered is not automatically an airway inspected.',
    ),
    {
      ...practice(
        'Use your findings to build the report',
        'report',
        'Now use your own available survey record. Preserve any limitation or missing evidence; do not fill a normal template from memory.',
      ),
      id: 'your-record',
      learnerRecord: true,
    },
    check('check', 'Decide what the entry approach supports'),
    teach('handoff', 'Close the procedure and arrange follow-up', [
      'ending-and-handoff',
      'recovery-and-results',
    ]),
    debrief(['common-errors']),
    check('transfer', 'Report a changed examination'),
  ],
  'what-completion-means': [
    teach('evidence', 'Understand what your record can establish', [
      'records-in-a-file',
      'this-fellows-file',
      'four-records',
      'where-this-course-sits',
    ]),
    practice(
      'Distinguish the kinds of learning evidence',
      'case',
      'Match each evidence statement to the claim it can support. Keep online participation, saved answers, physical skill and supervised clinical performance separate.',
    ),
    check('check', 'Interpret a learner’s available evidence'),
    teach('supervised-next', 'Turn feedback into a next practice objective', [
      'manual-tools',
      'what-evidence-shows',
      'next-objective',
    ]),
    debrief(['common-errors']),
    check('transfer', 'Recognize the limits of transfer'),
  ],
}

export function activityForChunk(chunk: CourseChunk): CourseActivity {
  return chunk.kind === 'teach'
    ? 'teaching'
    : chunk.kind === 'debrief'
      ? 'debrief'
      : chunk.kind === 'check' || chunk.kind === 'transfer'
        ? 'independent-check'
        : 'guided-practice'
}
