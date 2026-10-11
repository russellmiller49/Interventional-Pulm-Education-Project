import type { Lesson } from './types'
import { question as q, matching, sequence } from './authoring'
import { EBUS_NUMBERS } from './teachingNumbers'

const N = EBUS_NUMBERS.value
export const sampleLessons: Lesson[] = [
  {
    id: 'needle-safety',
    title: 'Needle safety and the sampling sequence',
    topic: 'Sample',
    minutes: 8,
    objective: 'Identify the safety checks that precede and follow a needle pass.',
    recall:
      'The target station, stable acoustic window, and vascular path should be established before sampling.',
    concept: 'Keep the needle controlled and the tip visible',
    paragraphs: [
      'Check the needle–scope compatibility and the current manufacturer instructions. Before insertion or removal through the working channel, visually confirm that the needle is retracted into its sheath and secured as specified for the device.',
      'Protected needle/assembly preparation may occur according to the device and local workflow. Confirm the intended target, live ultrasound image, and an acceptable vascular path immediately before needle exposure and advancement.',
      'Confirm the target and path on live ultrasound. Advance and sample with the needle tip continuously identified in the imaging plane. If you lose the tip, stop moving the needle. Bring it back into the plane with small rotations of the scope, not by advancing.',
      `Set the needle stop to the depth you measured to the far side of the node, so the needle cannot travel beyond it. Within the node, move the needle back and forth ${N('agitations-per-pass')} times on each pass (CHEST 2016; ICS/IAB 2023 suggests at least 10). Suction and the stylet are both optional (ICS/IAB 2023). Resistance means stop and reassess, not push.`,
    ],
    checklist: [
      'Confirm device compatibility and protected needle position.',
      'Use a stable live image and assessed path.',
      'Track the tip and reassess any loss of view or resistance.',
    ],
    worked: {
      context:
        'The needle shaft is visible, but its tip leaves the imaging plane during an attempted pass.',
      reasoning:
        'A visible shaft does not establish the tip’s position. Stop movement, restore visualization, and reassess before continuing.',
    },
    question: q(
      'needle-predict',
      'The needle tip is no longer identifiable on live ultrasound. What is the next action?',
      [
        'Stop needle movement and restore a reliable view',
        'Continuing without the tip removes essential real-time guidance.',
      ],
      [
        'Advance farther until the tip reappears',
        'Blind advancement risks unintended penetration.',
      ],
      [
        'Use the shaft as proof that the tip remains inside the node',
        'The shaft and tip can occupy different positions relative to the imaging plane.',
      ],
      'both',
    ),
    sequence: sequence(
      'Arrange the checkpoints around a pass. Protected preparation follows the device and local workflow; this example does not prescribe a universal order for preparation.',
      [
        'Confirm the labeled target, live image, and acceptable vascular path',
        'Confirm protected needle position and prepare the assembly per the IFU',
        'Perform the pass while identifying the tip on live ultrasound',
        'Confirm retraction and secure the needle before channel removal',
        'Transfer and label the specimen using the agreed handling plan',
      ],
      'Protected needle/assembly preparation may occur according to the device and local workflow. Confirm the intended target, live ultrasound image, and an acceptable vascular path immediately before needle exposure and advancement. The checkpoints preserve target identity, live guidance, device protection, and specimen traceability.',
    ),
    observation: q(
      'needle-observe',
      'Why confirm retraction before removing the assembly through the channel?',
      [
        'An exposed tip can harm the patient or the equipment',
        'Retraction and securing the assembly follow the current device instructions.',
      ],
      ['Retraction determines nodal histology', 'It is a safety maneuver, not a diagnostic test.'],
      [
        'A sheath automatically makes all needle positions safe',
        'The needle position must actually be checked.',
      ],
    ),
    transfer: q(
      'needle-transfer',
      'A densely calcified target resists needle entry. Which response is appropriate?',
      [
        'Stop forcing the needle and reassess the target or approach',
        'Excessive force can cause device damage; a different site or strategy may be needed.',
      ],
      [
        'Apply increasing force until the wall gives way',
        'Resistance should prompt reassessment, not escalation of force.',
      ],
      [
        'Increase ultrasound gain to reduce mechanical resistance',
        'Gain changes the image, not the needle mechanics.',
      ],
      true,
    ),
    diagram: 'needle',
    takeaways: [
      'Visible shaft does not mean visible tip.',
      'Retraction checks protect the patient and equipment.',
    ],
    sources: ['ics2023', 'chest2016'],
  },
  {
    id: 'adequacy-rose',
    title: 'Adequacy, passes, and ROSE',
    topic: 'Sample',
    minutes: 7,
    objective: 'Distinguish a useful on-site assessment from final diagnosis and assay adequacy.',
    recall:
      'The sampling plan includes both a clinical question and specimen-testing requirements.',
    concept: 'Adequacy is specific to the task',
    paragraphs: [
      'Rapid on-site evaluation (ROSE) provides immediate feedback about the submitted material and may guide further acquisition or allocation. It does not replace final pathology and does not automatically establish adequacy for all molecular or ancillary tests.',
      `For suspected malignancy, the 2024 CHEST guideline recommends ${N('passes-per-station')} needle passes per station rather than three or fewer (a strong recommendation on very low certainty evidence), and suggests ROSE where it is available. Four passes do not guarantee enough material for every assay.`,
      `The same guideline suggests a ${N('needle-gauge')} needle for suspected malignancy. Needle choice does not make up for poor targeting or the wrong container. When molecular testing is planned, take additional passes for cell block.`,
    ],
    checklist: [
      'Ask what the on-site finding establishes.',
      'Track passes and station labels.',
      'Confirm material for the final requested studies.',
    ],
    worked: {
      context:
        'ROSE identifies malignant cells, but the team has not yet secured material for the planned biomarkers.',
      reasoning:
        'The diagnosis may be provisionally supported while the complete specimen request remains unfinished. Reconcile acquisition with the pathology team and the patient’s procedural tolerance.',
    },
    question: q(
      'rose-predict',
      'ROSE reports malignant cells on an early aspirate. Which issue remains separate?',
      [
        'Adequacy for the requested ancillary assays',
        'An on-site finding does not guarantee final assay adequacy.',
      ],
      ['Whether the anatomical station changes', 'Pathology does not alter the sampling location.'],
      [
        'Whether all other stations are now known to be positive',
        'A finding at one site does not classify unsampled stations.',
      ],
    ),
    matching: matching(
      'Match each statement with the information it provides.',
      [
        ['ROSE identifies lymphoid material', 'On-site evidence about the submitted specimen'],
        [
          'Final pathology diagnoses carcinoma',
          'Final diagnostic interpretation of the processed material',
        ],
        ['Laboratory confirms sufficient tumor for the requested assay', 'Adequacy for that assay'],
      ],
      'These judgments occur at different stages and answer different questions.',
    ),
    observation: q(
      'rose-observe',
      'What is the correct role of a recommended pass count?',
      [
        'A guide interpreted with adequacy and safety',
        'The CHEST recommendation does not make a fixed number proof of adequate material.',
      ],
      [
        'A guarantee that any four specimens will support every assay',
        'Material quality and the assay requirements still matter.',
      ],
      [
        'A requirement to continue despite a major complication',
        'Clinical safety overrides a numerical acquisition target.',
      ],
    ),
    transfer: q(
      'rose-transfer',
      'ROSE is unavailable for a planned EBUS procedure. What should the team do?',
      [
        'Agree on acquisition and laboratory handling',
        'EBUS can be performed without ROSE; plan material and follow-up deliberately.',
      ],
      [
        'Assume any aspirate is adequate because it contains blood',
        'Blood alone is not evidence of representative target material.',
      ],
      [
        'Treat a normal-looking node as a substitute for cytology',
        'Morphology does not provide specimen adequacy.',
      ],
    ),
    diagram: 'specimens',
    takeaways: [
      'ROSE, final diagnosis, and molecular adequacy are distinct.',
      'A pass-count recommendation does not replace judgment.',
    ],
    sources: ['chest2024', 'ics2023'],
  },
  {
    id: 'specimen-triage',
    title: 'Specimen triage and traceability',
    topic: 'Sample',
    minutes: 7,
    objective: 'Choose handling plans that preserve the requested diagnostic options.',
    recall:
      'The most useful tissue can become unusable for a planned assay if it is placed in the wrong medium.',
    concept: 'The sample is part of a diagnostic pathway',
    paragraphs: [
      'Keep each station separately identified through acquisition, containers, requisitions, and the final report. Confirm site and requested studies with the receiving team. A pooled unlabeled specimen may establish malignancy while losing crucial staging information.',
      'Smears and cell-block material support cytologic evaluation. Suspected lymphoma may require fresh material for flow cytometry and sometimes additional tissue for architecture. Suspected infection may require a separately collected specimen for microbiology. Typical defaults are RPMI or saline for flow cytometry, a sterile container with no fixative for culture, and formalin or an alcohol-based fixative for cell block (CHEST 2024; ICS/IAB 2023). Confirm them with your laboratory once, before your first case.',
      'Do not place all material into one fixative before considering the differential diagnosis. Formalin-fixed material cannot be assumed suitable for culture or every fresh-tissue assay.',
    ],
    checklist: [
      'Confirm station identity at handoff.',
      'Match medium and allocation to the requested study.',
      'Document additional tissue needs and pending tests.',
    ],
    worked: {
      context:
        'The differential includes lymphoma, but all acquired material is about to be placed in formalin.',
      reasoning:
        'Pause and contact the receiving laboratory before allocating the remaining material. Fresh material for flow cytometry may be required, and needle cytology may not fully resolve a new lymphoma diagnosis.',
    },
    question: q(
      'triage-predict',
      'Two stations were sampled for staging. Why should their material remain separately identified?',
      [
        'To preserve the anatomical distribution of any detected tumor',
        'Pooling erases which station supplied the finding.',
      ],
      [
        'Because each station always needs a different needle gauge',
        'Gauge selection and station labeling are different decisions.',
      ],
      [
        'Because separate labels increase the number of malignant cells',
        'Labels preserve identity, not cellular yield.',
      ],
    ),
    matching: matching(
      'Match each requested study with its planning requirement.',
      [
        ['Flow cytometry for suspected lymphoma', 'Fresh material in RPMI or saline'],
        ['Microbiologic culture', 'Separate material in a sterile container, no fixative'],
        ['Cytology and cell block', 'Smears, and a needle rinse in fixative'],
      ],
      'Decide the allocation from the differential before the first pass, so nothing that was needed fresh goes into fixative.',
    ),
    observation: q(
      'triage-observe',
      'Why were the handling plans matched to the studies?',
      [
        'Different analyses have different preservation requirements',
        'A single default container may not preserve every requested diagnostic option.',
      ],
      [
        'Different containers alone establish different diagnoses',
        'The material must still be examined.',
      ],
      [
        'The same medium is always interchangeable across laboratories',
        'Local processing and assay requirements need confirmation.',
      ],
    ),
    transfer: q(
      'triage-transfer',
      'Granulomas are found in a node, but infection remains plausible and no microbiology was sent. What should the result discussion acknowledge?',
      [
        'The finding must be reconciled with the differential and missing studies',
        'Granulomatous inflammation is not synonymous with sarcoidosis; exclusion of alternatives matters.',
      ],
      [
        'Granulomas establish sarcoidosis regardless of context',
        'The diagnosis requires compatible clinical findings and assessment for alternatives.',
      ],
      [
        'A new container label can recover a culture from already fixed tissue',
        'Relabeling does not reverse fixation or supply an unperformed test.',
      ],
    ),
    diagram: 'specimens',
    takeaways: [
      'Station identity must survive every handoff.',
      'Plan preservation around the differential diagnosis.',
    ],
    sources: ['chest2024', 'ics2023', 'ats2020'],
  },
]
