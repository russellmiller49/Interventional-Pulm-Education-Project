import type { AirwayGeometryId, MechanicsScenario } from '../engine/types'

export const airwayGeometryOptions: Array<{
  id: AirwayGeometryId
  label: string
  description: string
}> = [
  {
    id: 'straight',
    label: 'Straight, concentric airway',
    description: 'A reference geometry with uniform contact and minimal bend loading.',
  },
  {
    id: 'curved',
    label: 'Curved main bronchus',
    description:
      'Adds straightening force, inner-curve gapping, outer-curve pressure, and fatigue demand.',
  },
  {
    id: 'tapered',
    label: 'Tapered airway',
    description: 'A cylindrical stent can be underapposed at one end and overloaded at the other.',
  },
  {
    id: 'asymmetric',
    label: 'Eccentric stenosis',
    description:
      'Concentrates load on one wall and promotes ovalization rather than uniform radial compression.',
  },
]

export const forceTaxonomy = [
  {
    term: 'Chronic outward force (COF)',
    definition:
      'Outward support read from the unloading or expansion path at a constrained diameter.',
    caution: 'Not interchangeable with the force required to compress the device.',
  },
  {
    term: 'Radial resistive force (RRF)',
    definition: 'Force required to compress the device on the loading path.',
    caution: 'Flat-plate RRF also contains local bending, ovalization, and possible buckling.',
  },
  {
    term: 'Radial stiffness',
    definition: 'The slope dF/dD across a stated diameter interval.',
    caution: 'A single peak hides how rapidly wall load changes with a small diameter change.',
  },
  {
    term: 'Collapse pressure / strength',
    definition:
      'External pressure or force producing a defined loss of diameter, buckling, or permanent deformation.',
    caution:
      'The endpoint, fixture, length, rate, temperature, and orientation must accompany the value.',
  },
  {
    term: 'Apparent contact pressure',
    definition: 'Average contact load divided by effective contact area.',
    caution: 'Peak pressure at a wire, stud, flare, connector, or end may be far higher.',
  },
  {
    term: 'Hysteresis',
    definition: 'Separation between compression and expansion curves at the same diameter.',
    caution: 'Reflects energy dissipation, wire friction, material behavior, and test history.',
  },
]

export const tissueMechanisms = [
  {
    id: 'pressure',
    label: 'Static pressure',
    color: '#ef4444',
    mechanism: 'Local normal force over small contact area can compromise microcirculation.',
    outcomes: 'Ischemia, ulceration, necrosis, erosion',
  },
  {
    id: 'edge',
    label: 'Edge and end loading',
    color: '#f59e0b',
    mechanism: 'Straightening force and stiffness transitions concentrate load at device ends.',
    outcomes: 'End granulation, focal injury, outer-curve pressure',
  },
  {
    id: 'shear',
    label: 'Cyclic shear',
    color: '#8b5cf6',
    mechanism: 'Cough, breathing, swallowing, and micromotion repeatedly rub the tissue interface.',
    outcomes: 'Inflammation, granulation, cover wear',
  },
  {
    id: 'ingrowth',
    label: 'Tissue ingrowth',
    color: '#22c55e',
    mechanism:
      'Uncovered cells permit incorporation that improves fixation but couples tissue to the scaffold.',
    outcomes: 'Restenosis and difficult or hazardous removal',
  },
  {
    id: 'mucus',
    label: 'Mucus and biofilm',
    color: '#06b6d4',
    mechanism:
      'Covers interrupt ciliary transport; gaps, junctions, and roughness create stagnant pockets.',
    outcomes: 'Pooling, plugging, infection, malodor',
  },
  {
    id: 'fatigue',
    label: 'Scaffold and cover fatigue',
    color: '#f43f5e',
    mechanism:
      'Combined radial, bending, torsional, and axial cycles focus strain at architectural hot spots.',
    outcomes: 'Wire fracture, silicone tear, delamination, loss of support',
  },
]

export const ginaDumonBenchData = [
  {
    metric: 'Anti-migration force',
    dumon: '12.83 ± 0.23 N',
    gina: '15.21 ± 0.59 N forward; 18.40 ± 0.51 N backward',
    method: '5-cm push through a 16-mm-ID Teflon jig',
  },
  {
    metric: 'Expansion / compression force',
    dumon: '14.54 ± 0.27 N',
    gina: '11.91 ± 0.21 N',
    method: 'Flat-plate compression to 50% diameter reduction',
  },
  {
    metric: 'Flexibility force',
    dumon: '4.47 ± 0.10 N',
    gina: '3.13 ± 0.06 N',
    method: '4-cm span; deflection to half diameter',
  },
] as const

export const mechanicsScenarios: MechanicsScenario[] = [
  {
    id: 'curved-mainstem',
    title: 'The curved mainstem trap',
    stem: 'A rigidly constrained left mainstem segment is sharply curved. A candidate scaffold has strong radial support but also high spring-back.',
    prompt: 'Which property must be checked before increasing diameter to gain more support?',
    choices: [
      {
        id: 'axial-lumen',
        label: 'Axial force plus lumen area in the bend',
        rationale:
          'Bending force alone cannot show whether the lumen is preserved or the ends are loading the outer curve.',
      },
      {
        id: 'peak-radial',
        label: 'Peak flat-plate radial force only',
        rationale:
          'A peak compression value does not measure straightening, gapping, or area retention.',
      },
      {
        id: 'material-name',
        label: 'Whether the catalog calls it silicone or metal',
        rationale:
          'Material family does not specify the finished architecture or its axial response.',
      },
    ],
    bestChoiceId: 'axial-lumen',
    explanation:
      'Evaluate whether the device follows the centerline without inner-curve gapping, outer-curve pressure, or ovalization. Nominal diameter should follow the bend analysis—not substitute for it.',
    sourceRefs: [5, 12, 22],
  },
  {
    id: 'migration-force',
    title: 'Anchoring without brute force',
    stem: 'Two molded silicone designs have the same outer diameter. One has lower whole-body compression force but directional rings and a dynamic posterior section.',
    prompt: 'Can the lower-force design still resist migration better?',
    choices: [
      {
        id: 'yes-geometry',
        label: 'Yes—surface geometry can raise directional anchoring',
        rationale:
          'Friction, rings, studs, taper, and geometry can change migration resistance independently of global compression force.',
      },
      {
        id: 'no-radial',
        label: 'No—migration is determined only by radial force',
        rationale: 'This confuses normal contact with the complete anchoring system.',
      },
      {
        id: 'unknown-material',
        label: 'Only if the silicone durometer is higher',
        rationale:
          'Durometer is one input, but wall and surface architecture can dominate finished-device behavior.',
      },
    ],
    bestChoiceId: 'yes-geometry',
    explanation:
      'The GINA comparison demonstrated higher directional anti-migration force despite lower compression and flexibility forces. It is a clean example of engineering anchoring separately from whole-body radial load.',
    sourceRefs: [1],
  },
  {
    id: 'covered-stress',
    title: 'Stiffer device, lower peak tissue stress?',
    stem: 'A thin membrane is bonded across a metallic mesh. Bench testing finds that the free covered device is stiffer than the uncovered frame.',
    prompt: 'Could the covered device still create lower modeled peak tissue stress?',
    choices: [
      {
        id: 'yes-area',
        label: 'Yes—if the cover spreads contact over more area',
        rationale: 'Device stiffness and peak tissue pressure are related but not synonymous.',
      },
      {
        id: 'no-stiffness',
        label: 'No—greater device stiffness always means greater tissue stress',
        rationale: 'This ignores contact distribution and the tissue-facing surface.',
      },
      {
        id: 'only-friction',
        label: 'Only if friction is zero',
        rationale:
          'Friction affects migration, but pressure distribution can change even at nonzero friction.',
      },
    ],
    bestChoiceId: 'yes-area',
    explanation:
      'A cover can raise device-level stiffness yet reduce local stress by distributing load. The tradeoff shifts to friction, migration, secretion transport, end loading, and membrane fatigue.',
    sourceRefs: [2, 39],
  },
  {
    id: 'fatigue',
    title: 'Static pass, cyclic failure',
    stem: 'A laser-cut scaffold passes a single static compression test but will sit across a high-motion curve for a prolonged dwell.',
    prompt: 'Which test adds the most relevant missing information?',
    choices: [
      {
        id: 'combined-fatigue',
        label: 'Combined radial, bending, torsional, and cough-like fatigue',
        rationale:
          'It targets the same connectors and outer-curve regions repeatedly loaded in the airway.',
      },
      {
        id: 'repeat-static',
        label: 'Repeat the same static compression once',
        rationale: 'A second static result still misses cyclic strain and combined loading.',
      },
      {
        id: 'radiopacity',
        label: 'Measure radiopacity only',
        rationale: 'Visibility is important but does not test connector or cover durability.',
      },
    ],
    bestChoiceId: 'combined-fatigue',
    explanation:
      'Respiration, cough, swallowing, neck motion, and curvature superimpose millions of cycles. Static compression alone cannot predict connector, wire, cover, or junction failure.',
    sourceRefs: [14, 16, 25, 26, 43],
  },
]

export const benchDesignChecklist = [
  'Identify the exact size, architecture, material, cover, lot, and sterilization state.',
  'Condition the device at 37 °C in a stated medium and record preconditioning cycles.',
  'Report full loading and unloading curves over a clinically relevant diameter range.',
  'State fixture geometry, orientation, rate, deformation endpoint, length normalization, and uncertainty.',
  'Pair bend force with minimum diameter or area retention at the same curvature.',
  'Test wet bidirectional migration after cough-like cyclic preconditioning.',
  'Match fatigue mode to placement: radial, bending, torsional, axial, cover, and combined loading.',
  'Explain what the test simulates—and what it cannot predict clinically.',
]
