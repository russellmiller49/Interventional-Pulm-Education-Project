import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M12, first half — suction, bronchial washing and bronchoalveolar lavage. The learner separates
 * the four procedures that put saline into the airway (washing, BAL, therapeutic aspiration and
 * whole-lung lavage), then decides which steps of a planned BAL must come before others, including
 * the reassessment that gates each further aliquot. Poor return and its differential follow in
 * `poor-return`. Knowledge spec §13.1–§13.7 (S1 PDF 90–93, 118–127; T13; T14; T15; U6) and the
 * collection record of §13.9 and §15.4; register items R21, R22, R23, R25 and R42.
 */
export const section: BronchSectionDefinition = {
  id: 'washing-and-lavage',
  title: 'Washing, lavage and aspiration',
  shortTitle: 'Washing and lavage',
  minutes: 8,
  moduleIds: ['M12'],
  objectives: [
    {
      objectiveId: 'M12-O1',
      subtask:
        'Commits a name for saline instilled and recovered in the trachea, and, in the transfer, the next move when a therapeutic aspiration stalls, where a lavage’s method does not apply.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M12-O2',
      subtask:
        'Chooses the lavage segment for a focal consolidation from the imaging rather than a habitual site, in a practice case; places the choice of segment first, and its confirmation before the wedge and any saline, in the BAL sequence.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M12-O3',
      subtask:
        'Places the gentle wedge before instillation, and the reassessment of the seal, the airway, the return and the patient before any further aliquot, in the BAL sequence; the hands are shown to faculty.',
      evidence: 'observed-physical-skill-required',
    },
    {
      objectiveId: 'M12-O4',
      subtask:
        'Chooses, in a practice case, what a lavage note must add when serial returns change — each return’s character in order, the volumes and how the fractions were handled — and closes the BAL sequence with the record.',
      evidence: 'case-decision',
    },
  ],
  drillIds: ['D11'],
  prerequisites: [
    'clinical-question',
    'sedation-and-monitoring',
    'five-controls',
    'right-side',
    'left-side',
    'systematic-survey',
    'describe-findings',
  ],

  clinicalQuestion:
    'When saline goes into the airway and comes back, which procedure was performed, and what should the specimen and the record say?',
  recognizeTitle: 'Saline instilled and recovered in the trachea',
  objective:
    'Tell bronchial washing, bronchoalveolar lavage (BAL), therapeutic aspiration and whole-lung lavage apart, and decide which steps of a planned BAL must come before others.',
  why: 'Each of these procedures meets a different clinical need, and the laboratory and the treating team read a specimen by the name it carries.',
  newConcept:
    'The name follows the method: a BAL is saline instilled and recovered by a specified collection technique through a gentle wedge in a segment chosen for the question, so saline instilled for a specimen and recovered in a central airway, with no wedge, is a washing, whatever the trap says.',
  incrementSentence:
    'This section adds one idea to the survey and the description you already make: what was done, not the fluid in the trap or the word on the request, decides what a sample is called.',
  harmfulReflex:
    'Giving the next aliquot as soon as the last is recovered, to keep to the planned total, before the seal, the airway, the return and the patient have been reassessed.',
  anchor: {
    analogy:
      'A cup dipped at the edge of a lake does not sample the water at depth. A BAL has to reach a chosen distal unit and isolate it; saline swirled in a central airway collects what lies in that airway, not the isolated distal airspaces.',
    precise:
      'A bronchial washing samples material from the bronchial airway after limited instillation and aspiration, with no wedge. A bronchoalveolar lavage samples the distal airspaces through a wedged bronchus, with a specified collection technique. Therapeutic aspiration clears retained material; whole-lung lavage is a separate therapeutic procedure.',
    checklistLabel: 'Before naming a saline sample, say',
    checklist: [
      'Where the tip was',
      'Whether a gentle wedge isolated a chosen segment',
      'What it was for: a specimen, or clearing the airway',
      'The volumes actually instilled and recovered',
    ],
  },

  spineStops: ['trachea', 'segmental'],
  grammarRowIds: [],
  controlStrip: {
    verdict: 'no-control-change-the-plan',
    states: {
      insertion: 'not-this-one',
      rotation: 'not-this-one',
      deflection: 'not-this-one',
      suction: 'harmful-reflex',
      accessory: 'not-this-one',
    },
    sentence:
      'No control turns saline recovered in a central airway into a lavage: the method decides the name, and the record says what was done. During a lavage the tempting move sits at suction, recovering one aliquot and going straight on to the next; the next aliquot waits for a reassessment of the seal, the airway, the return and the patient.',
  },
  precommitDenyPatterns: [
    /\bname follows the method\b/i,
    /\b(is|was) a (bronchial )?washing\b/i,
    /\bwashing,? (rather than|not) (a )?BAL\b/i,
  ],
  modelBoundary:
    'Nothing in this section models fluid, suction or a wedge. The sequence teaches the order and the reasons; it does not measure wedge quality, instilled or recovered volume, or lavage technique, and no volume on this page is a target for your patient.',
  physicalSkillNote:
    'The app cannot see the hands. Settling a gentle wedge, instilling and recovering under control, and adjusting a leaking or over-wedged position are shown under faculty observation; this section teaches the order and the reasons, and measures no wedge, volume or return.',
  localPolicyIds: ['bal_protocol'],
  reviewItemIds: ['R21', 'R22', 'R23', 'R25', 'R42'],

  blocks: [
    {
      id: 'saline-in-the-airway',
      kind: 'question',
      role: 'framing',
      heading: 'Saline in, fluid out',
      body: 'Several procedures put saline into the airway and recover fluid. They are done for different reasons and are not interchangeable.',
      claimClass: 'synthesis',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } }],
    },
    {
      id: 'what-to-notice',
      kind: 'signals',
      role: 'signals',
      heading: 'What to notice about a saline sample',
      body: 'Each of these can be known, or asked, before a sample is named.',
      pointsLabel: 'Information available about a saline sample',
      points: [
        'The airway the tip was in when the saline went in',
        'How the tip sat in that airway',
        'What the procedure was for: a specimen, or clearing the airway',
        'What went in, and what came back',
        'What the request form and the trap label say',
      ],
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } }],
    },
    {
      id: 'four-procedures',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Four procedures, four purposes',
      body: 'A bronchial washing samples material from the bronchial airway after limited instillation and aspiration; it needs no wedge. A bronchoalveolar lavage samples fluid and cells from the distal airspaces reached through a wedged bronchus, using a specified collection technique. The name on the specimen has to match what was performed. The diagnostic-tools lecture separates a genuinely distal sampling strategy from collecting a little fluid in a proximal airway and calling it a BAL.\n\nTherapeutic aspiration is not a way to obtain a clean diagnostic specimen: its purpose is to clear retained secretions or other material from an obstructed airway, with controlled suction and, when useful, limited saline. Whole-lung lavage is a separate therapeutic procedure with very different equipment, volumes, airway management and training. A BAL is not a small whole-lung lavage.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 125, to: 126 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 93 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:08:45', end: '00:15:33' } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:34:11', end: '00:36:47' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:01:24', end: '00:04:55' } },
      ],
    },
    {
      id: 'lavage-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'A lavage note, worked through',
      body: 'When a biopsy is also planned, a lavage for microbiology or cells is generally collected before it, because blood from the biopsy can contaminate the lavage. That is not a universal ordering rule: when other contamination-sensitive tasks are planned, the supervisor sets the sequence.\n\nWorked through: the note for a lavage of a right middle lobe segment in diffuse disease on CT, chosen for its recovery because the distribution pointed to no other region, and collected under the institution’s approved protocol.',
      pointsLabel: 'What the note carries',
      points: [
        'The segment actually lavaged, named by its bronchus',
        'Each volume instilled and each volume recovered, as measured',
        'The gross character of the returns, in the order collected',
        'Whether the fractions were kept separate, pooled or divided, as the protocol and the laboratory required',
        'Any suction, biopsy or bleeding before the lavage',
        'Any event in the patient, and any limitation, such as an early stop',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 125, to: 126 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 148 } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      ],
      localPolicyIds: ['bal_protocol'],
      reviewItemIds: ['R21'],
    },
    {
      id: 'gentle-seal',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'The wedge is a gentle seal',
      body: 'An effective wedge limits proximal leak enough to sample the intended distal unit. It is not maximal impaction of the tip, and its depth depends on the airway and the scope’s caliber, not on a distance printed on the shaft.\n\nToo little wedge lets fluid leak back into the proximal airway and gives an inadequate sample. Too much can injure the mucosa, add blood and reduce return, and excessive suction can collapse the airway. The beginner recognizes these patterns and adjusts under supervision, rather than adding saline or suction without a diagnosis of the problem.',
      claimClass: 'source',
      sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 120 } }],
    },
    {
      id: 'volumes-recorded',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'Volumes: described, then recorded',
      body: 'The textbook describes bronchial washing volumes of approximately 5–50 mL and common adult BAL totals of approximately 100–300 mL in divided aliquots. These are technique ranges the source describes, not an obligation to deliver a fixed volume to every patient. The lecture favors larger aliquots and a minimum return; the interstitial lung disease guideline describes its own aliquot and recovery targets for distal sampling; the textbook also describes smaller aliquots. None of them is a universal threshold for adequacy.\n\nThe approved protocol, the indication, the patient’s physiology, the intended studies and the actual return decide what is appropriate, and the record carries the volumes actually instilled and recovered. Fractions are discarded, pooled or divided only as the diagnostic protocol directs: laboratory requirements and the question decide handling, and sequential fractions matter when alveolar hemorrhage is in question.',
      claimClass: 'review-flag',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 125, to: 126 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:10:19', end: '00:13:47' } },
        {
          sourceId: 'U6',
          location: { kind: 'section', label: 'BAL technique and return qualifications' },
        },
      ],
      localPolicyIds: ['bal_protocol'],
      reviewItemIds: ['R22'],
    },
    {
      id: 'therapeutic-aspiration',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Clearing has its own technique and endpoint',
      body: 'The therapeutic lecture treats aspiration of retained material as a technique, not a press of the suction valve: choose an adequate working channel, engage the accessible bulk of the material rather than aspirating only its free edge again and again, and combine controlled suction with limited saline and small movements when that helps. Engaging the bulk is for tenacious mucus: it does not mean scraping normal mucosa, forcing flushes, or stripping away an adherent clot that may be holding back bleeding.\n\nSaline is an adjunct with a clinical cost, not an unlimited resource: how much is used, and when to pause, depend on the patient’s tolerance; record what goes in, and do not keep flooding poorly ventilated distal units because suction is not working. A plug that routine measures cannot safely clear may need a different tool and a more experienced operator. Once the obstruction clears, the newly opened lumen and its distal branches are inspected for retained material when it is safe; a patent proximal bronchus does not mean every downstream segment is clear. The endpoint is the clinical objective, not the removal of every visible secretion, and the note records the clinical response, patency, residual limitation and the patient’s tolerance.',
      pointsLabel: 'A supervised sequence for clearing',
      points: [
        'Identify the obstructed airway and assess the patient',
        'Define the visible margin of the material',
        'Aspirate under control, watching for lumen collapse or mucosa drawn onto the tip',
        'Reassess whether material is actually moving',
        'Clear a blocked channel by the approved method',
      ],
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:01:24', end: '00:04:55' } },
      ],
      reviewItemIds: ['R42'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors lets something other than the method decide what a sample is, or lets a number decide what the patient can tolerate.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Calling any saline recovered through the channel a BAL: a BAL needs a gentle wedge in a chosen segment and a specified collection technique; a specimen recovered in a central airway with no wedge is a washing.',
        'Choosing the right middle lobe by habit for a focal abnormality: sample the region the clinical question and the imaging identify, and resolve a request that disagrees before starting.',
        'Impacting the tip for a tighter wedge: a gentle seal is the aim; impaction can injure mucosa, add blood and reduce return.',
        'Going straight on to the next aliquot to keep to a planned or remembered total: reassess the seal, the airway, the return and the patient first, and record the volumes actually given and recovered.',
        'Renaming a specimen after the result to change how it is read: the name is set by what was done, and interpretation stays with the laboratory and the clinical context.',
        'Treating therapeutic aspiration as pressing suction: engage the material, reassess whether it moves, and count the saline.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:08:45', end: '00:15:33' } },
        { sourceId: 'T14', location: { kind: 'time-span', start: '00:01:24', end: '00:04:55' } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      ],
      reviewItemIds: ['R22', 'R25'],
    },
  ],

  workspace: {
    kind: 'map',
    lit: ['TR'],
    caption: 'The airway map, with the trachea lit: where the scope tip sits in the first case',
  },

  steps: {
    recognize: {
      instruction:
        'In the Simulator panel, find the lit airway on the airway map, where the tip sits in the first case; then read “What to notice about a saline sample” in the Teaching panel.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.map,
        alsoPane: 'teaching',
        alsoLandmark: 'What to notice about a saline sample',
      },
    },
    act: {
      title: 'A planned BAL, in order',
      instruction:
        'Put the steps of a planned BAL in the order that holds, on this card, then check the order.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sequence },
    },
    explain: {
      title: 'What the sample should be called',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'sequence',
    sequence: {
      id: 'planned-lavage',
      prompt: 'Eight steps of a planned BAL. Put them in the order that holds.',
      steps: [
        {
          id: 'choose-segment',
          label: 'Choose the segment from the clinical question and the imaging',
          detail:
            'The question and the CT decide the target. For a focal abnormality that is the involved segment, not a habitual site; in diffuse disease the right middle lobe or lingula may give useful recovery, and the distribution still matters.',
        },
        {
          id: 'confirm-site',
          label: 'Confirm the side, lobe and segment, with a sterile collection system connected',
          detail:
            'Confirmation comes before the wedge and any saline, because a lavage of an unintended segment answers a different question from the one asked. The sterile trap is ready before instillation so the first return is collected.',
        },
        {
          id: 'gentle-wedge',
          label: 'Advance gently until the segment is sealed, without impacting the tip',
          detail:
            'An effective wedge is a gentle seal that limits proximal leak enough to sample the intended distal unit. Its depth depends on the airway and the scope, not a distance on the shaft; over-wedging can injure mucosa, add blood and reduce return.',
        },
        {
          id: 'instill',
          label: 'Instill an aliquot of the approved sterile saline through the working channel',
          detail:
            'The saline is sterile, isotonic and non-bacteriostatic, given under the approved protocol. The position is held so the aliquot reaches the sealed unit instead of leaking back.',
        },
        {
          id: 'recover',
          label: 'Recover the fluid with controlled suction or the approved aspiration method',
          detail:
            'Controlled suction recovers fluid without collapsing the distal airway; excessive suction can collapse it and reduce return. Complete recovery is not expected: the aim is a representative collection from the isolated unit.',
        },
        {
          id: 'reassess',
          label: 'Reassess the seal, the airway, the return and the patient',
          detail:
            'Each aliquot is a decision. A leaking seal, a collapsing airway, poor return or a change in the patient is diagnosed before anything more goes in; adding saline or suction without a diagnosis is the error.',
        },
        {
          id: 'next-or-stop',
          label: 'Instill the next aliquot, or end the lavage',
          detail:
            'Another aliquot follows only when the reassessment supports it, and a lavage may end short of its planned total. Giving the next aliquot straight after the last recovery, to keep to the plan, skips the decision.',
        },
        {
          id: 'record',
          label:
            'Record the site, volumes instilled and recovered, fluid character, order, events and limitations',
          detail:
            'The record carries what was actually done: the exact segment, the volumes instilled and recovered, the gross character of the returns, the collection sequence, any necessary suction or biopsy before the lavage, whether fractions were pooled, any event in the patient and any limitation. It is written from what happened, not from a planned total.',
        },
      ],
      rationale:
        'The site is chosen and confirmed before the wedge and any saline; the wedge is gentle and held while each aliquot is instilled and recovered; the next aliquot waits for a reassessment of the seal, the airway, the return and the patient, and the lavage may stop short of its plan; and the record states what was actually done.',
      criticalStepIds: ['confirm-site', 'reassess', 'next-or-stop'],
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 93 } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:08:45', end: '00:15:33' } },
        { sourceId: 'T13', location: { kind: 'time-span', start: '00:09:31', end: '00:10:19' } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      ],
    },
  },

  prediction: {
    id: 'Q06',
    seedId: 'Q06',
    itemType: 'mechanism-interpretation',
    situation:
      'At the start of an airway inspection, with the scope in the trachea, the operator instills a small volume of sterile saline through the working channel and suctions it back into a trap. The request form asks for a BAL, and the assistant labels the trap “BAL”.',
    stem: 'Which procedure was performed?',
    choices: [
      {
        id: 'a',
        label: 'A bronchial washing',
        rationale:
          'In the trachea no wedge isolated a distal unit, so the saline collected what lay in the central airway, not a sample of the distal airspaces. That is a washing, whatever the request form or the trap label says.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'A whole-lung lavage',
        rationale:
          'Whole-lung lavage is a separate therapeutic procedure, with very different equipment, volumes, airway management and training. A small volume instilled in the trachea is not a lavage of a lung, and the term is not a synonym for a washing.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'c',
        label: 'A bronchoalveolar lavage (BAL)',
        rationale:
          'Saline going into and out of the working channel does not make a BAL. A BAL samples the distal airspaces through a wedged bronchus in a chosen segment; neither the request form nor the label on the trap changes what was done.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'A therapeutic aspiration',
        rationale:
          'Therapeutic aspiration clears retained secretions or other material from an obstructed airway. Nothing was being cleared here: the saline was instilled to collect a specimen.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'A bronchoalveolar lavage samples fluid and cells from the distal airspaces through a wedged bronchus, using a specified collection technique. Saline instilled and recovered in the trachea, with no wedge, collects what lies in the central airway, so what was done is a bronchial washing, not a BAL, and the specimen is named that way. The name follows the method, not the fluid in the channel or the word on the request.',
    objectiveIds: ['M12-O1'],
    claimClass: 'source',
    sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 120 } }],
  },

  transfer: {
    id: 'washing-and-lavage-transfer',
    itemType: 'management-decision',
    situation:
      'After abdominal surgery, a patient on supplemental oxygen has collapse of the left lower lobe, and a bronchoscopy under moderate sedation is to clear it. Thick, tenacious mucus fills the left lower lobe bronchus. Controlled suction with small saline aliquots brought material back at first, but over the last few aliquots nothing more has moved.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label: 'Check the suction path, then engage the plug’s accessible bulk',
        rationale:
          'Material has stopped moving, so the next move is to find out why before adding anything: a blocked channel, valve, trap, tubing or source, the tip’s position, or suction working only on the free edge of the plug. Engaging its accessible bulk under control, with the patient’s tolerance watched throughout, is the routine measure; a plug it cannot safely clear may need a different tool and a more experienced operator.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label: 'Wedge in the lobe and run repeated aliquots until the return runs clear',
        rationale:
          'This applies lavage technique to a clearing problem. Repeated saline floods poorly ventilated distal units when suction is not moving the material, saline has a clinical cost, and a clear return is not the endpoint of clearing an airway.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label: 'Keep aspirating at the free edge of the mucus until it gives',
        rationale:
          'Aspirating only the free edge of tenacious mucus again and again does not engage the material, and continued suction can collapse the airway or draw mucosa onto the tip. Therapeutic aspiration engages the accessible bulk of the material under control, once the suction path is known to work.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Change now to a scope with a larger working channel',
        rationale:
          'An adequate working channel matters for tenacious mucus, and a plug that routine measures cannot clear may need a different tool. Routine measures have not been exhausted here: a fault in the suction path, or suction working only on the free edge of the plug, would explain the stall, and each is checked first.',
        plausibility: 'reasonable-but-incomplete',
      },
    ],
    explanation:
      'Therapeutic aspiration clears retained material; it is neither a lavage nor simply pressing suction. When material stops moving, check the suction path and the tip’s position, and engage the accessible bulk of the plug rather than adding saline, which has a clinical cost and can flood poorly ventilated distal units. The patient’s tolerance is watched throughout, and a plug that routine measures cannot safely clear may need a different tool and a more experienced operator.',
    objectiveIds: ['M12-O1'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T14', location: { kind: 'time-span', start: '00:01:24', end: '00:04:55' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 90, to: 93 } },
    ],
    reviewItemIds: ['R42'],
    transferVariant:
      'A therapeutic clearance of a lobar plug instead of a diagnostic sample, in a different airway and patient. The prediction named a procedure from its method; here the purpose, clearing, sets the method, so a lavage’s wedge and repeated aliquots are not the next move.',
  },

  practice: [
    {
      id: 'mc-lavage-site-selection',
      presentationTitle: 'A lavage request and a focal consolidation',
      situation:
        'An adult receiving chemotherapy has fever and a new consolidation confined to the posterior segment of the right upper lobe on CT. Bronchoscopy with lavage for microbiology is planned; the request reads “BAL for cultures” and names no site.',
      item: {
        id: 'mc-lavage-site-selection',
        itemType: 'management-decision',
        stem: 'Where should the lavage be taken?',
        choices: [
          {
            id: 'a',
            label: 'The posterior segment of the right upper lobe (RB2)',
            rationale:
              'For a focal abnormality, the lavage goes to the region the imaging shows: here RB2, the segment the consolidation is confined to. With no site on the request, the segment comes from the CT and the clinical question, and the side, lobe and segment are confirmed at the scope before the wedge and any saline.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'The right middle lobe (RML), where return is usually best',
            rationale:
              'The right middle lobe can give useful recovery in diffuse disease. This consolidation is focal and lies in the upper lobe, so a middle lobe lavage would sample airspaces the imaging does not show to be involved.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'The lingula (LB4+5), which also returns well',
            rationale:
              'Like the right middle lobe, the lingula can give useful recovery in diffuse disease. It lies in the other lung, away from the consolidation the lavage is meant to sample.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'The right upper lobe bronchus, above its segments',
            rationale:
              'This is the involved lobe, but a lavage is taken through a gentle wedge in a segmental or subsegmental airway, which isolates the unit to be sampled. At the lobar bronchus there is no such seal: saline can leak back proximally and give an inadequate sample of the consolidated segment.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The lavage site comes from the clinical question and the imaging. For a focal consolidation, sample the segment the CT shows rather than a habitual site; the right middle lobe or lingula may give useful recovery in diffuse disease, but that is no reason to miss a focal target. Confirm the side, lobe and segment before instillation.',
        objectiveIds: ['M12-O2'],
        claimClass: 'source',
        sourceRefs: [{ sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 121 } }],
        choiceAirways: { a: 'RB2', b: 'RML', c: 'LB4+5', d: 'RUL' },
      },
    },
    {
      id: 'mc-lavage-note',
      presentationTitle: 'Returns that change from one aliquot to the next',
      situation:
        'A BAL of the lateral segment of the right middle lobe (RB4) is taken for diffuse infiltrates, in divided aliquots with a gentle wedge held throughout and no biopsy beforehand. Each return is bloodier than the one before. The assistant empties every return into one container, and the draft note reads “BAL, right middle lobe, bloody”.',
      item: {
        id: 'mc-lavage-note',
        itemType: 'management-decision',
        stem: 'What must the note add?',
        choices: [
          {
            id: 'a',
            label: 'The segment, the volumes, each return’s character in order, the pooling',
            rationale:
              'Returns from one wedged segment that grow bloodier aliquot by aliquot mean something only in order. The note gives the exact segment, the volumes instilled and recovered, each return’s character in sequence and that the fractions were pooled, so whoever reads the result can weigh it.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Bleeding from the wedge, as the cause of the increasingly bloody returns',
            rationale:
              'Blood from local instrumentation can confound a lavage, but nothing here shows trauma at the wedge: the seal was gentle and no biopsy came first. The note describes what was seen; it does not assign a cause the procedure did not show.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Alveolar hemorrhage, as the diagnosis that these returns establish',
            rationale:
              'Progressively bloodier returns from one appropriately wedged site support alveolar hemorrhage in the clinical context, but they do not establish it or its cause. The note records the sequence; the diagnosis comes from the clinical and laboratory context.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Nothing more: the site and the word “bloody” describe the specimen',
            rationale:
              'A single word for pooled returns loses the one feature that matters here, whether the blood increased from the first return to the last. The exact segment, the order of the fractions and their volumes belong in the record.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A lavage note records what was done and what came back: the exact segment, the volumes instilled and recovered, the gross character of each return in order, how the fractions were handled, events in the patient and any limitation. Serial returns from one appropriately wedged site that grow progressively bloodier support alveolar hemorrhage in the clinical context, which is why the order matters; the note describes the finding and does not assign its cause.',
        objectiveIds: ['M12-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119, to: 120 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 120, to: 127 } },
        ],
      },
    },
  ],
}
