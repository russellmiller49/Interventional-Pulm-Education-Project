import type { Lesson } from './types'
import { question as q, sequence, matching } from './authoring'
export const prepareLessons: Lesson[] = [
  {
    id: 'clinical-question',
    title: 'Define the clinical question',
    topic: 'Prepare',
    minutes: 6,
    objective: 'Distinguish a diagnostic target from a complete nodal staging examination.',
    recall:
      'Review axial chest CT orientation and the major airway bifurcations before starting this course.',
    concept: 'The question determines the examination',
    paragraphs: [
      'Linear EBUS places an ultrasound transducer beside the airway and displays a needle in its imaging plane. EBUS-TBNA can obtain material for diagnosis and nodal staging. Radial EBUS, used to localize peripheral lesions, serves a different procedural role.',
      'A diagnostic procedure asks what the lesion is. A staging procedure asks where tumor has spread. A malignant sample from one accessible node may answer the first question while leaving other relevant stations unexamined. State both questions when both affect care.',
      'Review the CT and PET findings, possible alternative diagnoses, the safest useful target, and the tissue requirements with the team. Match the examination to the decision that follows the result.',
    ],
    checklist: [
      'Name the decision the result will change.',
      'Separate diagnosis from nodal extent.',
      'Identify tissue and ancillary-testing needs.',
    ],
    worked: {
      context:
        'A patient with a lung mass has an enlarged subcarinal node. The team needs a diagnosis and a mediastinal staging examination.',
      reasoning:
        'Station 7 may provide a diagnosis, but sampling it alone does not establish the status of other relevant stations. Plan a systematic survey and label each sampling site separately.',
    },
    question: q(
      'purpose-predict',
      'A malignant station 7 aspirate establishes lung carcinoma. The contralateral mediastinum has not been examined. Which question remains unresolved?',
      [
        'Whether disease involves other relevant nodal stations',
        'Histology from one station does not supply the rest of the nodal map.',
      ],
      [
        'Whether the ultrasound probe was linear',
        'Probe type is known from the procedure and does not resolve nodal extent.',
      ],
      [
        'Whether the same station should be renamed after cytology',
        'Station identity is anatomical; pathology does not change its name.',
      ],
    ),
    matching: matching(
      'Match each clinical request with its immediate information need.',
      [
        [
          'Unexplained mediastinal adenopathy',
          'Establish an etiology and preserve material for the differential diagnosis',
        ],
        [
          'Potentially curable lung cancer requiring mediastinal tissue staging',
          'Determine involvement of relevant nodal stations',
        ],
        [
          'Known cancer with requested biomarker testing',
          'Obtain and preserve adequate tumor material for the requested assays',
        ],
      ],
      'These requests can coexist. A complete plan accounts for each question before sampling.',
    ),
    observation: q(
      'purpose-observe',
      'Why does stating the tissue-testing request before bronchoscopy matter?',
      [
        'It guides specimen allocation',
        'A sample sufficient for one diagnostic stain may not satisfy all ancillary tests.',
      ],
      [
        'It eliminates the need to label the station',
        'Every sample still needs an anatomical source.',
      ],
      [
        'It determines the diagnosis before acquisition',
        'Planning preserves options; it does not establish pathology.',
      ],
    ),
    transfer: q(
      'purpose-transfer',
      'For isolated adenopathy, lymphoma and granulomatous disease are both being considered. What should be discussed before sampling?',
      [
        'Specimen requirements and diagnostic limitations',
        'Flow cytometry, microbiology, or additional tissue may be needed; agree on handling before obtaining material.',
      ],
      [
        'Assigning a lung-cancer N category to every enlarged node',
        'N classification describes regional tumor involvement in the relevant cancer context, not all adenopathy.',
      ],
      [
        'Treating a negative aspirate as exclusion of every possible diagnosis',
        'Negative sampling has diagnosis-specific limits, especially when architecture or additional testing is needed.',
      ],
    ),
    diagram: 'workflow',
    takeaways: [
      'A positive sample and a complete examination answer different questions.',
      'Plan tissue handling before the first pass.',
    ],
    sources: ['ers2026', 'chest2024', 'ics2023'],
    boundary:
      'The course teaches procedural reasoning. It does not choose a diagnostic pathway for an individual patient.',
  },
  {
    id: 'preparation',
    title: 'Preparation and the airway plan',
    topic: 'Prepare',
    minutes: 7,
    objective:
      'Identify unresolved preparation issues that should pause an elective EBUS procedure.',
    recall: 'The clinical question and likely specimen requirements should already be defined.',
    concept: 'Prepare the patient, team, and equipment',
    paragraphs: [
      'Review cardiopulmonary status, airway access, allergies, bleeding history, antithrombotic therapy, relevant imaging, fasting status, and consent. Antithrombotic interruption and laboratory testing depend on the drug, indication, patient, and local guidance; avoid a universal hold interval.',
      'Coordinate sedation or anesthesia, oxygenation and ventilation, monitoring, rescue capability, and recovery. The EBUS scope occupies more airway space than a small diagnostic bronchoscope. An airway conduit must accommodate the intended scope without compromising the ventilation plan.',
      'Confirm scope and processor function, the compatible needle and balloon if used, specimen supplies, and the receiving laboratory. Agree on the indication, intended stations, safety concerns, and stop conditions during the team pause.',
    ],
    checklist: [
      'Resolve medication and consent questions.',
      'Agree on the airway and rescue plan.',
      'Confirm equipment and specimen readiness.',
    ],
    worked: {
      context:
        'The patient arrives for elective EBUS. A recently prescribed anticoagulant is listed, but the last dose and indication are unclear.',
      reasoning:
        'Resolve the medication history and bleeding/thrombotic plan before starting. A routine appointment slot does not establish procedural readiness.',
    },
    question: q(
      'prep-predict',
      'The airway plan is documented, but the patient reports a new anticoagulant with an uncertain last dose. What should happen next?',
      [
        'Clarify the medication history and procedural plan',
        'The unresolved medication history may change bleeding risk and timing.',
      ],
      [
        'Proceed because needle aspiration cannot cause important bleeding',
        'Needle aspiration still carries bleeding risk; the assumption is unsafe.',
      ],
      [
        'Use a fixed hold interval without identifying the medication',
        'Different drugs, renal function, and thrombotic indications require different decisions.',
      ],
      true,
    ),
    sequence: sequence(
      'Order the preparation dependencies for this elective procedure.',
      [
        'Clarify the indication, patient risks, and medication history',
        'Agree on the patient-specific airway, sedation, and medication plan',
        'Verify equipment and specimen supplies and perform the team pause',
        'Begin after the agreed readiness checks are satisfied',
      ],
      'Readiness depends on resolving risks and resources before starting. This is a planning sequence, not an anesthesia protocol.',
    ),
    observation: q(
      'prep-observe',
      'Which conclusion is supported after this preparation sequence?',
      [
        'The team has agreed on readiness',
        'A checklist supports coordination; it does not remove procedural risk.',
      ],
      [
        'Complications are no longer possible',
        'Preparation reduces avoidable problems without guaranteeing safety.',
      ],
      [
        'The ultrasound findings are already known',
        'The imaging examination has not yet occurred.',
      ],
    ),
    transfer: q(
      'prep-transfer',
      'A planned airway conduit may be too narrow for the EBUS scope while maintaining ventilation. Which issue needs resolution?',
      [
        'Scope fit within the ventilation strategy',
        'Scope fit is part of the airway plan, not merely an equipment convenience.',
      ],
      [
        'Whether the image gain can compensate for the narrow conduit',
        'Gain changes ultrasound display, not airway patency.',
      ],
      [
        'Whether specimen labels can be prepared after the procedure',
        'Labeling is separate and does not solve the airway constraint.',
      ],
    ),
    diagram: 'workflow',
    takeaways: [
      'Unresolved readiness issues require a pause.',
      'Medication and airway plans are patient-specific.',
    ],
    sources: ['ics2023'],
    boundary:
      'Drug holds, fasting intervals, airway devices, and sedative doses must follow current local guidance and the responsible clinical team.',
  },
  {
    id: 'scope-orientation',
    title: 'Scope orientation and the imaging plane',
    topic: 'Prepare',
    minutes: 8,
    objective: 'Relate scope rotation to a change in the ultrasound plane.',
    recall: 'A linear EBUS transducer lies on one side of the distal scope.',
    concept: 'Endoscopic and ultrasound views answer different questions',
    paragraphs: [
      'The bronchoscopic view locates the tip within the airway. The ultrasound sector displays tissue beyond the wall along the transducer’s plane. These are related views with different perspectives; neither alone supplies a complete anatomical map.',
      'Scope rotation changes the direction of the sector. Tip flexion and advancement also change the relationship to the wall. In this activity, change rotation alone and compare the ultrasound with the Anatomy and Bronchoscopy views.',
      'The calibrated station start assists positioning. Finding a structure from that start is a scan-plane exercise, not a demonstration of independent airway navigation.',
    ],
    checklist: [
      'Locate the carina and main bronchi.',
      'Identify the transducer-facing side.',
      'Change one movement at a time.',
    ],
    worked: {
      context:
        'The airway location is stable, but a rounded structure enters and leaves the ultrasound sector as the scope rotates.',
      reasoning:
        'The structure has not moved between stations. A different plane now intersects it. Reconcile the plane with the airway and vascular landmarks.',
    },
    question: q(
      'orientation-predict',
      'At a stable airway position, the node disappears during rotation and reappears when rotation is reversed. What best explains this?',
      [
        'The imaging plane moved through and away from the node',
        'A two-dimensional sector samples different tissue as the scope rotates.',
      ],
      [
        'The node changed histology during the sweep',
        'An immediate reversible image change reflects acquisition, not tissue diagnosis.',
      ],
      [
        'The processor measured a new node size automatically',
        'No measurement was performed. Apparent dimensions may vary with the plane.',
      ],
    ),
    lab: {
      kind: 'simulator',
      linkedLesson: 'scope-orientation',
      goal: 'scan',
      presetKey: 'station_7_node_a::rms',
      controls: ['roll'],
      initialRoll: 55,
      instruction:
        'In Scope model, use Inspect a structure to select the active transducer surface. Observe its relationship to the gold optical-direction arrow and cyan sector. Use Scope rotation to bring the rounded target into the ultrasound sector and stop with it visible. Orbit changes only your viewpoint.',
    },
    observation: q(
      'orientation-observe',
      'The target becomes visible after your rotation. Which statement is justified?',
      [
        'The rendered sector now intersects the target',
        'Visibility confirms this modeled plane intersects the structure. It does not confirm a diagnosis.',
      ],
      [
        'The bronchoscope advanced into a different lobe',
        'Rotation alone did not command advancement.',
      ],
      [
        'The displayed structure is suitable for puncture without further checks',
        'Station identity, vascular relationships, and a safe path still need assessment.',
      ],
    ),
    transfer: q(
      'orientation-transfer',
      'A target looks smaller after a slight sweep while the depth setting is unchanged. What should you check before recording its size?',
      [
        'Whether the section through the node changed',
        'Size assessment depends on the selected imaging plane and visible borders.',
      ],
      ['Whether its stage has decreased', 'A scan-plane change does not change tumor stage.'],
      [
        'Whether the gain control can recover the prior diameter',
        'Gain changes received-signal brightness, not the geometric plane.',
      ],
    ),
    diagram: 'stations',
    takeaways: [
      'A sector is a slice through anatomy.',
      'Correlate the ultrasound plane with airway landmarks.',
    ],
    sources: ['ics2023', 'simulation'],
    boundary:
      'One calibrated anatomy model is used. Scope assists, limited degrees of freedom, and synthetic echoes do not reproduce hands-on navigation.',
  },
]
