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
      [
        'Retraction keeps the aspirate from being lost in the channel',
        'The specimen stays in the needle lumen either way; the check is about an exposed tip cutting the channel or the airway.',
      ],
      [
        'Retraction releases the suction before the needle leaves the node',
        'Suction is released at the syringe before the needle leaves the node; retraction is checked so the tip is covered in the channel.',
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
        'Lengthen the needle stop so the stroke carries more momentum',
        'The stop limits travel to the far side of the node; lengthening it does not help entry and removes that safeguard.',
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
  /*
   * Needle technique within the node (2026-11-11), folded into the needle lesson by the owner's
   * decision. It teaches which choices are the operator's and what to change between passes.
   *
   * What is evidence and what is practice is kept apart in the text. The stylet and suction
   * statements are two randomized trials. Slow pull is one randomized trial and one retrospective
   * series, described as mixed. Taking the suction off after a bloody pass, and fanning, are the
   * owner's practice points (his decisions of 2026-11-11) and are labelled as practice points to
   * the learner. The fresh needle after a malignant node is AABIP 2025's own note under the
   * ninth-edition TNM changes; that guideline makes no recommendation on needle technique.
   */
  {
    id: 'needle-technique',
    title: 'Needle technique within the node',
    topic: 'Sample',
    minutes: 6,
    objective:
      'Choose what to change between passes: the stylet, suction, and how the needle moves within the node.',
    recall:
      'The needle is in the node with its tip in the imaging plane, and the stop is set to the far side of the node.',
    concept: 'Most of these choices are yours; know what each one changes',
    paragraphs: [
      'The stylet. Two randomized trials sampled the same nodes with and without the stylet and found no difference in specimen adequacy or diagnostic yield (Scholten 2017; Lin 2018). Using it is optional (ICS/IAB 2023).',
      'Suction. In the second of those trials suction did not change adequacy or yield either, but passes with suction more often returned a tissue core. Suction is a choice, not a requirement. Slow pull, in which the stylet is drawn back slowly as the needle moves and no syringe is attached, is an alternative: one randomized trial found no difference in on-site adequacy against suction and one retrospective series favoured it for tissue cores, so the evidence is mixed (Kassirian 2022; He 2020).',
      'A bloody pass. Practice point: when a pass made with suction returns mostly blood, take the suction off for the next pass.',
      'Fanning. Practice point: change the angle of the needle a little between movements, so that successive movements sample different parts of the node and not one track. The only EBUS study of fanning found for this course was a bench study on a model (Mizumori 2023).',
      'Between stations. Once a malignant node has been identified, a fresh needle may be used for the next station to reduce cross-contamination (AABIP 2025).',
    ],
    checklist: [
      'Decide on the stylet and suction before the pass.',
      'After a bloody pass, take the suction off.',
      'Change the needle angle between movements.',
    ],
    worked: {
      context: 'The first pass at a station was made with suction, and the smear is mostly blood.',
      reasoning:
        'Take the suction off for the next pass. In the randomized comparison, adequacy and diagnostic yield were the same with and without suction, so the next pass gives nothing up that the trial measured except the chance of a tissue core.',
    },
    question: q(
      'technique-predict',
      'A pass at this station was made with suction and returned mostly blood. What do you change for the next pass?',
      [
        'Take the suction off',
        'Practice point: after a bloody pass with suction, the next pass is made without it. In a randomized comparison, adequacy and diagnostic yield were the same with and without suction (Lin 2018).',
      ],
      [
        'Change to a larger needle',
        `A larger needle is not the response to a bloody pass. For suspected malignancy the 2024 CHEST guideline suggests a ${N('needle-gauge')} needle.`,
      ],
      [
        'Add the stylet to clear the needle',
        'Two randomized trials found no difference in adequacy or yield with the stylet, and it does not change what suction draws into the needle.',
      ],
    ),
    observation: q(
      'technique-observe',
      'Two randomized trials sampled the same nodes with and without the stylet. What did they find?',
      [
        'No difference in specimen adequacy or diagnostic yield',
        'Using the stylet is a choice. One of the trials also found the pass a little quicker without it.',
      ],
      [
        'More diagnostic samples with the stylet',
        'Neither trial found a difference in diagnostic yield.',
      ],
      [
        'More blood contamination without the stylet',
        'Neither trial reported a difference of that kind; adequacy and yield were the same.',
      ],
    ),
    transfer: q(
      'technique-transfer',
      'The pathologist asks for tissue cores from this station. Which choice does the randomized comparison support?',
      [
        'Make the passes with suction',
        'Passes with suction more often returned a tissue core, although adequacy and yield were unchanged (Lin 2018).',
      ],
      [
        'Use the stylet on every pass',
        'The stylet made no difference to adequacy or yield in either trial, and neither reported that it changed tissue cores.',
      ],
      [
        'Make fewer movements on each pass',
        'Nothing in these trials supports fewer movements; the lesson’s guidance on movements per pass stands.',
      ],
    ),
    matching: matching(
      'Match the situation with the change.',
      [
        ['The last pass, made with suction, was mostly blood', 'Take the suction off'],
        ['Tissue cores are wanted from this station', 'Make the passes with suction'],
        [
          'Every movement follows the same track through the node',
          'Change the needle angle between movements',
        ],
        [
          'A malignant node has just been sampled and another station is next',
          'Consider a fresh needle',
        ],
      ],
      'Suction raised tissue-core acquisition without changing adequacy or yield (Lin 2018). Taking the suction off after a bloody pass and fanning are practice points. A fresh needle after a malignant node is meant to reduce cross-contamination between stations (AABIP 2025).',
    ),
    takeaways: [
      'The stylet and suction are choices: neither changed adequacy or yield in randomized trials.',
      'After a bloody pass, take the suction off.',
      'Vary the needle angle within the node.',
    ],
    sources: [
      'scholten2017',
      'lin2018',
      'kassirian2022',
      'he2020',
      'mizumori2023',
      'ics2023',
      'chest2024',
      'aabip2025',
    ],
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
      `The same guideline suggests a ${N('needle-gauge')} needle for suspected malignancy. Needle choice does not make up for poor targeting or the wrong container. When molecular testing is planned, take additional passes for cell block. PD-L1 immunohistochemistry and next-generation sequencing often draw on that same cell block, although some laboratories run ancillary tests on smears or other preparations, and how material is processed and allocated follows the laboratory’s own protocol. Material that was enough for the diagnosis can run out before the last assay, so tell the laboratory which tests are needed before the case, not after the report.`,
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
      [
        'Whether the needle was actually within the node',
        'Malignant cells on site already show that lesional material was reached; what is open is whether there is enough for the assays.',
      ],
      [
        'Whether lymphocytes are present to confirm a nodal sample',
        'Lymphocytes matter for calling a negative sample representative; with tumor present, the open question is quantity for ancillary testing.',
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
        'Postpone until on-site cytology can attend',
        'ROSE is suggested where available, not required; EBUS-TBNA is performed without it, with a planned number of passes.',
      ],
      [
        'Take fewer passes, since adequacy cannot be checked',
        'Without on-site feedback the planned pass count and cell-block material matter more, not less.',
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
        'To give the laboratory more cells per block for biomarkers',
        'Separating material does not raise cellularity; it is done so a positive result can be assigned to its station.',
      ],
      [
        'To keep blood from one station from diluting the other',
        'Dilution is not the concern; a pooled positive cannot be assigned to a station, which is what staging needs.',
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
        'Formalin preserves everything, but separate tubes aid labeling',
        'Formalin fixes cells and kills organisms, so flow cytometry and culture are lost.',
      ],
      [
        'Saline keeps the material suitable for any later study',
        'Unfixed material degrades; cytology and cell block need prompt fixation, so one medium does not serve every study.',
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
        'Culture can still be requested on the fixed cell block',
        'Fixation kills organisms; stains or molecular tests may be possible on fixed material, but culture is not.',
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
