import type { Lesson } from './types'
import { question as q, matching, sequence, withBareSteps } from './authoring'
export const planLessons: Lesson[] = [
  {
    id: 'node-characterization',
    title: 'Describe the node without diagnosing the image',
    topic: 'Plan',
    minutes: 6,
    objective: 'Distinguish features that inform suspicion from findings that establish pathology.',
    recall: 'Gain, contrast, plane, and contact influence the displayed appearance.',
    concept: 'Morphology supports a sampling decision',
    paragraphs: [
      'Describe the node systematically: station, size and measurement plane, shape, borders, internal echogenicity, visible central hilar structure, and vascular relationships. Heterogeneity or necrotic-appearing areas may influence target selection, but no single feature establishes malignancy.',
      'A small or bland-appearing node can contain tumor. Conversely, inflammatory nodes may be enlarged and suspicious. Do not use a reassuring appearance to omit indicated systematic staging.',
      'When sampling is indicated, select an accessible target and a safe path. Avoid equating a low-echo center with either proven necrosis or an avascular space.',
    ],
    checklist: [
      'Optimize before describing morphology.',
      'Separate observed features from their interpretation.',
      'Link sampling to the clinical question.',
    ],
    worked: {
      context:
        'An oval, homogeneous node appears less suspicious than a round heterogeneous node elsewhere.',
      reasoning:
        'The comparison may guide suspicion and targeting. It does not make the first node proven benign or the second proven malignant.',
    },
    question: q(
      'morphology-predict',
      'An oval node has homogeneous internal echoes. What can be concluded from this appearance alone?',
      [
        'It has the described morphology, with histology still undetermined',
        'Sonographic features do not provide a definitive benign or malignant diagnosis.',
      ],
      [
        'It is proven benign and needs no further consideration',
        'Appearance alone cannot exclude malignancy when sampling is indicated.',
      ],
      [
        'It must be malignant because it is visible on EBUS',
        'Visibility is not a pathological criterion.',
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
        'The node is definitively benign because it is oval',
        'The conclusion exceeds the image evidence.',
      ],
      [
        'Molecular testing is adequate because the border is smooth',
        'Molecular adequacy depends on the specimen and assay.',
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
        'Yes; the ultrasound appearance is equivalent to benign cytology',
        'Image appearance and tissue assessment are different evidence.',
      ],
      [
        'Yes; only the largest node can contain metastasis',
        'Metastasis is not confined to the largest node.',
      ],
    ),
    station: '7',
    takeaways: [
      'Describe what is seen before inferring what it means.',
      'Morphology does not replace an indicated tissue examination.',
    ],
    sources: ['ics2023', 'ers2026'],
    boundary:
      'The reference image has no linked pathology result in this course. It must not be used as a labeled benign or malignant training example.',
  },
  {
    id: 'systematic-staging',
    title: 'Systematic staging and TNM ninth edition',
    topic: 'Plan',
    minutes: 9,
    objective:
      'Plan an ordered nodal examination and distinguish single- from multiple-station N2 disease.',
    recall:
      'Station identity comes from anatomy; the primary tumor side determines whether many stations are ipsilateral or contralateral.',
    concept: 'Preserve the distribution of disease',
    paragraphs: [
      'When mediastinal tissue staging is indicated for suspected or proven NSCLC, the 2026 ERS/ESGE/ESTS guideline favors systematic staging over a targeted examination. Plan a survey of accessible relevant stations, including the core mediastinal stations 4R, 4L, and 7, and reconcile the examination with CT/PET findings and any inaccessible target.',
      'A usual staging sampling order is N3 → N2 → N1, with the primary tumor sampled later when appropriate. This reduces the risk of carrying tumor material from a lower-stage target into a higher-stage site. Define the categories relative to the primary side and keep specimens separate.',
      'In TNM ninth edition, N2a means involvement of a single ipsilateral mediastinal or subcarinal station; N2b means multiple such stations. Count involved stations, not individual nodes or needle passes. This distinction does not itself prescribe treatment.',
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
        'Because the first target always provides the largest specimen',
        'The order is not a specimen-volume prediction.',
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
      ['N3 because multiple passes were required', 'Pass count does not determine N category.'],
    ),
    diagram: 'stations',
    takeaways: [
      'Survey and specimen order serve different purposes.',
      'N2a versus N2b counts involved stations.',
    ],
    sources: ['ers2026', 'iaslc9', 'ics2023'],
    boundary:
      'The vignettes assume the stated primary side and complete station information. Full TNM grouping, resectability, and treatment require additional clinical data and multidisciplinary review.',
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
        'Both routes reach every mediastinal target routinely',
        'Important access limitations remain.',
      ],
      [
        'EUS-B eliminates the need for anatomical training',
        'The different route requires its own supervised skills and landmarks.',
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
        'Whether stronger pressure can replace a stable window',
        'Forcing the scope is not a substitute for safe access.',
      ],
      [
        'Whether the station can be reported negative because access was difficult',
        'An unassessed target is not a negative tissue result.',
      ],
    ),
    diagram: 'stations',
    takeaways: [
      'EUS-B can add access, especially to the lower mediastinum.',
      'A difficult window requires a plan, not a presumed negative result.',
    ],
    sources: ['ers2026', 'ics2023'],
    boundary:
      'This is an introduction to route selection. The course does not simulate esophageal insertion, adrenal assessment, or EUS-B needle technique.',
  },
]
