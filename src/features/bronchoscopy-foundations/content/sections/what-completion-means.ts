import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M18 — What finishing the course establishes. The closing section: the learner reads a trainee's
 * file record by record — course completion, knowledge responses, simulated navigation, observed
 * physical skill, supervised clinical performance, self-confidence — and decides which claim each
 * can carry. Knowledge spec §18.4 and §21 (S2 PDF 67–69, 100–109, 116–117; S3 PDF 17–18, 26–28,
 * 35–42; T08), with the transfer drawn from §5.5 and §17.7 (T11, T15).
 *
 * Finishing the course establishes one thing — that its learning activities were completed. Seed
 * Q12's key is that sentence, carried by the block "Four claims, and who makes each", not a
 * learner item.
 */
const FILE_HEADING = 'What this fellow’s file holds'
const CLAIMS_HEADING = 'Four claims, and who makes each'

export const section: BronchSectionDefinition = {
  id: 'what-completion-means',
  title: 'What a training file shows',
  shortTitle: 'Training records',
  minutes: 6,
  moduleIds: ['M18'],
  objectives: [
    {
      objectiveId: 'M18-O1',
      subtask:
        'Sorts an observation of the hands and a supervised patient task apart from simulator events; the integrated, faculty-observed simulation itself happens outside this course.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M18-O2',
      subtask:
        'Commits how far an observed, unprompted inspection on a bench model carries into an inspection through an endotracheal tube in a ventilated patient, with a rotated image.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M18-O3',
      subtask:
        'Follows a worked example that turns an observer’s correction and a self-rating into one specific next-practice objective, which the learner keeps in their own training record, outside this course.',
      evidence: 'not-app-assessable',
    },
    {
      objectiveId: 'M18-O4',
      subtask:
        'Commits what a file of finished sections, committed answers, an unassisted simulator log and a high self-rating can support, then sorts evidence statements into the record each belongs to.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M18-O5',
      subtask:
        'Explains, in the transfer, which part of a familiar skill’s evidence stops carrying when the device, the image orientation and the patient change.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D14'],
  prerequisites: ['reference-frames', 'scope-in-a-tube', 'honest-report'],

  clinicalQuestion: 'Which decision can each record in a bronchoscopy trainee’s file support?',
  recognizeTitle: 'A fellow’s file at the end of the course',
  objective:
    'Distinguish the kinds of record in a bronchoscopy training file, and decide which claim each can support.',
  why: 'Decisions about a trainee’s first patient procedures, and about what the trainee practices next, are made from the trainee’s file.',
  newConcept:
    'A record supports only the claim its own evidence can carry, in the setting where that evidence was gathered: finished activities show completion, not the hands.',
  incrementSentence:
    'This section adds one idea to the honest report: a training record, like a procedure note, claims only what was actually seen, and this course sees activities, answers and the model, never the hands.',
  harmfulReflex:
    'Treating finished sections, an unassisted simulator log or high confidence as readiness to start on patients before a faculty observer has watched the hands.',
  anchor: {
    analogy:
      'A record of driving lessons attended shows the lessons, not the driving. An examiner watches the driving, and the licensing authority, not the driving school, issues the license.',
    precise:
      'Completion shows the activities were done; committed answers show reasoning; simulator events show the model’s camera under named assists; a self-rating shows confidence. Readiness for a supervised task is a faculty judgment from observed performance, and privileges belong to the institution.',
    checklistLabel: 'Before a record informs a decision, ask',
    checklist: [
      'What produced it: the course, the simulator, the trainee or an observer?',
      'In what setting, with which assists and which input?',
      'Who watched, and what did they see?',
      'Which decision does it inform, and who makes that decision?',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control at the scope changes what a record shows. The claim changes only with new evidence: a faculty observer watching a named task in a named setting.',
  },
  precommitDenyPatterns: [
    /faculty[- ]observ/i,
    /faculty judg(e)?ment/i,
    /observed (handling|performance)/i,
    /not the hands/i,
  ],
  modelBoundary:
    'The fellow, the file and the sessions in this section are constructed for teaching. The airway map shows the one anatomy profile of the course’s teaching model, which has no patient, no tube and no ventilator.',
  physicalSkillNote:
    'Integrating indication, safety, inspection, sampling and reporting in one simulated case is a hand and team skill, run in person with faculty outside this course. The app does not see that case.',
  localPolicyIds: [],
  reviewItemIds: ['R06'],

  blocks: [
    {
      id: 'records-in-a-file',
      kind: 'question',
      role: 'framing',
      heading: 'Records in a training file',
      body: 'By the end of an introductory course, a trainee’s file holds several records: sections finished, answers committed, simulator logs, a rating of the trainee’s own comfort. This fellow’s file is about to inform a request to start on patients.\n\nThis section asks which decision each record can support.',
      claimClass: 'design',
      sourceRefs: [],
    },
    {
      id: 'this-fellows-file',
      kind: 'signals',
      role: 'signals',
      heading: FILE_HEADING,
      body: 'These records are the whole file at the time of the request.',
      pointsLabel: 'In the file',
      points: [
        'The course record: every section finished',
        'Committed answers with their explanations; most of the decisions held',
        'The simulator log: every segmental airway reached in the model’s one anatomy profile, with no assist and keyboard input',
        'The self-rating: very confident about airway inspection',
      ],
      claimClass: 'design',
      sourceRefs: [],
    },
    {
      id: 'four-records',
      kind: 'after-commitment',
      role: 'normal-reference',
      heading: CLAIMS_HEADING,
      body: 'A training program keeps four claims distinct, because each rests on different evidence and supports a different decision.\n\nFinishing this course establishes the first: that its learning activities were completed. It does not establish competence, readiness for a clinical task, or privileges. How many observations readiness needs, and to what standard, is set by the training program.',
      pointsLabel: 'The claim, and who makes it',
      points: [
        'Learning activities completed: issued by this course.',
        'Performance observed in a specified simulation: documented when a faculty observer watches a named task in a named setting.',
        'Readiness for a specified supervised clinical task: a faculty judgment from reviewed evidence, such as observed performance in more than one simulated setting without an unresolved critical error, with a task-specific plan for the first patient procedures.',
        'Independent-practice privileges: granted by the institution’s credentialing process, never by a course or an app.',
      ],
      claimClass: 'design',
      sourceRefs: [],
    },
    {
      id: 'manual-tools',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The training manual’s two tools',
      body: 'The training manual keeps two tools apart. Its skills tool rates the tasks themselves, among them posture and scope handling, central positioning and avoidance of wall trauma. Its self-rating tool supports feedback and identifies learning needs by setting the trainee’s comfort beside the instructor’s observations. Confidence and technical performance can diverge.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 100, to: 109 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 116, to: 117 } },
      ],
    },
    {
      id: 'what-evidence-shows',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What evidence can show',
      body: 'A record of performance names its setting: the anatomy profile, the device, the image orientation, the assists and the input. Change one of these and part of the evidence stops carrying.',
      pointsLabel: 'Each kind of evidence, and its limit',
      points: [
        'A committed answer: identification and reasoning on the page, not entry into an airway without touching the wall.',
        'A simulator event: that the model’s camera crossed a branch boundary, under the assists named; not the mucosa inspected, the force used or the hands.',
        'An observed model session: the hands and the view together, in a named setting; a safe model performance remains a model performance.',
        'A supervised patient task: that task, with the trainee’s role, the supervision and the feedback recorded.',
        'A self-rating: confidence, not competence.',
      ],
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 67, to: 69 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 116, to: 117 } },
      ],
    },
    {
      id: 'where-this-course-sits',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Where this course sits',
      body: 'One lecture series this course draws on runs as a sequence: preparation with embedded questions, a hands-on session, then apprenticeship. This course keeps that progression and adds reference access and targeted remediation. It is the preparation; the hands-on session and the apprenticeship follow it.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T08', location: { kind: 'time-span', start: '00:00:03', end: '00:02:20' } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors lets one record speak for another.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Merging the file into one verdict: keep completion, simulated performance, observed handling and supervised readiness as separate lines.',
        'Reading a simulator log as hand skill: the log shows the model’s camera; judging the hands, the shaft and the force used takes an observer.',
        'Reading confidence as readiness: set the self-rating beside the observer’s record, and treat a gap between them as a learning need.',
        'Counting presence as performance: being present for a bronchoscopy is not performing its inspection or its sampling.',
        'Letting speed or a count stand in for safety: a faster survey, more cases or more finished sections do not offset a critical error, and completeness is a status for each airway, not elapsed time.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 116, to: 117 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 67, to: 69 } },
      ],
      reviewItemIds: ['R06'],
    },
    {
      id: 'next-objective',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'From feedback to a next objective',
      body: 'A useful correction names the observed behavior, explains its consequence and specifies the next attempt, and the remedy matches the failure. Worked through one bench-model session:',
      pointsLabel: 'One session, from rating to objective',
      points: [
        'Before the session, the fellow rates withdrawal from the right lower lobe as comfortable.',
        'The observer sees the tip contact the opposite wall on repeated withdrawals, although every airway was named accurately.',
        'Naming held and the contact repeated, so the need is motor practice rather than more anatomy; the comfort rating and the observation diverge.',
        'The next objective: reduce deflection while returning to the parent bronchus, then pause with both openings in view, with the observer watching for wall contact.',
        'The fellow keeps it in their own training record, with the task, setting, assistance and observer; this course does not collect it.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 17, to: 18 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 26, to: 28 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 35, to: 42 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 67, to: 69 } },
      ],
    },
  ],

  workspace: {
    kind: 'map',
    lit: [
      'RB1',
      'RB2',
      'RB3',
      'RB4',
      'RB5',
      'RB6',
      'RB7',
      'RB8',
      'RB9',
      'RB10',
      'LB1+2',
      'LB3',
      'LB4',
      'LB5',
      'LB6',
      'LB7+8',
      'LB9',
      'LB10',
    ],
    caption:
      'The airway map from the fellow’s simulator log: each lit airway was reached in the model',
  },

  steps: {
    recognize: {
      instruction: `Read the entries under ${FILE_HEADING} in the Teaching panel; the airway map in the Simulator panel lights each airway the simulator log records as reached.`,
      lookIn: {
        pane: 'teaching',
        landmark: FILE_HEADING,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.map,
      },
    },
    act: {
      title: 'Which record is it',
      instruction:
        'Place each statement under the record it belongs to, on this card, then check the set.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sortRows },
    },
    explain: {
      title: 'What each record can carry',
      instruction: `Read ${TEACHING_LANDMARKS.adds} and “${CLAIMS_HEADING}” in the Teaching panel, then, on this card, why the other answers to the prediction do not fit.`,
    },
  },

  act: {
    kind: 'sort',
    sort: {
      id: 'evidence-to-record',
      prompt:
        'Eight statements from fellows’ training files. For each, name the record it belongs to.',
      origins: [
        {
          id: 'completion',
          label: 'Course completion',
          definition: 'Learning activities opened and finished: the record this course issues.',
        },
        {
          id: 'knowledge',
          label: 'Knowledge response',
          definition:
            'A committed answer or explanation: what the learner could reason, on the page, at that moment.',
        },
        {
          id: 'navigation',
          label: 'Simulated navigation',
          definition:
            'Simulator events: where the model’s camera went, with the assists and input used.',
        },
        {
          id: 'physical',
          label: 'Observed physical skill',
          definition:
            'Hands on a scope or model, watched by a faculty observer in a named setting.',
        },
        {
          id: 'clinical',
          label: 'Supervised clinical performance',
          definition:
            'A specified task in a patient procedure, with the supervision and prompting recorded.',
        },
        {
          id: 'confidence',
          label: 'Self-confidence',
          definition: 'The learner’s own rating of comfort with a task.',
        },
      ],
      rows: [
        {
          id: 'sections-finished',
          statement:
            'Every section of the course is marked finished, and the course has issued its completion record.',
          origin: 'completion',
          rationale:
            'Finishing the sections is a learning activity. The record shows the activities were done, not what the learner can do with a scope or a patient.',
        },
        {
          id: 'handling-rated',
          statement:
            'The simulator’s end-of-session summary rates the fellow’s scope handling as smooth, from the path its camera took through the right-sided airways.',
          origin: 'navigation',
          rationale:
            'The rating is computed from the camera’s path in the model, so it is a simulator event whatever it is called. No one watched the hands, the shaft or the force used.',
        },
        {
          id: 'rb6-explained',
          statement:
            'Before the verdict, the fellow committed that RB6 belongs to the right lower lobe and explained it by parentage.',
          origin: 'knowledge',
          rationale:
            'A committed explanation shows identification and reasoning on the page. It does not show that a scope could enter RB6 without touching the wall.',
        },
        {
          id: 'station-drift',
          statement:
            'At a simulator station, a faculty member beside the fellow noted that the fellow caught forward drift of the shaft and steadied it while keeping the view.',
          origin: 'physical',
          rationale:
            'The session ran on a simulator, but this entry is someone watching the hands and the view together, in a named setting. The station’s own log of the same session would be a separate navigation record, and a safe model performance remains a model performance.',
        },
        {
          id: 'labels-on',
          statement:
            'The simulator log shows every right-sided segment reached, with in-view labels on and keyboard input.',
          origin: 'navigation',
          rationale:
            'The log records where the model’s camera went. In-view labels are an assist, so this is assisted navigation, and keyboard input says nothing about the hands.',
        },
        {
          id: 'says-ready',
          statement:
            'The fellow tells the attending that many hours in the simulator have made them ready for patients.',
          origin: 'confidence',
          rationale:
            'A trainee’s statement of readiness is a self-rating, whatever experience it cites. The simulator hours it mentions are a separate record, and neither shows the hands.',
        },
        {
          id: 'no-contacts',
          statement:
            'The simulator counted no wall contacts during the fellow’s survey of the left lung.',
          origin: 'navigation',
          rationale:
            'A contact count comes from the model’s geometry. It does not measure force and cannot show whether the mucosa was inspected, so it stays a simulator event.',
        },
        {
          id: 'supervised-inspection',
          statement:
            'During a patient bronchoscopy, the supervising attending recorded that the fellow inspected the right-sided airways with intermittent prompts.',
          origin: 'clinical',
          rationale:
            'A named task in a real procedure, rated by the supervisor with the prompting recorded. It supports a claim about that task under that supervision, and no more.',
        },
      ],
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 116, to: 117 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 100, to: 109 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 67, to: 69 } },
      ],
    },
  },

  prediction: {
    id: 'N12',
    itemType: 'management-decision',
    situation:
      'A first-year fellow has finished every section of this course and asks to start airway inspections on patients next week. The file holds four records: the course’s completion record; committed answers, whose decisions mostly held; a simulator log showing every segmental airway reached in the model’s one anatomy profile, with no assist and keyboard input; and a self-rating of very confident.',
    stem: 'What does this file support?',
    choices: [
      {
        id: 'a',
        label:
          'Completion and reasoning on the page, with readiness for a supervised task still waiting on faculty-observed performance',
        rationale:
          'None of the four records comes from anyone watching the hands. Completion shows the activities were done, the answers show reasoning and the log shows the model’s camera; readiness for a specified supervised task is a faculty judgment from observed performance, with a task-specific plan for the first patient procedures.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Readiness for supervised airway inspections, since unassisted navigation of every segment in the model required steady tip control',
        rationale:
          'The simulator records where the model’s camera went, here under keyboard input; it cannot see the hands, the shaft or the force used. Starting patient inspections on this log would make a patient’s airway the first place anyone watches the fellow’s hands.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Completion and reasoning on the page, with readiness to be built by repeating supervised inspections on patients',
        rationale:
          'Completion and reasoning are real records, but readiness for a supervised patient task is judged before the first patient procedure, from reviewed evidence that includes observed simulation. Repetition belongs primarily in simulation; a patient inspection is purposeful, not rehearsal.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'Readiness for supervised inspections once the simulator survey has also been completed in a second anatomy profile',
        rationale:
          'A second anatomy profile adds navigation in another configuration, which the evidence for readiness does include, but it is still the model’s camera under keyboard input. The file would still hold no observation of the hands, so patient inspections would start on the same missing evidence.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'Each record shows only what produced it. Completion shows the activities were done; committed answers show reasoning; simulator events show the model’s camera under named assists; a self-rating shows confidence, not competence. None of them comes from watching the hands, so readiness for a specified supervised task waits on a faculty judgment from observed performance, and independent privileges belong to the institution.',
    objectiveIds: ['M18-O4'],
    claimClass: 'design',
    sourceRefs: [{ sourceId: 'S2', location: { kind: 'pdf-pages', from: 116, to: 117 } }],
  },

  transfer: {
    id: 'what-completion-means-transfer',
    itemType: 'mechanism-interpretation',
    situation:
      'A fellow’s record holds a faculty-observed simulation: an unprompted inspection of the right-sided airways on a bench airway model, image upright, scope free in the airway, no tube and no ventilator. The observer’s note records that the fellow identified each segment from its parent bronchus. The fellow’s first supervised patient task will be an inspection of the right-sided airways through an endotracheal tube in a ventilated patient, where the image may appear rotated.',
    stem: 'How far does the observed simulation carry into this task?',
    choices: [
      {
        id: 'a',
        label:
          'The parentage reasoning carries; its use under rotation and handling in a ventilated patient’s tube are observed again',
        rationale:
          'Identity from parentage does not depend on where a branch sits on the screen, and the observer recorded the fellow identifying segments that way, so the reasoning carries. The image was upright, so its use under rotation has not been seen, and the tube and the ventilator were never in the observed setting; each is observed again under supervision.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'The naming and the handling carry, since the hand movements are the same; the tube adds a check that the scope fits',
        rationale:
          'The hands move the same way, but inside a tube the scope occupies the lumen that carries the patient’s ventilation, and a scope that fits can still impair both inspiration and expiration. Handling there, with the ventilation watched, has not been observed and cannot be assumed from a free scope on a bench.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'The survey carries once the image is rotated back upright on the monitor, leaving the tube’s fit as the one new check',
        rationale:
          'Rotating an image upright moves every structure on the screen together and names nothing by itself; which way is up is still read from landmarks. Whether the fellow does that under rotation is what the upright session did not show, and a tube changes ventilation as well as fit.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'The parentage reasoning carries; the handling seen on a bench model is set aside and relearned by repetition on patients',
        rationale:
          'Observed bench handling is real evidence about the hands in that setting, so it is not discarded. Repetition belongs primarily in simulation; a patient inspection is purposeful, and what changed, the tube, the ventilator and the rotated image, is what gets observed next.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Part of a skill’s evidence survives a change of setting and part does not. Identity from parentage does not depend on screen position, so the fellow’s recorded reasoning carries, but the observed image was upright, so its use under rotation has not been seen. The tube around the scope and the ventilator were not in the observed setting: the safety principles of looking before advancing and avoiding force stay the same there, and how the fellow handles the scope under them is observed again under supervision.',
    objectiveIds: ['M18-O5', 'M18-O2'],
    claimClass: 'synthesis',
    sourceRefs: [
      { sourceId: 'T11', location: { kind: 'time-span', start: '00:19:46', end: '00:34:48' } },
      { sourceId: 'T15', location: { kind: 'time-span', start: '00:02:49', end: '00:04:03' } },
    ],
    reviewItemIds: ['R06'],
    transferVariant:
      'From reading a file at the end of the course to a first supervised patient task in a changed setting: a tube, a ventilator and a rotated image that the observed simulation did not include.',
    retrievesFrom: 'reference-frames',
  },

  practice: [],
}
