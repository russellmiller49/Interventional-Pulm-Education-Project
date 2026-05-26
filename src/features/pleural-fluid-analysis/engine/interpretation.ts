import type {
  FindingStrength,
  FluidCategory,
  InterpretationFinding,
  LightCriteriaResult,
  PleuralFluidInput,
  PleuralInterpretation,
} from './types'

const round = (value: number, places = 2) => Number(value.toFixed(places))

const contextSuggestsSystemicTransudate = (input: PleuralFluidInput) =>
  input.clinicalContext === 'heart-failure-diuresis' ||
  input.clinicalContext === 'hepatic-renal-systemic'

const contextSuggestsTb = (input: PleuralFluidInput) => input.clinicalContext === 'tb-exposure'

const contextSuggestsInfection = (input: PleuralFluidInput) =>
  input.clinicalContext === 'pneumonia-infection'

const contextSuggestsMalignancy = (input: PleuralFluidInput) =>
  input.clinicalContext === 'malignancy' || input.ultrasound === 'nodular-thickened'

const contextSuggestsLymphaticLeak = (input: PleuralFluidInput) =>
  input.clinicalContext === 'post-procedure-lymphatic'

const hasPleuralAcidosis = (input: PleuralFluidInput) => input.pleuralPH < 7.3

const hasDrainageLevelAcidosis = (input: PleuralFluidInput) => input.pleuralPH < 7.2

function pushFinding(
  findings: InterpretationFinding[],
  strength: FindingStrength,
  diagnosis: string,
  rationale: string,
  action: string,
) {
  findings.push({ diagnosis, strength, rationale, action })
}

export function evaluateLightsCriteria(input: PleuralFluidInput): LightCriteriaResult {
  const proteinRatio = input.pleuralProtein / input.serumProtein
  const ldhRatio = input.pleuralLdh / input.serumLdh
  const ldhUpperLimitRatio = input.pleuralLdh / input.serumLdhUpperLimit
  const proteinCriterion = proteinRatio >= 0.5
  const ldhRatioCriterion = ldhRatio > 0.6
  const ldhUpperLimitCriterion = input.pleuralLdh > (2 / 3) * input.serumLdhUpperLimit
  const positiveCriteria = [
    proteinCriterion ? 'pleural/serum protein >= 0.5' : null,
    ldhRatioCriterion ? 'pleural/serum LDH > 0.6' : null,
    ldhUpperLimitCriterion ? 'pleural LDH > 2/3 serum ULN' : null,
  ].filter((criterion): criterion is string => Boolean(criterion))

  return {
    proteinRatio: round(proteinRatio),
    ldhRatio: round(ldhRatio),
    ldhUpperLimitRatio: round(ldhUpperLimitRatio),
    proteinCriterion,
    ldhRatioCriterion,
    ldhUpperLimitCriterion,
    positiveCriteria,
    classification: positiveCriteria.length > 0 ? 'exudate' : 'transudate',
  }
}

export function getPseudoexudateReasons(input: PleuralFluidInput, category: FluidCategory) {
  if (category !== 'exudate' || !contextSuggestsSystemicTransudate(input)) {
    return []
  }

  const reasons: string[] = []
  const proteinGradient = input.serumProtein - input.pleuralProtein
  const hasAlbuminGradient =
    input.serumAlbumin !== undefined && input.pleuralAlbumin !== undefined
      ? input.serumAlbumin - input.pleuralAlbumin
      : undefined

  if (proteinGradient > 3.1) {
    reasons.push(`serum-pleural protein gradient ${round(proteinGradient, 1)} g/dL is > 3.1`)
  }

  if (hasAlbuminGradient !== undefined && hasAlbuminGradient > 1.2) {
    reasons.push(`serum-pleural albumin gradient ${round(hasAlbuminGradient, 1)} g/dL is > 1.2`)
  }

  if (input.ntProBnp !== undefined && input.ntProBnp > 1500) {
    reasons.push(`serum NT-proBNP ${input.ntProBnp.toLocaleString()} pg/mL is > 1,500`)
  }

  if (
    reasons.length === 0 &&
    input.pleuralProtein / input.serumProtein < 0.65 &&
    input.pleuralLdh / input.serumLdh < 1
  ) {
    reasons.push('Light criteria are only weakly positive in a systemic transudate context')
  }

  return reasons
}

export function interpretPleuralFluid(input: PleuralFluidInput): PleuralInterpretation {
  const lightCriteria = evaluateLightsCriteria(input)
  const pseudoexudateReasons = getPseudoexudateReasons(input, lightCriteria.classification)
  const reconciledCategory =
    pseudoexudateReasons.length > 0 ? 'transudate' : lightCriteria.classification
  const findings: InterpretationFinding[] = []

  if (input.appearance === 'purulent') {
    pushFinding(
      findings,
      'definitive',
      'Empyema',
      'Gross pus in pleural fluid is diagnostic of pleural space infection.',
      'Drain the pleural space and treat as pleural infection; send microbiology if not already done.',
    )
  }

  if (input.cytologyPositive) {
    pushFinding(
      findings,
      'definitive',
      'Malignant pleural effusion',
      'Positive pleural fluid cytology establishes pleural malignancy in the right clinical setting.',
      'Stage the malignancy, match management to prognosis and symptoms, and consider molecular testing when appropriate.',
    )
  }

  if (
    (input.triglycerides !== undefined && input.triglycerides > 110) ||
    (input.triglycerides !== undefined && input.triglycerides > 50 && input.chylomicronsPresent)
  ) {
    pushFinding(
      findings,
      'definitive',
      'Chylothorax',
      'Pleural triglycerides above 110 mg/dL, or intermediate triglycerides with chylomicrons, support chyle in the pleural space.',
      'Look for trauma, thoracic surgery, lymphoma, lymphatic disorders, or cirrhosis-related transudative chylothorax.',
    )
  }

  if (
    input.pleuralToBloodHematocritRatio !== undefined &&
    input.pleuralToBloodHematocritRatio > 0.5
  ) {
    pushFinding(
      findings,
      'definitive',
      'Hemothorax',
      'Pleural fluid hematocrit more than 50% of blood hematocrit defines hemothorax.',
      'Escalate source control and drainage planning; evaluate trauma, procedure injury, malignancy, or anticoagulation.',
    )
  }

  if (
    input.pleuralToSerumCreatinineRatio !== undefined &&
    input.pleuralToSerumCreatinineRatio > 1
  ) {
    pushFinding(
      findings,
      'definitive',
      'Urinothorax',
      'Pleural-to-serum creatinine ratio above 1 supports urine tracking into the pleural space.',
      'Evaluate obstructive uropathy or genitourinary injury; pleural drainage alone usually recurs.',
    )
  }

  if (input.pleuralToSerumBilirubinRatio !== undefined && input.pleuralToSerumBilirubinRatio > 1) {
    pushFinding(
      findings,
      'definitive',
      'Bilothorax',
      'Pleural-to-serum bilirubin ratio above 1 supports bile in the pleural space.',
      'Search for biliary pathology or recent hepatobiliary surgery and coordinate definitive source control.',
    )
  }

  if (input.amylase !== undefined && input.amylase > 100000) {
    pushFinding(
      findings,
      'definitive',
      'Pancreaticopleural fistula',
      'Very high pleural amylase strongly suggests pancreatic fluid entering the pleural space.',
      'Evaluate chronic pancreatitis, pseudocyst, and duct leak; abdominal imaging and pancreatic consultation usually matter more than repeat taps.',
    )
  }

  if (input.appearance === 'food-particles') {
    pushFinding(
      findings,
      'definitive',
      'Esophageal perforation',
      'Food particles in pleural fluid are a high-specificity clue for esophageal rupture.',
      'Escalate urgently for source control, broad antimicrobials, and esophageal evaluation.',
    )
  }

  if (input.appearance === 'urine-odor') {
    pushFinding(
      findings,
      'highly suggestive',
      'Urinothorax',
      'A urine odor is a classic gross inspection clue, especially with ipsilateral urinary tract obstruction or injury.',
      'Check pleural-to-serum creatinine and evaluate the urinary tract.',
    )
  }

  if (
    contextSuggestsInfection(input) &&
    (hasDrainageLevelAcidosis(input) ||
      input.pleuralGlucose < 60 ||
      input.pleuralLdh > 1000 ||
      input.nucleatedCells > 50000 ||
      input.microbiologyPositive)
  ) {
    pushFinding(
      findings,
      input.microbiologyPositive || hasDrainageLevelAcidosis(input)
        ? 'highly suggestive'
        : 'supportive',
      'Complicated parapneumonic effusion',
      'Pneumonia context plus low pH, low glucose, high LDH, high nucleated cells, or positive microbiology points toward pleural infection.',
      'Do not let Light criteria be the endpoint; assess need for tube drainage, culture-directed antibiotics, and loculation management.',
    )
  }

  if (
    contextSuggestsTb(input) &&
    input.lymphocytes >= 80 &&
    (input.ada === undefined || input.ada >= 40)
  ) {
    pushFinding(
      findings,
      input.ada !== undefined && input.ada >= 70 ? 'highly suggestive' : 'supportive',
      'Tuberculous pleural effusion',
      'A lymphocyte-predominant exudate with compatible exposure history and elevated ADA narrows the differential toward TB.',
      'Send mycobacterial culture when suspected; if suspicion remains high, pleural biopsy can secure microbiology and drug susceptibility.',
    )
  }

  if (contextSuggestsMalignancy(input)) {
    pushFinding(
      findings,
      input.ultrasound === 'nodular-thickened' ? 'highly suggestive' : 'supportive',
      'Malignancy remains in play',
      'Pleural nodularity or a strong cancer context can outweigh a nonspecific or even transudative chemistry profile.',
      'Send adequate cytology volume and consider image-guided or thoracoscopic pleural biopsy if cytology is negative and pretest probability stays high.',
    )
  }

  if (
    contextSuggestsMalignancy(input) &&
    !input.cytologyPositive &&
    (input.negativeCytologyCount ?? 0) >= 2
  ) {
    pushFinding(
      findings,
      'pitfall',
      'Repeated negative cytology',
      'Two nondiagnostic cytology samples do not rule out malignant pleural disease when imaging or clinical probability remains high.',
      'Stop fluid-only cycling and escalate toward pleural tissue diagnosis such as image-guided biopsy or pleuroscopy.',
    )
  }

  if (
    input.clinicalContext === 'autoimmune' &&
    (hasPleuralAcidosis(input) || input.pleuralGlucose < 60 || input.pleuralLdh > 1000)
  ) {
    pushFinding(
      findings,
      'supportive',
      'Rheumatoid or lupus pleuritis',
      'Autoimmune context with low pH, low glucose, or high LDH can mimic pleural infection.',
      'Reconcile with serologies, joint/systemic activity, microbiology, and imaging before anchoring on infection alone.',
    )
  }

  if (input.eosinophils >= 10) {
    pushFinding(
      findings,
      'supportive',
      'Eosinophilic pleural effusion',
      'Pleural eosinophils above 10% suggest air or blood in the pleural space, prior thoracentesis, drug reaction, asbestos exposure, parasites, infection, or malignancy.',
      'Use the history and gross appearance to decide whether this is procedure-related noise or a diagnostic clue.',
    )
  }

  if (input.lymphocytes >= 80 && !contextSuggestsTb(input)) {
    pushFinding(
      findings,
      'supportive',
      'Lymphocyte-predominant effusion',
      'Marked lymphocyte predominance narrows the differential to TB, lymphoma, sarcoidosis, chylothorax, trapped lung, post-CABG, yellow nail syndrome, uremia, drug causes, and rheumatoid disease.',
      'Let timeline, exposure, imaging, and targeted tests decide the next fork.',
    )
  }

  if (contextSuggestsLymphaticLeak(input) && input.appearance === 'milky') {
    pushFinding(
      findings,
      'supportive',
      'Lymphatic leak phenotype',
      'Milky or turbid pleural fluid with a surgery, lymphoma, lymphatic, or yellow-nail context should trigger lipid testing.',
      'Check triglycerides, cholesterol, and chylomicrons rather than relying on appearance alone.',
    )
  }

  if (
    input.appearance === 'bloody' ||
    input.appearance === 'serosanguineous' ||
    input.ultrasound === 'hematocrit-sign'
  ) {
    pushFinding(
      findings,
      input.ultrasound === 'hematocrit-sign' ? 'highly suggestive' : 'supportive',
      'Blood in the pleural space',
      'Bloody fluid can be caused by malignancy, pulmonary embolism, trauma, post-cardiotomy injury, asbestos pleuritis, or hemothorax.',
      'Measure pleural hematocrit when grossly bloody; do not treat all serosanguineous fluid as hemothorax.',
    )
  }

  const pitfalls = buildPitfalls(input, lightCriteria, pseudoexudateReasons)
  const nextActions = buildNextActions(input, lightCriteria, pseudoexudateReasons, findings)

  return {
    lightCriteria,
    reconciledCategory,
    headline: buildHeadline(lightCriteria, pseudoexudateReasons, findings),
    reconciliation: buildReconciliation(input, lightCriteria, pseudoexudateReasons),
    pseudoexudateReasons,
    findings,
    nextActions,
    pitfalls,
    routineStudies: buildRoutineStudies(input),
    targetedStudies: buildTargetedStudies(input, findings),
  }
}

function buildHeadline(
  lightCriteria: LightCriteriaResult,
  pseudoexudateReasons: readonly string[],
  findings: readonly InterpretationFinding[],
) {
  const definitive = findings.find((finding) => finding.strength === 'definitive')

  if (pseudoexudateReasons.length > 0) {
    return "Light's criteria are positive, but reconciliation favors a pseudoexudate."
  }

  if (definitive) {
    return `${definitive.diagnosis} has a specific pleural fluid signal.`
  }

  if (lightCriteria.classification === 'exudate') {
    return 'This is an exudative pattern; now narrow it with clinical context.'
  }

  return 'This is a transudative pattern unless the clinical story says otherwise.'
}

function buildReconciliation(
  input: PleuralFluidInput,
  lightCriteria: LightCriteriaResult,
  pseudoexudateReasons: readonly string[],
) {
  if (input.ultrasound === 'too-small') {
    return 'A very small effusion is usually a sampling decision before it is a chemistry decision.'
  }

  if (pseudoexudateReasons.length > 0) {
    return 'The chemistry label diverges from the bedside story. In this setting, gradients and NT-proBNP help avoid unnecessary invasive workup for a diuresed systemic effusion.'
  }

  if (
    lightCriteria.classification === 'transudate' &&
    (contextSuggestsMalignancy(input) || input.appearance === 'bloody')
  ) {
    return 'The chemistry looks transudative, but the clinical pretest probability is not low. Malignancy and other competing processes can occasionally look deceptively bland.'
  }

  if (lightCriteria.classification === 'exudate' && contextSuggestsInfection(input)) {
    return 'The exudate label is expected, but pH, glucose, LDH, ultrasound, and cultures determine whether this behaves like pleural infection needing drainage.'
  }

  if (lightCriteria.classification === 'exudate' && contextSuggestsTb(input)) {
    return 'The exudate label is only the first fork. Lymphocyte predominance, exposure history, ADA, and pleural biopsy strategy carry the diagnosis forward.'
  }

  if (lightCriteria.classification === 'transudate') {
    return 'The chemistry and initial frame align with altered systemic pressure or oncotic forces; still check for unilateral, bloody, nodular, or recurrent features that break the pattern.'
  }

  return 'PFA should be interpreted as a probability shifter: it narrows the search, then history, imaging, and selected tests finish the reasoning.'
}

function buildPitfalls(
  input: PleuralFluidInput,
  lightCriteria: LightCriteriaResult,
  pseudoexudateReasons: readonly string[],
) {
  const pitfalls = [
    'Do not interpret pleural chemistry without the paired serum values and the pre-thoracentesis clinical impression.',
  ]

  if (lightCriteria.classification === 'exudate' && contextSuggestsSystemicTransudate(input)) {
    pitfalls.push(
      pseudoexudateReasons.length > 0
        ? 'Diuresis and systemic effusions can cross Light criteria by a small margin.'
        : 'A systemic transudate context with positive Light criteria should trigger a gradient check before anchoring on an exudate.',
    )
  }

  if (input.pleuralPH < 7.35) {
    pitfalls.push(
      'Pleural pH is fragile; delayed analysis, air, or lidocaine contamination can change the result.',
    )
  }

  if (input.appearance === 'milky' || input.appearance === 'turbid') {
    pitfalls.push('Milky or turbid fluid can be chyle, cholesterol, empyema, or cellular debris.')
  }

  if (contextSuggestsMalignancy(input) && !input.cytologyPositive) {
    pitfalls.push(
      'Negative cytology does not rule out malignant pleural disease when imaging or history is convincing.',
    )
  }

  if (contextSuggestsMalignancy(input) && (input.negativeCytologyCount ?? 0) >= 2) {
    pitfalls.push(
      'After two nondiagnostic cytology samples, repeated fluid-only testing can delay needed pleural tissue diagnosis.',
    )
  }

  if (contextSuggestsTb(input) && input.mesothelialCells > 5) {
    pitfalls.push(
      'Mesothelial cells above 5% make TB less likely, but they do not erase a high-risk exposure story.',
    )
  }

  return pitfalls
}

function buildNextActions(
  input: PleuralFluidInput,
  lightCriteria: LightCriteriaResult,
  pseudoexudateReasons: readonly string[],
  findings: readonly InterpretationFinding[],
) {
  if (input.ultrasound === 'too-small') {
    return [
      'Confirm whether the effusion is safely sampleable with ultrasound.',
      'Treat or observe the likely cause if the effusion is < 1 cm and the patient is clinically stable.',
    ]
  }

  if (input.ultrasound === 'anechoic-bilateral' && contextSuggestsSystemicTransudate(input)) {
    return [
      'Treat the systemic cause when the story is obvious and the effusions are bilateral and anechoic.',
      'Sample if the course, laterality, fever, pleuritic pain, or imaging no longer fits the systemic diagnosis.',
    ]
  }

  const definitive = findings.find((finding) => finding.strength === 'definitive')

  if (definitive) {
    return [
      definitive.action,
      'Use the remaining PFA data to identify concurrent processes and management risk.',
    ]
  }

  if (pseudoexudateReasons.length > 0) {
    return [
      'Reclassify cautiously as likely systemic transudate and treat the underlying CHF, renal, hepatic, or oncotic driver.',
      'Reassess response; sample or image further if the effusion persists, is unilateral, becomes bloody, or develops pleural thickening.',
    ]
  }

  if (contextSuggestsInfection(input)) {
    return [
      'Use pleural pH, glucose, LDH, culture yield, and ultrasound loculation to decide drainage urgency.',
      'Inoculate pleural fluid into blood culture bottles when pleural infection is suspected.',
    ]
  }

  if (contextSuggestsTb(input)) {
    return [
      'Send AFB smear and culture, but plan around low culture yield and delayed results.',
      'If suspicion stays high, pursue pleural biopsy for histology, culture, and drug susceptibility.',
    ]
  }

  if (contextSuggestsMalignancy(input)) {
    if ((input.negativeCytologyCount ?? 0) >= 2 && !input.cytologyPositive) {
      return [
        'Stop fluid-only cycling and move toward pleural tissue diagnosis with image-guided biopsy or pleuroscopy.',
        'Use lung expansion, symptoms, prognosis, and patient goals to choose IPC, pleurodesis, or combined strategy.',
      ]
    }

    return [
      'Send adequate cytology volume and review CT or ultrasound for pleural targets.',
      'If cytology is negative but pleural nodularity or cancer history remains convincing, move toward pleural biopsy.',
    ]
  }

  if (lightCriteria.classification === 'transudate') {
    return [
      'Focus on CHF, renal, hepatic, oncotic, peritoneal, and trapped-lung physiology.',
      'Avoid repeated diagnostic taps unless the clinical course stops fitting a transudate.',
    ]
  }

  return [
    'Use the exudate label to choose a targeted branch: infection, malignancy, TB, pulmonary embolism, autoimmune disease, post-procedure, or abdominal source.',
    'Repeat thoracentesis, observe, treat empirically, or biopsy based on the remaining probability after clinical reconciliation.',
  ]
}

function buildRoutineStudies(input: PleuralFluidInput) {
  const studies = [
    'Gross appearance and odor at the bedside',
    'Pleural protein and LDH with paired serum protein and LDH',
    'Pleural pH measured promptly on a blood gas analyzer',
    'Pleural glucose',
    'Cell count with differential',
  ]

  if (contextSuggestsInfection(input)) {
    studies.push('Gram stain and culture with direct inoculation into blood culture bottles')
  }

  if (contextSuggestsMalignancy(input)) {
    studies.push('Cytology with adequate sample volume')
  }

  return studies
}

function buildTargetedStudies(
  input: PleuralFluidInput,
  findings: readonly InterpretationFinding[],
) {
  const studies = new Set<string>()
  const hasFinding = (diagnosis: string) =>
    findings.some((finding) => finding.diagnosis.toLowerCase().includes(diagnosis))

  if (
    input.appearance === 'milky' ||
    contextSuggestsLymphaticLeak(input) ||
    hasFinding('chylothorax')
  ) {
    studies.add('Triglycerides, cholesterol, and chylomicrons')
  }

  if (input.appearance === 'bloody' || input.ultrasound === 'hematocrit-sign') {
    studies.add('Pleural hematocrit compared with blood hematocrit')
  }

  if (contextSuggestsTb(input)) {
    studies.add('ADA, AFB smear/culture, and pleural biopsy when suspicion remains high')
  }

  if (input.clinicalContext === 'pancreatic-esophageal' || input.amylase !== undefined) {
    studies.add('Pleural amylase with source-focused abdominal or esophageal evaluation')
  }

  if (input.appearance === 'green') {
    studies.add('Pleural-to-serum bilirubin ratio')
  }

  if (input.appearance === 'urine-odor' || input.pleuralToSerumCreatinineRatio !== undefined) {
    studies.add('Pleural-to-serum creatinine ratio')
  }

  if (input.clinicalContext === 'autoimmune') {
    studies.add('Autoimmune serologies interpreted with microbiology and imaging')
  }

  if (!studies.size) {
    studies.add(
      'Target additional tests only when the story or gross fluid appearance creates a branch point',
    )
  }

  return [...studies]
}
