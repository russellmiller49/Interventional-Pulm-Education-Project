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
  left_atrium: 'the left atrium',
  azygos_vein: 'the azygos vein',
  station_2l: 'station 2L',
  station_4l: 'station 4L',
  station_4r: 'station 4R',
  station_7: 'station 7',
  station_8: 'station 8',
  station_9: 'station 9',
}

export function structureName(key: string) {
  return STRUCTURE_NAMES[key] ?? 'the ' + key.replace(/_/g, ' ')
}
