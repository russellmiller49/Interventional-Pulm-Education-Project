export type TracheostomyPartId =
  | 'whole'
  | 'outer-cannula'
  | 'inner-cannula'
  | 'cuff'
  | 'flange'
  | 'connector'
  | 'obturator'
  | 'pilot-balloon'

export type TracheostomySetupMode = 'in-use' | 'insertion'

export interface TracheostomyPartDefinition {
  id: TracheostomyPartId
  label: string
  shortLabel: string
  description: string
  safety?: string
}

export const tracheostomyModelParts: readonly TracheostomyPartDefinition[] = [
  {
    id: 'whole',
    label: 'Complete segmented tube in transparent anterior airway context',
    shortLabel: 'Whole model',
    description:
      'Rotate the model to connect the external connector and flange with the curved intratracheal shaft, distal cuff, removable inner cannula, and pilot system. Geometry is intentionally manufacturer-neutral and not shown to clinical scale.',
  },
  {
    id: 'outer-cannula',
    label: 'Hollow outer cannula and shaft',
    shortLabel: 'Outer cannula',
    description:
      'The outer cannula maintains the tract and airway. Outer diameter, functional inner diameter, curvature, proximal length, and distal length all affect fit.',
    safety: 'A tube that is too short can sit in pretracheal tissue or abut the posterior wall.',
  },
  {
    id: 'inner-cannula',
    label: 'Removable inner cannula',
    shortLabel: 'Inner cannula',
    description:
      'The inner cannula nests within the outer cannula, visibly reducing the functional lumen. A compatible removable cannula can be exchanged rapidly when secretions obstruct it.',
    safety:
      'In suspected obstruction, remove a removable inner cannula early and reassess patency.',
  },
  {
    id: 'cuff',
    label: 'Low-pressure inflatable cuff sleeve',
    shortLabel: 'Cuff',
    description:
      'The cuff expands radially around the distal cannula to support a positive-pressure seal. Deflation collapses it toward the shaft so upper-airway airflow can be assessed when otherwise appropriate.',
    safety:
      'A cuff does not completely prevent aspiration. A one-way speaking valve must never be used with the cuff inflated.',
  },
  {
    id: 'flange',
    label: 'Contoured flange with strap slots',
    shortLabel: 'Flange',
    description:
      'The flange remains outside the stoma and anchors the tube at the neck. Skin pressure, tie tension, tube angle, and circuit traction all matter.',
  },
  {
    id: 'connector',
    label: 'Hollow 15-mm connector',
    shortLabel: 'Connector',
    description:
      'The proximal connector interfaces with a breathing circuit, bag, heat-moisture exchanger, or selected speaking-valve setup according to the exact tube design.',
  },
  {
    id: 'obturator',
    label: 'Curve-matched insertion obturator',
    shortLabel: 'Obturator',
    description:
      'The obturator follows the outer cannula curve and provides a rounded leading tip for insertion. It is removed immediately after the tube is seated.',
    safety:
      'The insertion setup is not ventilatable: the obturator is present, the inner cannula is absent, and the cuff is deflated.',
  },
  {
    id: 'pilot-balloon',
    label: 'Inflation lumen, pilot line, balloon, and valve',
    shortLabel: 'Pilot system',
    description:
      'The inflation lumen follows the cannula wall to the cuff and continues externally to the pilot balloon and one-way valve.',
    safety:
      'Appearance or fullness may suggest gas is present, but neither appearance nor palpation confirms cuff pressure or an intact seal; use a manometer.',
  },
] as const

export const tracheostomyPartColors: Record<TracheostomyPartId, string> = {
  whole: '#dbeafe',
  'outer-cannula': '#8dd8f8',
  'inner-cannula': '#f8fafc',
  cuff: '#5eead4',
  flange: '#dbeafe',
  connector: '#93c5fd',
  obturator: '#fbbf24',
  'pilot-balloon': '#38bdf8',
}

export function getTracheostomyPart(id: TracheostomyPartId) {
  return tracheostomyModelParts.find((part) => part.id === id) ?? tracheostomyModelParts[0]
}
