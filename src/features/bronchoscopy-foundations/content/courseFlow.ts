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
  | 'shared-airway'
  | 'baseline'
  | 'sequence'
  | 'sort-example'
  | 'worked-decision'
  | 'tube-geometry'
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

/** This maps presentations only. The canonical section registry still owns course order. */
export const COURSE_FLOWS: Partial<Readonly<Record<BronchSectionId, readonly CourseChunk[]>>> = {
  'shared-airway': [
    teach(
      'purpose',
      'The patient, the team and the airway',
      ['two-sources', 'what-is-available', 'stable-examination'],
      'shared-airway',
    ),
    teach('worked-safety', 'Consider the picture and the patient together', [
      'the-scope-shares-the-airway',
      'five-questions-worked',
    ]),
    check('check', 'Choose the next priority'),
    practice(
      'Connect each observation to its question',
      'case',
      'Match each statement to the question it answers. Keep a procedural observation separate from a result that could change management.',
    ),
    debrief(['common-errors', 'capabilities']),
    check('transfer', 'Reassess the patient in recovery'),
  ],
  'clinical-question': [
    teach('purpose', 'What should the procedure contribute?', [
      'a-request-arrives',
      'in-front-of-you',
      'question-before-instrument',
      'two-questions',
    ]),
    teach(
      'worked-plan',
      'Compare a request with a procedural plan',
      ['noninvasive-first', 'four-box-worked'],
      'sort-example',
    ),
    practice(
      'Match the question to a pathway',
      'case',
      'For each request, select the pathway its facts support. A missing fact stays unresolved until it is clarified.',
    ),
    teach('planning', 'Account for the patient and the proposed procedure', [
      'what-changes-the-plan',
      'risk-and-sedation',
      'antithrombotic-decision',
    ]),
    teach('team', 'Confirm the plan with the patient and team', [
      'consent-conversation',
      'time-out',
    ]),
    check('check', 'Choose a plan for this request'),
    debrief(['common-errors']),
    check('transfer', 'Identify a gap in another request'),
  ],
  'pre-use-check': [
    teach('instrument', 'Meet the bronchoscope', ['what-ready-means'], 'instrument'),
    teach(
      'readiness',
      'Follow a ready scope through its systems',
      ['ready-scope', 'suction-is-a-path', 'scene-worked'],
      'worked-decision',
    ),
    practice(
      'Locate the parts and their functions',
      'illustrated',
      'Identify the marked parts in the photographs. The instrument overview introduced their names; now inspect without its labels.',
    ),
    check('check', 'Localize a readiness problem'),
    teach('release', 'Decide whether the instrument is ready for use', [
      'two-diameters',
      'released-not-clean',
      'reprocessing-program',
    ]),
    debrief(['common-errors']),
    check('transfer', 'Consider a changed readiness case'),
  ],
  'right-side': [
    teach(
      'normal-tour',
      'Follow the right-sided airways',
      ['short-right-main', 'what-names-an-airway', 'right-side-in-order'],
      'tour',
    ),
    teach(
      'parentage',
      'Return to the parent airway',
      ['beyond-and-back', 'two-parents', 'grouping-not-division'],
      'tour',
    ),
    practice(
      'Now navigate the right side',
      'inspection',
      'Use the scope controls to follow the named airways. Keep the endoscopic view in sight; use the map to check parentage when needed.',
    ),
    {
      id: 'changed-view',
      title: 'Inspect with less assistance',
      kind: 'observe',
      presentation: 'inspection',
      blocks: [],
      visual: 'none',
      instruction:
        'The scope starts at the authored changed view. Use the visible landmarks and complete the goals below.',
    },
    check('check', 'Identify an airway from its parent'),
    debrief(['common-errors', 'missing-branch']),
    check('transfer', 'Interpret another right-sided view'),
  ],
  'sedation-and-monitoring': [
    teach(
      'monitoring',
      'Establish what each patient signal reports',
      ['different-purposes', 'depth-is-the-response', 'monitoring-continuous'],
      'baseline',
    ),
    teach('medication-record', 'Read the anesthetic record as a team', [
      'medicine-and-count',
      'what-the-team-has',
      'reconciled-record',
      'arithmetic-worked',
    ]),
    practice(
      'Account for the documented administrations',
      'case',
      'Calculate each measured administration in the ledger. Preserve any unknown amount; the record cannot supply a safe or remaining dose.',
    ),
    check('check', 'Decide what the medication record supports'),
    debrief(['medication-events', 'common-errors', 'local-policy']),
    check('transfer', 'Interpret a change in responsiveness'),
  ],
  'branch-entry': [
    teach(
      'reference',
      'Start with a named opening',
      ['carina-and-back', 'what-to-watch', 'controlled-entry'],
      'tour',
    ),
    teach('worked-entry', 'Follow an entry and return to the carina', [
      'entry-sequence-worked',
      'where-the-turn-goes',
    ]),
    practice(
      'Now enter each main bronchus',
      'inspection',
      'Reach the main carina, enter the right main bronchus, withdraw to the trachea, and enter the left. Establish a visible open lumen before advancing.',
    ),
    teach('hold', 'Keep the view stable during another task', ['holding-the-view']),
    {
      id: 'hold-view',
      title: 'Hold the carina view through an interruption',
      kind: 'observe',
      presentation: 'inspection',
      blocks: [],
      visual: 'none',
      instruction:
        'The scope starts above the carina. Acknowledge the assistant and capture an image while maintaining depth and avoiding wall contact.',
    },
    check('check', 'Interpret a movement that does not reach the tip'),
    debrief(['common-errors']),
    check('transfer', 'Consider withdrawal from an angled bronchus'),
  ],
  'reference-frames': [
    teach(
      'viewpoints',
      'Compare anatomy with camera orientation',
      [
        'which-airway',
        'on-hand-at-the-scope',
        'trachea-to-bronchus-intermedius',
        'one-airway-three-frames',
      ],
      'tour',
    ),
    teach(
      'ct-display',
      'Read the orientation of the CT display',
      ['how-each-display-is-made', 'tracing-the-right-side'],
      'section',
    ),
    practice(
      'Identify the structure in each representation',
      'illustrated',
      'Use parent–daughter continuity and the displayed orientation, then name each outlined structure. These are supported teaching views, not a registered matched study.',
    ),
    check('check', 'Interpret a camera orientation'),
    debrief(['common-errors']),
    check('transfer', 'Interpret a changed viewing direction'),
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
    teach(
      'tour',
      'Inspect the larynx before entry',
      ['before-the-trachea', 'in-view-above', 'normal-laryngeal-examination'],
      'section',
    ),
    teach('entry', 'Follow entry under vision', [
      'crossing-on-the-opening',
      'darkness-above-the-glottis',
      'mouth-or-nose',
      'where-to-look',
    ]),
    practice(
      'Now observe opening and enter',
      'inspection',
      'Watch the authored vocal-fold cycle. Use the controls to cross under vision while the opening permits entry; contact and closed-fold attempts do not establish safe entry.',
    ),
    check('check', 'Identify the structures in view'),
    debrief(['common-errors', 'entry-and-withdrawal']),
    check('transfer', 'Interpret what a different entry permits'),
  ],
  'left-side': [
    teach(
      'tour',
      'Follow the left-sided airways',
      ['naming-the-left', 'what-you-have', 'usual-left-side', 'left-names'],
      'tour',
    ),
    teach(
      'parentage',
      'Move from lingula to lower lobe',
      ['lingula-to-lower-lobe', 'basal-convention', 'basal-relationships'],
      'tour',
    ),
    practice(
      'Now navigate the left side',
      'inspection',
      'Follow the left upper lobe, lingular and lower lobe relationships. Use full names and the declared combined basal convention to interpret each opening.',
    ),
    check('check', 'Identify a left-sided branch'),
    debrief(['common-errors']),
    check('transfer', 'Interpret another left-sided view'),
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
          caption: 'Resheath the brush before bringing it back into the channel.',
        },
        {
          command: { type: 'verify-accessory' },
          caption: 'Verify the protected state before withdrawal.',
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
    teach(
      'baseline',
      'Read the context when blood appears',
      ['blood-after-a-sample', 'what-to-read', 'expected-after-biopsy'],
      'baseline',
    ),
    teach('position-and-priorities', 'Compare a contained bleed with central airway flooding', [
      'what-the-scope-is-doing',
      'breathing-before-circulation',
      'first-moves-worked',
      'suction-has-a-purpose',
    ]),
    practice(
      'Now choose the priority in each bleeding state',
      'case',
      'Read the current bleeding state and what the scope position is doing. Choose an action for that context; routine view-loss recovery is not a universal bleeding response.',
    ),
    check('check', 'Interpret the purpose of the current position'),
    debrief(['temporary-control', 'your-bleeding-response', 'common-errors']),
    check('transfer', 'Distinguish red views in different contexts'),
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
