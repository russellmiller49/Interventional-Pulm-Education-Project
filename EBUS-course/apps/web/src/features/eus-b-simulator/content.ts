import type { EusLayerState, EusStructureGroup } from './types';

/**
 * Learner-facing copy for the EUS-B simulator.
 *
 * REVIEW STATUS: draft. The landmark notes describe what the calibrated view of this case
 * contains (checked against render-eus-b-review.mts output); they have not had physician review.
 * The statement that stations 8 and 9 were drawn at their expected location, with no node visible
 * on the CT, comes from the physician who made the segmentation, who also asked for them to be
 * painted into the CT view as nodes. Every surface that shows them keeps saying they were added.
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
const PLACED_STATION =
  'This node was added for teaching. The patient’s CT showed no node at this station: the node was drawn where the station lies and painted into the CT view, so it teaches the location, not a finding in this patient.';

/** Shown under the CT whenever a painted node is in the image. */
export const EUS_PAINTED_CT_NOTE =
  'Stations 8 and 9 were painted into this CT for teaching. The patient’s scan showed no node at either station.';

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
      'The marked station lies against the esophageal wall. Beyond it, the inferior vena cava and right atrium are the echo-free spaces on the distal side of the image, and the left atrium is on the proximal side.',
    note: PLACED_STATION,
  },
  {
    key: 'station_9',
    title: 'Station 9',
    subtitle: 'Pulmonary ligament',
    group: 'nodes',
    lookFor:
      'The marked station lies against the esophageal wall with a pulmonary vein just beyond it. The bright line with repeating echoes and a shadow behind it is aerated lung.',
    note: PLACED_STATION,
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
    note: 'Hepatic veins are not segmented in this case, so the parenchyma looks more uniform than a real liver.',
  },
  {
    key: 'celiac_trunk',
    title: 'Celiac trunk',
    subtitle: 'With the abdominal aorta',
    group: 'abdomen',
    lookFor:
      'The echo-free oval a short distance beyond the gastric wall is the celiac trunk, with the superior mesenteric artery as a smaller circle just beyond it. In the far field, the abdominal aorta lies on the distal side of the image and the inferior vena cava on the proximal side.',
  },
  {
    key: 'superior_mesenteric_artery',
    title: 'Superior mesenteric artery',
    subtitle: 'With the pancreas and splenic vein',
    group: 'abdomen',
    lookFor:
      'The superior mesenteric artery is the long echo-free band on the proximal side of the far field. On the distal side, the brighter tissue is the pancreas and the round echo-free vessel in it is the splenic vein.',
  },
  {
    key: 'left_adrenal',
    title: 'Left adrenal gland',
    group: 'abdomen',
    lookFor:
      'A darker structure a short distance beyond the gastric wall. The left kidney is a short rotation away. The bright line with a shadow behind it, deep on the proximal side, is bone.',
    note: 'EUS-B may allow selected subdiaphragmatic targets to be assessed. This view shows where the gland lies; it does not teach adrenal sampling.',
  },
  {
    key: 'left_kidney',
    title: 'Left kidney',
    group: 'abdomen',
    lookFor: 'A large organ that fills the sector beyond the gastric wall.',
    note: 'The brighter renal sinus is estimated from the shape of the kidney contour. It was not drawn on the CT.',
  },
  {
    key: 'spleen',
    title: 'Spleen',
    group: 'abdomen',
    lookFor: 'Even, fine-grained parenchyma that fills the sector beyond the gastric wall.',
  },
  {
    key: 'pancreas',
    title: 'Pancreas',
    subtitle: 'Body',
    group: 'abdomen',
    lookFor:
      'Slightly brighter, coarser parenchyma just beyond the gastric wall. The echo-free vessel at its deep edge, on the proximal side, is the splenic vein. The loop deeper on the distal side is small bowel.',
  },
  {
    key: 'splenic_vein',
    title: 'Splenic vein',
    subtitle: 'With the pancreatic tail',
    group: 'abdomen',
    lookFor:
      'An echo-free band across the image a short distance beyond the gastric wall. The pancreas lies beyond it on the distal side, and the left kidney deeper on the proximal side.',
  },
];

export const EUS_LANDMARK_BY_KEY = new Map(EUS_LANDMARKS.map((landmark) => [landmark.key, landmark]));

export const EUS_LAYER_LABELS: Record<keyof EusLayerState, string> = {
  node: 'Lymph nodes',
  vessel: 'Vessels',
  heart: 'Heart',
  airway: 'Airway',
  gi: 'Esophagus, stomach, duodenum',
  bowel: 'Small bowel and colon',
  organ: 'Abdominal organs',
  bone: 'Spine',
};

/** What kind of structure a name belongs to, shown under the name when it is pointed at. */
export const EUS_GROUP_NAMES: Record<EusStructureGroup, string> = {
  node: 'Lymph node station',
  vessel: 'Vessel',
  heart: 'Heart',
  airway: 'Airway',
  gi: 'Upper gastrointestinal tract',
  bowel: 'Bowel',
  organ: 'Organ',
  bone: 'Bone',
  background: 'Not segmented',
};

export const EUS_DEFAULT_LAYERS: EusLayerState = {
  node: true,
  vessel: true,
  heart: true,
  airway: true,
  gi: true,
  bowel: true,
  organ: true,
  bone: true,
};

export function isLayerGroup(group: EusStructureGroup): group is keyof EusLayerState {
  return group in EUS_DEFAULT_LAYERS;
}

export const EUS_INTRO = {
  eyebrow: 'Esophageal approach with the EBUS endoscope',
  title: 'EUS-B Simulator',
  lede: 'Drive the EBUS endoscope down the esophagus and into the proximal stomach. The ultrasound image, the 3D anatomy and the endoscopic or CT view follow the scope.',
  controls:
    'Three controls move the image: advance or withdraw, rotate the shaft, and angle the tip.',
  scope:
    'EUS-B can complement airway EBUS, particularly for stations 4L, 7, 8 and 9. It does not replace the airway examination of hilar or interlobar nodes.',
};

export const EUS_ORIENTATION_NOTES = [
  'The top of the sector is the transducer. Depth increases down the image.',
  'The right side of the image is the proximal side of the scope, toward the operator. The left side is toward the tip.',
  'Clockwise rotation, viewed from the handle toward the tip, turns the transducer from anterior toward the patient’s right. Counterclockwise turns it toward the patient’s left.',
  'In the endoscopic view the top of the image is the transducer side. The lens looks 35° toward that side, so the lumen ahead sits low in the image and the scan plane runs up its middle.',
];

export const EUS_MODEL_LIMITS = [
  'The ultrasound image is simulated from one patient’s CT and segmentation. It is not a clinical image and is not validated for diagnosis.',
  'Echo brightness, speckle, shadowing and reverberation are modeled to teach tissue contrast. They are not measured tissue properties.',
  'Stations 8 and 9 were added for teaching. The patient’s CT showed no node at either station: each was drawn where the station lies and painted into the CT view to look like a node.',
  'The endoscopic view is a surface made from the esophagus and stomach contours and held open, seen through the EBUS endoscope’s 35° forward-oblique lens. Its colors and folds are not this patient’s. Fluid, peristalsis, the closed cardia and the loss of the view when the lens touches the wall are not simulated.',
  'Structures that were not segmented, including the hepatic veins and the renal veins, appear as plain soft tissue.',
  'Gastric and bowel contents and the renal sinus are estimated from the CT. They were not drawn.',
  'The transducer is always in contact with the wall it faces. Balloon coupling, lumen air and scope resistance are not simulated.',
  'Needle sampling and Doppler are not simulated.',
  'The scope follows one authored path. Depth from the incisors is an estimate.',
  'Lymph node stations are the contours drawn for this case.',
];

export const EUS_FIND_COPY = {
  intro:
    'Pick a target and find it with the scope. The landmark list, the level name, structure colors and structure names stay hidden until the target is held in the image.',
  ultrasoundOnly: 'Ultrasound only (hide the 3D anatomy and the endoscopic or CT view)',
  searching: 'Searching. Hold the target in the image to finish.',
};
