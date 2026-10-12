import type { Lesson } from './types'
import { question as q, sequence, matching } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value
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
    question: {
      ...q(
        'purpose-predict',
        'A malignant station 7 aspirate establishes lung carcinoma. The contralateral mediastinum has not been examined. Which question remains unresolved?',
        [
          'Whether disease involves other relevant nodal stations',
          'A result from one station does not supply the rest of the nodal map.',
        ],
        [
          'Whether the station 7 result needs surgical confirmation',
          'A positive EBUS-TBNA aspirate stands on its own. It is a negative result with high clinical suspicion that may need surgical staging.',
        ],
        [
          'Whether the disease is N1 or N2',
          'A positive subcarinal node is already N2. What is unknown is whether contralateral (N3) stations are involved.',
        ],
      ),
      hint: 'A diagnostic procedure asks what the lesion is. A staging procedure asks where tumor has spread.',
    },
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
    observation: {
      ...q(
        'purpose-observe',
        'Why does stating the tissue-testing request before bronchoscopy matter?',
        [
          'It guides specimen allocation',
          'A sample sufficient for one diagnostic stain may not satisfy all ancillary tests.',
        ],
        [
          'It decides which station is sampled first',
          'Sampling order follows staging logic (N3, then N2, then N1), not the test request.',
        ],
        [
          'It lets ROSE stand in for the final pathology report',
          'ROSE judges adequacy during the procedure. The diagnosis and ancillary tests still come from the laboratory.',
        ],
      ),
      hint: 'Review the CT and PET findings, possible alternative diagnoses, the safest useful target, and the tissue requirements with the team. Match the examination to the decision that follows the result.',
    },
    transfer: {
      ...q(
        'purpose-transfer',
        'For isolated adenopathy, lymphoma and granulomatous disease are both being considered. What should be discussed before sampling?',
        [
          'Specimen requirements and diagnostic limitations',
          'Flow cytometry, microbiology, or additional tissue may be needed; agree on handling before obtaining material.',
        ],
        [
          'The N3-to-N1 order for a systematic staging survey',
          'That order prevents false upstaging in lung cancer. Here the open question is the diagnosis, so the specimen plan comes first.',
        ],
        [
          'Referral for mediastinoscopy, because EBUS cannot diagnose lymphoma',
          'EBUS-TBNA diagnoses many lymphomas when material is sent for flow cytometry. Surgical biopsy is kept for when architecture is needed.',
        ],
      ),
      hint: 'Review the CT and PET findings, possible alternative diagnoses, the safest useful target, and the tissue requirements with the team. Match the examination to the decision that follows the result.',
    },
    refreshers: [
      {
        href: '/learn/anatomy/branch-tracing/learn?lesson=carina-orientation',
        label: 'Why the CT looks backwards: match the axial CT to the scope at the carina',
        course: 'Bronchial Branch Tracing',
      },
      {
        href: '/bronchoscopy-foundations/learn?section=right-side',
        label: 'The right bronchial tree',
        course: 'Bronchoscopy Foundations',
      },
      {
        href: '/bronchoscopy-foundations/learn?section=left-side',
        label: 'The left airways',
        course: 'Bronchoscopy Foundations',
      },
    ],
    takeaways: [
      'A positive sample and a complete examination answer different questions.',
      'Plan tissue handling before the first pass.',
    ],
    sources: ['ers2026', 'chest2024', 'ics2023'],
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
      `Review cardiopulmonary status, airway access, allergies, bleeding history, antithrombotic therapy, relevant imaging, fasting status, and consent. Aspirin ${N('aspirin-continue')} (ICS/IAB 2023). For clopidogrel the sources differ: ACCP 2022 says ${N('clopidogrel-accp')} a procedure, BTS 2013 says ${N('clopidogrel-bts')} a biopsy, and ICS/IAB 2023 allows continuing it for EBUS-TBNA when the risk of thrombosis outweighs the risk of bleeding. For an anticoagulant, the hold depends on the drug and the renal function: find out which drug, why it was started and when the last dose was taken.`,
      `Patients should fast before EBUS. Follow the applicable anesthesia and local procedural policy for the required fasting interval. A common standard is no food for ${N('fasting-solids')} and clear fluids until ${N('fasting-clear-fluids')} before (BTS 2013).`,
      `Coordinate sedation or anesthesia, oxygenation and ventilation, monitoring, rescue capability, and recovery. A convex EBUS scope is ${N('scope-tip-diameter')} at the tip and ${N('scope-insertion-tube')} along the insertion tube (Olympus BF-UC190F), wider than a diagnostic bronchoscope. A small endotracheal tube will not take it and still leave room to ventilate, so plan a large tube or a laryngeal mask airway.`,
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
        'Find out the drug, its indication and the time of the last dose',
        'The hold differs by drug and by renal function, and the reason it was started decides how safely it can be held. None of that is known yet.',
      ],
      [
        'Proceed, because EBUS-TBNA is a low-bleeding-risk procedure',
        'The risk is low, not zero, and an unidentified anticoagulant has not been accounted for.',
      ],
      [
        'Apply the clopidogrel hold without identifying the medication',
        'The intervals in this lesson are for clopidogrel. An anticoagulant is held on a different schedule.',
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
      'Readiness depends on resolving risks and resources before starting.',
    ),
    observation: q(
      'prep-observe',
      'Which conclusion is supported after this preparation sequence?',
      [
        'The team has agreed on readiness',
        'A checklist supports coordination; it does not remove procedural risk.',
      ],
      [
        'Bleeding risk is back to that of an untreated patient',
        'Holding a drug lowers the bleeding risk without removing it, and the thrombotic risk has gone up.',
      ],
      [
        'The airway plan is settled for the rest of the case',
        'The plan is a starting point. Sedation depth, oxygenation and ventilation are reassessed throughout.',
      ],
    ),
    transfer: q(
      'prep-transfer',
      'A planned airway conduit may be too narrow for the EBUS scope while maintaining ventilation. Which issue needs resolution?',
      [
        'Change to a larger tube or a laryngeal mask airway',
        `The scope is ${N('scope-tip-diameter')} at its tip. It has to pass with room left to ventilate around it, and that is settled before the procedure starts.`,
      ],
      [
        'Pass a radial EBUS probe through the same tube instead',
        'Radial EBUS localizes peripheral lesions. It does not give real-time needle guidance for mediastinal nodes.',
      ],
      [
        'Lower the tidal volume so ventilation continues around the scope',
        'Smaller breaths do not make room in the tube. The scope still fills most of the lumen and airway pressure rises.',
      ],
    ),
    takeaways: [
      'Unresolved readiness issues require a pause.',
      'Know the antiplatelet intervals, and identify any anticoagulant before you start.',
    ],
    sources: ['ics2023', 'accp2022', 'bts2013', 'olympus-uc190f'],
  },
  {
    id: 'scope-orientation',
    title: 'Scope orientation and the imaging plane',
    topic: 'Prepare',
    minutes: 8,
    objective: 'Relate scope rotation to a change in the ultrasound plane.',
    recall:
      'The convex EBUS transducer sits on one side of the scope tip, just beyond the lens and the working-channel outlet.',
    concept: 'Endoscopic and ultrasound views answer different questions',
    paragraphs: [
      'The bronchoscopic view shows where the tip is in the airway. The ultrasound image shows the tissue beyond the wall, as a thin slice that runs along the length of the scope from the transducer. You need both: white light to know where you are, ultrasound to see what lies beside you.',
      'The green orientation dot at the upper right of the ultrasound image marks the proximal (cephalad) side of the view. Image right is toward the patient’s head, image left is toward the tip of the scope, and the needle enters the image from the side of the dot.',
      'Rotating the scope turns that slice around the airway. Structures enter and leave the image although neither the scope tip nor the node has moved along the airway. Flexing the tip presses the transducer against the wall; advancing or withdrawing slides the slice along the airway. In this lesson you change rotation alone.',
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
    question: {
      ...q(
        'orientation-predict',
        'At a stable airway position, the node disappears during rotation and reappears when rotation is reversed. What best explains this?',
        [
          'The imaging plane moved through and away from the node',
          'A two-dimensional sector samples different tissue as the scope rotates.',
        ],
        [
          'The transducer lost contact with the airway wall',
          'Lost contact blanks the whole image with air reverberation. Here one structure leaves while the surrounding tissue stays in view.',
        ],
        [
          'The node moved out of view with respiration',
          'Respiratory motion is cyclical and shifts everything in the image together. A change that follows your rotation and reverses with it is the plane.',
        ],
      ),
      imagePolicy: 'none',
    },
    lab: {
      kind: 'simulator',
      linkedLesson: 'scope-orientation',
      goal: 'scan',
      presetKey: 'station_7_node_a::rms',
      controls: ['roll'],
      initialRoll: 85,
      instruction:
        'Find the transducer on the 3D scope model. Then move the Scope rotation slider through at least 20° and watch the node enter and leave the ultrasound image. Finish with the node in the image.',
    },
    observation: {
      ...q(
        'orientation-observe',
        'The target becomes visible after your rotation. Which statement is justified?',
        [
          'The imaging plane now passes through the node',
          'Seeing the node means the plane cuts through it. That alone does not name the station or say what the node contains.',
        ],
        [
          'The scope tip is now level with a different station',
          'Rotation turns the plane around the airway at the same level. The tip has not moved along the airway.',
        ],
        [
          'The image now shows the node’s largest diameter',
          'One section that shows the node is not necessarily its widest. Sweep through it to find the largest short axis.',
        ],
      ),
      imagePolicy: 'retained-acquisition',
    },
    transfer: {
      ...q(
        'orientation-transfer',
        'A target looks smaller after a slight sweep while the depth setting is unchanged. What should you check before recording its size?',
        [
          'Whether the section through the node changed',
          'Size assessment depends on the selected imaging plane and visible borders.',
        ],
        [
          'Whether the frame was frozen in a different respiratory phase',
          'Respiration shifts the node a little but does not change its diameter. The section through it does.',
        ],
        [
          'Whether more gain would bring back the earlier border',
          'Gain brightens the returning echoes. It does not move the plane back to the node’s center.',
        ],
      ),
      imagePolicy: 'none',
    },
    diagram: 'stations',
    takeaways: [
      'A sector is a slice through anatomy.',
      'Correlate the ultrasound plane with airway landmarks.',
    ],
    sources: ['ics2023', 'simulation'],
  },
]
