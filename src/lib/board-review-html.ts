import fs from 'node:fs'
import path from 'node:path'

import { defaultLocale, isActiveLocale, type ActiveLocale } from '@/i18n/locale'

const updatedChapterDir = path.join(
  process.cwd(),
  'Imports',
  'Board_Review_Book',
  'Updated_chapters',
)
const translatedChapterDir = path.join(process.cwd(), 'board_review_translations')

type TranslatedBoardReviewLocale = Exclude<ActiveLocale, 'en'>

const boardReviewHtmlBySourceFile: Record<string, string> = {
  'advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy.mdx':
    'Advanced_peripheral_bronch.html',
  'airway-stents.mdx': 'Airway Stents.html',
  'anesthesia-for-ip.mdx': 'Anesthesia for IP.html',
  'bronchoscopic-and-surgical-treatment-for-copd-and-chronic-bronchitis.mdx': 'COPD.html',
  'bronchoscopy-in-high-risk-patients-and-complications-in-bronchoscopy.mdx':
    'Bronchoscopy in High\u2011Risk Patients.html',
  'coding-and-billing.mdx': 'coding_billing.html',
  'delayed-ablative-therapies.mdx': 'Delayed Ablative Therapies.html',
  'diagnostic-approach-to-pulmonary-nodules.mdx': 'Approach_to_Pulmonary_Nodules.html',
  'indwelling-pleural-catheters-and-pleurodesis.mdx':
    'Indwelling Pleural Catheters and Pleurodesis.html',
  'lung-cancer-screening.mdx': 'Lung_Cancer_Screening.html',
  'lung-cancer-staging-and-linear-ebus.mdx': 'Lung_cancer_staging_EBUS.html',
  'management-of-malignant-central-airway-obstruction.mdx': 'Malignant CAO.html',
  'mechanical-debridement-and-balloon-dilitation.mdx':
    'Mechanical Debridement and Balloon Dilatation.html',
  'non-malignant-cao.mdx': 'Non-Malignant CAO.html',
  'pathology-histology-cytology-rose-and-molecular-markers.mdx': 'Pathology.html',
  'percutaneous-tracheostomy-and-cricothyroidotomy.mdx':
    'Percutaneous Tracheostomy and Cricothyroidotomy.html',
  'peripheral-biopsy-techniques-conventional-sampling-and-transbronchial-cryobiopsy.mdx':
    'Peripheral Biopsy Techniques.html',
  'pleural-effusions-and-pleural-interventions.mdx': 'pleural_effusions.html',
  'pleural-infections.mdx': 'Pleural Infections.html',
  'pneumothorax-prolonged-air-leaks-and-bronchopleural-fistula.mdx':
    'Pneumothorax, Prolonged Air Leaks, and Bronchopleural Fistula.html',
  'real-time-peripheral-imaging-techniques.mdx': 'real_time_imaging.html',
  'rigid-bronchoscopy-indications-technique.mdx': 'Rigid Bronchoscopy.html',
  'thermal-ablatitive-therapies.mdx': 'Thermal Ablative Therapies.html',
  'treatment-options-for-early-stage-lung-cancer.mdx':
    'Treatment Options for Early-Stage Lung Cancer.html',
}

const translatedChapterDirByLocale: Record<TranslatedBoardReviewLocale, string> = {
  es: path.join(translatedChapterDir, 'Spanish'),
  'zh-CN': path.join(translatedChapterDir, 'Mandarin'),
}

const boardReviewTranslatedHtmlBySourceFile: Record<
  TranslatedBoardReviewLocale,
  Record<string, string>
> = {
  es: {
    'advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy.mdx':
      'Advanced_peripheral_bronch_es.html',
    'airway-stents.mdx': 'Airway Stents_es.html',
    'anesthesia-for-ip.mdx': 'Anesthesia for IP_es.html',
    'bronchoscopic-and-surgical-treatment-for-copd-and-chronic-bronchitis.mdx': 'COPD_es.html',
    'bronchoscopy-in-high-risk-patients-and-complications-in-bronchoscopy.mdx':
      'Bronchoscopy in High\u2011Risk Patients_es.html',
    'coding-and-billing.mdx': 'coding_billing_es.html',
    'delayed-ablative-therapies.mdx': 'Delayed_Ablative_Therapies_es.html',
    'diagnostic-approach-to-pulmonary-nodules.mdx': 'Approach_to_Pulmonary_Nodules_es.html',
    'indwelling-pleural-catheters-and-pleurodesis.mdx':
      'Indwelling Pleural Catheters and Pleurodesis_es.html',
    'lung-cancer-screening.mdx': 'Lung_Cancer_Screening_es.html',
    'lung-cancer-staging-and-linear-ebus.mdx': 'Lung_cancer_staging_EBUS_es.html',
    'management-of-malignant-central-airway-obstruction.mdx': 'Malignant_CAO_ES.html',
    'mechanical-debridement-and-balloon-dilitation.mdx':
      'Mechanical_Debridement_and_Balloon_Dilatation_ES.html',
    'non-malignant-cao.mdx': 'Non_Malignant_CAO_ES.html',
    'pathology-histology-cytology-rose-and-molecular-markers.mdx': 'Pathology_ES.html',
    'percutaneous-tracheostomy-and-cricothyroidotomy.mdx':
      'Percutaneous_Tracheostomy_and_Cricothyroidotomy_ES.html',
    'peripheral-biopsy-techniques-conventional-sampling-and-transbronchial-cryobiopsy.mdx':
      'Peripheral_Biopsy_Techniques_ES.html',
    'pleural-effusions-and-pleural-interventions.mdx': 'Pleural_Effusions_ES.html',
    'pleural-infections.mdx': 'Pleural_Infections_ES.html',
    'pneumothorax-prolonged-air-leaks-and-bronchopleural-fistula.mdx':
      'Pneumothorax_Prolonged_Air_Leaks_and_BPF_ES.html',
    'real-time-peripheral-imaging-techniques.mdx': 'Real_Time_Peripheral_Imaging_ES.html',
    'rigid-bronchoscopy-indications-technique.mdx': 'Broncoscopia rigida - Espanol.html',
    'thermal-ablatitive-therapies.mdx': 'Terapias ablativas termicas - Espanol.html',
    'treatment-options-for-early-stage-lung-cancer.mdx':
      'Opciones de tratamiento para cancer de pulmon en estadio temprano - Espanol.html',
  },
  'zh-CN': {
    'advanced-peripheral-bronchoscopy-radial-probe-electromagnetic-navigation-and-robotic-bronchoscopy.mdx':
      'Advanced_peripheral_bronchoscopy_zh-CN.html',
    'airway-stents.mdx': 'Airway_Stents_zh-CN.html',
    'anesthesia-for-ip.mdx': 'Anesthesia_for_Interventional_Pulmonology_zh-CN.html',
    'bronchoscopic-and-surgical-treatment-for-copd-and-chronic-bronchitis.mdx':
      'COPD_and_Chronic_Bronchitis_Interventional_Treatment_zh-CN.html',
    'bronchoscopy-in-high-risk-patients-and-complications-in-bronchoscopy.mdx':
      'Bronchoscopy_in_High_Risk_Patients_and_Complications_zh-CN.html',
    'coding-and-billing.mdx': 'Coding_and_Billing_zh-CN.html',
    'delayed-ablative-therapies.mdx': 'Delayed_Ablative_Therapies_zh-CN.html',
    'diagnostic-approach-to-pulmonary-nodules.mdx':
      'Diagnostic_Approach_to_Pulmonary_Nodules_zh-CN.html',
    'indwelling-pleural-catheters-and-pleurodesis.mdx':
      'Indwelling_Pleural_Catheters_and_Pleurodesis_zh-CN.html',
    'lung-cancer-screening.mdx': 'Lung_Cancer_Screening_zh-CN.html',
    'lung-cancer-staging-and-linear-ebus.mdx': 'Lung_Cancer_Staging_and_Linear_EBUS_zh-CN.html',
    'management-of-malignant-central-airway-obstruction.mdx':
      'Malignant CAO_\u7b80\u4f53\u4e2d\u6587.html',
    'mechanical-debridement-and-balloon-dilitation.mdx':
      'Mechanical Debridement and Balloon Dilatation_\u7b80\u4f53\u4e2d\u6587.html',
    'non-malignant-cao.mdx': 'Non-Malignant CAO_\u7b80\u4f53\u4e2d\u6587.html',
    'pathology-histology-cytology-rose-and-molecular-markers.mdx':
      'Pathology_\u7b80\u4f53\u4e2d\u6587.html',
    'percutaneous-tracheostomy-and-cricothyroidotomy.mdx':
      'Percutaneous Tracheostomy and Cricothyroidotomy_\u7b80\u4f53\u4e2d\u6587.html',
    'peripheral-biopsy-techniques-conventional-sampling-and-transbronchial-cryobiopsy.mdx':
      'Peripheral Biopsy Techniques_\u7b80\u4f53\u4e2d\u6587.html',
    'pleural-effusions-and-pleural-interventions.mdx':
      'Pleural Effusions and Pleural Interventions_\u7b80\u4f53\u4e2d\u6587.html',
    'pleural-infections.mdx': 'Pleural Infections_\u7b80\u4f53\u4e2d\u6587.html',
    'pneumothorax-prolonged-air-leaks-and-bronchopleural-fistula.mdx':
      'Pneumothorax, Prolonged Air Leaks, and Bronchopleural Fistula_\u7b80\u4f53\u4e2d\u6587.html',
    'real-time-peripheral-imaging-techniques.mdx':
      'Real-Time Peripheral Imaging Techniques_\u7b80\u4f53\u4e2d\u6587.html',
    'rigid-bronchoscopy-indications-technique.mdx': 'Rigid_Bronchoscopy_Mandarin_zh-CN.html',
    'thermal-ablatitive-therapies.mdx': 'Thermal_Ablative_Therapies_Mandarin_zh-CN.html',
    'treatment-options-for-early-stage-lung-cancer.mdx':
      'Early_Stage_Lung_Cancer_Treatment_Mandarin_zh-CN.html',
  },
}

const htmlCache = new Map<string, string | null>()

interface BoardReviewHtmlCandidate {
  filePath: string
  locale: ActiveLocale
}

export interface LoadedBoardReviewHtml extends BoardReviewHtmlCandidate {
  html: string
}

export function loadBoardReviewHtmlForSourceFile(
  sourceFile: string,
  locale?: string,
): LoadedBoardReviewHtml | null {
  const activeLocale = normalizeBoardReviewLocale(locale)

  for (const candidate of getFormattedHtmlCandidates(sourceFile, activeLocale)) {
    const html = readHtmlFile(candidate.filePath)

    if (html) {
      return {
        ...candidate,
        html,
      }
    }
  }

  return null
}

export function getTranslatedBoardReviewTitle(sourceFile: string, locale?: string) {
  const activeLocale = normalizeBoardReviewLocale(locale)

  if (activeLocale === defaultLocale) {
    return null
  }

  const loadedHtml = loadBoardReviewHtmlForSourceFile(sourceFile, activeLocale)
  if (!loadedHtml || loadedHtml.locale !== activeLocale) {
    return null
  }

  return extractFirstHeadingText(loadedHtml.html)
}

function normalizeBoardReviewLocale(locale: string | undefined): ActiveLocale {
  return isActiveLocale(locale) ? locale : defaultLocale
}

function getFormattedHtmlCandidates(
  sourceFile: string,
  locale: ActiveLocale,
): BoardReviewHtmlCandidate[] {
  const candidates: BoardReviewHtmlCandidate[] = []

  if (locale !== defaultLocale) {
    const translatedLocale = locale as TranslatedBoardReviewLocale
    const translatedFileName = boardReviewTranslatedHtmlBySourceFile[translatedLocale][sourceFile]

    if (translatedFileName) {
      candidates.push({
        filePath: path.join(translatedChapterDirByLocale[translatedLocale], translatedFileName),
        locale,
      })
    }
  }

  const htmlFileName = boardReviewHtmlBySourceFile[sourceFile]
  if (!htmlFileName) {
    return candidates
  }

  candidates.push({
    filePath: path.join(updatedChapterDir, htmlFileName),
    locale: defaultLocale,
  })

  return candidates
}

function readHtmlFile(filePath: string): string | null {
  if (htmlCache.has(filePath)) {
    return htmlCache.get(filePath) ?? null
  }

  if (!fs.existsSync(filePath)) {
    htmlCache.set(filePath, null)
    return null
  }

  const html = fs.readFileSync(filePath, 'utf8')
  htmlCache.set(filePath, html)
  return html
}

function extractFirstHeadingText(html: string) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = h1Match?.[1] ?? titleMatch?.[1]

  if (!rawTitle) {
    return null
  }

  const title = decodeHtmlEntities(
    rawTitle
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  return title || null
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
