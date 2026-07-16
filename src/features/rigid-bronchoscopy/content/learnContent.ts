import { pickLocaleContent } from '@/i18n/content'
import type { LearnBlock } from '@/features/learning-module/types'

import {
  rigidCoreBlocksEs,
  rigidCoreBlocksZhCn,
  rigidGoDeeperBlocksEs,
  rigidGoDeeperBlocksZhCn,
  rigidObjectivesEs,
  rigidObjectivesZhCn,
} from './learnContentLocalized'

/**
 * Didactic content for the Rigid Bronchoscopy "Learn" section. Paraphrased
 * teaching in our own words; recommendations trace to the module references
 * (chest-ip-2003, chest-cao-guideline-2025,
 * diaz-jimenez-interventions-2023, sarkiss-eapen-airway-management-2022,
 * putz-jet-ventilation-2016, yang-jet-model-2025, ernst-cao-2004,
 * sakr-dutau-2010, asa-or-fire-2013, folch-stents-2018).
 * Simulation and professional-education framing only.
 *
 * English is authored here, with Spanish and Simplified Chinese variants in
 * `learnContentLocalized.ts`; unsupported locales fall back to English.
 */

export const rigidObjectives = [
  'Identify the four interfaces of the EFER universal barrel and choose the main axial or lateral accessory route for a compatible instrument configuration.',
  'State the indications and contraindications for rigid bronchoscopy and assess the airway.',
  'Compare conventional, spontaneous-assisted, low-frequency jet, and high-frequency jet ventilation in the shared airway and anticipate leak, gas trapping, and barotrauma.',
  'Describe therapeutic coring, dilation, stents, foreign-body retrieval, and endobronchial hemostasis, and apply airway-fire safety.',
] as const

export const rigidCoreBlocks: LearnBlock[] = [
  {
    id: 'equipment',
    title: 'Equipment familiarization',
    paragraphs: [
      'The rigid bronchoscope is a hollow metal tube that secures a large-bore airway and serves as a working platform. This lab models the EFER universal barrel; other systems can place and configure their ports differently.',
    ],
    bullets: [
      'The EFER barrel has four distinct interfaces: a main horizontal/axial working port, a smaller lateral accessory port, a larger lateral anaesthesia-circuit port, and a fixed jet-ventilation gate.',
      'The main axial port accepts configuration-specific caps for the telescope with compatible optical forceps, suction, or other large axial instruments. The smaller accessory port accepts a BB2401 or BB2402 obturator for compatible slender accessories.',
      'The anaesthesia-circuit and jet ports are ventilation inlets, not instrument routes. Controlled and spontaneous-assisted ventilation use the anaesthesia-circuit port; jet ventilation uses the dedicated jet gate.',
      'The rod-lens telescope provides a magnified view, while the bevelled distal tube tip is used for intubation and mechanical coring. The telescope objective, tube bevel, and instrument endpoint are separate landmarks.',
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
    title: 'Anesthesia and shared-airway ventilation',
    paragraphs: [
      'Rigid bronchoscopy is a shared-airway procedure: the operator and the anaesthesia team use the same airway at the same time, so communication is continuous.',
    ],
    bullets: [
      'Conventional controlled ventilation delivers positive-pressure inspiration and receives expiration through the large anaesthesia-circuit port with the selected proximal instrument caps sealed. The uncuffed rigid tube can still leak around the larynx or proximal interfaces.',
      'Spontaneous-assisted ventilation preserves patient-generated inspiration through the breathing circuit and adds clearly separate manual or pressure-assist events through that same anaesthesia-circuit port when effort is inadequate. It does not ventilate through the main axial instrument port.',
      'Low-frequency jet ventilation produces discrete, lower-frequency pulses through the fixed jet gate; high-frequency jet ventilation produces more rapid, smaller pulses through the same dedicated inlet. Both use passive egress through an open system and require device-specific monitoring.',
      'CHEST conditionally suggests either jet ventilation or controlled/spontaneous-assisted ventilation for rigid therapeutic bronchoscopy under general anaesthesia, with very low certainty of evidence. The lab therefore compares modes without ranking one as universally preferred.',
      'Jet ventilation requires adequate expiratory egress — jetting against an obstructed distal airway causes gas trapping and barotrauma. Apnoeic oxygenation is an adjunct for brief procedural pauses, not a substitute for ventilation.',
      'A ball-valve lesion may admit inspired gas but restrict passive expiration, so retained distal volume can increase breath by breath. A fixed complete obstruction instead blocks distal inspiration as well as expiration.',
      'Long bronchial tubes have distal fenestrations that can preserve a route toward the contralateral mainstem only when both depth and rotation align the openings appropriately. A shallow bronchial tube can leave fenestrations above the cords and create a major leak.',
      'A short nonfenestrated tracheal tube has no contralateral fenestration route after mainstem entry, but “nonfenestrated” does not mean leak-free: an uncuffed system can still leak around the larynx or through an incompletely sealed proximal interface.',
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
  return pickLocaleContent(locale, {
    en: rigidObjectives as readonly string[],
    es: rigidObjectivesEs,
    'zh-CN': rigidObjectivesZhCn,
  })
}

export function getRigidCoreBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: rigidCoreBlocks,
    es: rigidCoreBlocksEs,
    'zh-CN': rigidCoreBlocksZhCn,
  })
}

export function getRigidGoDeeperBlocks(locale: string): LearnBlock[] {
  return pickLocaleContent(locale, {
    en: rigidGoDeeperBlocks,
    es: rigidGoDeeperBlocksEs,
    'zh-CN': rigidGoDeeperBlocksZhCn,
  })
}
