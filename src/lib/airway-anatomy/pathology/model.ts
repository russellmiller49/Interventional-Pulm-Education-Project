/** All sizes and animation rates here are authored visual constructs, not clinical grades. */
export const MORPHOLOGIES = [
  {
    id: 'none',
    label: 'Normal airway',
    description: 'Inspect the open lumen before adding an abnormality.',
    scale: [0, 0, 0],
  },
  {
    id: 'obstructing',
    label: 'Obstructing tumor',
    description:
      'Lobulated endobronchial mass with an irregular surface and pale surface patches. Inspect the residual lumen around it.',
    scale: [0.75, 1.2, 1.6],
  },
  {
    id: 'polypoid',
    label: 'Polypoid lesion',
    description:
      'Smooth, rounded lesion with a narrower wall attachment. Rotate and withdraw to inspect its base.',
    scale: [0.55, 0.7, 1.05],
  },
  {
    id: 'mucosal',
    label: 'Irregular mucosal lesion',
    description:
      'Broad, shallow abnormality with a granular, erythematous surface. Compare its contour with the adjacent wall.',
    scale: [0.7, 1.6, 0.28],
  },
] as const
export type MorphologyId = (typeof MORPHOLOGIES)[number]['id']

export const PATHOLOGY_SITES = [
  { id: 'trachea', label: 'Distal trachea', edgeId: 0, distanceMm: 104 },
  { id: 'right-mainstem', label: 'Right mainstem bronchus', edgeId: 1, distanceMm: 15 },
  { id: 'left-mainstem', label: 'Left mainstem bronchus', edgeId: 2, distanceMm: 30 },
  { id: 'intermedius', label: 'Bronchus intermedius', edgeId: 4, distanceMm: 17 },
] as const
export type PathologySiteId = (typeof PATHOLOGY_SITES)[number]['id']
export type BleedingLevel = 'off' | 'oozing' | 'brisk'
export interface PathologySettings {
  morphology: MorphologyId
  site: PathologySiteId
  size: number
  wallAngleDeg: number
  bleeding: BleedingLevel
}
export const DEFAULT_PATHOLOGY: PathologySettings = {
  morphology: 'none',
  site: 'right-mainstem',
  size: 0.8,
  wallAngleDeg: 0,
  bleeding: 'off',
}
export const morphologyFor = (id: MorphologyId) => MORPHOLOGIES.find((m) => m.id === id)!
export const siteFor = (id: PathologySiteId) => PATHOLOGY_SITES.find((s) => s.id === id)!

/** A bounded illustrative film amount. There is deliberately no blood-volume conversion. */
export function bleedingAmount(elapsedSeconds: number, level: BleedingLevel) {
  const time = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0)
  if (level === 'off') return 0
  return level === 'oozing' ? Math.min(0.42, 0.07 + time * 0.012) : Math.min(1, 0.12 + time * 0.05)
}

export function advanceBleedingTime(time: number, dt: number, running: boolean) {
  if (!running || !Number.isFinite(dt) || dt <= 0) return time
  // Hidden tabs and interrupted frames do not produce a sudden jump on return.
  return Math.min(90, time + Math.min(dt, 0.1))
}
