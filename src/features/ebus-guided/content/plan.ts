import type { Lesson } from './types'
import { EBUS_NUMBERS } from './teachingNumbers'
import { question as q, matching, sequence, withBareSteps } from './authoring'
export const planLessons: Lesson[] = [
  {
    id: 'node-characterization',
    title: 'Describe the node: the six sonographic features',
    topic: 'Plan',
    minutes: 12,
    objective:
      'Describe a node by its six standard sonographic features and state what they can and cannot establish.',
    recall: 'Gain, contrast, plane, and contact influence the displayed appearance.',
    concept: 'One standard description, six features',
    paragraphs: [
      'Describe every node the same way, using the classification Fujiwara and colleagues proposed in 2010 and the ICS/IAB 2023 recommendations use: size, shape, margin, echogenicity, central hilar structure (CHS) and coagulation necrosis sign (CNS). Optimize depth and gain first, then freeze on the node’s largest cross-section. The figure shows each feature on real EBUS images; hide the outlines to read the image unmarked.',
      `Size is the short axis, measured with calipers at right angles to the long axis; ${EBUS_NUMBERS.value('node-short-axis')} favors malignancy. Shape compares the two axes: round when the long axis is less than ${EBUS_NUMBERS.value('node-round-ratio')} times the short axis, oval when it is more. The margin is distinct when ${EBUS_NUMBERS.value('node-distinct-margin')} of the border is sharply seen. Echogenicity is homogeneous (fine, even echoes) or heterogeneous (mixed brighter and darker areas). A CHS is a linear, flat, hyperechoic band in the center of the node. A CNS is a hypoechoic area inside the node with no flow on Doppler; on grayscale alone it is only suspected.`,
      `In Fujiwara’s ${EBUS_NUMBERS.value('fujiwara-nodes')} nodes, round shape, distinct margin, heterogeneous echogenicity and CNS each independently predicted metastasis. When all four were absent, ${EBUS_NUMBERS.value('fujiwara-none-of-four')} of nodes were not metastatic; when at least one was present, ${EBUS_NUMBERS.value('fujiwara-any-of-four')} were metastatic. Across later studies, an absent CHS was the most sensitive single feature (${EBUS_NUMBERS.value('chs-absent-sensitivity')}) and CNS the most specific (${EBUS_NUMBERS.value('cns-specificity')}), followed by heterogeneous echogenicity (${EBUS_NUMBERS.value('heterogeneous-specificity')}).`,
      'These features rank suspicion; they do not replace tissue. ICS/IAB 2023 states that sonographic features do not preclude aspiration, and during systematic staging a small, oval, homogeneous node in a required station is still sampled. Granulomatous nodes, tuberculosis in particular, can be heterogeneous with a necrosis sign. Record the features you saw and leave the diagnosis to the specimen.',
    ],
    checklist: [
      'Optimize depth and gain, then freeze on the largest cross-section.',
      'Name all six features, including the reassuring ones.',
      'Confirm a suspected necrosis sign with Doppler.',
      'Record the description; leave the diagnosis to tissue.',
    ],
    worked: {
      context:
        'At station 7 you freeze on a node whose long axis is about the same length as its short axis, with a sharp border around most of its circumference.',
      reasoning: `Long ÷ short is below ${EBUS_NUMBERS.value('node-round-ratio')}, so the node is round, and the margin is distinct: two of the four features that independently predicted metastasis. That raises suspicion for this node. It does not change the staging order, and it is still a description until the aspirate is read.`,
    },
    question: q(
      'morphology-predict',
      'An oval node has homogeneous internal echoes. What can be concluded from this appearance alone?',
      [
        'It has the described morphology, with histology still undetermined',
        'Sonographic features do not provide a definitive benign or malignant diagnosis.',
      ],
      [
        'It is a reactive node that can be left unsampled during staging',
        'Benign-pattern features lower suspicion but do not exclude metastasis; in staging the node is still sampled when indicated.',
      ],
      [
        'It is low risk, so a negative PET would settle the question',
        'Neither bland morphology nor PET negativity excludes nodal metastasis when staging is indicated.',
      ],
    ),
    matching: matching(
      'Separate the observation from the information that still requires tissue.',
      [
        ['Rounded outline and heterogeneous internal echoes', 'Sonographic description'],
        [
          'Malignant cells in an appropriately labeled aspirate',
          'Pathologic evidence of tumor in the sampled site',
        ],
        [
          'Small homogeneous node during a staging examination',
          'Appearance that does not independently exclude metastasis',
        ],
      ],
      'Keep image description, pathology, and residual uncertainty distinct.',
    ),
    observation: q(
      'morphology-observe',
      'Which sentence belongs in an ultrasound description?',
      [
        'An oval node with homogeneous internal echoes was visualized',
        'This reports an observed feature without claiming histology.',
      ],
      [
        'A reactive-appearing oval node was visualized at station 7',
        '“Reactive” is an interpretation; the description records shape, margin and echotexture and leaves the diagnosis to tissue.',
      ],
      [
        'An oval node with no evidence of metastasis was visualized',
        'Absence of metastasis is a tissue conclusion; the image can only report what was seen.',
      ],
    ),
    transfer: q(
      'morphology-transfer',
      'A PET-negative node is visible during indicated systematic mediastinal staging. Should its bland appearance alone exclude it from the sampling plan?',
      [
        'No; apply the systematic staging plan and anatomical assessment',
        'Neither PET negativity nor bland ultrasound morphology alone settles station involvement.',
      ],
      [
        'Yes; PET-negative with benign sonographic features is sufficient',
        'Occult nodal disease occurs in PET-negative, normal-appearing nodes; that is why systematic staging samples them.',
      ],
      [
        'Yes, provided its short axis is under 10 mm',
        'The 10 mm CT threshold flags enlargement; it is not a cutoff for sampling during systematic staging.',
      ],
    ),
    station: '7',
    takeaways: [
      'Name all six features on a frozen, optimized image.',
      'Round shape, distinct margin, heterogeneous echoes and a confirmed necrosis sign raise suspicion; none of them is a diagnosis.',
      'Morphology does not replace an indicated tissue examination.',
    ],
    sources: ['fujiwara2010', 'ics2023', 'ers2026'],
    boundary:
      'Each image was chosen to show a feature. Pathology for these nodes is not part of the course, so none of them is a benign or malignant example.',
  },
  {
    id: 'systematic-staging',
    title: 'Systematic staging and TNM ninth edition',
    topic: 'Plan',
    minutes: 10,
    objective:
      'Plan an ordered nodal examination and distinguish single- from multiple-station N2 disease.',
    recall:
      'Station identity comes from anatomy; the primary tumor side determines whether many stations are ipsilateral or contralateral.',
    concept: 'Preserve the distribution of disease',
    paragraphs: [
      'When mediastinal tissue staging is indicated for suspected or proven NSCLC, the 2026 ERS/ESGE/ESTS guideline favors systematic staging over a targeted examination. Plan a survey of accessible relevant stations, including the core mediastinal stations 4R, 4L, and 7, and reconcile the examination with CT/PET findings and any inaccessible target.',
      'A usual staging sampling order is N3 → N2 → N1, with the primary tumor sampled later when appropriate. This reduces the risk of carrying tumor material from a lower-stage target into a higher-stage site. Define the categories relative to the primary side and keep specimens separate.',
      'In TNM ninth edition, N2a means involvement of a single ipsilateral mediastinal or subcarinal station; N2b means multiple such stations. Count involved stations, not individual nodes or needle passes. This distinction does not itself prescribe treatment.',
      /*
       * Restaging (owner decision of 2026-11-10 to add it). The figures are the pooled estimates in
       * Jiang 2020, read from the abstract and verified by the owner on 2026-11-10. The miss rate
       * (the complement of the sensitivity) is stated with its denominator, patients with
       * persistent nodal disease, at the owner's correction: it is not a negative predictive
       * value. Nothing here is a guideline recommendation.
       */
      `Restaging after induction therapy is the same examination with a lower yield: in pooled data EBUS-TBNA found ${EBUS_NUMBERS.value('restaging-sensitivity')} of persistent nodal disease, with a specificity of ${EBUS_NUMBERS.value('restaging-specificity')} (Jiang 2020). A positive restaging result stands. Sensitivity is counted among patients who still have nodal disease: about one in three of them is missed. It is not the share of negative results that are wrong, which depends on how often disease persists in the patients examined. Report a negative restaging as a negative sample, not as a cleared mediastinum, and agree with the team how it will be confirmed.`,
    ],
    checklist: [
      'State the primary side.',
      'Survey systematically and document unsampled targets.',
      'Sample higher-stage sites first and preserve station labels.',
    ],
    worked: {
      context: 'A right lung primary has accessible targets at 4L, 7, and 11R.',
      reasoning:
        'For this primary, 4L is N3, 7 is N2, and 11R is N1. After the survey and safety assessment, that is the preferred relative sampling order for these targets.',
    },
    question: q(
      'staging-predict',
      'For a left lung primary, which of these nodal targets has the highest N category if malignant?',
      ['4R', 'Contralateral mediastinal involvement is N3.'],
      ['11L', 'Ipsilateral interlobar involvement is N1.'],
      ['7', 'Subcarinal involvement is N2 for either primary side.'],
    ),
    sequence: withBareSteps(
      sequence(
        'For a left lung primary with targets at 4R, 7, and 11L, order their sampling from highest to lowest N category.',
        [
          'Sample the confirmed 4R target (N3)',
          'Sample the confirmed station 7 target (N2)',
          'Sample the confirmed 11L target (N1)',
        ],
        'For this primary side, 4R → 7 → 11L follows N3 → N2 → N1. Each target still requires an acceptable path.',
      ),
      / \(N[123]\)$/,
      {
        hide: 'Try it yourself: hide the N categories',
        show: 'Show the N categories again',
        note: 'Each step names its N category as worked help. Hiding the categories is your choice; the order that is checked is the same, and Show the sequence and the explanation stay available.',
      },
    ),
    observation: q(
      'staging-observe',
      'Why was the contralateral mediastinal target sampled before the ipsilateral interlobar target?',
      [
        'To reduce contamination that could falsely imply a higher N category',
        'The sequence protects the interpretation of separately labeled samples.',
      ],
      [
        'Because a smaller N number is always sampled last regardless of the primary side',
        'Categories must first be assigned correctly for the actual primary side.',
      ],
      [
        'Because the scope meets the paratracheal stations first on the way in',
        'Order follows N category for the primary side, not the order in which the scope passes the stations.',
      ],
    ),
    transfer: q(
      'staging-transfer',
      'In a right lung cancer, malignancy is confirmed in two nodes within 4R and nowhere else after staging. Which ninth-edition N2 subdivision fits the known distribution?',
      [
        'N2a',
        'Both nodes are in one ipsilateral mediastinal station. N2b requires more than one N2 station.',
      ],
      [
        'N2b because two individual nodes are positive',
        'The subdivision counts stations rather than nodes.',
      ],
      [
        'N1 because both nodes lie on the side of the primary',
        'Ipsilateral mediastinal involvement is N2; N1 is ipsilateral hilar, interlobar and intrapulmonary.',
      ],
    ),
    diagram: 'station-map-n',
    takeaways: [
      'Survey and specimen order serve different purposes.',
      'N2a versus N2b counts involved stations.',
    ],
    sources: ['ers2026', 'iaslc9', 'ics2023', 'aabip2025', 'jiang2020'],
  },
  {
    id: 'eus-b',
    title: 'Where EUS-B complements EBUS',
    topic: 'Plan',
    minutes: 7,
    objective:
      'Identify a target for which an esophageal approach may complement the airway examination.',
    recall:
      'The airway route provides useful access to paratracheal, subcarinal, hilar, and interlobar stations.',
    concept: 'A complementary view from the esophagus',
    paragraphs: [
      'EUS-B-FNA uses an EBUS bronchoscope through the esophagus. It can complement airway EBUS, particularly for 4L, 7, and lower mediastinal stations 8 and 9, depending on anatomy and operator expertise. It may also allow selected subdiaphragmatic targets to be assessed.',
      'The 2026 ERS/ESGE/ESTS guideline suggests combined EBUS plus EUS or EUS-B when feasible for mediastinal staging. The esophageal route does not replace the airway examination of hilar or interlobar nodes.',
      'Stations 5 and 6 are not routine targets for standard EBUS-TBNA or EUS-B-FNA. Do not convert difficult access into an unsupervised transvascular puncture. Discuss an alternative diagnostic route when a clinically important target cannot be safely reached.',
    ],
    checklist: [
      'Identify what the airway examination cannot assess.',
      'Match the target to a feasible complementary route.',
      'Arrange training, consent, and equipment for that route.',
    ],
    worked: {
      context: 'A paraesophageal target in station 8 remains unassessed after airway EBUS.',
      reasoning:
        'An esophageal examination may provide access to a target outside the usual airway EBUS field. The team should plan this complementary procedure and confirm its feasibility.',
    },
    question: q(
      'eus-predict',
      'Which target most clearly illustrates added lower-mediastinal access from an esophageal approach?',
      [
        'A station 8 paraesophageal node',
        'Station 8 is a characteristic complementary target for EUS or EUS-B.',
      ],
      [
        'An 11Rs node between the right upper-lobe bronchus and bronchus intermedius',
        'The airway route is suited to this interlobar location.',
      ],
      [
        'A small 10R hilar node',
        'EUS-B is not a substitute for routine right hilar airway access.',
      ],
    ),
    matching: matching(
      'Match the access problem to the appropriate planning principle.',
      [
        [
          'Lower paraesophageal target not reached from the airway',
          'Consider a complementary EUS or EUS-B examination',
        ],
        ['Right interlobar target', 'Use the airway anatomy to plan EBUS access'],
        [
          'A target requiring traversal of a major vessel',
          'Seek expert alternative-route planning rather than routine puncture',
        ],
      ],
      'Reach and safety depend on both the compartment and the available route.',
    ),
    observation: q(
      'eus-observe',
      'Why is combined endosonography described as complementary?',
      [
        'The routes provide complementary anatomical access',
        'An esophageal route may add targets or alternative windows to an airway examination.',
      ],
      [
        'Together the two routes reach every mediastinal station',
        'Stations 5 and 6 remain outside the routine reach of either route.',
      ],
      [
        'The esophageal route repeats the airway stations as a second check',
        'The gain is mainly in stations the airway reaches poorly or not at all, such as 8 and 9, not in resampling.',
      ],
    ),
    transfer: q(
      'eus-transfer',
      'A 4L target remains difficult to assess because an airway window is unstable. What is a reasonable next discussion?',
      [
        'Whether an esophageal window or another approach can safely answer the question',
        'The same station may be approachable from a complementary route, subject to expertise and anatomy.',
      ],
      [
        'Whether to sample on the brief views the window does give',
        'Intermittent visualization is not live guidance; beside the arch and pulmonary artery the needle needs a stable window.',
      ],
      [
        'Whether the station can be reported negative because access was difficult',
        'An unassessed target is not a negative tissue result.',
      ],
    ),
    diagram: 'station-map-access',
    takeaways: [
      'EUS-B can add access, especially to the lower mediastinum.',
      'A difficult window requires a plan, not a presumed negative result.',
    ],
    sources: ['ers2026', 'ics2023'],
  },
]
