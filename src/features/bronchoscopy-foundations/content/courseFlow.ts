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
  | 'survey-video'
  | 'obstruction-types'
  | 'tool-states'
  | 'radiation-safety'
  | 'specimen-containers'
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
    hook('The lumen is gone'),
    check('check', 'A red screen in the trachea'),
    screen(
      'causes',
      'Five causes of a lost view',
      'Look at a usable view first, then read what replaces it.',
      ['usable-view', 'five-causes'],
    ),
    {
      ...practice('Name five lost views', 'illustrated', 'Match each lost view to its cause.'),
      id: 'name-the-cause',
      act: 'causes',
    },
    screen(
      'recovery',
      'Getting the view back',
      'Read the card in order. The still is where you end up if nothing else works.',
      ['recovery'],
      { visual: 'tour', tour: ['TR'] },
    ),
    practice(
      'Recover from a red field',
      'inspection',
      'The scope is in the trachea and the screen is red. Get the lumen back, then go on to the carina.',
    ),
    {
      ...practice(
        'Recover from a smeared lens',
        'inspection',
        'The scope is in the lower trachea and the picture is smeared. Clear the lens before you move.',
      ),
      id: 'lens',
      act: 'lens',
    },
    check('transfer', 'A sharp picture with the brush out'),
    close(['common-errors']),
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
    hook('Every airway, every time'),
    check('check', 'A smeared lens in a segment'),
    screen(
      'the-order',
      'One survey, start to finish',
      'Watch the whole survey once with the names on. Then turn them off and name each airway yourself.',
      ['same-order', 'normal-side-first'],
      { visual: 'survey-video' },
    ),
    screen(
      'the-record',
      'What each segment needs',
      'Read how to look at a segment, then the three things the record can say.',
      ['in-and-out', 'three-statuses'],
    ),
    practice(
      'Survey both lungs',
      'inspection',
      'Start above the carina. Enter each segment, and record it in the table under the controls. RB10 is narrowed.',
    ),
    check('transfer', 'A mass in the right upper lobe'),
    close(['common-errors']),
  ],
  'describe-findings': [
    hook('Something you did not expect'),
    check('check', 'A red lesion in the right main bronchus'),
    screen(
      'describe',
      'Describe before you name',
      'Read the three headings, then the three kinds of narrowing in the drawing.',
      ['three-headings', 'obstruction'],
      { visual: 'obstruction-types' },
    ),
    screen(
      'findings',
      'Findings you will meet',
      'Read each pair, then the lesion you leave alone.',
      ['findings-list', 'vascular-lesion'],
    ),
    {
      ...practice('Name six findings', 'illustrated', 'Match each description to the finding.'),
      id: 'name-the-finding',
      act: 'findings',
    },
    screen('model-report', 'A model report', 'Read the report line by line, with its notes.', [
      'model-report',
    ]),
    practice(
      'Write the report for one survey',
      'report',
      'Read what the survey showed beside each line. Choose the entry it supports.',
    ),
    check('transfer', 'A line the template filled in for you'),
    close(['common-errors']),
  ],
  'washing-and-lavage': [
    hook('A good sample, or a trap of saline'),
    check('check', 'A trap with the label already on it'),
    screen(
      'what-and-where',
      'Which procedure, and where',
      'Read the three procedures, then how to choose the segment.',
      ['three-procedures', 'site-from-ct'],
    ),
    screen(
      'technique',
      'Running the lavage',
      'Read the wedge and the numbers. You will use them in the case that follows.',
      ['wedge-and-aliquots', 'the-return'],
    ),
    practice(
      'Put a BAL in order',
      'case',
      'Seven steps of a BAL. Put them in the order you do them.',
    ),
    screen('poor-return', 'When little comes back', 'Read the four causes and the fix for each.', [
      'poor-return-causes',
    ]),
    screen('when-to-stop', 'When to stop', 'Read the rule, then what else ends a lavage.', [
      'when-to-stop',
    ]),
    {
      ...practice(
        'Run a BAL and count the return',
        'case',
        'Work out what came back from each aliquot before you choose. A move that makes things worse plays out, then you decide again.',
      ),
      id: 'run-the-bal',
      act: 'bal',
    },
    screen(
      'processing',
      'After the lavage',
      'Read where the fluid goes, and what comes after it.',
      ['processing', 'before-biopsy'],
    ),
    check('transfer', 'Secretions in the way'),
    close(['common-errors']),
  ],
  'biopsy-and-specimens': [
    hook('A tool in the channel, a pot on the trolley'),
    check('check', 'Two good pieces of a tumor'),
    screen(
      'the-tools',
      'Forceps and brush',
      'Read how a tool travels, then how to take a biopsy you can see.',
      ['through-the-channel', 'endobronchial-biopsy'],
      { visual: 'section' },
    ),
    {
      ...practice(
        'Name four tool states',
        'illustrated',
        'Six tool tips in one picture. Click the one each question asks for.',
      ),
      id: 'name-the-states',
      act: 'states',
    },
    {
      ...practice(
        'Run a brush exchange',
        'skill',
        'Watch the exchange once, then run it yourself. Your assistant’s report is not always right. Check the state before the brush moves.',
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
          caption: 'The operator commands the sheath again. This time the bristles are covered.',
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
    screen(
      'beyond-the-view',
      'The brush, and biopsy beyond the view',
      'Read the two brushes, then transbronchial biopsy.',
      ['brushes', 'transbronchial-biopsy'],
      { visual: 'tool-states' },
    ),
    screen('radiation', 'Radiation safety', 'Read the three ways to cut the dose.', ['radiation'], {
      visual: 'radiation-safety',
    }),
    screen(
      'specimens',
      'Which specimen goes where',
      'Read the container for each test.',
      ['specimen-to-test'],
      { visual: 'specimen-containers' },
    ),
    {
      ...practice('Route five specimens', 'case', 'Send each specimen to the container it needs.'),
      id: 'route-the-specimens',
      act: 'route',
    },
    check('transfer', 'A word from the assistant'),
    close(['common-errors']),
  ],
  deterioration: [
    hook('The saturation is falling'),
    check('check', 'Why is he restless?'),
    screen('opening', 'Open every event the same way', 'Read the three moves that come first.', [
      'opening-bundle',
    ]),
    screen(
      'breathing',
      'Low oxygen, and too much sedation',
      'Learn the two cards. Most events start here.',
      ['desaturation', 'oversedation'],
    ),
    screen('spasm', 'The larynx and the bronchi', 'Learn the two cards and how they differ.', [
      'laryngospasm',
      'bronchospasm',
    ]),
    screen('circulation', 'Pressure and pleura', 'Learn the two cards. One of them cannot wait.', [
      'hypotension',
      'pneumothorax',
    ]),
    screen('topical', 'When the topical drug is the cause', 'Learn the two cards.', [
      'anesthetic-toxicity',
      'methemoglobinemia',
    ]),
    practice(
      'One patient, four decisions',
      'case',
      'Read the monitor, then decide. A move that makes things worse plays out, then you decide again.',
    ),
    check('transfer', 'A different patient, a different event'),
    close(['common-errors']),
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
  'ventilated-patient': [
    hook('A scope in the breathing tube'),
    check('check', 'The scope passes'),
    screen(
      'margin',
      'The scope and the tube',
      'Read the margin a tube has to leave, and the scopes you will be handed.',
      ['the-margin'],
      { visual: 'tube-geometry' },
    ),
    {
      ...practice(
        'Pair the scope with the tube',
        'case',
        'Decide whether each pair leaves the margin.',
      ),
      id: 'pair-the-scope',
      act: 'pairs',
    },
    screen('settings', 'Before the scope goes in', 'Read the adapter, then the five settings.', [
      'swivel-adapter',
      'settings-before',
    ]),
    screen('reading', 'Read the ventilator', 'Read what each pattern means with the scope in.', [
      'peak-and-plateau',
    ]),
    screen(
      'falling',
      'When ventilation falls',
      'Learn the card, then read what suction does to the lung.',
      ['ventilation-falls', 'suction-and-recruitment'],
    ),
    practice(
      'One bronchoscopy on the ventilator',
      'case',
      'Read the ventilator, then decide. A move that makes things worse plays out, then you decide again.',
    ),
    check('transfer', 'A different mode'),
    close(['common-errors']),
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
