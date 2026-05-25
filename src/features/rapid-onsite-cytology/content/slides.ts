import type { CytologyAnnotation, CytologySlide, CytologySlideSource } from '../engine/types'

const commonsAdenocarcinomaSource: CytologySlideSource = {
  articleTitle: 'Wikimedia Commons - File:Lung adenocarcinoma - Diff-Quik -- high mag.jpg',
  articleUrl:
    'https://commons.wikimedia.org/wiki/File:Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  attribution: 'Librepath, via Wikimedia Commons',
}

const commonsAdenocarcinomaVeryHighSource: CytologySlideSource = {
  articleTitle: 'Wikimedia Commons - File:Lung adenocarcinoma - Diff-Quik -- very high mag.jpg',
  articleUrl:
    'https://commons.wikimedia.org/wiki/File:Lung_adenocarcinoma_-_Diff-Quik_--_very_high_mag.jpg',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0',
  attribution: 'Librepath, via Wikimedia Commons',
}

const whoCytopathologySource: CytologySlideSource = {
  articleTitle:
    'The World Health Organization Reporting System for Lung Cytopathology - A Review of the First Edition',
  articleUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11086742/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Dolezal et al., Journal of Clinical and Translational Pathology, 2024',
}

const roseSource: CytologySlideSource = {
  articleTitle:
    'Efficacy of rapid on-site cytological evaluation (ROSE) by a pulmonologist in determining specimen adequacy and diagnostic accuracy in interventional diagnosis of lung lesions',
  articleUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7871052/',
  license: 'CC BY-NC 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'Yuan et al., Journal of International Medical Research, 2021',
}

const liloSource: CytologySlideSource = {
  articleTitle:
    'The critical role of EBUS-TBNA cytology in the staging of mediastinal lymph nodes in lung cancer patients: A correlation study with positron emission tomography findings',
  articleUrl: 'https://acsjournals.onlinelibrary.wiley.com/doi/10.1002/cncy.21886',
  license: 'Wiley Online Library OA Creative Commons notice',
  licenseUrl: 'https://onlinelibrary.wiley.com/terms-and-conditions',
  attribution:
    'Lilo et al., Cancer Cytopathology, 2017. PDF sidebar states OA articles are governed by the applicable Creative Commons License; exact CC subtype was not stated in PDF/Crossref metadata.',
}

const coreChoices = [
  { id: 'adenocarcinoma', label: 'Adenocarcinoma / gland-forming malignant epithelial cells' },
  { id: 'squamous', label: 'Squamous cell carcinoma with keratinizing cytoplasm' },
  { id: 'small-cell', label: 'Small cell carcinoma / high-grade neuroendocrine pattern' },
  { id: 'granuloma', label: 'Granulomatous inflammation / histiocytes' },
  { id: 'infection', label: 'Infectious organism or infection-associated finding' },
  { id: 'benign-background', label: 'Benign background or adequacy element' },
]

function annotation(
  input: Omit<CytologyAnnotation, 'quiz'> & {
    quizPrompt: string
    correctChoiceId: string
  },
): CytologyAnnotation {
  const { correctChoiceId, quizPrompt, ...annotationInput } = input

  return {
    ...annotationInput,
    quiz: {
      prompt: quizPrompt,
      choices: coreChoices,
      correctChoiceId,
    },
  }
}

export const cytologySlides: CytologySlide[] = [
  {
    id: 'diff-quik-adenocarcinoma-high',
    title: 'Lung adenocarcinoma: Diff-Quik high magnification',
    shortTitle: 'Adenocarcinoma high mag',
    diagnosisTheme: 'Malignant glandular cytology',
    stain: 'Diff-Quik',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/d/de/Lung_adenocarcinoma_-_Diff-Quik_--_high_mag.jpg',
    imageAlt: 'Diff-Quik cytology smear showing lung adenocarcinoma at high magnification.',
    source: commonsAdenocarcinomaSource,
    learningObjectives: [
      'Recognize crowded three-dimensional epithelial groups.',
      'Separate malignant glandular clusters from dispersed benign background cells.',
      'Name nuclear features that support rapid malignant interpretation.',
    ],
    annotations: [
      annotation({
        id: 'adeno-high-3d-cluster',
        label: '3D malignant cluster',
        cellType: 'Adenocarcinoma cluster',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 69, yPct: 55, radiusXPct: 12, radiusYPct: 13 },
        featureTags: ['3D group', 'nuclear overlap', 'glandular pattern'],
        explanation:
          'The cohesive blue group forms a crowded three-dimensional cluster, a useful ROSE clue for malignant epithelial cells in adenocarcinoma.',
        diagnosticSignificance:
          'A crowded malignant cluster supports lesional sampling and can justify requesting additional material for cell block and molecular testing.',
        pitfall:
          'Bronchial epithelium may also be cohesive; malignant groups show more nuclear crowding, contour irregularity, and architectural disorder.',
        quizPrompt: 'This crowded cohesive group is most consistent with which interpretation?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'adeno-high-nuclear-crowding',
        label: 'Nuclear crowding',
        cellType: 'Malignant epithelial cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 59, yPct: 47, radiusXPct: 7, radiusYPct: 8 },
        featureTags: ['overlap', 'hyperchromasia', 'high N:C ratio'],
        explanation:
          'Overlapping hyperchromatic nuclei make the group look darker and denser than the surrounding benign background.',
        diagnosticSignificance:
          'Nuclear crowding helps distinguish a diagnostic malignant group from loose macrophages or reactive cells during onsite adequacy assessment.',
        pitfall:
          'Crush, thick smears, and air-drying can exaggerate crowding, so the feature should be interpreted with architecture and cytoplasm.',
        quizPrompt: 'Which category best explains this dense overlapping nuclear focus?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'adeno-high-background',
        label: 'Background cells',
        cellType: 'Background inflammatory/benign cells',
        category: 'background',
        shape: { type: 'ellipse', xPct: 30, yPct: 45, radiusXPct: 10, radiusYPct: 11 },
        featureTags: ['background', 'small cells', 'comparison point'],
        explanation:
          'The dispersed smaller cells provide a size and density comparison for the malignant cluster.',
        diagnosticSignificance:
          'Comparing lesional cells with background elements sharpens recognition of true epithelial atypia.',
        pitfall:
          'Do not overcall scattered background cells; ROSE interpretation depends on finding a reproducible lesional population.',
        quizPrompt: 'This dispersed field is best used as what kind of ROSE clue?',
        correctChoiceId: 'benign-background',
      }),
      annotation({
        id: 'adeno-high-acinar-edge',
        label: 'Cluster edge',
        cellType: 'Adenocarcinoma edge cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 77, yPct: 65, radiusXPct: 7, radiusYPct: 8 },
        featureTags: ['irregular edge', 'epithelial cohesion', 'cell group'],
        explanation:
          'Cells at the edge of the group still hold together, reinforcing the epithelial nature of the lesion.',
        diagnosticSignificance:
          'Cohesion plus nuclear atypia is a rapid clue for carcinoma rather than isolated inflammation.',
        pitfall:
          'A single cohesive group should be interpreted with smear cellularity and clinical/radiographic context.',
        quizPrompt: 'What is the best classification for this cohesive atypical edge?',
        correctChoiceId: 'adenocarcinoma',
      }),
    ],
  },
  {
    id: 'diff-quik-adenocarcinoma-very-high',
    title: 'Lung adenocarcinoma: Diff-Quik very high magnification',
    shortTitle: 'Adenocarcinoma very high',
    diagnosisTheme: 'Nuclear detail and cytoplasm',
    stain: 'Diff-Quik',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/5/59/Lung_adenocarcinoma_-_Diff-Quik_--_very_high_mag.jpg',
    imageAlt: 'Very high magnification Diff-Quik cytology smear of lung adenocarcinoma.',
    source: commonsAdenocarcinomaVeryHighSource,
    learningObjectives: [
      'Inspect nuclear enlargement and irregularity.',
      'Identify cytoplasmic volume and vacuolated glandular character.',
      'Practice comparing malignant groups with nearby single cells.',
    ],
    annotations: [
      annotation({
        id: 'adeno-vh-cytoplasm',
        label: 'Vacuolated cytoplasm',
        cellType: 'Adenocarcinoma cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 71, yPct: 43, radiusXPct: 12, radiusYPct: 16 },
        featureTags: ['cytoplasm', 'vacuoles', 'glandular differentiation'],
        explanation:
          'The lesional cells show relatively abundant blue cytoplasm with vacuolated/glandular quality.',
        diagnosticSignificance:
          'Cytoplasmic vacuolation and cohesive clusters can support adenocarcinoma over small cell carcinoma in a rapid smear assessment.',
        pitfall:
          'Macrophages can be vacuolated; malignant epithelial cells should also show nuclear atypia and cohesive architecture.',
        quizPrompt: 'Which interpretation best fits this vacuolated cohesive epithelial group?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'adeno-vh-nucleoli',
        label: 'Prominent nuclei',
        cellType: 'Atypical glandular nuclei',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 62, yPct: 34, radiusXPct: 8, radiusYPct: 9 },
        featureTags: ['nuclear enlargement', 'nucleoli', 'atypia'],
        explanation:
          'Enlarged nuclei and visible nucleolar detail add weight to the malignant interpretation.',
        diagnosticSignificance:
          'Nuclear detail is especially helpful when the smear has limited cellularity but a suspicious epithelial group is present.',
        pitfall:
          'Reactive bronchial cells can have nucleoli; architecture and cytoplasmic pattern keep the interpretation grounded.',
        quizPrompt: 'This nuclear detail most strongly supports which category?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'adeno-vh-single-cells',
        label: 'Single-cell comparison',
        cellType: 'Background cells',
        category: 'background',
        shape: { type: 'ellipse', xPct: 34, yPct: 55, radiusXPct: 8, radiusYPct: 11 },
        featureTags: ['background', 'comparison', 'cell size'],
        explanation:
          'Nearby smaller cells help calibrate cell size and chromasia against the lesional cluster.',
        diagnosticSignificance:
          'Relative comparison makes rapid interpretation more reliable than judging one cluster in isolation.',
        pitfall:
          'Avoid letting one striking cluster distract from the overall smear adequacy and representativeness.',
        quizPrompt: 'In ROSE teaching, this area is most useful as what?',
        correctChoiceId: 'benign-background',
      }),
      annotation({
        id: 'adeno-vh-dark-cluster',
        label: 'Dense tumor focus',
        cellType: 'Adenocarcinoma cluster',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 52, yPct: 39, radiusXPct: 7, radiusYPct: 8 },
        featureTags: ['dense cluster', 'hyperchromasia', 'malignant group'],
        explanation:
          'This darker portion of the group reflects nuclear overlap and hyperchromasia within the tumor cluster.',
        diagnosticSignificance:
          'A dense tumor focus can be enough to mark the specimen adequate when it matches the clinical target.',
        pitfall:
          'Thick smear artifact can create dense blue areas; a true tumor group should preserve interpretable cell borders and nuclei.',
        quizPrompt: 'This dense blue cluster is most consistent with what?',
        correctChoiceId: 'adenocarcinoma',
      }),
    ],
  },
  {
    id: 'who-adenocarcinoma-patterns',
    title: 'WHO lung cytopathology adenocarcinoma patterns',
    shortTitle: 'Adenocarcinoma patterns',
    diagnosisTheme: 'Pattern recognition across preparations',
    stain: 'Papanicolaou and Diff-Quik panels',
    imageUrl:
      'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/d1a6/11086742/167b54f03ccf/nihms-1985348-f0007.jpg',
    imageAlt: 'Panel of cytology patterns of lung adenocarcinoma.',
    source: whoCytopathologySource,
    learningObjectives: [
      'Compare single cells, three-dimensional groups, and dense cell clusters.',
      'Recognize that adenocarcinoma may present in multiple cytologic patterns.',
      'Link pattern recognition to triage for cell block and molecular studies.',
    ],
    annotations: [
      annotation({
        id: 'who-adeno-panel-a',
        label: 'Discohesive atypical cells',
        cellType: 'Adenocarcinoma cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 21, yPct: 23, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['discohesive cells', 'atypia', 'Pap stain'],
        explanation:
          'Adenocarcinoma may appear as loose atypical cells rather than only obvious glandular clusters.',
        diagnosticSignificance:
          'Loose malignant cells can still establish onsite adequacy when cytologic atypia is convincing.',
        pitfall:
          'Single atypical cells should be separated from macrophages and reactive bronchial cells.',
        quizPrompt: 'Which category best fits these atypical discohesive cells?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'who-adeno-panel-b',
        label: '3D cluster',
        cellType: 'Adenocarcinoma cluster',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 72, yPct: 25, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['3D cluster', 'Diff-Quik', 'nuclear crowding'],
        explanation:
          'The three-dimensional clustered arrangement is a common rapid clue to malignant epithelial sampling.',
        diagnosticSignificance:
          'Clustered tumor can be prioritized for cell block preparation when ROSE confirms lesional material.',
        pitfall:
          'Do not mistake mucus or stain precipitate for cell groups; nuclei should be visible within the cluster.',
        quizPrompt: 'This clustered arrangement supports which interpretation?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'who-adeno-panel-c',
        label: 'Papillary-like group',
        cellType: 'Adenocarcinoma group',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 27, yPct: 70, radiusXPct: 15, radiusYPct: 12 },
        featureTags: ['papillary group', 'cohesion', 'glandular pattern'],
        explanation:
          'This cohesive group illustrates how glandular tumors can form larger architectural fragments.',
        diagnosticSignificance:
          'Architectural fragments can make ROSE more confident than rare isolated atypical cells.',
        pitfall:
          'Benign bronchial sheets are flatter and more orderly; malignant groups often have crowding and irregular contour.',
        quizPrompt: 'What is the best classification for this cohesive atypical group?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'who-adeno-panel-d',
        label: 'Dense tumor sheet',
        cellType: 'Adenocarcinoma cell sheet',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 73, yPct: 75, radiusXPct: 17, radiusYPct: 12 },
        featureTags: ['tumor sheet', 'cellularity', 'diagnostic material'],
        explanation:
          'The dense cellular sheet provides abundant lesional material, but details may be harder to inspect in thick areas.',
        diagnosticSignificance:
          'A cellular tumor sheet usually indicates adequacy, while additional passes may be triaged for ancillary testing.',
        pitfall:
          'Very thick fragments can obscure detail; use thinner areas of the smear to confirm nuclear features.',
        quizPrompt: 'This dense cellular region is most consistent with what?',
        correctChoiceId: 'adenocarcinoma',
      }),
    ],
  },
  {
    id: 'rose-diff-quik-montage',
    title: 'ROSE Diff-Quik examples: carcinoma and infection',
    shortTitle: 'ROSE montage',
    diagnosisTheme: 'Rapid differential pattern recognition',
    stain: 'Diff-Quik',
    imageUrl:
      'https://cdn.ncbi.nlm.nih.gov/pmc/blobs/09d8/7871052/7ed5a4311152/10.1177_0300060520982687-fig2.jpg',
    imageAlt:
      'ROSE Diff-Quik examples showing adenocarcinoma, squamous cell carcinoma, small cell carcinoma, and tuberculosis.',
    source: roseSource,
    learningObjectives: [
      'Practice switching between carcinoma patterns on a single ROSE montage.',
      'Recognize high-grade small cell pattern and granulomatous/infectious pattern.',
      'Use broad categories rather than over-specific diagnoses during onsite triage.',
    ],
    annotations: [
      annotation({
        id: 'rose-adeno-panel',
        label: 'Adenocarcinoma pattern',
        cellType: 'Adenocarcinoma cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 24, yPct: 23, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['glandular cluster', 'nucleoli', 'malignant epithelial'],
        explanation:
          'Panel A shows a malignant epithelial pattern with glandular cytology suitable for rapid adenocarcinoma recognition.',
        diagnosticSignificance:
          'ROSE can confirm lesional material and help route subsequent passes to cell block or molecular testing.',
        pitfall:
          'ROSE subtype calls should remain appropriately cautious when only a small amount of material is present.',
        quizPrompt: 'Which ROSE category best fits this panel?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'rose-squamous-panel',
        label: 'Squamous carcinoma pattern',
        cellType: 'Squamous cell carcinoma cells',
        category: 'squamous-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 75, yPct: 22, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['dense cytoplasm', 'cluster', 'squamous differentiation'],
        explanation:
          'Panel B shows a cohesive malignant group with denser cytoplasm, supporting squamous differentiation.',
        diagnosticSignificance:
          'Recognizing squamous morphology can inform immediate communication while final classification awaits full review.',
        pitfall:
          'Keratin debris and reactive squamous metaplasia can confuse interpretation; nuclear atypia remains key.',
        quizPrompt: 'Which category best matches this dense cohesive malignant group?',
        correctChoiceId: 'squamous',
      }),
      annotation({
        id: 'rose-small-cell-panel',
        label: 'Small cell pattern',
        cellType: 'Small cell carcinoma cells',
        category: 'small-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 26, yPct: 72, radiusXPct: 12, radiusYPct: 12 },
        featureTags: ['high N:C ratio', 'nuclear molding', 'fragile cells'],
        explanation:
          'Panel C shows small hyperchromatic cells with high nuclear-to-cytoplasmic ratio, a rapid clue to small cell carcinoma.',
        diagnosticSignificance:
          'A suspected small cell pattern should trigger careful triage for confirmatory immunostains and staging context.',
        pitfall:
          'Crush artifact and lymphocytes may mimic small blue cells; evaluate molding, chromatin, and clinical context.',
        quizPrompt: 'Which interpretation best fits these small hyperchromatic cells?',
        correctChoiceId: 'small-cell',
      }),
      annotation({
        id: 'rose-tb-panel',
        label: 'Granulomatous/infectious pattern',
        cellType: 'Granulomatous inflammation',
        category: 'granuloma',
        shape: { type: 'ellipse', xPct: 76, yPct: 72, radiusXPct: 13, radiusYPct: 13 },
        featureTags: ['granuloma', 'infection context', 'inflammation'],
        explanation:
          'Panel D demonstrates a granulomatous/infectious pattern rather than carcinoma.',
        diagnosticSignificance:
          'Finding granulomatous inflammation onsite can redirect specimen handling toward microbiology and special stains.',
        pitfall:
          'Necrotic tumors can coexist with inflammation; a benign/infectious impression must fit the sampled target and final stains.',
        quizPrompt: 'Which broad ROSE category best fits this pattern?',
        correctChoiceId: 'granuloma',
      }),
    ],
  },
  {
    id: 'lilo-ebus-adenocarcinoma',
    title: 'EBUS-TBNA metastatic adenocarcinoma',
    shortTitle: 'EBUS adeno',
    diagnosisTheme: 'Metastatic adenocarcinoma in lymph node',
    stain: 'Diff-Quik and H&E cell block',
    imageUrl:
      '/images/creative-commons/pathology/lilo-2017-ebus-tbna-fig3-metastatic-adenocarcinoma-cytology.jpg',
    imageAlt: 'EBUS-TBNA cytology and cell block showing metastatic lung adenocarcinoma.',
    source: liloSource,
    learningObjectives: [
      'Compare Diff-Quik smear and cell block confirmation.',
      'Identify malignant glandular cytology in a lymph node sampling context.',
      'Recognize why ROSE adequacy matters for staging and ancillary testing.',
    ],
    annotations: [
      annotation({
        id: 'lilo-adeno-diff-quik-cluster',
        label: 'Diff-Quik tumor cluster',
        cellType: 'Metastatic adenocarcinoma cells',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 24, yPct: 43, radiusXPct: 13, radiusYPct: 18 },
        featureTags: ['Diff-Quik', 'tumor cluster', 'lymph node'],
        explanation:
          'The left panel shows a blue malignant cell cluster sampled by EBUS-TBNA from a PET-positive lymph node.',
        diagnosticSignificance:
          'A tumor cluster in a mediastinal node is staging-relevant and usually warrants preserving material for cell block.',
        pitfall:
          'ROSE should communicate adequacy and preliminary category without replacing final integrated pathology review.',
        quizPrompt: 'This Diff-Quik cluster is best classified as what?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'lilo-adeno-cell-block',
        label: 'Cell block correlate',
        cellType: 'Adenocarcinoma on cell block',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 72, yPct: 42, radiusXPct: 13, radiusYPct: 17 },
        featureTags: ['cell block', 'acinar architecture', 'H&E'],
        explanation:
          'The right panel cell block shows a tissue correlate with glandular/acinar architecture.',
        diagnosticSignificance:
          'Cell block material supports immunohistochemistry and molecular testing after rapid onsite adequacy.',
        pitfall:
          'A smear may be diagnostic while the cell block is scant; onsite triage can reduce that mismatch.',
        quizPrompt: 'The cell block correlate most strongly supports which diagnosis category?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'lilo-adeno-nuclear-detail',
        label: 'Nuclear atypia',
        cellType: 'Malignant glandular nuclei',
        category: 'adenocarcinoma',
        shape: { type: 'ellipse', xPct: 34, yPct: 37, radiusXPct: 7, radiusYPct: 11 },
        featureTags: ['nuclear atypia', 'prominent nuclei', 'malignant'],
        explanation:
          'The tumor focus shows enlarged atypical nuclei within the clustered blue group.',
        diagnosticSignificance:
          'Nuclear atypia anchors the rapid interpretation as malignant rather than merely reactive.',
        pitfall:
          'Do not rely on color intensity alone; thick areas may be dark without clear malignant nuclear detail.',
        quizPrompt: 'Which category best explains this atypical nuclear focus?',
        correctChoiceId: 'adenocarcinoma',
      }),
      annotation({
        id: 'lilo-adeno-lymph-node-context',
        label: 'Lymph node staging context',
        cellType: 'Metastatic tumor context',
        category: 'adequacy',
        shape: { type: 'ellipse', xPct: 58, yPct: 57, radiusXPct: 10, radiusYPct: 14 },
        featureTags: ['staging', 'adequacy', 'cell block'],
        explanation:
          'The paired smear/cell block view emphasizes that adequacy is not just diagnostic; it affects staging and downstream tests.',
        diagnosticSignificance:
          'ROSE can help the operator decide whether additional passes are needed from the same nodal station.',
        pitfall:
          'Adequacy standards vary by clinical question: diagnosis, staging, cultures, flow cytometry, or molecular testing may need different material.',
        quizPrompt: 'This paired smear/cell-block context is most useful for what ROSE decision?',
        correctChoiceId: 'benign-background',
      }),
    ],
  },
  {
    id: 'lilo-ebus-squamous-granuloma',
    title: 'EBUS-TBNA squamous carcinoma versus granuloma',
    shortTitle: 'Squamous vs granuloma',
    diagnosisTheme: 'Malignant squamous cells and benign granulomatous mimic',
    stain: 'Diff-Quik, Papanicolaou, and H&E cell block',
    imageUrl:
      '/images/creative-commons/pathology/lilo-2017-ebus-tbna-fig4-metastatic-squamous-cell-carcinoma-cytology.jpg',
    imageAlt: 'EBUS-TBNA cytology and cell block showing metastatic squamous cell carcinoma.',
    source: liloSource,
    learningObjectives: [
      'Recognize squamous cell carcinoma cytology in a node sample.',
      'Use dense cytoplasm and two-dimensional clusters as subtype clues.',
      'Contrast malignant epithelial features with granulomatous inflammation on a companion slide.',
    ],
    annotations: [
      annotation({
        id: 'lilo-squamous-dq-cluster',
        label: 'Squamous tumor cluster',
        cellType: 'Metastatic squamous cell carcinoma',
        category: 'squamous-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 22, yPct: 43, radiusXPct: 13, radiusYPct: 17 },
        featureTags: ['dense cytoplasm', 'malignant cluster', 'Diff-Quik'],
        explanation:
          'The left panel shows a malignant epithelial cluster with denser cytoplasm than the adenocarcinoma examples.',
        diagnosticSignificance:
          'A squamous pattern can be communicated preliminarily while conserving material for final classification.',
        pitfall:
          'Squamous metaplasia and contamination can mimic squamous cells; malignant nuclear atypia and clinical target matter.',
        quizPrompt: 'Which broad interpretation best fits this malignant cluster?',
        correctChoiceId: 'squamous',
      }),
      annotation({
        id: 'lilo-squamous-keratin-cytoplasm',
        label: 'Dense cytoplasm',
        cellType: 'Squamous carcinoma cells',
        category: 'squamous-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 31, yPct: 46, radiusXPct: 7, radiusYPct: 10 },
        featureTags: ['keratinizing cytoplasm', 'squamous differentiation', 'cytoplasm'],
        explanation:
          'Dense cytoplasm within atypical cells is a helpful clue toward squamous differentiation.',
        diagnosticSignificance:
          'Subtype clues can shape triage, but final typing should integrate cell block morphology and immunostains.',
        pitfall:
          'Necrotic debris can look dense and blue; look for intact atypical cells rather than stain alone.',
        quizPrompt: 'Dense cytoplasm in this atypical group points most toward which category?',
        correctChoiceId: 'squamous',
      }),
      annotation({
        id: 'lilo-squamous-cell-block',
        label: 'Cell block confirmation',
        cellType: 'Squamous carcinoma on cell block',
        category: 'squamous-cell-carcinoma',
        shape: { type: 'ellipse', xPct: 70, yPct: 43, radiusXPct: 15, radiusYPct: 17 },
        featureTags: ['cell block', 'keratinization', 'H&E'],
        explanation:
          'The cell block panel shows tissue architecture that supports the smear impression.',
        diagnosticSignificance:
          'Cell block confirmation is important for ancillary stains when ROSE suggests carcinoma.',
        pitfall: 'ROSE adequacy should ensure enough material remains after smear preparation.',
        quizPrompt: 'Which category best matches this paired cell block correlate?',
        correctChoiceId: 'squamous',
      }),
    ],
  },
  {
    id: 'lilo-ebus-granuloma',
    title: 'EBUS-TBNA granuloma in PET-positive lymph node',
    shortTitle: 'Granuloma',
    diagnosisTheme: 'Benign granulomatous inflammation as PET-positive mimic',
    stain: 'Diff-Quik, Papanicolaou, and H&E cell block',
    imageUrl: '/images/creative-commons/pathology/lilo-2017-ebus-tbna-fig5-granuloma-cytology.jpg',
    imageAlt: 'EBUS-TBNA cytology and cell block showing granulomatous inflammation.',
    source: liloSource,
    learningObjectives: [
      'Identify cohesive epithelioid histiocyte clusters.',
      'Recognize granulomatous inflammation as a PET-positive mimic of malignancy.',
      'Use ROSE to direct microbiology or special stain triage when appropriate.',
    ],
    annotations: [
      annotation({
        id: 'lilo-granuloma-dq',
        label: 'Epithelioid histiocyte cluster',
        cellType: 'Granulomatous inflammation',
        category: 'granuloma',
        shape: { type: 'ellipse', xPct: 24, yPct: 24, radiusXPct: 13, radiusYPct: 13 },
        featureTags: ['epithelioid histiocytes', 'granuloma', 'Diff-Quik'],
        explanation:
          'The Diff-Quik panel shows a cohesive histiocyte cluster compatible with granulomatous inflammation.',
        diagnosticSignificance:
          'Granulomas in PET-positive nodes are a major benign mimic of metastatic cancer.',
        pitfall:
          'Granulomatous inflammation can coexist with malignancy; final correlation and adequate sampling remain essential.',
        quizPrompt: 'Which category best fits this cohesive histiocyte cluster?',
        correctChoiceId: 'granuloma',
      }),
      annotation({
        id: 'lilo-granuloma-pap',
        label: 'Pap-stained granuloma',
        cellType: 'Granuloma',
        category: 'granuloma',
        shape: { type: 'ellipse', xPct: 67, yPct: 25, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['Pap stain', 'granuloma', 'histiocytes'],
        explanation:
          'The Pap-stained panel shows a second preparation with similar granulomatous architecture.',
        diagnosticSignificance:
          'Seeing the same pattern across preparations supports a non-carcinoma interpretation.',
        pitfall:
          'A granuloma diagnosis should prompt consideration of infection, sarcoidosis, treatment effect, and clinical context.',
        quizPrompt: 'This pattern is most consistent with which broad ROSE category?',
        correctChoiceId: 'granuloma',
      }),
      annotation({
        id: 'lilo-granuloma-cell-block',
        label: 'Cell block granuloma',
        cellType: 'Granuloma on cell block',
        category: 'granuloma',
        shape: { type: 'ellipse', xPct: 55, yPct: 70, radiusXPct: 16, radiusYPct: 12 },
        featureTags: ['cell block', 'histiocytes', 'nonmalignant'],
        explanation:
          'The cell block component shows a compact granulomatous focus rather than malignant epithelial architecture.',
        diagnosticSignificance:
          'Cell block tissue can be used for special stains when infection is in the differential.',
        pitfall:
          'Negative ROSE for carcinoma does not automatically end sampling when the clinical question requires cultures or more tissue.',
        quizPrompt: 'Which classification best fits this cell block focus?',
        correctChoiceId: 'granuloma',
      }),
      annotation({
        id: 'lilo-granuloma-background',
        label: 'Inflammatory background',
        cellType: 'Mixed inflammatory cells',
        category: 'background',
        shape: { type: 'ellipse', xPct: 39, yPct: 37, radiusXPct: 8, radiusYPct: 8 },
        featureTags: ['background', 'inflammation', 'not tumor'],
        explanation:
          'The background inflammatory cells reinforce the inflammatory context of the specimen.',
        diagnosticSignificance:
          'Background context helps prevent overcalling granulomatous inflammation as carcinoma.',
        pitfall:
          'Inflammatory backgrounds can accompany necrotic tumors, so the interpretation should remain specimen-wide.',
        quizPrompt: 'This background is best categorized as what?',
        correctChoiceId: 'benign-background',
      }),
    ],
  },
  {
    id: 'lilo-ebus-mai-infection',
    title: 'EBUS-TBNA Mycobacterium avium-intracellulare infection',
    shortTitle: 'MAI infection',
    diagnosisTheme: 'Infectious mimic in PET-positive lymph node',
    stain: 'Diff-Quik, Papanicolaou, H&E, and special stain correlate',
    imageUrl:
      '/images/creative-commons/pathology/lilo-2017-ebus-tbna-fig6-mycobacterium-avium-intracellulare-cytology.jpg',
    imageAlt:
      'EBUS-TBNA cytology and cell block showing Mycobacterium avium-intracellulare infection.',
    source: liloSource,
    learningObjectives: [
      'Recognize infection-associated cytology as a malignant mimic in PET-positive nodes.',
      'Connect ROSE impression with microbiology and special-stain triage.',
      'Avoid overcalling inflammatory or organism-rich material as carcinoma.',
    ],
    annotations: [
      annotation({
        id: 'lilo-mai-dq-inflammation',
        label: 'Inflammatory Diff-Quik field',
        cellType: 'Infection-associated inflammation',
        category: 'infection',
        shape: { type: 'ellipse', xPct: 25, yPct: 26, radiusXPct: 13, radiusYPct: 13 },
        featureTags: ['Diff-Quik', 'inflammation', 'infectious mimic'],
        explanation:
          'The smear field emphasizes inflammatory material rather than cohesive malignant epithelial groups.',
        diagnosticSignificance:
          'During ROSE, an inflammatory/infectious pattern can change specimen handling toward cultures or organism stains.',
        pitfall:
          'Inflammation does not exclude malignancy; the onsite call should be matched with target sampling and final review.',
        quizPrompt: 'Which broad ROSE category best fits this inflammatory field?',
        correctChoiceId: 'infection',
      }),
      annotation({
        id: 'lilo-mai-histiocyte-cluster',
        label: 'Histiocyte-rich focus',
        cellType: 'Granulomatous/infectious inflammation',
        category: 'infection',
        shape: { type: 'ellipse', xPct: 69, yPct: 27, radiusXPct: 13, radiusYPct: 12 },
        featureTags: ['histiocytes', 'granulomatous pattern', 'infection'],
        explanation:
          'Histiocyte-rich inflammatory material is compatible with infection-associated granulomatous inflammation.',
        diagnosticSignificance:
          'Recognizing this pattern helps the team save material for stains or microbiology rather than exhausting it on smears.',
        pitfall:
          'Histiocytes and necrotic debris can be visually busy; avoid diagnosing carcinoma without a lesional epithelial population.',
        quizPrompt: 'This histiocyte-rich focus should most strongly raise which triage category?',
        correctChoiceId: 'infection',
      }),
      annotation({
        id: 'lilo-mai-cell-block-correlate',
        label: 'Cell block correlate',
        cellType: 'Infection correlate on cell block',
        category: 'infection',
        shape: { type: 'ellipse', xPct: 56, yPct: 68, radiusXPct: 15, radiusYPct: 12 },
        featureTags: ['cell block', 'organism workup', 'special stains'],
        explanation:
          'The cell block component provides material for confirmatory stains when an infectious etiology is suspected.',
        diagnosticSignificance:
          'ROSE can help preserve cell block material for special stains and final organism-directed interpretation.',
        pitfall:
          'A negative or nonspecific smear impression should not stop additional microbiology triage when infection remains clinically important.',
        quizPrompt: 'This correlate is most useful for which downstream workup?',
        correctChoiceId: 'infection',
      }),
      annotation({
        id: 'lilo-mai-adequacy-triage',
        label: 'Adequacy triage point',
        cellType: 'Specimen triage context',
        category: 'adequacy',
        shape: { type: 'ellipse', xPct: 38, yPct: 61, radiusXPct: 9, radiusYPct: 10 },
        featureTags: ['adequacy', 'microbiology', 'ROSE triage'],
        explanation:
          'The key onsite decision is not just benign versus malignant; it is whether the sample supports the clinical question and needed studies.',
        diagnosticSignificance:
          'When infection is in the differential, adequate ROSE handling may mean allocating material for cultures or special stains.',
        pitfall:
          'Adequacy for cytology alone may be inadequate for microbiology, molecular testing, or flow cytometry depending on the case.',
        quizPrompt: 'What ROSE decision does this paired-material context emphasize?',
        correctChoiceId: 'infection',
      }),
    ],
  },
]

export const defaultCytologySlideId = cytologySlides[0]?.id ?? ''
