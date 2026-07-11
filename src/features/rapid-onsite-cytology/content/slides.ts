import type { CytologyAnnotation, CytologySlide, CytologySlideSource } from '../engine/types'

const commonsAdenocarcinomaSource: CytologySlideSource = {
  articleTitle: 'Wikimedia Commons - File:Lung adenocarcinoma - Diff-Quik -- high mag.jpg',
  articleUrl:
    'https://commons.wikimedia.org/wiki/File:Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  attribution: 'Librepath, via Wikimedia Commons',
  modificationNote:
    'The source image is displayed without image edits. Interactive hotspot overlays and teaching text were added by InterventionalPulm.com and are not part of the source image.',
}

const commonsAdenocarcinomaVeryHighSource: CytologySlideSource = {
  articleTitle: 'Wikimedia Commons - File:Lung adenocarcinoma - Diff-Quik -- very high mag.jpg',
  articleUrl:
    'https://commons.wikimedia.org/wiki/File:Lung_adenocarcinoma_-_Diff-Quik_--_very_high_mag.jpg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  attribution: 'Librepath, via Wikimedia Commons',
  modificationNote:
    'The source image is displayed without image edits. Interactive hotspot overlays and teaching text were added by InterventionalPulm.com and are not part of the source image.',
}

const whoCytopathologySource: CytologySlideSource = {
  articleTitle:
    'The World Health Organization Reporting System for Lung Cytopathology - A Review of the First Edition',
  articleUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Dolezal et al., Journal of Clinical and Translational Pathology, 2024',
  modificationNote:
    'Figure 7 is displayed without image edits. Interactive hotspot overlays and teaching text were added by InterventionalPulm.com and are not part of the source figure.',
}

const roseSource: CytologySlideSource = {
  articleTitle:
    'Efficacy of rapid on-site cytological evaluation (ROSE) by a pulmonologist in determining specimen adequacy and diagnostic accuracy in interventional diagnosis of lung lesions',
  articleUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7871052/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Yuan et al., Journal of International Medical Research, 2021',
  modificationNote:
    'Figure 2 is displayed without image edits. Interactive hotspot overlays and teaching text were added by InterventionalPulm.com and are not part of the source figure.',
}

const broadMorphologyChoices = [
  { id: 'malignant-epithelial', label: 'Malignant epithelial pattern' },
  { id: 'high-grade-small-cell', label: 'High-grade small-cell pattern' },
  {
    id: 'granulomatous-inflammatory',
    label: 'Granulomatous or infection-associated inflammatory pattern',
  },
  { id: 'background', label: 'Benign or nonspecific background element' },
]

function rotatedChoices(seed: string, correctChoiceId: string) {
  const offset =
    [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    broadMorphologyChoices.length
  const rotated = broadMorphologyChoices.map(
    (_, index) => broadMorphologyChoices[(index + offset) % broadMorphologyChoices.length],
  )

  if (rotated[0]?.id !== correctChoiceId) {
    return rotated
  }

  return [...rotated.slice(1), rotated[0]]
}

function annotation(
  input: Omit<CytologyAnnotation, 'quiz'> & {
    correctChoiceId: string
  },
): CytologyAnnotation {
  const { correctChoiceId, ...annotationInput } = input

  return {
    ...annotationInput,
    quiz: {
      prompt: 'Which broad morphology category best fits the marked region?',
      choices: rotatedChoices(input.id, correctChoiceId),
      correctChoiceId,
    },
  }
}

export const cytologySlides: CytologySlide[] = [
  {
    id: 'diff-quik-adenocarcinoma-high',
    title: 'Lung adenocarcinoma: Diff-Quik high magnification',
    quizTitle: 'Direct-smear morphology exercise 1',
    shortTitle: 'Adenocarcinoma high mag',
    diagnosisTheme: 'Malignant glandular cytology',
    stain: 'Diff-Quik',
    preparation: 'Direct cytology smear, Diff-Quik stain; high-magnification source image.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/d/de/Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
    imageAlt: 'Diff-Quik cytology smear showing lung adenocarcinoma at high magnification.',
    quizImageAlt: 'Unlabeled high-magnification Diff-Quik cytology image for morphology practice.',
    source: commonsAdenocarcinomaSource,
    learningObjectives: [
      'Recognize a cohesive, crowded malignant epithelial population.',
      'Compare lesional groups with smaller dispersed background cells.',
      'Separate representative morphology from adequacy for downstream testing.',
    ],
    annotations: [
      annotation({
        id: 'adeno-high-3d-cluster',
        label: 'Crowded three-dimensional epithelial group',
        cellType: 'Malignant glandular epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 69, yPct: 55, radiusXPct: 12, radiusYPct: 13 },
        featureTags: ['three-dimensional group', 'nuclear overlap', 'epithelial cohesion'],
        explanation:
          'This cohesive blue group is crowded and three-dimensional, supporting a malignant epithelial pattern in this source case.',
        diagnosticSignificance:
          'The group supports representative, interpretable lesional sampling for a morphology endpoint. It does not by itself prove that enough material remains for cell block, immunostains, or molecular testing.',
        pitfall:
          'Reactive bronchial epithelium can also be cohesive. Confirm architectural disorder and nuclear atypia in interpretable, thinner areas before making an onsite category call.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'adeno-high-nuclear-crowding',
        label: 'Nuclear crowding and overlap',
        cellType: 'Atypical epithelial population',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 59, yPct: 47, radiusXPct: 7, radiusYPct: 8 },
        featureTags: ['overlap', 'hyperchromasia', 'architectural disorder'],
        explanation:
          'Overlapping hyperchromatic nuclei make this portion of the group darker and denser than the surrounding cells.',
        diagnosticSignificance:
          'Crowding adds support for a lesional epithelial population when the nuclei remain interpretable and the finding is reproducible elsewhere on the smear.',
        pitfall:
          'Thick smears, crush, and air-drying can manufacture apparent crowding. Do not equate a dark blue focus with malignancy when nuclear detail is obscured.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'adeno-high-background',
        label: 'Dispersed background cells',
        cellType: 'Benign or inflammatory background elements',
        category: 'background',
        shape: { type: 'ellipse', xPct: 30, yPct: 45, radiusXPct: 10, radiusYPct: 11 },
        featureTags: ['background', 'size comparison', 'field assessment'],
        explanation:
          'The smaller dispersed cells provide an internal comparison for the crowded epithelial group elsewhere in the field.',
        diagnosticSignificance:
          'Background elements can help calibrate size and chromasia, but their presence alone does not establish target representation or endpoint-specific adequacy.',
        pitfall:
          'A busy background can distract from the central question: is there a reproducible, interpretable population that represents the sampled target?',
        correctChoiceId: 'background',
      }),
    ],
  },
  {
    id: 'diff-quik-adenocarcinoma-very-high',
    title: 'Lung adenocarcinoma: Diff-Quik very high magnification',
    quizTitle: 'Direct-smear morphology exercise 2',
    shortTitle: 'Adenocarcinoma very high',
    diagnosisTheme: 'Nuclear and cytoplasmic detail',
    stain: 'Diff-Quik',
    preparation: 'Direct cytology smear, Diff-Quik stain; very-high-magnification source image.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/5/59/Lung_adenocarcinoma_-_Diff-Quik_--_very_high_mag.jpg',
    imageAlt: 'Very high magnification Diff-Quik cytology smear of lung adenocarcinoma.',
    quizImageAlt:
      'Unlabeled very-high-magnification Diff-Quik cytology image for morphology practice.',
    source: commonsAdenocarcinomaVeryHighSource,
    learningObjectives: [
      'Integrate architecture, nuclear detail, and cytoplasm rather than one isolated feature.',
      'Distinguish a vacuolated epithelial group from macrophages using cohesion and atypia.',
      'Use thin, interpretable areas when thick regions obscure detail.',
    ],
    annotations: [
      annotation({
        id: 'adeno-vh-cytoplasm',
        label: 'Vacuolated cohesive epithelial group',
        cellType: 'Malignant glandular epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 71, yPct: 43, radiusXPct: 12, radiusYPct: 16 },
        featureTags: ['vacuolated cytoplasm', 'cohesion', 'nuclear atypia'],
        explanation:
          'Relatively abundant blue, vacuolated cytoplasm is present within a cohesive atypical epithelial group.',
        diagnosticSignificance:
          'In combination with architecture and nuclear atypia, this supports a malignant epithelial category in the source case and confirms lesional representation for rapid communication.',
        pitfall:
          'Macrophages may be vacuolated. Cohesion and epithelial nuclear atypia are needed before treating vacuolation as a tumor clue.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'adeno-vh-nucleoli',
        label: 'Enlarged atypical nuclei',
        cellType: 'Atypical glandular nuclei',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 62, yPct: 34, radiusXPct: 8, radiusYPct: 9 },
        featureTags: ['nuclear enlargement', 'nucleolar detail', 'atypia'],
        explanation:
          'The enlarged nuclei and visible nucleolar detail add weight to a malignant epithelial interpretation in this cohesive group.',
        diagnosticSignificance:
          'Preserved nuclear detail makes the group interpretable. Quantity for ancillary testing must still be assessed separately in the material reserved for that endpoint.',
        pitfall:
          'Reactive bronchial cells can show nucleoli. Interpret nuclear detail together with architectural disorder, cytoplasm, and the sampled target.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'adeno-vh-single-cells',
        label: 'Single-cell comparison field',
        cellType: 'Background cells',
        category: 'background',
        shape: { type: 'ellipse', xPct: 34, yPct: 55, radiusXPct: 8, radiusYPct: 11 },
        featureTags: ['background', 'internal comparison', 'field scan'],
        explanation:
          'Nearby smaller cells provide an internal comparison for size and chromasia against the lesional group.',
        diagnosticSignificance:
          'Relative comparison supports disciplined pattern recognition, but this field alone is not evidence of target representation.',
        pitfall:
          'Do not let one striking group replace a full smear scan or the separate assessment of material available for downstream tests.',
        correctChoiceId: 'background',
      }),
    ],
  },
  {
    id: 'who-adenocarcinoma-patterns',
    title: 'WHO review: adenocarcinoma cytomorphologic patterns',
    quizTitle: 'Multipanel morphology exercise 3',
    shortTitle: 'Adenocarcinoma patterns',
    diagnosisTheme: 'Variation across cytology preparations',
    stain: 'Papanicolaou and Diff-Quik',
    preparation:
      'Source Figure 7: (a) Pap, liquid-based; (b) Diff-Quik smear; (c) Pap smear; (d) Pap, liquid-based.',
    imageUrl:
      'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/d1a6/11086742/167b54f03ccf/nihms-1985348-f0007.jpg',
    imageAlt:
      'Four-panel source figure showing cytomorphologic patterns of lung adenocarcinoma across Papanicolaou and Diff-Quik preparations.',
    quizImageAlt:
      'Unlabeled four-panel lung cytology source figure using Papanicolaou and Diff-Quik preparations.',
    source: whoCytopathologySource,
    learningObjectives: [
      'Recognize that one tumor category can appear dispersed, cohesive, or sheet-like.',
      'Account for preparation and stain before comparing cytoplasmic and nuclear detail.',
      'Avoid treating cellularity alone as proof of adequacy for every clinical endpoint.',
    ],
    annotations: [
      annotation({
        id: 'who-adeno-panel-a',
        label: 'Dispersed well-differentiated tumor cells',
        cellType: 'Malignant glandular epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 21, yPct: 23, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['dispersed cells', 'conspicuous nucleoli', 'Pap liquid-based'],
        explanation:
          'Panel A shows dispersed tumor cells with relatively regular round nuclei and conspicuous nucleoli on a Pap-stained liquid-based preparation.',
        diagnosticSignificance:
          'A malignant epithelial population may be dispersed rather than overtly gland-forming; interpretability and reproducibility matter more than one stereotyped architecture.',
        pitfall:
          'Macrophages and reactive bronchial cells may also be dispersed. Use the full cytomorphologic pattern and final preparation for classification.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'who-adeno-panel-b',
        label: 'Cohesive vacuolated tumor fragment',
        cellType: 'Malignant glandular epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 72, yPct: 25, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['cohesive fragment', 'vacuolated cytoplasm', 'Diff-Quik smear'],
        explanation:
          'Panel B shows a cohesive tumor fragment with peripherally placed nuclei and vacuolated cytoplasm on a Diff-Quik smear.',
        diagnosticSignificance:
          'The architecture supports representative lesional sampling, while the amount reserved for cell block or molecular studies remains a separate adequacy question.',
        pitfall:
          'Confirm that nuclei are present and interpretable; mucus, stain precipitate, or thick material can simulate a blue cellular focus.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'who-adeno-panel-c',
        label: 'Atypical tumor cells in inflammation',
        cellType: 'Malignant glandular epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 27, yPct: 70, radiusXPct: 15, radiusYPct: 12 },
        featureTags: ['enlarged round nuclei', 'delicate cytoplasm', 'Pap smear'],
        explanation:
          'Panel C shows tumor cells with enlarged round nuclei and delicate cytoplasm admixed with inflammatory cells on a Pap smear.',
        diagnosticSignificance:
          'Lesional cells can be present in an inflammatory background. The onsite call should describe the broad category and reserve definitive classification for complete review.',
        pitfall:
          'Inflammation can produce reactive atypia. Seek a reproducible epithelial population with convincing architectural or nuclear abnormality.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'who-adeno-panel-d',
        label: 'Crowded poorly differentiated tumor sheet',
        cellType: 'Malignant epithelial cell sheet',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 73, yPct: 75, radiusXPct: 17, radiusYPct: 12 },
        featureTags: ['loss of polarity', 'pleomorphism', 'Pap liquid-based'],
        explanation:
          'Panel D shows a crowded sheet with loss of polarity, pleomorphism, and hyperchromasia on a Pap-stained liquid-based preparation.',
        diagnosticSignificance:
          'Abundant lesional cells support morphology adequacy, but ancillary-test sufficiency depends on how much viable material is preserved outside the teaching field.',
        pitfall:
          'Very thick or crowded areas can obscure detail. Confirm the impression in a thinner, interpretable area before communicating a rapid category.',
        correctChoiceId: 'malignant-epithelial',
      }),
    ],
  },
  {
    id: 'rose-diff-quik-montage',
    title: 'ROSE Diff-Quik examples: carcinoma and granulomatous inflammation',
    quizTitle: 'Multipanel morphology exercise 4',
    shortTitle: 'ROSE montage',
    diagnosisTheme: 'Broad-pattern recognition across four cases',
    stain: 'Diff-Quik',
    preparation:
      'Four source-case direct smears stained with Diff-Quik: panels a-c at 100x and panel d at 40x.',
    imageUrl:
      'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/09d8/7871052/7ed5a4311152/10.1177_0300060520982687-fig2.jpg',
    imageAlt:
      'Four-panel ROSE Diff-Quik source figure showing adenocarcinoma, squamous cell carcinoma, small cell carcinoma, and tuberculosis-associated granulomatous inflammation.',
    quizImageAlt: 'Unlabeled four-panel Diff-Quik ROSE source figure for broad-pattern practice.',
    source: roseSource,
    learningObjectives: [
      'Classify a rapid smear into a broad epithelial, small-cell, inflammatory, or background pattern.',
      'Use multiple features rather than a single color or cell-size clue.',
      'Translate morphology into specimen triage without overcalling a final diagnosis.',
    ],
    annotations: [
      annotation({
        id: 'rose-adeno-panel',
        label: 'Cohesive glandular epithelial pattern',
        cellType: 'Malignant epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 24, yPct: 23, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['small cohesive clusters', 'delicate cytoplasm', 'panel a'],
        explanation:
          'Panel A shows small clusters of relatively uniform-appearing glandular cells with delicate cytoplasm in the source adenocarcinoma case.',
        diagnosticSignificance:
          'The safe rapid category is malignant epithelial. Confirming lesional cells can guide preservation of additional material for final typing and biomarkers.',
        pitfall:
          'Do not force a definitive subtype from scant or poorly preserved material; final classification requires the complete specimen and appropriate ancillary studies.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'rose-squamous-panel',
        label: 'Malignant epithelial pattern in necrotic background',
        cellType: 'Malignant epithelial cells with squamous features',
        category: 'squamous-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 75, yPct: 22, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['large nuclei', 'macronucleoli', 'dirty necrotic background'],
        explanation:
          'Panel B shows malignant epithelial cells with large nuclei, macronucleoli, variable nuclear-to-cytoplasmic ratios, and a dirty necrotic background.',
        diagnosticSignificance:
          'A malignant epithelial onsite category is sufficient for immediate triage; squamous classification should remain preliminary until full review.',
        pitfall:
          'Necrosis and reactive squamous metaplasia can mislead. Require convincing malignant nuclei and target-concordant lesional material.',
        correctChoiceId: 'malignant-epithelial',
      }),
      annotation({
        id: 'rose-small-cell-panel',
        label: 'High-grade small-cell pattern',
        cellType: 'Small malignant cells',
        category: 'small-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 26, yPct: 72, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['scant cytoplasm', 'nuclear molding', 'granular chromatin'],
        explanation:
          'Panel C shows small cells with scant cytoplasm, nuclear molding, and dispersed granular chromatin in the source small cell carcinoma case.',
        diagnosticSignificance:
          'A high-grade small-cell pattern should trigger careful preservation for confirmatory immunostains and final classification rather than a stand-alone definitive ROSE diagnosis.',
        pitfall:
          'Lymphocytes and crush artifact may mimic a small-cell neoplasm. Confirm molding and chromatin in preserved cells and correlate with the complete specimen.',
        correctChoiceId: 'high-grade-small-cell',
      }),
      annotation({
        id: 'rose-tb-panel',
        label: 'Granulomatous inflammatory pattern',
        cellType: 'Epithelioid histiocyte aggregates with inflammation',
        category: 'granuloma',
        shape: { type: 'ellipse', xPct: 76, yPct: 72, radiusXPct: 13, radiusYPct: 13 },
        featureTags: ['epithelioid histiocytes', 'necrotic background', 'panel d'],
        explanation:
          'Panel D shows aggregates of epithelioid histiocytes with necrosis and lymphocytes in the source tuberculosis case.',
        diagnosticSignificance:
          'The rapid finding supports a granulomatous or infection-associated inflammatory category and may prompt dedicated microbiology material when clinically indicated.',
        pitfall:
          'Morphology alone does not identify an organism or exclude coexisting malignancy. Final stains, cultures, molecular tests, and target-concordant sampling determine the endpoint.',
        correctChoiceId: 'granulomatous-inflammatory',
      }),
    ],
  },
]

export const defaultCytologySlideId = cytologySlides[0]?.id ?? ''
