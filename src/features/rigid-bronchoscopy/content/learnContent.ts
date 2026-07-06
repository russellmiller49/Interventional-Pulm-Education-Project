import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

/**
 * Didactic content for the Rigid Bronchoscopy "Learn" section. Paraphrased
 * teaching in our own words; recommendations trace to the module references
 * (chest-ip-2003, ernst-cao-2004, sakr-dutau-2010, asa-or-fire-2013,
 * folch-stents-2018). Simulation and professional-education framing only.
 *
 * English is authored here; `pickLocaleContent` falls back to English for
 * locales without a translated variant yet.
 */

export const rigidObjectives = [
  'Identify the parts of a ventilating rigid bronchoscope and the ablative and hemostatic instruments.',
  'State the indications and contraindications for rigid bronchoscopy and assess the airway.',
  'Coordinate ventilation in the shared airway (controlled vs jet, apnoeic oxygenation) and anticipate barotrauma.',
  'Describe therapeutic coring, dilation, stents, foreign-body retrieval, and endobronchial hemostasis, and apply airway-fire safety.',
] as const

export const rigidCoreBlocks: LearnBlock[] = [
  {
    id: 'equipment',
    title: 'Equipment familiarization',
    paragraphs: [
      'The rigid bronchoscope is a hollow metal tube that both secures a large-bore airway and serves as a working channel. Knowing the parts is the foundation for everything else.',
    ],
    bullets: [
      'Ventilating rigid barrel with a side port for the anaesthesia circuit or a jet ventilator, and a bevelled distal tip used to intubate and to core tumour.',
      'Rod-lens telescope for a magnified view, and optical (telescope-aligned) forceps for grasping, biopsy, and foreign-body retrieval.',
      'Adapters for the ablative and hemostatic modalities: Nd:YAG laser, argon plasma coagulation (APC), cryotherapy, and mechanical instruments.',
    ],
  },
  {
    id: 'indications-contraindications',
    title: 'Indications, contraindications, and airway assessment',
    bullets: [
      'Indications: central airway obstruction (malignant or benign) for coring, dilation, or stenting; massive haemoptysis; large or complex foreign-body retrieval.',
      'Relative contraindications: unstable cervical spine, severely restricted mouth opening or neck mobility, and an inability to ventilate or oxygenate.',
      'Assess the airway (mouth opening, dentition, neck mobility, the level and length of obstruction on imaging) and plan ventilation before starting.',
    ],
  },
  {
    id: 'anesthesia-ventilation',
    title: 'Anesthesia and ventilation coordination',
    paragraphs: [
      'Rigid bronchoscopy is a shared-airway procedure: the operator and the anaesthesia team use the same airway at the same time, so communication is continuous.',
    ],
    bullets: [
      'Usually total intravenous anaesthesia (TIVA) so there is no reliance on a sealed circuit for volatile agents.',
      'Ventilation options include controlled (through the side port) and jet ventilation, supplemented by apnoeic oxygenation for brief pauses.',
      'Jet ventilation requires adequate expiratory egress — jetting against an obstructed distal airway causes gas trapping and barotrauma.',
    ],
  },
  {
    id: 'therapeutics',
    title: 'Therapeutic overview',
    paragraphs: [
      'The rigid scope is a platform for restoring and maintaining a central airway. Most cases combine several tools in one session.',
    ],
    bullets: [
      'Mechanical tumour coring/debulking with the rigid bevel and forceps rapidly re-establishes a lumen in endoluminal obstruction.',
      'Dilation and airway stents hold open extrinsic or structural stenoses; stents are sized to the airway and carry their own complications.',
      'Foreign-body retrieval uses the large bore and optical forceps; endobronchial hemostasis manages central-airway bleeding.',
      'Ablative modalities — Nd:YAG laser (non-contact photocoagulation), APC (non-contact coagulation), and cryotherapy (adhesion/devitalization) — are chosen by task and by airway-fire risk.',
    ],
  },
  {
    id: 'hemostasis',
    title: 'Endobronchial hemostasis for central-airway hemorrhage',
    bullets: [
      'Protect the airway first: position the bleeding side down and isolate the lungs to keep blood out of the contralateral (good) lung.',
      'Apply tamponade (balloon or the rigid barrel) and topical/pharmacologic hemostatics such as cold saline, epinephrine, and tranexamic acid.',
      'Use APC or laser for a visible bleeding source; escalate to bronchial artery embolization or surgery when endobronchial control fails.',
    ],
  },
  {
    id: 'fire-safety',
    title: 'Operating-room airway-fire safety',
    paragraphs: [
      'Any energy device in an oxygen-rich shared airway is a fire hazard. Fire prevention is an anaesthesia–operator shared responsibility built on the fire triad.',
    ],
    bullets: [
      'The fire triad is an oxidiser (oxygen/nitrous oxide), an ignition source (laser/electrosurgery), and fuel (tube, tissue) — remove one leg to prevent fire.',
      'Before airway energy, reduce FiO₂ to the lowest tolerated level and avoid nitrous oxide; this is the single most controllable factor.',
      'If a fire occurs: stop the energy, stop the gases, remove the tube/flammable material, and extinguish with saline — then ventilate and assess for injury.',
    ],
  },
]

export const rigidGoDeeperBlocks: LearnBlock[] = [
  {
    id: 'modality-selection',
    title: 'Choosing an ablative modality',
    level: 'advanced',
    bullets: [
      'For immediate hemostasis and debulking, non-contact thermal modalities (Nd:YAG laser, APC) coagulate as they treat; APC is well suited to superficial, broad, or bleeding lesions.',
      'Cryotherapy devitalizes and removes tissue or clot by adhesion but is not immediately hemostatic and has delayed tissue effects — it carries a low airway-fire risk.',
      'All thermal energy in the airway is governed by the same FiO₂/fire-safety discipline.',
    ],
  },
  {
    id: 'stent-considerations',
    title: 'Airway stent considerations',
    level: 'advanced',
    bullets: [
      'Stents relieve obstruction but can migrate, granulate, obstruct with secretions, or fracture — sizing and follow-up matter.',
      'The decision to stent weighs the mechanism of obstruction (intrinsic vs extrinsic vs mixed) against the expected durability and the airway involved.',
    ],
  },
]

export function getRigidObjectives(locale: string): readonly string[] {
  return pickLocaleContent(locale, { en: rigidObjectives as readonly string[] })
}

export function getRigidCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, { en: rigidCoreBlocks })
}

export function getRigidGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, { en: rigidGoDeeperBlocks })
}
