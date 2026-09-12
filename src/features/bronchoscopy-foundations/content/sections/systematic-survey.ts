import type { ScopeViewSpec } from '../../components/scope/types'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M10 — Systematic examination and purposeful withdrawal. The learner separates the states an
 * airway can hold in the inspection record — identified, ostium visualized, entered, inspected, not
 * safely accessible, not observed — and learns that entry is not inspection (A07, A30). Knowledge
 * spec §11 (S1 PDF 61–70; S2 PDF 46–47, 101–107, 159–163; T11) and §1 "Safety takes precedence
 * over the survey" (S1 PDF 64–65). Drills D08 (basal completeness) and D14 (complete, report,
 * return to a target). Register R06: no forced entry, no time standard.
 */
const SURVEY_AIRWAYS = ['RLL', 'RB6', 'RB7', 'RB8', 'RB9', 'RB10'] as const

const SURVEY_VIEW: ScopeViewSpec = {
  sectionId: 'systematic-survey',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'BI', at: 'distal' },
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
  readouts: ['currentAirway', 'parentage', 'ledgerSummary', 'assistsUsed'],
  ledger: { expected: SURVEY_AIRWAYS },
  inaccessible: ['RB10'],
  litAirways: SURVEY_AIRWAYS,
  boundary:
    'An assisted walk along the airway centerlines of one teaching profile, with one scripted narrowing; no mucosa, secretions or patient are drawn, so the app cannot judge the quality of any view.',
}

/**
 * The Act's view: the same walk with one scripted smear on the lens, starting at the first entry
 * into the lateral basal segment (RB9), so entering a segment and seeing it come apart inside an
 * airway the goals ask to be inspected. The Recognize workspace stays on SURVEY_VIEW, so the smear
 * is not shown before the commitment.
 */
const ACT_VIEW: ScopeViewSpec = {
  ...SURVEY_VIEW,
  controls: [
    'advance',
    'withdraw',
    'rotate',
    'deflect',
    'clearLens',
    'declare',
    'recenter',
    'branchLabels',
    'reset',
  ],
  script: 'lens-contamination',
  scriptAirway: 'RB9',
  boundary:
    'An assisted walk along the airway centerlines of one teaching profile, with one scripted narrowing and one scripted smear on the lens. The airway surface and lens smear are illustrations; no patient response or device’s lens-clearing mechanism is modeled, so the app cannot judge the quality of any view.',
}

export const section: BronchSectionDefinition = {
  id: 'systematic-survey',
  title: 'A systematic survey and its record',
  shortTitle: 'Systematic survey',
  minutes: 10,
  moduleIds: ['M10'],
  objectives: [
    {
      objectiveId: 'M10-O1',
      subtask:
        'Surveys the right lower lobe in the guided walk without avoidable omissions — each accessible airway inspected and each limitation recorded, including a medial basal segment that may arise early; the survey itself is observed by faculty on a model.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M10-O2',
      subtask:
        'Commits the status a segment may carry when the scope entered it while the lens stayed smeared, then sets each airway’s status in the inspection record during the survey.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M10-O3',
      subtask:
        'After the survey, returns to the superior segment of the right lower lobe in the guided walk, with the assists used recorded.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M10-O4',
      subtask:
        'Records a narrowed posterior basal segment as not safely accessible without forcing entry, and commits what the record says when the patient ends a survey early.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M10-O5',
      subtask:
        'Decides, in a practice case, whether a rapid narrated survey sets the standard for a complete one.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D08', 'D14'],
  prerequisites: ['right-side', 'left-side'],

  clinicalQuestion:
    'When the scope has been in or near an airway, what may the inspection record say about it?',
  recognizeTitle: 'The inspection record at the start of a survey',
  objective: 'Decide which status the inspection record may give each airway during a survey.',
  why: 'The record of a survey is part of the handoff: the next clinician reads it before planning another bronchoscopy or a sample.',
  newConcept:
    'Each airway’s status in the record is what was actually observed there — identified, ostium visualized, entered, inspected, not safely accessible or not observed — and entry is not inspection.',
  incrementSentence:
    'This section adds one idea to the right and left surveys: each airway’s status says only what was observed there, and entry is not inspection.',
  harmfulReflex:
    'Recording an airway as inspected because the scope went into it, or pushing into an airway that cannot be entered safely so that the record looks complete.',
  anchor: {
    analogy:
      'A house inspection report: walking into a room is not inspecting its wiring, and a locked room is written down as locked, not as sound.',
    precise:
      'Identified, ostium visualized, entered, inspected and not safely accessible are separate observations. Inspected means the wall, mucosa, contents and distal view were seen well enough to describe; an airway that was not seen is recorded as not observed, not as normal.',
    checklistLabel: 'Before giving an airway a status',
    checklist: [
      'Was it named from its parent?',
      'Were its wall and lumen seen clearly enough to describe?',
      'If it was not entered, was that a choice or a limit on safe entry?',
      'Does the status say what happened, and no more?',
    ],
  },

  spineStops: ['lobar', 'segmental'],
  grammarRowIds: ['missing-expected-branch', 'lens-obscured'],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control writes the record. A cleared lens and a second look can earn a status when the patient allows; pushing the scope into an airway it cannot safely enter does not.',
  },
  precommitDenyPatterns: [
    /\bnot inspected\b/i,
    /\bentry is not inspection\b/i,
    /\bentered but not\b/i,
  ],
  modelBoundary:
    'The survey here is an assisted walk along the airway centerlines of one teaching profile, with a scripted narrowing, a scripted smear on the lens and no drawn mucosa or findings. The model cannot judge whether a view was adequate, so any status you set is recorded as your declaration. It also leaves out the patient, whose signals can end a survey at any airway.',
  physicalSkillNote:
    'A survey is a hand skill. Holding a clear view, steering into a segment without wall contact when its caliber and the view allow, and inspecting on withdrawal must be observed by faculty on a model. This guided walk is assisted by a centerline lock and an aim guard, records your declarations, and cannot see your hands or judge whether a view was adequate.',
  localPolicyIds: [],
  reviewItemIds: ['R06'],

  blocks: [
    {
      id: 'what-a-survey-leaves',
      kind: 'question',
      role: 'framing',
      heading: 'What a survey leaves behind',
      body: 'A systematic survey works through the central, lobar and accessible segmental airways in a consistent order and ends in a record, airway by airway. The next clinician reads that record to know which airways were examined.\n\nDuring a survey the scope enters some airways, sees others only from their parent, and may meet one it cannot enter. This section is about what the record may say for each.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
      ],
    },
    {
      id: 'what-the-record-rests-on',
      kind: 'signals',
      role: 'signals',
      heading: 'What the record can rest on',
      body: 'A survey record is written airway by airway, against the airways the declared anatomy profile expects. These are what the operator has at hand at each airway.',
      pointsLabel: 'Available at each airway',
      points: [
        'The expected airways of the declared anatomy profile',
        'The parent airway and the branches already travelled',
        'Where the tip went and what the image showed',
        'How the patient is tolerating the examination',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 163 } },
      ],
    },
    {
      id: 'default-order',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'The default order, segment by segment',
      body: 'A default teaching order runs from the trachea and main carina to the right upper lobe, the bronchus intermedius, the right middle and lower lobes, then the left main bronchus, the left upper lobe and lingula, and the left lower lobe, with deliberate inspection on withdrawal. Another internally consistent order is acceptable, and the indication and the patient’s safety can override any order.\n\nAt each segment the operator names the parent, brings the orifice into view and looks at the wall, mucosa and contents around it. A brief entry to see the next division may help when the caliber and the patient allow; it is not a step every segment requires.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:43:45' } },
      ],
    },
    {
      id: 'separate-observations',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Separate observations, not one',
      body: 'Seeing an orifice is not entering it; entering is not inspecting its wall; and an airway the scope cannot safely enter is not normal. The record keeps these apart, airway by airway, so a reader can tell what was examined from what was only reached. A true variant — an expected branch that arises elsewhere or is absent in this patient, or an extra branch — is recorded as the anatomy actually seen, with its evidence, not as a missed or unobserved airway.',
      pointsLabel: 'The statuses in the inspection record',
      points: [
        'Identified: named from its landmarks and its parent, not from its place on the screen',
        'Ostium visualized: its orifice was seen',
        'Entered: the tip went in — a position, not an examination',
        'Inspected: the wall, mucosa, contents and distal view were seen well enough to describe',
        'Not safely accessible: it could not be entered safely — too narrow to enter without force, or unsafe to enter for another reason — and the reason is recorded',
        'Not observed: it was not seen, which is never a synonym for normal; in the procedure report, an airway the survey never reached is written as not examined',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 163 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:43:45' } },
      ],
    },
    {
      id: 'lower-lobe-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'One lower lobe, recorded',
      body: 'A left lower lobe worked through as a record, under this course’s declared profile, which combines the anteromedial basal bronchus as LB7+8.',
      pointsLabel: 'Airway, what happened, what the record says',
      points: [
        'LB6, superior: identified apart from the basal group, entered, the wall and next division seen clearly — inspected',
        'LB7+8, anteromedial basal: entered and seen clearly — inspected, under the declared combined convention',
        'LB9, lateral basal: entered while secretions smeared the lens — entered, not inspected, with the reason',
        'LB10, posterior basal: orifice seen, too narrow to enter without force — not safely accessible, with the reason',
        'A separate LB7, where present, is a variant outside the declared combined convention: recorded as what was seen, not as a missed or an extra branch',
        'Then, on request: back to LB6 directly from the lower lobe bronchus',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
      ],
    },
    {
      id: 'withdrawal-and-return',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Inspection on withdrawal, and a direct return',
      body: 'Withdrawal is a second look. Walls and orifices poorly seen on the way in can be inspected on the way out, and a segment already inspected does not need to be entered again.\n\nAfter a survey in a stable patient, the operator should be able to return directly to an indicated target, verify the site, and prepare for the planned task. That shows a usable map of the airways rather than one memorized sequence.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 101, to: 107 } },
      ],
    },
    {
      id: 'when-the-survey-yields',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When the survey should yield',
      body: 'An elective, stable patient usually benefits from a complete examination of the accessible airways before sampling that may obscure the view. Active bleeding, critical obstruction or deteriorating ventilation can make a focused intervention or withdrawal more appropriate.\n\n“Complete the survey” is not a command to continue while the patient deteriorates. A deliberate limitation documented honestly is better than an unsafe attempt to fill every line of the record.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 134, to: 144 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these writes a status the observation does not support, or chases one the airway or the patient cannot safely give.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Recording an entered airway as inspected: record what the view showed, and why it fell short.',
        'Taking three large basal openings for the whole basal group: RB7 may arise early and separately; identify each actual origin.',
        'Diving deep into one basal bronchus while the others go unseen: return to a recognizable parent view between branches.',
        'Forcing the scope into a small or narrowed bronchus to fill the record: record it as not safely accessible.',
        'Calling an expected airway absent because it was not found: an unfamiliar expected branch is not automatically absent; use the row for fewer openings than expected, under Reading the view.',
        'Treating a fast survey as a complete one: completeness means each accessible airway inspected and each limitation recorded, not elapsed time.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:43:45' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:41:46', end: '00:45:36' } },
      ],
      reviewItemIds: ['R06'],
    },
  ],

  workspace: { kind: 'scope', view: SURVEY_VIEW },

  steps: {
    recognize: {
      instruction:
        'In the Simulator panel, read the inspection record: the airways this survey expects and the status each carries now, with the same airways lit on the airway map.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.record },
    },
    act: {
      title: 'Survey the right lower lobe and record it',
      instruction:
        'In the bronchoscope view, survey the right lower lobe with the scope controls under the view, set each airway’s status with the same controls, and check it in the inspection record as you go. The goals on this card say what the survey needs.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.scopeView,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'What the record may claim',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    view: ACT_VIEW,
    goals: [
      {
        id: 'inspect-the-lobe',
        label:
          'Enter the lower lobe bronchus, RB6, RB7, RB8 and RB9, and record each as inspected once its wall and lumen are seen clearly',
        test: {
          type: 'all',
          tests: [
            { type: 'event-sequence', events: ['entered:RLL', 'declared:RLL:inspected'] },
            { type: 'event-sequence', events: ['entered:RB6', 'declared:RB6:inspected'] },
            { type: 'event-sequence', events: ['entered:RB7', 'declared:RB7:inspected'] },
            { type: 'event-sequence', events: ['entered:RB8', 'declared:RB8:inspected'] },
            { type: 'event-sequence', events: ['entered:RB9', 'declared:RB9:inspected'] },
            { type: 'ledger', airway: 'RLL', status: 'inspected' },
            { type: 'ledger', airway: 'RB6', status: 'inspected' },
            { type: 'ledger', airway: 'RB7', status: 'inspected' },
            { type: 'ledger', airway: 'RB8', status: 'inspected' },
            { type: 'ledger', airway: 'RB9', status: 'inspected' },
          ],
        },
      },
      {
        id: 'clear-the-smeared-lens',
        label:
          'When secretions smear the lens, clear it without advancing while the view is smeared',
        test: {
          type: 'all',
          tests: [
            { type: 'event-sequence', events: ['lens-contaminated', 'lens-cleared'] },
            { type: 'without', event: 'advanced-blind' },
          ],
        },
      },
      {
        id: 'record-the-posterior-basal',
        label:
          'Bring RB10 into view and record the status it allows, without advancing into the narrowing',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['ostium-visualized:RB10', 'declared:RB10:not-safely-accessible'],
            },
            { type: 'without', event: 'entry-refused' },
            { type: 'without', event: 'declared:RB10:inspected' },
          ],
        },
      },
      {
        id: 'no-airway-left-blank',
        label: 'Leave no airway in the inspection record as not observed',
        test: { type: 'ledger-complete', airways: SURVEY_AIRWAYS },
      },
      {
        id: 'return-to-the-superior-segment',
        label: 'Then, with the record complete, return to RB6, the superior segment',
        test: { type: 'event-sequence', events: ['survey-complete', 'entered:RB6'] },
      },
    ],
  },

  prediction: {
    id: 'N07',
    itemType: 'management-decision',
    situation:
      'During an elective airway inspection under moderate sedation, a fellow brings the orifice of the lateral segment of the right middle lobe (RB4) into view and steers into it. As the tip enters RB4, the patient coughs and secretions smear the lens; the fellow stops advancing, and the view stays smeared until the fellow has withdrawn to the middle lobe bronchus. No abnormality was seen in RB4.',
    stem: 'What may the inspection record say for RB4?',
    choices: [
      {
        id: 'a',
        label:
          'Inspected and normal, since the tip went into the segment and no abnormality was seen',
        rationale:
          'Going into the segment places the tip; it does not evaluate the mucosa. With the lens smeared, no abnormality was seen because nothing was seen, and writing normal turns an unexamined airway into a normal one.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Not safely accessible, since a clear view could not be held inside the segment',
        rationale:
          'Not safely accessible describes an airway the scope could not enter safely, such as a narrowed orifice. RB4 was entered; the limitation was the view, not access.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Entered but not inspected, since the lens stayed smeared throughout',
        rationale:
          'The record keeps what did happen — the orifice was seen and the segment entered — and says plainly that the wall and lumen were not evaluated, and why. The next reader knows RB4 still needs a look.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label: 'Not observed, since nothing useful was seen while the tip was inside it',
        rationale:
          'Not observed means the airway was not seen at all. RB4’s orifice was seen and the tip went in; writing not observed erases both, and a later reader cannot tell a smeared entry from an airway nobody reached.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Entering places the tip inside an airway; inspection means its wall, mucosa, contents and distal view were seen well enough to describe. The lens was smeared the whole time the tip was in RB4, so the record may say the orifice was seen and the segment entered, and must say it was not inspected, and why. “Not safely accessible” misplaces the limitation, and “inspected and normal” records an examination that did not happen. If the patient allows, a cleared lens and a second look can change the status; the record follows what is seen.',
    objectiveIds: ['M10-O2'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103, to: 107 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 163 } },
    ],
  },

  transfer: {
    id: 'N08',
    itemType: 'management-decision',
    situation:
      'Partway through an elective survey under moderate sedation, the right side has been inspected. On the left, the fellow sees the upper and lower lobe origins clearly from the left main bronchus; both look normal. The fellow then inspects the left upper lobe and lingula. The patient begins to cough continuously and oximetry falls from the patient’s own starting value, so the supervising bronchoscopist stops the survey and the scope is withdrawn. The left lower lobe segments were neither entered nor seen; the CT before the procedure showed nothing in that lobe.',
    stem: 'What may the record say about the left lower lobe?',
    choices: [
      {
        id: 'a',
        label: 'Normal, since its origin looked normal and the CT showed nothing there',
        rationale:
          'An origin that looks normal and an unremarkable CT say nothing about mucosa no one saw. Writing normal turns an unexamined lobe into a normal one — the error this record exists to prevent.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'Ostium visualized and segments not observed, since the survey stopped for the patient',
        rationale:
          'Seeing the origin from the left main bronchus visualizes the lobe’s ostium; it does not examine the bronchus or the segments beyond. Recording the segments as not observed, with the reason, keeps the gap visible for whoever plans the next look.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Lower lobe bronchus inspected and segments not observed, since its origin was seen clearly',
        rationale:
          'Seeing the lower lobe origin from the left main bronchus visualizes its ostium; the bronchus wall beyond it was never evaluated. Writing inspected claims a look at a wall no one saw, and beside a normal-looking origin it reads as a normal lobar bronchus.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Left off the record, since the survey stopped before the lobe was examined',
        rationale:
          'Leaving the lobe out hides the limitation: a reader cannot tell an unexamined lobe from a forgotten line. The expected airways stay in the record, each with its status.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The supervising bronchoscopist ended the survey for the patient; the record then says what was and was not examined. Seeing the lower lobe origin from the left main bronchus visualizes its ostium but does not inspect the bronchus or the segments beyond, and an unremarkable CT cannot stand in for mucosa no one saw. The segments, neither entered nor seen, are recorded as not observed, with the reason, so the record neither claims a normal lobe nor hides the gap.',
    objectiveIds: ['M10-O4', 'M10-O2'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
    ],
    transferVariant:
      'A safety stop instead of a smeared lens: on the other side of the tree the patient, not the view, ends the survey, and a whole lobe is seen only as far as its origin, from its parent.',
    retrievesFrom: 'shared-airway',
  },

  practice: [
    {
      id: 'mc-narrated-ninety-seconds',
      presentationTitle: 'A teaching recording of a rapid survey',
      situation:
        'A first-year fellow has watched a narrated teaching recording in which a lecturer completes the whole lower-airway survey very quickly. The fellow proposes to time every simulator survey against it and to count any slower one as incomplete. The fellow’s own last survey took longer than the recording and left the medial basal segment of the right lower lobe without a status.',
      item: {
        id: 'mc-narrated-ninety-seconds',
        itemType: 'mechanism-interpretation',
        stem: 'How should the recording’s duration bear on the fellow’s surveys?',
        choices: [
          {
            id: 'a',
            label: 'It is the target, since a slower survey is one that has missed airways',
            rationale:
              'Speed and completeness are separate. A slow survey that inspects every accessible airway and records each limitation is complete; a fast one that leaves the medial basal segment unexamined is not.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'b',
            label: 'It can be met by recording each orifice seen on the way as inspected',
            rationale:
              'This buys speed by writing an inspection that did not happen: an orifice seen is ostium visualized, not inspected. It is the shortcut a time target rewards.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'It sets no standard for now; the fellow should match it once the anatomy is familiar',
            rationale:
              'Deferring the target still makes time the eventual measure of a complete survey. Efficiency can improve with practice, but completeness is read airway by airway, and a later time target would still penalize a deliberate pause for the patient.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'It sets no standard; what is missing is an examination of the medial basal segment',
            rationale:
              'A recording’s duration depends on things not reviewed here — the original clip, any editing, the anatomy, any pathology, the scope and the clinical context — so it sets no standard for this fellow. The survey is incomplete because the medial basal segment was neither examined nor given a recorded limitation, not because it was slower.',
            plausibility: 'best',
          },
        ],
        explanation:
          'The duration of a narrated survey is not a normative standard: the original clip, any editing, the anatomy, pathology, scope and clinical context have not been reviewed, and none of them says what an examination requires. Completeness is read from the record airway by airway — each accessible airway inspected and each limitation recorded — after the anatomy is recognized, orientation held and hazards answered. Efficiency can improve with practice, but a time target must not reward a superficial examination or penalize a deliberate safety pause.',
        objectiveIds: ['M10-O5'],
        claimClass: 'review-flag',
        sourceRefs: [
          { sourceId: 'T11', location: { kind: 'time-span', start: '00:41:46', end: '00:45:36' } },
        ],
        reviewItemIds: ['R06'],
      },
    },
  ],
}
