import { SIMULATOR_LANDMARKS, STEPS_LANDMARKS, TEACHING_LANDMARKS } from '../landmarks'
import type { BronchSectionDefinition } from '../types'

/**
 * M14 — Specimen identity, allocation and interpretation. The last Sample section: a specimen
 * answers the clinical question only through a chain fixed before collection — question, site,
 * method, study, container and destination — and a result is read against how the sample was
 * actually collected. Knowledge spec §15 (S1 PDF 65, 118–131, 147–150; S2 PDF 155–163; T15; U7)
 * and drill D22.
 *
 * No colony count, organism, susceptibility value or antibiotic choice appears anywhere (R25, R26).
 */
export const section: BronchSectionDefinition = {
  id: 'specimen-pathway',
  title: 'The specimen, from question to laboratory',
  shortTitle: 'Specimen pathway',
  minutes: 7,
  moduleIds: ['M14'],
  objectives: [
    {
      objectiveId: 'M14-O1',
      subtask:
        'Places nine statements from one biopsy plan and the room under question, site, method, study, container and destination, and flags the links still to clarify.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M14-O2',
      subtask:
        'Flags a label carried forward from the previous patient, and a requisition naming only the broad abnormality, as links to settle before collection.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M14-O3',
      subtask:
        'Commits a next move when histology and a culture are planned and only formalin is in the room; weighs contamination from biopsy before a lavage in the transfer.',
      evidence: 'committed-explanation',
    },
    {
      objectiveId: 'M14-O4',
      subtask:
        'Decides, in a practice case, what a cytology report negative for malignant cells establishes when the samples may not represent the target.',
      evidence: 'case-decision',
    },
    {
      objectiveId: 'M14-O5',
      subtask:
        'Commits a conclusion about a low-return lavage taken after biopsy with no susceptibility table, without switching thresholds or drawing an antibiotic choice from the missing data.',
      evidence: 'committed-explanation',
    },
  ],
  drillIds: ['D22'],
  prerequisites: ['clinical-question', 'washing-and-lavage', 'protected-accessories'],

  clinicalQuestion:
    'When a bronchoscopic sample is taken, what decides whether the laboratory can answer the clinical question with it?',
  recognizeTitle: 'A planned biopsy and the specimen tray',
  objective:
    'Link a bronchoscopic specimen to the clinical question it serves, and judge what its result can and cannot say about the site sampled.',
  why: 'The patient accepts the risk of the procedure for what the specimen can show. A sample that cannot answer the question it was taken for can leave the patient needing another procedure.',
  newConcept:
    'A specimen answers the clinical question only through a chain fixed before collection — question, site, method, study, container and destination — and a link that is missing is clarified, not assumed or rewritten afterwards.',
  incrementSentence:
    'This section adds one idea to the sampling you have practiced: the specimen’s pathway is part of the procedure, settled before material is committed and recorded as it actually happened.',
  harmfulReflex:
    'Putting all the material into the formalin at hand and planning to add the culture request once it reaches the laboratory.',
  anchor: {
    analogy:
      'Packing parcels for two addresses: what goes in which box is decided before the boxes are sealed, because the sorting office cannot open a sealed box and repack it for the other address.',
    precise:
      'Formalin fixes tissue for routine histology; culture, and studies that need viable cells, need a different pathway. Material is divided by study before it is committed, each container carries this patient’s identity and the site actually sampled, and a result is read against how the sample was collected.',
    checklistLabel: 'Before the first sample is taken',
    checklist: [
      'The question and the differential, for the laboratory',
      'The actual site: side, lobe and segment, or the lesion',
      'Each study with its container, per the specimen directory',
      'Identity and site read back with the assistant',
    ],
  },

  spineStops: ['lobar'],
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
      'No control at the scope settles a specimen’s pathway. The forceps takes the sample; the plan decides which study each piece serves and what it travels in, and a missing link changes the plan before the next sample.',
  },
  precommitDenyPatterns: [
    /\bhow to divide\b/i,
    /\bculture container\b/i,
    /\ballocat(e|ed|es|ion|ing)\b/i,
    /\bundo fixation\b/i,
    /\bmaterial is committed\b/i,
    /\bclarif(y|ied|ies|ication)\b/i,
    /\bbefore (or during )?(collection|sampling)\b/i,
  ],
  modelBoundary:
    'This section does not model a laboratory. Containers, minimum volumes, temperature and time to processing come from your laboratory’s specimen directory, and no result value, colony count or antibiotic choice appears here.',
  localPolicyIds: ['specimen_directory', 'bal_protocol'],
  reviewItemIds: ['R21', 'R25', 'R26'],

  blocks: [
    {
      id: 'a-sample-leaves-the-room',
      kind: 'question',
      role: 'framing',
      heading: 'A sample leaves the room',
      body: 'Every sample leaves the procedure room in a container, under a label, with a request.\n\nThis section follows one specimen from the clinical question that justified it to the laboratory that reports on it, and then to the team that reads the result.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
      ],
    },
    {
      id: 'what-travels',
      kind: 'signals',
      role: 'signals',
      heading: 'What travels with a specimen',
      body: 'Each of these is recorded somewhere: on the requisition, the label, the specimen tray or the collection record. Before a decision, name which of them it depends on.',
      pointsLabel: 'Carried with every specimen',
      points: [
        'The clinical question and the differential diagnosis',
        'The patient’s identity',
        'The site: side, lobe and segment, or the lesion',
        'How the sample was collected',
        'The studies requested',
        'The container or medium, and the laboratory it goes to',
      ],
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
      ],
    },
    {
      id: 'plan-from-the-question',
      kind: 'pattern',
      role: 'normal-reference',
      heading: 'A plan that starts from the question',
      body: 'In a well-prepared case, the plan starts from the clinical question and the differential diagnosis, reviewed with the images before the procedure. The question decides the site — the lobe and segment, or the lesion itself — and the question, the site and the target together decide the sampling method.\n\nThe laboratory receives more than material. It is given the clinical context and the differential, so that the result can be reported against the question.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 120, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
      ],
    },
    {
      id: 'container-before-sample',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Why the container is chosen first',
      body: 'Material for routine histology may go into formalin. Material for culture, or for flow cytometry and other studies that need viable cells, needs a different pathway: once tissue is fixed, a culture request added at the laboratory cannot reverse it. When the differential includes lymphoma, an unusual infection or disease that needs further characterization of the tissue, allocation is discussed with the laboratory in advance.\n\nThe exact container, minimum volume, temperature and time to processing are laboratory-specific. Your laboratory’s specimen directory sets them.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 120, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
      ],
      localPolicyIds: ['specimen_directory'],
    },
    {
      id: 'identity-site-handling',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Identity, the actual site and clean handling',
      body: 'At collection, the operator and the assistant verify the patient’s identity, the side, the lobe and segment, the specimen type and the study requested. Specimens from distinct sites are kept apart when that distinction matters. The label names the site actually sampled — not the broad radiological abnormality, and not a site that a software default carried forward from the previous patient or the first sample.\n\nContamination can come from upper-airway material, another sampled lesion, material retained in the working channel, blood introduced by instrumentation, or a mishandled container. It is especially consequential when it makes a second site appear involved by tumor. Collection sequence and clean handling are part of the diagnostic procedure, not clerical details.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 65 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 150 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
      ],
    },
    {
      id: 'what-a-result-can-say',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Obtained, adequate, negative, nondiagnostic',
      body: 'A specimen can be technically obtained and still be inadequate. A negative result may mean the disease is absent — or that the target was missed, the sample was small, prior treatment altered the findings, or the study does not address the disease well. Three reports stay separate: nondiagnostic, negative for a specified finding, and representative of a specific benign process.\n\nRapid on-site evaluation can help judge material, but it does not replace final processing or show that every later analysis will be possible. “Cancer present” may not finish the task when classification or further studies are needed, and a visually impressive sample is not proof of adequacy.',
      claimClass: 'source',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
      ],
    },
    {
      id: 'quality-travels-with-the-result',
      kind: 'after-commitment',
      role: 'mechanism',
      heading: 'Collection quality travels with the result',
      body: 'How a sample was collected is part of its result. The record keeps the method actually performed apart from the one planned: suction needed first to clear the airway, what was instilled and what came back, and how the sample was sent.\n\nSuction needed to clear the airway does not by itself invalidate a lavage, and a label that does not match what was done can mislead interpretation and the decisions made from it.',
      claimClass: 'transcript-source',
      sourceRefs: [
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:31:59', end: '00:39:19' } },
        { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      ],
      localPolicyIds: ['bal_protocol'],
      reviewItemIds: ['R21', 'R25'],
    },
    {
      id: 'common-errors',
      kind: 'after-commitment',
      role: 'common-errors',
      heading: 'Common errors and their correction',
      body: 'Each of these errors treats a specimen as settled when a link in its pathway is missing or unknown.',
      pointsLabel: 'The error, then the correction',
      points: [
        'Putting all the material in formalin and adding the culture later: divide the material by study before any of it is committed, per the specimen directory, and agree the division with the laboratory in advance when the differential includes lymphoma or an unusual infection, or the tissue needs further characterization.',
        'Labeling the broad abnormality, or a site a software default carried forward, instead of the segment sampled: label the actual collection site and read it back.',
        'Taking a large, impressive sample as proof of adequacy: adequacy is judged against the question, once the laboratory has processed it.',
        'Reading a negative result as a benign diagnosis: ask whether the sample was adequate and represented the target.',
      ],
      claimClass: 'synthesis',
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
      ],
      localPolicyIds: ['specimen_directory'],
    },
  ],

  workspace: {
    kind: 'map',
    lit: ['RLL'],
    caption: 'The airway map: the right lower lobe bronchus, where a biopsy is planned',
  },

  steps: {
    recognize: {
      instruction:
        'In the Teaching panel, read What travels with a specimen; the airway map in the Simulator panel lights the right lower lobe bronchus, where a biopsy is planned.',
      lookIn: {
        pane: 'teaching',
        landmark: 'What travels with a specimen',
        alsoPane: 'simulator',
        alsoLandmark: SIMULATOR_LANDMARKS.map,
      },
    },
    act: {
      title: 'The pathway for this biopsy',
      instruction:
        'On this card, place each statement under the link of the specimen pathway it supplies, or under Not provided — must clarify when the plan leaves a link blank or names it too broadly, or a link does not match this patient. Then check the set.',
      lookIn: { pane: 'steps', landmark: STEPS_LANDMARKS.sortRows },
    },
    explain: {
      title: 'The chain behind a specimen',
      instruction: `Read ${TEACHING_LANDMARKS.adds} in the Teaching panel, then why the other answers do not fit, on this card.`,
    },
  },

  act: {
    kind: 'sort',
    sort: {
      id: 'biopsy-pathway',
      prompt:
        'Nine statements from the plan and the room for the right lower lobe biopsy. For each, name the link of the specimen pathway it supplies — or Not provided — must clarify, when the plan leaves that link blank or names it too broadly, or it does not match this patient.',
      origins: [
        {
          id: 'question',
          label: 'Clinical question',
          definition: 'What the result must answer, and the differential diagnosis behind it.',
        },
        {
          id: 'site',
          label: 'Site',
          definition: 'Where the material comes from, named at the level it is actually sampled.',
        },
        {
          id: 'method',
          label: 'Method',
          definition: 'How the material is collected: washing, lavage, brush or forceps.',
        },
        {
          id: 'study',
          label: 'Study',
          definition:
            'The laboratory analysis the question needs: histology, cytology, microbiology, cell counts or a special study.',
        },
        {
          id: 'container',
          label: 'Container or medium',
          definition: 'What the material travels in, chosen for the study it serves.',
        },
        {
          id: 'destination',
          label: 'Destination',
          definition: 'The laboratory that receives the specimen, and what it is told.',
        },
        {
          id: 'missing',
          label: 'Not provided — must clarify',
          definition:
            'A link the plan leaves blank or names too broadly to act on, or one that does not match this patient: settled before collection, not assumed.',
        },
      ],
      rows: [
        {
          id: 'differential',
          statement:
            'Whether the lesion is a tumor or an unusual infection, as the supervising physician’s differential puts it.',
          origin: 'question',
          rationale:
            'It names what the result must answer. The laboratory is told the differential so that it can process and report the specimen against it.',
        },
        {
          id: 'named-site',
          statement:
            'The lesion in the right lower lobe bronchus, named by lobe and airway from the imaging.',
          origin: 'site',
          rationale:
            'The site comes from the imaging and the airway, named at the level actually sampled and read back at collection.',
        },
        {
          id: 'forceps',
          statement: 'Forceps biopsy of the visible lesion.',
          origin: 'method',
          rationale:
            'Forceps biopsy of a visible lesion samples the airway lesion itself; the method follows from the question, the site and the target.',
        },
        {
          id: 'two-studies',
          statement: 'Histology on some pieces, and culture on others.',
          origin: 'study',
          rationale:
            'Two studies serve the differential: histology reads the tissue after fixation, and culture, which needs material that has not been fixed, looks for an organism.',
        },
        {
          id: 'formalin',
          statement: 'Formalin for the pieces going to histology.',
          origin: 'container',
          rationale:
            'Formalin fixes tissue for routine histology. It suits these pieces, and not the pieces meant for culture.',
        },
        {
          id: 'two-laboratories',
          statement:
            'Pathology for the histology pieces, microbiology for the culture pieces, each with a completed request.',
          origin: 'destination',
          rationale:
            'Each laboratory receives its material with the clinical context, so that it reports against the question rather than on material alone.',
        },
        {
          id: 'no-culture-medium',
          statement: 'A container for the culture pieces: none in the room yet.',
          origin: 'missing',
          rationale:
            'A culture needs material that has not been fixed, in the container the laboratory specifies. Until one is in the room, that link is missing, and it is settled before the first biopsy rather than after.',
        },
        {
          id: 'carried-forward-label',
          statement: 'The label printer still shows the previous patient’s name and biopsy site.',
          origin: 'missing',
          rationale:
            'A label carried forward from another patient gives neither this patient’s identity nor this site. It is discarded and replaced with a label for this patient and the site being sampled, read back with the assistant before any container is filled.',
        },
        {
          id: 'broad-requisition',
          statement: 'The requisition names the target only as “right lung mass”.',
          origin: 'missing',
          rationale:
            'A broad radiological description is not the collection site. The requisition is amended to name the lobe and airway actually sampled.',
        },
      ],
      sourceRefs: [
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 121 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
        { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 150 } },
        { sourceId: 'S2', location: { kind: 'pdf-pages', from: 155, to: 163 } },
        { sourceId: 'T06', location: { kind: 'time-span', start: '00:02:35', end: '00:06:36' } },
      ],
    },
  },

  prediction: {
    id: 'Q10',
    seedId: 'Q10',
    itemType: 'management-decision',
    situation:
      'A supervised bronchoscopy is about to start. The plan is forceps biopsy of a visible lesion in the right lower lobe bronchus. The supervising physician’s differential includes a tumor and an unusual infection, and the requisition asks for histology and a culture. While the tray is set out, the assistant reports that every specimen container in the room holds formalin.',
    stem: 'What is the next move?',
    choices: [
      {
        id: 'a',
        label:
          'Before sampling, settle with the laboratory how to divide the pieces, and get a culture container',
        rationale:
          'Histology and culture need different media, and only formalin is in the room. Settling the division with the laboratory and obtaining a suitable container before the first biopsy keeps both planned studies possible.',
        plausibility: 'best',
      },
      {
        id: 'b',
        label:
          'Put all the pieces in formalin and add the culture request once the tissue has reached the laboratory',
        rationale:
          'Formalin fixes the tissue, and a culture needs material that has not been fixed. A request added at the laboratory cannot reverse fixation, so the planned culture may need another procedure.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Start sampling into formalin while the assistant fetches a culture container for the later pieces',
        rationale:
          'Histology is served, but the first pieces go into formalin before the division between the studies is agreed, and the culture then depends on pieces not yet taken. With an unusual infection on the differential, allocation is discussed with the laboratory in advance, before any material is committed.',
        plausibility: 'reasonable-but-incomplete',
      },
      {
        id: 'd',
        label:
          'Send histology alone, since a visible lesion makes a tumor likelier than an infection',
        rationale:
          'Appearance does not settle the diagnostic question. The supervising physician’s differential includes an unusual infection, and the culture exists to answer that part of it.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'Formalin fixes tissue for routine histology; a culture needs material that has not been fixed, and a request added at the laboratory cannot undo fixation. So the allocation — which pieces go to which study, in which container — is settled with the laboratory before any material is committed. A visible lesion does not settle the differential, and starting while the container is fetched commits the first pieces before the division is agreed.',
    objectiveIds: ['M14-O3'],
    claimClass: 'source',
    sourceRefs: [
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 120, to: 121 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 130, to: 131 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
    ],
  },

  transfer: {
    id: 'Q24',
    seedId: 'Q24',
    itemType: 'mechanism-interpretation',
    situation:
      'The morning after an overnight bronchoscopy in the ICU, the covering physician reads the record. The note calls the sample a BAL of the lingula, where the new opacity lies. The collection record shows that brushings and forceps biopsies were taken from the same segment before the lavage, and that only a small volume of fluid came back. The preliminary culture reports growth of an organism, with no quantity given, and the susceptibility table has not been issued.',
    stem: 'Which response to this result is justified?',
    choices: [
      {
        id: 'a',
        label:
          'Reclassify it as an aspirate, apply the aspirate threshold and choose an antibiotic on that reading',
        rationale:
          'Calling a lavage an aspirate after the result changes the rule applied to it, not the sample, and no aspirate threshold was validated for this collection. It hides the quality problem instead of weighing it, and with no susceptibility data this sample gives no basis for a susceptibility-directed drug choice; any treatment decision rests on the clinical evaluation.',
        plausibility: 'unsafe',
      },
      {
        id: 'b',
        label: 'Until the table is issued, record the usual susceptibilities of the organism grown',
        rationale:
          'Values the laboratory has not reported are not data. An unknown value is not a normal one, and writing expected values into the patient’s record presents an assumption as a result that can steer treatment.',
        plausibility: 'unsafe',
      },
      {
        id: 'c',
        label:
          'Record its collection limits, then get the full laboratory report and clinical context',
        rationale:
          'Biopsy before the lavage and a small return mean the sample may be contaminated with blood and may not represent the distal airspaces. Stating that limitation and obtaining the complete report and the clinical context is what makes the interpretation of this result defensible.',
        plausibility: 'best',
      },
      {
        id: 'd',
        label:
          'Keep it as a BAL and act on the growth, since a lavage taken after biopsy is still a lavage',
        rationale:
          'It is still a lavage, but blood from the biopsies may have entered it, a small return may not represent the distal airspaces, and growth with no quantity, read without the clinical suspicion, prior antibiotics and severity, does not establish the cause of the opacity.',
        plausibility: 'incorrect-mechanism',
      },
    ],
    explanation:
      'The collection record — biopsy first, a small return — makes this sample’s representativeness uncertain. Calling it an aspirate after the fact does not give it a validated aspirate threshold, and a susceptibility table that has not been issued supports no susceptibility-directed antibiotic choice. The defensible response states the limitation and asks for the complete laboratory report and the clinical context; any treatment decision meanwhile rests on the clinical evaluation — suspicion, prior antibiotic exposure, severity and other possible sources of infection — not on this sample alone, and is reviewed when the full report arrives.',
    objectiveIds: ['M14-O5', 'M14-O3'],
    claimClass: 'transcript-source',
    sourceRefs: [
      { sourceId: 'T15', location: { kind: 'time-span', start: '00:32:53', end: '00:39:19' } },
      {
        sourceId: 'U7',
        location: { kind: 'section', label: 'contextual interpretation of quantitative cultures' },
      },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 119 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 127 } },
      { sourceId: 'S1', location: { kind: 'pdf-pages', from: 147, to: 148 } },
    ],
    reviewItemIds: ['R25', 'R26'],
    transferVariant:
      'After the procedure rather than before it: a lavage result read from the record in the ICU by a physician who did not take the sample, instead of a biopsy plan at the bedside.',
    retrievesFrom: 'washing-and-lavage',
  },

  practice: [
    {
      id: 'mc-negative-is-not-benign',
      presentationTitle: 'A cytology report on a persistent upper-lobe opacity',
      situation:
        'A supervised bronchoscopy was done for a persistent focal opacity in the left upper lobe. The procedure note records that the opacity lay beyond the visible airways, that no imaging guidance was used, and that brushings and a washing were taken from the segmental bronchus leading toward it. The cytology report reads “negative for malignant cells”. In the chart, the referring team writes that cancer has been excluded.',
      item: {
        id: 'mc-negative-is-not-benign',
        itemType: 'mechanism-interpretation',
        stem: 'What does the cytology report establish?',
        choices: [
          {
            id: 'a',
            label:
              'No malignant cells were found in these samples; the opacity itself is still unexplained',
            rationale:
              'The report is a statement about these samples. Taken without guidance from an airway leading toward a target beyond the visible lumen, they may have missed it, so the clinical question stays open for the supervising team.',
            plausibility: 'best',
          },
          {
            id: 'b',
            label:
              'The opacity is benign, because cytology from its airway found no malignant cells',
            rationale:
              '“Negative for malignant cells” is not a benign diagnosis. A negative can mean the target was missed or the sample was small, and closing the evaluation on it can leave a cancer undiagnosed.',
            plausibility: 'unsafe',
          },
          {
            id: 'c',
            label:
              'The samples were nondiagnostic, so the report gives no reading of them either way',
            rationale:
              'Negative and nondiagnostic are different reports. The laboratory could assess this material and found no malignant cells in it; what the report cannot say is whether the samples came from the opacity.',
            plausibility: 'incorrect-mechanism',
          },
          {
            id: 'd',
            label:
              'The bronchoscopy met its diagnostic aim, because the samples were obtained without difficulty',
            rationale:
              'A technically obtained sample is not the same as a diagnostic one. Obtaining material is the procedure; whether it answers the question depends on where it came from and what the laboratory could find in it.',
            plausibility: 'incorrect-mechanism',
          },
        ],
        explanation:
          'A negative result may mean the disease is absent — or that the target was missed, the sample was small, prior treatment altered the findings, or the study does not address the disease well. Samples from an airway leading toward a target beyond the visible lumen, taken without guidance, may not represent it. Nondiagnostic, negative for a specified finding, and representative of a specific benign process are three different reports, and only the last would support calling the opacity benign.',
        objectiveIds: ['M14-O4'],
        claimClass: 'synthesis',
        sourceRefs: [
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 118, to: 131 } },
          { sourceId: 'S1', location: { kind: 'pdf-pages', from: 149, to: 150 } },
          { sourceId: 'T06', location: { kind: 'time-span', start: '00:02:35', end: '00:06:36' } },
        ],
      },
    },
  ],
}
