import type { TrainingModule } from '@/lib/types'

export const trainingModules: TrainingModule[] = [
  {
    slug: 'rigid-bronchoscopy-foundations',
    title: 'Rigid Bronchoscopy Foundations',
    category: 'rigid-bronchoscopy',
    difficulty: 'beginner',
    durationMinutes: 120,
    summary:
      'A blended curriculum introducing rigid bronchoscopy instrumentation, core maneuvers, and team communication using simulation-forward practice.',
    objectives: [
      'Describe indications, contraindications, and perioperative considerations for rigid bronchoscopy',
      'Assemble, troubleshoot, and sterilize the rigid bronchoscope and ancillary equipment',
      'Execute essential scope maneuvers while maintaining ventilation and airway control',
    ],
    prerequisites: ['Airway anatomy refresher module', 'Credentialed moderate sedation training'],
    equipment: ['Rigid bronchoscope set', 'Simulation airway mannequin', 'High-flow oxygen source'],
    tags: ['simulation', 'airway', 'fundamentals'],
    outcomes: [
      'Learner demonstrates safe insertion and removal technique with coordinated assistant communication',
      'Learner completes post-case debrief using the standardized team checklist',
    ],
    checklistDownloadUrl: '/downloads/rigid-bronch-checklist.pdf',
    checklistDownloadLabel: 'Download checklist (PDF)',
    sections: [
      {
        title: 'Introductory Brief & Anatomy Review',
        format: 'theory',
        description:
          'Facilitated slide deck reviewing equipment setup, topographical airway anatomy, and shared mental models for the procedure.',
        durationMinutes: 30,
        resources: [
          { label: 'Equipment checklist', href: '/downloads/rigid-bronch-checklist.pdf' },
        ],
      },
      {
        title: 'Simulation Lab: Scope Handling',
        format: 'hands-on',
        description:
          'Small group mannequin lab focused on insertion, rotation, ventilation strategies, and safe instrument exchange.',
        durationMinutes: 60,
        checklistItems: [
          'Performs pre-oxygenation and verifies monitoring before scope insertion',
          'Demonstrates jaw thrust and scope advancement techniques',
          'Coordinates with assistant to maintain visualization and ventilation',
        ],
      },
      {
        title: 'Video Review & Troubleshooting',
        format: 'video',
        description:
          'Faculty-led review of benchmark cases highlighting instrument positioning, suction techniques, and communication cues.',
        durationMinutes: 20,
        videoUrl: 'https://www.youtube.com/embed/ExampleRigidBronch',
      },
      {
        title: 'Assessment & Reflection',
        format: 'assessment',
        description:
          'Competency checklist followed by written reflection and faculty feedback summary.',
        durationMinutes: 10,
      },
    ],
    quiz: {
      title: 'Rigid Bronchoscopy Readiness Check',
      questions: [
        {
          prompt: 'Which manoeuvre best maintains ventilation while advancing the rigid scope?',
          options: [
            'Head tilt with jaw thrust',
            'Apnoeic ventilation with high FiO₂',
            'Assistant-controlled mask seal without jaw support',
            'Applying suction continuously',
          ],
          answerIndex: 0,
          explanation:
            'Maintaining a jaw thrust preserves airway patency, allowing the assistant to support ventilation during advancement.',
        },
        {
          prompt:
            'What is the recommended first step when encountering mild bleeding during rigid bronchoscopy?',
          options: [
            'Abort the procedure immediately',
            'Switch to jet ventilation',
            'Instill topical vasoconstrictor and apply suction',
            'Increase inspiratory pressures on the ventilator',
          ],
          answerIndex: 2,
          explanation:
            'Topical vasoconstrictor with targeted suction addresses bleeding while maintaining visualization and airway control.',
        },
      ],
    },
  },
  {
    slug: 'ebus-station-mapping',
    title: 'EBUS Station Mapping Lab',
    category: 'ebus',
    difficulty: 'intermediate',
    durationMinutes: 150,
    summary:
      'Hands-on endobronchial ultrasound workshop emphasizing mediastinal station recognition, biopsy targeting, and complication mitigation.',
    objectives: [
      'Map mediastinal and hilar lymph node stations using standardized IASLC nomenclature',
      'Optimize scope positioning and Doppler use for safe transbronchial needle aspiration',
      'Develop contingency plans for bleeding or airway compromise during sampling',
    ],
    prerequisites: ['Rigid Bronchoscopy Foundations', 'Basic ultrasound physics module'],
    equipment: ['EBUS scope', 'Ultrasound processor', 'Gel thorax model', 'Needle biopsy trainers'],
    tags: ['ebus', 'lymph nodes', 'biopsy'],
    outcomes: [
      'Learner accurately labels lymph node stations on provided imaging sets',
      'Learner completes three simulated biopsies with minimal scope repositioning time',
    ],
    sections: [
      {
        title: 'Station Orientation',
        format: 'theory',
        description:
          'Interactive lecture using 3D anatomy assets and cross-sectional imaging to reinforce station relationships.',
        durationMinutes: 35,
        resources: [{ label: 'Station map handout', href: '/downloads/ebus-stations.pdf' }],
      },
      {
        title: 'Guided Scope Navigation',
        format: 'hands-on',
        description:
          'Faculty demonstrate approaches to stations 2R, 4R, 7, and 11L with emphasis on ergonomics and image optimization.',
        durationMinutes: 45,
        checklistItems: [
          'Maintains scope orientation in relation to carinal landmarks',
          'Adjusts Doppler gain appropriately before needle deployment',
        ],
      },
      {
        title: 'Needle Technique Lab',
        format: 'simulation',
        description:
          'Learners rotate through biopsy pods receiving feedback on needle angulation, suction technique, and sample handling.',
        durationMinutes: 50,
        resources: [
          { label: 'Needle troubleshooting guide', href: '/downloads/ebus-needle-guide.pdf' },
        ],
        videoUrl: 'https://www.youtube.com/embed/ExampleEBUSLab',
      },
      {
        title: 'Complication Scenarios & Debrief',
        format: 'assessment',
        description:
          'Team-based discussion of bleeding management, sample adequacy, and post-procedure care aligned to QA metrics.',
        durationMinutes: 20,
      },
    ],
    quiz: {
      title: 'EBUS Stations Knowledge Check',
      questions: [
        {
          prompt: 'Station 11L is best accessed from which bronchial segment during EBUS?',
          options: [
            'Left upper lobe bronchus',
            'Left lower lobe bronchus',
            'Interlobar region between lobes',
            'Distal trachea',
          ],
          answerIndex: 2,
          explanation:
            'Station 11 nodes are approached from the interlobar region between the upper and lower lobe bronchi.',
        },
        {
          prompt:
            'Which Doppler setting adjustment most improves differentiation of vascular structures adjacent to a lymph node?',
          options: [
            'Increase pulse repetition frequency',
            'Decrease probe frequency',
            'Increase color gain until noise appears',
            'Disable Doppler entirely',
          ],
          answerIndex: 1,
          explanation:
            'Lower probe frequency improves penetration and better differentiates vascular structures without introducing noise.',
        },
      ],
    },
  },
  {
    slug: 'navigation-strategy-workshop',
    title: 'Navigation Strategy Workshop',
    category: 'navigation',
    difficulty: 'advanced',
    durationMinutes: 180,
    summary:
      'Advanced course comparing electromagnetic, robotic, and cone-beam navigation workflows with live planning exercises and QA analytics.',
    objectives: [
      'Select optimal navigation modality based on lesion characteristics and patient comorbidities',
      'Build multimodality navigation plans incorporating CT-to-body divergence mitigation',
      'Audit navigation metrics and convert insights into quality improvement actions',
    ],
    prerequisites: ['EBUS Station Mapping Lab', 'Intermediate CT interpretation skills'],
    equipment: [
      'Navigation workstations',
      'CBCT simulator',
      '3D anatomy datasets',
      'QA dashboard access',
    ],
    tags: ['navigation', 'robotics', 'analytics'],
    outcomes: [
      'Learner produces annotated navigation plans with lesion-to-path distance under 2 cm',
      'Learner completes QA report summarizing diagnostic yield and complication mitigations',
    ],
    sections: [
      {
        title: 'Modality Deep Dive',
        format: 'theory',
        description:
          'Compare electromagnetic, robotic, and cone-beam assisted workflows with decision frameworks for modality selection.',
        durationMinutes: 40,
        resources: [
          { label: 'Modality selection matrix', href: '/downloads/navigation-modality-matrix.pdf' },
        ],
      },
      {
        title: 'Planning Sprint',
        format: 'simulation',
        description:
          'Teams build navigation plans on anonymized cases focusing on divergence mitigation and airway selection heuristics.',
        durationMinutes: 75,
        checklistItems: [
          'Generates pathway with <30° branch angles',
          'Identifies backup targets for unexpected anatomy or atelectasis',
        ],
      },
      {
        title: 'In-procedure Decision Points',
        format: 'video',
        description:
          'Review instrumented cases highlighting target confirmation, tool deployment, and complication response algorithms.',
        durationMinutes: 35,
        videoUrl: 'https://www.youtube.com/embed/ExampleNavigationCase',
      },
      {
        title: 'Quality Metrics Review',
        format: 'assessment',
        description:
          'Populate QA dashboard template and discuss improvement strategies with faculty facilitators.',
        durationMinutes: 30,
      },
    ],
    quiz: {
      title: 'Navigation Workflow Quiz',
      questions: [
        {
          prompt: 'Which strategy best reduces CT-to-body divergence in robotic navigation?',
          options: [
            'Higher insufflation pressures',
            'Intra-procedural cone-beam CT verification',
            'Skipping registration to save time',
            'Using a rigid bronchoscope for the entire case',
          ],
          answerIndex: 1,
          explanation:
            'Cone-beam CT verification provides real-time confirmation of lesion position and pathway alignment, reducing divergence.',
        },
        {
          prompt:
            'Which metric most reliably predicts navigation success in small peripheral lesions?',
          options: [
            'Total anesthesia time',
            'Distance from the lesion to the planned pathway',
            'Number of team members in the room',
            'Order of instrument deployment',
          ],
          answerIndex: 1,
          explanation:
            'Shorter lesion-to-path distance correlates with higher diagnostic yield and is a core QA metric in navigation programs.',
        },
      ],
    },
  },
  {
    slug: 'stent-management-bootcamp',
    title: 'Airway Stent Management Bootcamp',
    category: 'stents',
    difficulty: 'intermediate',
    durationMinutes: 140,
    summary:
      'Hands-on bootcamp that complements the Airway Stent Mechanics & Failure Explorer with measurement, deployment simulation, troubleshooting, and team debrief.',
    objectives: [
      'Translate a defined indication, mechanical job, anatomy, and exit strategy into an architecture and fit plan',
      'Deploy stents using rigid and flexible techniques with ventilation strategies to maintain oxygenation',
      'Develop context-specific surveillance and complication-response plans that address underlying drivers',
    ],
    prerequisites: ['Rigid Bronchoscopy Foundations'],
    equipment: ['Rigid and flexible scopes', 'Stent demo kits', '3D printed airway models'],
    tags: ['stents', 'airway', 'multidisciplinary'],
    outcomes: [
      'Learner documents a stent plan with indications, backup strategies, and follow-up schedule',
      'Learner demonstrates extraction of a malpositioned stent on simulator with minimal airway trauma',
    ],
    sections: [
      {
        title: 'Sizing Workshop',
        format: 'hands-on',
        description:
          'Use calipers and digital imaging to size stents on printed airway models and review sizing pitfalls.',
        durationMinutes: 45,
        resources: [
          { label: 'Optional mechanics & failure explorer', href: '/airway-stent-mechanics' },
          { label: 'Sizing worksheet', href: '/downloads/stent-sizing-sheet.pdf' },
        ],
      },
      {
        title: 'Deployment Lab',
        format: 'simulation',
        description:
          'Practice silicone and metallic stent placement with real-time coaching and focus on maintaining ventilation strategies.',
        durationMinutes: 60,
        checklistItems: [
          'Confirms airway measurement before deployment',
          'Maintains ventilation strategy during placement',
          'Verifies stent position with flexible bronchoscopy',
        ],
        videoUrl: 'https://www.youtube.com/embed/ExampleStentDeployment',
      },
      {
        title: 'Complication Roundtable',
        format: 'theory',
        description:
          'Case-based discussion on granulation tissue management, migration prevention, and mucus plugging.',
        durationMinutes: 25,
      },
      {
        title: 'Assessment & Action Plan',
        format: 'assessment',
        description:
          'Learners submit a stent follow-up protocol with key quality metrics for their institution.',
        durationMinutes: 10,
      },
    ],
    quiz: {
      title: 'Stent Management Quiz',
      questions: [
        {
          prompt:
            'A patient has focal tissue, purulent secretions, and recurrent obstruction near a stent end. Which response plan is most complete?',
          options: [
            'Treat the visible tissue and end the evaluation',
            'Restore patency, evaluate infection and secretions, and reassess fit, position, architecture, ongoing indication, and follow-up',
            'Assume the finding is caused by one force variable',
            'Wait for structural failure before reassessing the device',
          ],
          answerIndex: 1,
          explanation:
            'Granulation and recurrent obstruction can be multifactorial. The response must restore patency while addressing infectious, secretory, mechanical, disease-related, and time-dependent contributors.',
        },
        {
          prompt:
            'Which statement best describes a defensible surveillance prescription after airway stenting?',
          options: [
            'Use one interval for every benign and malignant indication',
            'Wait for severe symptoms before defining follow-up',
            'Link follow-up to the indication, expected failure modes, recognition triggers, evidence context, and an exchange or removal plan',
            'Base the schedule only on the stent material label',
          ],
          answerIndex: 2,
          explanation:
            'Surveillance and exit planning are part of the initial prescription. Timing remains dependent on the indication, patient, airway, device, disease course, and applicable evidence.',
        },
      ],
    },
  },
]

export const trainingModuleSlugs = trainingModules.map((module) => module.slug)
