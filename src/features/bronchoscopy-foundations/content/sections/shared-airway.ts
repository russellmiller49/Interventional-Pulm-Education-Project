import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M01 — Purpose, limits, and the shared airway. The orientation section: before any control is
 * taught, the learner separates what the airway view reports from what only the patient's own
 * signals report. Knowledge spec §1–§2 (S1 PDF 64–65, 71–83; S2 PDF 44–47; S3 PDF 80–81; T08).
 *
 * Exemplar for the section authoring guide: every later section follows this shape.
 */
export const section: BronchSectionDefinition = {
  id: 'shared-airway',
  title: 'The airway you share',
  shortTitle: 'Shared airway',
  minutes: 5,
  moduleIds: ['M01'],
  objectives: [
    {
      objectiveId: 'M01-O1',
      subtask:
        'Places a well-returned lavage and a culture that would change treatment under different questions, separating a procedural observation from a diagnostic result.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O2',
      subtask:
        'Sorts falling effort after sedation and gas drawn out by continuous suction as reasons the next move could be unsafe.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O3',
      subtask:
        'Commits an interpretation of unchanged oximetry on supplemental oxygen with reduced effort, in recovery.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O4',
      subtask:
        'Commits a next step when a clear view coexists with lost airflow and a flattening capnography trace.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M01-O5',
      subtask:
        'Decides, in a practice case, how rigid access, flexible access, video and added guidance relate.',
      evidence: 'case-decision',
    },
  ],
  drillIds: [],
  prerequisites: [],

  clinicalQuestion:
    'During a bronchoscopy under sedation, which information tells you whether it is safe to keep going?',
  recognizeTitle: 'A clear view during a sedated inspection',
  objective:
    'Distinguish what the airway view can report from what only the patient’s own signals can, during a bronchoscopy under sedation.',
  why: 'A bronchoscope enters the airway the patient breathes through, and the sedation given for it acts on the same breathing. Knowing which signal reports what is the first safety habit.',
  newConcept:
    'The airway view shows where the lens is; only the patient’s own signals — effort, airflow, capnography and oximetry — show whether breathing is adequate.',
  incrementSentence:
    'This section adds one idea to the physiology you bring: the picture on the monitor and the breathing of the patient are separate sources, and when they disagree the patient decides.',
  harmfulReflex:
    'Finishing the survey because the view is clear and oximetry looks acceptable, while effort or airflow is falling.',
  anchor: {
    analogy:
      'A clear windscreen does not show the fuel gauge: the airway view tells you where you are, not whether the patient is breathing enough.',
    precise:
      'Oximetry reports oxygenation, not ventilation; supplemental oxygen can hold it steady while ventilation fails, and the chest can move against an obstructed upper airway.',
    checklistLabel: 'Before trusting a clear view, check the patient',
    checklist: [
      'Responsiveness and respiratory effort',
      'Airflow at the mouth and nose',
      'The capnography trace',
      'Oximetry — last, because oxygen can hold it up',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-stop-and-communicate',
    states: {
      insertion: 'monitoring',
      rotation: 'monitoring',
      deflection: 'monitoring',
      suction: 'monitoring',
      accessory: 'monitoring',
    },
    sentence:
      'No control here. The five controls come in the Handle phase; this section is about what the patient and the picture each report.',
  },
  precommitDenyPatterns: [
    /pause the (examination|procedure|survey)/i,
    /assess(ing)? the airway and breathing/i,
  ],
  modelBoundary:
    'The monitor in this section is scripted in words for teaching. It is not a physiological model, and no value on this page is a threshold for your patient.',
  localPolicyIds: ['sedation_policy'],
  reviewItemIds: ['R49'],

  blocks: [
    {
      id: 'two-sources',
      kind: 'question',
      role: 'framing',
      heading: 'Two kinds of information at once',
      body: 'A bronchoscope enters the same airway the patient breathes through. During the examination the team watches two kinds of information at once: the airway on the monitor and the patient in front of them.\n\nThis section is about what each one can, and cannot, tell you.',
      claimClass: 'synthesis',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } }],
    },
    {
      id: 'what-is-available',
      kind: 'signals',
      role: 'signals',
      heading: 'What the team can see and measure',
      body: 'Each of these reports something different. Before a decision, name which of them the decision depends on.',
      pointsLabel: 'Information available during a bronchoscopy',
      points: [
        'The airway view: where the lens faces and what is in front of it',
        'Responsiveness and respiratory effort',
        'Airflow at the mouth and nose, and chest movement',
        'Oximetry',
        'Capnography, where it is available',
        'On a ventilator: delivered and exhaled volumes and pressures',
      ],
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } }],
    },
    {
      id: 'stable-examination',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A stable examination',
      body: 'In a stable examination the patient stays at the planned depth of sedation and responds as expected. Respiratory effort and airflow continue at the rhythm seen before sedation, the capnography trace keeps its shape, and oximetry holds at the patient’s own starting value. The view is clear, the operator can name the next airway, and the team has heard the plan.\n\nThat is the reference every later change is measured against: this patient’s own earlier state, not a remembered number.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
      ],
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'the-scope-shares-the-airway',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The scope shares the airway',
      body: 'The bronchoscope occupies the conduit that must carry gas. It adds resistance; suction removes gas as well as fluid; lavage changes gas exchange for a time; topical anesthetic blunts protective reflexes; and sedatives can reduce effort and let the upper airway close. A reassuring airway image does not establish physiological stability.\n\nOxygenation and ventilation are related but separate. Oximetry reports oxygenation, not the volume of air moving. Supplemental oxygen can hold the saturation steady while ventilation falls, and the chest can move against an obstructed upper airway. Effort, airflow, responsiveness and capnography report ventilation; the picture reports neither.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
      ],
    },
    {
      id: 'five-questions-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The five questions, worked',
      body: 'The course asks five questions at every stage of a bronchoscopy. Worked through the scene in this section:',
      pointsLabel: 'The scene, question by question',
      points: [
        'Where am I? In the right lower lobe, clearly seen.',
        'What am I looking at? Normal mucosa and an open lumen.',
        'What do I intend to do next? The basal segments.',
        'What would make that unsafe? Airflow has stopped and the capnography trace has flattened while the chest still moves. This answer outranks the other three.',
        'What result would change management? None yet; the survey can wait until breathing is secure.',
      ],
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 80, to: 81 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors takes one source of information for another.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Reading acceptable oximetry as adequate breathing: check effort, airflow and capnography.',
        'Reading a clear view as a stable patient: look at the patient as well as the monitor.',
        'Finishing the survey before reassessing: a deliberate, documented limitation is better than a complete examination that ignores the patient.',
        'Treating a well-returned lavage as a diagnosis: the procedure produced a specimen; the result has yet to answer the question.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
      ],
    },
    {
      id: 'capabilities',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the instruments differ',
      body: 'Bronchoscopy developed as a series of capabilities. Rigid access came first and still solves problems of large foreign bodies, bleeding and ventilation during intervention. Flexible instruments reach lobar and segmental airways. Video display lets the whole team see and teach. Added imaging and guidance reach targets beyond the visible lumen.\n\nA newer instrument adds a capability; it does not retire every older one. Different instruments solve different access, ventilation, suction and therapeutic problems.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T08', location: { kind: 'time-span', start: '00:08:54', end: '00:24:02' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 29, to: 30 } },
      ],
      reviewItemIds: ['R49'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'The patient during an elective airway inspection under moderate sedation — scripted for teaching',
    readings: [
      {
        channel: 'airway-view',
        words: 'A clear view of the right lower lobe; the mucosa looks normal',
        trend: 'steady',
      },
      { channel: 'respiratory-effort', words: 'The chest is still moving', trend: 'steady' },
      { channel: 'airflow', words: 'No longer felt at the mouth and nose', trend: 'lost' },
      { channel: 'capnography', words: 'The trace has flattened', trend: 'falling' },
      {
        channel: 'oximetry',
        words: 'Unchanged from the start, on supplemental oxygen',
        trend: 'steady',
      },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel: what the airway view shows, and what each patient signal is doing.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.monitor },
    },
    act: {
      title: 'Five questions at the scope',
      instruction:
        'Place each statement under the question it answers, on this card, then check the set. Each question is the answer to at least one statement.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sortRows },
    },
    explain: {
      title: 'The picture and the patient',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'sort',
    sort: {
      id: 'five-questions',
      prompt:
        'Seven statements from one bronchoscopy. For each, say which of the five questions it answers.',
      origins: [
        {
          id: 'where',
          label: 'Where am I?',
          definition: 'Location, from landmarks and the branches already travelled.',
        },
        {
          id: 'what',
          label: 'What am I looking at?',
          definition: 'The structure, mucosa and contents in view, described before any diagnosis.',
        },
        {
          id: 'next',
          label: 'What do I intend to do next?',
          definition: 'The next airway or action, named before the hands move.',
        },
        {
          id: 'unsafe',
          label: 'What would make that unsafe?',
          definition:
            'Anything in the patient, the airway or the equipment that should stop or change the next move.',
        },
        {
          id: 'result',
          label: 'What result would change management?',
          definition:
            'The finding or specimen that would alter the plan: the reason for the procedure.',
        },
      ],
      rows: [
        {
          id: 'carina-ahead',
          statement: 'The main carina is ahead, with both main bronchial openings in view.',
          origin: 'where',
          rationale:
            'Both main bronchial origins around the carina fix the scope’s position in the trachea: a location answer, built from landmarks.',
        },
        {
          id: 'secretions',
          statement: 'Thick yellow secretions coat the wall of the right lower lobe bronchus.',
          origin: 'what',
          rationale:
            'This describes contents on a named wall. It is an observation, not yet a diagnosis of infection.',
        },
        {
          id: 'plan-rul',
          statement: 'The plan is to enter the right upper lobe, then come back to the carina.',
          origin: 'next',
          rationale:
            'Naming the next airway and the return point before moving is the intention the hands then carry out.',
        },
        {
          id: 'effort-falling',
          statement: 'Since the last sedative dose, breaths have become shallow and less frequent.',
          origin: 'unsafe',
          rationale:
            'Falling effort after sedation is a change in the patient that can make the next move unsafe, whatever the view shows.',
        },
        {
          id: 'suction-gas',
          statement:
            'Continuous suction in a small segment is drawing gas out along with the secretions.',
          origin: 'unsafe',
          rationale:
            'Suction removes gas as well as fluid. In a small segment it can collapse the airway and worsen gas exchange, so it bears on safety.',
        },
        {
          id: 'culture-changes-plan',
          statement: 'A culture from this segment would change the antibiotic plan.',
          origin: 'result',
          rationale:
            'This is the clinical question the procedure exists to answer: a result that would alter management.',
        },
        {
          id: 'lavage-returned',
          statement:
            'The lavage came back well; whether it helps depends on what the laboratory can report.',
          origin: 'result',
          rationale:
            'A well-returned lavage is a procedural observation. It changes management only through the result it produces.',
        },
      ],
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 44, to: 47 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 61, to: 70 } },
      ],
    },
  },

  prediction: {
    id: 'N01',
    itemType: 'management-decision',
    situation:
      'Midway through an elective airway inspection under moderate sedation, the view of the right lower lobe is clear and the mucosa looks normal. The chest is still moving, but the nurse can no longer feel airflow at the mouth and nose, and the capnography trace has flattened. Oximetry, on supplemental oxygen, is unchanged from the start.',
    stem: 'What should happen next?',
    choices: [
      {
        id: 'a',
        label: 'Pause the examination and assess the airway and breathing, telling the team',
        rationale:
          'Airflow has stopped and the capnography trace has flattened while the chest still moves: ventilation is failing or obstructed. Pausing lets the team assess and support breathing; the survey resumes only once the patient is stable.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Continue, because the unchanged oximetry shows ventilation is adequate',
        rationale:
          'Oximetry reports oxygenation, not the volume of air moving. On supplemental oxygen the saturation can stay unchanged for minutes while ventilation fails.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'Continue, because the clear, normal-looking airway shows the patient is stable',
        rationale:
          'The view shows where the lens is and what the mucosa looks like. It reports nothing about airflow, effort or carbon dioxide.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Finish the survey quickly, then reassess breathing once the scope is out',
        rationale:
          'Finishing first leaves failing ventilation unassessed. A deliberate, documented limitation is better than a complete examination that ignores the patient.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'The clear view reports the lens position and the mucosa; it does not report breathing. A moving chest without airflow, with a flattening capnography trace, means ventilation is obstructed or failing, and supplemental oxygen can keep the saturation unchanged while it happens. The patient’s signals outrank the survey: pause, assess the airway and breathing, and say so aloud.',
    objectiveIds: ['M01-O2', 'M01-O4'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
    ],
  },

  transfer: {
    id: 'Q09',
    seedId: 'Q09',
    itemType: 'mechanism-interpretation',
    situation:
      'In recovery after an uneventful inspection, a patient who received moderate sedation is on supplemental oxygen. Respiratory effort is visibly reduced and the patient is hard to rouse. Oximetry remains at the patient’s earlier value.',
    stem: 'What is the best interpretation of the unchanged oximetry?',
    choices: [
      {
        id: 'a',
        label: 'Ventilation is adequate, because the saturation has not fallen',
        rationale:
          'Oximetry does not measure ventilation; it reports how much of the haemoglobin carries oxygen.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'b',
        label: 'Hypoventilation remains possible; supplemental oxygen can delay a fall',
        rationale:
          'With supplemental oxygen, saturation can hold while carbon dioxide rises. Reduced effort and difficult rousing are the signals to act on.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: 'Further sedation is needed to settle the patient for recovery',
        rationale:
          'Reduced effort is not a reason for more sedation; it may be the sedation already given.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label: 'Only a repeat airway inspection can resolve the concern',
        rationale:
          'The concern is physiological: effort, responsiveness, airflow and capnography answer it at the bedside, without another procedure.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Oximetry reports oxygenation, not minute ventilation. On supplemental oxygen, saturation can stay acceptable while ventilation falls; effort, responsiveness, airflow and capnography are the signals that report it.',
    objectiveIds: ['M01-O3', 'M15-O1'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
      { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
    ],
    transferVariant:
      'After the procedure, in recovery, with no scope in the airway: the same signals in a different setting.',
  },

  practice: [
    {
      id: 'mc-instrument-capabilities',
      presentationTitle: 'A teaching-conference claim about rigid bronchoscopy',
      situation:
        'At a teaching conference, a trainee argues that because flexible video bronchoscopes now reach segmental airways, rigid instruments no longer have a role. The case under discussion is an adult with a large inhaled object in a main bronchus, where bleeding during removal is possible.',
      item: {
        id: 'mc-instrument-capabilities',
        itemType: 'mechanism-interpretation',
        stem: 'Which statement best describes how the instruments relate?',
        choices: [
          {
            id: 'a',
            label: 'Each solves different access, ventilation, suction and therapeutic problems',
            rationale:
              'Rigid access offers a large channel and a way to ventilate and suction during extraction or bleeding; flexible access reaches lobar and segmental airways; video lets the team see; guidance reaches beyond the lumen.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Flexible instruments now do everything rigid instruments once did',
            rationale:
              'Rigid bronchoscopy did not become obsolete when flexible instruments appeared; a large foreign body, bleeding or central obstruction can still need what it offers.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Video display is what lets a scope reach segmental airways',
            rationale:
              'Segmental access came from the flexible insertion tube and its bending section. Video changed who can see and teach, not where the scope can go.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Instruments developed as capabilities: rigid access, then flexible access to lobar and segmental airways, then video for the whole team, then imaging for targets beyond the lumen. A newer instrument adds a capability; it does not retire every older one.',
        objectiveIds: ['M01-O5'],
        claimClass: 'transcript-source',
        sourceRefs: [
          { sourceId: 'T08', location: { kind: 'time-span', start: '00:08:54', end: '00:24:02' } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 29, to: 30 } },
        ],
      },
    },
  ],
}
