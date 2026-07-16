import { findMissingEvidenceRefs, type EvidenceReferenceId } from './evidenceRegistry'

export type MechanismScenarioId =
  | 'silicone-curve-involution'
  | 'cough-interface-response'
  | 'whole-y-fit-deployment'
  | 'longitudinal-complication-outcomes'

export type MechanismScenarioKind =
  | 'curved-airway-deformation'
  | 'cough-interface-behavior'
  | 'bifurcation-fit-deployment'
  | 'longitudinal-outcomes'

export type MechanismArchitectureFamily =
  | 'solid-silicone-tube'
  | 'braided-self-expanding-scaffold'
  | 'silicone-y'
  | 'metallic-y-scaffold'
  | 'architecture-independent'

export type MechanismVisualState =
  | 'curve-stable'
  | 'curve-straightening'
  | 'curve-central-involution'
  | 'cough-rest'
  | 'cough-excursion'
  | 'cough-contributors'
  | 'cough-tissue-response'
  | 'y-whole-fit'
  | 'y-deployment'
  | 'y-postdeployment'
  | 'timeline-baseline'
  | 'timeline-early'
  | 'timeline-later'
  | 'timeline-outcomes'

export type MechanismComplicationId =
  | 'mucus-obstruction'
  | 'infection'
  | 'migration'
  | 'granulation'
  | 'tumor-ingrowth-overgrowth'
  | 'fracture'
  | 'cover-failure'
  | 'branch-obstruction'

export type MechanismOutcomeDomain =
  | 'technical-patency'
  | 'symptom-quality-of-life'
  | 'reintervention-burden'
  | 'underlying-disease-outcome'

export interface MechanismAirwayGeometry {
  kind: 'curved-tube' | 'central-airway' | 'carinal-bifurcation' | 'follow-up-timeline'
  description: string
  landmarks: readonly string[]
}

export interface MechanismSceneHotspot {
  id: string
  label: string
  description: string
  phaseIds: readonly string[]
}

export interface MechanismObservationPrompt {
  id: string
  label: string
  purpose: string
}

export interface MechanismPredictionChoice {
  id: string
  label: string
  postCommitRationale: string
  consequenceStateId: string
}

export interface MechanismLearnerPrompt {
  id: string
  question: string
  instruction: string
  choices: readonly MechanismPredictionChoice[]
}

export interface MechanismPhase {
  id: string
  label: string
  action: string
  visualState: MechanismVisualState
  hotspotIds: readonly string[]
  reducedMotionText: string
  requiredObservationIds?: readonly string[]
}

export interface MechanismArchitectureBehavior {
  architectureFamily: MechanismArchitectureFamily
  label: string
  construction: string
  motionDuringCough?: readonly string[]
  deploymentMethod?: readonly string[]
  explicitlyNotModeled: readonly string[]
}

export interface MechanismConsequenceState {
  id: string
  label: string
  summary: string
  inspectionFindings: readonly string[]
  complicationIds: readonly MechanismComplicationId[]
  outcomeDomains?: Partial<Record<MechanismOutcomeDomain, string>>
}

export interface MechanismScenario {
  id: MechanismScenarioId
  kind: MechanismScenarioKind
  title: string
  clinicalQuestion: string
  completionPolicy: 'selected-architecture-family' | 'all-architecture-families'
  architectureFamilies: readonly MechanismArchitectureFamily[]
  airwayGeometry: MechanismAirwayGeometry
  phases: readonly MechanismPhase[]
  architectureBehaviors: readonly MechanismArchitectureBehavior[]
  hotspots: readonly MechanismSceneHotspot[]
  observationPrompts: readonly MechanismObservationPrompt[]
  learnerPrompt: MechanismLearnerPrompt
  consequenceStates: readonly MechanismConsequenceState[]
  evidenceBoundary: string
  evidenceRefs: readonly EvidenceReferenceId[]
  clinicalReviewStatus: 'draft' | 'reviewed'
}

const siliconeCurveInvolution: MechanismScenario = {
  id: 'silicone-curve-involution',
  kind: 'curved-airway-deformation',
  title: 'Curved-airway fit: central silicone involution',
  clinicalQuestion:
    'What can happen when a relatively straight solid silicone tube is constrained inside a curved airway?',
  completionPolicy: 'selected-architecture-family',
  architectureFamilies: ['solid-silicone-tube'],
  airwayGeometry: {
    kind: 'curved-tube',
    description:
      'A generic curved central-airway segment with visible proximal and distal landing zones.',
    landmarks: ['proximal landing zone', 'inner curve', 'outer curve', 'distal landing zone'],
  },
  phases: [
    {
      id: 'curve-baseline',
      label: 'Inspect baseline fit',
      action: 'Compare the tube axis with the airway centerline before committing your prediction.',
      visualState: 'curve-stable',
      hotspotIds: ['curve-inner-wall', 'curve-device-ends'],
      reducedMotionText:
        'Static baseline: the solid silicone tube is open, but its straighter axis does not fully match the airway curve.',
    },
    {
      id: 'curve-load',
      label: 'Apply the curve constraint',
      action: 'Inspect the center and both ends as the airway constrains the solid wall.',
      visualState: 'curve-straightening',
      hotspotIds: ['curve-inner-wall', 'curve-device-ends'],
      reducedMotionText:
        'Static loaded pose: the tube tends to straighten, shifting apposition toward selected wall and end regions.',
    },
    {
      id: 'curve-consequence',
      label: 'Reinspect functional lumen',
      action:
        'Look for inward folding, gapping, sliding, or migration rather than braid-like shortening.',
      visualState: 'curve-central-involution',
      hotspotIds: ['curve-central-lumen', 'curve-device-ends'],
      reducedMotionText:
        'Static consequence pose: the central solid wall folds inward and narrows the visible lumen while an end gap remains visible.',
    },
  ],
  architectureBehaviors: [
    {
      architectureFamily: 'solid-silicone-tube',
      label: 'Continuous-wall silicone tube',
      construction: 'A molded solid wall without sliding wire crossings.',
      motionDuringCough: [
        'straightening within a curve',
        'sliding or migration',
        'central involution',
      ],
      explicitlyNotModeled: [
        'braid-angle diameter-length coupling',
        'wire-scaffold foreshortening',
        'a patient-specific tissue-pressure calculation',
      ],
    },
  ],
  hotspots: [
    {
      id: 'curve-inner-wall',
      label: 'Inner curve',
      description: 'Inspect changing apposition where the airway turns most sharply.',
      phaseIds: ['curve-baseline', 'curve-load'],
    },
    {
      id: 'curve-device-ends',
      label: 'Device ends',
      description: 'Inspect end position, gapping, and any visible sliding.',
      phaseIds: ['curve-baseline', 'curve-load', 'curve-consequence'],
    },
    {
      id: 'curve-central-lumen',
      label: 'Central lumen',
      description: 'Inspect the center of the solid wall for inward buckling or involution.',
      phaseIds: ['curve-consequence'],
    },
  ],
  observationPrompts: [],
  learnerPrompt: {
    id: 'curve-prediction',
    question: 'Which deformation should you specifically inspect for in this solid silicone tube?',
    instruction: 'Commit before the loaded and consequence poses are revealed.',
    choices: [
      {
        id: 'predict-central-involution',
        label: 'Straightening with possible central inward buckling, gapping, or sliding',
        postCommitRationale:
          'A solid wall can straighten or fold in a curve, so the center, ends, and adjacent branch relationships need direct inspection.',
        consequenceStateId: 'curve-involution-observed',
      },
      {
        id: 'predict-braid-foreshortening',
        label: 'Braid-angle foreshortening as the primary silicone response',
        postCommitRationale:
          'That prediction transfers wire-braid mechanics to a continuous solid wall. Reinspect for straightening, sliding, gapping, or involution instead.',
        consequenceStateId: 'curve-braid-transfer-corrected',
      },
    ],
  },
  consequenceStates: [
    {
      id: 'curve-involution-observed',
      label: 'Central involution is visible',
      summary:
        'The code-native scene shows one plausible solid-wall response to curve mismatch, not an inevitable clinical outcome.',
      inspectionFindings: [
        'The central lumen is smaller in the loaded pose.',
        'End apposition changes as the tube attempts to straighten.',
        'Postdeployment bronchoscopy should inspect the entire device and adjacent orifices.',
      ],
      complicationIds: ['migration', 'mucus-obstruction', 'branch-obstruction'],
    },
    {
      id: 'curve-braid-transfer-corrected',
      label: 'Architecture distinction corrected',
      summary:
        'The solid silicone scene deliberately shows straightening and inward folding rather than braid-angle foreshortening.',
      inspectionFindings: [
        'The device has no sliding wire crossings.',
        'Visible central involution can reduce functional lumen.',
        'Gapping or sliding may coexist with central deformation.',
      ],
      complicationIds: ['migration', 'mucus-obstruction', 'branch-obstruction'],
    },
  ],
  evidenceBoundary:
    'This generic authored geometry demonstrates a plausible deformation pattern. It does not reproduce a named product, calculate mucosal pressure, predict an individual complication, or establish a universal fit threshold.',
  evidenceRefs: [
    'jung-gina-2021',
    'ratnovsky-airway-mechanics-2015',
    'textbook-silicone-stents-2025',
    'textbook-airway-stents-primer-2025',
  ],
  clinicalReviewStatus: 'draft',
}

const coughInterfaceResponse: MechanismScenario = {
  id: 'cough-interface-response',
  kind: 'cough-interface-behavior',
  title: 'Cough-interface behavior: architecture changes the motion',
  clinicalQuestion:
    'How should cough-related device motion be interpreted without turning a plausible mechanism into a deterministic granulation claim?',
  completionPolicy: 'all-architecture-families',
  architectureFamilies: ['braided-self-expanding-scaffold', 'solid-silicone-tube'],
  airwayGeometry: {
    kind: 'central-airway',
    description:
      'A generic airway-device interface shown at rest and during an exaggerated educational cough excursion.',
    landmarks: ['proximal end', 'device body', 'distal end', 'adjacent mucosa'],
  },
  phases: [
    {
      id: 'cough-baseline',
      label: 'Establish the resting interface',
      action: 'Inspect device length, diameter, end position, and visible secretion burden.',
      visualState: 'cough-rest',
      hotspotIds: ['cough-proximal-end', 'cough-distal-end'],
      reducedMotionText:
        'Static baseline: both architecture families are shown with fixed reference marks at each device end.',
    },
    {
      id: 'cough-excursion',
      label: 'Compare a cough excursion',
      action: 'Use the reference marks to distinguish axial end excursion from solid-wall sliding.',
      visualState: 'cough-excursion',
      hotspotIds: ['cough-proximal-end', 'cough-distal-end', 'cough-device-body'],
      reducedMotionText:
        'Static paired pose: the braid changes diameter and length with axial end excursion; the solid silicone tube slides and straightens without braid-angle coupling.',
    },
    {
      id: 'cough-contributor-check',
      label: 'Inspect the full tissue-response context',
      action:
        'Confirm every contributor domain before revealing the progressive tissue-response pose.',
      visualState: 'cough-contributors',
      hotspotIds: ['cough-interface-context'],
      reducedMotionText:
        'Text checklist replaces animation: end contact, secretions or infection, dwell time, and host response are considered together.',
      requiredObservationIds: [
        'end-contact',
        'secretions-infection',
        'dwell-time',
        'host-response',
      ],
    },
    {
      id: 'cough-response',
      label: 'Reveal a multifactorial tissue response',
      action:
        'Relate the interface finding to surveillance and reassessment, not to a causal score.',
      visualState: 'cough-tissue-response',
      hotspotIds: ['cough-interface-context'],
      reducedMotionText:
        'Static final pose: progressive tissue encroachment is shown only after all contributor domains are acknowledged; no single driver is labeled as the cause.',
    },
  ],
  architectureBehaviors: [
    {
      architectureFamily: 'braided-self-expanding-scaffold',
      label: 'Braided self-expanding scaffold',
      construction: 'Crossing wire elements permit architecture-specific diameter-length coupling.',
      motionDuringCough: [
        'diameter-length coupling',
        'axial end excursion',
        'possible foreshortening as braid geometry changes',
      ],
      explicitlyNotModeled: [
        'a universal amount of foreshortening',
        'a direct cough-to-granulation causal pathway',
        'a patient-specific complication probability',
      ],
    },
    {
      architectureFamily: 'solid-silicone-tube',
      label: 'Continuous-wall silicone tube',
      construction: 'A molded solid wall without sliding wire crossings.',
      motionDuringCough: [
        'whole-device sliding or migration',
        'straightening within a curve',
        'possible central involution',
      ],
      explicitlyNotModeled: [
        'braid-angle diameter-length coupling',
        'wire-scaffold foreshortening',
        'a direct cough-to-granulation causal pathway',
      ],
    },
  ],
  hotspots: [
    {
      id: 'cough-proximal-end',
      label: 'Proximal reference mark',
      description: 'Compare the device end with a fixed airway reference.',
      phaseIds: ['cough-baseline', 'cough-excursion'],
    },
    {
      id: 'cough-distal-end',
      label: 'Distal reference mark',
      description: 'Inspect the direction and type of end excursion.',
      phaseIds: ['cough-baseline', 'cough-excursion'],
    },
    {
      id: 'cough-device-body',
      label: 'Architecture body',
      description: 'Distinguish braid coupling from solid-wall translation or deformation.',
      phaseIds: ['cough-excursion'],
    },
    {
      id: 'cough-interface-context',
      label: 'Interface and tissue context',
      description:
        'Reassess mechanical, infectious-secretory, biologic, and time domains together.',
      phaseIds: ['cough-contributor-check', 'cough-response'],
    },
  ],
  observationPrompts: [
    {
      id: 'end-contact',
      label: 'End contact and interface motion',
      purpose: 'Repeated contact is a plausible mechanical contributor, not proof of causation.',
    },
    {
      id: 'secretions-infection',
      label: 'Secretions, colonization, or infection',
      purpose: 'The infectious-secretory domain can coexist with mechanical findings.',
    },
    {
      id: 'dwell-time',
      label: 'Dwell time and changing indication',
      purpose: 'The interface and ongoing benefit can change over time.',
    },
    {
      id: 'host-response',
      label: 'Host and wound-healing response',
      purpose: 'Tissue response varies and is not determined by the visible device motion alone.',
    },
  ],
  learnerPrompt: {
    id: 'cough-prediction',
    question: 'Which interpretation should guide the next inspection?',
    instruction:
      'Select an architecture family, then commit before the cough pose and consequence are shown.',
    choices: [
      {
        id: 'predict-architecture-plus-context',
        label: 'Identify architecture-specific motion, then assess the full interface context',
        postCommitRationale:
          'Motion can identify what to inspect, while tissue response remains multifactorial and requires longitudinal reassessment.',
        consequenceStateId: 'cough-multifactorial-response',
      },
      {
        id: 'predict-cough-alone',
        label: 'Treat visible cough motion as sufficient proof of the tissue response',
        postCommitRationale:
          'Visible motion alone cannot establish why tissue developed. Mechanical, infectious-secretory, biologic, and time domains still need review.',
        consequenceStateId: 'cough-causal-overreach-corrected',
      },
    ],
  },
  consequenceStates: [
    {
      id: 'cough-multifactorial-response',
      label: 'Multifactorial interpretation retained',
      summary:
        'The progressive tissue pose is a conceptual model linking inspection domains; it is not a deterministic sequence.',
      inspectionFindings: [
        'Architecture determines which motion descriptions are mechanically plausible.',
        'End contact and secretions or infection are reassessed together.',
        'Dwell time, host response, ongoing indication, and surveillance remain part of the plan.',
      ],
      complicationIds: ['granulation', 'infection', 'migration', 'mucus-obstruction'],
    },
    {
      id: 'cough-causal-overreach-corrected',
      label: 'Causal overreach corrected',
      summary:
        'The scene withholds the tissue response until all contributor domains are acknowledged because visible cough motion is not sufficient causal evidence.',
      inspectionFindings: [
        'The visual can direct inspection but cannot identify a single cause.',
        'Association evidence must not be presented as an individual prediction.',
        'Management requires reassessing patency, infection, fit, ongoing indication, and follow-up.',
      ],
      complicationIds: ['granulation', 'infection', 'migration', 'mucus-obstruction'],
    },
  ],
  evidenceBoundary:
    'This exaggerated generic scene is a conceptual mechanics model. Visible cough motion is insufficient causal evidence for granulation and cannot quantify tissue stress or predict an individual outcome; observational evidence supports associations that must remain conditional.',
  evidenceRefs: [
    'mckenna-covered-braid-2021',
    'ost-infection-granulation-2012',
    'hu-granulation-diameter-2011',
    'gupta-granulation-review-2025',
    'textbook-sems-2025',
    'textbook-silicone-stents-2025',
    'textbook-airway-stents-primer-2025',
  ],
  clinicalReviewStatus: 'draft',
}

const wholeYFitDeployment: MechanismScenario = {
  id: 'whole-y-fit-deployment',
  kind: 'bifurcation-fit-deployment',
  title: 'Whole-Y planning and deployment inspection',
  clinicalQuestion:
    'How do you plan, deploy, and inspect a bifurcated device as one coupled geometry rather than three independent tubes?',
  completionPolicy: 'all-architecture-families',
  architectureFamilies: ['silicone-y', 'metallic-y-scaffold'],
  airwayGeometry: {
    kind: 'carinal-bifurcation',
    description:
      'A generic trachea, carinal saddle, and right and left main bronchial pathways with distal branch markers.',
    landmarks: [
      'tracheal segment',
      'carinal saddle',
      'right limb',
      'left limb',
      'distal branch orifices',
    ],
  },
  phases: [
    {
      id: 'y-plan',
      label: 'Plan the whole Y',
      action: 'Inspect every segment and distal orifice before committing to a deployment pathway.',
      visualState: 'y-whole-fit',
      hotspotIds: ['y-trachea', 'y-saddle', 'y-right-limb', 'y-left-limb', 'y-orifices'],
      reducedMotionText:
        'Static whole-Y plan: the tracheal segment, saddle, both limb diameters and lengths, branch angles, and distal orifices are labeled together.',
    },
    {
      id: 'y-deploy',
      label: 'Stage deployment',
      action:
        'Follow the architecture-specific sequence and confirm orientation before final release.',
      visualState: 'y-deployment',
      hotspotIds: ['y-saddle', 'y-right-limb', 'y-left-limb'],
      reducedMotionText:
        'Static staged panels show silicone push-pull manipulation or metallic dual-guidewire delivery, followed by saddle alignment and controlled limb release.',
      requiredObservationIds: [
        'y-tracheal-segment',
        'y-carinal-saddle',
        'y-limb-diameters-lengths',
        'y-branch-angles',
        'y-distal-patency',
      ],
    },
    {
      id: 'y-postdeployment',
      label: 'Inspect after deployment',
      action: 'Confirm the whole device, both distal airways, and all branch relationships.',
      visualState: 'y-postdeployment',
      hotspotIds: ['y-trachea', 'y-saddle', 'y-right-limb', 'y-left-limb', 'y-orifices'],
      reducedMotionText:
        'Static postdeployment view: seating, apposition, limb length, orientation, secretion pockets, and distal orifice patency are inspected as one system.',
    },
  ],
  architectureBehaviors: [
    {
      architectureFamily: 'silicone-y',
      label: 'Continuous-wall silicone Y',
      construction: 'A molded bifurcated solid wall with a central saddle.',
      deploymentMethod: [
        'compress or fold for the planned insertion path',
        'use push-pull manipulation to orient the bronchial limbs',
        'seat the carinal saddle, then inspect both distal limbs and the tracheal segment',
      ],
      explicitlyNotModeled: [
        'a universal insertion maneuver',
        'patient-specific sizing',
        'a substitute for current instructions for use or supervised procedural training',
      ],
    },
    {
      architectureFamily: 'metallic-y-scaffold',
      label: 'Self-expanding metallic Y scaffold',
      construction: 'A generic bifurcated wire scaffold delivered over separate branch paths.',
      deploymentMethod: [
        'maintain right and left guidewire access',
        'advance the delivery system using the device-specific dual-guidewire pathway',
        'stage expansion while confirming saddle orientation, both limbs, and distal patency',
      ],
      explicitlyNotModeled: [
        'a named delivery system',
        'a universal release sequence',
        'a substitute for current instructions for use or supervised procedural training',
      ],
    },
  ],
  hotspots: [
    {
      id: 'y-trachea',
      label: 'Tracheal segment',
      description: 'Inspect diameter, proximal landing zone, length, and apposition.',
      phaseIds: ['y-plan', 'y-postdeployment'],
    },
    {
      id: 'y-saddle',
      label: 'Carinal saddle',
      description: 'Inspect seating, rotational orientation, and focal junction contact.',
      phaseIds: ['y-plan', 'y-deploy', 'y-postdeployment'],
    },
    {
      id: 'y-right-limb',
      label: 'Right bronchial limb',
      description: 'Inspect diameter, length, angle, distal position, and adjacent branches.',
      phaseIds: ['y-plan', 'y-deploy', 'y-postdeployment'],
    },
    {
      id: 'y-left-limb',
      label: 'Left bronchial limb',
      description: 'Inspect diameter, length, angle, distal position, and adjacent branches.',
      phaseIds: ['y-plan', 'y-deploy', 'y-postdeployment'],
    },
    {
      id: 'y-orifices',
      label: 'Distal branch orifices',
      description: 'Confirm that both pathways remain patent and no important branch is covered.',
      phaseIds: ['y-plan', 'y-postdeployment'],
    },
  ],
  observationPrompts: [
    {
      id: 'y-tracheal-segment',
      label: 'Tracheal diameter, length, and proximal landing zone',
      purpose: 'Tracheal fit is necessary but does not establish whole-Y fit.',
    },
    {
      id: 'y-carinal-saddle',
      label: 'Carinal saddle position and orientation',
      purpose: 'Saddle mismatch can transmit load or misalign both limbs.',
    },
    {
      id: 'y-limb-diameters-lengths',
      label: 'Both limb diameters and lengths',
      purpose: 'Each bronchial pathway needs independent measurement within the coupled plan.',
    },
    {
      id: 'y-branch-angles',
      label: 'Right and left branch angles',
      purpose: 'Angle mismatch can distort the saddle or distal landing zones.',
    },
    {
      id: 'y-distal-patency',
      label: 'Distal airway and branch-orifice patency',
      purpose: 'A seated central device can still obstruct a downstream branch.',
    },
  ],
  learnerPrompt: {
    id: 'y-prediction',
    question: 'What defines a successful postdeployment inspection?',
    instruction: 'Commit before the deployment and postdeployment stages are revealed.',
    choices: [
      {
        id: 'predict-whole-y-inspection',
        label: 'Inspect the tracheal segment, saddle, both limbs, angles, and distal orifices',
        postCommitRationale:
          'A bifurcated device succeeds or fails as a coupled geometry, so every limb and distal branch relationship must be reinspected.',
        consequenceStateId: 'y-whole-fit-preserved',
      },
      {
        id: 'predict-tracheal-seat-only',
        label: 'Use tracheal seating alone as the endpoint',
        postCommitRationale:
          'Tracheal seating can look satisfactory while a saddle or bronchial limb remains mismatched or covers a distal orifice.',
        consequenceStateId: 'y-incomplete-inspection-corrected',
      },
    ],
  },
  consequenceStates: [
    {
      id: 'y-whole-fit-preserved',
      label: 'Whole-Y fit is explicitly verified',
      summary:
        'The postdeployment inspection treats central seating, both bronchial limbs, and distal airway preservation as one endpoint.',
      inspectionFindings: [
        'The saddle is aligned with the carina.',
        'Both limb ends and branch angles are directly inspected.',
        'Distal orifices remain visible and the surveillance plan includes all three limbs.',
      ],
      complicationIds: ['branch-obstruction', 'migration', 'mucus-obstruction', 'granulation'],
    },
    {
      id: 'y-incomplete-inspection-corrected',
      label: 'Tracheal-only endpoint rejected',
      summary:
        'A central view cannot exclude saddle mismatch, distal limb malposition, or branch obstruction.',
      inspectionFindings: [
        'Reinspect the saddle and both limbs before accepting the result.',
        'Confirm distal airway and branch-orifice patency on both sides.',
        'Document architecture-specific deployment and retrieval constraints.',
      ],
      complicationIds: ['branch-obstruction', 'migration', 'mucus-obstruction', 'granulation'],
    },
  ],
  evidenceBoundary:
    'These generic stages teach planning and inspection domains, not a complete procedural technique. They do not replace current device instructions, supervised training, patient-specific measurement, or operator judgment.',
  evidenceRefs: [
    'chest-cao-guideline-2024',
    'wabip-malignant-stenting-2024',
    'wabip-benign-stenting-2025',
    'textbook-y-stenting-2025',
    'textbook-sems-2025',
    'textbook-silicone-stents-2025',
    'textbook-stent-placement',
  ],
  clinicalReviewStatus: 'draft',
}

const longitudinalComplicationOutcomes: MechanismScenario = {
  id: 'longitudinal-complication-outcomes',
  kind: 'longitudinal-outcomes',
  title: 'Longitudinal surveillance: complications and outcomes diverge',
  clinicalQuestion:
    'How should follow-up separate airway patency, patient-experienced benefit, reintervention burden, and underlying disease outcome?',
  completionPolicy: 'selected-architecture-family',
  architectureFamilies: ['architecture-independent'],
  airwayGeometry: {
    kind: 'follow-up-timeline',
    description:
      'A nonquantitative follow-up sequence from the immediate technical result through later reassessment.',
    landmarks: ['postdeployment', 'early reassessment', 'later reassessment', 'exit review'],
  },
  phases: [
    {
      id: 'timeline-baseline',
      label: 'Document the technical baseline',
      action:
        'Record patency, device position, branch preservation, symptoms, and the planned exit horizon.',
      visualState: 'timeline-baseline',
      hotspotIds: ['timeline-technical'],
      reducedMotionText:
        'Static baseline card: immediate technical patency is documented alongside symptoms, treatment trajectory, and the next reassessment trigger.',
    },
    {
      id: 'timeline-early',
      label: 'Reassess early problems',
      action: 'Look for mucus obstruction, infection, migration, and branch obstruction.',
      visualState: 'timeline-early',
      hotspotIds: ['timeline-secretory', 'timeline-position'],
      reducedMotionText:
        'Static early follow-up card lists mucus obstruction, infection, migration, and branch obstruction as findings to evaluate rather than inevitable events.',
    },
    {
      id: 'timeline-later',
      label: 'Reassess later device-disease interaction',
      action: 'Look for granulation, tumor ingrowth or overgrowth, fracture, and cover failure.',
      visualState: 'timeline-later',
      hotspotIds: ['timeline-tissue', 'timeline-device-integrity'],
      reducedMotionText:
        'Static later follow-up card lists granulation, tumor ingrowth or overgrowth, fracture, and cover failure without assigning a universal sequence or probability.',
    },
    {
      id: 'timeline-outcomes',
      label: 'Separate four outcome domains',
      action:
        'Decide whether ongoing benefit still justifies the device and reintervention burden.',
      visualState: 'timeline-outcomes',
      hotspotIds: ['timeline-outcome-domains'],
      reducedMotionText:
        'Static outcome grid separates technical patency, symptoms and quality of life, reintervention burden, and underlying disease outcome.',
    },
  ],
  architectureBehaviors: [
    {
      architectureFamily: 'architecture-independent',
      label: 'Architecture-independent follow-up frame',
      construction:
        'A surveillance framework that must later be adapted to the implanted architecture and clinical context.',
      explicitlyNotModeled: [
        'a fixed surveillance interval',
        'a patient-specific complication probability',
        'equivalence between technical patency and clinical benefit',
      ],
    },
  ],
  hotspots: [
    {
      id: 'timeline-technical',
      label: 'Technical baseline',
      description:
        'Patency and position establish a reference but do not define the whole outcome.',
      phaseIds: ['timeline-baseline'],
    },
    {
      id: 'timeline-secretory',
      label: 'Secretory and infectious findings',
      description: 'Assess mucus obstruction and infection in the clinical context.',
      phaseIds: ['timeline-early'],
    },
    {
      id: 'timeline-position',
      label: 'Position and branch relationships',
      description: 'Reassess migration and branch obstruction.',
      phaseIds: ['timeline-early'],
    },
    {
      id: 'timeline-tissue',
      label: 'Tissue-device-disease interface',
      description: 'Distinguish granulation from tumor ingrowth or overgrowth.',
      phaseIds: ['timeline-later'],
    },
    {
      id: 'timeline-device-integrity',
      label: 'Device integrity',
      description: 'Inspect for fracture or cover failure where relevant to the architecture.',
      phaseIds: ['timeline-later'],
    },
    {
      id: 'timeline-outcome-domains',
      label: 'Four outcome domains',
      description: 'Avoid using one favorable domain as a proxy for all outcomes.',
      phaseIds: ['timeline-outcomes'],
    },
  ],
  observationPrompts: [],
  learnerPrompt: {
    id: 'timeline-prediction',
    question: 'Which follow-up frame best captures whether the intervention is still helping?',
    instruction: 'Commit before the complication and outcome sequence is revealed.',
    choices: [
      {
        id: 'predict-four-domain-review',
        label:
          'Track technical, patient-experienced, reintervention, and disease outcomes separately',
        postCommitRationale:
          'A patent device can coexist with limited symptom benefit, repeated procedures, or progression of the underlying disease.',
        consequenceStateId: 'timeline-integrated-review',
      },
      {
        id: 'predict-patency-equals-success',
        label: 'Treat visible patency as sufficient evidence of overall success',
        postCommitRationale:
          'Technical patency is important, but it cannot substitute for symptoms, quality of life, reintervention burden, or underlying disease outcome.',
        consequenceStateId: 'timeline-patency-proxy-corrected',
      },
    ],
  },
  consequenceStates: [
    {
      id: 'timeline-integrated-review',
      label: 'Integrated longitudinal review',
      summary:
        'Surveillance connects device findings to patient goals, treatment trajectory, procedure burden, and an explicit exit decision.',
      inspectionFindings: [
        'Complications are sought according to symptoms, architecture, anatomy, and treatment context.',
        'Technical patency and patient-experienced benefit are documented separately.',
        'The ongoing indication and retrieval or revision plan are revisited.',
      ],
      complicationIds: [
        'mucus-obstruction',
        'infection',
        'migration',
        'granulation',
        'tumor-ingrowth-overgrowth',
        'fracture',
        'cover-failure',
        'branch-obstruction',
      ],
      outcomeDomains: {
        'technical-patency': 'Airway caliber, device position, and branch preservation',
        'symptom-quality-of-life': 'Dyspnea, cough, function, and goal-concordant benefit',
        'reintervention-burden':
          'Urgent and planned procedures, clearance needs, and follow-up burden',
        'underlying-disease-outcome':
          'Response, progression, treatment trajectory, and competing illness',
      },
    },
    {
      id: 'timeline-patency-proxy-corrected',
      label: 'Patency-only endpoint corrected',
      summary:
        'The final grid keeps technical success from obscuring limited symptom benefit, repeated interventions, or disease progression.',
      inspectionFindings: [
        'Record technical findings without assuming they define quality of life.',
        'Count reinterventions and airway-clearance burden.',
        'Revisit the ongoing indication in the context of underlying disease.',
      ],
      complicationIds: [
        'mucus-obstruction',
        'infection',
        'migration',
        'granulation',
        'tumor-ingrowth-overgrowth',
        'fracture',
        'cover-failure',
        'branch-obstruction',
      ],
      outcomeDomains: {
        'technical-patency': 'Airway caliber, device position, and branch preservation',
        'symptom-quality-of-life': 'Symptoms, function, and goal-concordant benefit',
        'reintervention-burden': 'Repeat procedures and airway-clearance burden',
        'underlying-disease-outcome': 'Disease response, progression, and treatment trajectory',
      },
    },
  ],
  evidenceBoundary:
    'This sequence organizes surveillance domains and possible findings. It does not prescribe a universal interval, predict which complication will occur, or imply that airway patency determines survival or quality of life.',
  evidenceRefs: [
    'chest-cao-guideline-2024',
    'wabip-malignant-stenting-2024',
    'wabip-benign-stenting-2025',
    'ost-infection-granulation-2012',
    'chung-airway-fracture-2008',
    'textbook-sems-2025',
    'textbook-silicone-stents-2025',
    'textbook-stent-placement',
    'textbook-airway-stents-primer-2025',
  ],
  clinicalReviewStatus: 'draft',
}

export const mechanismScenarioRegistry = [
  siliconeCurveInvolution,
  coughInterfaceResponse,
  wholeYFitDeployment,
  longitudinalComplicationOutcomes,
] as const satisfies readonly MechanismScenario[]

export const mechanismScenarioById = Object.freeze(
  Object.fromEntries(
    mechanismScenarioRegistry.map((scenario) => [scenario.id, scenario]),
  ) as Record<MechanismScenarioId, MechanismScenario>,
)

export function getMechanismScenario(id: string): MechanismScenario {
  const scenario = (mechanismScenarioById as Readonly<Record<string, MechanismScenario>>)[id]
  if (!scenario) throw new Error(`Unknown airway-stent mechanism scenario: ${id}`)
  return scenario
}

export function validateMechanismScenarioRegistry(
  scenarios: readonly MechanismScenario[] = mechanismScenarioRegistry,
): string[] {
  const errors: string[] = []
  const scenarioIds = new Set<string>()

  for (const scenario of scenarios) {
    if (scenarioIds.has(scenario.id)) errors.push(`Duplicate scenario id: ${scenario.id}.`)
    scenarioIds.add(scenario.id)

    if (scenario.phases.length < 2) errors.push(`${scenario.id} requires at least two phases.`)
    if (scenario.architectureFamilies.length === 0) {
      errors.push(`${scenario.id} requires an architecture family.`)
    }
    if (
      scenario.completionPolicy === 'all-architecture-families' &&
      scenario.architectureFamilies.length < 2
    ) {
      errors.push(
        `${scenario.id} requires multiple architecture families for its completion policy.`,
      )
    }
    if (scenario.learnerPrompt.choices.length < 2) {
      errors.push(`${scenario.id} requires at least two prediction choices.`)
    }

    const phaseIds = new Set(scenario.phases.map((phase) => phase.id))
    const hotspotIds = new Set(scenario.hotspots.map((hotspot) => hotspot.id))
    const observationIds = new Set(scenario.observationPrompts.map((observation) => observation.id))
    const consequenceIds = new Set(scenario.consequenceStates.map((consequence) => consequence.id))

    for (const phase of scenario.phases) {
      if (!phase.reducedMotionText.trim()) {
        errors.push(`${scenario.id}/${phase.id} requires a text equivalent.`)
      }
      for (const hotspotId of phase.hotspotIds) {
        if (!hotspotIds.has(hotspotId)) {
          errors.push(`${scenario.id}/${phase.id} has unknown hotspot ${hotspotId}.`)
        }
      }
      for (const observationId of phase.requiredObservationIds ?? []) {
        if (!observationIds.has(observationId)) {
          errors.push(`${scenario.id}/${phase.id} has unknown observation ${observationId}.`)
        }
      }
    }

    for (const hotspot of scenario.hotspots) {
      for (const phaseId of hotspot.phaseIds) {
        if (!phaseIds.has(phaseId)) {
          errors.push(`${scenario.id}/${hotspot.id} has unknown phase ${phaseId}.`)
        }
      }
    }

    for (const choice of scenario.learnerPrompt.choices) {
      if (!consequenceIds.has(choice.consequenceStateId)) {
        errors.push(
          `${scenario.id}/${choice.id} has unknown consequence ${choice.consequenceStateId}.`,
        )
      }
    }

    for (const missingEvidenceId of findMissingEvidenceRefs(scenario.evidenceRefs)) {
      errors.push(`${scenario.id} has unresolved evidence ${missingEvidenceId}.`)
    }
  }

  return errors
}
