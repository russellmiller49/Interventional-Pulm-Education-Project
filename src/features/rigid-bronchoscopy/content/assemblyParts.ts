import { resolveModuleAssetPath } from '@/lib/module-assets'

export type AssemblyPartId = string

export type AssemblyVector3 = readonly [number, number, number]

export interface AssemblyTransform {
  position: AssemblyVector3
  rotation: AssemblyVector3
  scale?: number | AssemblyVector3
}

export type AssemblyPartCategory = 'core' | 'tube' | 'tool'

export type AssemblySourceType =
  | 'manufacturer'
  | 'manufacturer-dimensions-photo-derived-geometry'
  | 'manufacturer-dimensions-educational-geometry'
  | 'manufacturer-exemplar-generic-geometry'
  | 'reference-photo-educational-approximation'

export interface AssemblyPartSource {
  label: string
  url: string
  note?: string
}

export interface AssemblyPartDefinition {
  id: AssemblyPartId
  nodeName: string
  label: string
  shortLabel?: string
  description: string
  function?: string
  category: AssemblyPartCategory
  prerequisites?: readonly AssemblyPartId[]
  start: AssemblyTransform
  target: AssemblyTransform
  snapDistance?: number
  interactionRadius?: number
  innerDiameterMm?: number
  outerDiameterMm?: number
  tubeType?: 'bronchial' | 'tracheal'
  hasDistalFenestrations?: boolean
  workingLengthMm?: number
  color?: string
  specs?: readonly string[]
  safetyNote?: string
  sourceType: AssemblySourceType
  source: AssemblyPartSource
  individualAssetPath: string
}

export const ASSEMBLY_KIT_ASSET_PATH = resolveModuleAssetPath(
  '/models/rigid-bronchoscopy/assembly/rigid-bronchoscopy-assembly-kit.glb',
)

export const ASSEMBLY_BASE_PART_ID = 'adult-universal-base'
export const ANY_TUBE_PREREQUISITE_ID = 'any-tube'

export const assemblySourceIds = [
  'efer-ordering-information',
  'efer-user-manual',
  'efer-forceps',
  'efer-endoscope',
  'stryker-camera-systems',
  'karl-storz-light-cable',
] as const

const COMPONENT_ASSET_ROOT = '/models/rigid-bronchoscopy/assembly/components'
const HOOD_ORDERING_URL = 'https://hoodlabs.com/efer-bronchoscope-ordering-information/'
const HOOD_USER_MANUAL_URL =
  'https://hoodlabs.com/wp-content/uploads/EFER-BRONCHOSCOPE-USER-MANUAL.pdf'
const HOOD_FORCEPS_URL = 'https://hoodlabs.com/efer-bronchoscope-forceps/'
const HOOD_ENDOSCOPE_URL = 'https://hoodlabs.com/efer-bronchoscope-endoscope/'
const STRYKER_CAMERA_URL =
  'https://www.stryker.com/us/en/portfolios/medical-surgical-equipment/surgical-visualization/camera-systems.html'
const KARL_STORZ_LIGHT_CABLE_URL =
  'https://www.karlstorz.com/us/en/product-detail-page.htm?cat=1000071971&productID=1000060267'

const AXIAL_ROTATION: AssemblyVector3 = [0, -Math.PI / 2, 0]
const DOUBLE_GATE_OBTURATOR_ROTATION: AssemblyVector3 = [1.122192283, 0.354522903, 1.736358719]
const LIGHT_GUIDE_ROTATION: AssemblyVector3 = [-Math.PI / 2, 0, 0]
const MAIN_CAP_ROTATION: AssemblyVector3 = [0, 0, 0]

const baseSource: AssemblyPartSource = {
  label: 'Hood Laboratories EFER-DUMON ordering information',
  url: HOOD_ORDERING_URL,
  note: 'Port proportions and angles in the teaching geometry are photo-derived approximations.',
}

const adultUniversalBase: AssemblyPartDefinition = {
  id: ASSEMBLY_BASE_PART_ID,
  nodeName: 'Adult_Universal_Base_BD2410_3',
  label: 'BD2410-3 adult universal base',
  shortLabel: 'Universal base',
  description:
    'The fixed proximal body receives the selected ventilating tube, lateral obturator, silicone cap, telescope, and ventilation connections.',
  function: 'Provides the common proximal interface and patent main and lateral pathways.',
  category: 'core',
  prerequisites: [],
  start: { position: [-2.1, -0.3, 0], rotation: AXIAL_ROTATION, scale: 9 },
  target: { position: [-2.1, -0.3, 0], rotation: AXIAL_ROTATION, scale: 9 },
  snapDistance: 0,
  specs: ['Part number BD2410-3', 'Adult universal base'],
  safetyNote:
    'Port identity, cap selection, and ventilation setup must be confirmed against the exact device IFU before clinical use.',
  sourceType: 'manufacturer-dimensions-photo-derived-geometry',
  source: baseSource,
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/bd2410-3-adult-universal-base.glb`,
}

interface TubePartInput {
  id: AssemblyPartId
  nodeName: string
  partNumber: string
  tubeType: 'bronchial' | 'tracheal'
  outerDiameterMm: number
  innerDiameterMm: number
  workingLengthMm: number
  colorName: string
  color: string
  filename: string
}

function createTubePart(input: TubePartInput): AssemblyPartDefinition {
  const typeLabel = input.tubeType === 'bronchial' ? 'Bronchial' : 'Tracheal'

  return {
    id: input.id,
    nodeName: input.nodeName,
    label: `${input.partNumber} adult ${input.tubeType} tube — ${input.outerDiameterMm.toFixed(2)}/${input.innerDiameterMm.toFixed(2)} mm`,
    shortLabel: `${input.partNumber} · ${input.outerDiameterMm.toFixed(1)}/${input.innerDiameterMm.toFixed(1)} mm`,
    description: `${typeLabel} ventilating tube with a patent central lumen, distal safety stop, depth markings, and a quarter-turn proximal connector.`,
    function:
      input.tubeType === 'bronchial'
        ? 'Forms the main airway conduit; the longer bronchial pattern is designed for more distal positioning than a tracheal tube.'
        : 'Forms the main airway conduit with the shorter tracheal working length.',
    category: 'tube',
    prerequisites: [ASSEMBLY_BASE_PART_ID],
    start: { position: [-0.65, 1.55, 0], rotation: AXIAL_ROTATION, scale: 9 },
    target: { position: [-1.64, -0.3, 0], rotation: AXIAL_ROTATION, scale: 9 },
    snapDistance: 0.72,
    innerDiameterMm: input.innerDiameterMm,
    outerDiameterMm: input.outerDiameterMm,
    tubeType: input.tubeType,
    hasDistalFenestrations: input.tubeType === 'bronchial',
    workingLengthMm: input.workingLengthMm,
    color: input.color,
    specs: [
      `${input.outerDiameterMm.toFixed(2)} mm outer diameter`,
      `${input.innerDiameterMm.toFixed(2)} mm inner diameter`,
      `${input.workingLengthMm} mm working length`,
      `${input.colorName} size code`,
    ],
    safetyNote:
      'Tube selection and depth are educational here. Actual sizing and placement depend on anatomy, the exact device, procedural conditions, and operator judgment.',
    sourceType: 'manufacturer',
    source: {
      label: 'Hood Laboratories EFER-DUMON ordering information',
      url: HOOD_ORDERING_URL,
      note: 'Tube dimensions and color coding are manufacturer-published values.',
    },
    individualAssetPath: `${COMPONENT_ASSET_ROOT}/${input.filename}`,
  }
}

/**
 * All nine ventilating tubes segmented from the corrected teaching set.
 * BT2103-3 is the initial UI selection, but no option is presented as clinically preferred.
 */
export const bronchoscopeTubeOptions: readonly AssemblyPartDefinition[] = [
  createTubePart({
    id: 'tube-bt2000-3',
    nodeName: 'BT2000_3_Adult_bronchial_tube_13.20_12.20_mm',
    partNumber: 'BT2000-3',
    tubeType: 'bronchial',
    outerDiameterMm: 13.2,
    innerDiameterMm: 12.2,
    workingLengthMm: 360,
    colorName: 'orange',
    color: '#f97316',
    filename: 'bt2000-3-bronchial-tube-od13p20-id12p20mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2101-3',
    nodeName: 'BT2101_3_Adult_bronchial_tube_12.00_11.00_mm',
    partNumber: 'BT2101-3',
    tubeType: 'bronchial',
    outerDiameterMm: 12,
    innerDiameterMm: 11,
    workingLengthMm: 360,
    colorName: 'black',
    color: '#27272a',
    filename: 'bt2101-3-bronchial-tube-od12p00-id11p00mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2103-3',
    nodeName: 'BT2103_3_Adult_bronchial_tube_10.00_9.20_mm',
    partNumber: 'BT2103-3',
    tubeType: 'bronchial',
    outerDiameterMm: 10,
    innerDiameterMm: 9.2,
    workingLengthMm: 360,
    colorName: 'red',
    color: '#dc2626',
    filename: 'bt2103-3-bronchial-tube-od10p00-id9p20mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2105-3',
    nodeName: 'BT2105_3_Adult_bronchial_tube_8.00_7.00_mm',
    partNumber: 'BT2105-3',
    tubeType: 'bronchial',
    outerDiameterMm: 8,
    innerDiameterMm: 7,
    workingLengthMm: 360,
    colorName: 'green',
    color: '#16a34a',
    filename: 'bt2105-3-bronchial-tube-od8p00-id7p00mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2106-3',
    nodeName: 'BT2106_3_Adult_bronchial_tube_7.00_6.50_mm',
    partNumber: 'BT2106-3',
    tubeType: 'bronchial',
    outerDiameterMm: 7,
    innerDiameterMm: 6.5,
    workingLengthMm: 360,
    colorName: 'blue',
    color: '#2563eb',
    filename: 'bt2106-3-bronchial-tube-od7p00-id6p50mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2201-3',
    nodeName: 'BT2201_3_Adult_tracheal_tube_12.00_11.00_mm',
    partNumber: 'BT2201-3',
    tubeType: 'tracheal',
    outerDiameterMm: 12,
    innerDiameterMm: 11,
    workingLengthMm: 260,
    colorName: 'black',
    color: '#27272a',
    filename: 'bt2201-3-tracheal-tube-od12p00-id11p00mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2203-3',
    nodeName: 'BT2203_3_Adult_tracheal_tube_10.00_9.20_mm',
    partNumber: 'BT2203-3',
    tubeType: 'tracheal',
    outerDiameterMm: 10,
    innerDiameterMm: 9.2,
    workingLengthMm: 260,
    colorName: 'red',
    color: '#dc2626',
    filename: 'bt2203-3-tracheal-tube-od10p00-id9p20mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2205-3',
    nodeName: 'BT2205_3_Adult_tracheal_tube_8.00_7.00_mm',
    partNumber: 'BT2205-3',
    tubeType: 'tracheal',
    outerDiameterMm: 8,
    innerDiameterMm: 7,
    workingLengthMm: 260,
    colorName: 'green',
    color: '#16a34a',
    filename: 'bt2205-3-tracheal-tube-od8p00-id7p00mm.glb',
  }),
  createTubePart({
    id: 'tube-bt2210-3',
    nodeName: 'BT2210_3_Adult_tracheal_tube_13.20_12.20_mm',
    partNumber: 'BT2210-3',
    tubeType: 'tracheal',
    outerDiameterMm: 13.2,
    innerDiameterMm: 12.2,
    workingLengthMm: 260,
    colorName: 'yellow',
    color: '#eab308',
    filename: 'bt2210-3-tracheal-tube-od13p20-id12p20mm.glb',
  }),
]

const doubleGateLateralObturator: AssemblyPartDefinition = {
  id: 'double-gate-lateral-obturator',
  nodeName: 'Lateral_Obturator_Two_Gates_BB2402_3',
  label: 'BB2402-3 double-gate lateral obturator',
  shortLabel: 'Double-gate obturator',
  description:
    'A removable lateral adapter with two patent instrument gates that mates with the small angled port on the universal base.',
  function: 'Provides two valved lateral access pathways while helping limit gas leakage.',
  category: 'core',
  prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID],
  start: {
    position: [-3.25, 1.25, 0],
    rotation: DOUBLE_GATE_OBTURATOR_ROTATION,
    scale: 9,
  },
  target: {
    position: [-2.415357384, 0.182843948, -0.009],
    rotation: DOUBLE_GATE_OBTURATOR_ROTATION,
    scale: 9,
  },
  snapDistance: 0.62,
  color: '#2563eb',
  specs: ['Part number BB2402-3', 'Two functional instrument gates'],
  safetyNote: 'Gate configuration and sealing must be checked against the exact device and IFU.',
  sourceType: 'manufacturer',
  source: baseSource,
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/bb2402-3-lateral-obturator-double-gate.glb`,
}

const redMainCap: AssemblyPartDefinition = {
  id: 'red-main-cap-5p5mm',
  nodeName: 'Main_Cap_BS2303_3_Red_5_5mm',
  label: 'BS2303-3 red main cap for 5.5 mm telescope',
  shortLabel: 'Red telescope cap',
  description:
    'A 25 mm red silicone cap with a 5.5 mm telescope opening, shown on the rear axial port for this guided configuration.',
  function: 'Seals around the telescope shaft at the axial port.',
  category: 'core',
  prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID, doubleGateLateralObturator.id],
  start: { position: [-3.6, 0.55, 0], rotation: MAIN_CAP_ROTATION, scale: 9 },
  target: { position: [-2.5725, -0.3, 0], rotation: MAIN_CAP_ROTATION, scale: 9 },
  snapDistance: 0.52,
  color: '#dc2626',
  specs: ['Part number BS2303-3', '25 mm cap', '5.5 mm telescope opening'],
  safetyNote: 'Cap choice is configuration-specific; verify the telescope and cap combination.',
  sourceType: 'manufacturer',
  source: baseSource,
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/bs2303-3-main-cap-red-5p5mm.glb`,
}

const rigidTelescope: AssemblyPartDefinition = {
  id: 'rigid-telescope-bx5500-fa',
  nodeName: 'Autoclavable_Bronchial_Endoscope_BX5500_FA',
  label: 'BX-5500-FA 5.5 mm 0° rigid telescope',
  shortLabel: 'Rigid telescope',
  description:
    'A sealed rod-lens telescope that passes axially through the red cap and bronchoscope lumen; the optical shaft is not an airway lumen.',
  function: 'Provides forward-view visualization and a proximal ocular/light-guide interface.',
  category: 'core',
  prerequisites: [redMainCap.id],
  start: { position: [-1.65, -1.65, 0], rotation: AXIAL_ROTATION, scale: 9 },
  target: { position: [-2.65, -0.3, 0], rotation: AXIAL_ROTATION, scale: 9 },
  snapDistance: 0.76,
  specs: ['5.5 mm outer diameter', '0° direction of view'],
  safetyNote:
    'The modeled shaft length is an educational estimate because the current product page does not publish a working length; verify the current catalog or IFU.',
  sourceType: 'manufacturer-dimensions-educational-geometry',
  source: {
    label: 'Hood Laboratories EFER rigid bronchoscope endoscope',
    url: HOOD_ENDOSCOPE_URL,
    note: 'Manufacturer source supports the 5.5 mm diameter and 0° view; shaft length in this model is approximate.',
  },
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/bx-5500-fa-rigid-telescope.glb`,
}

const genericCameraHead: AssemblyPartDefinition = {
  id: 'generic-camera-head',
  nodeName: 'Generic_Endoscopic_Camera_Head',
  label: 'Generic endoscopic camera head and ocular coupler',
  shortLabel: 'Camera head',
  description:
    'An unbranded educational proxy based on the supplied camera photograph; it couples to the telescope ocular rather than entering the bronchoscope lumen.',
  function: 'Converts the telescope image for display through a camera/control-unit chain.',
  category: 'core',
  prerequisites: [rigidTelescope.id],
  start: { position: [-3, -1.05, 0], rotation: AXIAL_ROTATION, scale: 6 },
  target: { position: [-3.007000114, -0.3, 0], rotation: AXIAL_ROTATION, scale: 6 },
  snapDistance: 0.58,
  color: '#d4d4d8',
  specs: ['Generic unbranded teaching geometry', 'Photo-derived proportions'],
  safetyNote:
    'Connector compatibility is model-specific. This proxy does not identify or guarantee compatibility with a particular camera system.',
  sourceType: 'reference-photo-educational-approximation',
  source: {
    label: 'Stryker camera systems portfolio and supplied reference photograph',
    url: STRYKER_CAMERA_URL,
    note: 'The supplied branded photograph informs visual form only; the teaching model is intentionally generic and unbranded.',
  },
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/generic-endoscopic-camera-head.glb`,
}

const lightGuideAdapterSource: AssemblyPartSource = {
  label: 'Hood Laboratories EFER user manual and supplied annotated reference',
  url: HOOD_USER_MANUAL_URL,
  note: 'The manual confirms the C1/C2 pieces and light-cable adapter interface. Their serial order follows the supplied annotated reference; dimensions are educational approximations.',
}

const lightGuideAdapterC1: AssemblyPartDefinition = {
  id: 'light-guide-adapter-c1',
  nodeName: 'Generic_Light_Guide_Adapter_C1',
  label: 'C1 telescope light-guide adapter',
  shortLabel: 'C1 light adapter',
  description:
    'A short photo-derived sleeve that seats over the lower light-guide post on the BX-5500-FA telescope.',
  function: 'Forms the first mechanical interface in the telescope-to-light-cable adapter chain.',
  category: 'core',
  prerequisites: [rigidTelescope.id],
  start: { position: [-3.6, -0.05, 0], rotation: LIGHT_GUIDE_ROTATION, scale: 9 },
  target: {
    position: [-2.794000024, -0.543000143, 0],
    rotation: LIGHT_GUIDE_ROTATION,
    scale: 9,
  },
  snapDistance: 0.34,
  interactionRadius: 0.014,
  specs: [
    'C1 reference label',
    'Photo-derived educational geometry',
    'Modeled socket and male end',
  ],
  safetyNote:
    'The C1/C2 labels do not establish a specific STORZ/Olympus, WOLF, or ACMI configuration. Verify the exact adapter chain and IFU.',
  sourceType: 'reference-photo-educational-approximation',
  source: lightGuideAdapterSource,
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/generic-light-guide-adapter-c1.glb`,
}

const lightGuideAdapterC2: AssemblyPartDefinition = {
  id: 'light-guide-adapter-c2',
  nodeName: 'Generic_Light_Guide_Adapter_C2',
  label: 'C2 cable-side light-guide adapter',
  shortLabel: 'C2 light adapter',
  description:
    'A stepped photo-derived adapter that seats over C1 and presents the smaller spigot received by the light-cable terminal.',
  function:
    'Completes the mechanical transition from the telescope light post to the cable connector.',
  category: 'core',
  prerequisites: [lightGuideAdapterC1.id],
  start: { position: [-3.15, -0.05, 0], rotation: LIGHT_GUIDE_ROTATION, scale: 9 },
  target: {
    position: [-2.794000024, -0.597000143, 0],
    rotation: LIGHT_GUIDE_ROTATION,
    scale: 9,
  },
  snapDistance: 0.34,
  interactionRadius: 0.014,
  specs: [
    'C2 reference label',
    'Photo-derived educational geometry',
    'Modeled receiver and cable spigot',
  ],
  safetyNote:
    'The C1/C2 labels do not establish a specific STORZ/Olympus, WOLF, or ACMI configuration. Verify the exact adapter chain and IFU.',
  sourceType: 'reference-photo-educational-approximation',
  source: lightGuideAdapterSource,
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/generic-light-guide-adapter-c2.glb`,
}

const genericLightCable: AssemblyPartDefinition = {
  id: 'generic-fiberoptic-light-cable',
  nodeName: 'Generic_Fiberoptic_Light_Cable',
  label: 'Generic fiberoptic light cable',
  shortLabel: 'Light cable',
  description:
    'A coiled, generic cable proxy whose scope-side terminal seats over the C2 adapter beneath the telescope; the opposite end represents the light-source connection.',
  function: 'Carries illumination from the light source to the telescope light guide.',
  category: 'core',
  prerequisites: [lightGuideAdapterC2.id],
  start: { position: [2.3, 0.8, 0], rotation: LIGHT_GUIDE_ROTATION, scale: 5.5 },
  target: {
    position: [-2.794000024, -0.741000143, 0],
    rotation: LIGHT_GUIDE_ROTATION,
    scale: 5.5,
  },
  snapDistance: 0.72,
  color: '#64748b',
  specs: ['2300 mm × 3.5 mm manufacturer exemplar', 'Generic connector geometry'],
  safetyNote:
    'Cable and connector compatibility, light-source settings, and heat precautions depend on the exact system and IFU.',
  sourceType: 'manufacturer-exemplar-generic-geometry',
  source: {
    label: 'KARL STORZ 495NAC fiberoptic light cable exemplar',
    url: KARL_STORZ_LIGHT_CABLE_URL,
    note: 'Exemplar dimensions inform scale; the supplied photograph and connectors are not claimed to be this exact model.',
  },
  individualAssetPath: `${COMPONENT_ASSET_ROOT}/generic-fiberoptic-light-cable.glb`,
}

const toolSource: AssemblyPartSource = {
  label: 'Hood Laboratories EFER-DUMON forceps ordering information',
  url: HOOD_FORCEPS_URL,
  note: 'Published dimensions are retained; handle and distal articulation geometry are educational approximations.',
}

/** Optional tools shown in the explorer after the core assembly exercise. */
export const assemblyToolParts: readonly AssemblyPartDefinition[] = [
  {
    id: 'tool-optical-grasping-forceps',
    nodeName: 'Optical_Grasping_Forceps_32_3230_430HM',
    label: 'Optical grasping forceps 32-3230-430HM',
    shortLabel: 'Optical grasping forceps',
    description:
      'A two-jaw optical forceps proxy with a telescope guide tube and ring-handle control assembly.',
    function:
      'Combines rigid visualization alignment and grasping access in one instrument assembly.',
    category: 'tool',
    prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID],
    start: { position: [0.2, -1.75, -1.3], rotation: AXIAL_ROTATION, scale: 7.5 },
    target: { position: [-2.65, -0.12, 0], rotation: AXIAL_ROTATION, scale: 7.5 },
    snapDistance: 0.8,
    specs: ['470 mm working length', '3 mm head', 'Two jaws'],
    safetyNote:
      'Instrument fit and use depend on the selected tube, exact accessory, target, and manufacturer instructions.',
    sourceType: 'manufacturer-dimensions-photo-derived-geometry',
    source: toolSource,
    individualAssetPath: `${COMPONENT_ASSET_ROOT}/optical-grasping-forceps-32-3230-430hm.glb`,
  },
  {
    id: 'tool-semi-rigid-grasping-forceps',
    nodeName: 'Semi_Rigid_Grasping_Forceps_BPS2002',
    label: 'BPS2002 semi-rigid grasping forceps',
    shortLabel: 'Semi-rigid grasping forceps',
    description: 'A long 1.5 mm-shaft, two-jaw grasping forceps proxy for accessory exploration.',
    function: 'Provides a slim grasping instrument option for the tool catalog.',
    category: 'tool',
    prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID],
    start: { position: [0.2, -1.75, -1.3], rotation: AXIAL_ROTATION, scale: 7.5 },
    target: { position: [-2.65, -0.12, 0], rotation: AXIAL_ROTATION, scale: 7.5 },
    snapDistance: 0.8,
    specs: ['600 mm working length', '1.5 mm shaft', '3 mm head', 'Two jaws'],
    safetyNote:
      'Instrument fit and use depend on the selected tube, exact accessory, target, and manufacturer instructions.',
    sourceType: 'manufacturer-dimensions-photo-derived-geometry',
    source: toolSource,
    individualAssetPath: `${COMPONENT_ASSET_ROOT}/semi-rigid-grasping-forceps-bps2002.glb`,
  },
  {
    id: 'tool-semi-rigid-biopsy-forceps',
    nodeName: 'Semi_Rigid_Biopsy_Forceps_BPS2001',
    label: 'BPS2001 semi-rigid biopsy forceps',
    shortLabel: 'Semi-rigid biopsy forceps',
    description: 'A long 1.5 mm-shaft biopsy-cup forceps proxy for accessory exploration.',
    function: 'Provides a slim tissue-sampling instrument example for the tool catalog.',
    category: 'tool',
    prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID],
    start: { position: [0.2, -1.75, -1.3], rotation: AXIAL_ROTATION, scale: 7.5 },
    target: { position: [-2.65, -0.12, 0], rotation: AXIAL_ROTATION, scale: 7.5 },
    snapDistance: 0.8,
    specs: ['600 mm working length', '1.5 mm shaft', '3 mm head', 'Biopsy cups'],
    safetyNote:
      'Instrument fit and use depend on the selected tube, exact accessory, target, and manufacturer instructions.',
    sourceType: 'manufacturer-dimensions-photo-derived-geometry',
    source: toolSource,
    individualAssetPath: `${COMPONENT_ASSET_ROOT}/semi-rigid-biopsy-forceps-bps2001.glb`,
  },
  {
    id: 'tool-suction-catheter-3mm',
    nodeName: 'Semi_Rigid_Suction_Catheter_3mm',
    label: '3 mm semi-rigid suction catheter',
    shortLabel: '3 mm suction catheter',
    description:
      'A hollow 3 mm semi-rigid suction catheter proxy with a gently angled distal segment and a patent modeled lumen.',
    function: 'Represents suction access through the rigid bronchoscope lumen.',
    category: 'tool',
    prerequisites: [ASSEMBLY_BASE_PART_ID, ANY_TUBE_PREREQUISITE_ID],
    start: { position: [0.2, -1.75, -1.3], rotation: AXIAL_ROTATION, scale: 7.5 },
    target: { position: [-2.65, -0.12, 0], rotation: AXIAL_ROTATION, scale: 7.5 },
    snapDistance: 0.8,
    specs: ['550 mm working length', '3 mm nominal outer diameter', 'Patent modeled lumen'],
    safetyNote:
      'Available suction and fit depend on tube inner diameter, catheter size, secretions, system setup, and the exact devices.',
    sourceType: 'manufacturer-dimensions-educational-geometry',
    source: {
      label: 'Hood Laboratories EFER-DUMON ordering information',
      url: HOOD_ORDERING_URL,
      note: 'Published size and working length inform a simplified hollow educational model.',
    },
    individualAssetPath: `${COMPONENT_ASSET_ROOT}/semi-rigid-suction-catheter-3mm.glb`,
  },
]

/**
 * The guided sequence begins with the default selected tube. A UI that changes
 * tube selection should replace `assemblySteps[0]` with that selected option.
 */
export const assemblySteps: readonly AssemblyPartDefinition[] = [
  bronchoscopeTubeOptions[2],
  doubleGateLateralObturator,
  redMainCap,
  rigidTelescope,
  genericCameraHead,
  lightGuideAdapterC1,
  lightGuideAdapterC2,
  genericLightCable,
]

export const assemblyParts: readonly AssemblyPartDefinition[] = [
  adultUniversalBase,
  ...bronchoscopeTubeOptions,
  ...assemblySteps.slice(1),
  ...assemblyToolParts,
]

const assemblyPartById = new Map(assemblyParts.map((part) => [part.id, part] as const))

export function getAssemblyPart(id: AssemblyPartId): AssemblyPartDefinition | undefined {
  return assemblyPartById.get(id)
}

export function isBronchoscopeTubePartId(id: AssemblyPartId): boolean {
  return bronchoscopeTubeOptions.some((part) => part.id === id)
}
