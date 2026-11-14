/**
 * What the course calls each structure a task can ask for, with its article, as it reads inside a
 * sentence ("bring the left lobe of the liver into the image", "bring station 7 into the image").
 * Keys are the case's structure keys.
 */
const STRUCTURE_NAMES: Record<string, string> = {
  liver: 'the left lobe of the liver',
  celiac_trunk: 'the celiac trunk',
  superior_mesenteric_artery: 'the superior mesenteric artery',
  left_adrenal: 'the left adrenal gland',
  left_kidney: 'the left kidney',
  spleen: 'the spleen',
  aorta: 'the aorta',
  pulmonary_artery: 'the pulmonary artery',
  pulmonary_veins: 'the pulmonary vein',
  left_atrium: 'the left atrium',
  right_atrium: 'the right atrium',
  inferior_vena_cava: 'the inferior vena cava',
  left_subclavian_artery: 'the left subclavian artery',
  left_common_carotid_artery: 'the left common carotid artery',
  azygos_vein: 'the azygos vein',
  station_2l: 'station 2L',
  station_4l: 'station 4L',
  station_4r: 'station 4R',
  station_5: 'station 5',
  station_6: 'station 6',
  station_7: 'station 7',
  station_8: 'station 8',
  station_9: 'station 9',
}

export function structureName(key: string) {
  return STRUCTURE_NAMES[key] ?? 'the ' + key.replace(/_/g, ' ')
}
