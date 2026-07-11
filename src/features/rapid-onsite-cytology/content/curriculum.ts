export interface RoseFrameworkStep {
  id: string
  number: string
  title: string
  question: string
  action: string
  caution: string
}

export interface RoseAdequacyAxis {
  id: string
  title: string
  question: string
  positiveSignal: string
  trap: string
}

export interface RoseCaseChoice {
  id: string
  label: string
  feedback: string
}

export interface RoseCaseDecision {
  prompt: string
  choices: RoseCaseChoice[]
  correctChoiceId: string
}

export interface RoseCaseImage {
  src: string
  alt: string
  revealAlt: string
  sourceLabel: string
  sourceUrl: string
  license: string
  licenseUrl: string
  attribution: string
}

export interface RoseDecisionCase {
  id: string
  focus: string
  title: string
  target: string
  clinicalQuestion: string
  smearFinding: string
  image?: RoseCaseImage
  assessment: RoseCaseDecision
  triage: RoseCaseDecision
  reveal: {
    onsiteCall: string
    reasoning: string[]
    pitfall: string
  }
}

export interface RoseReference {
  id: string
  title: string
  citation: string
  url: string
  useInModule: string
  sourceType: string
}

export interface RoseArtifactRescue {
  id: string
  title: string
  signal: string
  risk: string
  response: string
}

export const roseFrameworkSteps: RoseFrameworkStep[] = [
  {
    id: 'question',
    number: '01',
    title: 'Name the clinical question',
    question: 'Diagnosis, nodal staging, lymphoma, infection, or biomarker tissue?',
    action:
      'Say the target and the downstream need before the first pass so the team can prepare the right containers and priorities.',
    caution: '“Adequate” has no meaning until the endpoint is named.',
  },
  {
    id: 'quality',
    number: '02',
    title: 'Check smear quality',
    question: 'Can you interpret what is on the slide?',
    action:
      'Scan for cellularity, distribution, blood, mucus, crush, drying, stain quality, and a thin area with preserved cells.',
    caution: 'A thick blue focus or a bloody smear is not automatically lesional material.',
  },
  {
    id: 'target',
    number: '03',
    title: 'Prove target representation',
    question: 'What element shows that the needle sampled the intended target?',
    action:
      'Look for target-specific material: lymphoid tissue in a node, a reproducible lesional population in a mass, or the expected inflammatory process.',
    caution: 'Benign bronchial cells can be real cells from the wrong place.',
  },
  {
    id: 'bucket',
    number: '04',
    title: 'Use the narrowest safe bucket',
    question:
      'Non-diagnostic, negative/benign, atypical, suspicious, malignant, or a specific inflammatory pattern?',
    action:
      'State representativeness separately, then communicate the broad pattern that the rapid preparation can support. Reserve definitive typing for integrated final pathology when needed.',
    caution: 'ROSE is not a contest to force a final subtype from one field.',
  },
  {
    id: 'triage',
    number: '05',
    title: 'Protect the next test',
    question: 'Where should the next material go?',
    action:
      "Coordinate allocation to the laboratory's validated tumor-preserving preparations, fresh material for flow cytometry, or sterile material for microbiology according to the differential and local protocol.",
    caution:
      "A diagnostic smear can coexist with inadequate material in the laboratory's validated final or biomarker preparation.",
  },
  {
    id: 'call',
    number: '06',
    title: 'Close the loop out loud',
    question: 'What is represented, what is seen, what remains uncertain, and what changes next?',
    action:
      'Give a short structured call and confirm that the proceduralist heard the implication for the next pass or station.',
    caution: 'Avoid a bare “adequate” or “negative”—both hide the clinical meaning.',
  },
]

export const roseAdequacyAxes: RoseAdequacyAxis[] = [
  {
    id: 'representative',
    title: 'Representative',
    question: 'Did the sample reach the intended target?',
    positiveSignal:
      'Target-specific elements or a reproducible lesional population are present and fit the sampled site.',
    trap: 'Abundant cells can still be nonrepresentative; benign airway cells do not prove a peripheral lesion was sampled.',
  },
  {
    id: 'interpretable',
    title: 'Interpretable',
    question: 'Is the rapid preparation technically readable?',
    positiveSignal:
      'At least part of the smear has preserved, well-distributed cells with enough detail for a preliminary category.',
    trap: 'Blood, crush, poor spreading, stain precipitate, and thick groups can create false confidence or hide the target.',
  },
  {
    id: 'sufficient',
    title: 'Sufficient for the endpoint',
    question: 'Is enough useful material preserved for what comes next?',
    positiveSignal:
      "Material has been preserved in the laboratory's validated preparation(s); adequacy for IHC, PD-L1, molecular testing, flow cytometry, or microbiology remains endpoint- and assay-specific and may not be knowable onsite.",
    trap: 'Diagnostic on ROSE does not automatically mean sufficient for immunostains, molecular testing, or every ancillary study.',
  },
]

export const roseArtifactRescues: RoseArtifactRescue[] = [
  {
    id: 'blood',
    title: 'Blood-dominant smear',
    signal: 'Red cells dominate; diagnostic groups are rare, trapped in clot, or absent.',
    risk: 'High cellularity is mistaken for target representation.',
    response:
      'State that the smear is blood-diluted, inspect clot/tissue fragments, and coordinate a technique or target adjustment while preserving material for the laboratory workflow.',
  },
  {
    id: 'thick-crush',
    title: 'Thick or crushed smear',
    signal: 'Dark heaped groups, streaking, bare nuclei, or loss of interpretable cell detail.',
    risk: 'Artifact is mistaken for hyperchromasia, molding, or true crowding.',
    response:
      'Use a smaller drop and gentle pull-apart or feathering according to local practice; examine thinner edges and avoid grinding material between slides.',
  },
  {
    id: 'necrosis',
    title: 'Necrosis without viable cells',
    signal:
      'Granular debris and inflammation are present, but no preserved lesional population is found.',
    risk: 'Necrosis alone is overcalled as a specific tumor or infection.',
    response:
      'Communicate the limitation and, if clinically appropriate, redirect sampling toward a viable region while preserving material for relevant ancillary studies.',
  },
  {
    id: 'bronchial',
    title: 'Bronchial contamination',
    signal: 'Ciliated or orderly bronchial cells are present in a sample from a peripheral target.',
    risk: 'Benign cells from the access path are reported as a benign lesion.',
    response:
      'Treat the target as unproven unless target-specific material is also present; the immediate problem is acquisition, not more stains on the contaminant.',
  },
]

const nonRepresentativeImage: RoseCaseImage = {
  src: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/d1a6/11086742/df85366aebde/nihms-1985348-f0001.jpg',
  alt: 'Two lung cytology panels: one with distorted dark cellular material and one with an orderly sheet of ciliated cells.',
  revealAlt:
    'Insufficient lung cytology examples showing severe crush artifact and benign ciliated bronchial cells without a lesional population.',
  sourceLabel: 'WHO lung cytopathology review — insufficient/inadequate examples',
  sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution:
    'Dolezal et al., Journal of Clinical and Translational Pathology, 2024; composite figure displayed responsively with interactive teaching context added',
}

const adenocarcinomaImage: RoseCaseImage = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/d/de/Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
  alt: 'Diff-Quik smear with cohesive three-dimensional groups of blue cells and scattered background cells.',
  revealAlt:
    'Diff-Quik smear showing crowded cohesive three-dimensional groups of atypical epithelial cells consistent with adenocarcinoma.',
  sourceLabel: 'Lung adenocarcinoma — Diff-Quik, high magnification',
  sourceUrl:
    'https://commons.wikimedia.org/wiki/File:Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  attribution:
    'Librepath, via Wikimedia Commons; image displayed responsively with interactive teaching context added',
}

const granulomaImage: RoseCaseImage = {
  src: 'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/d1a6/11086742/a7ccec6b6e10/nihms-1985348-f0004.jpg',
  alt: 'Paired cytology and cell-block panels with compact cohesive cell aggregates in an inflammatory background.',
  revealAlt:
    'Paired cytology and cell-block panels showing epithelioid histiocyte aggregates and non-necrotizing granulomatous inflammation.',
  sourceLabel: 'WHO lung cytopathology review — sarcoidosis granuloma example',
  sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution:
    'Dolezal et al., Journal of Clinical and Translational Pathology, 2024; composite figure displayed responsively with interactive teaching context added',
}

export const roseDecisionCases: RoseDecisionCase[] = [
  {
    id: 'wrong-place',
    focus: 'Representativeness',
    title: 'Cells are present—but is the target?',
    target: 'Peripheral pulmonary nodule, first needle-aspiration pass',
    clinicalQuestion: 'Is the nodule represented, and should sampling continue?',
    smearFinding:
      'The rapid smear is heavily bloody with scattered ciliated bronchial cells. No reproducible lesional population is identified.',
    image: nonRepresentativeImage,
    assessment: {
      prompt: 'What is the most useful rapid assessment?',
      correctChoiceId: 'nonrepresentative',
      choices: [
        {
          id: 'nonrepresentative',
          label: 'Nonrepresentative / non-diagnostic for the targeted nodule',
          feedback:
            'Correct. The slide contains cells, but nothing establishes that the nodule itself was sampled.',
        },
        {
          id: 'benign',
          label: 'Benign nodule',
          feedback:
            'Benign bronchial cells identify airway contamination, not the biology of the targeted nodule.',
        },
        {
          id: 'negative-node',
          label: 'Representative and negative for malignancy',
          feedback:
            'A negative malignancy statement is premature because target representation has not been established.',
        },
        {
          id: 'suspicious',
          label: 'Suspicious for carcinoma',
          feedback:
            'Blood and benign ciliated cells do not provide an atypical or malignant lesional population.',
        },
      ],
    },
    triage: {
      prompt: 'What should the ROSE call change next?',
      correctChoiceId: 'reacquire',
      choices: [
        {
          id: 'reacquire',
          label:
            'Report nonrepresentation; re-check targeting and obtain more material if appropriate',
          feedback:
            'Correct. The value of ROSE here is immediate feedback that the clinical target is not yet demonstrated.',
        },
        {
          id: 'stop',
          label: 'Stop because benign cells are present',
          feedback:
            'Stopping would confuse benign contamination with a benign target and risks a false-negative procedure.',
        },
        {
          id: 'all-molecular',
          label: 'Send the remaining sample directly for molecular testing',
          feedback:
            'Molecular testing on nonrepresentative material can produce an unhelpful false-negative result.',
        },
        {
          id: 'subtype',
          label: 'Request immunostains to subtype the bronchial cells',
          feedback:
            'The problem is sampling, not subtyping. More stains cannot make the wrong material representative.',
        },
      ],
    },
    reveal: {
      onsiteCall:
        '“Blood and benign bronchial cells only; the targeted nodule is not represented on this rapid smear. Additional sampling is needed if clinically appropriate.”',
      reasoning: [
        'Technical cellularity and target representativeness are different questions.',
        'A rapid “benign” label would overstate what this specimen can answer.',
        'The next useful action is to improve acquisition, not to spend limited material on ancillary testing.',
      ],
      pitfall:
        'Cells from the airway can look reassuring while the lesion remains completely unsampled.',
    },
  },
  {
    id: 'represented-node',
    focus: 'Nodal staging',
    title: 'The anthracotic 4L sample',
    target: 'Station 4L during systematic mediastinal staging',
    clinicalQuestion: 'Is the station represented, and what can ROSE safely communicate?',
    smearFinding:
      'The smear contains abundant small mature-appearing lymphocytes with scattered anthracotic macrophages. No reproducible malignant population is seen on the rapid slide.',
    assessment: {
      prompt: 'What is the most useful rapid assessment?',
      correctChoiceId: 'representative-lymphoid',
      choices: [
        {
          id: 'representative-lymphoid',
          label: 'Representative lymphoid tissue; no malignant cells seen on this rapid smear',
          feedback:
            'Correct. This answers representation while keeping the negative statement limited to the rapid preparation.',
        },
        {
          id: 'final-negative',
          label: 'Definitively negative lymph node',
          feedback:
            'ROSE cannot replace complete slide review, evaluation of validated final preparations, or the final integrated pathology report.',
        },
        {
          id: 'nondiagnostic',
          label: 'Non-diagnostic because no tumor is present',
          feedback:
            'Representative lymphoid tissue can establish that a staging node was sampled even when malignant cells are not seen.',
        },
        {
          id: 'lymphoma',
          label: 'Lymphoma because many lymphocytes are present',
          feedback:
            'Lymphocytes are expected in a lymph node. A lymphoma concern requires an atypical population and appropriate ancillary workup.',
        },
      ],
    },
    triage: {
      prompt: 'What is the best next-step communication?',
      correctChoiceId: 'continue-plan',
      choices: [
        {
          id: 'continue-plan',
          label:
            'Continue systematic staging; keep each station separately labeled and preserve material per local protocol',
          feedback:
            'Correct. ROSE confirms representation of this labeled specimen without collapsing the rest of the staging map or specimen plan.',
        },
        {
          id: 'end-staging',
          label: 'End the staging procedure because this station is negative',
          feedback:
            'One representative station does not substitute for the planned systematic staging strategy.',
        },
        {
          id: 'discard',
          label: 'Discard the needle rinse because the smear is already adequate',
          feedback:
            'Remaining material may be important for validated final preparations and review even when the rapid smear is representative.',
        },
        {
          id: 'microbiology',
          label: 'Send all subsequent material for microbiology',
          feedback:
            'There is no infectious or granulomatous cue in this vignette to justify abandoning the staging plan.',
        },
      ],
    },
    reveal: {
      onsiteCall:
        '“The specimen labeled station 4L contains representative lymphoid tissue. No malignant cells are identified on this rapid preparation; final cytology is pending.”',
      reasoning: [
        'The call states what proves representation.',
        'It limits the negative finding to the rapid slide rather than promising a final result.',
        'Specimen-level representation is not procedure-level staging; the systematic staging plan and local pass protocol still govern the procedure.',
        'When applicable, highest-stage nodes are sampled first (N3, then N2, then N1), with each station separately labeled to reduce carryover and preserve the staging map.',
      ],
      pitfall:
        '“Adequate and negative” can be heard as a final diagnosis or a completed mediastinal stage; ROSE establishes neither.',
    },
  },
  {
    id: 'malignant-epithelial',
    focus: 'Downstream sufficiency',
    title: 'The crowded blue groups',
    target: 'Mediastinal node in a patient with a suspicious lung mass',
    clinicalQuestion: 'Is lesional material present, and is the procedure finished?',
    smearFinding:
      'Multiple cohesive three-dimensional groups show nuclear crowding, irregular contours, and enlarged nuclei. The finding is reproducible across the smear.',
    image: adenocarcinomaImage,
    assessment: {
      prompt: 'What is the narrowest safe rapid category?',
      correctChoiceId: 'malignant-epithelial',
      choices: [
        {
          id: 'malignant-epithelial',
          label: 'Malignant epithelial-cell pattern',
          feedback:
            'Correct. The reproducible atypical cohesive population supports a malignant epithelial category on the rapid smear.',
        },
        {
          id: 'adenocarcinoma-final',
          label: 'Definitive lung adenocarcinoma with actionable mutation',
          feedback:
            'The morphology may suggest glandular differentiation, but final type and biomarker status require additional material and testing.',
        },
        {
          id: 'reactive',
          label: 'Reactive bronchial epithelium',
          feedback:
            'Reproducible crowded three-dimensional atypical groups argue against a purely reactive population.',
        },
        {
          id: 'nondiagnostic',
          label: 'Non-diagnostic because the exact subtype is uncertain',
          feedback:
            'Uncertain subtype does not erase clear lesional and malignant evidence at the broader category level.',
        },
      ],
    },
    triage: {
      prompt: 'What should happen to subsequent material?',
      correctChoiceId: 'cell-block',
      choices: [
        {
          id: 'cell-block',
          label:
            'Prioritize locally validated tumor-preserving preparation(s) for final typing and biomarkers',
          feedback:
            'Correct. Diagnostic cells on one smear do not guarantee enough preserved tumor for typing and biomarkers; validated smears, liquid cytology, or cell block may be used locally.',
        },
        {
          id: 'stop-immediately',
          label: 'Stop immediately because the rapid smear is diagnostic',
          feedback:
            'A diagnostic rapid smear may still leave the final specimen inadequate for immunostains or biomarkers.',
        },
        {
          id: 'more-smears',
          label: 'Use every subsequent pass to make more rapid smears',
          feedback:
            'Overproducing smears can deplete material needed for validated final preparations and ancillary studies.',
        },
        {
          id: 'flow',
          label: 'Send all remaining material for flow cytometry',
          feedback:
            'Flow cytometry is not the default destination for a cohesive malignant epithelial pattern.',
        },
      ],
    },
    reveal: {
      onsiteCall:
        "“The target is represented and malignant epithelial cells are present. Please preserve additional material in the laboratory's validated tumor and biomarker preparation(s); final typing and ancillary adequacy are pending.”",
      reasoning: [
        'The rapid category is strong enough to direct triage without overpromising a subtype.',
        'Repeated lesional groups are more reliable than one isolated atypical cluster.',
        'The downstream endpoint—not merely a positive smear—determines whether enough tissue has been collected.',
      ],
      pitfall:
        'The most common premature finish is “diagnostic on slide” without confirming material remains for the tests that will guide care.',
    },
  },
  {
    id: 'granulomatous',
    focus: 'Specimen routing',
    title: 'The PET-avid subcarinal node',
    target: 'PET-avid subcarinal lymph node',
    clinicalQuestion:
      'What broad process is present, and what material may be lost if the team waits?',
    smearFinding:
      'Cohesive epithelioid histiocyte aggregates are present in an inflammatory background. No reproducible malignant epithelial population is identified on the rapid slide.',
    image: granulomaImage,
    assessment: {
      prompt: 'What is the most useful rapid category?',
      correctChoiceId: 'granulomatous',
      choices: [
        {
          id: 'granulomatous',
          label: 'Granulomatous inflammation; infection remains in the differential',
          feedback:
            'Correct. This describes the observed process and preserves the etiologic differential.',
        },
        {
          id: 'sarcoid',
          label: 'Definitive sarcoidosis',
          feedback:
            'Granulomas are a pattern, not an etiology. Infection, sarcoidosis, treatment effect, foreign material, and malignancy-associated reactions may overlap.',
        },
        {
          id: 'tb',
          label: 'Definitive tuberculosis',
          feedback:
            'Necrotizing granulomatous inflammation can raise infection, but organisms and microbiologic confirmation are not established by this rapid image alone.',
        },
        {
          id: 'negative',
          label: 'Negative for malignancy; no further workup needed',
          feedback:
            'A granulomatous process may need microbiology and can coexist with malignancy; a broad “negative” call hides both issues.',
        },
      ],
    },
    triage: {
      prompt: 'Which triage move has the highest immediate value?',
      correctChoiceId: 'culture-cell-block',
      choices: [
        {
          id: 'culture-cell-block',
          label:
            'If infection is clinically suspected, coordinate sterile microbiology material and preserve cytology material per local protocol',
          feedback:
            'Correct. When infection is in the clinical differential, fresh sterile material cannot be reconstructed later; validated cytology preparations support final interpretation.',
        },
        {
          id: 'smears-only',
          label: 'Make rapid smears from all remaining material',
          feedback:
            'This may exhaust material that should have been routed fresh for microbiology or preserved for validated cytology preparations.',
        },
        {
          id: 'molecular-tumor',
          label: 'Send all material for tumor molecular profiling',
          feedback:
            'The current pattern prioritizes inflammatory/infectious triage, not an unproven tumor profile.',
        },
        {
          id: 'stop',
          label: 'Stop because granulomas fully explain the PET finding',
          feedback:
            'Granulomas do not by themselves establish etiology or exclude a coexisting malignant process.',
        },
      ],
    },
    reveal: {
      onsiteCall:
        '“The specimen contains granulomatous inflammation. Morphology and special stains alone do not establish or exclude infection. If infection is in the clinical differential, please allocate fresh sterile material for microbiology and retain cytology material per local protocol.”',
      reasoning: [
        'The rapid pattern is actionable even before an etiology is known.',
        'The call avoids equating granulomas with either sarcoidosis or tuberculosis.',
        'Microbiology routing is conditional on the clinical differential and local protocol; when tuberculosis is suspected, coordinate mycobacterial smear and culture plus TB PCR when available.',
      ],
      pitfall:
        'If all material is fixed, the opportunity for culture is permanently lost; granulomas and negative stains still do not exclude a coexisting infection or malignancy.',
    },
  },
  {
    id: 'atypical-lymphoid',
    focus: 'Clinical differential',
    title: 'A node with a different downstream need',
    target: 'Mediastinal node with lymphoma in the clinical differential',
    clinicalQuestion: 'Does the sample require a lymphoma-specific triage pathway?',
    smearFinding:
      'The smear is dominated by a relatively monomorphic discohesive lymphoid population with cytologic atypia. No cohesive epithelial groups are identified.',
    assessment: {
      prompt: 'What is the most useful rapid assessment?',
      correctChoiceId: 'atypical-lymphoid',
      choices: [
        {
          id: 'atypical-lymphoid',
          label: 'Atypical lymphoid population; lymphoma cannot be excluded',
          feedback:
            'Correct. This communicates the concern without making a lymphoma diagnosis from limited rapid morphology.',
        },
        {
          id: 'representative-benign',
          label: 'Representative benign lymph node',
          feedback:
            'Representation alone does not explain away a monomorphic atypical lymphoid population.',
        },
        {
          id: 'small-cell',
          label: 'Definitive small cell carcinoma',
          feedback:
            'Small blue-cell patterns require chromatin, cytoplasm, molding, crush pattern, clinical context, and ancillary correlation; cohesion is not required for small cell carcinoma.',
        },
        {
          id: 'nondiagnostic',
          label: 'Non-diagnostic because carcinoma is absent',
          feedback:
            'The clinical question includes lymphoma. An atypical lymphoid population is relevant lesional material, not an empty specimen.',
        },
      ],
    },
    triage: {
      prompt: 'What should happen before the opportunity is lost?',
      correctChoiceId: 'flow-cell-block',
      choices: [
        {
          id: 'flow-cell-block',
          label:
            'Route fresh material for flow and preserve complementary morphology; consider architecture-preserving tissue if suspicion remains',
          feedback:
            'Correct. Fresh viable cells and complementary morphology are useful, but negative flow or FNA does not exclude lymphoma and some entities require architecture.',
        },
        {
          id: 'formalin-only',
          label: 'Place all remaining material in formalin',
          feedback:
            'Formalin-only handling can remove the option for standard flow cytometry on fresh viable cells.',
        },
        {
          id: 'cultures',
          label: 'Send all material for bacterial culture',
          feedback:
            'There is no infectious pattern in the vignette to make culture the sole priority.',
        },
        {
          id: 'stop',
          label: 'Stop because the lymph node is represented',
          feedback:
            'Representation is only the first adequacy axis; the specimen must also support the suspected disease pathway.',
        },
      ],
    },
    reveal: {
      onsiteCall:
        '“The specimen contains an atypical lymphoid population. Lymphoma cannot be excluded; please obtain fresh material for flow cytometry and preserve complementary morphology according to laboratory protocol. Final classification and the need for architecture-preserving tissue remain pending.”',
      reasoning: [
        'The clinical differential changes what “adequate” requires.',
        'Atypical lymphoid morphology should trigger triage, not an unsupported final subtype.',
        'Fresh viable material is time-sensitive, but negative flow cytometry or FNA/ROSE does not exclude lymphoma, especially Hodgkin lymphoma.',
        'Persistent or high suspicion may require core, excisional, or other architecture-preserving tissue through a multidisciplinary pathway.',
      ],
      pitfall:
        'Calling every lymphocyte-rich aspirate “representative node”—or treating negative flow as exclusion—can miss lymphoma and delay architecture-preserving sampling.',
    },
  },
]

export const roseReferences: RoseReference[] = [
  {
    id: 'chest-2025',
    title: 'CHEST guideline: EBUS-TBNA acquisition and handling',
    citation:
      'Gilbert CR, et al. Acquisition and Handling of Endobronchial Ultrasound Transbronchial Needle Samples. Chest. 2025;167(3):899-909. doi:10.1016/j.chest.2024.08.056.',
    url: 'https://doi.org/10.1016/j.chest.2024.08.056',
    useInModule:
      'Frames ROSE as immediate feedback for adequacy, preliminary information, and specimen triage, and distinguishes the four-or-more-pass strategy for suspected malignant EBUS-TBNA from cytology adequacy thresholds.',
    sourceType: 'Clinical practice guideline',
  },
  {
    id: 'ers-staging-2026',
    title: 'ERS/ESGE/ESTS lung-cancer endosonography guideline',
    citation:
      'Korevaar DA, Kovacevic B, Papadopoulou E, et al. ERS/ESGE/ESTS clinical practice guidelines on endobronchial and oesophageal endosonography for the diagnosis and staging of lung cancer. Eur Respir J. Published May 21, 2026;2600097. doi:10.1183/13993003.00097-2026.',
    url: 'https://publications.ersnet.org/content/erj/early/2026/05/14/1399300300097-2026',
    useInModule:
      'Supports systematic rather than target-only nodal staging as the minimal standard and combined EBUS plus EUS(-B) when appropriate.',
    sourceType: 'Multisociety clinical practice guideline',
  },
  {
    id: 'cap-2020',
    title: 'CAP multidisciplinary thoracic specimen guideline',
    citation:
      'Roy-Chowdhuri S, et al. Collection and Handling of Thoracic Small Biopsy and Cytology Specimens for Ancillary Studies. Arch Pathol Lab Med. 2020;144(8):933-958. doi:10.5858/arpa.2020-0119-CP. Reaffirmed February 2026.',
    url: 'https://www.cap.org/cap-guidelines/collection-and-handling-of-thoracic-small-biopsy-and-cytology-specimens-for-ancillary-studies/',
    useInModule:
      'Supports endpoint-specific collection, careful use of small samples, and ROSE when ancillary studies are anticipated.',
    sourceType: 'Active evidence-based guideline',
  },
  {
    id: 'cap-lymphoma-2021',
    title: 'CAP/ASCP adult lymphoma workup guideline',
    citation:
      'Kroft SH, Sever CE, Bagg A, et al. Laboratory Workup of Lymphoma in Adults: Guideline From the American Society for Clinical Pathology and the College of American Pathologists. Arch Pathol Lab Med. 2021;145(3):269-290. doi:10.5858/arpa.2020-0261-SA.',
    url: 'https://www.cap.org/cap-guidelines/laboratory-workup-of-lymphoma-in-adults/',
    useInModule:
      'Supports ancillary testing with morphology, warns against FNA cytomorphology alone, and identifies entities that require architectural assessment.',
    sourceType: 'Active evidence-based guideline',
  },
  {
    id: 'who-2024',
    title: 'WHO reporting system for lung cytopathology',
    citation:
      'Dolezal D, Kholová I, Cai G. The World Health Organization Reporting System for Lung Cytopathology—A Review of the First Edition. J Clin Transl Pathol. 2024;4(1):18-35. doi:10.14218/JCTP.2023.00068.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
    useInModule:
      'Supports standardized categories, the distinction between benign and nonrepresentative material, and the absence of one universal adequacy threshold.',
    sourceType: 'International reporting-system review',
  },
  {
    id: 'rose-perspective-2018',
    title: 'Pulmonary Pathology Society perspective on EBUS ROSE',
    citation:
      'Jain D, et al. Rapid On-Site Evaluation of EBUS-Guided Transbronchial Needle Aspirations for the Diagnosis of Lung Cancer. Arch Pathol Lab Med. 2018;142(2):253-262. doi:10.5858/arpa.2017-0114-SA.',
    url: 'https://doi.org/10.5858/arpa.2017-0114-SA',
    useInModule:
      'Provides a practical framework for target representation, broad preliminary categories, and triage for immunohistochemistry, microbiology, flow cytometry, and molecular assays.',
    sourceType: 'Expert perspective',
  },
  {
    id: 'psc-ancillary-2016',
    title: 'Papanicolaou Society respiratory ancillary-testing consensus',
    citation:
      'Layfield LJ, et al. Utilization of Ancillary Studies in the Cytologic Diagnosis of Respiratory Lesions. Diagn Cytopathol. 2016;44(12):1000-1009. doi:10.1002/dc.23549.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5590370/',
    useInModule:
      'Supports ROSE-directed triage for microbiologic culture, flow cytometry, immunocytochemistry, and molecular testing while recognizing multiple validated cytology preparations.',
    sourceType: 'Consensus recommendations',
  },
]
