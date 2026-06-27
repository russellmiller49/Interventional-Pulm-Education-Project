import { pickLocaleContent } from '@/i18n/content'

import type { PneumothoraxCase } from '../engine/types'

export const pneumothoraxCases: readonly PneumothoraxCase[] = [
  {
    id: 'stable-minimal-psp',
    title: 'Stable minimally symptomatic primary pneumothorax',
    type: 'psp',
    sizeCategory: 'large',
    accpVitals: {
      respiratoryRate: 18,
      heartRate: 88,
      roomAirSpo2: 96,
      bloodPressureStable: true,
      speaksFullSentences: true,
    },
    symptomBurden: 'minimal',
    hemodynamicCompromise: false,
    severeHypoxemia: false,
    underlyingLungDisease: false,
    persistentAirLeakDays: 0,
    recurrence: 'none',
    highRiskOccupation: false,
    ventilated: false,
    learningCue:
      'Large primary spontaneous pneumothorax on imaging, but the patient is comfortable and follow-up is reliable.',
  },
  {
    id: 'stable-symptomatic-psp',
    title: 'Stable symptomatic primary pneumothorax',
    type: 'psp',
    sizeCategory: 'small',
    accpVitals: {
      respiratoryRate: 20,
      heartRate: 98,
      roomAirSpo2: 95,
      bloodPressureStable: true,
      speaksFullSentences: true,
    },
    symptomBurden: 'moderate',
    hemodynamicCompromise: false,
    severeHypoxemia: false,
    underlyingLungDisease: false,
    persistentAirLeakDays: 0,
    recurrence: 'none',
    highRiskOccupation: false,
    ventilated: false,
    learningCue:
      'Small primary spontaneous pneumothorax, but dyspnea and chest pain are driving the encounter.',
  },
  {
    id: 'copd-ssp',
    title: 'COPD secondary pneumothorax',
    type: 'ssp',
    sizeCategory: 'small',
    accpVitals: {
      respiratoryRate: 22,
      heartRate: 104,
      roomAirSpo2: 91,
      bloodPressureStable: true,
      speaksFullSentences: true,
    },
    symptomBurden: 'moderate',
    hemodynamicCompromise: false,
    severeHypoxemia: false,
    underlyingLungDisease: true,
    persistentAirLeakDays: 1,
    recurrence: 'none',
    highRiskOccupation: false,
    ventilated: false,
    learningCue:
      'Secondary spontaneous pneumothorax in chronic obstructive pulmonary disease with limited respiratory reserve.',
  },
  {
    id: 'unstable-tension',
    title: 'Unstable pneumothorax physiology',
    type: 'psp',
    sizeCategory: 'large',
    accpVitals: {
      respiratoryRate: 32,
      heartRate: 134,
      roomAirSpo2: 84,
      bloodPressureStable: false,
      speaksFullSentences: false,
    },
    symptomBurden: 'severe',
    hemodynamicCompromise: true,
    severeHypoxemia: true,
    underlyingLungDisease: false,
    persistentAirLeakDays: 0,
    recurrence: 'none',
    highRiskOccupation: false,
    ventilated: false,
    learningCue:
      'Hypotension, severe hypoxemia, and inability to speak full sentences override lower-risk branches.',
  },
  {
    id: 'persistent-air-leak',
    title: 'Persistent air leak on day 5',
    type: 'ssp',
    sizeCategory: 'large',
    accpVitals: {
      respiratoryRate: 21,
      heartRate: 96,
      roomAirSpo2: 93,
      bloodPressureStable: true,
      speaksFullSentences: true,
    },
    symptomBurden: 'moderate',
    hemodynamicCompromise: false,
    severeHypoxemia: false,
    underlyingLungDisease: true,
    persistentAirLeakDays: 5,
    recurrence: 'none',
    highRiskOccupation: false,
    ventilated: false,
    learningCue:
      'Air bubbling persists after drain-position and drainage-system checks on the fifth day.',
  },
  {
    id: 'recurrent-pilot',
    title: 'Recurrent primary pneumothorax in a pilot',
    type: 'psp',
    sizeCategory: 'small',
    accpVitals: {
      respiratoryRate: 16,
      heartRate: 82,
      roomAirSpo2: 98,
      bloodPressureStable: true,
      speaksFullSentences: true,
    },
    symptomBurden: 'minimal',
    hemodynamicCompromise: false,
    severeHypoxemia: false,
    underlyingLungDisease: false,
    persistentAirLeakDays: 0,
    recurrence: 'ipsilateral',
    highRiskOccupation: true,
    ventilated: false,
    learningCue:
      'Recurrent primary spontaneous pneumothorax in a pilot changes the recurrence-prevention discussion.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Localized variants (es, zh-CN).
// MACHINE-TRANSLATED, PENDING CLINICAL REVIEW. Case ids and all clinical/logic
// fields mirror the English source above so the dual-framework engine evaluates
// identically; only the learner-facing title and learningCue differ. See
// docs/i18n-localization.md.
// ─────────────────────────────────────────────────────────────────────────────

const caseById = (id: string): PneumothoraxCase => {
  const found = pneumothoraxCases.find((item) => item.id === id)

  if (!found) {
    throw new Error(`Missing pneumothorax case ${id}`)
  }

  return found
}

const pneumothoraxCasesEs: readonly PneumothoraxCase[] = [
  {
    ...caseById('stable-minimal-psp'),
    title: 'Neumotórax primario estable con síntomas mínimos',
    learningCue:
      'Neumotórax espontáneo primario grande en la imagen, pero el paciente está cómodo y el seguimiento es fiable.',
  },
  {
    ...caseById('stable-symptomatic-psp'),
    title: 'Neumotórax primario estable sintomático',
    learningCue:
      'Neumotórax espontáneo primario pequeño, pero la disnea y el dolor torácico dominan el cuadro.',
  },
  {
    ...caseById('copd-ssp'),
    title: 'Neumotórax secundario por EPOC',
    learningCue:
      'Neumotórax espontáneo secundario en enfermedad pulmonar obstructiva crónica con reserva respiratoria limitada.',
  },
  {
    ...caseById('unstable-tension'),
    title: 'Fisiología de neumotórax inestable',
    learningCue:
      'La hipotensión, la hipoxemia grave y la incapacidad de hablar frases completas anulan las ramas de menor riesgo.',
  },
  {
    ...caseById('persistent-air-leak'),
    title: 'Fuga de aire persistente en el día 5',
    learningCue:
      'El burbujeo de aire persiste tras comprobar la posición del drenaje y el sistema de drenaje al quinto día.',
  },
  {
    ...caseById('recurrent-pilot'),
    title: 'Neumotórax primario recurrente en un piloto',
    learningCue:
      'Un neumotórax espontáneo primario recurrente en un piloto cambia la discusión sobre la prevención de recurrencias.',
  },
]

const pneumothoraxCasesZhCn: readonly PneumothoraxCase[] = [
  {
    ...caseById('stable-minimal-psp'),
    title: '稳定、症状轻微的原发性气胸',
    learningCue: '影像显示大量原发性自发性气胸，但患者无明显不适且随访可靠。',
  },
  {
    ...caseById('stable-symptomatic-psp'),
    title: '稳定、有症状的原发性气胸',
    learningCue: '少量原发性自发性气胸，但呼吸困难和胸痛是就诊的主要原因。',
  },
  {
    ...caseById('copd-ssp'),
    title: 'COPD 继发性气胸',
    learningCue: '慢性阻塞性肺疾病（COPD）患者发生继发性自发性气胸，呼吸储备有限。',
  },
  {
    ...caseById('unstable-tension'),
    title: '不稳定气胸的生理状态',
    learningCue: '低血压、严重低氧血症以及无法说出完整句子，优先于较低风险的分支。',
  },
  {
    ...caseById('persistent-air-leak'),
    title: '第 5 天持续性漏气',
    learningCue: '在第五天检查引流管位置和引流系统后，气泡仍持续冒出。',
  },
  {
    ...caseById('recurrent-pilot'),
    title: '飞行员复发性原发性气胸',
    learningCue: '飞行员发生复发性原发性自发性气胸，改变了关于复发预防的讨论。',
  },
]

export function getPneumothoraxCases(locale: string): readonly PneumothoraxCase[] {
  return pickLocaleContent(locale, {
    en: pneumothoraxCases,
    es: pneumothoraxCasesEs,
    'zh-CN': pneumothoraxCasesZhCn,
  })
}
