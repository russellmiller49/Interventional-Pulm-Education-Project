import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Pleuroscopy (medical thoracoscopy) "Learn" section.
 * Paraphrased teaching in our own words; recommendations trace to the module
 * references (bts-lat-2010, bts-procedures-2023, bts-pleural-2023, tapps-2020,
 * talc-safety-2007). Simulation and professional-education framing only.
 *
 * English is authored here; `pickLocaleContent` falls back to English for
 * locales without a translated variant yet.
 */

export const pleuroscopyObjectives = [
  'State the core indications for medical thoracoscopy and the contraindications, including the need for an accessible pleural space.',
  'Contrast the rigid and semi-rigid thoracoscope and the biopsy trade-offs of each.',
  'Use ultrasound to select a safe single-access site and take parietal biopsies over ribs to protect the intercostal bundle.',
  'Describe graded-talc poudrage, pleural apposition, and post-procedure drainage — anticipating re-expansion oedema and air leak.',
] as const

export const pleuroscopyCoreBlocks: LearnBlock[] = [
  {
    id: 'what-and-indications',
    title: 'What medical thoracoscopy is, and when it is used',
    paragraphs: [
      'Medical thoracoscopy (pleuroscopy) lets the operator inspect the pleural cavity and take biopsies under direct vision, performed by a pulmonologist under local anaesthetic with sedation — distinct from surgical VATS under general anaesthesia. It is a high-yield way to diagnose pleural disease and to treat malignant effusions in the same sitting.',
    ],
    bullets: [
      'Undiagnosed exudative effusion — especially when malignancy is suspected after non-diagnostic fluid cytology.',
      'Diagnosis and staging of pleural malignancy under direct visual guidance.',
      'Talc poudrage pleurodesis for a symptomatic malignant pleural effusion.',
    ],
  },
  {
    id: 'contraindications-assessment',
    title: 'Contraindications and pre-procedure assessment',
    paragraphs: [
      'The procedure needs a space to work in. The single most important contraindication is an obliterated pleural space — dense adhesions with no accessible cavity — because there is nowhere to safely introduce the scope.',
    ],
    bullets: [
      'Absolute: an obliterated pleural space with no accessible cavity.',
      'Relative/caution: uncorrectable coagulopathy, unstable cardiorespiratory status, refractory hypoxaemia, and an intractable cough.',
      'Assess for an accessible space (an effusion or an inducible pneumothorax) and confirm it with imaging before scheduling.',
    ],
  },
  {
    id: 'rigid-vs-semirigid',
    title: 'Rigid versus semi-rigid thoracoscope',
    bullets: [
      'Rigid thoracoscope: larger, deeper parietal biopsies and a wide field — favoured for dense or nodular disease; reusable rod-lens optics.',
      'Semi-rigid (flex-rigid) thoracoscope: bronchoscope-like handling through a single port, more manoeuvrable, but smaller forceps biopsies.',
      'Diagnostic yield for pleural malignancy is broadly comparable; cryobiopsy can supplement the semi-rigid scope when deeper samples are needed.',
    ],
  },
  {
    id: 'siting-positioning',
    title: 'Ultrasound-guided site selection and positioning',
    bullets: [
      'Position the patient in the lateral decubitus position with the affected side up so the lung and fluid settle favourably.',
      'Use ultrasound to choose an intercostal interspace with an accessible space, typically in the mid-axillary region, and to avoid the diaphragm and organs.',
      'Plan a single entry site; enter over the top of a rib to avoid the intercostal neurovascular bundle.',
    ],
  },
  {
    id: 'inspection-biopsy',
    title: 'Systematic inspection and parietal biopsy',
    paragraphs: [
      'Once in the cavity, survey the pleura methodically before sampling, then biopsy where it is both diagnostic and safe.',
    ],
    bullets: [
      'Inspect the parietal, visceral, and diaphragmatic surfaces and the mediastinal pleura in a consistent sequence.',
      'Take parietal biopsies over a rib — the intercostal vessels run in the groove at the lower border, so sampling over the rib avoids them.',
      'Take several adequately deep samples to maximize diagnostic yield.',
    ],
  },
  {
    id: 'poudrage-drainage',
    title: 'Talc poudrage and chest-drain management',
    paragraphs: [
      'For a malignant effusion, pleurodesis can follow diagnosis in the same procedure. Poudrage only works if the pleural surfaces can appose.',
    ],
    bullets: [
      'Drain residual fluid and confirm the lung re-expands — a trapped, non-expandable lung is a poor pleurodesis candidate.',
      'Insufflate graded (large-particle) talc evenly across the pleural surfaces; graded talc limits the systemic small-particle spread linked to talc pneumonitis.',
      'Place a chest drain under vision and manage controlled drainage, watching for re-expansion pulmonary oedema and prolonged air leak.',
    ],
  },
]

export const pleuroscopyGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'cryobiopsy',
    title: 'Cryobiopsy as an adjunct',
    level: 'advanced',
    bullets: [
      'A cryoprobe passed through the semi-rigid scope can retrieve larger, less crush-artefacted parietal specimens than flexible forceps.',
      'It is an adjunct for deeper sampling, not a replacement for a systematic survey and adequate forceps biopsies.',
    ],
  },
  {
    id: 'trapped-lung',
    title: 'The non-expandable (trapped) lung',
    level: 'advanced',
    bullets: [
      'If the visceral pleura is encased and the lung will not re-expand, the surfaces cannot appose and poudrage pleurodesis is likely to fail.',
      'An indwelling pleural catheter is the usual alternative for palliating a symptomatic non-expandable-lung effusion.',
    ],
  },
]

export function getPleuroscopyObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, { en: pleuroscopyObjectives as readonly string[] })
}

export function getPleuroscopyCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, { en: pleuroscopyCoreBlocks })
}

export function getPleuroscopyGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, { en: pleuroscopyGoDeeperBlocks })
}
