import type { StentExplorerCasePreset } from './types'

const casePresets = [
  {
    id: 'curved-left-mainstem-silicone-failure',
    label: 'Curved left-mainstem silicone failure',
    summary:
      'Persistent lobar compromise follows placement of a straight silicone tube in a curved left mainstem despite an acceptable single end view. Compare curve mechanics, secretion behavior, the tissue interface, and response planning.',
    stationIds: ['curve-buckle', 'mucus-obstruction', 'granulation', 'deploy-rescue'],
    initialStationId: 'curve-buckle',
  },
  {
    id: 'post-treatment-migration',
    label: 'Post-treatment migration',
    summary:
      'Symptoms recur after treatment reduces the obstructing tumor bulk. Compare the device, airway, and treated lesion over time before deciding which spatial relationship changed.',
    stationIds: [
      'migration',
      'metal-architecture',
      'tumor-ingrowth-overgrowth',
      'mucus-obstruction',
      'deploy-rescue',
    ],
    initialStationId: 'migration',
  },
  {
    id: 'uncovered-sems-restenosis',
    label: 'Uncovered-scaffold restenosis',
    summary:
      'New narrowing appears after initial patency. Use construction-aware cutaways to determine the tissue-device relationship while keeping granulation, retained secretions, and other recurrent obstruction in the differential.',
    stationIds: [
      'tumor-ingrowth-overgrowth',
      'metal-architecture',
      'granulation',
      'mucus-obstruction',
      'deploy-rescue',
    ],
    initialStationId: 'tumor-ingrowth-overgrowth',
  },
  {
    id: 'tortuous-airway-fracture',
    label: 'Tortuous-airway fracture',
    summary:
      'Recurrent obstruction develops in a tortuous airway after initially satisfactory deployment. Use layered structural and airway views to localize the abnormality and compare possible contributors.',
    stationIds: [
      'fracture-cover-failure',
      'metal-architecture',
      'cough-motion',
      'migration',
      'deploy-rescue',
    ],
    initialStationId: 'fracture-cover-failure',
  },
  {
    id: 'whole-y-carinal-mismatch',
    label: 'Whole-Y carinal mismatch',
    summary:
      'Lobar compromise persists after whole-Y placement despite a satisfactory tracheal view. Use multiplanar inspection to determine which fit relationship is abnormal.',
    stationIds: ['y-stent', 'mucus-obstruction', 'migration', 'deploy-rescue'],
    initialStationId: 'y-stent',
  },
] as const satisfies readonly StentExplorerCasePreset[]

export type StentExplorerCasePresetId = (typeof casePresets)[number]['id']

// Widen the exported array to the shared interface so consumers do not infer
// the first preset's literal id as the only valid React state value.
export const stentExplorerCasePresets: readonly StentExplorerCasePreset[] = casePresets

export function getStentExplorerCasePreset(id: string) {
  return stentExplorerCasePresets.find((preset) => preset.id === id)
}
