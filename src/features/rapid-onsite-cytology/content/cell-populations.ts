export type CellPopulationId =
  | 'lymphocyte'
  | 'bronchial-epithelial'
  | 'neutrophil'
  | 'macrophage'
  | 'malignant-epithelial'
  | 'red-blood-cell'

export type CellDiagramVariant = CellPopulationId

export interface CellFeature {
  id: string
  label: string
  description: string
  xPct: number
  yPct: number
}

export interface CellPopulation {
  id: CellPopulationId
  title: string
  shortLabel: string
  family: string
  relativeSize: string
  oneLook: string
  nucleus: string
  cytoplasm: string
  arrangement: string
  onsiteMeaning: string
  pitfall: string
  diagramVariant: CellDiagramVariant
  diagramAlt: string
  features: CellFeature[]
}

export interface CellReadingStep {
  number: string
  title: string
  question: string
}

export interface CellPopulationSource {
  title: string
  citation: string
  url: string
}

export const cellReadingSteps: CellReadingStep[] = [
  {
    number: '01',
    title: 'Calibrate size',
    question: 'Small like a lymphocyte, larger like a macrophage, or variable across a cluster?',
  },
  {
    number: '02',
    title: 'Read the nucleus',
    question: 'Round, segmented, eccentric, molded, irregular, or absent?',
  },
  {
    number: '03',
    title: 'Read the chromatin',
    question: 'Dense and smooth, finely granular, coarse, or interrupted by nucleoli?',
  },
  {
    number: '04',
    title: 'Inspect cytoplasm and surface',
    question: 'Scant, granular, foamy, vacuolated, dense, ciliated, or not visible?',
  },
  {
    number: '05',
    title: 'Zoom back out',
    question:
      'Single cells, cohesive sheet, three-dimensional group, mixed inflammation, or blood?',
  },
]

export const cellPopulations: CellPopulation[] = [
  {
    id: 'lymphocyte',
    title: 'Small mature lymphocyte',
    shortLabel: 'Lymphocyte',
    family: 'Lymphoid cell',
    relativeSize: 'Small; often a useful internal size reference',
    oneLook: 'A dark round nucleus with only a thin rim of blue cytoplasm.',
    nucleus: 'Round, smooth, and densely stained; it occupies most of the cell.',
    cytoplasm: 'Very scant and usually seen as a narrow blue rim.',
    arrangement: 'Usually discohesive single cells; a lymph-node aspirate often contains many.',
    onsiteMeaning:
      'A reproducible lymphoid population supports sampling of a lymphoid target, but ROSE still cannot exclude lymphoma or assign a final nodal result.',
    pitfall:
      'Crushed lymphocytes can mimic a small-cell malignancy; blood can also contribute lymphocytes without proving target representation.',
    diagramVariant: 'lymphocyte',
    diagramAlt:
      'Schematic small mature lymphocyte with a large round dense nucleus and a thin rim of cytoplasm.',
    features: [
      {
        id: 'lymphocyte-nucleus',
        label: 'Dense round nucleus',
        description: 'The nucleus is smooth and occupies nearly the entire cell.',
        xPct: 50,
        yPct: 47,
      },
      {
        id: 'lymphocyte-cytoplasm',
        label: 'Scant cytoplasmic rim',
        description: 'Only a narrow blue rim separates the nucleus from the cell border.',
        xPct: 68,
        yPct: 63,
      },
      {
        id: 'lymphocyte-arrangement',
        label: 'Discohesive population',
        description: 'Mature lymphocytes appear as separate cells rather than an epithelial sheet.',
        xPct: 24,
        yPct: 32,
      },
    ],
  },
  {
    id: 'bronchial-epithelial',
    title: 'Ciliated bronchial epithelial cells',
    shortLabel: 'Bronchial cells',
    family: 'Benign airway epithelium',
    relativeSize: 'Taller and more elongated than a lymphocyte',
    oneLook: 'A cohesive strip of columnar cells with aligned nuclei and a ciliated edge.',
    nucleus: 'Usually uniform and oval, often aligned toward the basal half of the cells.',
    cytoplasm: 'Moderate, delicate cytoplasm extending toward the luminal surface.',
    arrangement:
      'Cohesive sheets or strips with polarity; cilia and terminal bars favor benign airway origin.',
    onsiteMeaning:
      'These cells show airway sampling or contamination. They do not prove that a peripheral nodule or other intended lesion was sampled.',
    pitfall:
      'Reactive bronchial cells may enlarge and show nucleoli, while injury can reduce cilia. Use polarity, terminal bars, and the full population rather than one feature.',
    diagramVariant: 'bronchial-epithelial',
    diagramAlt:
      'Schematic cohesive strip of ciliated bronchial epithelial cells with aligned oval nuclei and apical cilia.',
    features: [
      {
        id: 'bronchial-cilia',
        label: 'Cilia and terminal bar',
        description:
          'A coordinated apical fringe and terminal bar strongly support benign respiratory epithelium.',
        xPct: 51,
        yPct: 20,
      },
      {
        id: 'bronchial-nuclei',
        label: 'Aligned oval nuclei',
        description: 'Relatively uniform nuclei preserve polarity within the cell strip.',
        xPct: 50,
        yPct: 61,
      },
      {
        id: 'bronchial-cohesion',
        label: 'Orderly cohesion',
        description:
          'The cells remain attached in a flat, organized strip rather than a crowded three-dimensional group.',
        xPct: 80,
        yPct: 51,
      },
    ],
  },
  {
    id: 'neutrophil',
    title: 'Neutrophil',
    shortLabel: 'Neutrophil',
    family: 'Acute inflammatory cell',
    relativeSize: 'Slightly larger than a small mature lymphocyte',
    oneLook: 'A segmented multilobed nucleus in pale, finely granular cytoplasm.',
    nucleus: 'Two to five connected lobes in a mature cell; degeneration can blur this pattern.',
    cytoplasm: 'Pale with fine granules that may be subtle on a rapid stain.',
    arrangement:
      'Usually single cells, often numerous in acute inflammation or a necrotic background.',
    onsiteMeaning:
      'Neutrophils support an acute inflammatory pattern but do not identify the cause. Infection, tissue injury, and necrotic tumor can overlap.',
    pitfall:
      'Degenerated neutrophils can look dark and smudged. Do not mistake inflammation or necrosis for a specific organism or tumor.',
    diagramVariant: 'neutrophil',
    diagramAlt:
      'Schematic neutrophil with a connected multilobed nucleus and pale granular cytoplasm.',
    features: [
      {
        id: 'neutrophil-nucleus',
        label: 'Segmented nucleus',
        description: 'Connected nuclear lobes are the fastest clue to a mature neutrophil.',
        xPct: 49,
        yPct: 48,
      },
      {
        id: 'neutrophil-granules',
        label: 'Fine cytoplasmic granules',
        description: 'Subtle granules sit in a pale cytoplasmic background.',
        xPct: 70,
        yPct: 61,
      },
      {
        id: 'neutrophil-context',
        label: 'Inflammatory context',
        description:
          'Interpret the population with necrosis, organisms, mucus, and other cells across the smear.',
        xPct: 24,
        yPct: 31,
      },
    ],
  },
  {
    id: 'macrophage',
    title: 'Alveolar macrophage',
    shortLabel: 'Macrophage',
    family: 'Histiocytic cell',
    relativeSize: 'Large and often several times the size of a small lymphocyte',
    oneLook:
      'A large single cell with abundant foamy or vacuolated cytoplasm and an eccentric nucleus.',
    nucleus:
      'Round, oval, or bean-shaped; usually less dark than a small lymphocyte and often eccentric.',
    cytoplasm:
      'Abundant and variable—foamy, vacuolated, pigmented, or filled with ingested material.',
    arrangement: 'Usually discohesive single cells; size and cytoplasmic contents may vary widely.',
    onsiteMeaning:
      'Macrophages may support pulmonary or alveolar sampling and can carry pigment or debris, but they do not by themselves establish lesion representation.',
    pitfall:
      'Vacuolated macrophages can mimic glandular tumor cells. Look for true epithelial cohesion, nuclear atypia, and a reproducible lesional population.',
    diagramVariant: 'macrophage',
    diagramAlt:
      'Schematic alveolar macrophage with abundant foamy vacuolated cytoplasm and an eccentric oval nucleus.',
    features: [
      {
        id: 'macrophage-nucleus',
        label: 'Eccentric softer nucleus',
        description:
          'The nucleus is displaced from center and is usually less densely stained than a lymphocyte nucleus.',
        xPct: 40,
        yPct: 51,
      },
      {
        id: 'macrophage-cytoplasm',
        label: 'Abundant foamy cytoplasm',
        description: 'Wide cytoplasm is the dominant visual feature of the cell.',
        xPct: 67,
        yPct: 57,
      },
      {
        id: 'macrophage-inclusions',
        label: 'Vacuoles or ingested material',
        description:
          'Clear spaces and pigment reflect phagocytic activity but are not disease-specific.',
        xPct: 66,
        yPct: 35,
      },
    ],
  },
  {
    id: 'malignant-epithelial',
    title: 'Malignant epithelial population',
    shortLabel: 'Malignant epithelial cells',
    family: 'Broad lesional pattern',
    relativeSize: 'Variable; often larger and less uniform than background lymphocytes',
    oneLook:
      'A reproducible crowded or three-dimensional epithelial group with nuclear abnormality.',
    nucleus:
      'Enlarged and irregular with crowding, overlap, coarse chromatin, or prominent nucleoli depending on the tumor.',
    cytoplasm: 'Variable from scant to abundant; may be vacuolated, dense, or fragile.',
    arrangement:
      'Often cohesive and disordered, but some malignancies are discohesive. Reproducibility matters more than one striking cell.',
    onsiteMeaning:
      'A malignant epithelial pattern can support a broad ROSE category and guide specimen preservation. Final type and biomarker adequacy remain pending.',
    pitfall:
      'Reactive bronchial cells, macrophages, crush, and thick smears can mimic malignancy. One atypical cell or one dark cluster is not enough.',
    diagramVariant: 'malignant-epithelial',
    diagramAlt:
      'Schematic crowded malignant epithelial cell group with irregular overlapping nuclei, variable cytoplasm, and visible nucleoli.',
    features: [
      {
        id: 'malignant-nuclei',
        label: 'Irregular crowded nuclei',
        description: 'Variation in size, contour, and chromatin creates architectural disorder.',
        xPct: 52,
        yPct: 46,
      },
      {
        id: 'malignant-nucleoli',
        label: 'Nucleoli and chromatin',
        description:
          'Prominent nucleoli or coarse chromatin can support atypia but are not interpreted alone.',
        xPct: 63,
        yPct: 38,
      },
      {
        id: 'malignant-arrangement',
        label: 'Disordered three-dimensional group',
        description:
          'Overlap, crowding, and loss of polarity distinguish the group from an orderly bronchial sheet.',
        xPct: 46,
        yPct: 72,
      },
    ],
  },
  {
    id: 'red-blood-cell',
    title: 'Red blood cells',
    shortLabel: 'Red cells',
    family: 'Blood background / scale clue',
    relativeSize: 'Small and relatively uniform',
    oneLook: 'Multiple smooth anucleate discs with central pallor.',
    nucleus: 'Absent in mature red blood cells.',
    cytoplasm:
      'Uniform pink to salmon-colored material with central pallor depending on the stain.',
    arrangement: 'Numerous separate discs that may dominate a blood-diluted aspirate.',
    onsiteMeaning:
      'Red cells help calibrate scale and identify blood dilution. Abundant blood is cellular material, not proof of target representation.',
    pitfall:
      'A very bloody smear can hide rare diagnostic groups. Search clot and thin edges without equating blood cellularity with adequacy.',
    diagramVariant: 'red-blood-cell',
    diagramAlt:
      'Schematic group of red blood cells shown as smooth anucleate discs with central pallor.',
    features: [
      {
        id: 'red-cell-no-nucleus',
        label: 'No nucleus',
        description:
          'Mature red cells are anucleate, unlike every other population in this comparison.',
        xPct: 50,
        yPct: 48,
      },
      {
        id: 'red-cell-pallor',
        label: 'Central pallor',
        description: 'The lighter center helps create the familiar disc appearance.',
        xPct: 71,
        yPct: 62,
      },
      {
        id: 'red-cell-background',
        label: 'Blood-dominant field',
        description:
          'Many uniform discs indicate blood dilution rather than a lesional population.',
        xPct: 24,
        yPct: 32,
      },
    ],
  },
]

export const cellPopulationSources: CellPopulationSource[] = [
  {
    title: 'WHO reporting system for lung cytopathology review',
    citation:
      'Dolezal D, Kholová I, Cai G. J Clin Transl Pathol. 2024;4(1):18-35. doi:10.14218/JCTP.2023.00068.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
  },
  {
    title: 'Lung cytopathology: bronchial and aspiration cytology',
    citation: 'Li QK, Khalbuss WE. Lung Cytopathology. 2015. doi:10.1007/978-1-4939-1477-7_1.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7319090/',
  },
  {
    title: 'Non-neoplastic mimics of lung cancer',
    citation:
      'Robledano R, Argueta A, Labiano T, Lozano MD. Cancer Cytopathol. 2025;e70039. doi:10.1002/cncy.70039.',
    url: 'https://doi.org/10.1002/cncy.70039',
  },
]

export const defaultCellPopulationId: CellPopulationId = 'lymphocyte'

export function getCellPopulation(id: CellPopulationId) {
  return cellPopulations.find((population) => population.id === id) ?? cellPopulations[0]
}
