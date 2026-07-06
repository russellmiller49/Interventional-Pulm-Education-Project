import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Pleuroscopy module, aligned to the Learn objectives
 * (indications/contraindications, rigid vs semi-rigid, siting and biopsy
 * technique, poudrage, and complication management). Commit-first: explanations
 * appear only after answering. Reference ids are noted per item in comments.
 * English is authored here; other locales fall back to English until translated.
 */
export const pleuroscopyQuizQuestions: QuizQuestion[] = [
  {
    // bts-lat-2010, bts-pleural-2023
    prompt: 'What is the most common diagnostic indication for medical thoracoscopy?',
    options: [
      'Undiagnosed exudative effusion, especially when malignancy is suspected',
      'A simple transudative effusion from heart failure',
      'Routine follow-up of a resolved pneumothorax',
      'First-line management of uncomplicated pneumonia',
    ],
    answerIndex: 0,
    explanation:
      'Medical thoracoscopy is most often used for an undiagnosed exudative effusion — particularly when malignancy is suspected after non-diagnostic fluid cytology — and for talc poudrage. Transudates are managed by treating the underlying cause.',
  },
  {
    // bts-lat-2010
    prompt: 'Which is the principal contraindication to medical thoracoscopy?',
    options: [
      'A moderate free-flowing effusion',
      'An obliterated pleural space with no accessible cavity',
      'A unilateral pleural effusion',
      'Suspected pleural malignancy',
    ],
    answerIndex: 1,
    explanation:
      'The procedure needs a space to work in. An obliterated pleural space (dense adhesions with no accessible cavity) leaves nowhere to safely introduce the scope and is the principal contraindication.',
  },
  {
    // bts-procedures-2023
    prompt: 'Why is ultrasound used before single-port entry?',
    options: [
      'To measure pleural fluid pH',
      'To confirm a safe intercostal entry site with an accessible space and avoid the diaphragm and organs',
      'To replace the need for a pleural biopsy',
      'To decide the antibiotic regimen',
    ],
    answerIndex: 1,
    explanation:
      'Ultrasound confirms an accessible pleural space at the chosen interspace and helps avoid the diaphragm and underlying organs, improving the safety of entry.',
  },
  {
    // bts-lat-2010, bts-procedures-2023
    prompt: 'To reduce bleeding risk, parietal biopsies should be taken:',
    options: [
      'In the middle of the intercostal space',
      'Directly over a rib',
      'As close to the diaphragm as possible',
      'Only from the visceral pleura',
    ],
    answerIndex: 1,
    explanation:
      'The intercostal neurovascular bundle runs in the groove at the lower border of each rib. Sampling the parietal pleura directly over a rib keeps clear of that bundle and reduces bleeding risk.',
  },
  {
    // bts-lat-2010
    prompt: 'Which statement best contrasts the rigid and semi-rigid thoracoscope?',
    options: [
      'The semi-rigid scope always yields larger biopsies than the rigid scope',
      'The rigid scope enables larger, deeper biopsies; the semi-rigid scope offers bronchoscope-like handling with smaller forceps biopsies',
      'Only the rigid scope can be used under local anaesthetic',
      'The two have no difference in biopsy size or handling',
    ],
    answerIndex: 1,
    explanation:
      'The rigid scope takes larger, deeper parietal biopsies and suits dense disease; the semi-rigid scope handles like a bronchoscope through a single port but takes smaller forceps biopsies (cryobiopsy can supplement it).',
  },
  {
    // talc-safety-2007
    prompt: 'Graded (large-particle) talc is preferred for poudrage because it:',
    options: [
      'Is cheaper than ungraded talc',
      'Limits the systemic small-particle spread associated with talc-related pneumonitis',
      'Eliminates the need for a chest drain',
      'Works even when the lung cannot re-expand',
    ],
    answerIndex: 1,
    explanation:
      'Removing the smallest particles (graded talc) reduces systemic spread and the risk of talc-related pneumonitis/ARDS while still producing effective pleurodesis.',
  },
  {
    // tapps-2020, bts-pleural-2023
    prompt: 'Talc poudrage pleurodesis fundamentally requires:',
    options: [
      'A non-expandable (trapped) lung',
      'Pleural apposition — the lung must be able to re-expand so the surfaces fuse',
      'General anaesthesia in every case',
      'That no chest drain be placed afterward',
    ],
    answerIndex: 1,
    explanation:
      'Pleurodesis works by fusing apposed pleural surfaces. If the lung will not re-expand, the surfaces cannot appose and poudrage is likely to fail — an indwelling pleural catheter is the usual alternative.',
  },
  {
    // bts-procedures-2023
    prompt:
      'While draining a large, long-standing effusion the patient develops cough and chest tightness. The best next step is to:',
    options: [
      'Continue draining rapidly to empty the space',
      'Stop or slow drainage and reassess for re-expansion pulmonary oedema',
      'Immediately remove the cannula',
      'Clamp the drain and send the patient home',
    ],
    answerIndex: 1,
    explanation:
      'New cough or chest tightness during large-volume drainage suggests re-expansion. Draining large effusions in a controlled, volume-limited way and stopping when symptoms appear reduces the risk of re-expansion pulmonary oedema.',
  },
  {
    // bts-procedures-2023
    prompt:
      'Two days after poudrage the chest drain has a continuous air leak but the lung is up. You should:',
    options: [
      'Clamp the drain to test whether the leak stopped',
      'Remove the drain to encourage sealing',
      'Continue drainage keeping the lung inflated, and escalate if it persists',
      'Stop all monitoring',
    ],
    answerIndex: 2,
    explanation:
      'Most post-thoracoscopy air leaks settle with continued drainage while the lung stays apposed. Clamping or removing a drain with an active leak can trap air and cause a tension pneumothorax.',
  },
  {
    // bts-pleural-2023, bts-procedures-2023
    prompt:
      'Days after pleuroscopy the drain output turns turbid and purulent with fever. The priority is to:',
    options: [
      'Remove the drain and give oral antibiotics as an outpatient',
      'Send cultures, start antibiotics, and ensure effective drainage/source control',
      'Rely on antibiotics alone and defer drainage',
      'Reassure and repeat imaging in a month',
    ],
    answerIndex: 1,
    explanation:
      'Turbid/purulent output with fever suggests pleural-space infection. Management is cultures, antibiotics, and effective drainage (source control) — antibiotics alone without drainage is a classic pitfall.',
  },
]

export function getPleuroscopyQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, { en: pleuroscopyQuizQuestions })
}
