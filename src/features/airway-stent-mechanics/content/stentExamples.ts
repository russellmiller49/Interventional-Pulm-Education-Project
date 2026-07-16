export type StentModelAssetId =
  | 'aero-laser-cut-covered'
  | 'aero-laser-cut-uncovered'
  | 'bonastent-hook-cross-covered'
  | 'bonastent-hook-cross-uncovered'
  | 'silicone-y-stent'
  | 'trachea-openface-stenosis'
  | 'ultraflex-woven-covered'
  | 'ultraflex-woven-uncovered'
  | 'wall-stent'

export type StentExampleSceneKind =
  | 'architecture'
  | 'bend'
  | 'cover'
  | 'deployment'
  | 'fatigue'
  | 'y-anchoring'

export interface StentModelAsset {
  id: StentModelAssetId
  label: string
  shortLabel: string
  url: string
  family: string
  coverage: 'covered' | 'continuous wall' | 'not applicable' | 'uncovered'
  sourceFile: string
  pairedAssetId?: StentModelAssetId
  morphTargets: string[]
  triangleBudget: number
}

export interface StentExampleChoice {
  id: string
  label: string
}

export interface StentExample {
  id: string
  sceneKind: StentExampleSceneKind
  number: number
  title: string
  eyebrow: string
  description: string
  prompt: string
  choices: StentExampleChoice[]
  correctChoiceId: string
  explanation: string
  assetIds: StentModelAssetId[]
  defaultAssetId: StentModelAssetId
  animationLabel: string
  markerLabels: string[]
  teachingPoints: string[]
  sourceRefs: number[]
  boundary: string
}

const modelPrefix = '/airway-stent-mechanics/models/v1'
const modelRevision = '20260711.4'
const modelUrl = (filename: string) => `${modelPrefix}/${filename}?rev=${modelRevision}`

export const stentModelAssets: StentModelAsset[] = [
  {
    id: 'aero-laser-cut-covered',
    label: 'AERO laser-cut covered specimen',
    shortLabel: 'AERO · covered',
    url: modelUrl('aero-laser-cut-covered.glb'),
    family: 'Laser-cut self-expanding lattice',
    coverage: 'covered',
    sourceFile: 'AERO_LaserCut_Covered.glb',
    pairedAssetId: 'aero-laser-cut-uncovered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 110_000,
  },
  {
    id: 'aero-laser-cut-uncovered',
    label: 'AERO laser-cut uncovered specimen',
    shortLabel: 'AERO · uncovered',
    url: modelUrl('aero-laser-cut-uncovered.glb'),
    family: 'Laser-cut self-expanding lattice',
    coverage: 'uncovered',
    sourceFile: 'AERO_LaserCut_Uncovered.glb',
    pairedAssetId: 'aero-laser-cut-covered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 120_000,
  },
  {
    id: 'bonastent-hook-cross-covered',
    label: 'BONASTENT hook-and-cross covered specimen',
    shortLabel: 'BONASTENT · covered',
    url: modelUrl('bonastent-hook-cross-covered.glb'),
    family: 'Captured-cell braided scaffold',
    coverage: 'covered',
    sourceFile: 'Bonastent_HookCross_Covered.glb',
    pairedAssetId: 'bonastent-hook-cross-uncovered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 110_000,
  },
  {
    id: 'bonastent-hook-cross-uncovered',
    label: 'BONASTENT hook-and-cross uncovered specimen',
    shortLabel: 'BONASTENT · uncovered',
    url: modelUrl('bonastent-hook-cross-uncovered.glb'),
    family: 'Captured-cell braided scaffold',
    coverage: 'uncovered',
    sourceFile: 'Bonastent_HookCross_Uncovered.glb',
    pairedAssetId: 'bonastent-hook-cross-covered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 120_000,
  },
  {
    id: 'silicone-y-stent',
    label: 'Silicone Y-stent specimen',
    shortLabel: 'Silicone Y',
    url: modelUrl('silicone-y-stent.glb'),
    family: 'Bifurcated molded silicone',
    coverage: 'continuous wall',
    sourceFile: 'Silicone Y-stent.glb',
    morphTargets: ['RadialCompression'],
    triangleBudget: 66_000,
  },
  {
    id: 'trachea-openface-stenosis',
    label: 'Open-face trachea with stenotic segment',
    shortLabel: 'Stenotic airway',
    url: modelUrl('trachea-openface-stenosis.glb'),
    family: 'Educational airway context',
    coverage: 'not applicable',
    sourceFile: 'Trachea_openface_with_stenosis.glb',
    morphTargets: ['StenosisRelief', 'CoughOvalization'],
    triangleBudget: 100_000,
  },
  {
    id: 'ultraflex-woven-covered',
    label: 'Ultraflex woven covered specimen',
    shortLabel: 'Ultraflex · covered',
    url: modelUrl('ultraflex-woven-covered.glb'),
    family: 'Single-wire knitted scaffold',
    coverage: 'covered',
    sourceFile: 'Ultraflex_Woven_Covered.glb',
    pairedAssetId: 'ultraflex-woven-uncovered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 110_000,
  },
  {
    id: 'ultraflex-woven-uncovered',
    label: 'Ultraflex woven uncovered specimen',
    shortLabel: 'Ultraflex · uncovered',
    url: modelUrl('ultraflex-woven-uncovered.glb'),
    family: 'Single-wire knitted scaffold',
    coverage: 'uncovered',
    sourceFile: 'Ultraflex_Woven_Uncov.glb',
    pairedAssetId: 'ultraflex-woven-covered',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 120_000,
  },
  {
    id: 'wall-stent',
    label: 'Wall-type braided stent specimen',
    shortLabel: 'Wall-type braid',
    url: modelUrl('wall-stent.glb'),
    family: 'Multiwire braided scaffold',
    coverage: 'uncovered',
    sourceFile: 'Wall_stent.glb',
    morphTargets: ['RadialCompression', 'Ovalization', 'Bend'],
    triangleBudget: 84_000,
  },
]

export const stentExamples: StentExample[] = [
  {
    id: 'eccentric-deployment',
    sceneKind: 'deployment',
    number: 1,
    title: 'Eccentric stenosis: support is not uniform loading',
    eyebrow: 'Airway + scaffold equilibrium',
    description:
      'Place a geometry-normalized scaffold inside the supplied open-face stenotic airway, then watch prescribed expansion meet an asymmetric constraint.',
    prompt: 'The average lumen reaches the target. What must be inspected next?',
    choices: [
      { id: 'peak-force', label: 'Only the catalog peak radial-force value' },
      { id: 'area-contact', label: 'Minimum lumen or area retention plus contact distribution' },
      { id: 'material', label: 'Whether the base material is silicone or nitinol' },
    ],
    correctChoiceId: 'area-contact',
    explanation:
      'An eccentric lesion can preserve an acceptable average diameter while retaining a narrow minor axis and concentrating contact on one wall. Lumen geometry and where load acts must be read together.',
    assetIds: ['aero-laser-cut-uncovered', 'bonastent-hook-cross-uncovered', 'wall-stent'],
    defaultAssetId: 'aero-laser-cut-uncovered',
    animationLabel: 'Seat and expand the scaffold',
    markerLabels: ['Stenotic segment', 'First-contact side', 'Underapposed side'],
    teachingPoints: [
      'Deployed diameter is an equilibrium rather than the free stent diameter.',
      'Eccentric constraint produces ovalization and uneven apposition.',
      'Contact markers are qualitative; they are not mucosal pressure values.',
    ],
    sourceRefs: [2],
    boundary:
      'Prescribed geometry only—not finite-element analysis, measured tissue pressure, COF/RRF, or comparative product performance.',
  },
  {
    id: 'architecture-load-path',
    sceneKind: 'architecture',
    number: 2,
    title: 'Architecture changes the load path',
    eyebrow: 'Finished design over material label',
    description:
      'Apply the same illustrative constraint to a laser-cut lattice, captured-cell braid, pre-bent knit, or multiwire braid and inspect the geometric load path.',
    prompt: 'If two scaffolds use a similar alloy, should they have the same mechanical response?',
    choices: [
      { id: 'yes-alloy', label: 'Yes—the alloy determines the finished response' },
      {
        id: 'no-architecture',
        label: 'No—architecture and boundary conditions remain controlling',
      },
      { id: 'only-cover', label: 'Only if one scaffold has a cover' },
    ],
    correctChoiceId: 'no-architecture',
    explanation:
      'Wire continuity, braid angle, captured crossings, connector geometry, cell opening, friction, and the imposed fixture all change how a scaffold carries load.',
    assetIds: [
      'aero-laser-cut-uncovered',
      'bonastent-hook-cross-uncovered',
      'ultraflex-woven-uncovered',
      'wall-stent',
    ],
    defaultAssetId: 'wall-stent',
    animationLabel: 'Trace the prescribed load path',
    markerLabels: ['Cell or loop', 'Crossing or connector', 'Diameter–length coupling'],
    teachingPoints: [
      'Laser-cut connectors act as designed hinges and fatigue concentrators.',
      'Braids couple radial motion to wire rotation, crossing friction, and length.',
      'The same visual displacement does not establish equivalent force.',
    ],
    sourceRefs: [13, 19, 20, 23],
    boundary:
      'The imposed motion illustrates kinematics only and does not rank radial force, axial force, flexibility, or foreshortening.',
  },
  {
    id: 'cover-interface',
    sceneKind: 'cover',
    number: 3,
    title: 'What adding a cover changes—and does not prove',
    eyebrow: 'Matched filename pairs',
    description:
      'Crossfade between the supplied covered and uncovered specimens while separating interface consequences from unsupported force claims.',
    prompt:
      'After adding a cover, which quantitative conclusion is safe without equivalent testing?',
    choices: [
      { id: 'more-force', label: 'The covered version always has greater radial force' },
      { id: 'less-migration', label: 'The covered version always migrates less' },
      { id: 'none', label: 'None—contact, friction, stiffness, and fatigue still require testing' },
    ],
    correctChoiceId: 'none',
    explanation:
      'A cover blocks ingrowth and changes the tissue-facing surface, but it also alters composite stiffness, friction, mucus transport, crease behavior, and end transitions. Direction and magnitude are design- and method-dependent.',
    assetIds: [
      'aero-laser-cut-uncovered',
      'bonastent-hook-cross-uncovered',
      'ultraflex-woven-uncovered',
    ],
    defaultAssetId: 'ultraflex-woven-uncovered',
    animationLabel: 'Compare uncovered and covered specimens',
    markerLabels: ['Exposed cell path', 'Continuous cover', 'Uncovered end transition'],
    teachingPoints: [
      'A continuous membrane blocks tissue ingrowth through the scaffold.',
      'Distributed contact may lower local concentration even when composite stiffness rises.',
      'Mucociliary interruption and cover fatigue become new design questions.',
    ],
    sourceRefs: [2, 20, 39],
    boundary:
      'The supplied pairs are not vertex-registered or verified product specifications; the crossfade is a qualitative comparison, not a mechanical morph.',
  },
  {
    id: 'bend-compatibility',
    sceneKind: 'bend',
    number: 4,
    title: 'Bend compatibility needs force plus lumen retention',
    eyebrow: 'Mainstem curvature',
    description:
      'Bend a selected specimen with its authored morph target, add ovalization, and reveal the inner- and outer-curve consequences.',
    prompt: 'Which pair best evaluates a scaffold intended for a curved mainstem?',
    choices: [
      { id: 'peak-only', label: 'Peak flat-plate compression force alone' },
      {
        id: 'bend-area',
        label: 'Bending or straightening force plus minimum diameter or area retention',
      },
      { id: 'length-only', label: 'Unconstrained device length and free diameter' },
    ],
    correctChoiceId: 'bend-area',
    explanation:
      'A scaffold may appear easy to bend because it ovalizes or kinks. Bend force must be paired with lumen preservation at the same curvature and orientation.',
    assetIds: [
      'aero-laser-cut-uncovered',
      'bonastent-hook-cross-uncovered',
      'ultraflex-woven-uncovered',
      'wall-stent',
    ],
    defaultAssetId: 'ultraflex-woven-uncovered',
    animationLabel: 'Apply prescribed bend and ovalization',
    markerLabels: ['Inner-curve shortening', 'Outer-curve contact', 'End restoring load'],
    teachingPoints: [
      'Inner and outer curves experience different axial strain and contact.',
      'Spring-back transfers restoring load toward ends and fixation points.',
      'A force value without the bent lumen geometry is incomplete.',
    ],
    sourceRefs: [12, 22],
    boundary:
      'All specimens receive a prescribed visual deformation; the scene cannot establish which named product is more flexible or preserves more lumen.',
  },
  {
    id: 'cyclic-fatigue',
    sceneKind: 'fatigue',
    number: 5,
    title: 'A static pass does not establish durability',
    eyebrow: 'Combined cyclic loading',
    description:
      'Cycle radial compression, ovalization, bending, and micromotion before freezing conceptual architecture-specific hotspots.',
    prompt: 'A scaffold passed one static compression test. What remains essential across a curve?',
    choices: [
      { id: 'color', label: 'The scaffold color and radiopacity alone' },
      { id: 'single-repeat', label: 'Repeating the same straight static test once' },
      {
        id: 'combined-fatigue',
        label: 'Combined-mode fatigue matched to placement and intended dwell',
      },
    ],
    correctChoiceId: 'combined-fatigue',
    explanation:
      'Breathing, cough, bending, torsion, crossing friction, axial micromotion, and cover creasing can superimpose. Fatigue testing must reproduce the relevant modes and architectural hotspots.',
    assetIds: [
      'aero-laser-cut-uncovered',
      'bonastent-hook-cross-uncovered',
      'ultraflex-woven-uncovered',
      'wall-stent',
    ],
    defaultAssetId: 'aero-laser-cut-uncovered',
    animationLabel: 'Run the conceptual cyclic sequence',
    markerLabels: ['Connector or crossing', 'Outer curve', 'End transition'],
    teachingPoints: [
      'Architecture determines where strain and fretting tend to concentrate.',
      'Cough pulses are superimposed on lower-amplitude breathing cycles.',
      'Hotspot colors are annotations—not computed stress contours or fracture predictions.',
    ],
    sourceRefs: [14, 16, 23, 26, 43],
    boundary:
      'No cycle life, stress magnitude, or actual failure location is predicted by this animation.',
  },
  {
    id: 'y-stent-anchoring',
    sceneKind: 'y-anchoring',
    number: 6,
    title: 'Y-stent anchoring is geometric',
    eyebrow: 'Carina + three coupled limbs',
    description:
      'Seat the supplied silicone Y-stent inside a translucent educational carinal phantom, then reveal branch mismatch and saddle loading.',
    prompt: 'What primarily resists axial migration in a correctly fitted silicone Y-stent?',
    choices: [
      { id: 'max-force', label: 'Maximal whole-device radial force alone' },
      { id: 'carinal-geometry', label: 'Carinal seating and coupled branch geometry' },
      { id: 'surface-color', label: 'Surface color and radiopaque filler' },
    ],
    correctChoiceId: 'carinal-geometry',
    explanation:
      'The carinal saddle and three limbs create geometric fixation. That stability is coupled to branch angle, limb fit, local pressure, torsion, and mucus behavior at the junction.',
    assetIds: ['silicone-y-stent'],
    defaultAssetId: 'silicone-y-stent',
    animationLabel: 'Seat the Y-stent at the carina',
    markerLabels: ['Tracheal limb', 'Carinal saddle', 'Branch-fit mismatch'],
    teachingPoints: [
      'Geometric anchoring can resist migration without maximal global expansion force.',
      'Each branch introduces independent fit, bend, torsion, and secretion tradeoffs.',
      'Carinal pressure and junction mucus pockets remain important failure modes.',
    ],
    sourceRefs: [3, 22],
    boundary:
      'The phantom is generic and cannot represent patient fit, required dimensions, insertion technique, or a device recommendation.',
  },
]

export function getStentModelAsset(id: StentModelAssetId) {
  const asset = stentModelAssets.find((candidate) => candidate.id === id)
  if (!asset) throw new Error(`Unknown stent model asset: ${id}`)
  return asset
}

export function getStentExample(id: string) {
  const example = stentExamples.find((candidate) => candidate.id === id)
  if (!example) throw new Error(`Unknown stent teaching example: ${id}`)
  return example
}
