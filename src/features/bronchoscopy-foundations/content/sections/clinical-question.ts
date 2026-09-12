import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M02 — Patient assessment and a patient-centered plan. The foundation section of the Prepare
 * phase: before anything is prepared, the learner decides what a requested bronchoscopy is for,
 * weighs it against the reasonable alternatives at this patient's known risk, and builds a plan
 * that holds only what is known — then carries it into consent (teach-back) and the time-out.
 * Knowledge spec §7–§8 (S1 PDF 35–50, 75–79, 111–120, 129–130, 134–144, 154–158; S2 PDF 50–59,
 * 155–156; S3 PDF 47–50; T07; T09; T15; U2; U7) and case C03 (spec lines 1772–1782).
 */
export const section: BronchSectionDefinition = {
  id: 'clinical-question',
  title: 'The request and the plan',
  shortTitle: 'Request and plan',
  minutes: 6,
  moduleIds: ['M02'],
  objectives: [
    {
      objectiveId: 'M02-O1',
      subtask:
        'Commits, in the transfer, to establishing a missing current oxygen requirement before the plan is fixed, rather than assuming none, assuming the worst or cancelling; places two incomplete requests under “Not provided — must clarify” in the sort. The four-box plan itself is shown worked in “The lavage request, worked into a plan”; constructing one is observed in supervised practice.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M02-O2',
      subtask:
        'Decides, in a practice case, the next move for a biopsy request in a patient on dual antiplatelet therapy after a recent coronary stent, where patient, procedure and prescribing-team factors change the plan.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M02-O3',
      subtask:
        'Reads how consent is explained and checked with teach-back, in the block on the consent conversation; the conversation itself is observed with a patient in supervised practice.',
      evidence: 'not-app-assessable',
    },
    {
      objectiveId: 'M02-O4',
      subtask:
        'Decides, in a practice case, what happens when the signed consent names a different side from the request and the CT at the time-out.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M02-O5',
      subtask:
        'Commits a justification for a requested diagnostic bronchoscopy, then sorts eight requests between noninvasive, bronchoscopic and not-yet-decidable pathways.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: [],
  prerequisites: ['shared-airway'],

  clinicalQuestion:
    'A bronchoscopy has been requested for your patient. What decides whether it should go ahead, and what must the plan hold before it does?',
  recognizeTitle: 'A lavage request for an opacity that has come back',
  objective:
    'Decide whether a requested diagnostic bronchoscopy is justified for a particular patient, and what its plan must contain before the procedure goes ahead.',
  why: 'Every bronchoscopy puts a scope into the airway the patient breathes through, and a request often arrives before anyone has written a plan. What the plan rests on then decides what the patient consents to and what the team checks at the time-out.',
  newConcept:
    'A request names a procedure; what justifies it is the clinical question — what its likely result would change for this patient, beyond the reasonable alternatives, at a risk that is known and acceptable.',
  incrementSentence:
    'This section adds one idea to the shared airway: the airway is entered only for a reason, and the reason is a question whose answer would change this patient’s care — not the instrument that is free or the procedure a referral names.',
  harmfulReflex:
    'Doing the procedure the request names because a bronchoscope is free, and filling any missing fact with an assumption so that it can go ahead.',
  anchor: {
    analogy:
      'A request that names only a procedure is like a drug order with no indication: before acting on it, find out what it is for and whether another option would serve as well.',
    precise:
      'A diagnostic bronchoscopy is justified when the information or efficiency it adds would change this patient’s management beyond what the reasonable alternatives can, at a risk the supervisor and the patient accept. Each fact that decision depends on is either known or recorded as not provided — never assumed.',
    checklistLabel: 'Say what the procedure is for, in four parts',
    checklist: [
      'The question is …',
      'The target is …',
      'The proposed sample or intervention is …',
      'The expected result would change …',
    ],
  },

  spineStops: [],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'monitoring',
      rotation: 'monitoring',
      deflection: 'monitoring',
      suction: 'monitoring',
      accessory: 'monitoring',
    },
    sentence:
      'No control here. This decision is made before anyone picks up the scope: the question, the plan and the consent come first, and none of the five controls changes them.',
  },
  precommitDenyPatterns: [
    /would change/i,
    /less invasive/i,
    /\balternatives?\b/i,
    /acceptable risk/i,
    /airway cause/i,
  ],
  modelBoundary:
    'The requests, patients and records in this section are constructed for teaching. Nothing here calculates for a patient: antithrombotic interruption, sedation and staffing follow your institution’s approved policies. The consent conversation and the time-out are team skills shown with a real patient and team, not on this page.',
  localPolicyIds: ['antithrombotic_policy', 'sedation_policy', 'critical_airway_pathway'],
  reviewItemIds: ['R09', 'R10'],

  blocks: [
    {
      id: 'a-request-arrives',
      kind: 'question',
      role: 'framing',
      heading: 'A request arrives',
      body: 'A bronchoscopy often begins as a request from another team: a named procedure, a patient and a reason, sometimes in a single line. Before anything is prepared, the bronchoscopist and the supervisor decide whether to do it and what exactly it should include.\n\nThis section is about what that decision rests on, and how it carries into the consent conversation and the time-out.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
      ],
    },
    {
      id: 'in-front-of-you',
      kind: 'signals',
      role: 'signals',
      heading: 'What is in front of you',
      body: 'Each of these can bear on a request. Before committing, decide which of them your decision rests on.',
      pointsLabel: 'Information and circumstances around a request',
      points: [
        'The referral’s wording and the procedure it names',
        'The imaging and its report',
        'Respiratory reserve, current support, airway and bleeding history',
        'The medication list, including antithrombotic drugs',
        'The bronchoscope, room and staff free today',
        'A trainee’s need for supervised procedures',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 116 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 50 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 56 } },
      ],
    },
    {
      id: 'question-before-instrument',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What counts as an indication',
      body: 'Relevant indications include selected airway abnormalities, suspected endobronchial lesions, localized or unexplained collapse, selected infectious or parenchymal processes that need directed sampling, and targeted secretion management when appropriate. An imaging abnormality or a cough alone is not an automatic indication.\n\nBronchoscopy is not a routine substitute for noninvasive evaluation or ordinary airway clearance.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
      ],
    },
    {
      id: 'two-questions',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Two questions before a diagnostic bronchoscopy',
      body: 'Two questions come first. Will bronchoscopy improve diagnostic yield or efficiency over the alternatives available? Is there an important alternative diagnosis the referral label may have missed? Recurrent “pneumonia” may be obstruction, aspiration, a retained foreign body or a noninfectious process, and a routine, uncomplicated infection is not made an indication because a bronchoscope is available.\n\nThe pathways in the sort are reasoning prompts, not automatic indications. In suspected tuberculosis, a dry cough does not by itself mean that sputum induction or another noninvasive approach should be skipped.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:05:45', end: '00:11:55' } },
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:07:58', end: '00:09:34' } },
      ],
      reviewItemIds: ['R09'],
    },
    {
      id: 'noninvasive-first',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When a noninvasive sample answers the question',
      body: 'In suspected ventilator-associated pneumonia, the added information from lavage may justify it in selected cases, but routine bronchoscopy should not be inferred from fever in an intubated patient. The 2016 ATS/IDSA guideline recommends noninvasive endotracheal sampling with semiquantitative cultures rather than routine invasive quantitative sampling — a weak recommendation from low-quality evidence.\n\nThat does not remove a separate reason for bronchoscopy: airway inspection, secretion clearance or the evaluation of another diagnosis.',
      claimClass: 'update',
      sourceRefs: [
        {
          sourceId: 'U7',
          location: { kind: 'section', label: 'targeted noninvasive sampling preference' },
        },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:24:36', end: '00:31:59' } },
      ],
    },
    {
      id: 'four-box-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The lavage request, worked into a plan',
      body: 'The man in the prediction has an opacity back in the right lower lobe after treatment, and a request for lavage “for cultures”. Its purpose, in four parts: the question is whether a focal airway process explains the recurrence; the target is the right lower lobe; the proposed sample is a directed specimen if the airway and his physiology permit; the result would change his management if an obstruction or retained material is found.',
      pointsLabel: 'The four-box plan, with a gap left as a gap',
      points: [
        'Initial evaluation: his reserve and current support, medications including antithrombotic drugs, and his preferences. Earlier images, to confirm the opacity is in the same place: not provided — must clarify.',
        'Procedural strategy: inspection with a directed specimen; the alternatives, the important risks, who has the expertise, and consent with teach-back.',
        'Technique and results: sedation and monitoring under the approved pathway, the expected airway path, the main hazard, and the response if the first plan does not work.',
        'Subsequent management: who follows the result, what a nondiagnostic result would mean, referral and team review.',
      ],
      claimClass: 'design',
      sourceRefs: [
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:01:17', end: '00:04:43' } },
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:34:13', end: '00:43:58' } },
      ],
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'what-changes-the-plan',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'What changes the plan',
      body: 'Risk depends on the procedure. Inspection and lavage are not interchangeable with endobronchial or transbronchial biopsy in their bleeding and pneumothorax risks, so a patient may be suitable for one and not the other; equally, one unsafe component does not make every bronchoscopic option unsafe. The supervisor chooses the procedure, setting, personnel and rescue plan against the whole balance of risk and benefit.',
      pointsLabel: 'Patient, procedure and system',
      points: [
        'Patient: respiratory reserve and support, active bronchospasm, obstructive sleep apnea or a previous difficult airway, hemodynamic instability, bleeding history.',
        'Procedure: a biopsy is not a lavage, and a critically narrowed central airway needs a planned difficult-airway strategy before anyone instruments it.',
        'System: missing staff, consent, equipment, specimen support or rescue capability is a reason not to proceed as planned.',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 116 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 129, to: 130 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 134, to: 144 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
      ],
      localPolicyIds: ['critical_airway_pathway'],
    },
    {
      id: 'risk-and-sedation',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Patient risk is not an anesthetic prescription',
      body: 'A higher-risk patient does not by that alone call for general anesthesia or deeper sedation. The patient’s risk, the conditions the procedure needs and the rescue available are weighed separately: disease severity informs risk and staffing, and the sedation and airway strategy is its own judgment under the institution’s sedation pathway.',
      claimClass: 'review-flag',
      sourceRefs: [
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:01:17', end: '00:04:43' } },
      ],
      localPolicyIds: ['sedation_policy'],
      reviewItemIds: ['R10'],
    },
    {
      id: 'antithrombotic-decision',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Antithrombotic drugs: a decision, not a rule',
      body: 'The 2019 joint diagnostic bronchoscopy guideline distinguishes platelet thresholds by procedure, supports selective rather than universal coagulation studies, separates low-dose aspirin from P2Y12 inhibitors for biopsy, and emphasizes consultation when thrombotic risk is high. These distinctions support a decision process, not an automatic hold rule.\n\nInterrupting and resuming a drug needs the exact drug, its indication, renal function where relevant, the procedure’s bleeding risk, recent thrombotic history and the prescribing team’s plan. Do not tell every patient to stop “blood thinners” for a fixed interval, read a normal INR as safety in a patient taking a direct oral anticoagulant, or start bridging automatically. Recent coronary stenting and dual antiplatelet therapy are explicit reasons to escalate. Your institution’s policy applies, and this course calculates nothing for a patient.',
      claimClass: 'local-policy',
      sourceRefs: [
        {
          sourceId: 'U2',
          location: {
            kind: 'section',
            label: 'executive recommendations on laboratory testing and antithrombotic drugs',
          },
        },
      ],
      localPolicyIds: ['antithrombotic_policy'],
    },
    {
      id: 'consent-conversation',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Consent is a conversation with a decision',
      body: 'Explain the clinical question, what the procedure involves, the planned approach and sampling, the expected benefits, the important risks, the alternatives, and what may happen if the patient declines. Discuss uncertainty, including a nondiagnostic result. Use a qualified interpreter when needed, establish capacity for this decision, and obtain consent before sedation when circumstances allow.\n\nLanguage difference, disability, anxiety, a psychiatric diagnosis or unfamiliarity with the procedure does not by itself establish incapacity; emergency consent and surrogate rules are institution- and jurisdiction-specific.',
      pointsLabel: 'What the explanation covers, then teach-back',
      points: [
        'What will happen, why, and what else could be done',
        'The important risks and the chance of no diagnosis',
        'Teach-back: the patient says what will happen and why, and anything missed is explained again',
        'A simple signal for discomfort, and that the team can pause',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 116, to: 117 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 50, to: 59 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
      ],
    },
    {
      id: 'time-out',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The time-out is spoken by the team',
      body: 'The active pause confirms identity, the intended procedure, site and side, consent, allergies, relevant medication and bleeding concerns, imaging, required equipment, planned specimens and anticipated safety issues. Every participating team member acknowledges the plan, and a discrepancy is resolved before anyone proceeds. A checklist clicked through silently by the operator is not the same process.\n\nThe pause is also where roles are named: who watches physiology, who handles accessories, and who can stop the procedure. A time-out that finds a discrepancy has done its work: the discrepancy is resolved, not read past on the way to the end of the list.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 156 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 157, to: 158 } },
      ],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these lets something other than the clinical question make the decision.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Treating the referral’s label as the indication: restate the question, the target and what the result would change.',
        'Choosing the device before the pathway: a node beyond the airway wall or a peripheral target needs its own sampling pathway.',
        'Filling a missing fact with an assumption: write “not provided — must clarify” and ask.',
        'Planning from a CT report or a single screenshot: review the full study for side, lobe, airway and what lies beyond the wall.',
        'Promising too much at consent: no certain diagnosis, no promise of no discomfort or of complete amnesia, no immediate final result.',
        'Hurrying the time-out when an item disagrees: stop and resolve it before anyone proceeds.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 50 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
      ],
    },
  ],

  workspace: {
    kind: 'map',
    lit: ['RLL'],
    caption: 'The lobe the request concerns: the right lower lobe, where the opacity has come back',
  },

  steps: {
    recognize: {
      instruction:
        'In the Teaching panel, read “What is in front of you”; in the Simulator panel, the airway map lights the lobe this request concerns.',
      lookIn: {
        pane: 'teaching',
        landmark: 'What is in front of you',
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.map,
      },
    },
    act: {
      title: 'From request to pathway',
      instruction:
        'Place each request under the pathway it calls for, on this card, then check the set. Each pathway is the answer to at least one request.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sortRows },
    },
    explain: {
      title: 'The question and the plan',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'sort',
    sort: {
      id: 'question-to-pathway',
      prompt: 'Eight requests. For each, choose the pathway the plan should start from.',
      origins: [
        {
          id: 'noninvasive',
          label: 'Noninvasive sampling and treatment first',
          definition:
            'Check whether sputum, an endotracheal sample or another noninvasive approach, with treatment, already answers the question.',
        },
        {
          id: 'airway-cause',
          label: 'Look for an airway cause',
          definition:
            'Revisit the imaging and consider an obstructing lesion or retained foreign material, rather than assume another course of treatment will settle it.',
        },
        {
          id: 'lavage',
          label: 'Lavage, if it adds information and is tolerable',
          definition:
            'Decide whether an appropriately collected lavage adds information, and whether this patient can tolerate it.',
        },
        {
          id: 'mucosal',
          label: 'Mucosal sampling after a risk review',
          definition:
            'Consider sampling a visible lesion once its vascularity and the procedure’s risk have been reviewed.',
        },
        {
          id: 'beyond-view',
          label: 'A pathway beyond what the scope can see',
          definition:
            'The target lies outside the airway wall or beyond the visible airways, so it needs added imaging, localization or an extraluminal method such as endobronchial ultrasound-guided transbronchial needle aspiration (EBUS-TBNA).',
        },
        {
          id: 'clarify',
          label: 'Not provided — must clarify',
          definition:
            'The request lacks what choosing a pathway depends on — a clinical question, a target or the images themselves: record the gap and ask for it rather than assume it.',
        },
      ],
      rows: [
        {
          id: 'adequate-sputum',
          statement:
            'Lavage requested for a community-acquired lobar pneumonia; an expectorated specimen is in the laboratory and antibiotics have been started.',
          origin: 'noninvasive',
          rationale:
            'Noninvasive sampling and treatment may already answer the question. A lavage would add a procedure’s risk without adding a decision: not every pneumonia requires one.',
        },
        {
          id: 'after-choking',
          statement:
            'Lavage requested for a lower lobe opacity that has not cleared since the patient choked while eating.',
          origin: 'airway-cause',
          rationale:
            'An opacity that persists after a choking episode raises retained foreign material. A lavage specimen would not answer that: the imaging is revisited for an obstructing lesion or retained material, rather than another course of treatment being assumed to settle it.',
        },
        {
          id: 'diffuse-opacities',
          statement:
            'Bronchoscopy requested for diffuse opacities, with possible alveolar hemorrhage or an inflammatory lung process.',
          origin: 'lavage',
          rationale:
            'An appropriately collected lavage may add information here, if the patient can tolerate it. A cell differential still does not establish a complete cause on its own.',
        },
        {
          id: 'visible-lesion',
          statement:
            'Biopsy requested for a lesion reported inside the left main bronchus at an earlier inspection.',
          origin: 'mucosal',
          rationale:
            'A visible lesion may be sampled from the mucosa once its vascularity and the procedure’s risk, antithrombotic drugs included, have been reviewed. Being within reach is not a reason to biopsy it at once.',
        },
        {
          id: 'node-beside-bronchus',
          statement:
            'Bronchoscopy and biopsy requested for an enlarged lymph node beside a main bronchus on CT; the airway looked normal at an earlier inspection.',
          origin: 'beyond-view',
          rationale:
            'Tissue outside the airway wall needs an extraluminal sampling pathway such as EBUS-TBNA. The scope’s own view shows the lumen and the mucosa, not what lies beyond them.',
        },
        {
          id: 'peripheral-nodule',
          statement:
            'Bronchoscopy and biopsy requested for a small nodule near the edge of the lung.',
          origin: 'beyond-view',
          rationale:
            'A peripheral target needs its own imaging, localization and sampling plan. A normal airway survey does not exclude peripheral disease.',
        },
        {
          id: 'no-question',
          statement: 'A request that reads, in full, “bronchoscopy and lavage”.',
          origin: 'clarify',
          rationale:
            'With no question and no target, no pathway can be chosen. The plan records the gap and the requesting team is asked; a default lavage is not a plan.',
        },
        {
          id: 'report-only',
          statement:
            'Lavage requested for a “left-sided opacity”; a one-line CT report is all that has been sent.',
          origin: 'clarify',
          rationale:
            'Side, lobe, segment and the airway leading to the target come from the full study. A one-line report cannot supply them, so the images are obtained before the plan is fixed.',
        },
      ],
      sourceRefs: [
        { sourceId: 'T09', location: { kind: 'time-span', start: '00:05:45', end: '00:11:55' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 35, to: 50 } },
        { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
      ],
    },
  },

  prediction: {
    id: 'Q20',
    seedId: 'Q20',
    itemType: 'management-decision',
    situation:
      'A man on the medical ward has been treated for pneumonia in the right lower lobe before, and on his latest CT the opacity is back in the same place. The team requests bronchoscopy with lavage “for cultures”. He is stable. A bronchoscope and an assistant are free this afternoon.',
    stem: 'What best supports a diagnostic bronchoscopy for him?',
    choices: [
      {
        id: 'a',
        label:
          'A bronchoscope and an assistant are free this afternoon, so he can be sampled today without waiting',
        rationale:
          'Availability makes the procedure possible, not indicated. Going ahead for that reason exposes him to a procedure’s risks without asking what its result would change.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label:
          'It could find an airway cause that sputum and more antibiotics cannot exclude, at acceptable risk',
        rationale:
          'A recurrence in one lobe raises an obstruction or retained material. Finding one would change his management in a way that noninvasive sampling and another antibiotic course cannot, and the risk is weighed for him.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label:
          'Lavage cultures could identify an organism that his earlier antibiotic course did not cover',
        rationale:
          'A culture could name an organism, but sputum or another noninvasive sample can often do that, and an organism does not explain why the opacity keeps returning to one lobe. The recurrence in one place is what needs explaining.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'The opacity is back on his latest CT, and a persistent imaging abnormality is itself an indication',
        rationale:
          'An imaging abnormality alone is not an automatic indication: the same CT finding could lead to another antibiotic course, a noninvasive specimen or a procedure. The finding says where to look, not whether looking would add anything.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A diagnostic bronchoscopy is justified by what its likely result would change for this patient, compared with less invasive alternatives, at an acceptable risk. Here the returning opacity raises an obstruction or retained material, which another antibiotic course does not exclude. Availability, the referral’s wording, a trainee’s need and an imaging finding on its own make a procedure possible or wanted, not indicated.',
    objectiveIds: ['M02-O5'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T09', location: { kind: 'time-span', start: '00:05:45', end: '00:11:55' } },
      { sourceId: 'T15', location: { kind: 'time-span', start: '00:24:36', end: '00:31:59' } },
      {
        sourceId: 'U7',
        location: { kind: 'section', label: 'targeted noninvasive sampling preference' },
      },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111, to: 120 } },
    ],
  },

  transfer: {
    id: 'clinical-question-transfer',
    itemType: 'management-decision',
    situation:
      'A woman on the respiratory ward is booked for inspection of a left lower lobe collapse on tomorrow morning’s procedure list, and the supervisor has agreed the indication. The request gives no oxygen requirement. A ward note from this afternoon says her oxygen was increased, without saying to what.',
    stem: 'What is the next move with this request?',
    choices: [
      {
        id: 'a',
        label: 'Establish her current oxygen support before the setting and the plan are fixed',
        rationale:
          'Her current support and reserve decide where the procedure is done, how she is sedated and supported, and what the rescue plan is. The request does not give it and the note says it has changed, so it is obtained from the ward team, the chart and the patient herself before anything is fixed.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Keep her on the list as requested, since the request describes no oxygen requirement',
        rationale:
          'A blank field shows that nobody wrote the requirement down, not that there is none, and the afternoon note says it has risen. Going ahead on that assumption commits her to a setting and a rescue plan chosen without knowing her reserve.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Move her to the operating room under general anesthesia, since she may be sicker than the request says',
        rationale:
          'Planning for the worst case is still an assumption. The setting, the sedation approach and the rescue plan are chosen from her actual support and reserve, and higher risk does not by itself call for general anesthesia.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label:
          'Cancel the inspection, since a rising oxygen requirement rules out bronchoscopy for now',
        rationale:
          'A rising requirement may change the setting, the support or the timing, and it may justify postponement, but how far it has risen is exactly what nobody yet knows. Cancelling decides on a guess, as going ahead would.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A fact the plan depends on is either known or recorded as missing and obtained; it is not filled in with a guess in either direction. Her current oxygen support decides the setting, the sedation approach and the rescue plan, and a note that it has risen means the request no longer describes her. Assuming none, assuming the worst and cancelling on an unknown each leave the gap open.',
    objectiveIds: ['M02-O1', 'M02-O2'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 116 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 111 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
      { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
    ],
    reviewItemIds: ['R10'],
    transferVariant:
      'A different patient, procedure and missing fact, one step later: the indication is agreed, and what is absent is her current oxygen support, which decides the setting and the rescue plan. It applies the new concept’s last clause — a risk that is known — rather than the prediction’s choice between clinical and non-clinical reasons.',
  },

  practice: [
    {
      id: 'C03',
      manifestCaseId: 'C03',
      presentationTitle: 'A biopsy request after a recent coronary stent',
      situation:
        'A 67-year-old man is referred for bronchoscopy and biopsy of a central lesion. He reports a recent coronary stent and ongoing aspirin plus a P2Y12 inhibitor. The referral contains no agreed medication plan.',
      item: {
        id: 'C03',
        itemType: 'management-decision',
        stem: 'What should happen next?',
        choices: [
          {
            id: 'a',
            label:
              'Clarify each drug, its indication and the stent’s timing; escalate to the supervisor and prescribing team',
            rationale:
              'With no agreed plan, both the bleeding risk of a biopsy and the thrombotic risk of interrupting therapy after a recent stent are unresolved. The facts are gathered and the decision is made with the supervisor and the prescribing team, considering urgency, alternatives and a different time or procedure.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Tell him to stop both antiplatelet drugs before the procedure, then biopsy as requested',
            rationale:
              'A blanket hold after a recent coronary stent trades one risk for another without the prescribing team. Interruption is not automatic, and this combination is an explicit reason to escalate.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label: 'Inspect as planned, and take the biopsy if the lesion does not look vascular',
            rationale:
              'A low-risk inspection is not permission for an unplanned biopsy. The unresolved question is the medication plan, and the lesion’s appearance does not answer it.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Ask the prescribing team whether the P2Y12 inhibitor can be held, as the guideline separates it from aspirin, and book the biopsy once it has been',
            rationale:
              'Involving the prescribing team is right, but asking only whether the drug can be stopped decides the plan in advance, and the guideline’s distinction informs a decision rather than making one. How recent the stent is, how urgent the diagnosis is, and whether another procedure or a different time would avoid interruption are weighed together.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'Two risks interact here: the bleeding risk of the proposed biopsy and the thrombotic risk of interrupting therapy after a recent coronary stent. With no agreed plan, the next move is to clarify the drugs, their indication and the stent’s timing, and to decide with the supervisor and the prescribing team, weighing urgency, alternatives and a different time or procedure — no automatic interruption or bridging, and no unplanned biopsy during an inspection.',
        objectiveIds: ['M02-O2', 'M02-O1'],
        claimClass: 'local-policy',
        sourceRefs: [
          {
            sourceId: 'U2',
            location: {
              kind: 'section',
              label: 'executive recommendations on laboratory testing and antithrombotic drugs',
            },
          },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 115, to: 116 } },
          { sourceId: 'S3', location: { kind: 'pdf-pages', from: 47, to: 50 } },
        ],
      },
    },
    {
      id: 'mc-time-out-side-discrepancy',
      presentationTitle: 'The time-out before an airway biopsy',
      situation:
        'At the time-out before inspection and biopsy of a lesion, the request names the left upper lobe and the CT on the screen shows the lesion at the left upper lobe bronchus. The signed consent form reads “right”. The patient is awake and has not yet received sedation, and the team is ready to start.',
      item: {
        id: 'mc-time-out-side-discrepancy',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Stop and resolve the side with the patient, the images and the supervisor before sedation',
            rationale:
              'Two records name the left and the consent names the right. The discrepancy is resolved before anyone proceeds: the target is confirmed from the images, the procedure is rediscussed with the awake patient, and consent is documented for the side that will actually be sampled.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Go ahead on the left, because the request and the CT agree and outnumber the consent form',
            rationale:
              'Two records agreeing does not make the third irrelevant: the patient consented to a procedure on the other side. Proceeding with a known, unresolved discrepancy is the error the time-out exists to catch.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Amend the consent form to read “left”, then carry on with the rest of the checklist',
            rationale:
              'A consent form records a conversation with the patient; changing the word on it without the patient does not change what was agreed, and carrying on then samples a side the signed consent does not name. The side is rediscussed with the awake patient first, then documented.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label:
              'Finish reading the remaining checklist items first, then sort out the side with the team',
            rationale:
              'Finishing the list resolves nothing, and settling the side “with the team” leaves out the awake patient whose consent is in question. The side is resolved with the patient, the images and the supervisor before anyone proceeds.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'When a time-out finds a discrepancy, the work is resolving it, not reaching the end of the list. Site, side, consent and imaging must agree before anyone proceeds; because the patient is awake and unsedated, the consent conversation can be had again now.',
        objectiveIds: ['M02-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 55, to: 59 } },
          { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 156 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 116, to: 117 } },
        ],
      },
    },
  ],
}
