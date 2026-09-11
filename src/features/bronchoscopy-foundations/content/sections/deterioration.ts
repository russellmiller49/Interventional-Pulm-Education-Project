import type { SourceRef } from '../../data/sources'
import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M15, first half — Deterioration. When a patient's signals change during a routine inspection,
 * the learner answers with one response bundle before the cause is settled (stop the provoking
 * action, announce it, assess and support breathing with the team, reassess) and resumes only on a
 * new decision. Knowledge spec §16.1, §16.2, §16.4–§16.6 and §16.8 (S1 PDF 71–79, 115–117,
 * 138–143, 154–158; S2 PDF 26–31, 27, 29, 39–40, 161–163; U1; U4; T09 00:17:34–00:19:49),
 * drill D13 part one and case C08. Bleeding priorities (M15-O2, M15-O5) are the next section's.
 * Register R14: no rescue doses, no LAST algorithm, no reversal ceiling.
 */

/** §16.1 — the response bundle, and what the scope is doing. */
const S1_RESPONSE: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 115, to: 117 },
}
const S1_TAMPONADE: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 138, to: 143 },
}
const S2_COMPLICATIONS: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 26, to: 31 },
}
const S2_ESCALATION: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 161, to: 163 },
}
/** §16.1 and §16.2 — hypoxemia, hypoventilation and apnea; the scope's effect on ventilation. */
const S1_RECOGNITION: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 77, to: 79 },
}
const S1_VENTILATION: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 154, to: 158 },
}
const U1_REVERSAL_RECOVERY: SourceRef = {
  sourceId: 'U1',
  location: { kind: 'section', label: 'reversal and recovery recommendations' },
}
/** §1 — safety takes precedence over the survey; a deliberate limitation documented honestly. */
const S1_SAFETY_FIRST: readonly SourceRef[] = [
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 64, to: 65 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 117 } },
  { sourceId: 'S1', location: { kind: 'pdf-pages', from: 134, to: 144 } },
]
/** §9.4 — the monitoring the normal reference is read against. */
const U1_MONITORING: SourceRef = {
  sourceId: 'U1',
  location: { kind: 'section', label: 'monitoring recommendations' },
}
/** §9.4 — a designated clinician follows the patient; pulse and pressure read with stimulation and drugs. */
const S1_MONITORING_TEAM: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 75, to: 79 },
}
/** §16.4 — bronchospasm and laryngospasm. */
const S1_SPASM: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 71, to: 79 },
}
const S2_SPASM: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 27 },
}
/** §16.5 — pneumothorax and postprocedural deterioration (and case C08). */
const S1_PNEUMOTHORAX: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 141, to: 143 },
}
const S2_PNEUMOTHORAX: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 29 },
}
/** §16.6 with §9.3 — local-anesthetic toxicity, and methemoglobinemia after a topical agent. */
const S1_TOPICAL_EVENTS: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 73, to: 74 },
}
const U4_LAST: SourceRef = {
  sourceId: 'U4',
  location: { kind: 'section', label: 'LAST checklist' },
}
/** §16.6 — medication-related respiratory depression and reversal. */
const S1_REVERSAL: SourceRef = {
  sourceId: 'S1',
  location: { kind: 'pdf-pages', from: 74, to: 83 },
}
const S2_REVERSAL: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 39, to: 40 },
}
const U1_REVERSAL: SourceRef = {
  sourceId: 'U1',
  location: { kind: 'section', label: 'reversal recommendations' },
}
/** §16.8 — a single ultrasound finding or waveform does not settle every cause. */
const T09_SHORTCUTS: SourceRef = {
  sourceId: 'T09',
  location: { kind: 'time-span', start: '00:17:34', end: '00:19:49' },
}
/** §10.3 — the glottis is crossed under vision while open, not by pushing against closed folds. */
const S2_GLOTTIS: SourceRef = {
  sourceId: 'S2',
  location: { kind: 'pdf-pages', from: 46 },
}
const S3_GLOTTIS: SourceRef = {
  sourceId: 'S3',
  location: { kind: 'pdf-pages', from: 81 },
}
export const section: BronchSectionDefinition = {
  id: 'deterioration',
  title: 'When the patient’s state changes during an inspection',
  shortTitle: 'Deterioration',
  minutes: 8,
  moduleIds: ['M15'],
  objectives: [
    {
      objectiveId: 'M15-O1',
      subtask:
        'Commits a first response when a sedated patient becomes restless with falling oximetry and a further sedative dose is offered; commits a next move as the designated monitoring clinician when the operator has not seen a change.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M15-O3',
      subtask:
        'Chooses, frame by frame on one bronchoscopy list, the first response and escalation for a new wheeze, a low saturation after topical benzocaine and sudden chest pain with instability after biopsy; decides, in practice cases, what effort without airflow at the larynx and new pleuritic pain after an uneventful biopsy require.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M15-O4',
      subtask:
        'Chooses the next move once the event that interrupted an inspection has eased and the operator asks to carry on, and reads what has to be rechecked before any procedure resumes.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D13'],
  prerequisites: ['shared-airway', 'sedation-and-monitoring', 'larynx-and-entry'],

  clinicalQuestion:
    'Midway through a routine inspection under sedation, the patient becomes restless and the monitor changes. What is the next move?',
  recognizeTitle: 'A restless patient midway through an inspection',
  objective:
    'Decide what a change in a sedated patient’s behavior and monitor calls for during a routine inspection.',
  why: 'The scope, the sedation and the topical anesthetic all act on the airway the patient breathes through, so a patient can change at any point in a routine inspection.',
  newConcept:
    'Deterioration is answered with one response bundle before its cause is known: stop the provoking action, announce the change, and assess and support breathing with the team, reassessing after each step.',
  incrementSentence:
    'This section adds one idea to the shared airway of the first section: when the patient’s signals change, the team answers with one response bundle before settling on a cause.',
  harmfulReflex:
    'Carrying on with the inspection, or answering restlessness with more sedation, before the change has been announced and breathing assessed.',
  anchor: {
    analogy:
      'A pilot who hears a warning stops the maneuver that set it off, calls it to the crew and keeps the aircraft flying while the cause is worked out; the planned flight is taken up again only once the checks are done.',
    precise:
      'The first response to deterioration does not wait for its cause: stop the provoking action, announce the change, and assess and support oxygenation and ventilation with the supervisor and team. Causes coexist, so reassess after each response; an interrupted procedure resumes only after responsiveness, breathing, oxygenation, circulation and the plan have been rechecked and a new decision made.',
    checklistLabel: 'When the patient changes',
    checklist: [
      'Stop what is provoking it',
      'Say it aloud to the team and the supervisor',
      'Assess and support the airway, breathing and oxygenation',
      'Reassess before any decision to resume',
    ],
  },

  spineStops: [],
  grammarRowIds: ['effort-down-oxygenation-held'],
  controlStrip: {
    verdict: 'no-control-stop-and-communicate',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'not-this-one',
      accessory: 'not-this-one',
    },
    sentence:
      'No control fixes a patient who is deteriorating: stop what is provoking the change and say it aloud. Advancing on to finish the inspection keeps provoking it; in a routine inspection the team may bring the scope back or out when that will help breathing.',
  },
  precommitDenyPatterns: [
    /\bpause (the|this) (inspection|examination|procedure|survey)\b/i,
    /\bannounc\w*/i,
    /\bresponse bundle\b/i,
    /\bbefore (its|the) cause is (known|settled)\b/i,
    /\bwhatever the cause\b/i,
  ],
  modelBoundary:
    'The monitor and every frame in this section are scripted in words for teaching. They are not a physiological model: where a patient settles, it is because the scripted team treated the cause, not because of a choice on this card. No value here is a threshold, a dose or a rescue step for your patient; those come from your institution’s approved pathways.',
  physicalSkillNote:
    'Calling the pause, running the team’s response and supporting the airway are team and hand skills. This section teaches the first decisions; the response itself is practiced in faculty-observed simulation and in the institution’s resuscitation training, which no part of this course replaces.',
  localPolicyIds: ['sedation_policy', 'topical_anesthetic_policy', 'recovery_and_followup'],
  reviewItemIds: ['R11', 'R12', 'R14', 'R34'],

  blocks: [
    {
      id: 'breathing-changes',
      kind: 'question',
      role: 'framing',
      heading: 'A change in the patient during an inspection',
      body: 'A routine inspection runs under topical anesthetic and often sedation, in the airway the patient is breathing through. The breathing, color, responsiveness or circulation can change while the view on the screen stays clear.\n\nThis section is about the first moments after that change: what the team can see, and what should decide what happens next.',
      claimClass: 'synthesis',
      sourceRefs: [S1_RESPONSE, S2_COMPLICATIONS],
    },
    {
      id: 'what-can-change',
      kind: 'signals',
      role: 'signals',
      heading: 'What the team can see change',
      body: 'Each of these can change during a routine inspection. Compare each with this patient’s own state at the start of the procedure, not with a remembered number.',
      pointsLabel: 'Signals that can change',
      points: [
        'Responsiveness and behavior, including how the patient answers when spoken to',
        'Respiratory effort and rhythm, and any new sound such as a wheeze',
        'Airflow at the mouth and nose, and chest movement',
        'The capnography trace, where a reliable one can be obtained; during open-airway bronchoscopy the sampling can distort it, so a doubtful trace is checked against the patient rather than trusted alone',
        'Oximetry and the patient’s color',
        'Heart rate, rhythm and blood pressure',
      ],
      claimClass: 'source',
      sourceRefs: [S1_RECOGNITION, S1_SPASM, S1_TOPICAL_EVENTS, U1_MONITORING],
      reviewItemIds: ['R12'],
    },
    {
      id: 'inspection-to-plan',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'An inspection going to plan',
      body: 'In a routine inspection going to plan, the patient stays at the planned depth of sedation and responds purposefully when asked. Effort, airflow and the capnography trace keep the pattern seen at the start; oximetry stays at, or comes promptly back to, the patient’s own starting value after a brief dip with suction; and pulse and blood pressure change in step with stimulation and medication timing, then settle. The monitoring clinician watches the patient as well as the screen.\n\nThat is the reference every change is measured against: this patient’s own earlier state.',
      claimClass: 'synthesis',
      sourceRefs: [S1_RECOGNITION, S1_MONITORING_TEAM, S1_VENTILATION, U1_MONITORING],
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'response-bundle',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'One response before the cause is known',
      body: 'At introductory level, deterioration is answered with a bundle, not a cause-specific trick. The change is detected; the provoking action stops, whether advancing, lavage, sampling, further topical agent or unnecessary suction; the change is announced and the supervisor brought in; and the airway, respiratory effort, oxygen delivery and sedation state are assessed. The qualified team then supports oxygenation and ventilation, with airway-opening maneuvers and assisted ventilation when needed, and changes the scope’s position or removes it when that will improve ventilation safely.\n\nThe priority depends on what the scope is doing. A routine inspection can be interrupted readily, and the scope brought back or out when that will improve breathing. A scope providing tamponade in active bleeding is different and is not withdrawn by reflex; the next section takes up that case.',
      claimClass: 'synthesis',
      sourceRefs: [
        S1_RESPONSE,
        S1_TAMPONADE,
        S1_VENTILATION,
        S1_RECOGNITION,
        S2_COMPLICATIONS,
        S2_ESCALATION,
      ],
      reviewItemIds: ['R34'],
    },
    {
      id: 'causes-and-escalation',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Causes to recognize, and who takes over',
      body: 'Events coexist. A coughing patient can have bronchospasm, mucosal trauma and hypoxemia at once, and a sedated patient can be hypoventilating before the saturation falls. Reassess after each response rather than assuming the first label explains everything. The recognition below is yours; the rescue belongs to the qualified team.',
      pointsLabel: 'The presentation, then the escalation',
      points: [
        'Bronchospasm: wheeze, impaired ventilation, a harder breath out, or rising airway pressures on a ventilator. Stop stimulating; the team gives the airway and medication response. Keep a mucus plug, obstruction by the scope or a tube, and oversedation in mind.',
        'Laryngospasm: closure of the upper airway with instrumentation, which can stop airflow. Stop stimulating and announce it; airway rescue is not delayed while a drug is chosen from a list.',
        'Pneumothorax: pleuritic pain, new breathlessness, a falling saturation or instability, especially after transbronchial biopsy, and possibly later in a patient who was stable at the end of the procedure. Tell the responsible clinician and image when indicated; suspected tension physiology is treated urgently, without waiting for an image.',
        'Local-anesthetic toxicity: neurological symptoms such as tinnitus, a metallic taste, altered mental status or seizure, and cardiovascular instability or arrhythmia; sedation can obscure the early symptoms. Stop the local anesthetic, get help at once, support oxygenation and ventilation, and use the approved LAST pathway and its checklist.',
        'Other medication events: sedative respiratory depression, which can return as a reversal agent wears off; persistent cyanosis or a low saturation after a topical agent, which widens the differential to methemoglobinemia.',
        'Arrhythmia, hypotension, a vasovagal event, aspiration, an allergic reaction or equipment failure: each also stops the provoking action and calls for a structured clinical response.',
      ],
      claimClass: 'source',
      sourceRefs: [
        S1_SPASM,
        S2_SPASM,
        S1_PNEUMOTHORAX,
        S2_PNEUMOTHORAX,
        S1_TOPICAL_EVENTS,
        U4_LAST,
        S1_REVERSAL,
        U1_REVERSAL,
      ],
      reviewItemIds: ['R14'],
    },
    {
      id: 'before-resuming',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Before the inspection goes on',
      body: 'An interrupted procedure resumes only on a new decision, made by the supervising team and said aloud. Before it, the patient is rechecked against the start of the procedure, and so are the scope and the plan.\n\nIf a reversal agent was given, sedation can return as it wears off, so observation continues whatever is decided. The decision may be to resume, to change the plan or to end the procedure; a deliberate limitation documented honestly is better than an unsafe attempt to check every box.',
      pointsLabel: 'What is rechecked before resuming',
      points: [
        'Responsiveness and the depth of sedation',
        'Airway patency, respiratory effort, airflow and the capnography trace',
        'Oximetry on the oxygen now being given, and pulse and blood pressure',
        'Whether the cause is understood, and what medication has been given since the start',
        'Whether the rest of the inspection or sampling is still worth its risk',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_RECOGNITION, S1_VENTILATION, ...S1_SAFETY_FIRST, U1_REVERSAL_RECOVERY],
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors answers a change with a single guess instead of the response.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Answering restlessness with more sedation: first consider hypoxemia, obstruction, discomfort and other causes.',
        'Finishing the inspection because the view is clear: a clear view does not show that the patient is breathing adequately, so pause and assess first.',
        'Treating the saturation as the whole picture: effort, airflow and capnography can change first, and added oxygen can hold the saturation up.',
        'Stopping at the first label: events coexist, so reassess after each response.',
        'Waiting for an image, or for a single ultrasound finding or waveform, before calling for help: escalate on the clinical picture.',
        'Resuming because the numbers have settled: resuming is a new decision, made after the patient, the scope and the plan are rechecked.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [S1_RECOGNITION, S1_VENTILATION, S1_RESPONSE, S1_PNEUMOTHORAX, T09_SHORTCUTS],
    },
    {
      id: 'institution-supplies',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'What your institution supplies',
      body: 'The rescue itself belongs to the institution’s approved pathways and the qualified team: the airway and medication responses for bronchospasm and laryngospasm, reversal agents and their doses, the LAST checklist and its rescue kit, and the criteria for recovery and discharge. The current LAST checklist sets out a resuscitation that differs from routine advanced life support; know where it and the rescue equipment are before the list begins. This course names the first safe actions and reproduces no rescue doses and no drug algorithm.\n\nReversal is given for a medication-related problem, not as a planned shortcut to discharge. The 2011 training manual’s fixed reversal instructions are not carried forward. Completing this course does not replace institutional resuscitation training.',
      claimClass: 'local-policy',
      sourceRefs: [U4_LAST, U1_REVERSAL_RECOVERY, S2_REVERSAL],
      localPolicyIds: ['sedation_policy', 'topical_anesthetic_policy', 'recovery_and_followup'],
      reviewItemIds: ['R14'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'The patient midway through a routine inspection under moderate sedation — scripted for teaching',
    readings: [
      {
        channel: 'airway-view',
        words: 'A clear view of the left lower lobe bronchus; the mucosa looks normal',
        trend: 'steady',
      },
      { channel: 'responsiveness', words: 'Restless, pulling at the drapes', trend: 'new' },
      {
        channel: 'respiratory-effort',
        words: 'Faster, with shallower breaths than at the start',
        trend: 'rising',
      },
      {
        channel: 'capnography',
        words: 'Smaller and less regular than at the start',
        trend: 'falling',
      },
      {
        channel: 'oximetry',
        words: 'Falling from the patient’s own starting value',
        trend: 'falling',
      },
      { channel: 'heart-rate', words: 'Faster than at the start', trend: 'rising' },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel: what the airway view shows, and what each of the patient’s signals is doing compared with the start of the procedure.',
      lookIn: { pane: 'simulator', landmark: SIMULATOR_LANDMARKS.monitor },
    },
    act: {
      title: 'Changes on one bronchoscopy list',
      instruction:
        'For each frame, read the situation on this card and the monitor in the Simulator panel, then choose the next move in the decision on this card. A move that would harm the patient is refused, and the frame stays.',
      lookIn: {
        pane: 'steps',
        landmark: STEPS_LANDMARKS.decision,
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.monitor,
      },
    },
    explain: {
      title: 'One response before the cause',
      instruction: `Read ${STEPS_LANDMARKS.verdict} and why the other answers do not fit; then, in the Teaching panel, ${TEACHING_LANDMARKS.adds}, “One response before the cause is known” and “Before the inspection goes on”.`,
    },
  },

  act: {
    kind: 'scenario',
    scenario: {
      id: 'bronchoscopy-list',
      title: 'Changes on one morning’s bronchoscopy list',
      boundary:
        'The monitor is scripted in words for teaching, not a physiological model. Each frame teaches a decision; nothing here is a dose, a threshold or a rescue protocol, and where a patient settles it is because the scripted team treated the cause.',
      frames: [
        {
          id: 'wheeze',
          situation:
            'The first patient on the list is having a routine inspection under moderate sedation and topical anesthetic. As the scope enters the right lower lobe bronchus, the patient starts to cough and a wheeze is heard. Each breath out has become slow and effortful, and oximetry is falling from its starting value. The view is clear, with no secretions or blood.',
          readings: [
            { channel: 'responsiveness', words: 'Awake and coughing', trend: 'new' },
            {
              channel: 'respiratory-effort',
              words: 'Harder, with a slow, effortful breath out and a wheeze',
              trend: 'rising',
            },
            {
              channel: 'capnography',
              words: 'The trace has changed from its earlier shape',
              trend: 'new',
            },
            {
              channel: 'oximetry',
              words: 'Falling from the patient’s own starting value',
              trend: 'falling',
            },
            {
              channel: 'airway-view',
              words: 'The right lower lobe bronchus, clearly seen; no secretions or blood',
              trend: 'steady',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Pause the inspection, say what is happening, and have the supervisor assess breathing',
              rationale:
                'A wheeze, a slow, effortful breath out and a falling oximetry trend after the scope entered a lobe fit bronchospasm, though other causes stay open. Pausing the stimulation, saying it aloud and bringing the supervisor in starts the response; the qualified team gives the airway and medication response, and in a routine inspection the scope can come back or out when that will help breathing.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Tell the supervisor, then move quickly through the remaining segments to finish',
              rationale:
                'Telling the supervisor is right, but pushing on keeps stimulating an airway that is already reacting, and every segment entered delays the response. A routine inspection can be interrupted at once; bronchospasm is not managed by continuing to push the scope.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label:
                'Tell the team the cough means secretions, and suction the segment repeatedly to clear them',
              rationale:
                'The view shows no secretions, so a plug is one possibility among several, not the answer. Naming one cause to the team is not the same as assessing breathing, and repeated suction keeps stimulating the airway and removes gas as well as fluid while oximetry is already falling.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Keep the scope still in the right lower lobe bronchus, so that moving it does not provoke more spasm',
              rationale:
                'In a routine inspection the scope is not protecting anything, so the team can bring it back or out when that helps breathing. Not withdrawing by reflex applies to a scope providing tamponade in active bleeding, which this one is not; left in the lobe, the scope keeps stimulating the airway and adds to the obstruction.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
        {
          id: 'settled',
          situation:
            'For the first patient, the supervisor and team have given the airway and medication response under the approved protocol. The wheeze has eased and oximetry is back at its starting value, but on more oxygen than at the start, and the patient is slower to answer than before the event. The left lung has not been inspected yet, and the operator asks to carry on.',
          readings: [
            {
              channel: 'responsiveness',
              words: 'Slower to answer than at the start',
              trend: 'falling',
            },
            {
              channel: 'respiratory-effort',
              words: 'Easier; no wheeze heard',
              trend: 'steady',
            },
            {
              channel: 'capnography',
              words: 'Back to its earlier shape',
              trend: 'steady',
            },
            {
              channel: 'oximetry',
              words: 'Back at the starting value, on more oxygen than at the start',
              trend: 'steady',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Recheck breathing, oxygenation, sedation and the plan, then decide with the supervisor',
              rationale:
                'The wheeze has eased, but the event has not been explained, oximetry holds its starting value only on more oxygen, and the patient is slower to answer than at the start. Before any more inspection the team rechecks responsiveness, the airway, effort, the capnography trace, oximetry and circulation against the start, asks whether the cause is understood and the rest is worth its risk, and makes a new decision aloud with the supervisor: resume, change the plan or end the procedure.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Tell the supervisor oximetry is back at its starting value, and carry on with the left lung',
              rationale:
                'Oximetry is back only on more oxygen than at the start, and the patient is slower to answer than before the event, which has not been explained. A settled number is one part of the recheck, not the decision to resume.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label:
                'Give a further sedative dose to keep the cough away, then carry on with the left lung',
              rationale:
                'The patient is already slower to answer than at the start. Adding sedation straight after a respiratory event, before the recheck, can deepen sedation and depress breathing further; any further sedation is decided after the recheck under the approved sedation pathway.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label: 'Tell the supervisor the wheeze could return, and end the procedure here',
              rationale:
                'Ending the procedure may turn out to be right, but it is a decision the supervising team makes after the recheck, weighing whether the rest is worth its risk, not a reflex to the event. The patient, slower to answer and on more oxygen, still needs that recheck and continued observation whatever is decided.',
              plausibility: 'reasonable-but-incomplete',
            },
          ],
        },
        {
          id: 'low-saturation',
          situation:
            'The second patient, under moderate sedation for a routine inspection, had topical benzocaine to the throat before the scope went in. Midway through, the lips look gray-blue and oximetry reads below its starting value; it stays there after the oxygen flow is increased. The patient answers questions, breathing is comfortable, airflow is felt at the mouth and nose, and the capnography trace keeps its earlier shape.',
          readings: [
            { channel: 'responsiveness', words: 'Awake and answering questions', trend: 'steady' },
            {
              channel: 'respiratory-effort',
              words: 'Comfortable, as at the start',
              trend: 'steady',
            },
            { channel: 'airflow', words: 'Felt at the mouth and nose', trend: 'steady' },
            {
              channel: 'capnography',
              words: 'The trace keeps its earlier shape',
              trend: 'steady',
            },
            {
              channel: 'oximetry',
              words: 'Below the starting value, and unchanged after more oxygen',
              trend: 'new',
            },
            {
              channel: 'airway-view',
              words: 'A clear view of the left upper lobe bronchus',
              trend: 'steady',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Pause, stop further topical agent, and have the team evaluate the low oximetry reading',
              rationale:
                'Gray-blue lips and a low saturation that does not rise with more oxygen, in an alert patient breathing comfortably after topical benzocaine, suggest a problem beyond oxygen delivery; benzocaine-associated methemoglobinemia is one possibility. The inspection pauses, no more topical agent is given, and the supervisor and clinical team evaluate the finding with the appropriate study.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Put the low oximetry reading down to the probe, and resite it before telling the team',
              rationale:
                'Gray-blue lips agree with the low reading, so this is not an artifact to fix before anyone is told. Resiting a probe can accompany saying the finding aloud and evaluating it, but it does not replace them, and a low saturation that does not rise with more oxygen after a topical agent widens the differential to a medication cause.',
              plausibility: 'incorrect-mechanism',
            },
            {
              id: 'c',
              label:
                'Tell the supervisor the patient is alert and moving air well, and carry on with the inspection',
              rationale:
                'Comfortable breathing, airflow and an unchanged capnography trace speak for ventilation, not for how the blood carries oxygen. Persistent cyanosis with a low reading is a finding to evaluate, not one to explain away by the patient’s comfort, and carrying on leaves it unexplained.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Ask for sedative reversal to treat oversedation as the cause of the low oximetry',
              rationale:
                'Oversedation lowers the saturation by reducing ventilation; here responsiveness, effort, airflow and the capnography trace are unchanged from the start, and a saturation that does not rise with more oxygen suggests another cause. After topical benzocaine the team evaluates for a medication cause such as methemoglobinemia.',
              plausibility: 'incorrect-mechanism',
            },
          ],
        },
        {
          id: 'chest-pain',
          situation:
            'The third patient is having a supervised bronchoscopy with transbronchial biopsy of the right lower lobe. Soon after a sample is taken, the patient reports sharp right-sided chest pain on breathing in and becomes more breathless. Oximetry and blood pressure are falling and the heart rate is rising from their starting values. The view shows no bleeding.',
          readings: [
            {
              channel: 'responsiveness',
              words: 'Awake and distressed; reports right-sided chest pain',
              trend: 'new',
            },
            {
              channel: 'respiratory-effort',
              words: 'Faster and harder than before',
              trend: 'rising',
            },
            { channel: 'oximetry', words: 'Falling from the starting value', trend: 'falling' },
            { channel: 'heart-rate', words: 'Rising from the starting value', trend: 'rising' },
            {
              channel: 'blood-pressure',
              words: 'Falling from the starting value',
              trend: 'falling',
            },
            {
              channel: 'airway-view',
              words: 'The biopsied segment; no bleeding seen',
              trend: 'steady',
            },
          ],
          prompt: 'What is the next move?',
          choices: [
            {
              id: 'a',
              label:
                'Stop sampling, say it aloud, and call urgent expert help while breathing is supported',
              rationale:
                'New one-sided pleuritic pain, breathlessness and a falling oximetry trend soon after a transbronchial biopsy raise a pneumothorax, and a falling blood pressure with a rising heart rate raises tension physiology. Sampling stops, the change is said aloud, and urgent expert treatment is sought while oxygenation and ventilation are supported; suspected tension physiology does not wait for confirmatory imaging.',
              plausibility: 'best',
            },
            {
              id: 'b',
              label:
                'Stop sampling, withdraw the scope, and send the patient to recovery to be reassessed',
              rationale:
                'Stopping is right, but new pleuritic pain, breathlessness and a falling blood pressure with a rising heart rate soon after a transbronchial biopsy raise tension physiology, which needs urgent expert treatment now. Moving the patient on to be reassessed later delays that treatment, and nobody has yet been told.',
              plausibility: 'unsafe',
            },
            {
              id: 'c',
              label:
                'Tell the supervisor about the pain, and take the remaining planned samples first',
              rationale:
                'Pain might be put down to sampling, but it does not explain new breathlessness, a falling oximetry trend and a falling blood pressure with a rising heart rate. Further sampling adds to whatever has happened and delays the response.',
              plausibility: 'unsafe',
            },
            {
              id: 'd',
              label:
                'Look for a single ultrasound sign, and let that finding decide whether anyone is called',
              rationale:
                'A lung-ultrasound finding or a single waveform cannot, by itself, settle every cause of sudden deterioration, and with the blood pressure falling, making the call wait on one sign delays urgent expert treatment. The change is said aloud and help called on the clinical picture; any study the team chooses comes alongside that, not before it.',
              plausibility: 'unsafe',
            },
          ],
        },
      ],
      sourceRefs: [
        S1_SPASM,
        S2_SPASM,
        S1_RESPONSE,
        S1_TAMPONADE,
        S1_RECOGNITION,
        S1_VENTILATION,
        S1_REVERSAL,
        S1_TOPICAL_EVENTS,
        S1_PNEUMOTHORAX,
        S2_PNEUMOTHORAX,
        T09_SHORTCUTS,
        U1_REVERSAL_RECOVERY,
      ],
    },
  },

  prediction: {
    id: 'N11',
    itemType: 'management-decision',
    situation:
      'Midway through a routine inspection under moderate sedation, with a clear view of the left lower lobe bronchus, the patient becomes restless and pulls at the drapes. Breathing is faster and shallower than at the start, the capnography trace has become smaller and less regular, and oximetry has begun to fall from the patient’s own starting value. The nurse offers a further dose of the sedative so that the patient settles.',
    stem: 'What should happen next?',
    choices: [
      {
        id: 'a',
        label:
          'Pause the inspection, say what has changed, and assess airway, breathing and sedation',
        rationale:
          'Restlessness with faster, shallower breathing, a smaller, less regular capnography trace and a falling oximetry trend is a deterioration until shown otherwise: hypoxemia, obstruction, hypoventilation or discomfort could each produce it. Pausing, saying it aloud and assessing the airway, effort, oxygen delivery and sedation state lets the team find which, and support breathing meanwhile.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Tell the supervisor the patient is restless, and give the further dose the nurse offers',
        rationale:
          'Saying it aloud is right, but with these changes in breathing and oxygenation the restlessness may be the response to hypoxemia or obstruction. Sedating before breathing is assessed leaves that cause unassessed and can deepen it; restlessness is not by itself a call for more sedation.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Say that oximetry is falling, turn up the oxygen, and carry on with the inspection',
        rationale:
          'Announcing one number is not assessing the patient. The saturation is only one of the signals that have changed; effort and the capnography trace have changed too. More oxygen can hold the saturation while ventilation keeps falling, and carrying on leaves the cause unassessed.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Withdraw the scope, tell the supervisor, and book the rest of the inspection for later',
        rationale:
          'Withdrawing and telling the supervisor are both part of the response in a routine inspection, where the scope can come out when that helps breathing. But the airway, effort, oxygen delivery and sedation state still have to be assessed, and resuming or ending the procedure is decided after that reassessment, not booked in advance.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Restlessness during a sedated inspection, with faster, shallower breathing, a smaller, less regular capnography trace and falling oximetry, is a deterioration whose cause is not yet known: hypoxemia, obstruction, hypoventilation or discomfort could each produce it. The first response is the same whatever the cause: pause the inspection, announce the change, and assess the airway, respiratory effort, oxygen delivery and sedation state while the team supports breathing. More sedation, or more oxygen with the inspection carried on, each acts on a single guess: added oxygen supports oxygenation but assesses nothing, and it can hold the saturation while ventilation falls. Withdrawing and telling the supervisor still leave the change unassessed, and whether to resume or end the procedure is decided only after reassessment.',
    objectiveIds: ['M15-O1'],
    claimClass: 'source',
    sourceRefs: [S1_RECOGNITION, S1_VENTILATION],
  },

  transfer: {
    id: 'deterioration-transfer',
    itemType: 'management-decision',
    situation:
      'A physician in training is the designated clinician monitoring a patient under moderate sedation while a forceps sample is being taken. The operator and supervisor are watching the screen as the forceps close. The patient’s breathing has become noisy and gurgling, secretions are pooling at the mouth, and oximetry is falling from its starting value. Neither the operator nor the supervisor has looked up.',
    stem: 'What should the monitoring clinician do first?',
    choices: [
      {
        id: 'a',
        label:
          'Say aloud what has changed, and support the airway while the operator stops sampling',
        rationale:
          'Noisy, gurgling breathing with secretions at the mouth and a falling oximetry trend mean the airway is compromised now, and the team at the screen has not seen it. Whoever sees the change calls it: saying it aloud stops the sampling and brings the supervisor in, while clearing and supporting the airway begin at once rather than waiting for them.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Wait for the forceps to come out, then tell the operator and supervisor what has changed',
        rationale:
          'The screen reports nothing about the patient’s breathing, and waiting for the sample lets the airway fill and oximetry fall while nobody else knows. A monitoring clinician separate from the operator is there so that someone watching the patient can interrupt.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Turn up the oxygen and keep watching, and call out if oximetry keeps falling',
        rationale:
          'More oxygen does not clear an airway filling with secretions, and oximetry is already falling. Waiting for a further fall before calling out leaves the change unannounced while the sampling goes on.',
        plausibility: 'unsafe',
      },
      {
        id: 'd',
        label:
          'Clear the mouth with the oral suction, and let the operator finish taking the sample',
        rationale:
          'Clearing the mouth is part of supporting the airway, but done without a word it leaves the operator sampling and the supervisor unaware while oximetry falls. The change is said aloud, and sampling stops while the airway is supported.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'Noisy, gurgling breathing with secretions pooling and a falling oximetry trend is a change in the patient that the screen does not show, and a team watching a sample may not see it. The response bundle belongs to the whole team: whoever sees the change says it aloud, the provoking action stops, and the airway is cleared and supported at once while the supervisor joins. A monitoring clinician separate from the operator is there so that someone watching the patient can call it.',
    objectiveIds: ['M15-O1'],
    claimClass: 'synthesis',
    sourceRefs: [S1_MONITORING_TEAM, S1_RECOGNITION, U1_MONITORING],
    reviewItemIds: ['R11'],
    transferVariant:
      'A different team member, phase and signal: the learner is the designated monitoring clinician, the operator and supervisor are absorbed in a forceps sample, and the change is noisy, secretion-filled breathing with falling oximetry rather than a restless patient with fast, shallow breaths during an inspection.',
    retrievesFrom: 'shared-airway',
  },

  practice: [
    {
      id: 'C08',
      manifestCaseId: 'C08',
      presentationTitle: 'New chest pain and breathlessness in recovery after a biopsy',
      situation:
        'A 48-year-old man had a supervised bronchoscopy with transbronchial lung biopsy. His immediate end-of-procedure observation was reassuring, and the procedure note records it as uneventful. Later in recovery he develops pleuritic chest pain and worsening breathlessness. He had been expected to go home once recovery was complete.',
      item: {
        id: 'C08',
        itemType: 'management-decision',
        stem: 'What should happen next?',
        choices: [
          {
            id: 'a',
            label:
              'Reassess him now, tell the responsible clinician, and evaluate for a pneumothorax',
            rationale:
              'New pleuritic pain and worsening breathlessness after a transbronchial biopsy call for prompt reassessment of symptoms, vital signs, oxygenation and respiratory findings, and the responsible clinician is told. Pneumothorax and other complications are evaluated, with imaging when indicated; instability suggesting tension physiology would not wait for routine imaging.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Record the new pain, and discharge him as planned on the uneventful procedure note',
            rationale:
              'Recording a symptom is not assessing it. A stable immediate recovery is not proof that a later complication cannot occur, and sending him home on the strength of the earlier note is the critical error this case names.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Reassure him on the strength of his normal observation straight after the procedure',
            rationale:
              'A normal immediate observation period does not exclude a pneumothorax. A patient who was stable at the end of a bronchoscopy can deteriorate later, and reassurance without reassessment leaves these new symptoms unevaluated.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Tell the responsible clinician it is a pneumothorax, and wait for the chest image first',
            rationale:
              'Telling the clinician is right, but new symptoms raise a pneumothorax without confirming one, and other complications stay on the list. He is reassessed now; imaging is used when indicated, and instability would not wait for it.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A patient who was stable at the end of a bronchoscopy can deteriorate later, especially after transbronchial biopsy, so new pleuritic pain and breathlessness are reassessed on their own terms rather than against the earlier note. The responsible clinician is told, pneumothorax and other complications are evaluated with imaging when indicated, and suspected tension physiology is treated urgently without waiting for imaging. Disposition follows the findings, and the event is documented.',
        objectiveIds: ['M15-O3'],
        claimClass: 'source',
        sourceRefs: [S1_PNEUMOTHORAX, S2_PNEUMOTHORAX],
      },
    },
    {
      id: 'mc-airflow-stops-at-the-cords',
      presentationTitle: 'No airflow as the scope reaches the larynx',
      situation:
        'At the start of an inspection under moderate sedation, the scope has reached the larynx and topical anesthetic has just been applied to the cords. The cords come together and stay together. The patient makes repeated efforts to breathe in and the chest moves, but no airflow is felt at the mouth and nose, and the capnography trace flattens. Oximetry, on supplemental oxygen, has not yet changed from its starting value.',
      item: {
        id: 'mc-airflow-stops-at-the-cords',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Stop stimulating, say it aloud, and have the team open the airway and support breathing',
            rationale:
              'Effort without airflow, a flattening capnography trace and cords that stay closed as the scope reaches them mean the upper airway has closed; laryngospasm is likely, with other obstruction still possible. Stimulation stops, the problem is said aloud, and the qualified team opens the airway and supports oxygenation and ventilation, giving any medication under the approved protocol.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Say it aloud, and advance the scope through the closed cords to hold the airway open',
            rationale:
              'Saying it aloud is right, but the glottis is crossed under vision while it is open, not by pushing against closed folds. Forcing the scope through adds stimulation at the very structure that has closed, and it is not a rescue: laryngospasm is not managed by continuing to push the scope.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Hold the scope still and wait for the closure to ease while oximetry is unchanged',
            rationale:
              'On supplemental oxygen the saturation can hold for a time while no air moves, and holding the scope at the cords keeps stimulating them. Effort without airflow and a flat capnography trace are the signals to act on now, not the oximeter.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Ask the team for one drug by name, and hold every other step until it has been given',
            rationale:
              'A single drug name is not a plan for a closed upper airway, and holding every other step until it is given delays airway rescue while no air moves. The team opens the airway and supports breathing while any medication is given under the approved protocol.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Chest movement without airflow, with a flattening capnography trace, means the upper airway is obstructed even while oximetry holds on added oxygen; with the cords seen to close as the scope reaches them, laryngospasm is likely. The response does not wait for a drug: stimulation stops, the problem is said aloud, and the qualified team opens the airway and supports ventilation, with any medication response under the approved protocol. Pushing the scope through closed cords is not a rescue.',
        objectiveIds: ['M15-O3'],
        claimClass: 'source',
        sourceRefs: [S1_SPASM, S2_SPASM, S1_RESPONSE, S2_GLOTTIS, S3_GLOTTIS],
      },
    },
  ],
}
