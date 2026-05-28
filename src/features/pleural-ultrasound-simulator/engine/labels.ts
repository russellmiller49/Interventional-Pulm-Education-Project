import type { PleuralLabelCode, PleuralTissueLabel } from '../types'

export const labelCodeByName: Record<PleuralTissueLabel, PleuralLabelCode> = {
  background: 0,
  skin: 1,
  subcutaneousTissue: 2,
  intercostalMuscle: 3,
  rib: 4,
  lung: 5,
  atelectaticLung: 6,
  pleuralFluid: 7,
  septation: 8,
  debris: 9,
  diaphragm: 10,
  liver: 11,
  spleen: 12,
}

export const labelNameByCode: Record<PleuralLabelCode, PleuralTissueLabel> = {
  0: 'background',
  1: 'skin',
  2: 'subcutaneousTissue',
  3: 'intercostalMuscle',
  4: 'rib',
  5: 'lung',
  6: 'atelectaticLung',
  7: 'pleuralFluid',
  8: 'septation',
  9: 'debris',
  10: 'diaphragm',
  11: 'liver',
  12: 'spleen',
}

export function isPleuralLabelCode(value: number): value is PleuralLabelCode {
  return Number.isInteger(value) && value >= 0 && value <= 12
}

export function codeToLabel(value: number): PleuralTissueLabel {
  return isPleuralLabelCode(value) ? labelNameByCode[value] : 'background'
}

export function isSolidOrgan(label: PleuralTissueLabel) {
  return label === 'liver' || label === 'spleen'
}
