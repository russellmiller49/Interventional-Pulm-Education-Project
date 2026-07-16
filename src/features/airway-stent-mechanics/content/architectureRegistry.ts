import {
  STENT_ARCHITECTURE_IDS,
  type ArchitectureCapabilities,
  type StentArchitectureId,
  type StentArchitectureProfile,
  type StentLoadMode,
} from '../engine/learningLabTypes'
import { findMissingEvidenceRefs } from './evidenceRegistry'

const allTubularLoadModes = [
  'rest',
  'radial',
  'bend',
  'ovalization',
  'breathing',
  'cough',
  'deployment',
] as const satisfies readonly StentLoadMode[]

const solidWallCapabilities: ArchitectureCapabilities = {
  supportsBraidAngleControl: false,
  supportsCoverInspection: false,
  supportsDiameterRetention: true,
  supportsLengthChange: false,
  supportsTubularControls: true,
  isBifurcated: false,
  hasSlidingCrossings: false,
}

export const architectureRegistry: readonly StentArchitectureProfile[] = [
  {
    id: 'studded-silicone',
    label: 'Studded molded silicone',
    shortLabel: 'Studded silicone',
    family: 'Continuous-wall silicone',
    brandedExample: 'Dumon-style educational schematic',
    material: 'Molded medical silicone elastomer',
    expansionMechanism: 'molded-passive',
    coverage: 'integral-solid-wall',
    topologyLabel: 'Cylindrical wall with external studs',
    topologyDescription:
      'A continuous molded wall supplies the hoop and bending load paths. Discrete external studs alter contact and anchoring without becoming a wire scaffold.',
    loadPath:
      'Compression travels through the silicone wall; studs concentrate selected contact regions, while wall thickness and durometer influence whole-body recoil and bend behavior.',
    geometryBuilder: 'studded-cylinder',
    supportedLoadModes: allTubularLoadModes,
    capabilities: solidWallCapabilities,
    visualCalibration: {
      axialCoupling: 0.08,
      twistGain: 0.42,
      bendGain: 0.72,
      ovalizationGain: 0.68,
    },
    teachingPoints: [
      'Separate a solid wall from a covered wire scaffold: both block ingrowth, but their load paths differ.',
      'Studs change interface geometry and anchoring; they do not convert the device into a higher-force material.',
      'Planned removability and secretion burden belong in the same decision as support.',
    ],
    strengths: [
      'Continuous barrier to tissue ingrowth through the wall',
      'Can be removed and customized by experienced teams',
      'Stud geometry can add anchoring without a metallic lattice',
    ],
    tradeoffs: [
      'A relatively thick wall consumes functional lumen',
      'A smooth internal surface and disrupted mucociliary transport can promote secretion retention',
      'Poor fit can still produce migration or focal contact loading',
    ],
    limitations: [
      'The generic schematic is not exact Dumon CAD and does not encode product-specific durometer, wall thickness, stud geometry, or size.',
      'Visible deformation represents imposed motion, not measured force or clinical performance.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Removable central-airway support when a continuous wall and an ingrowth barrier are relevant to the defined job',
        'A customizable tubular architecture when anatomy, landing zones, and a future exit strategy have been considered together',
      ],
      deploymentConsiderations: [
        'Deployment approach, customization, and repositioning depend on device instructions, airway access, and local rigid-bronchoscopy expertise.',
        'Confirm that the selected length, diameter, and stud-bearing landing zones preserve nearby branch orifices.',
      ],
      removalConsiderations: [
        'Continuous silicone is generally considered removable, but dwell time, granulation, infection, and difficult access can increase removal complexity.',
        'A planned removal horizon should be documented before placement and revisited during surveillance.',
      ],
      tissueInterfaceConsiderations: [
        'The continuous wall broadens much of the tissue-facing surface while studs create discrete contact and anchoring regions.',
        'Curvature or landing-zone mismatch can shift contact toward studs, edges, or device ends.',
      ],
      secretionConsiderations: [
        'A continuous wall interrupts mucociliary transport and can contribute to retained secretions.',
        'The airway-clearance and surveillance plan should anticipate mucus at the wall, ends, and any adjacent pockets.',
      ],
      fitConsiderations: [
        'Assess landing-zone diameter, disease length, taper, curvature, and adjacent branches rather than treating nominal diameter as sufficient.',
        'Inspect apposition and both ends after the architecture is placed in the intended airway geometry.',
      ],
      failureModesToAnticipate: [
        'Migration or malposition when anchoring and fit are inadequate',
        'Mucus obstruction, focal end granulation, branch obstruction, or pressure-related mucosal injury',
      ],
    },
    evidenceRefs: ['chest-cao-guideline-2024', 'wabip-benign-stenting-2025', 'jung-gina-2021'],
  },
  {
    id: 'dynamic-d-silicone',
    label: 'Dynamic D-shaped silicone',
    shortLabel: 'Dynamic D-shape',
    family: 'Directional continuous-wall silicone',
    brandedExample: 'GINA stent sourced example',
    material: 'Molded medical silicone elastomer',
    expansionMechanism: 'molded-passive',
    coverage: 'integral-solid-wall',
    topologyLabel: 'D-shaped wall with a compliant posterior segment',
    topologyDescription:
      'A noncircular molded cross-section and directional surface features make orientation part of the architecture. The posterior segment is designed to deform differently from the supported arc.',
    loadPath:
      'The supported arc and posterior segment share imposed compression asymmetrically; directional rings or ridges provide an anchoring pathway distinct from whole-body compression.',
    geometryBuilder: 'dynamic-d-cylinder',
    supportedLoadModes: allTubularLoadModes,
    capabilities: solidWallCapabilities,
    visualCalibration: {
      axialCoupling: 0.06,
      twistGain: 0.48,
      bendGain: 0.94,
      ovalizationGain: 1.18,
    },
    teachingPoints: [
      'A lower whole-device compression force can coexist with stronger directional anchoring.',
      'Orientation-sensitive geometry can preserve dynamic area change while supporting selected walls.',
      'Bench results from one D-shaped design should not be generalized to every silicone stent.',
    ],
    strengths: [
      'Directional compliance can accommodate airway shape change',
      'Surface architecture can raise migration resistance independently of global compression force',
      'Continuous silicone remains a removable ingrowth barrier',
    ],
    tradeoffs: [
      'Orientation is mechanically meaningful',
      'The solid wall still interrupts mucociliary transport',
      'Compliance in one plane can permit ovalization under a different loading direction',
    ],
    limitations: [
      'GINA and Dumon measurements shown in this module belong to the cited sizes and fixtures.',
      'The animation exaggerates shape change for teaching and is not a validated airway simulation.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Removable continuous-wall support when directional geometry is relevant to the airway and the mechanical job',
        'An architecture for comparing directional anchoring and compliance without reducing the choice to a whole-body compression value',
      ],
      deploymentConsiderations: [
        'Orientation is part of deployment because the supported arc and compliant posterior segment are not interchangeable.',
        'Confirm rotational position, landing-zone contact, and branch patency using the selected device instructions and local expertise.',
      ],
      removalConsiderations: [
        'The continuous silicone wall supports a planned retrieval strategy, while dwell time and tissue response can still complicate removal.',
        'Reassessment should include whether directional orientation and the original indication remain appropriate as anatomy changes.',
      ],
      tissueInterfaceConsiderations: [
        'Directional rings, ridges, and the supported arc create a nonuniform interface that depends on rotational alignment.',
        'A stiffness transition or misorientation can shift contact toward ridges, edges, or device ends.',
      ],
      secretionConsiderations: [
        'The continuous wall can interrupt secretion transport despite its directional compliance.',
        'Inspect dependent surfaces, ends, and any gap created by cross-sectional mismatch for retained secretions.',
      ],
      fitConsiderations: [
        'Match the noncircular cross-section and orientation to airway shape, curvature, taper, and dynamic change.',
        'Nominal diameter alone does not establish alignment, apposition, or preservation of adjacent orifices.',
      ],
      failureModesToAnticipate: [
        'Rotational malposition, migration, or loss of intended directional support',
        'Focal ridge or end contact, mucus obstruction, granulation, or branch compromise',
      ],
    },
    evidenceRefs: ['jung-gina-2021', 'wabip-benign-stenting-2025'],
  },
  {
    id: 'silicone-y',
    label: 'Molded silicone Y-stent',
    shortLabel: 'Silicone Y',
    family: 'Bifurcated continuous-wall silicone',
    material: 'Molded medical silicone elastomer',
    expansionMechanism: 'molded-passive',
    coverage: 'integral-solid-wall',
    topologyLabel: 'Three-limb bifurcation with a carinal saddle',
    topologyDescription:
      'Tracheal and main-bronchial limbs meet at a molded junction. The carina and branch geometry contribute to fixation, while the saddle and limb ends create distinct contact zones.',
    loadPath:
      'Loads divide between the tracheal limb, two bronchial limbs, and the carinal saddle; branch angle mismatch can add bending and torsion that a straight-tube test cannot reproduce.',
    geometryBuilder: 'silicone-y',
    supportedLoadModes: ['rest', 'radial', 'bend', 'breathing', 'cough', 'deployment'],
    capabilities: {
      supportsBraidAngleControl: false,
      supportsCoverInspection: false,
      supportsDiameterRetention: false,
      supportsLengthChange: false,
      supportsTubularControls: false,
      isBifurcated: true,
      hasSlidingCrossings: false,
    },
    visualCalibration: {
      axialCoupling: 0,
      twistGain: 0.7,
      bendGain: 0.78,
      ovalizationGain: 0.54,
    },
    teachingPoints: [
      'Geometric fixation at a bifurcation is not equivalent to simply increasing radial support.',
      'Branch angle, limb length, diameter, and patency must be considered together.',
      'The junction can trade migration resistance for secretion and focal-contact burden.',
    ],
    strengths: [
      'Carinal geometry can provide strong positional fixation',
      'Continuous silicone permits planned removal',
      'Three limbs can support disease spanning the main carina',
    ],
    tradeoffs: [
      'Branch mismatch can load the carina or airway ends',
      'The saddle and limb junctions can collect secretions',
      'A bifurcated device requires anatomy-specific planning beyond straight-tube sizing',
    ],
    limitations: [
      'Straight-tube diameter-retention and length-change metrics are intentionally hidden.',
      'The generic Y schematic is not an exact CAD model and does not encode patient anatomy.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Support across the main carina when tracheal and both main-bronchial pathways belong to the mechanical job',
        'Bifurcated coverage when carinal fixation, branch preservation, and removability must be considered together',
      ],
      deploymentConsiderations: [
        'The deployment plan must account for the tracheal limb, both bronchial limbs, and the carinal saddle as one coupled geometry.',
        'Confirm limb orientation, distal patency, and the relationship of each end to lobar and segmental orifices.',
      ],
      removalConsiderations: [
        'Molded silicone permits a planned retrieval strategy, but carinal seating, secretions, granulation, and dwell time can complicate manipulation.',
        'Surveillance should reassess the continuing need for all three limbs rather than only the tracheal segment.',
      ],
      tissueInterfaceConsiderations: [
        'The carinal saddle, junction, and three limb ends create distinct contact zones.',
        'Angle or length mismatch can transmit bending and torsion to the carina or distal landing zones.',
      ],
      secretionConsiderations: [
        'The saddle and limb junctions can form secretion pockets while each continuous wall interrupts local clearance.',
        'The airway-clearance plan should address both main bronchi and the central junction.',
      ],
      fitConsiderations: [
        'Assess tracheal and bronchial diameters, limb lengths, branch angles, the carinal saddle, and distal airway patency as a whole-Y fit.',
        'A satisfactory tracheal fit does not establish appropriate bronchial-limb alignment or length.',
      ],
      failureModesToAnticipate: [
        'Carinal or limb mismatch with focal contact, malposition, or distal branch obstruction',
        'Mucus obstruction, end granulation, migration, or loss of patency in one limb',
      ],
    },
    evidenceRefs: [
      'chest-cao-guideline-2024',
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
    ],
  },
  {
    id: 'free-crossing-braid',
    label: 'Free-crossing multiwire braid',
    shortLabel: 'Free braid',
    family: 'Uncovered self-expanding braid',
    material: 'Multiple superelastic metallic wires',
    expansionMechanism: 'self-expanding-superelastic',
    coverage: 'uncovered',
    topologyLabel: 'Opposed helical wire families with sliding crossings',
    topologyDescription:
      'Multiple clockwise and counter-clockwise helices cross without fixed junctions. Wire angle, diameter, count, and crossing friction couple radial change to length and twist.',
    loadPath:
      'Imposed diameter change redistributes bending and contact along many wires; sliding at crossings permits reconfiguration but introduces friction and possible fretting.',
    geometryBuilder: 'free-crossing-helices',
    supportedLoadModes: allTubularLoadModes,
    capabilities: {
      supportsBraidAngleControl: true,
      supportsCoverInspection: false,
      supportsDiameterRetention: true,
      supportsLengthChange: true,
      supportsTubularControls: true,
      isBifurcated: false,
      hasSlidingCrossings: true,
    },
    visualCalibration: {
      axialCoupling: 1.05,
      twistGain: 1.08,
      bendGain: 0.96,
      ovalizationGain: 0.88,
    },
    teachingPoints: [
      'Braid angle links diameter and length even before material force is considered.',
      'Free crossings permit reconfiguration; friction changes hysteresis and load sharing.',
      'An uncovered mesh adds tissue incorporation to the mechanical decision.',
    ],
    strengths: [
      'Multiple wires distribute load and provide structural redundancy',
      'Thin open cells preserve lumen-to-wall ratio',
      'The braid can conform through crossing motion',
    ],
    tradeoffs: [
      'Diameter change is coupled to length change',
      'Crossing friction can produce hysteresis and fretting',
      'Uncovered cells permit tissue ingrowth and can complicate removal',
    ],
    limitations: [
      'The educational braid relation assumes inextensible wires and idealized constant turns.',
      'No force, tissue pressure, friction coefficient, or device-specific wire dimension is modeled.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Open-cell self-expanding support when a continuous sealing surface is not part of the defined job',
        'A teaching architecture for examining how braid angle, sliding crossings, and tissue incorporation affect the plan',
      ],
      deploymentConsiderations: [
        'Diameter change is coupled to length change, so deployment planning must anticipate final end position and branch relationships.',
        'Expansion, crossing motion, and final apposition should be assessed under the intended airway curvature and constraint.',
      ],
      removalConsiderations: [
        'Exposed cells permit tissue incorporation that can make later removal increasingly difficult.',
        'The expected time horizon and feasibility of retrieval are central constraints rather than follow-up details.',
      ],
      tissueInterfaceConsiderations: [
        'Individual wires, crossings, and uncovered cells create a discontinuous contact surface with pathways for ingrowth.',
        'Sliding crossings can redistribute deformation while adding friction, fretting, and repeated local motion.',
      ],
      secretionConsiderations: [
        'Open cells do not remove secretion risk; retained material can still collect around irregular contact zones and incorporated tissue.',
        'Surveillance should consider mucus, infection, and tissue overgrowth together when patency worsens.',
      ],
      fitConsiderations: [
        'Account for diameter-length coupling, taper, curvature, landing zones, and the location of exposed cells relative to disease and branches.',
        'A straight unloaded appearance does not establish conformity or stable end position in a curved airway.',
      ],
      failureModesToAnticipate: [
        'Tissue ingrowth or overgrowth, difficult removal, migration, or deployment-related end mismatch',
        'Fretting or fracture, focal wire or end contact, mucus obstruction, or branch compromise',
      ],
      caseExclusions: [
        'This uncovered architecture should not be treated as a default answer when planned retrieval or a continuous sealing surface is required.',
      ],
      teachingOnly: true,
    },
    evidenceRefs: [
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
      'ratnovsky-airway-mechanics-2015',
      'mckenna-covered-braid-2021',
      'pelton-nitinol-fatigue-2008',
    ],
  },
  {
    id: 'hook-cross-covered',
    label: 'Covered hook-and-cross captured braid',
    shortLabel: 'Hook-and-cross',
    family: 'Covered self-expanding wire scaffold',
    brandedExample: 'BONASTENT sourced example',
    material: 'Superelastic metallic wires with a silicone membrane',
    expansionMechanism: 'self-expanding-superelastic',
    coverage: 'fully-covered',
    topologyLabel: 'Hook-and-cross woven cells with a full cover',
    topologyDescription:
      'Alternating hooked junctions and simple over-under crosses create a woven diamond-cell scaffold. A continuous membrane spans the scaffold.',
    loadPath:
      'Hooked junctions constrain selected nodes while simple crosses preserve the woven load path; the cover shares deformation and changes the tissue-facing contact surface.',
    geometryBuilder: 'hook-cross-captured-helices',
    supportedLoadModes: allTubularLoadModes,
    capabilities: {
      supportsBraidAngleControl: true,
      supportsCoverInspection: true,
      supportsDiameterRetention: true,
      supportsLengthChange: true,
      supportsTubularControls: true,
      isBifurcated: false,
      hasSlidingCrossings: false,
    },
    visualCalibration: {
      axialCoupling: 0.75,
      twistGain: 0.72,
      bendGain: 0.84,
      ovalizationGain: 0.74,
    },
    teachingPoints: [
      'Captured crossings create a different load path from a free braid, even when both look woven.',
      'A cover can distribute surface contact and block ingrowth while adding membrane mechanics.',
      'Hiding the cover in the lab is an inspection view, not a change to the device configuration.',
    ],
    strengths: [
      'Full coverage blocks tissue ingrowth through the cells',
      'Captured crossings can stabilize the lattice pattern',
      'A thin wire scaffold preserves more lumen than a thick solid wall',
    ],
    tradeoffs: [
      'The membrane can crease, abrade, or alter radial response',
      'Coverage interrupts mucociliary transport and can increase secretion burden',
      'Ends and captured junctions can concentrate cyclic deformation',
    ],
    limitations: [
      'The schematic illustrates the hook-and-cross concept and is not exact BONASTENT CAD.',
      'FDA device descriptions establish topology and labeled use, not comparative superiority.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Covered self-expanding support when a continuous surface is relevant to sealing or limiting ingrowth through the scaffold',
        'An architecture for considering captured-cell stability, membrane behavior, airway fit, and a future retrieval strategy together',
      ],
      deploymentConsiderations: [
        'Captured crossings and the cover can couple diameter, length, and final end position during deployment.',
        'Confirm apposition, cover integrity, branch patency, and landing-zone position using device-specific instructions.',
      ],
      removalConsiderations: [
        'Full coverage limits ingrowth through the cells but does not prevent end granulation or other tissue responses that can complicate retrieval.',
        'Dwell time, infection, fit, and the ongoing indication should be reassessed before exchange or removal planning.',
      ],
      tissueInterfaceConsiderations: [
        'The membrane creates a continuous tissue-facing surface while captured junctions and device ends remain possible focal-transition zones.',
        'Cover creasing, junction stiffness, or curvature mismatch can redistribute contact and repeated motion.',
      ],
      secretionConsiderations: [
        'The covered surface interrupts mucociliary transport and can retain secretions along the wall or at the ends.',
        'Inspection should include cover folds, dependent regions, and any gaps between the device and airway.',
      ],
      fitConsiderations: [
        'Assess taper, curvature, eccentric compression, landing zones, and diameter-length coupling rather than relying on nominal dimensions alone.',
        'A covered scaffold that opens centrally can still gap, straighten, or contact an end in a curved segment.',
      ],
      failureModesToAnticipate: [
        'Migration, malposition, focal end granulation, mucus obstruction, or branch obstruction',
        'Cover crease, abrasion, tear, delamination, or cyclic scaffold failure',
      ],
    },
    evidenceRefs: [
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
      'fda-bonastent-k140472',
      'ratnovsky-airway-mechanics-2015',
      'mckenna-covered-braid-2021',
    ],
  },
  {
    id: 'laser-cut-covered',
    label: 'Covered laser-cut lattice',
    shortLabel: 'Laser-cut lattice',
    family: 'Covered segmented self-expanding scaffold',
    brandedExample: 'AERO sourced example',
    material: 'Laser-cut nitinol with a polymer cover',
    expansionMechanism: 'self-expanding-superelastic',
    coverage: 'fully-covered',
    topologyLabel: 'Cut rings joined by discrete connectors',
    topologyDescription:
      'Repeating cut-strut rings are linked by deliberate connectors. The scaffold contains no braided crossings, so braid-angle controls are inapplicable.',
    loadPath:
      'Each ring carries local circumferential deformation; connectors transfer bending and axial motion between rings and can act as hinges or cyclic hot spots.',
    geometryBuilder: 'laser-cut-rings',
    supportedLoadModes: allTubularLoadModes,
    capabilities: {
      supportsBraidAngleControl: false,
      supportsCoverInspection: true,
      supportsDiameterRetention: true,
      supportsLengthChange: true,
      supportsTubularControls: true,
      isBifurcated: false,
      hasSlidingCrossings: false,
    },
    visualCalibration: {
      axialCoupling: 0.18,
      twistGain: 0.54,
      bendGain: 0.62,
      ovalizationGain: 0.64,
    },
    teachingPoints: [
      'Laser-cut rings and connectors are not a braid and should never receive braid controls.',
      'Connector placement can tune segmental behavior while creating strain concentrations.',
      'Low visible length coupling does not prove low tissue load or high fatigue life.',
    ],
    strengths: [
      'Predictable repeating cell and connector placement',
      'Relatively low diameter-length coupling compared with a free braid',
      'A full cover blocks ingrowth through the lattice',
    ],
    tradeoffs: [
      'Connectors can concentrate bending and cyclic strain',
      'A covered surface changes secretion transport and friction',
      'A segmented lattice can straighten or gap in a curve depending on connector layout',
    ],
    limitations: [
      'The generic ring lattice is not exact AERO CAD and does not reproduce proprietary dimensions.',
      'Manufacturer feature descriptions are labeled as sourced examples, not independent rankings.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Covered self-expanding support when a continuous surface and segmental ring-and-connector behavior are relevant to the job',
        'An architecture for comparing predictable cell placement with curvature, interface, secretion, and retrieval tradeoffs',
      ],
      deploymentConsiderations: [
        'Ring and connector geometry can create segmental expansion and bending behavior during release.',
        'Confirm final end position, apposition, cover integrity, and adjacent branch patency using device-specific instructions.',
      ],
      removalConsiderations: [
        'Coverage limits ingrowth through the lattice, while end response, dwell time, infection, and access can still complicate retrieval.',
        'A retrieval or exchange strategy should remain linked to surveillance and the expected treatment horizon.',
      ],
      tissueInterfaceConsiderations: [
        'The cover broadens the tissue-facing surface, while rings, connectors, and device ends create stiffness transitions beneath it.',
        'Connector layout and straightening tendency can shift contact in curves even when the central lumen remains open.',
      ],
      secretionConsiderations: [
        'A continuous covered surface can impair local clearance and collect secretions at folds, gaps, or ends.',
        'Recurrent obstruction should prompt evaluation for mucus and infection as well as structural or tissue causes.',
      ],
      fitConsiderations: [
        'Assess curvature, taper, eccentric compression, landing zones, and connector behavior across the full treated segment.',
        'Inspect inner-curve gapping, outer-curve contact, straightening, and both ends rather than inferring fit from radial opening alone.',
      ],
      failureModesToAnticipate: [
        'Migration, end granulation, mucus obstruction, branch compromise, or curve-related gapping and contact',
        'Connector or strut fracture, cover tear or delamination, and loss of intended support',
      ],
    },
    evidenceRefs: [
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
      'merit-aero-official',
      'ratnovsky-airway-mechanics-2015',
      'chung-airway-fracture-2008',
      'pelton-nitinol-fatigue-2008',
    ],
  },
  {
    id: 'single-wire-knit-partial-cover',
    label: 'Single-wire knitted scaffold with partial cover',
    shortLabel: 'Single-wire knit',
    family: 'Partially covered self-expanding knit',
    brandedExample: 'Ultraflex sourced example',
    material: 'One continuous nitinol wire with a midsection silicone cover',
    expansionMechanism: 'self-expanding-superelastic',
    coverage: 'partially-covered',
    topologyLabel: 'One continuous strand formed into interwoven circumferential loops',
    topologyDescription:
      'A single nitinol strand forms a continuous series of knitted or interwoven loops. The midsection cover leaves end cells uncovered in the sourced partially covered configuration.',
    loadPath:
      'Local loop opening and strand bending propagate along one continuous wire path; a partial cover changes the central surface while leaving uncovered end interfaces.',
    geometryBuilder: 'single-wire-knitted-loops',
    supportedLoadModes: allTubularLoadModes,
    capabilities: {
      supportsBraidAngleControl: false,
      supportsCoverInspection: true,
      supportsDiameterRetention: true,
      supportsLengthChange: true,
      supportsTubularControls: true,
      isBifurcated: false,
      hasSlidingCrossings: false,
    },
    visualCalibration: {
      axialCoupling: 0.9,
      twistGain: 0.9,
      bendGain: 1.04,
      ovalizationGain: 0.94,
    },
    teachingPoints: [
      'One continuous knitted strand is topologically different from a multiwire braid.',
      'Partial coverage creates different tissue interfaces at the midsection and exposed ends.',
      'Loop deformation can preserve flexibility while coupling changes along the continuous wire.',
    ],
    strengths: [
      'A continuous single-wire path avoids discrete ring connectors',
      'Interwoven loops permit flexible local deformation',
      'A covered midsection can limit ingrowth where the cover is present',
    ],
    tradeoffs: [
      'Uncovered ends remain available for tissue incorporation',
      'Loop and cover behavior remains coupled to diameter and length',
      'A continuous path can transmit local deformation beyond the loaded segment',
    ],
    limitations: [
      'The schematic demonstrates continuity and partial coverage; it is not exact Ultraflex CAD.',
      'The FDA summary supports construction and labeled indication, not cross-device outcomes.',
    ],
    clinicalConsiderations: {
      commonRoles: [
        'Partially covered self-expanding support when a central barrier and intentionally exposed end interfaces are both considered',
        'An architecture for examining how one continuous wire path and coverage transitions affect fit, tissue response, and removability',
      ],
      deploymentConsiderations: [
        'Loop deformation and diameter-length coupling can change final end position during release.',
        'Confirm where the covered midsection, cover transitions, and exposed ends lie relative to disease, landing zones, and branches.',
      ],
      removalConsiderations: [
        'Exposed end cells can incorporate into tissue and make later removal more difficult despite central coverage.',
        'The time horizon and consequences of end incorporation should be explicit in the initial plan and surveillance strategy.',
      ],
      tissueInterfaceConsiderations: [
        'The covered midsection, cover transitions, and exposed knitted ends form three distinct tissue interfaces.',
        'Local loop opening and continuous-wire load transmission can move deformation beyond the visibly loaded segment.',
      ],
      secretionConsiderations: [
        'The covered midsection can impair secretion transport, while transition zones and exposed loops can create irregular collection sites.',
        'Mucus, infection, ingrowth, and granulation may coexist when patency worsens.',
      ],
      fitConsiderations: [
        'Assess the full length, curvature, taper, landing zones, and placement of both coverage transitions and exposed ends.',
        'Central apposition does not establish acceptable end contact, branch preservation, or later removability.',
      ],
      failureModesToAnticipate: [
        'End ingrowth or granulation, difficult removal, migration, mucus obstruction, or branch compromise',
        'Cover-transition wear, cover failure, loop deformation, or continuous-wire fatigue',
      ],
      caseExclusions: [
        'Central coverage should not be interpreted as a fully covered or readily removable interface when end cells remain exposed.',
      ],
    },
    evidenceRefs: [
      'wabip-malignant-stenting-2024',
      'wabip-benign-stenting-2025',
      'fda-ultraflex-k230269',
      'chung-airway-fracture-2008',
      'pelton-nitinol-fatigue-2008',
    ],
  },
]

export const architectureById: Readonly<Record<StentArchitectureId, StentArchitectureProfile>> =
  Object.freeze(
    Object.fromEntries(
      architectureRegistry.map((profile) => [profile.id, profile]),
    ) as unknown as Record<StentArchitectureId, StentArchitectureProfile>,
  )

export function getArchitectureProfile(id: StentArchitectureId): StentArchitectureProfile
export function getArchitectureProfile(id: string): StentArchitectureProfile
export function getArchitectureProfile(id: string): StentArchitectureProfile {
  const profile = (architectureById as Readonly<Record<string, StentArchitectureProfile>>)[id]
  if (!profile) {
    throw new Error(`Unknown airway-stent architecture: ${id}`)
  }
  return profile
}

export function getArchitectureCapabilities(id: StentArchitectureId): ArchitectureCapabilities {
  return getArchitectureProfile(id).capabilities
}

export function supportsLoadMode(
  architecture: StentArchitectureId | StentArchitectureProfile,
  mode: StentLoadMode,
): boolean {
  const profile =
    typeof architecture === 'string' ? getArchitectureProfile(architecture) : architecture
  return profile.supportedLoadModes.includes(mode)
}

export function getArchitecturesForLoadMode(mode: StentLoadMode): StentArchitectureProfile[] {
  return architectureRegistry.filter((profile) =>
    (profile.supportedLoadModes as readonly StentLoadMode[]).includes(mode),
  )
}

export function validateArchitectureRegistry(): string[] {
  const errors: string[] = []
  const ids = architectureRegistry.map((profile) => profile.id)

  if (new Set(ids).size !== ids.length) {
    errors.push('Architecture IDs must be unique.')
  }

  const missingArchitectureIds = STENT_ARCHITECTURE_IDS.filter((id) => !ids.includes(id))
  if (missingArchitectureIds.length > 0) {
    errors.push(`Missing architecture profiles: ${missingArchitectureIds.join(', ')}`)
  }

  for (const profile of architectureRegistry) {
    const missingRefs = findMissingEvidenceRefs(profile.evidenceRefs)
    if (missingRefs.length > 0) {
      errors.push(`${profile.id} has unresolved evidence: ${missingRefs.join(', ')}`)
    }
    if (!(profile.supportedLoadModes as readonly StentLoadMode[]).includes('rest')) {
      errors.push(`${profile.id} must support the rest load mode.`)
    }
    if (profile.coverage === 'uncovered' && profile.capabilities.supportsCoverInspection) {
      errors.push(`${profile.id} cannot inspect a cover because it is uncovered.`)
    }
    if (profile.capabilities.isBifurcated && profile.capabilities.supportsTubularControls) {
      errors.push(`${profile.id} cannot expose straight-tube controls when bifurcated.`)
    }
    if (
      profile.capabilities.supportsBraidAngleControl &&
      !['free-crossing-helices', 'hook-cross-captured-helices'].includes(profile.geometryBuilder)
    ) {
      errors.push(`${profile.id} exposes braid angle for a non-braided topology.`)
    }
  }

  return errors
}
