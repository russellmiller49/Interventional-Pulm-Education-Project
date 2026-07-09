import type { QuizQuestion } from '@/components/training/Quiz'
import { pickLocaleContent } from '@/i18n/content'

export interface TracheostomyQuizQuestion extends QuizQuestion {
  referenceIds: string[]
}

/**
 * Commit-first assessment items. The shared Quiz component withholds the
 * explanation until the learner chooses an option and selects "Check answer."
 */
export const tracheostomyQuizQuestions: TracheostomyQuizQuestion[] = [
  {
    prompt:
      'Which statement best distinguishes a tracheostomy from a total laryngectomy during emergency planning?',
    options: [
      'Both permanently separate the lungs from the mouth and nose',
      'A laryngectomy always preserves a patent upper airway to the lungs',
      'A tracheostomy usually preserves a potentially usable upper airway; a total laryngectomy does not',
      'Neither requires an airway-specific bedhead sign',
    ],
    answerIndex: 2,
    explanation:
      'A tracheostomy enters the trachea while usually leaving the larynx and upper airway anatomically connected to the lungs. Total laryngectomy separates the lower airway from the mouth and nose, so the emergency oxygenation pathways differ.',
    referenceIds: ['mcgrath-ntsp-2012', 'ntsp-emergency-algorithm'],
  },
  {
    prompt:
      'A patient has increased skin-to-trachea depth. Which tube feature most directly addresses that anatomy?',
    options: [
      'A larger pilot balloon',
      'Additional proximal length between the flange and tracheal curve',
      'A fenestration regardless of its position',
      'A narrower 15-mm connector',
    ],
    answerIndex: 1,
    explanation:
      'Proximal extended length is designed to span greater pretracheal soft-tissue depth. Selection still requires review of outer diameter, functional inner diameter, curvature, distal position, and the rescue plan.',
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021'],
  },
  {
    prompt: 'What is required before attaching a one-way speaking valve to a cuffed tube?',
    options: [
      'Inflate the cuff until no leak is heard',
      'Occlude the upper airway to direct sound through the stoma',
      'Fill the pilot balloon with a standard fixed volume',
      'Fully deflate the cuff and confirm an adequate expiratory path through the upper airway',
    ],
    answerIndex: 3,
    explanation:
      'A one-way valve blocks expiration through the tracheostomy. The cuff must be fully deflated and the upper airway must provide an adequate expiratory exit; otherwise dangerous air trapping or complete obstruction can occur.',
    referenceIds: ['ntsp-speaking-valve', 'medrinal-consensus-2026'],
  },
  {
    prompt:
      'A patient with a tracheostomy acutely develops increased work of breathing. Which sequence best tests the simplest reversible tube problems?',
    options: [
      'Call for help and oxygenate; remove any cap, valve, or HME; remove the inner cannula; then assess patency with a suction catheter',
      'Force ventilation through the tube, then check the inner cannula later',
      'Blindly replace the tube before removing external attachments',
      'Inflate the cuff further and wait for a chest radiograph',
    ],
    answerIndex: 0,
    explanation:
      'The NTSP sequence prioritizes help and oxygenation, removes external attachments and the potentially blocked inner cannula, and then uses a suction catheter to assess patency. Ventilation through a displaced tube can worsen a false passage.',
    referenceIds: ['mcgrath-ntsp-2012', 'ntsp-emergency-algorithm', 'tracheostomy-knowledge-base'],
  },
  {
    prompt:
      'A tracheostomy placed 3 days ago is found displaced. The upper airway is known to be patent. What is the safest initial strategy?',
    options: [
      'Repeatedly probe the tract with the same tube until it enters',
      'Wait for the tract to close before calling for help',
      'Call expert airway help, oxygenate or ventilate from above, and avoid blind reinsertion into the immature tract',
      'Place a speaking valve over the stoma',
    ],
    answerIndex: 2,
    explanation:
      'A tract is fresh or immature during the first 7 days or before the first planned change unless the local airway team documents otherwise. Blind reinsertion can create a false passage; oxygenate through the known patent route and use experienced, visualized replacement.',
    referenceIds: ['tracheostomy-knowledge-base', 'mcgrath-ntsp-2012', 'mitchell-consensus-2013'],
  },
  {
    prompt:
      'A small pulsatile bleed appears from a tracheostomy several days after placement and then stops. What is the appropriate interpretation?',
    options: [
      'It proves the stoma is healing normally',
      'Treat it as possible tracheo-innominate fistula until proven otherwise and activate the emergency pathway',
      'Deflate the cuff and schedule routine clinic review',
      'Apply a speaking valve to identify whether the source is above the cuff',
    ],
    answerIndex: 1,
    explanation:
      'A sentinel or pulsatile bleed may precede catastrophic tracheo-innominate hemorrhage. Activate definitive surgical and massive-hemorrhage pathways immediately; trained teams may use cuff hyperinflation and compression as temporizing maneuvers.',
    referenceIds: ['allan-tif-2003', 'tracheostomy-knowledge-base'],
  },
  {
    prompt: 'Which suction practice is most consistent with the AARC adult guideline?',
    options: [
      'Instill normal saline routinely before every pass',
      'Use deep suction first for every patient',
      'Suction on a fixed hourly schedule regardless of findings',
      'Use clinical indications, preoxygenate adults, begin shallow, and limit each suction application to 15 seconds or less',
    ],
    answerIndex: 3,
    explanation:
      'AARC recommends suctioning for clinical indications, adult preoxygenation, shallow suction before deep suction, generally avoiding routine saline, and limiting each suction application to no more than 15 seconds.',
    referenceIds: ['blakeman-aarc-2022'],
  },
  {
    prompt: 'Which set of findings best confirms a newly placed tracheostomy is functioning?',
    options: [
      'Waveform capnography plus ventilation data and clinical assessment, with bronchoscopic confirmation when used',
      'The tube flange lies flat against the skin',
      'The pilot balloon feels firm',
      'Only a chest radiograph obtained several hours later',
    ],
    answerIndex: 0,
    explanation:
      'Confirmation is multimodal: waveform carbon dioxide, delivered and exhaled volumes, chest movement and breath sounds, cuff and circuit behavior, and bronchoscopic visualization of the lumen and tip when bronchoscopy is part of the procedure.',
    referenceIds: ['tracheostomy-knowledge-base', 'ghattas-pdt-2021'],
  },
  {
    prompt: 'Which bedside preparation is most important during the first shift after placement?',
    options: [
      'Keep only the exact replacement tube because alternatives cause confusion',
      'Remove the obturator from the unit so it cannot be misplaced',
      'Provide airway signage and a same-size and one-size-smaller tube, obturator, suction, oxygenation and ventilation interfaces, and spare inner cannula',
      'Delay documenting the upper-airway plan until the first tube change',
    ],
    answerIndex: 2,
    explanation:
      'The first shift establishes the rescue system. Emergency equipment and airway-specific signage must match the actual tube, tract maturity, upper-airway patency, and anticipated rescue routes.',
    referenceIds: ['tracheostomy-knowledge-base', 'mussa-aarc-2021', 'mitchell-consensus-2013'],
  },
  {
    prompt: 'Which statement about adult decannulation assessment is most accurate?',
    options: [
      'Every patient must tolerate exactly 72 hours of capping',
      'Use a multidisciplinary local protocol; no single capping duration, manometry threshold, or score is universal',
      'Suction frequency has no role in assessment',
      'An inflated cuff is required throughout every capping trial',
    ],
    answerIndex: 1,
    explanation:
      'Evidence supports multidisciplinary, protocol-directed assessment, but protocols differ. Cough, secretions and suction frequency, upper-airway patency, swallowing, ventilation status, and rescue feasibility must be integrated rather than replaced by one universal cutoff.',
    referenceIds: [
      'mussa-aarc-2021',
      'hernandez-decannulation-2020',
      'johnson-manometry-2009',
      'medrinal-consensus-2026',
    ],
  },
]

export function getTracheostomyQuizQuestions(locale: string): TracheostomyQuizQuestion[] {
  return pickLocaleContent(locale, { en: tracheostomyQuizQuestions })
}
