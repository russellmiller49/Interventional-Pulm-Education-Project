import manifest from './dolphin-001-manifest.json'

/**
 * The structures of the dolphin anatomy model. Geometry, colours and volumes come from the build
 * (scripts/dolphin-anatomy/build-dolphin-organs.py writes dolphin-001-manifest.json beside this
 * file and the GLB in public/); the teaching notes are written here, one per structure id.
 */

export type DolphinSystem =
  | 'skeleton'
  | 'respiratory'
  | 'cardiovascular'
  | 'nervous'
  | 'digestive'
  | 'body-wall'

export interface DolphinStructure {
  readonly id: string
  readonly name: string
  readonly system: DolphinSystem
  readonly color: readonly [number, number, number]
  readonly volumeMl: number
  readonly note: string
}

export const DOLPHIN_MODEL_URL = manifest.modelUrl

export const SYSTEMS: readonly { readonly id: DolphinSystem; readonly label: string }[] = [
  { id: 'respiratory', label: 'Respiratory' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'cardiovascular', label: 'Heart and great vessels' },
  { id: 'nervous', label: 'Nervous system' },
  { id: 'digestive', label: 'Digestive tract and abdomen' },
  { id: 'body-wall', label: 'Body wall' },
]

export const STRUCTURE_NOTES: Readonly<Record<string, string>> = {
  'body-surface':
    'The fusiform body from the blowhole region to just behind the dorsal fin. The pectoral flippers lie against the flanks. The dorsal fin is dense connective tissue with no bone in it.',
  'skin-blubber':
    'A layer of fat and collagen under the skin, about 2 to 3 cm deep over the trunk of this animal. It insulates, streamlines the body and stores energy.',
  'abdominal-cavity':
    'The abdomen holds the liver, the multichambered stomach, the intestines, the kidneys (each built of many small lobes, the reniculi), the spleen and, in males, the testes, which stay inside the abdomen. On this scan, made without contrast, those organs cannot be told apart, so the abdomen is shown as one cavity.',
  'gi-gas':
    'Gas inside the stomach and intestines. The animal lay prone, so the gas rose to the dorsal side of each loop.',
  esophagus:
    'The esophagus runs dorsal to the trachea to the stomach. Swallowed food passes on either side of the laryngeal spout to reach it, so breathing and swallowing follow separate paths.',
  heart:
    'The heart lies ventrally in the thorax, on the sternum between the two lungs. In this animal it is broad and flat from dorsal to ventral.',
  aorta:
    'The aorta leaves the heart, arches to the left and runs caudally along the ventral surface of the vertebral column.',
  brain:
    'The brain is large for the body, with broad, deeply folded cerebral hemispheres. It fills a short, high braincase behind the nasal passages.',
  'spinal-cord':
    'The spinal cord leaves the skull through the foramen magnum and runs in the vertebral canal.',
  'nasal-passages':
    'Paired bony nasal passages rise almost vertically through the skull from the nasopharynx toward the single blowhole. The nasopharynx below them surrounds the tip of the laryngeal spout. Above the bony nares, the soft nasal passages and the nasal plugs held no air in this scan, so they are not shown.',
  'pterygoid-sinus-left':
    'An air sinus that opens into the nasopharynx through the auditory tube and spreads around the base of the skull and the ear bones. With the peribullar sinus it is thought to isolate the ear acoustically from the skull, which aids directional hearing.',
  'pterygoid-sinus-right':
    'An air sinus that opens into the nasopharynx through the auditory tube and spreads around the base of the skull and the ear bones. With the peribullar sinus it is thought to isolate the ear acoustically from the skull, which aids directional hearing.',
  airway:
    'The arytenoid and epiglottic cartilages form a long tube, the laryngeal spout or goosebeak, that rises into the nasopharynx and keeps the airway separate from the mouth. The trachea is short and wide, and a tracheal bronchus leaves its right side before the carina. Cartilage supports the bronchi much farther toward the periphery than in the human lung.',
  'lung-left':
    'The lungs lie dorsally against the body wall and reach far caudally, because the diaphragm runs obliquely from the sternum up toward the vertebral column. They are not divided into lobes by fissures.',
  'lung-right':
    'The lungs lie dorsally against the body wall and reach far caudally, because the diaphragm runs obliquely from the sternum up toward the vertebral column. The right lung also receives the tracheal bronchus.',
  skull:
    'The skull is telescoped: the bones of the face have shifted back over the braincase and carried the nares to the top of the head. The scan includes the braincase and the bony nares but not the rostrum.',
  mandible:
    'Only the rear of the lower jaw is in the scan. Its thin, hollow back part, the pan bone, encloses a fat body that conducts sound to the ear.',
  hyoid:
    'Large hyoid bones in the floor of the throat anchor the tongue and the muscles that move the larynx and act in feeding.',
  'tympanoperiotic-left':
    'The tympanic bulla and periotic form one dense complex that hangs from the skull by ligaments and is surrounded by air sinuses rather than fused to the skull. These are the densest bones in the scan.',
  'tympanoperiotic-right':
    'The tympanic bulla and periotic form one dense complex that hangs from the skull by ligaments and is surrounded by air sinuses rather than fused to the skull. These are the densest bones in the scan.',
  'vertebral-column':
    'The neck is short and the first two cervical vertebrae are fused. Behind the thorax the vertebrae carry tall spines and long transverse processes that anchor the swimming muscles. There is no sacrum.',
  ribs: 'The ribs curve far ventrally around the lungs. The cranial ribs reach the sternum through bony sternal ribs; the caudal ribs do not reach it.',
  sternum:
    'The sternum lies ventral to the heart and is joined to the cranial ribs by bony sternal ribs.',
  'scapula-left':
    'A broad, fan-shaped scapula. The shoulder is the joint that moves the flipper, and there is no clavicle.',
  'scapula-right':
    'A broad, fan-shaped scapula. The shoulder is the joint that moves the flipper, and there is no clavicle.',
  'flipper-left':
    'The flipper holds the bones of the human arm: humerus, radius and ulna, carpals, metacarpals and phalanges. The humerus is short, the elbow and wrist barely move, and the digits carry extra phalanges.',
  'flipper-right':
    'The flipper holds the bones of the human arm: humerus, radius and ulna, carpals, metacarpals and phalanges. The humerus is short, the elbow and wrist barely move, and the digits carry extra phalanges.',
}

export const DOLPHIN_STRUCTURES: readonly DolphinStructure[] = manifest.structures.map((entry) => ({
  id: entry.id,
  name: entry.name,
  system: entry.system as DolphinSystem,
  color: entry.color as unknown as readonly [number, number, number],
  volumeMl: entry.volumeMl,
  note: STRUCTURE_NOTES[entry.id] ?? '',
}))

/** Drawn see-through, so the structures inside stay visible; never picked by a click. */
export const ENVELOPE_OPACITY: Readonly<Record<string, number>> = {
  'body-surface': 0.14,
  'abdominal-cavity': 0.24,
  'skin-blubber': 0.4,
}

/** Off when the model opens: it would hide everything inside it. */
export const HIDDEN_AT_START: ReadonlySet<string> = new Set(['skin-blubber'])

export function formatVolume(ml: number): string {
  if (ml >= 10000) return `${Math.round(ml / 1000)} L`
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`
  return `${Math.round(ml)} mL`
}
