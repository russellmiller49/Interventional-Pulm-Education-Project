import type { ScopeViewSpec } from '../../components/scope/types'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M09 — Left-sided anatomy and explicit variants. The learner names left-sided lobes and segments
 * from their parent airway rather than from a segment number, a count of openings or a screen
 * position, walks the lingula to the lower lobe from a rotated start (drill D07), and records the
 * declared combined LB7+8 convention (drill D08). Knowledge spec §6.4–§6.7 and §11.6–§11.7
 * (S1 PDF 63, 65–70; S2 PDF 46–47, 103, 106, 159–160; T11).
 */

/** The rotated left-sided walk: shown at Recognize (controls locked) and driven at Act. */
const LEFT_WALK: ScopeViewSpec = {
  sectionId: 'left-side',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'LMSB', at: 'mid' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect'],
  assists: {
    'centerline-lock': true,
    'aim-guard': true,
    'branch-labels': false,
    'align-to-branch': false,
    'reference-orientation': false,
    recenter: false,
    'teleport-to-start': false,
  },
  // An authored camera roll, so the view starts away from any upright picture (drill D07).
  defaults: { rotationDeg: 120, branchLabels: false },
  litAirways: ['LMSB', 'LUL', 'LLL'],
  boundary:
    'An authored teaching model with one declared anatomy profile. The image starts rotated on purpose, and the centerline-guided walk is recorded as assisted.',
}

export const section: BronchSectionDefinition = {
  id: 'left-side',
  title: 'The left airways',
  shortTitle: 'Left side',
  minutes: 10,
  moduleIds: ['M09'],
  objectives: [
    {
      objectiveId: 'M09-O1',
      subtask:
        'From a rotated start in the left main bronchus, enters the lingular division without entering the upper division, then withdraws to the left main bronchus and enters LB6 without entering a basal branch.',
      evidence: 'simulated-navigation',
    },
    {
      objectiveId: 'M09-O2',
      subtask:
        'Commits the name of left B4 against the right side’s name for the same number, before the section’s naming block opens at Explain.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M09-O3',
      subtask:
        'Walks LB4, LB5 and then LB6, retracing to the left main bronchial division between the lingula and the lower lobe; the hand skill itself needs faculty observation.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M09-O4',
      subtask:
        'Decides, in a practice case, what the record says when a checklist expects a separate LB7 on a combined LB7+8 profile.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M09-O5',
      subtask:
        'Commits the next move before naming the basal bronchi of the left lower lobe after the shaft has been turned, when a count or a screen order offers a name.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D07', 'D08'],
  prerequisites: ['branch-entry', 'reference-frames', 'view-loss', 'right-side'],

  clinicalQuestion:
    'On the left side, how do you know which lobe an opening belongs to, and what that lobe’s segments are called?',
  recognizeTitle: 'The left main bronchus in a rotated image',
  objective:
    'Distinguish the left upper lobe’s divisions from the left lower lobe, and name the left-sided segments, in an image that is not upright.',
  why: 'On the left, a lobe or segment name decides where a sample, a photograph or a line of the report belongs, and a mistaken name sends each of them to another segment.',
  newConcept:
    'A segment number does not imply the same name on both sides: left B4 and B5 are the superior and inferior lingular segments because their parent is the lingula, a division of the left upper lobe, while right B4 and B5 are the middle lobe’s lateral and medial segments. LB6 belongs to the left lower lobe.',
  incrementSentence:
    'This section adds one idea to the right side: the same segment number can carry a different name on the left, because the parent is different.',
  harmfulReflex:
    'Naming a left-sided opening from what the view offers — the count of openings, its place on the screen or the right side’s name for its number — and advancing on that name instead of retracing to the parent.',
  anchor: {
    analogy:
      'Street addresses again: the parent airway is the street and the segment number the house. House four on the lingula’s street is not house four on the middle lobe’s, and you know the street by the turns you took, not by where the door appears in the window.',
    precise:
      'Left B4 is the superior and left B5 the inferior lingular segment, both in the lingula of the left upper lobe; LB6 is the superior segment of the left lower lobe. A branch’s origin is stronger evidence than the number of openings at its end or where they sit on the screen.',
    checklistLabel: 'Before naming a left-sided opening',
    checklist: [
      'Name the parent: upper division, lingula or lower lobe',
      'Retrace to the left main bronchial division if the parent is uncertain',
      'Read the segment name from its parent, not from the right side',
      'State the basal convention: one combined LB7+8 in this profile',
    ],
  },

  // The 'segmental' stop names left B4 and B5, which the prediction asks for; it stays off this
  // section until the host confirms spine stops open only after the commitment.
  spineStops: ['lobar'],
  grammarRowIds: ['clear-but-lost', 'missing-expected-branch'],
  controlStrip: {
    verdict: 'no-control-retrace',
    states: {
      insertion: 'harmful-reflex',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control names an airway. Rotation turns the image, not the anatomy; the name comes from retracing to the last certain parent, and advancing on a name you have not checked is the reflex to resist.',
  },
  precommitDenyPatterns: [
    /superior lingular/i,
    /\bLB4\b\W{1,3}superior/i,
    /\bleft B4\b[^.]{0,30}\bsuperior\b/i,
    /same (directional )?name on both sides/i,
  ],
  modelBoundary:
    'One declared teaching profile, with a combined LB7+8; patients vary, and a separate LB7 or another variant is a different profile. The walk is guided along the centerline, the starting rotation is authored for teaching, this section shows no secretions or patient movement, and nothing here shows the hand skill.',
  physicalSkillNote:
    'The walk is guided along the airway centerline and refuses an advance until the tip is aimed at a branch, so it shows the path from the lingula to the lower lobe and the parent at each step. It cannot see your hands on the control section and shaft; walking LB4, LB5 and LB6 with a real scope needs faculty observation on a model and in supervised practice.',
  localPolicyIds: [],
  reviewItemIds: ['R01', 'R06'],

  blocks: [
    {
      id: 'naming-the-left',
      kind: 'question',
      role: 'framing',
      heading: 'Naming the left side',
      body: 'The left main bronchus leads to two lobes, and the upper lobe divides again before its segments begin.\n\nThis section is about how you know which lobe you are in on the left, and what that lobe’s segments are called.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      ],
    },
    {
      id: 'what-you-have',
      kind: 'signals',
      role: 'signals',
      heading: 'What you have to go on',
      body: 'All of these are available at a left-sided opening. Before naming it, decide which of them the name rests on.',
      pointsLabel: 'Evidence at a left-sided opening',
      points: [
        'The length of the left main bronchus before it divides',
        'The airways already travelled since the main carina',
        'How many openings are ahead, and their size',
        'Where each opening sits on the screen',
        'The names already recorded for the right side',
        'The anatomy profile this model declares',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      ],
    },
    {
      id: 'usual-left-side',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A usual left side, lobe by lobe',
      body: 'The left main bronchus runs longer than the right before it divides, at the left main bronchial division, into the left upper and left lower lobe bronchi. The upper lobe bronchus then divides again, into an upper division and the lingula. The lingula is part of the left upper lobe, not a separate lobe, and neither division is itself a lobe.\n\nThat is the reference this section works from: two lobes on the left, and an upper lobe with two divisions.',
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 70 } }],
    },
    {
      id: 'left-names',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The left-sided names, by parent',
      body: 'Name the parent first, then the segment. The same number can name a different segment on each side: right B4 and B5 are the middle lobe’s lateral and medial segments, while left B4 and B5 are the lingula’s superior and inferior segments. B6 is the superior segment of the lower lobe on both sides.',
      pointsLabel: 'The left side in this teaching profile',
      points: [
        'Upper division: LB1+2 apicoposterior, often one combined origin rather than two openings, and LB3 anterior',
        'Lingula: LB4 superior lingular and LB5 inferior lingular',
        'Lower lobe: LB6 superior, which belongs to the lower lobe and not to the lingula',
        'Lower lobe basal group: LB7+8 anteromedial basal, LB9 lateral basal and LB10 posterior basal',
      ],
      media: { kind: 'endoscopic-still', structureId: 'lingula', outline: true },
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
      ],
      reviewItemIds: ['R01'],
    },
    {
      id: 'lingula-to-lower-lobe',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'Lingula to lower lobe, worked',
      body: 'The left B4–5–6 drill crosses from one lobe to another. Naming the parent at each transition is what makes the crossing visible, whatever the rotation of the image.',
      pointsLabel: 'The walk, transition by transition',
      points: [
        'Left main bronchus: the division ahead is between the upper and lower lobes. With the image rotated, their places on the screen are not those of an upright picture.',
        'Left upper lobe: it divides into the upper division and the lingula.',
        'Lingula: LB4, then LB5. Still the left upper lobe.',
        'Back to the left main bronchial division: the parent changes here, not inside the lingula.',
        'Left lower lobe, then LB6: the superior segment of the lower lobe.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
      ],
    },
    {
      id: 'basal-convention',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The left basal convention',
      body: 'The sources differ on the left anteromedial basal bronchus. The textbook lists a combined left B7/8 anteromedial branch; the training manual’s principal skills checklist lists LB8, LB9 and LB10, while its step-by-step checklist acknowledges LB7 when present. Neither is a universal human anatomy.\n\nThis course teaches one combined LB7+8. A separate LB7 belongs to a different anatomy profile, and a record states which convention it follows. A branch the declared profile does not have is not a missed branch. In a patient the anatomy decides: a separate LB7 is recognized and recorded when present, an expected branch not seen is not assumed absent, and uncertainty is recorded rather than resolved by inventing a branch. LB7 names a bronchus; it is not the subcarinal lymph-node station 7.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 146, to: 147 } },
      ],
      reviewItemIds: ['R01'],
    },
    {
      id: 'basal-relationships',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Basal relationships, not screen order',
      body: 'A lecture mnemonic orders the basal branches anterior, lateral, posterior; adding medial, with the superior segment remembered above them, gives its MALPS cue. The words describe the anatomy in the patient. They are not a fixed top-to-bottom order or a clock position on the screen, which changes whenever the scope turns.\n\nOn the left, the anterior and medial parts follow the declared LB7+8 convention, and LB6 is the lower lobe’s superior segment, not one of the basal branches.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:28:21', end: '00:30:34' } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:33:54', end: '00:34:48' } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these names a left-sided airway from something other than its parent.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Calling the lingula’s two openings the lower lobe because two openings are in view: retrace to the left main bronchial division and name the parent upper lobe.',
        'Taking the long, straight-looking left main bronchus for the lower lobe: find the division first.',
        'Carrying the right side’s names across: left B4 and B5 are superior and inferior lingular, not lateral and medial.',
        'Placing LB6 with the lingula because the drill groups them: LB6 is the lower lobe’s superior segment.',
        'Filling a separate LB7 line on a combined profile, or calling it missed: record the declared convention.',
        'Reading the basal branches off the screen in a fixed order: set the image against landmarks first.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 66, to: 70 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
        { sourceId: 'T11', location: { kind: 'time-span', start: '00:28:21', end: '00:30:34' } },
      ],
    },
  ],

  workspace: { kind: 'scope', view: LEFT_WALK },

  steps: {
    recognize: {
      instruction:
        'Look at the bronchoscope view in the Simulator panel: the scope is in the left main bronchus and the image is rotated. Note what you can see ahead before naming anything.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.scopeView },
    },
    act: {
      title: 'From the lingula to the lower lobe',
      instruction:
        'Meet the goals on this card with the scope controls under the view, starting from the rotated image. After each entry, check the lobe you named against the parentage in the readouts under the controls.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.controls,
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.goals,
      },
    },
    explain: {
      title: 'The left side, explained',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and “The left-sided names, by parent” in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'scope-lab',
    // The walk the learner drives: a reset, so a goal broken by an off-path entry can be started
    // again, and the parentage readout, against which the lobe named aloud is checked.
    view: {
      ...LEFT_WALK,
      controls: ['advance', 'withdraw', 'rotate', 'deflect', 'reset'],
      readouts: ['parentage'],
    },
    goals: [
      {
        id: 'lingular-division',
        label:
          'Enter LB4+5, the lingular division, without entering the upper division. Before you enter, say which lobe it belongs to.',
        test: {
          type: 'all',
          tests: [
            { type: 'event-sequence', events: ['entered:LUL', 'entered:LB4+5'] },
            { type: 'without', event: 'entered:LUL-UD' },
          ],
        },
      },
      {
        id: 'lingular-segments',
        label:
          'Enter LB4, the superior lingular segment, then LB5, the inferior lingular segment, withdrawing into the lingular division between them.',
        test: {
          type: 'event-sequence',
          events: ['entered:LB4', 'withdrew-to:LB4+5', 'entered:LB5'],
        },
      },
      {
        id: 'retrace',
        label: 'Withdraw from LB5 into the left main bronchus.',
        test: { type: 'event-sequence', events: ['entered:LB5', 'withdrew-to:LMSB'] },
      },
      {
        id: 'superior-segment',
        label:
          'Enter LB6 without entering a basal branch. Before you enter, say which lobe LB6 belongs to and which lobe you have left.',
        test: {
          type: 'all',
          tests: [
            {
              type: 'event-sequence',
              events: ['entered:LB5', 'withdrew-to:LMSB', 'entered:LLL', 'entered:LB6'],
            },
            { type: 'without', event: 'entered:LB7+8' },
            { type: 'without', event: 'entered:LB9' },
            { type: 'without', event: 'entered:LB10' },
          ],
        },
      },
    ],
  },

  prediction: {
    id: 'Q02',
    seedId: 'Q02',
    itemType: 'signal-recognition',
    situation:
      'The right-sided survey is finished and recorded, including RB4 lateral and RB5 medial. The scope is now in the left main bronchus, and the next line of the record is for LB4.',
    stem: 'What name goes on that line?',
    choices: [
      {
        id: 'a',
        label: 'Lateral lingular',
        rationale:
          'Lateral is right B4’s name, and it comes from the middle lobe, not from the number. Left B4 arises in the lingula, whose two segments are named superior and inferior.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Superior lingular',
        rationale:
          'Left B4 arises in the lingula, a division of the left upper lobe, and is its superior segment. The number is shared with the right side; the parent, and so the name, is not.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Inferior lingular',
        rationale:
          'Inferior lingular is LB5, the lingula’s other segment. Swapping the pair files the superior segment’s description, photograph or sample under the inferior one.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Medial lingular',
        rationale:
          'Medial is the name of right B5, not B4, and it belongs to the middle lobe. The lingula has no medial segment; its two segments are superior and inferior.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A segment’s name is read from its parent, and the parents differ: right B4 and B5 are the lateral and medial segments of the middle lobe, while LB4 superior lingular and LB5 inferior lingular are the segments of the lingula, a division of the left upper lobe. The number does not imply the same directional name on both sides. LB6 is also named superior, but it is the superior segment of the left lower lobe, not of the lingula.',
    objectiveIds: ['M09-O2'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65, to: 67 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106 } },
    ],
    reviewItemIds: ['R01'],
  },

  transfer: {
    id: 'left-side-transfer',
    itemType: 'management-decision',
    situation:
      'Later in the same survey, LB6 has been entered and recorded, and the scope is back in the left lower lobe bronchus with three basal openings in view. The shaft was turned to reach LB6, and the trainee is about to name the three for the record.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label:
          'Count the openings along the lower lobe bronchus and name them LB7+8, LB9 and LB10 in that order',
        rationale:
          'A count gives the number of openings, not their direction or their parent. The basal group is an educational grouping rather than one division with a fixed order, so numbering the openings as they come into view does not identify them.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label:
          'Name them anterior, lateral and posterior from the top of the screen downward, as the mnemonic lists them',
        rationale:
          'The mnemonic names relationships in the patient, not rows on the screen. Read from the top of a turned image, it gives each name to whichever opening happens to sit highest.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label:
          'Set the patient’s directions from landmarks and the airways already travelled, then name them',
        rationale:
          'Camera roll changes where the openings sit, not which bronchus each is. Landmarks and the path from the lower lobe bronchus fix the patient’s directions, and the anterior, lateral and posterior relationships then name the branches.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'Advance into the opening lowest on the screen as the posterior basal, and confirm the name from inside it',
        rationale:
          'This advances on a name taken from the screen. Inside one segment the neighboring origins are out of view, so the name cannot be checked there, and a description or sample goes on under a name nobody established.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'Camera roll moves every opening on the screen without changing which bronchus it is, so a screen order no longer identifies a branch once the image turns, and a count gives a number, not a direction. The anterior–lateral–posterior mnemonic describes the basal branches in the patient; on the left, the anteromedial branch follows the declared LB7+8 convention. Set the image against landmarks and the path already travelled, and name each branch before entering it.',
    objectiveIds: ['M09-O5'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:28:21', end: '00:30:34' } },
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:33:54', end: '00:34:48' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
    ],
    transferVariant:
      'A different airway later in the survey: the lower lobe’s basal branches after the shaft was turned to reach LB6, where the prediction named a lingular segment. The misleading cues are now a count and a screen order rather than a segment number, and the name still comes from the patient’s anatomy and the path travelled.',
    retrievesFrom: 'reference-frames',
  },

  practice: [
    {
      id: 'mc-lb7-8-convention',
      presentationTitle: 'An empty checklist line in the left lower lobe',
      situation:
        'A trainee finishes the left lower lobe of the teaching model: the superior segment, one anteromedial basal opening, then the lateral and posterior basal openings. The inspection checklist in use lists LB7 and LB8 on separate lines, and the LB7 line is still empty.',
      item: {
        id: 'mc-lb7-8-convention',
        itemType: 'management-decision',
        stem: 'What should the record say about the empty line?',
        choices: [
          {
            id: 'a',
            label:
              'LB7+8 recorded as one anteromedial basal bronchus, under the convention the model declares',
            rationale:
              'The model declares one combined anteromedial basal bronchus, LB7+8. Recording that name and the convention lets anyone reading the record against a separate-LB7 profile see why there is no LB7 line.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'LB7 marked as missed, so the left lower lobe stays incomplete until a separate opening is found',
            rationale:
              'On this model a branch absent from the declared profile is not a missed branch, and keeping the lobe incomplete until one appears invites inventing it. In a patient the anatomy decides, and a separate LB7 is recorded when present.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label:
              'The medial part of the anteromedial opening labeled LB7, so that the checklist has no empty line',
            rationale:
              'This manufactures a bronchus to complete a list. A record that names a bronchus nobody identified misleads anyone who later samples or compares by that name.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'LB7 marked not applicable on this model',
            rationale:
              'Not applicable is true for this model, but a bare mark does not say why. Without the convention named, the record cannot be read against a separate-LB7 profile or a patient whose anatomy differs.',
            plausibility: 'reasonable-but-incomplete',
          },
        ],
        explanation:
          'The sources differ on the left anteromedial basal bronchus, and this course’s profile declares one combined LB7+8; a separate LB7 belongs to a different profile. The record names the convention it follows. It does not fill a line by inventing a branch, and it does not count a branch absent from the declared profile as missed.',
        objectiveIds: ['M09-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 63 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 67, to: 70 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 103 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 106 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 159, to: 160 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46, to: 47 } },
        ],
        reviewItemIds: ['R01', 'R06'],
      },
    },
  ],
}
