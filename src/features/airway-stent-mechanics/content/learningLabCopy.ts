import type {
  AssessmentItem,
  ForceLabMission,
  ForceTaxonomyItem,
  GinaDumonBenchDatum,
  GuidedForceScene,
  LearningCard,
  ObstructionMorphology,
  StentModuleCopy,
  TissueMechanism,
} from '../engine/learningLabTypes'

export const obstructionMorphologies: readonly ObstructionMorphology[] = [
  {
    id: 'intrinsic',
    label: 'Intrinsic',
    visualCue: 'Material occupies the lumen from inside the airway.',
    mechanicalProblem: 'The obstruction itself consumes cross-sectional area.',
    decisionQuestion:
      'Can the intraluminal burden be treated without leaving a wall that needs ongoing scaffolding?',
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
  },
  {
    id: 'extrinsic',
    label: 'Extrinsic',
    visualCue: 'The airway is indented or flattened by pressure outside the lumen.',
    mechanicalProblem: 'The wall cannot hold its desired shape against an external load.',
    decisionQuestion: 'What support and landing zones are needed to maintain useful patency?',
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
  },
  {
    id: 'mixed',
    label: 'Mixed',
    visualCue: 'Intraluminal burden and external compression coexist.',
    mechanicalProblem: 'Restoring lumen and supporting the residual wall are separate jobs.',
    decisionQuestion: 'After the intrinsic component is addressed, what instability remains?',
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
  },
  {
    id: 'dynamic',
    label: 'Dynamic',
    visualCue: 'Caliber changes substantially during the respiratory cycle or cough.',
    mechanicalProblem: 'The desired support must coexist with repeated shape change and motion.',
    decisionQuestion:
      'Will a temporary trial answer a defined question, and does the expected benefit justify stent burden?',
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-benign-stenting-2025'],
  },
]

export const tissueMechanisms: readonly TissueMechanism[] = [
  {
    id: 'pressure',
    label: 'Static pressure',
    mechanism: 'Normal load distributed over a small contact area raises local interface pressure.',
    consequence:
      'Focal ischemic injury, ulceration, or erosion may occur at concentrated contacts.',
    inspectionQuestion:
      'Where does the architecture actually touch, and how broad is that contact?',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'edge',
    label: 'Edge and end loading',
    mechanism:
      'A stiffness transition, straightening tendency, or imperfect landing zone shifts load toward an end.',
    consequence: 'Granulation or focal injury can develop beyond an otherwise patent midsection.',
    inspectionQuestion: 'What happens at both ends when the centerline bends or the airway tapers?',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'chest-cao-guideline-2024'],
  },
  {
    id: 'shear',
    label: 'Cyclic shear',
    mechanism:
      'Breathing, cough, swallowing, and airway motion can produce repeated relative movement at the interface.',
    consequence: 'Persistent inflammation, granulation, or cover wear may develop over time.',
    inspectionQuestion: 'Does the device move with the wall, rub against it, or gap and recontact?',
    evidenceRefs: ['chung-airway-fracture-2008', 'pelton-nitinol-fatigue-2008'],
  },
  {
    id: 'ingrowth',
    label: 'Tissue ingrowth',
    mechanism: 'Open cells permit tissue incorporation through or around the scaffold.',
    consequence: 'Fixation may increase while restenosis and removal difficulty also increase.',
    inspectionQuestion: 'Which surfaces are covered, and which cells remain exposed?',
    evidenceRefs: ['wabip-benign-stenting-2025', 'fda-ultraflex-k230269', 'fda-bonastent-k140472'],
  },
  {
    id: 'mucus',
    label: 'Mucus and biofilm',
    mechanism:
      'A solid or covered surface interrupts mucociliary transport, while gaps and junctions create stagnant pockets.',
    consequence:
      'Secretion retention, plugging, and infection can become the dominant long-term burden.',
    inspectionQuestion: 'Where will secretions travel, pool, and be cleared?',
    evidenceRefs: [
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
    ],
  },
  {
    id: 'fatigue',
    label: 'Scaffold and cover fatigue',
    mechanism:
      'Repeated radial, bending, torsional, and axial deformation can focus cyclic strain at wires, connectors, junctions, or cover folds.',
    consequence:
      'Wire fracture, tear, delamination, or loss of support can emerge after a static test looked acceptable.',
    inspectionQuestion:
      'Where is strain repeated, and does the test reproduce that combined loading?',
    evidenceRefs: ['chung-airway-fracture-2008', 'pelton-nitinol-fatigue-2008'],
  },
]

export const forceTaxonomy: readonly ForceTaxonomyItem[] = [
  {
    id: 'cof',
    term: 'Chronic outward force (COF)',
    definition: 'Outward support read on an unloading or expansion path at a stated constraint.',
    interpretationLimit:
      'COF is method-dependent and is not interchangeable with the force required to compress a device.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'rrf',
    term: 'Radial resistive force (RRF)',
    definition: 'Resistance recorded while a device is being compressed on the loading path.',
    interpretationLimit:
      'The fixture may also induce ovalization, local bending, or buckling, so the value must travel with its method.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'radial-stiffness',
    term: 'Radial stiffness',
    definition: 'The slope of force change across a specified diameter interval.',
    interpretationLimit:
      'A single peak cannot show how quickly load changes near the actual constrained diameter.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'contact-pressure',
    term: 'Apparent contact pressure',
    definition: 'Contact load divided by an assumed or measured effective contact area.',
    interpretationLimit:
      'An average can hide much larger local peaks at a wire, stud, flare, connector, or device end.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'hysteresis',
    term: 'Hysteresis',
    definition: 'Separation between loading and unloading responses at the same diameter.',
    interpretationLimit:
      'The loop reflects material behavior, crossing friction, fixture effects, and test history—not one clinical outcome.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'mckenna-covered-braid-2021'],
  },
]

export const ginaDumonBenchData: readonly GinaDumonBenchDatum[] = [
  {
    id: 'migration',
    metric: 'Anti-migration force',
    dumon: '12.83 ± 0.23 N',
    gina: '15.21 ± 0.59 N forward; 18.40 ± 0.51 N backward',
    method: 'Five-centimeter push through a 16-mm-inner-diameter Teflon jig',
    evidenceRefs: ['jung-gina-2021'],
  },
  {
    id: 'compression',
    metric: 'Expansion/compression force',
    dumon: '14.54 ± 0.27 N',
    gina: '11.91 ± 0.21 N',
    method: 'Flat-plate compression to 50% diameter reduction',
    evidenceRefs: ['jung-gina-2021'],
  },
  {
    id: 'flexibility',
    metric: 'Flexibility force',
    dumon: '4.47 ± 0.10 N',
    gina: '3.13 ± 0.06 N',
    method: 'Four-centimeter span with deflection to half the diameter',
    evidenceRefs: ['jung-gina-2021'],
  },
]

export const decisionCards: readonly LearningCard[] = [
  {
    id: 'define-job',
    title: 'Define the mechanical job',
    body: 'State whether the goal is to oppose external compression, stabilize a residual wall, bridge a dynamic segment, seal a defect, or anchor at a bifurcation.',
    takeaway: 'A device name is not a treatment goal.',
    evidenceRefs: ['chest-cao-guideline-2024'],
  },
  {
    id: 'fit-not-force',
    title: 'Solve fit before chasing force',
    body: 'Inspect diameter, length, taper, curvature, branch geometry, landing zones, and the consequences of mismatch.',
    takeaway: 'More imposed contact is not automatically better support.',
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'removal-horizon',
    title: 'Name the removal horizon',
    body: 'Expected reversibility and the need for later removal change the importance of coverage, incorporation, and architecture.',
    takeaway: 'Future removal is a present-tense design constraint.',
    evidenceRefs: ['wabip-benign-stenting-2025'],
  },
  {
    id: 'interface-burden',
    title: 'Predict the interface burden',
    body: 'Trace where pressure, edge loading, shear, mucus, ingrowth, and cyclic strain will accumulate.',
    takeaway: 'Patency and tissue tolerance must be evaluated together.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'chest-cao-guideline-2024'],
  },
  {
    id: 'surveillance-response',
    title: 'Plan how failure will be recognized',
    body: 'Define what symptoms, imaging, airway-clearance changes, or bronchoscopic findings would trigger reassessment.',
    takeaway: 'A stent decision includes a surveillance and troubleshooting plan.',
    evidenceRefs: [
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
    ],
  },
]

export const guidedForceScenes: readonly GuidedForceScene[] = [
  {
    id: 'guided-radial-compression',
    title: 'Watch crossings accommodate radial compression',
    shortLabel: 'Radial compression',
    prompt:
      'Observe the free-crossing braid under uniform inward displacement. What changes besides the displayed lumen?',
    mode: 'radial',
    teachingCue:
      'Follow a crossing rather than one surface point: the helices reconfigure as diameter and length change together. This is a visual geometry response, not a force measurement.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015', 'mckenna-covered-braid-2021'],
  },
  {
    id: 'guided-focal-ovalization',
    title: 'See an eccentric load distort the lumen',
    shortLabel: 'Focal ovalization',
    prompt:
      'Compare the compressed and uncompressed sides of the free-crossing braid. Where does circular symmetry disappear?',
    mode: 'ovalization',
    teachingCue:
      'One-sided displacement flattens the displayed cross-section and redistributes contact. An average diameter can miss this focal deformation, and the schematic does not calculate tissue pressure.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'guided-breathing-motion',
    title: 'Track repeated shape change through breathing',
    shortLabel: 'Breathing motion',
    prompt:
      'Step through the representative breathing pose. Which parts of the free-crossing braid must repeatedly reconfigure?',
    mode: 'breathing',
    teachingCue:
      'Repeated diameter and axial motion changes crossing geometry over time. The scene makes cyclic deformation visible without assigning durability, force, or clinical-performance rankings.',
    evidenceRefs: ['chung-airway-fracture-2008', 'pelton-nitinol-fatigue-2008'],
  },
]

export const forceLabMissions: readonly ForceLabMission[] = [
  {
    id: 'mission-curved-airway',
    title: 'Defend a curved-airway observation',
    stem: 'A scaffold preserves its lumen in a straight view but will sit along a curved airway.',
    task: 'Choose the load mode that exposes centerline conformity, inner-curve gapping, and end contact, then commit to the claim the scene can support.',
    correctLoadMode: 'bend',
    requiredArchitectureIds: [],
    choices: [
      {
        id: 'inspect-conformity',
        label: 'Inspect lumen retention, centerline conformity, and both device ends in the bend.',
        rationale:
          'Correct. Bending makes straightening tendency, inner-curve gapping, ovalization, and end loading visible together.',
      },
      {
        id: 'infer-radial-force',
        label: 'Infer a radial-force ranking from the bent pose alone.',
        rationale:
          'The scene applies visible motion but does not measure force, fixture response, or material properties.',
      },
      {
        id: 'ignore-end-contact',
        label: 'Judge only the mid-device lumen and ignore both landing zones.',
        rationale:
          'A preserved center lumen can coexist with gapping or concentrated contact at either end of a curved segment.',
      },
    ],
    correctChoiceId: 'inspect-conformity',
    explanation:
      'The bend scene supports a geometry claim about conformity, lumen shape, and end contact. It cannot establish a force threshold, product ranking, or patient-specific recommendation.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'mission-eccentric-load',
    title: 'Interpret eccentric loading',
    stem: 'A focal stenosis displaces one side of the airway more than the other.',
    task: 'Choose the load mode that reveals asymmetric lumen loss, then commit to the most defensible interpretation.',
    correctLoadMode: 'ovalization',
    requiredArchitectureIds: [],
    choices: [
      {
        id: 'uniform-is-enough',
        label: 'Uniform radial compression fully represents the focal lesion.',
        rationale:
          'Uniform displacement can be useful, but it does not reproduce one-sided flattening or the resulting contact redistribution.',
      },
      {
        id: 'inspect-ovalization',
        label:
          'Inspect cross-sectional flattening and where contact shifts under the eccentric load.',
        rationale:
          'Correct. Ovalization makes asymmetric lumen deformation visible without pretending to calculate local tissue pressure.',
      },
      {
        id: 'assign-tissue-pressure',
        label: 'Convert the visible flattening into a patient-specific tissue pressure.',
        rationale:
          'The schematic has no patient material properties, contact model, or calibrated fixture, so that conversion is unsupported.',
      },
    ],
    correctChoiceId: 'inspect-ovalization',
    explanation:
      'Focal ovalization tests a different geometric constraint than uniform radial compression. The observation is limited to displayed shape and contact pattern.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'mission-matched-radial',
    title: 'Compare matched radial displacement',
    stem: 'A free-crossing braid and a covered laser-cut lattice receive the same visible radial displacement.',
    task: 'Observe both required architectures in radial mode, then decide what the matched comparison actually establishes.',
    correctLoadMode: 'radial',
    requiredArchitectureIds: ['free-crossing-braid', 'laser-cut-covered'],
    choices: [
      {
        id: 'geometry-response',
        label: 'The two schematics show different geometric responses to the displayed constraint.',
        rationale:
          'Correct. Matched displacement permits a visual comparison of deformation while force, pressure, and clinical performance remain unknown.',
      },
      {
        id: 'validated-force-ranking',
        label: 'The architecture retaining more lumen has a validated higher force in newtons.',
        rationale:
          'The lab does not solve or measure material response, fixture effects, or force, so it cannot produce a validated ranking.',
      },
      {
        id: 'clinical-superiority',
        label: 'The architecture retaining more lumen is clinically superior for every airway.',
        rationale:
          'A schematic geometry response cannot establish fit, tissue tolerance, removability, durability, or patient-specific benefit.',
      },
    ],
    correctChoiceId: 'geometry-response',
    explanation:
      'The matched boundary motion isolates a visible topology-dependent response. It is not a force test, pressure model, product ranking, or clinical recommendation.',
    evidenceRefs: [
      'ratnovsky-airway-mechanics-2015',
      'mckenna-covered-braid-2021',
      'merit-aero-official',
    ],
  },
]

export const assessmentMasteryThreshold = 5

export const stentAssessmentItems: readonly AssessmentItem[] = [
  {
    id: 'assessment-curvature',
    stem: 'A candidate scaffold opens a narrowed curved main bronchus in a straight fixture. In the curved airway, its ends press toward the outer curve while the inner curve gaps.',
    prompt:
      'Which additional observation best tests whether the architecture is solving the real problem?',
    choices: [
      {
        id: 'bend-lumen-ends',
        label:
          'Inspect lumen retention, centerline conformity, and end contact at the target curvature.',
        rationale:
          'Correct. Curvature adds straightening, gapping, ovalization, and end loading that a straight radial test misses.',
      },
      {
        id: 'peak-radial-only',
        label: 'Use the peak flat-plate radial value by itself.',
        rationale:
          'Peak radial resistance does not reveal centerline conformity, end loading, or lumen preservation in a bend.',
      },
      {
        id: 'material-label',
        label: 'Choose from the material label without inspecting architecture.',
        rationale:
          'Devices made from the same material can have very different cell, wall, connector, and axial behavior.',
      },
    ],
    correctChoiceId: 'bend-lumen-ends',
    explanation:
      'A curved-airway decision must pair support with the way the finished architecture follows the centerline and loads its ends.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'assessment-eccentric',
    stem: 'A focal eccentric stenosis compresses one side of the airway much more than the other.',
    prompt: 'Which force-lab mode most directly reveals the missing behavior?',
    choices: [
      {
        id: 'uniform-radial',
        label: 'Uniform radial compression alone',
        rationale:
          'Uniform compression is useful, but it does not reproduce the one-sided load or the resulting cross-sectional distortion.',
      },
      {
        id: 'focal-ovalization',
        label: 'Focal ovalization with diameter-retention inspection',
        rationale:
          'Correct. Eccentric loading can flatten the lumen and redistribute contact even when average diameter appears acceptable.',
      },
      {
        id: 'deployment-release',
        label: 'Deployment release only',
        rationale:
          'Release shows recovery from constraint, not the sustained one-sided deformation created by an eccentric lesion.',
      },
    ],
    correctChoiceId: 'focal-ovalization',
    explanation:
      'Ovalization makes asymmetric lumen loss and local wall contact visible without pretending to calculate patient-specific pressure.',
    evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
  },
  {
    id: 'assessment-migration',
    stem: 'Two molded silicone designs have the same nominal diameter. One has lower whole-body compression force but directional anchoring features.',
    prompt: 'Which conclusion is best supported by the cited GINA-Dumon bench comparison?',
    choices: [
      {
        id: 'compression-equals-migration',
        label: 'The design with greater compression force must resist migration better.',
        rationale:
          'This collapses contact, surface geometry, friction, and directional anchoring into one radial measurement.',
      },
      {
        id: 'all-silicone-same',
        label: 'Nominal diameter makes the two silicone architectures mechanically equivalent.',
        rationale:
          'The cited study demonstrates that finished geometry can separate compression, flexibility, and migration responses.',
      },
      {
        id: 'geometry-independent',
        label:
          'Directional geometry can raise migration resistance independently of global compression force.',
        rationale:
          'Correct. In the cited fixture, GINA showed higher directional anti-migration force despite lower compression and flexibility forces.',
      },
    ],
    correctChoiceId: 'geometry-independent',
    explanation:
      'The case teaches architecture-specific anchoring, not a universal product ranking; the values remain fixture- and size-dependent.',
    evidenceRefs: ['jung-gina-2021'],
  },
  {
    id: 'assessment-benign-removal',
    stem: 'A benign stenosis may require temporary scaffolding, and later removal is a central goal.',
    prompt: 'Which design question deserves explicit priority before selection?',
    choices: [
      {
        id: 'brightest-marker',
        label: 'Which schematic has the brightest visual material',
        rationale:
          'Rendering appearance is not evidence of removability, tissue behavior, or clinical suitability.',
      },
      {
        id: 'force-only',
        label: 'Which device has the largest isolated radial-force value',
        rationale:
          'A single force value does not address incorporation, dwell strategy, or the hazards of later removal.',
      },
      {
        id: 'incorporation-removal',
        label: 'How coverage, exposed cells, and tissue incorporation affect planned removal',
        rationale:
          'Correct. Coverage and incorporation change whether later removal remains feasible and what hazards it may carry.',
      },
    ],
    correctChoiceId: 'incorporation-removal',
    explanation:
      'For benign disease, reversibility and removal consequences should be built into the initial architecture decision.',
    evidenceRefs: ['wabip-benign-stenting-2025'],
  },
  {
    id: 'assessment-fatigue-mucus',
    stem: 'A covered scaffold preserves lumen during one static compression but will sit across a mobile curve where secretions already clear poorly.',
    prompt: 'Which evaluation adds the most decision-relevant information?',
    choices: [
      {
        id: 'repeat-static',
        label: 'Repeat the same static compression once.',
        rationale:
          'A repeated static test still misses combined cyclic deformation and the airway-clearance burden of the covered surface.',
      },
      {
        id: 'combined-time',
        label:
          'Evaluate combined cyclic loading, cover behavior, and secretion-clearance consequences over time.',
        rationale:
          'Correct. The likely failure modes are time-dependent and arise from both scaffold mechanics and the tissue-facing surface.',
      },
      {
        id: 'hide-cover-claim-uncovered',
        label: 'Hide the cover in the viewer and treat the device as clinically uncovered.',
        rationale:
          'Cover hiding is only an inspection view; it must never change the device’s fixed configuration or clinical tradeoffs.',
      },
    ],
    correctChoiceId: 'combined-time',
    explanation:
      'Static patency is incomplete evidence when cyclic strain and mucus burden may dominate later performance.',
    evidenceRefs: [
      'chung-airway-fracture-2008',
      'pelton-nitinol-fatigue-2008',
      'chest-cao-guideline-2024',
    ],
  },
  {
    id: 'assessment-y-fit',
    stem: 'A bifurcated device appears stable at the carina, but one bronchial limb is too long and sits at the wrong branch angle.',
    prompt: 'What is the most important correction to the mental model?',
    choices: [
      {
        id: 'whole-y-fit',
        label:
          'Assess tracheal diameter, both limb diameters and lengths, branch angles, saddle contact, and distal patency as one fit problem.',
        rationale:
          'Correct. Geometric fixation does not compensate for branch mismatch or threatened distal ventilation.',
      },
      {
        id: 'carina-anchor-enough',
        label: 'Carinal anchoring makes the remaining dimensions secondary.',
        rationale:
          'The junction may resist migration while a mismatched limb still loads tissue, obstructs an orifice, or clears secretions poorly.',
      },
      {
        id: 'tube-foreshortening',
        label: 'Use only the straight-tube foreshortening metric.',
        rationale:
          'A bifurcated architecture cannot be reduced to one axial length-change value, which is why that control is hidden.',
      },
    ],
    correctChoiceId: 'whole-y-fit',
    explanation:
      'A Y-stent is a coupled three-limb geometry; fit must be evaluated across the full bifurcation rather than at the anchor alone.',
    evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
  },
]

export const stentModuleCopy: StentModuleCopy = {
  title: 'Airway Stent Learning Lab: Architecture, Mechanics & Clinical Tradeoffs',
  subtitle:
    'Begin in a guided Force Lab, then practice how topology transforms imposed motion into airway support, tissue contact, and time-dependent tradeoffs.',
  audience:
    'Interventional pulmonology fellows and practicing bronchoscopists, with resident scaffolding',
  estimatedMinutes: 60,
  disclaimer:
    'This module is for professional education and qualitative device-mechanics comparison only. It does not provide patient-specific recommendations, procedural instructions, force thresholds, sizing prescriptions, or product rankings. Actual selection, placement, surveillance, and removal depend on anatomy, pathology, device instructions for use, multidisciplinary judgment, local expertise, and patient goals.',
  comparisonModelNote:
    'Force Lab animations apply the same visible boundary motion to educational schematics. Amplitude represents displacement, not force. Normalized diameter retention and length change describe only the displayed geometry.',
  evidenceLimitations: [
    'Guideline recommendations are conditional or based on limited-certainty evidence in several areas.',
    'Bench results depend on device size, fixture, orientation, temperature, rate, preconditioning, and endpoint.',
    'Transferred engineering studies explain mechanisms but do not establish airway clinical thresholds.',
    'Branded examples identify sourced topology; schematics are not exact CAD and are never comparative rankings.',
  ],
  lessons: [
    {
      kind: 'instructional',
      id: 'orient',
      step: 1,
      eyebrow: 'Guided Force Lab',
      title: 'Start with the mechanical job',
      summary:
        'Begin in the Force Lab by connecting obstruction morphology to uniform, focal, and cyclic constraints, then define the mechanical job before comparing devices.',
      objectives: [
        'Distinguish intrinsic, extrinsic, mixed, and dynamic obstruction.',
        'Use boundary-motion scenes without interpreting visible deformation as measured force.',
        'State a mechanical goal separately from a device name.',
      ],
      prediction: {
        id: 'orient-prediction',
        prompt:
          'A central airway is narrowed by intraluminal tissue, but the wall remains stable after that tissue is addressed. What should be defined before adding a scaffold?',
        choices: [
          { id: 'residual-job', label: 'The residual mechanical job, if any' },
          { id: 'strongest-device', label: 'The strongest available device' },
          { id: 'longest-device', label: 'The longest available device' },
        ],
        correctChoiceId: 'residual-job',
        revealTitle: 'Treat the failure mode, not the silhouette.',
        reveal:
          'Intrinsic obstruction and wall instability are different problems. After the intraluminal component is addressed, explicitly reassess whether external compression, mixed disease, dynamic collapse, or another structural need remains.',
        evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
      },
      sections: [
        {
          id: 'orient-morphology',
          title: 'Name the morphology',
          lead: 'The same narrow lumen can hide different mechanical failures.',
          body: [
            'Intrinsic disease occupies the lumen; extrinsic disease compresses the wall; mixed disease combines both; dynamic obstruction changes with the respiratory cycle.',
            'The morphology determines whether the central task is removing burden, opposing compression, stabilizing a wall, or testing a reversible support hypothesis.',
          ],
          cards: obstructionMorphologies.map((item) => ({
            id: item.id,
            title: item.label,
            body: `${item.visualCue} ${item.mechanicalProblem}`,
            takeaway: item.decisionQuestion,
            evidenceRefs: item.evidenceRefs,
          })),
          evidenceRefs: ['chest-cao-guideline-2024'],
        },
        {
          id: 'orient-job',
          title: 'Write the job in one sentence',
          body: [
            'A useful statement names the load, the anatomy that must remain patent, and the tradeoff that cannot be ignored.',
            'Examples include opposing persistent external compression while protecting curved landing zones, or supporting a carinal bifurcation while preserving both distal pathways.',
          ],
          cards: decisionCards.slice(0, 2),
          evidenceRefs: ['wabip-malignant-stenting-2024', 'wabip-benign-stenting-2025'],
        },
      ],
      checkpoint: {
        id: 'orient-checkpoint',
        prompt:
          'After intraluminal treatment of mixed obstruction, substantial external compression remains. Which statement best defines the next mechanical question?',
        choices: [
          {
            id: 'support-residual',
            label:
              'What architecture can support the residual wall while fitting its landing zones?',
            rationale: 'Correct: it names the remaining load and the fit constraint.',
          },
          {
            id: 'material-first',
            label: 'Which material category is always strongest?',
            rationale:
              'Material alone does not specify architecture, fit, tissue contact, or clinical need.',
          },
          {
            id: 'stent-every-intrinsic',
            label: 'Which stent should be placed after every intrinsic treatment?',
            rationale:
              'Stenting is not automatically required when no residual mechanical job remains.',
          },
        ],
        correctChoiceId: 'support-residual',
        explanation:
          'Mixed obstruction requires reassessment after the intrinsic component is treated; the stent question begins with residual compression or instability.',
        evidenceRefs: ['chest-cao-guideline-2024', 'wabip-malignant-stenting-2024'],
      },
    },
    {
      kind: 'instructional',
      id: 'architectures',
      step: 2,
      eyebrow: 'Architectures',
      title: 'Trace the load path',
      summary:
        'Compare solid walls, dynamic cross-sections, bifurcations, free and captured braids, laser-cut connectors, and single-wire loops.',
      objectives: [
        'Identify seven topology-faithful architecture families.',
        'Explain why architecture can dominate a material label.',
        'Distinguish fixed device configuration from a visual scaffold-inspection mode.',
      ],
      prediction: {
        id: 'architecture-prediction',
        prompt:
          'Two devices are both described as nitinol. One is a free braid; the other is a laser-cut ring lattice. Should the same geometry control be used for both?',
        choices: [
          { id: 'different-topology', label: 'No—trace crossings, rings, and connectors first' },
          {
            id: 'same-material',
            label: 'Yes—the material label makes their load paths equivalent',
          },
          { id: 'coverage-only', label: 'Only coverage matters' },
        ],
        correctChoiceId: 'different-topology',
        revealTitle: 'Material is an ingredient; topology routes the load.',
        reveal:
          'A braid changes diameter through helical reconfiguration and crossing motion. A laser-cut lattice deforms through rings, struts, and connectors. Giving both a braid-angle control would teach a false mechanism.',
        evidenceRefs: [
          'fda-ultraflex-k230269',
          'merit-aero-official',
          'mckenna-covered-braid-2021',
        ],
      },
      sections: [
        {
          id: 'architecture-solid',
          title: 'Solid walls and bifurcations',
          body: [
            'Studded silicone, D-shaped dynamic silicone, and silicone Y-stents all use continuous walls, but their contact and anchoring geometry differ.',
            'A Y-stent routes load through three limbs and a carinal saddle, so straight-tube controls cannot describe its complete fit.',
          ],
          evidenceRefs: [
            'jung-gina-2021',
            'wabip-malignant-stenting-2024',
            'wabip-benign-stenting-2025',
          ],
        },
        {
          id: 'architecture-wire',
          title: 'Crossings, connectors, and loops',
          body: [
            'A free braid slides at crossings; hook-and-cross geometry captures selected crossings; a laser-cut lattice joins rings with connectors; a knitted scaffold follows one continuous strand through interwoven loops.',
            'Coverage is fixed for each profile. Hiding it reveals the scaffold for study but never converts the device into an uncovered configuration.',
          ],
          evidenceRefs: ['fda-bonastent-k140472', 'fda-ultraflex-k230269', 'merit-aero-official'],
        },
      ],
      checkpoint: {
        id: 'architecture-checkpoint',
        prompt: 'Which control is invalid for a laser-cut ring-and-connector lattice?',
        choices: [
          {
            id: 'braid-angle',
            label: 'Braid angle',
            rationale: 'Correct: the topology has no crossing helical wire families.',
          },
          {
            id: 'cover-inspection',
            label: 'Scaffold inspection beneath the fixed cover',
            rationale: 'This can be a valid visual inspection without changing actual coverage.',
          },
          {
            id: 'bend',
            label: 'Imposed bend motion',
            rationale: 'Bending is relevant to rings and connectors even without a braid.',
          },
        ],
        correctChoiceId: 'braid-angle',
        explanation:
          'Controls must follow topology. Laser-cut devices have rings, struts, and connectors—not a braid angle.',
        evidenceRefs: ['merit-aero-official'],
      },
    },
    {
      kind: 'instructional',
      id: 'force-lab',
      step: 3,
      eyebrow: 'Force Lab Practice',
      title: 'Choose the constraint, then defend the claim',
      summary:
        'Solve three cases with the full cockpit, then use matched visible displacement to defend only the conclusions the schematic can support.',
      objectives: [
        'Choose a load mode that matches the case question.',
        'Separate imposed displacement from measured force and distinguish RRF from COF.',
        'Interpret normalized diameter retention and length change only where supported.',
      ],
      prediction: {
        id: 'force-prediction',
        prompt:
          'Two schematics receive the same visible radial compression. One retains more lumen. What has the animation established?',
        choices: [
          { id: 'shape-only', label: 'A difference in displayed geometric response' },
          { id: 'force-ranking', label: 'A validated force ranking in newtons' },
          { id: 'tissue-pressure', label: 'Patient-specific tissue pressure' },
        ],
        correctChoiceId: 'shape-only',
        revealTitle: 'Same motion is not the same force measurement.',
        reveal:
          'The lab fixes boundary motion so learners can see topology-dependent deformation. It does not solve material properties, contact, fixtures, or patient anatomy, so force and tissue pressure remain unknown.',
        evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
      },
      sections: [
        {
          id: 'force-vocabulary',
          title: 'Use the metric and method together',
          body: [
            'Loading and unloading answer different questions. The same device may show hysteresis, and the measured response changes with fixture and endpoint.',
            'The lab therefore reports no synthetic kilopascals, product force curves, or unlabeled stiffness scores.',
          ],
          cards: forceTaxonomy.map((item) => ({
            id: item.id,
            title: item.term,
            body: item.definition,
            takeaway: item.interpretationLimit,
            evidenceRefs: item.evidenceRefs,
          })),
          evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
        },
        {
          id: 'force-modes',
          title: 'Inspect more than uniform compression',
          body: [
            'Radial compression, bend, focal ovalization, breathing, cough, and deployment coupling expose different deformation pathways.',
            'Pause is the default. A paused frame must remain unchanged so comparison is intentional rather than decorative.',
          ],
        },
        {
          id: 'force-gina',
          title: 'One sourced example: GINA versus Dumon',
          body: [
            'The cited bench study separated anti-migration, compression, and flexibility tests rather than treating them as one property.',
            'Its values belong to the tested designs and methods; they demonstrate separation of mechanisms, not universal thresholds.',
          ],
          evidenceRefs: ['jung-gina-2021'],
        },
      ],
      checkpoint: {
        id: 'force-checkpoint',
        prompt: 'Which statement correctly separates RRF from COF?',
        choices: [
          {
            id: 'loading-unloading',
            label:
              'RRF is read during compression; COF is read on expansion/unloading at a stated constraint.',
            rationale: 'Correct: the path and method are part of the meaning.',
          },
          {
            id: 'synonyms',
            label: 'They are interchangeable names for the same peak value.',
            rationale: 'Loading and unloading can differ because of hysteresis and test history.',
          },
          {
            id: 'clinical-thresholds',
            label: 'Either value alone defines safe tissue pressure.',
            rationale: 'Device force and local tissue pressure are not interchangeable.',
          },
        ],
        correctChoiceId: 'loading-unloading',
        explanation:
          'A defensible mechanics claim states the loading path, fixture, diameter range, and endpoint.',
        evidenceRefs: ['ratnovsky-airway-mechanics-2015'],
      },
    },
    {
      kind: 'instructional',
      id: 'tissue-time',
      step: 4,
      eyebrow: 'Tissue + Time',
      title: 'Translate mechanics into complications',
      summary:
        'Follow pressure, edge load, shear, ingrowth, mucus, and fatigue from the first contact through repeated cycles.',
      objectives: [
        'Connect visible contact patterns to plausible tissue mechanisms.',
        'Explain why coverage changes more than ingrowth.',
        'Distinguish a successful static pose from durable performance.',
      ],
      prediction: {
        id: 'tissue-prediction',
        prompt:
          'A covered scaffold is stiffer in one bench fixture than its uncovered frame. Must it create higher peak tissue pressure everywhere?',
        choices: [
          {
            id: 'not-necessarily',
            label: 'No—contact distribution and the tissue-facing surface also matter',
          },
          { id: 'always', label: 'Yes—device stiffness directly equals local tissue pressure' },
          { id: 'cover-no-effect', label: 'Coverage cannot change mechanics or contact' },
        ],
        correctChoiceId: 'not-necessarily',
        revealTitle: 'Device response and tissue response are connected, not identical.',
        reveal:
          'A membrane can alter global radial response while spreading contact across a broader surface. That may reduce some local peaks while adding friction, mucus, crease, end-loading, or fatigue tradeoffs.',
        evidenceRefs: ['mckenna-covered-braid-2021', 'ratnovsky-airway-mechanics-2015'],
      },
      sections: [
        {
          id: 'tissue-pathways',
          title: 'Trace six pathways',
          body: [
            'Do not label a device simply traumatic or atraumatic. Ask where it contacts, how that contact moves, what tissue can grow through, where secretions travel, and which regions cycle.',
          ],
          cards: tissueMechanisms.map((item) => ({
            id: item.id,
            title: item.label,
            body: `${item.mechanism} ${item.consequence}`,
            takeaway: item.inspectionQuestion,
            evidenceRefs: item.evidenceRefs,
          })),
        },
        {
          id: 'tissue-time-axis',
          title: 'Add the time axis',
          body: [
            'A static test can show recovery or lumen retention, but it cannot establish durability under combined breathing, cough, bending, torsion, and airway-clearance demands.',
            'Surveillance should be tied to expected failure modes rather than to a visual assumption that a patent stent is problem-free.',
          ],
          evidenceRefs: [
            'chung-airway-fracture-2008',
            'pelton-nitinol-fatigue-2008',
            'chest-cao-guideline-2024',
          ],
        },
      ],
      checkpoint: {
        id: 'tissue-checkpoint',
        prompt:
          'What tradeoff remains after a full cover blocks tissue ingrowth through scaffold cells?',
        choices: [
          {
            id: 'mucus-interface',
            label:
              'Secretion transport, surface friction, end loading, and cover fatigue still matter.',
            rationale:
              'Correct: coverage changes the interface rather than removing all complications.',
          },
          {
            id: 'no-surveillance',
            label: 'No surveillance is needed because tissue cannot enter the cells.',
            rationale:
              'Mucus, migration, granulation, infection, and structural problems can still occur.',
          },
          {
            id: 'becomes-silicone',
            label: 'The covered scaffold becomes mechanically identical to a solid silicone wall.',
            rationale: 'The underlying scaffold and membrane retain a distinct load path.',
          },
        ],
        correctChoiceId: 'mucus-interface',
        explanation:
          'Coverage blocks one pathway while altering several others. Tissue response must be traced across the whole interface and over time.',
        evidenceRefs: [
          'mckenna-covered-braid-2021',
          'chest-cao-guideline-2024',
          'wabip-benign-stenting-2025',
        ],
      },
    },
    {
      kind: 'instructional',
      id: 'evidence-decisions',
      step: 5,
      eyebrow: 'Evidence to Decisions',
      title: 'Build a defensible tradeoff statement',
      summary:
        'Combine fit, removability, interface burden, surveillance, and evidence transfer limits without turning bench data into a product ranking.',
      objectives: [
        'Use guidelines, airway bench studies, regulatory descriptions, and transferred engineering for the claims each can support.',
        'Frame fit as geometry and landing-zone compatibility rather than a universal oversizing rule.',
        'Connect a device choice to reassessment and troubleshooting triggers.',
      ],
      prediction: {
        id: 'evidence-prediction',
        prompt:
          'A removable strategy is important in benign disease. Which evidence question must accompany the desired support?',
        choices: [
          {
            id: 'future-removal',
            label: 'How architecture, coverage, and incorporation affect future removal',
          },
          { id: 'highest-score', label: 'Which device has the highest unlabeled mechanics score' },
          { id: 'brand-familiarity', label: 'Which brand name is most familiar' },
        ],
        correctChoiceId: 'future-removal',
        revealTitle: 'The exit strategy belongs in the initial decision.',
        reveal:
          'In benign obstruction, expected reversibility and removal consequences change the value of coverage, exposed cells, and planned duration. Support cannot be judged independently of that future interface.',
        evidenceRefs: ['wabip-benign-stenting-2025'],
      },
      sections: [
        {
          id: 'evidence-ladder',
          title: 'Match the source to the claim',
          body: [
            'Guidelines support clinical framing; airway bench studies support method-bound comparisons; regulatory and manufacturer documents support construction descriptions; transferred engineering supports mechanism-level hypotheses.',
            'None of those sources alone supplies a patient-specific answer or universal product ranking.',
          ],
          evidenceRefs: [
            'chest-cao-guideline-2024',
            'jung-gina-2021',
            'fda-ultraflex-k230269',
            'mckenna-covered-braid-2021',
          ],
        },
        {
          id: 'evidence-decision-loop',
          title: 'Use a five-part decision loop',
          body: [
            'Define the job, solve fit, name the removal horizon, predict interface burden, and predefine surveillance or troubleshooting triggers.',
            'The result should be a tradeoff statement: why an architecture matches the intended job, what it risks, and what evidence does not establish.',
          ],
          cards: decisionCards,
          evidenceRefs: [
            'chest-cao-guideline-2024',
            'wabip-malignant-stenting-2024',
            'wabip-benign-stenting-2025',
          ],
        },
      ],
      checkpoint: {
        id: 'evidence-checkpoint',
        prompt:
          'A vascular finite-element study shows how a polymer cover changes braided-stent response. What is the safest airway teaching use?',
        choices: [
          {
            id: 'mechanism-hypothesis',
            label:
              'Use it to explain a mechanism, clearly labeled as transferred engineering evidence.',
            rationale:
              'Correct: it can inform a hypothesis without becoming airway clinical proof.',
          },
          {
            id: 'patient-threshold',
            label: 'Convert it into a patient-specific airway pressure threshold.',
            rationale: 'The model and application do not validate that transfer.',
          },
          {
            id: 'product-ranking',
            label: 'Use it to rank commercial airway stents.',
            rationale:
              'A generic transferred model cannot establish comparative clinical performance.',
          },
        ],
        correctChoiceId: 'mechanism-hypothesis',
        explanation:
          'Evidence must remain attached to its population, device, fixture, and modeling assumptions.',
        evidenceRefs: ['mckenna-covered-braid-2021'],
      },
    },
    {
      kind: 'assessment',
      id: 'assessment',
      step: 6,
      eyebrow: 'Integrated Assessment',
      title: 'Commit across mechanics, tissue, and time',
      summary:
        'Six cases test curvature, eccentric loading, migration, benign removal, fatigue and mucostasis, and Y-stent fit.',
      objectives: [
        'Apply the full decision loop without relying on brand or material shortcuts.',
        'Explain why each rejected option fails.',
        'Reach mastery at five correct answers out of six, with retry available.',
      ],
      sections: [
        {
          id: 'assessment-instructions',
          title: 'How to use the assessment',
          body: [
            'Commit to all six choices before reveal. Submission completes the module even below mastery; a score of five or six records mastery.',
            'Review every rationale, then retry if the tradeoff—not just the answer—remains unclear.',
          ],
        },
      ],
      masteryThreshold: assessmentMasteryThreshold,
      items: stentAssessmentItems,
    },
  ],
}
