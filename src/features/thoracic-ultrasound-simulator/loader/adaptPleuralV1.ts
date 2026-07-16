import type {
  CardiacModelSpec,
  FrameAtlas,
  FrameSource,
  LabelBounds,
  ProbePreset,
  SimulationTask,
  StructureCategory,
  ThoracicCaseManifest,
  ThoracicProbeState,
  ThoracicStructureLabel,
  ThoracicStructureLabelDef,
  VolumeGeometry,
} from '../types'

import { matchMeshNamesToStructures } from './meshNaming'

/**
 * Shape of the legacy single-case pleural `case.json` (manifest v1). Declared
 * locally so the shared engine never depends on the pleural feature module.
 */
export interface LegacyPleuralCaseV1 {
  id: string
  name: string
  description: string
  safetyLabel: string
  meshUrl: string
  probeModelUrl?: string
  labelmapUrl: string
  labelmapFormat: 'uint8-single-label'
  labels: Record<string, string>
  labelCounts?: Record<string, number>
  labelBoundsLpsMm?: Partial<Record<string, LabelBounds>>
  source?: Record<string, unknown>
  volume: VolumeGeometry
  probeDefaults: ThoracicProbeState
  frameAtlas?: {
    selectionTolerance?: FrameAtlas['selectionTolerance']
    notes?: string[]
    entries: Array<
      Omit<FrameAtlas['entries'][number], 'groundTruthKey'> & {
        groundTruthKey?: string
        groundTruthPattern?: string
      }
    >
  }
  objectives?: string[]
  groundTruthPattern?: string
  cardiacModel?: CardiacModelSpec
}

export function isLegacyPleuralCase(value: unknown): value is LegacyPleuralCaseV1 {
  const candidate = value as LegacyPleuralCaseV1 & { schemaVersion?: unknown }
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    candidate.schemaVersion === undefined &&
    typeof candidate.labelmapUrl === 'string' &&
    typeof candidate.meshUrl === 'string' &&
    !!candidate.labels &&
    !!candidate.volume &&
    !!candidate.probeDefaults
  )
}

const categoryByLabel: Partial<Record<ThoracicStructureLabel, StructureCategory>> = {
  skin: 'chest-wall',
  subcutaneousTissue: 'chest-wall',
  intercostalMuscle: 'chest-wall',
  muscle: 'chest-wall',
  rib: 'chest-wall',
  spine: 'chest-wall',
  lung: 'lung',
  atelectaticLung: 'lung',
  consolidation: 'lung',
  pleuralFluid: 'fluid',
  septation: 'fluid',
  debris: 'fluid',
  pleuralThickening: 'pleura',
  pleuralNodule: 'pleura',
  diaphragm: 'diaphragm',
  liver: 'solid-organ',
  spleen: 'solid-organ',
  kidney: 'solid-organ',
  pancreas: 'solid-organ',
  gallbladder: 'solid-organ',
  thyroid: 'solid-organ',
  stomach: 'other',
  greatVessel: 'vessel',
  aorta: 'vessel',
  venaCava: 'vessel',
  pulmonaryVessel: 'vessel',
  portalVein: 'vessel',
  heart: 'cardiac',
  myocardium: 'cardiac',
  cardiacBlood: 'cardiac',
  cardiacValve: 'cardiac',
  pericardium: 'cardiac',
  esophagus: 'other',
  airway: 'airway',
  thoracicCavity: 'other',
}

const hazardLabels = new Set<ThoracicStructureLabel>([
  'rib',
  'spine',
  'diaphragm',
  'liver',
  'spleen',
  'kidney',
  'pancreas',
  'heart',
  'greatVessel',
  'aorta',
  'venaCava',
  'pulmonaryVessel',
  'portalVein',
])

/** Big container / clutter structures that ship toggled off in the 3D scene. */
const defaultHiddenLabels = new Set<ThoracicStructureLabel>(['thoracicCavity'])

const colorByLabel: Partial<Record<ThoracicStructureLabel, string>> = {
  skin: '#d4a373',
  subcutaneousTissue: '#e9c46a',
  intercostalMuscle: '#bc4749',
  muscle: '#bc4749',
  rib: '#e5e7eb',
  spine: '#cbd5e1',
  lung: '#94a3b8',
  atelectaticLung: '#64748b',
  consolidation: '#7c8aa0',
  pleuralFluid: '#2563eb',
  septation: '#93c5fd',
  debris: '#a8a29e',
  diaphragm: '#f59e0b',
  liver: '#b45309',
  spleen: '#7c3aed',
  kidney: '#8b5cf6',
  pancreas: '#eab308',
  gallbladder: '#22c55e',
  stomach: '#f472b6',
  thyroid: '#06b6d4',
  heart: '#dc2626',
  myocardium: '#b91c1c',
  cardiacBlood: '#7f1d1d',
  cardiacValve: '#f8fafc',
  greatVessel: '#ef4444',
  aorta: '#dc2626',
  venaCava: '#3b82f6',
  pulmonaryVessel: '#fb7185',
  portalVein: '#8b5cf6',
  esophagus: '#a78bfa',
  airway: '#38bdf8',
  thoracicCavity: '#475569',
}

function humanizeLabel(label: string) {
  const spaced = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function deriveStructures(legacy: LegacyPleuralCaseV1): ThoracicStructureLabelDef[] {
  return Object.entries(legacy.labels)
    .map(([code, name]) => ({ code: Number(code), label: name as ThoracicStructureLabel }))
    .filter((entry) => entry.label !== 'background' && Number.isFinite(entry.code))
    .map(({ code, label }) => ({
      label,
      displayName: humanizeLabel(label),
      category: categoryByLabel[label] ?? 'other',
      code,
      boundsLpsMm: legacy.labelBoundsLpsMm?.[label],
      color: colorByLabel[label],
      defaultVisible: !defaultHiddenLabels.has(label),
      hazard: hazardLabels.has(label) || undefined,
    }))
}

/**
 * Control ranges reproduce the legacy ProbeControls behaviour: sliding ranges
 * hug the fluid/skin bounds so the probe stays near the surface of interest.
 */
function deriveProbePreset(legacy: LegacyPleuralCaseV1): ProbePreset {
  const bounds = legacy.labelBoundsLpsMm?.pleuralFluid ?? legacy.labelBoundsLpsMm?.skin
  const skin = legacy.labelBoundsLpsMm?.skin

  return {
    id: 'curvilinear-default',
    label: 'Curvilinear (case default)',
    probeType: 'curvilinear',
    description: 'Default transducer position exported with the legacy case.',
    defaults: { ...legacy.probeDefaults, approachDeg: legacy.probeDefaults.approachDeg ?? 0 },
    ranges: {
      approachDeg: { min: -180, max: 180, step: 5 },
      lateralMm: {
        min: bounds ? Math.floor(bounds.min[0] - 50) : -160,
        max: bounds ? Math.ceil(bounds.max[0] + 50) : 170,
        step: 2,
      },
      posteriorMm: {
        min: skin ? Math.floor(skin.max[1] - 60) : -110,
        max: skin ? Math.ceil(skin.max[1] + 18) : -15,
        step: 2,
      },
      craniocaudalMm: {
        min: bounds ? Math.floor(bounds.min[2] - 45) : -500,
        max: bounds ? Math.ceil(bounds.max[2] + 45) : -180,
        step: 2,
      },
      tiltDeg: { min: -28, max: 28, step: 1 },
      rotationDeg: { min: -90, max: 90, step: 1 },
      needleAngleDeg: { min: -25, max: 25, step: 1 },
      depthCm: { min: 6, max: 18, step: 0.5 },
      gain: { min: 0.7, max: 2.4, step: 0.05 },
      dynamicRangeDb: { min: 40, max: 80, step: 2 },
      sectorAngleDeg: { min: 40, max: 80, step: 1 },
    },
  }
}

function deriveFrameSources(legacy: LegacyPleuralCaseV1, manifestUrl?: string): FrameSource[] {
  const sources: FrameSource[] = [
    {
      id: 'browser-raymarch',
      kind: 'browser-raymarch',
      status: 'acceptable',
      priority: 0,
      notes:
        'Live browser-generated render: updates with every probe move. Synthetic educational imagery only; display is still gated by qualityStatus.browserRaymarch.',
    },
  ]

  if (legacy.frameAtlas?.entries?.length) {
    sources.push({
      id: 'reviewed-atlas',
      kind: 'reviewed-atlas',
      status: 'reviewed',
      priority: 1,
      notes:
        'Curated teaching frames embedded in the case manifest; fallback when the live render is unavailable.',
    })
  }

  if (manifestUrl) {
    const baseUrl = manifestUrl.replace(/[^/]*$/, '')
    sources.push({
      id: 'plus-atlas',
      kind: 'plus-atlas',
      status: 'reviewed',
      priority: 2,
      indexUrl: `${baseUrl}frames/frames.json`,
      notes: 'Optional pose-indexed offline frame set; absent index is skipped.',
    })
  }

  sources.push({
    id: 'placeholder',
    kind: 'placeholder',
    status: 'placeholder',
    priority: 3,
  })

  return sources
}

function taskKindForObjective(objective: string): SimulationTask['kind'] {
  const lower = objective.toLowerCase()
  if (lower.includes('classif')) return 'classify-pattern'
  if (lower.includes('avoid')) return 'avoid-hazard'
  if (lower.includes('identify')) return 'identify-structure'
  if (lower.includes('find') || lower.includes('locate')) return 'find-window'
  return 'free-explore'
}

function deriveLearningTasks(legacy: LegacyPleuralCaseV1): SimulationTask[] {
  return (legacy.objectives ?? []).map((objective, index) => {
    const kind = taskKindForObjective(objective)
    return {
      id: `objective-${index + 1}`,
      kind,
      prompt: objective,
      hiddenGroundTruth: kind === 'classify-pattern' ? legacy.groundTruthPattern : undefined,
    }
  })
}

function adaptFrameAtlas(legacy: LegacyPleuralCaseV1): FrameAtlas | undefined {
  if (!legacy.frameAtlas?.entries?.length) {
    return undefined
  }

  return {
    selectionTolerance: legacy.frameAtlas.selectionTolerance ?? {},
    notes: legacy.frameAtlas.notes,
    entries: legacy.frameAtlas.entries.map((entry) => ({
      ...entry,
      groundTruthKey: entry.groundTruthKey ?? entry.groundTruthPattern ?? 'unknown',
    })),
  }
}

export interface AdaptPleuralV1Options {
  /** URL the v1 manifest was fetched from; used to derive sibling asset URLs. */
  manifestUrl?: string
  /** Mesh node names from the case GLB, when already known. */
  meshNames?: string[]
}

export function adaptPleuralV1(
  legacy: LegacyPleuralCaseV1,
  options: AdaptPleuralV1Options = {},
): ThoracicCaseManifest {
  const structures = deriveStructures(legacy)

  return {
    schemaVersion: 2,
    id: legacy.id,
    name: legacy.name,
    description: legacy.description,
    safetyLabel: legacy.safetyLabel,
    anatomicRegion: 'pleural',
    supportedApplications: legacy.cardiacModel
      ? ['pleural-effusion', 'cardiac']
      : ['pleural-effusion'],
    meshUrl: legacy.meshUrl,
    probeModelUrl: legacy.probeModelUrl,
    primaryLabelVolume: {
      id: `${legacy.id}-labelmap`,
      url: legacy.labelmapUrl,
      format: legacy.labelmapFormat,
      geometry: legacy.volume,
      labelCodes: legacy.labels as Record<string, ThoracicStructureLabel>,
    },
    labelVolumeUrl: legacy.labelmapUrl,
    structures: options.meshNames
      ? matchMeshNamesToStructures(structures, options.meshNames)
      : structures,
    probePresets: [deriveProbePreset(legacy)],
    defaultProbePresetId: 'curvilinear-default',
    frameSources: deriveFrameSources(legacy, options.manifestUrl),
    frameAtlas: adaptFrameAtlas(legacy),
    qualityStatus: {
      overall: 'mixed',
      browserRaymarch: 'acceptable',
      atlas: legacy.frameAtlas?.entries?.length ? 'reviewed' : 'none',
      notes: [
        'Adapted from a v1 pleural case manifest. The live browser render is displayed (quality: acceptable) so the image follows the probe; every frame is labeled as synthetic educational imagery.',
      ],
    },
    cardiacModel: legacy.cardiacModel,
    learningTasks: deriveLearningTasks(legacy),
    source: legacy.source as ThoracicCaseManifest['source'],
  }
}
