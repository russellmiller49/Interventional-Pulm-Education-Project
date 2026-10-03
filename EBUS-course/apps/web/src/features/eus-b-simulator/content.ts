import type { EusLayerState, EusStructureGroup } from './types';

/**
 * Learner-facing copy for the EUS-B simulator.
 *
 * REVIEW STATUS: draft. The landmark notes describe what the calibrated view of this case
 * contains (checked against render-eus-b-review.mts output); they have not had physician review.
 * Access statements repeat the wording already used in the guided EBUS course
 * (src/features/ebus-guided/content/plan.ts, lesson "Where EUS-B complements EBUS").
 */

export type EusLandmarkGroup = 'nodes' | 'mediastinum' | 'abdomen';

export interface EusLandmarkContent {
  key: string;
  title: string;
  subtitle?: string;
  group: EusLandmarkGroup;
  /** What the learner should be able to point to in the calibrated view. */
  lookFor: string;
  /** Clinical scope or model boundary that belongs with this landmark. */
  note?: string;
}

export const EUS_LANDMARK_GROUPS: Array<{ key: EusLandmarkGroup; label: string }> = [
  { key: 'nodes', label: 'Lymph node stations' },
  { key: 'mediastinum', label: 'Mediastinal landmarks' },
  { key: 'abdomen', label: 'Below the diaphragm' },
];

const VESSEL_IN_PATH =
  'Stations 5 and 6 are not routine targets for EUS-B needle sampling: a great vessel lies in the path.';

export const EUS_LANDMARKS: EusLandmarkContent[] = [
  {
    key: 'station_2l',
    title: 'Station 2L',
    subtitle: 'Left upper paratracheal',
    group: 'nodes',
    lookFor:
      'A small node in the near field. The echo-free vessels beyond it are the aortic arch and its branches.',
  },
  {
    key: 'station_4l',
    title: 'Station 4L',
    subtitle: 'Left lower paratracheal',
    group: 'nodes',
    lookFor:
      'The node lies between two echo-free vessels: the aortic arch on the proximal side of the image and the pulmonary artery on the distal side.',
  },
  {
    key: 'station_7',
    title: 'Station 7',
    subtitle: 'Subcarinal',
    group: 'nodes',
    lookFor:
      'The node sits in the near field against the esophageal wall. The pulmonary artery crosses beyond it as a large echo-free oval.',
  },
  {
    key: 'station_8',
    title: 'Station 8',
    subtitle: 'Paraesophageal, below the carina',
    group: 'nodes',
    lookFor:
      'A small node against the esophageal wall. The echo-free chambers beyond it are the left and right atria.',
  },
  {
    key: 'station_9',
    title: 'Station 9',
    subtitle: 'Pulmonary ligament',
    group: 'nodes',
    lookFor:
      'A small node close to the esophagus with a pulmonary vein beside it. The bright line with a shadow behind it is aerated lung.',
  },
  {
    key: 'station_5',
    title: 'Station 5',
    subtitle: 'Subaortic',
    group: 'nodes',
    lookFor: 'Seen beyond station 4L, on the far side of the pulmonary artery and the aorta.',
    note: VESSEL_IN_PATH,
  },
  {
    key: 'station_6',
    title: 'Station 6',
    subtitle: 'Para-aortic',
    group: 'nodes',
    lookFor: 'The node lies on the far side of the aortic arch, with aerated lung just beyond it.',
    note: VESSEL_IN_PATH,
  },
  {
    key: 'aorta',
    title: 'Descending aorta',
    group: 'mediastinum',
    lookFor:
      'A wide echo-free band running the length of the image. Its bright far wall is where the aorta meets aerated lung.',
  },
  {
    key: 'pulmonary_artery',
    title: 'Left pulmonary artery',
    group: 'mediastinum',
    lookFor: 'A large echo-free vessel to the patient’s left of the esophagus.',
  },
  {
    key: 'left_atrium',
    title: 'Left atrium',
    group: 'mediastinum',
    lookFor: 'The echo-free chamber directly against the esophagus. It fills the sector.',
  },
  {
    key: 'azygos_vein',
    title: 'Azygos vein',
    group: 'mediastinum',
    lookFor:
      'An echo-free vessel to the patient’s right of the esophagus, at the level of the azygos arch.',
  },
  {
    key: 'liver',
    title: 'Left lobe of the liver',
    group: 'abdomen',
    lookFor:
      'Even, mid-gray parenchyma against the gastric wall, just beyond the gastroesophageal junction.',
    note: 'Hepatic vessels are not segmented in this case, so the parenchyma looks more uniform than a real liver.',
  },
  {
    key: 'left_adrenal',
    title: 'Left adrenal gland',
    group: 'abdomen',
    lookFor:
      'A darker structure a short distance beyond the gastric wall. The left kidney is a short rotation away.',
    note: 'EUS-B may allow selected subdiaphragmatic targets to be assessed. This view shows where the gland lies; it does not teach adrenal sampling.',
  },
  {
    key: 'left_kidney',
    title: 'Left kidney',
    group: 'abdomen',
    lookFor: 'A large organ that fills the sector beyond the gastric wall.',
    note: 'The renal sinus is not segmented, so the kidney has no bright central complex here.',
  },
  {
    key: 'pancreas',
    title: 'Pancreas',
    group: 'abdomen',
    lookFor: 'Slightly brighter parenchyma beyond the gastric wall.',
  },
  {
    key: 'portal_splenic_vein',
    title: 'Splenic and portal veins',
    group: 'abdomen',
    lookFor: 'An echo-free vessel running along the pancreas.',
  },
];

export const EUS_LANDMARK_BY_KEY = new Map(EUS_LANDMARKS.map((landmark) => [landmark.key, landmark]));

export const EUS_LAYER_LABELS: Record<keyof EusLayerState, string> = {
  node: 'Lymph nodes',
  vessel: 'Vessels',
  heart: 'Heart',
  airway: 'Airway',
  gi: 'Esophagus and stomach',
  organ: 'Abdominal organs',
  bone: 'Spine',
};

export const EUS_DEFAULT_LAYERS: EusLayerState = {
  node: true,
  vessel: true,
  heart: true,
  airway: true,
  gi: true,
  organ: true,
  bone: true,
};

export function isLayerGroup(group: EusStructureGroup): group is keyof EusLayerState {
  return group in EUS_DEFAULT_LAYERS;
}

export const EUS_INTRO = {
  eyebrow: 'Esophageal approach with the EBUS endoscope',
  title: 'EUS-B Simulator',
  lede: 'Drive the EBUS endoscope down the esophagus and into the proximal stomach. The ultrasound image, the 3D anatomy and the CT follow the scope.',
  controls:
    'Three controls move the image: advance or withdraw, rotate the shaft, and angle the tip.',
  scope:
    'EUS-B can complement airway EBUS, particularly for stations 4L, 7, 8 and 9. It does not replace the airway examination of hilar or interlobar nodes.',
};

export const EUS_ORIENTATION_NOTES = [
  'The top of the sector is the transducer. Depth increases down the image.',
  'The right side of the image is the proximal side of the scope, toward the operator. The left side is toward the tip.',
  'Clockwise rotation, viewed from the handle toward the tip, turns the transducer from anterior toward the patient’s right. Counterclockwise turns it toward the patient’s left.',
];

export const EUS_MODEL_LIMITS = [
  'The ultrasound image is simulated from one patient’s CT and segmentation. It is not a clinical image and is not validated for diagnosis.',
  'Structures that were not segmented, including the spleen, celiac trunk and hepatic veins, appear as plain soft tissue.',
  'The transducer is always in contact with the wall it faces. Balloon coupling, lumen air and scope resistance are not simulated.',
  'Needle sampling and Doppler are not simulated.',
  'The scope follows one authored path. Depth from the incisors is an estimate.',
  'Lymph node stations are the contours drawn for this case.',
];

export const EUS_FIND_COPY = {
  intro:
    'Pick a target and find it with the scope. The landmark list, the level name, structure colors and tissue names stay hidden until the target is held in the image.',
  ultrasoundOnly: 'Ultrasound only (hide the 3D anatomy and CT)',
  searching: 'Searching. Hold the target in the image to finish.',
};
