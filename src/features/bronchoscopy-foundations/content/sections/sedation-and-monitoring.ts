import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M04 — Topical anesthesia, sedation and monitoring. The section is built around one idea: topical
 * anesthetic is counted in milligrams across the whole team, and an administration with no recorded
 * amount keeps the running total open. Sedation depth, monitoring and medication-related
 * deterioration are carried by the after-commitment blocks and the practice cases.
 * Knowledge spec §9 (S1 PDF 71–83; S2 PDF 37–40, 46; T07; U1, U2, U4), §16.6, D19 and C14.
 *
 * Arithmetic here is educational (A10): it converts concentration and volume to milligrams and never
 * states a limit, a remaining amount or a dose for a patient (R13, A11).
 */
export const section: BronchSectionDefinition = {
  id: 'sedation-and-monitoring',
  title: 'Topical anesthesia, sedation and monitoring',
  shortTitle: 'Sedation and monitoring',
  minutes: 7,
  moduleIds: ['M04'],
  objectives: [
    {
      objectiveId: 'M04-O1',
      subtask:
        'Decides, in a practice case, whether a patient’s responses after a further sedative dose still fit the planned depth, and separates a topical effect from sedation.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O2',
      subtask:
        'Enters the milligrams for each measured line of a shared topical-anesthetic record from its concentration and volume, then commits what the cumulative record can state.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M04-O3',
      subtask:
        'Reads responsiveness, the need for airway support, the capnography trace and oximetry together, in the same practice case.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O4',
      subtask:
        'Commits a next move, in a practice case, when confusion and a new irregular rhythm follow repeated topical doses.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M04-O5',
      subtask:
        'Commits what the shared record should state when one administration has no recorded amount, then decides the next move at a handoff where one administration was never called out.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D19'],
  prerequisites: ['shared-airway'],

  clinicalQuestion:
    'When several members of the team have given topical anesthetic, what should the shared record say?',
  recognizeTitle: 'A cough at the carina and a request for more topical anesthetic',
  objective:
    'Decide what the team’s topical-anesthetic record shows about the amount already given, when more than one clinician has given it, before a further dose.',
  why: 'Topical anesthetic reaches the patient from several hands and in several ways in one procedure. The team decides about another dose from what the record holds.',
  newConcept:
    'Topical anesthetic is counted in milligrams across the whole team, and an administration whose amount is unknown keeps the cumulative total open: it is not zero.',
  incrementSentence:
    'This section adds one idea to the shared airway: the topical anesthetic that blunts its reflexes is counted in milligrams by the whole team, and a missing entry keeps the count open.',
  harmfulReflex:
    'Treating an administration with no recorded amount as zero, and reading the known subtotal as room for the dose now requested.',
  anchor: {
    analogy:
      'A relay team’s time: the total is known only when every leg is timed, and a leg nobody timed was not run in no time.',
    precise:
      'Milligrams are concentration in mg/mL multiplied by volume in mL, line by line, for every clinician who gave topical anesthetic. An administration without its agent, concentration or volume leaves the cumulative total open, and a known subtotal is not permission for another dose.',
    checklistLabel: 'Before a further topical dose, read the record',
    checklist: [
      'Every line: agent, how it was given, concentration, volume, time and who gave it',
      'Milligrams for each line, not milliliters',
      'A line without an amount: ask the clinician who gave it',
      'The limit: from the approved local policy, not from memory',
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
      'No control here. The five controls come in the Handle phase; this section is about the medicine given for the examination and the record that counts it.',
  },
  precommitDenyPatterns: [
    /known so far/i,
    /\bunresolved\b/i,
    /\bnot (the same as )?(zero|absent)\b/i,
    /\bincomplete\b/i,
  ],
  modelBoundary:
    'The monitor and the medication record in this section are scripted in words for teaching, and its arithmetic is educational. No value on this page is a threshold or a dose for your patient.',
  localPolicyIds: ['topical_anesthetic_policy', 'sedation_policy', 'fasting_and_aspiration_policy'],
  reviewItemIds: ['R10', 'R11', 'R12', 'R13', 'R14'],

  blocks: [
    {
      id: 'medicine-and-count',
      kind: 'question',
      role: 'framing',
      heading: 'The medicine given for the examination',
      body: 'Before and during a bronchoscopy the patient usually receives topical anesthetic for the airway and often sedation as well. In one procedure several people may give medicine, in different ways and at different times.\n\nThis section asks what each medicine is for, how deep the sedation actually is, and what the team’s record can say about what has been given.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 37, to: 40 } },
      ],
    },
    {
      id: 'what-the-team-has',
      kind: 'signals',
      role: 'signals',
      heading: 'What the team can check before another dose',
      body: 'A dose decision draws on the patient and on the medication record. Before a decision, name which of them it depends on.',
      pointsLabel: 'Information available before another topical dose',
      points: [
        'The patient’s responses: cough, response to a spoken request, respiratory effort',
        'The monitor: oximetry, capnography, pulse and blood pressure',
        'The medication record the nurse keeps during the procedure',
        'What team members say aloud about what they gave',
      ],
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
      ],
    },
    {
      id: 'reconciled-record',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A record the team reads aloud',
      body: 'Midway through another airway inspection, the nurse reads the topical-anesthetic record aloud. It has two lines: lidocaine instilled by the operator through the working channel, and lidocaine given by the anesthesia clinician. Each line gives the agent, how it was given, the concentration in mg/mL, the volume in mL, the milligrams, the time and who gave it, and the operator and the monitoring team read from the same record.\n\nThat is the reference later records are compared with.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
      ],
      localPolicyIds: ['topical_anesthetic_policy'],
    },
    {
      id: 'arithmetic-worked',
      kind: 'after-commitment',
      role: 'worked-example',
      heading: 'The arithmetic, worked',
      body: 'A shared record counts every topical administration, whoever gave it and however it was given: preparatory sprays, nebulized doses where the protocol uses them, gels and medication instilled through the working channel. The operator and the monitoring team read the same running total.\n\nVials are often labeled as a weight-per-volume percentage. Converted, 1% lidocaine is 10 mg/mL, 2% is 20 mg/mL and 4% is 40 mg/mL, so 2 mL of 10 mg/mL holds 20 mg while 2 mL of 40 mg/mL holds 80 mg.\n\nIn this section’s record, 4 mL at 10 mg/mL is 40 mg and 3 mL at 20 mg/mL is 60 mg: 100 mg known, not 7 mg and not “7 mL”. The lidocaine spray given in the preparation area has no concentration or volume, so the record reads 100 mg known and one administration unresolved. The arithmetic does not establish that 100 mg, or any further dose, is appropriate for a patient.',
      pointsLabel: 'What each line stores',
      points: [
        'Agent and how it was given',
        'Concentration in mg/mL and volume in mL',
        'Calculated milligrams, not volume alone',
        'Time, the clinician who gave it, and the running amount',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 46 } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
      ],
      reviewItemIds: ['R13'],
      copyExemptions: [
        {
          term: '%',
          reason:
            'Reading a vial label: the weight-per-volume notation is shown once, only to convert it to mg/mL (acceptance test A10).',
        },
      ],
    },
    {
      id: 'different-purposes',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Different purposes, different risks',
      body: 'Topical anesthesia reduces sensation and reflex responses at the mucosa it reaches. Sedation reduces anxiety and awareness to a planned depth; analgesia and cough suppression depend on the drug. The two overlap but are not interchangeable, so more intravenous sedation is not the automatic answer to too little topical effect, wall contact, upper-airway obstruction or an ill-chosen procedure.',
      pointsLabel: 'Pharmacological principles, not a regimen',
      points: [
        'Midazolam gives anxiolysis, sedation and anterograde amnesia; it is not an analgesic',
        'Opioids such as fentanyl give analgesia and cough suppression and can depress ventilation; repeated doses can prolong their effect',
        'Combinations can add to or multiply the respiratory effect',
        'Propofol can cause apnea and hypotension and needs matching staffing, monitoring and privileges',
        'Age, reserve, organ dysfunction, prior exposure and other medicines change the response',
        'Allow time for a drug to act before giving it again',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 83 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 37, to: 40 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 80, to: 83 } },
      ],
    },
    {
      id: 'depth-is-the-response',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Depth is what the patient does',
      body: 'Moderate sedation keeps a purposeful response to a spoken request, perhaps with light touch, with adequate spontaneous breathing and no airway intervention needed. Deep sedation can impair breathing or the patency of the airway, and general anesthesia is a different state again. The patient’s actual response and physiology define the depth — not the drug, the intended dose or the label on the order — and the team must be ready to rescue a patient sedated more deeply than intended.\n\nA thumbs-up to a request, when speech is impractical, is a purposeful response; pulling away from a painful stimulus is a reflex. If responsiveness or breathing has worsened, a jaw thrust is a rescue maneuver and a reason to reassess, not evidence that the moderate label still holds because the examination can go on.',
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 74, to: 79 } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:10:25', end: '00:11:50' } },
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
      ],
      localPolicyIds: ['sedation_policy'],
    },
    {
      id: 'monitoring-continuous',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Monitoring is continuous clinical work',
      body: 'A designated, qualified clinician, separate from the operator, follows ventilation, oxygenation, responsiveness, circulation and their trends through the procedure and into recovery. The operator still responds to a concern rather than assuming someone else will interrupt, and reads blood pressure and pulse against stimulation and the timing of medication. Separate oral suction and rescue ventilation equipment are within reach.\n\nThe 2018 moderate-sedation guideline recommends continual clinical evaluation of ventilation, and capnography unless the patient, procedure or equipment precludes or invalidates it, alongside continuous pulse oximetry. During open-airway bronchoscopy the trace can be unreliable, and a poor trace does not replace looking at the patient. Respond to a worsening trend; interruption criteria belong in the approved local plan, not in a remembered number.',
      claimClass: 'update',
      sourceRefs: [
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 75, to: 79 } },
      ],
      localPolicyIds: ['sedation_policy'],
      reviewItemIds: ['R11', 'R12'],
    },
    {
      id: 'medication-events',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'When the medicine is the problem',
      body: 'Local-anesthetic systemic toxicity (LAST) can show as neurological change — ringing in the ears, a metallic taste, altered mental status or a seizure — or as circulatory instability or an arrhythmia. Sedation can hide the early neurological signs, so no fixed order of symptoms has to appear before it is considered. Stop further local anesthetic, call for expert help, support oxygenation and ventilation, and use the approved LAST pathway; know where its checklist and rescue kit are kept. ASRA’s 2020 checklist stresses early availability of lipid emulsion and the management of seizures and the circulation, and LAST resuscitation differs from routine ACLS, so the approved checklist, not memory, guides it.\n\nUnexpected, persistent low saturation or cyanosis after a topical agent widens the differential: benzocaine-associated methemoglobinemia is a separate problem, for the clinical team to evaluate with the appropriate study, and not simply too little oxygen. Medication-related respiratory depression can return after a reversal agent wears off. This course deliberately reproduces no rescue algorithm and no rescue doses.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 73, to: 74 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 74, to: 83 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 39, to: 40 } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:21:11', end: '00:22:36' } },
        { sourceId: 'U4', location: { kind: 'section', label: 'LAST checklist' } },
        { sourceId: 'U1', location: { kind: 'section', label: 'reversal recommendations' } },
      ],
      localPolicyIds: ['sedation_policy'],
      reviewItemIds: ['R14'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors lets one number, or one assumption, stand in for information the team does not have.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Adding milliliters: multiply each volume by its own concentration in mg/mL, then add the milligrams.',
        'Counting an administration with no recorded amount as zero: keep it on the record as unknown and ask the clinician who gave it.',
        'Subtracting the known subtotal from a remembered maximum to find what is left: the record states what has been given, not what remains or what is safe, and whether another dose is appropriate is decided under the approved policy.',
        'Adding different local anesthetics as interchangeable milligrams: their combined toxicity needs the approved clinical approach.',
        'Answering persistent cough or agitation with more intravenous sedation: first look for hypoxemia, wall contact, too little topical effect, upper-airway obstruction, reduced ventilation or an uncomfortable position; too little sedation is one possible cause, not the default.',
        'Hearing “low and slow” as proof that small doses are harmless: titrate under the approved protocol, watch the effect, and reassess before repeating a dose.',
      ],
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:22:46', end: '00:25:10' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 77, to: 79 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 154, to: 158 } },
      ],
      reviewItemIds: ['R13'],
    },
    {
      id: 'local-policy',
      kind: 'after-commitment',
      role: 'policy',
      heading: 'What your institution supplies',
      body: 'The agent, concentration, method of delivery and cumulative limit for topical anesthetic come from your institution’s approved policy, as do the sedation pathway, formulary, reversal protocol, staffing and the current fasting and aspiration-risk rules. Fixed fasting intervals, maximum sedative totals and discharge intervals after reversal from older training manuals are not current rules. The 2019 guideline supports the lowest effective lidocaine dose, a documented total across every way it was given, and lidocaine 10 mg/mL for spray-as-you-go application; it does not replace a site’s approved protocol.\n\nDisease severity informs the risk and the staffing; a high ASA physical-status class does not by itself call for deeper sedation or more propofol. The sedation plan needs a designated, qualified monitoring clinician separate from the operator, and the exact team is set locally.',
      claimClass: 'local-policy',
      sourceRefs: [
        {
          sourceId: 'U2',
          location: { kind: 'section', label: 'topical anesthesia recommendations' },
        },
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:01:17', end: '00:04:43' } },
        { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
      ],
      localPolicyIds: [
        'topical_anesthetic_policy',
        'sedation_policy',
        'fasting_and_aspiration_policy',
      ],
      reviewItemIds: ['R10', 'R11'],
    },
  ],

  workspace: {
    kind: 'monitor',
    caption:
      'Midway through an elective airway inspection under moderate sedation, as the operator asks for more topical anesthetic — scripted for teaching',
    readings: [
      {
        channel: 'airway-view',
        words: 'The main carina ahead; the patient coughs each time the tip comes near it',
        trend: 'new',
      },
      {
        channel: 'responsiveness',
        words: 'Opens the eyes and gives a thumbs-up when asked',
        trend: 'steady',
      },
      { channel: 'respiratory-effort', words: 'Regular, as before sedation', trend: 'steady' },
      { channel: 'capnography', words: 'The trace keeps its earlier shape', trend: 'steady' },
      {
        channel: 'oximetry',
        words: 'Unchanged from the start, on supplemental oxygen',
        trend: 'steady',
      },
      {
        channel: 'heart-rate',
        words: 'Rises briefly with each bout of coughing, then returns to its earlier rate',
        trend: 'steady',
      },
    ],
  },

  steps: {
    recognize: {
      instruction:
        'Read the monitor in the Simulator panel, then What the team can check before another dose in the Teaching panel: how the patient is responding, and where the team’s information about the doses comes from.',
      lookIn: {
        pane: 'simulator',
        landmark: SIMULATOR_LANDMARKS.monitor,
        alsoPane: 'teaching',
        alsoLandmark: 'What the team can check before another dose',
      },
    },
    act: {
      title: 'The shared dose record',
      instruction:
        'In the accounting table on this card, enter the milligrams for each measured line, then choose what the record can state.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.ledger },
    },
    explain: {
      title: 'Counting what the team gave',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'ledger',
    ledger: {
      id: 'shared-topical-ledger',
      prompt:
        'The topical anesthetic given during this inspection, one line per administration. Enter the milligrams for each measured line, then say what the record can state.',
      boundary:
        'Educational arithmetic: milligrams are concentration in mg/mL multiplied by volume in mL. The accounting table shows no limit and no remaining amount, and it does not say whether any dose is appropriate for a patient; the cumulative limit comes from your institution’s approved policy.',
      rows: [
        {
          id: 'bronchoscopist-channel',
          kind: 'measured',
          label: 'Operator — lidocaine through the working channel',
          detail:
            'Entered with its agent, concentration, volume, time and the clinician who gave it.',
          concentrationMgPerMl: 10,
          volumeMl: 4,
        },
        {
          id: 'second-clinician',
          kind: 'measured',
          label: 'A second clinician — lidocaine',
          detail: 'Reported aloud and entered with its agent, concentration, volume and time.',
          concentrationMgPerMl: 20,
          volumeMl: 3,
        },
        {
          id: 'preparation-spray',
          kind: 'unknown',
          label: 'A lidocaine spray in the preparation area',
          detail: 'Remembered by the nurse; given before the patient reached the procedure room.',
          reason: 'Its concentration and volume were not written down.',
        },
      ],
      totalPrompt: 'What can the shared record state about the cumulative amount?',
      totalChoices: [
        {
          id: 'a',
          label: '100 mg known; the total open until the spray is traced',
          rationale:
            '40 mg and 60 mg are known from their concentrations and volumes. The spray was given but never measured, so the record keeps it as an open line rather than adding nothing for it.',
          plausibility: 'best',
        },
        {
          id: 'b',
          label: '100 mg in total, so the dose now requested can be drawn up and given',
          rationale:
            'The spray’s concentration and volume are missing, so 100 mg of lidocaine is a known subtotal, not the total exposure. No arithmetic on an open record shows that a further dose is appropriate; the limit belongs to the approved policy.',
          plausibility: 'unsafe',
        },
        {
          id: 'c',
          label: '100 mg plus an estimate for the spray, from the usual preparation',
          rationale:
            'An estimate is an invented amount. The spray’s concentration and volume were never written down, and the usual preparation is not evidence of what this patient received; the line stays open until the clinician who gave it supplies them.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'd',
          label: 'No running amount yet: the measured lines wait until the spray is traced',
          rationale:
            'The known lines still belong on the record: 100 mg is known. Withholding it loses information the team needs while the spray is being traced.',
          plausibility: 'incorrect-mechanism',
        },
      ],
      totalIsUnknown: true,
      sourceRefs: [
        { sourceId: 'T07', location: { kind: 'time-span', start: '00:16:41', end: '00:18:10' } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
      ],
      localPolicyIds: ['topical_anesthetic_policy'],
    },
  },

  prediction: {
    id: 'Q19',
    seedId: 'Q19',
    itemType: 'management-decision',
    situation:
      'Midway through an elective airway inspection under moderate sedation, the patient coughs as the scope nears the carina and the operator asks for more topical anesthetic. Before it is drawn up, the nurse reads out the record: 4 mL of lidocaine 10 mg/mL given by the operator through the working channel, and 3 mL of lidocaine 20 mg/mL given by a second clinician. The nurse adds that the patient also had a lidocaine spray in the preparation area; its concentration and volume were not written down.',
    stem: 'What should the shared record state now?',
    choices: [
      {
        id: 'a',
        label: '100 mg in total, leaving room for the dose now requested',
        rationale:
          'Adding 40 mg and 60 mg gives 100 mg for the two measured lines only. The spray’s exposure is missing, and even a complete subtotal would not show that another dose is appropriate; the limit comes from the approved policy.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: '100 mg known so far; the preparation spray unresolved',
        rationale:
          'Each measured line is its volume times its own concentration: 40 mg plus 60 mg. The spray was given but never measured, so the record states the known amount and keeps the spray open until the clinician who gave it is asked.',
        plausibility: 'best',
      },
      {
        id: 'c',
        label: '7 mg of lidocaine so far, from the two lines read out',
        rationale:
          'Seven is the sum of the milliliters, not the milligrams. A volume is not a dose until its concentration is known: 4 mL at 10 mg/mL is 40 mg, and 3 mL at 20 mg/mL is 60 mg.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: '100 mg in total, from the two lines on the record',
        rationale:
          'A total built from the written lines alone counts the spray as zero, and unknown is not the same as absent. The record looks complete and the known subtotal looks like the whole exposure, which is how a further dose comes to seem acceptable.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'Milligrams come from each line’s volume multiplied by its own concentration: 4 mL × 10 mg/mL is 40 mg and 3 mL × 20 mg/mL is 60 mg, so 100 mg is known. The lidocaine spray in the preparation area was given but not measured, and unknown is not the same as absent, so the cumulative total stays incomplete until the clinician who gave it supplies the concentration, volume and time. The arithmetic does not show that 100 mg, or any further dose, is appropriate for this patient. The steady monitor and the thumbs-up show how the patient is now; they do not show how much has been given.',
    objectiveIds: ['M04-O5', 'M04-O2'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
    ],
    reviewItemIds: ['R13'],
  },

  transfer: {
    id: 'sedation-and-monitoring-transfer',
    itemType: 'management-decision',
    situation:
      'On a teaching list, a fellow performs the laryngeal and tracheal examination under moderate sedation, then hands the scope to the attending to finish. The handoff covers the sedative doses and the patient’s responses but says nothing about topical anesthetic. The record holds one topical line, a measured spray given by the nurse before the procedure; the fellow also instilled lidocaine through the working channel at the vocal folds, and its concentration and volume were neither called out nor entered. The attending plans to instill lidocaine at the carina.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label:
          'Ask the fellow what topical anesthetic was given, its concentration and volume, and enter it first',
        rationale:
          'The fellow’s instillation was given but never entered, so it is an open line, not a zero. Asking the clinician who gave it for the agent, concentration, volume and time, and entering it before any further dose, makes the running total the team’s rather than one operator’s.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Instill at the carina, since the one topical line on the record is the measured spray the nurse gave',
        rationale:
          'A record with one line is not a record of one administration. Treating the uncounted instillation as zero lets the nurse’s spray stand for the whole exposure just before more is given.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Ask the fellow how many milliliters of topical anesthetic were given and enter that volume',
        rationale:
          'A volume is not a dose until its concentration is known. The line needs the agent, concentration and volume actually instilled, from the clinician who gave it, so it can be converted to milligrams.',
        plausibility: 'incorrect-mechanism',
      },
      {
        id: 'd',
        label: 'Give more intravenous sedation instead, since the topical amount is now uncertain',
        rationale:
          'Sedation and topical anesthesia serve different purposes: more intravenous sedation does not replace topical effect, and it can hide the early signs of toxicity. An open line in the record is closed by asking, not by switching drugs.',
        plausibility: 'unsafe',
      },
    ],
    explanation:
      'At a handoff, an administration nobody called out is still an administration: it stays on the record as unknown until the clinician who gave it supplies the agent, concentration, volume and time. The running total belongs to the whole team, so the incoming operator reconciles it before any further dose rather than starting from the one line that happens to be written down. A known subtotal says nothing about whether another dose is appropriate; that comes from the approved policy applied to a reconciled record.',
    objectiveIds: ['M04-O5', 'M04-O2'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T07', location: { kind: 'time-span', start: '00:15:17', end: '00:18:10' } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 71, to: 74 } },
    ],
    reviewItemIds: ['R13'],
    transferVariant:
      'A handoff between operators: the unknown is an administration nobody called out rather than one reported without an amount, and the decision is the next move rather than what to record.',
  },

  practice: [
    {
      id: 'C14',
      manifestCaseId: 'C14',
      presentationTitle: 'A report from the anesthesia team with no amount',
      situation:
        'During a fictional teaching exercise, the operator has recorded 4 mL of lidocaine 10 mg/mL and 3 mL of lidocaine 20 mg/mL. A member of the anesthesia team then reports that additional local anesthetic was given, without a concentration or a volume. A decision about further topical anesthetic is pending.',
      item: {
        id: 'C14',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label:
              'Pause dose decisions and ask for the drug, how it was given, the amount and the time',
            rationale:
              'The report has no concentration or volume and may not be lidocaine, so it cannot be converted to milligrams or added to the 100 mg subtotal. Dose-dependent decisions wait for the details from the clinician who gave it and from the record.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Enter it as another 3 mL of lidocaine 20 mg/mL, matching the last line, and carry on',
            rationale:
              'The report names no agent, concentration or volume, so copying the last line invents an amount. Different local anesthetics cannot be added as interchangeable milligrams, and a guessed line makes the record look reconciled when it is not. Carrying on from an invented line lets the team dose against a record that only looks complete.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Subtract the known 100 mg from the remembered maximum and give up to the difference',
            rationale:
              'Subtraction from a supposed maximum is not a substitute for a reconciled record. With one administration of unknown agent and amount, 100 mg of lidocaine is a known subtotal, not the exposure, and the limit must come from the approved cumulative-dose policy.',
            plausibility: 'unsafe',
          },
          {
            id: 'd',
            label: 'Leave it off the record until the anesthesia team writes down an amount',
            rationale:
              'An administration left off the record is counted as zero by everyone who reads it, which is how a further dose comes to look acceptable. The report stays on the record, flagged as unknown, until the clinician who gave it resolves it.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'The two measured lines give a known subtotal of 100 mg, but the reported administration has no concentration or volume, so it can be entered neither as lidocaine nor as zero. Different local anesthetics cannot be summed as interchangeable milligrams, and subtracting from a supposed maximum does not replace a reconciled record. Dose-dependent decisions pause until the administering clinician supplies the drug, how it was given, the amount and the time, and the team confirms the approved cumulative-dose policy.',
        objectiveIds: ['M04-O5', 'M04-O2'],
        claimClass: 'transcript-source',
        sourceRefs: [
          { sourceId: 'T07', location: { kind: 'time-span', start: '00:16:41', end: '00:18:10' } },
        ],
        reviewItemIds: ['R13'],
      },
    },
    {
      id: 'mc-sedation-depth',
      presentationTitle: 'Responses after a further sedative dose',
      situation:
        'An airway inspection is under way on an order for moderate sedation. Shortly after a further sedative dose given for coughing, the coughing has stopped, but the patient no longer opens the eyes or gives a thumbs-up when asked, and pulls away only when the nurse applies a firm jaw thrust to open the airway. The capnography trace has become smaller and less regular. Oximetry, on supplemental oxygen, is unchanged from the start.',
      item: {
        id: 'mc-sedation-depth',
        itemType: 'mechanism-interpretation',
        stem: 'Which reading of the patient’s state fits these signals?',
        choices: [
          {
            id: 'a',
            label: 'Deeper than the moderate sedation the order planned for',
            rationale:
              'No purposeful response to a spoken request, withdrawal only from a painful jaw thrust, and an airway that needs support describe sedation deeper than moderate. The smaller trace fits falling ventilation, read with the other signals rather than alone.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label: 'Moderate sedation, as the order and the doses given intended',
            rationale:
              'Depth is defined by the patient’s response and physiology, not by the drug name, the intended dose or the label on the order. The order describes the plan; the patient shows what happened.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'c',
            label: 'Moderate sedation, since the patient still withdraws when stimulated',
            rationale:
              'Pulling away from a firm jaw thrust is a reflex to a painful stimulus. Moderate sedation keeps a purposeful response, such as a thumbs-up to a spoken request, which this patient no longer gives.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label: 'Settled by the topical anesthetic, which has now stopped the cough',
            rationale:
              'Topical anesthesia reduces sensation and reflexes at the mucosa it reaches; it does not remove the response to a spoken request or make the airway need a jaw thrust. Those changes come from the sedation.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'The patient’s response and physiology define the depth, not the drug, the dose or the order label. Moderate sedation keeps a purposeful response to voice or light touch with adequate spontaneous breathing and no airway intervention; here there is no purposeful response, withdrawal only from a painful stimulus, a jaw thrust to open the airway and a smaller capnography trace. Unchanged saturation on supplemental oxygen does not exclude hypoventilation: a sedated patient can hypoventilate before desaturating. The jaw thrust is a rescue maneuver and a reason to reassess, and the team must be ready to rescue a patient sedated more deeply than intended.',
        objectiveIds: ['M04-O1', 'M04-O3'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 74, to: 79 } },
          { sourceId: 'T07', location: { kind: 'time-span', start: '00:10:25', end: '00:11:50' } },
          { sourceId: 'U1', location: { kind: 'section', label: 'monitoring recommendations' } },
        ],
      },
    },
    {
      id: 'mc-toxicity-recognition',
      presentationTitle: 'New confusion late in a long inspection',
      situation:
        'Late in a long airway inspection under moderate sedation, lidocaine has been instilled through the working channel several times to settle coughing. The patient, who had been responding purposefully, becomes restless and confused. Moments later the monitor shows a new irregular rhythm. Breathing continues, and oximetry is unchanged.',
      item: {
        id: 'mc-toxicity-recognition',
        itemType: 'management-decision',
        stem: 'What is the next move?',
        choices: [
          {
            id: 'a',
            label: 'Stop further local anesthetic, call for help and use the approved LAST pathway',
            rationale:
              'New confusion and a new irregular rhythm after repeated topical doses raise local-anesthetic systemic toxicity. Stopping the exposure, getting expert help, supporting oxygenation and ventilation and using the approved pathway and its checklist is the response; no dose is improvised.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'Give more intravenous sedation to settle the restlessness, then finish the survey',
            rationale:
              'More sedation can hide the neurological signs of toxicity and deepens sedation on top of a change nobody has explained. Restlessness is a signal to explain, not to suppress.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'Call for help and reverse the sedative, treating the confusion as a sedative effect',
            rationale:
              'A sedative effect does not explain a new irregular rhythm arriving with confusion after repeated lidocaine, and reversing the sedative leaves the local-anesthetic exposure unaddressed. Help is needed, but for possible toxicity: further local anesthetic stopped and the approved LAST pathway used.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'Carry on with the survey, since breathing continues and oximetry has not changed',
            rationale:
              'Continued breathing and unchanged oximetry do not exclude a medication event. Confusion and a new arrhythmia are signals in their own right, and carrying on adds stimulation and, often, more topical anesthetic.',
            plausibility: 'unsafe',
          },
        ],
        explanation:
          'Altered mental status and a new arrhythmia after repeated topical doses raise the possibility of local-anesthetic systemic toxicity; sedation can mask the early neurological signs, and no fixed sequence of symptoms has to come first. The response is to stop further local anesthetic, call for expert help, support oxygenation and ventilation, and use the institution’s approved LAST pathway with its checklist and rescue kit. This course deliberately does not reproduce that pathway’s drug algorithm or doses.',
        objectiveIds: ['M04-O4'],
        claimClass: 'source',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 73, to: 74 } },
          { sourceId: 'U4', location: { kind: 'section', label: 'LAST checklist' } },
          { sourceId: 'T07', location: { kind: 'time-span', start: '00:21:11', end: '00:22:36' } },
        ],
        reviewItemIds: ['R14'],
      },
    },
  ],
}
