import type { ThoracicStructureLabel, ThoracicStructureLabelDef } from '../types'

/**
 * Keyword table linking canonical structure labels to the anatomical mesh names
 * used by case GLB exports (e.g. Slicer writes "left pleural effusion",
 * "diaphragm " with a trailing space, "bone" for the whole skeleton). Matching
 * is substring-based over trimmed lowercase names so exporter quirks don't
 * break the mapping.
 */
export const meshKeywordsByLabel: Partial<Record<ThoracicStructureLabel, string[]>> = {
  skin: ['skin'],
  subcutaneousTissue: ['subcutaneous', 'fat'],
  intercostalMuscle: ['intercostal', 'muscle'],
  muscle: ['muscle'],
  rib: ['rib', 'bone', 'spine'],
  lung: ['lung'],
  atelectaticLung: ['atelecta'],
  consolidation: ['consolidation'],
  pleuralFluid: ['pleural effusion', 'pleural fluid', 'effusion'],
  pleuralThickening: ['pleural thickening'],
  pleuralNodule: ['pleural nodule'],
  septation: ['septation'],
  debris: ['debris'],
  diaphragm: ['diaphragm'],
  liver: ['liver'],
  spleen: ['spleen'],
  kidney: ['kidney'],
  heart: ['heart'],
  pericardium: ['pericardium'],
  greatVessel: [
    'aorta',
    'vena cava',
    'pulmonary artery',
    'pulmonary vein',
    'portal vein',
    'splenic vein',
  ],
  esophagus: ['esophagus', 'oesophagus'],
  airway: ['trachea', 'bronchus', 'airway'],
  thoracicCavity: ['thoracic cavity'],
  lymphNode: ['lymph'],
}

export function normalizeMeshName(name: string) {
  return name.trim().toLowerCase()
}

export function meshNamesForLabel(label: ThoracicStructureLabel, meshNames: string[]): string[] {
  const keywords = meshKeywordsByLabel[label]
  if (!keywords) {
    return []
  }

  return meshNames.filter((name) => {
    const normalized = normalizeMeshName(name)
    return keywords.some((keyword) => normalized.includes(keyword))
  })
}

/**
 * Fill each structure's `meshNames` from the loaded GLB's node names, keeping
 * any explicit assignments the manifest already made.
 */
export function matchMeshNamesToStructures(
  structures: ThoracicStructureLabelDef[],
  meshNames: string[],
): ThoracicStructureLabelDef[] {
  return structures.map((structure) => {
    if (structure.meshNames && structure.meshNames.length > 0) {
      return structure
    }

    const matched = meshNamesForLabel(structure.label, meshNames)
    return matched.length > 0 ? { ...structure, meshNames: matched } : structure
  })
}

/** First structure that claims a mesh name, or null when none does. */
export function structureForMeshName(
  meshName: string,
  structures: ThoracicStructureLabelDef[],
): ThoracicStructureLabelDef | null {
  const normalized = normalizeMeshName(meshName)

  for (const structure of structures) {
    if (structure.meshNames?.some((name) => normalizeMeshName(name) === normalized)) {
      return structure
    }
  }

  for (const structure of structures) {
    const keywords = meshKeywordsByLabel[structure.label]
    if (keywords?.some((keyword) => normalized.includes(keyword))) {
      return structure
    }
  }

  return null
}
