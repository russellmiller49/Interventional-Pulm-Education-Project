import { pickLocaleContent } from '@/i18n/content'
import type { QuizQuestion } from '@/components/training/Quiz'

/**
 * Assessment items for the Rigid Bronchoscopy module, aligned to the Learn
 * objectives (equipment, indications/contraindications, ventilation, coring,
 * stents, hemostasis, and airway-fire safety). Commit-first: explanations
 * appear only after answering. Reference ids are noted per item in comments.
 * English is authored here; other locales fall back to English until translated.
 */
export const rigidBronchoscopyQuizQuestions: QuizQuestion[] = [
  {
    // chest-ip-2003, ernst-cao-2004
    prompt: 'Which best captures a core indication for rigid bronchoscopy?',
    options: [
      'Routine diagnostic sampling of a small peripheral nodule',
      'Central airway obstruction needing coring, dilation, or stenting, and massive haemoptysis',
      'Outpatient surveillance of stable asthma',
      'Pleural fluid drainage',
    ],
    answerIndex: 1,
    explanation:
      'Rigid bronchoscopy secures a large-bore airway for central-airway work — coring/debulking, dilation, stenting — and for massive haemoptysis and large foreign-body retrieval. Peripheral sampling is a flexible-bronchoscopy task.',
  },
  {
    // chest-ip-2003
    prompt: 'Which is a relative contraindication to rigid bronchoscopy?',
    options: [
      'A central airway tumour',
      'An unstable cervical spine or severely restricted neck mobility',
      'Massive haemoptysis',
      'A tracheal foreign body',
    ],
    answerIndex: 1,
    explanation:
      'Rigid bronchoscopy requires neck extension and mouth opening to align and pass the scope. An unstable cervical spine, restricted mouth opening/neck mobility, or an inability to ventilate are relative contraindications.',
  },
  {
    // chest-ip-2003
    prompt: 'Why is rigid bronchoscopy described as a "shared airway" procedure?',
    options: [
      'Two operators must hold the scope',
      'The operator and the anaesthesia team use the same airway simultaneously, so ventilation is coordinated continuously',
      'The patient shares a ventilator with another patient',
      'It can only be done with two bronchoscopes',
    ],
    answerIndex: 1,
    explanation:
      'The operator instruments the same airway the anaesthesia team is ventilating. That is why TIVA, controlled or jet ventilation, apnoeic oxygenation, and constant communication are central.',
  },
  {
    // chest-ip-2003
    prompt:
      'During jet ventilation through the rigid scope, the greatest risk from obstructed expiratory egress is:',
    options: [
      'Hypothermia',
      'Gas trapping leading to barotrauma (e.g., pneumothorax)',
      'Excessive humidification',
      'Hyperoxia',
    ],
    answerIndex: 1,
    explanation:
      'Jetting gas in without an adequate route out causes dynamic hyperinflation and barotrauma — rising pressures, subcutaneous emphysema, and pneumothorax. Ensure egress before continuing.',
  },
  {
    // ernst-cao-2004
    prompt: 'What is the correct order when mechanically coring a vascular obstructing tumour?',
    options: [
      'Core first, then think about ventilation',
      'Confirm ventilation and reduce FiO₂ (if using energy), devascularize the surface, then core and secure hemostasis',
      'Raise FiO₂ to 1.0 and apply the laser immediately',
      'Deploy a stent before establishing any lumen',
    ],
    answerIndex: 1,
    explanation:
      'Secure ventilation and minimize FiO₂ before energy, coagulate the surface to reduce bleeding, core with the rigid bevel, then achieve hemostasis and reassess patency.',
  },
  {
    // asa-or-fire-2013
    prompt:
      'Before activating a laser in the shared airway, the single most controllable factor to reduce airway-fire risk is to:',
    options: [
      'Increase the tidal volume',
      'Reduce FiO₂ to the lowest tolerated level and avoid nitrous oxide',
      'Increase FiO₂ to protect against desaturation',
      'Switch to a larger endotracheal tube',
    ],
    answerIndex: 1,
    explanation:
      'Oxygen (and nitrous oxide) is the oxidiser leg of the fire triad and the most controllable one. Reducing FiO₂ to the lowest tolerated level before airway energy is the key prevention step.',
  },
  {
    // asa-or-fire-2013
    prompt: 'If an airway fire occurs, the immediate response is to:',
    options: [
      'Keep oxygen flowing and search for the ignition source',
      'Stop the energy, stop the gases, remove the tube/flammable material, and extinguish with saline',
      'Increase ventilation to blow out the fire',
      'Continue the case and cool the field with more oxygen',
    ],
    answerIndex: 1,
    explanation:
      'The fire algorithm is: stop the ignition source, stop the gases (oxygen feeds the fire), remove flammable material such as the tube, and extinguish with saline — then re-establish ventilation and assess for injury.',
  },
  {
    // sakr-dutau-2010, ernst-cao-2004
    prompt: 'The first priority when brisk central-airway hemorrhage fills the airway is to:',
    options: [
      'Immediately give systemic thrombolytics',
      'Protect the airway — position the bleeding side down and isolate the lungs to protect the contralateral lung',
      'Remove the bronchoscope and abort',
      'Raise the head of the bed and observe',
    ],
    answerIndex: 1,
    explanation:
      'Protecting the good lung comes first: bleeding side down and lung isolation prevent soiling and asphyxia. Tamponade and topical/pharmacologic endobronchial hemostasis follow.',
  },
  {
    // ernst-cao-2004
    prompt: 'Which statement about ablative modalities is correct?',
    options: [
      'Cryotherapy provides immediate hemostasis',
      'Nd:YAG laser and APC coagulate as they treat, whereas cryotherapy removes tissue by adhesion and is not immediately hemostatic',
      'APC is a contact-only modality with no fire risk',
      'Laser can be used safely at any FiO₂',
    ],
    answerIndex: 1,
    explanation:
      'Non-contact thermal modalities (Nd:YAG laser, APC) coagulate and are useful for hemostasis; cryotherapy devitalizes/removes tissue by adhesion with delayed effect and is not immediately hemostatic. All thermal energy requires FiO₂/fire discipline.',
  },
  {
    // folch-stents-2018
    prompt: 'A recognized late complication of an airway stent is:',
    options: [
      'Permanent cure of the underlying disease',
      'Migration, granulation tissue, secretion obstruction, or stent fracture',
      'Elimination of the need for follow-up',
      'Spontaneous resorption within a day',
    ],
    answerIndex: 1,
    explanation:
      'Stents relieve obstruction but can migrate, incite granulation tissue, obstruct with inspissated secretions, or fracture — which is why sizing and follow-up matter.',
  },
]

export function getRigidQuizQuestions(locale: string): QuizQuestion[] {
  return pickLocaleContent(locale, { en: rigidBronchoscopyQuizQuestions })
}
