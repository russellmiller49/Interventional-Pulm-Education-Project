import type { AirwayLabel, ScopeGoalTest } from '../../components/scope/types'
import type { BronchSectionDefinition } from '../types'

/**
 * The systematic survey (rewrite, brief 9). The fellow watches one whole survey on the annotated
 * video, learns the fixed order, the presumed normal side first and the three statuses, and then
 * surveys the whole tree in the simulator, both lungs, recording every segment as seen, not seen
 * or not reachable. One segment, RB10, is narrowed so that "not reachable" has a use.
 *
 * The record's three words are this view's own (`ledger.record`); the rules for when a status may
 * be recorded are the simulator's. Sources: the course textbook's anatomy and inspection chapters
 * (S1) and the training manual's inspection pages (S2).
 */
const INSPECTION = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 101, to: 107 } },
] as const
const RECORD = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
  { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 163 } },
] as const

const RIGHT_SEEN = ['RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6', 'RB7', 'RB8', 'RB9'] as const
const LEFT_SEEN = ['LB1+2', 'LB3', 'LB4', 'LB5', 'LB6', 'LB7+8', 'LB9', 'LB10'] as const
const seen = (airways: readonly AirwayLabel[]): ScopeGoalTest => ({
  type: 'all',
  tests: airways.map((airway) => ({ type: 'ledger', airway, status: 'inspected' })),
})

export const section: BronchSectionDefinition = {
  id: 'systematic-survey',
  authoringContract: 2,
  title: 'The systematic survey',
  shortTitle: 'Survey',
  minutes: 11,
  activityMinutes: 7,
  moduleIds: ['M10'],
  objectives: [
    {
      objectiveId: 'M10-O1',
      subtask: 'Surveys every segment of both lungs in the simulator, in one order.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M10-O2',
      subtask: 'Decides what to do about a segment that was entered and not seen.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M10-O3',
      subtask: 'Comes back to the parent view after each segment before entering the next.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M10-O4',
      subtask: 'Records a narrowed segment and a survey that had to stop early.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M10-O5',
      subtask: 'Leaves no segment without a status at the end of the survey.',
      evidence: 'simulated-navigation',
    },
  ],
  drillIds: ['D08', 'D14'],
  prerequisites: ['right-side', 'left-side'],

  clinicalQuestion: 'How do you know you have looked at every airway?',
  objective: 'Survey every segment in the same order each time, and record what you saw.',
  harmfulReflex:
    'Calling a segment seen when you have not seen it, or forcing the scope in to make it so.',
  harmfulReflexPatterns: [/\bas seen\b/i, /\bforc/i, /\bpush/i],
  anchor: {
    analogy:
      'A pilot walks round the aircraft in the same order before every flight. The order is not about this aircraft. It is how nothing gets skipped on the day there is a fault.',
    precise:
      'Survey the whole tree in one fixed order, the presumed normal side first, and give every segment a status: seen, not seen or not reachable.',
    checklistLabel: 'Surveying the airways',
    checklist: [
      'Same order every time',
      'Presumed normal side first',
      'Each segment: in, look, and look again on the way out',
      'Every segment gets a status',
    ],
  },
  outcomes: [
    {
      id: 'survey-every-segment',
      text: 'Survey every segment of both lungs in one fixed order.',
    },
    {
      id: 'record-each-segment',
      text: 'Give every segment a status: seen, not seen or not reachable.',
    },
  ],

  spineStops: ['lobar', 'segmental'],
  grammarRowIds: ['missing-expected-branch', 'lens-obscured'],
  precommitDenyPatterns: [/\bis not seeing\b/i, /\bsays not seen\b/i],
  localPolicyIds: [],
  reviewItemIds: ['R06'],

  blocks: [
    {
      id: 'same-order',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'One order, every time',
      body: 'Pick one order and do not change it. The video shows one: larynx, trachea, carina, the right lung from the top down, back to the carina, then the left lung.\n\nA fixed order is how you notice the segment you missed. Any order works if it is always the same.',
      claimClass: 'source',
      sourceRefs: INSPECTION,
    },
    {
      id: 'normal-side-first',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Start on the side you expect to be normal',
      body: 'When the imaging shows disease in one lung, survey the other lung first. Blood or secretions from the abnormal side cannot then hide the normal one, and the survey is complete before you sample.\n\nKeep the order inside each lung the same.',
      claimClass: 'source',
      sourceRefs: INSPECTION,
    },
    {
      id: 'in-and-out',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Look on the way in and on the way out',
      body: 'At each segment, centre the lumen and go in far enough to see its walls. Then come back to the parent. The view on the way out is a second look.\n\nIf an opening is too narrow, do not force it. Look in from outside.',
      media: { kind: 'endoscopic-still', structureId: 'rb6', outline: true },
      claimClass: 'source',
      sourceRefs: INSPECTION,
      reviewItemIds: ['R06'],
    },
    {
      id: 'three-statuses',
      kind: 'pattern',
      role: 'mechanism',
      heading: 'Every segment gets a status',
      body: 'Entering is not seeing. A smeared lens in the right place has seen nothing.',
      pointsLabel: 'The three statuses',
      points: [
        'Seen: you were inside it, with a clear view of its walls and lumen.',
        'Not seen: you did not get that view. Say why.',
        'Not reachable: you saw the opening and could not enter it without force.',
      ],
      claimClass: 'source',
      sourceRefs: RECORD,
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Five errors to expect',
      body: 'Each one leaves the record saying more than you saw.',
      pointsLabel: 'The error, then the fix',
      points: [
        'Recording a segment as seen because the scope went in. Get the view, or record not seen.',
        'Changing the order when something interesting appears. Note it, finish, then come back.',
        'Counting three right basal openings as the whole group. RB7 often leaves early.',
        'Forcing a narrow opening to fill the record. Record it as not reachable.',
        'Leaving a line empty. An empty line reads as forgotten. Not seen is an answer.',
      ],
      claimClass: 'source',
      sourceRefs: RECORD,
      reviewItemIds: ['R06'],
    },
  ],

  workspace: {
    kind: 'scope',
    view: {
      sectionId: 'systematic-survey',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'distal' },
      controls: [],
      assists: { 'centerline-lock': true, 'aim-guard': true, 'branch-labels': true },
      defaults: { branchLabels: false },
      litAirways: [],
      boundary: 'Guided travel: the scope follows the lumen.',
    },
  },

  act: {
    kind: 'scope-lab',
    outcomeId: 'survey-every-segment',
    view: {
      sectionId: 'systematic-survey',
      mode: 'guided-walk',
      profile: 'adult-teaching-combined-left-basal-v1',
      start: { kind: 'airway', label: 'TR', at: 'distal' },
      controls: [
        'advance',
        'withdraw',
        'rotate',
        'deflect',
        'declare',
        'recenter',
        'branchLabels',
        'reset',
      ],
      assists: {
        'centerline-lock': true,
        'aim-guard': true,
        'branch-labels': true,
        recenter: true,
      },
      defaults: { branchLabels: false },
      readouts: ['currentAirway', 'parentage'],
      ledger: {
        expected: 'segmental',
        record: {
          offer: [
            { status: 'inspected', word: 'Seen' },
            { status: 'not-observed', word: 'Not seen' },
            { status: 'not-safely-accessible', word: 'Not reachable' },
          ],
          open: 'To do',
          withoutView: 'go further in before it counts as seen',
          note: 'Seen needs a clear view from inside the segment.',
        },
      },
      inaccessible: ['RB10'],
      litAirways: [],
      boundary: 'Guided travel: the scope follows the lumen. RB10 is narrowed for practice.',
    },
    goals: [
      {
        id: 'right-lung-seen',
        label: 'Right lung: enter RB1 to RB9 and record each one as seen',
        test: seen(RIGHT_SEEN),
      },
      {
        id: 'narrowed-segment',
        label: 'RB10 is narrowed: look in from its opening and record it as not reachable',
        test: {
          type: 'all',
          tests: [
            { type: 'ledger', airway: 'RB10', status: 'not-safely-accessible' },
            { type: 'without', event: 'entry-refused' },
          ],
        },
      },
      {
        id: 'left-lung-seen',
        label: 'Left lung: enter each segment, LB1+2 to LB10, and record it as seen',
        test: seen(LEFT_SEEN),
      },
    ],
  },

  prediction: {
    id: 'N07',
    itemType: 'management-decision',
    situation:
      'You enter RB4. Secretions smear the lens as you go in, and you never get a clear look at its walls. Your assistant is filling in the record and asks what to put for RB4.',
    stem: 'What do you do?',
    choices: [
      {
        id: 'a',
        label: 'Record RB4 as seen, on the strength of having entered it',
        rationale:
          'The scope was in RB4 and you saw none of it. The next reader will take that line to mean the segment was looked at.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Clear the lens, look at RB4 again, then give it a status',
        rationale:
          'You are still there and the fix takes seconds. The record should say what you saw, so go and see it.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Record RB4 as not reachable and move on to RB5',
        rationale:
          'You reached it. Not reachable is for an opening you can see and cannot enter without force.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Leave the RB4 line empty and finish the lobe first',
        rationale:
          'An empty line reads as a segment you forgot, and you will not remember why once the lobe is done.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Entering a segment is not seeing it. Clear the lens and look again. If you still cannot see its walls and lumen, the record says not seen, with the reason.',
    objectiveIds: ['M10-O2'],
    outcomeIds: ['record-each-segment'],
    claimClass: 'source',
    sourceRefs: RECORD,
  },

  transfer: {
    id: 'N08',
    itemType: 'management-decision',
    situation:
      'A 58-year-old man has a mass in the right upper lobe on CT. The left lung looks clear. You are at the carina with a good view of both main bronchi, and the plan includes a biopsy.',
    stem: 'Where do you go first?',
    choices: [
      {
        id: 'a',
        label: 'Into the right upper lobe, to biopsy while the view is clean',
        rationale:
          'Bleeding from the biopsy can then cover airways you have not yet looked at, on both sides.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'The right lung, top down, as in every other survey',
        rationale:
          'The order inside a lung stays fixed. Which lung comes first is set by where the disease is expected.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'The left lung, every segment, then the right lung',
        rationale:
          'The side you expect to be normal comes first. The mass and the biopsy come after the survey is complete.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Pause at the carina and suction both sides before choosing',
        rationale:
          'The view is already good. Suction does not tell you which side to survey first.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Survey the presumed normal side first, in your usual order, then the abnormal side. You sample last, with every other segment already on the record.',
    objectiveIds: ['M10-O1', 'M10-O3'],
    outcomeIds: ['survey-every-segment'],
    claimClass: 'source',
    sourceRefs: INSPECTION,
    transferVariant:
      'Where to begin when one lung is abnormal, where the prediction was what to do about one segment already entered.',
  },

  practice: [
    {
      id: 'mc-survey-stopped-early',
      presentationTitle: 'A survey that had to stop',
      situation:
        'You have surveyed the right lung and the left upper lobe of a 70-year-old woman. As you reach the left lower lobe she coughs hard and her SpO₂ falls to 86%. You see the lobar opening, withdraw and end the procedure.',
      item: {
        id: 'mc-survey-stopped-early',
        itemType: 'management-decision',
        stem: 'What goes on the record for LB6 to LB10?',
        choices: [
          {
            id: 'a',
            label: 'Not seen, with the reason the survey stopped',
            rationale:
              'You saw the lobar opening and none of its segments. The record says so, and says why.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Record them as seen from the lobar opening',
            rationale:
              'A patent lobar opening says nothing about the five airways beyond it. Seen means you were inside each one.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Not reachable, as the scope could not go on',
            rationale:
              'Nothing blocked the scope. The patient stopped the survey, and that is a different finding.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Nothing, as the CT of that lobe was clear',
            rationale:
              'A clear CT is a reason the gap may matter less. It is not a look, and the reader needs to know there was none.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Stopping was right. The record now has to show where the survey ended: those segments are not seen, and the reason is the desaturation.',
        objectiveIds: ['M10-O4', 'M10-O5'],
        outcomeIds: ['record-each-segment'],
        claimClass: 'source',
        sourceRefs: RECORD,
      },
    },
    {
      id: 'mc-narrowed-segment',
      presentationTitle: 'An opening the scope will not pass',
      situation:
        'In the right lower lobe you find RB10. Its opening is narrowed, and the tip stops at it. You can see a short way in from where you are.',
      item: {
        id: 'mc-narrowed-segment',
        itemType: 'management-decision',
        stem: 'What do you do?',
        choices: [
          {
            id: 'a',
            label: 'Push the tip through the narrowing to see the segment',
            rationale:
              'Force against a narrowed opening injures mucosa and can start bleeding, for a line on the record.',
            plausibility: 'unsafe',
          },
          {
            id: 'b',
            label: 'Look in from the opening and record RB10 as not reachable',
            rationale:
              'You describe what you can see from outside, and the record tells the reader the segment was not entered.',
            plausibility: 'best',
          },
          {
            id: 'c',
            label: 'Record RB10 as not seen and go on to the left lung',
            rationale:
              'You did see its opening, and you know what stopped you. Not reachable carries both facts.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Pause there and wait for the opening to widen with a breath',
            rationale:
              'A fixed narrowing does not open with breathing. Waiting adds time and nothing to the view.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A survey looks at what it can reach. When an opening will not take the scope without force, look in, record it as not reachable and describe the narrowing as a finding.',
        objectiveIds: ['M10-O4'],
        outcomeIds: ['record-each-segment'],
        claimClass: 'source',
        sourceRefs: INSPECTION,
        reviewItemIds: ['R06'],
      },
    },
  ],
}
