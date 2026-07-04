import type {
  FrameSource,
  ProbePreset,
  ThoracicCaseManifest,
  ThoracicLabelVolumeSpec,
  ThoracicStructureLabelDef,
} from '../types'

import { hasProbeState } from '../engine/frameAtlas'

const frameSourceKinds = new Set([
  'reviewed-atlas',
  'plus-atlas',
  'browser-raymarch',
  'placeholder',
])
const frameQualities = new Set(['reviewed', 'acceptable', 'prototype', 'placeholder'])
const taskKinds = new Set([
  'find-window',
  'classify-pattern',
  'avoid-hazard',
  'identify-structure',
  'measure',
  'free-explore',
])

export interface ManifestValidationResult {
  valid: boolean
  errors: string[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

function validateVolumeSpec(spec: ThoracicLabelVolumeSpec | undefined, errors: string[]) {
  if (!spec) {
    errors.push('primaryLabelVolume is required')
    return
  }
  if (!isNonEmptyString(spec.url)) {
    errors.push('primaryLabelVolume.url is required')
  }
  if (spec.format !== 'uint8-single-label') {
    errors.push('primaryLabelVolume.format must be "uint8-single-label"')
  }
  const geometry = spec.geometry
  if (
    !geometry ||
    !isVec3(geometry.sizeXyz) ||
    !isVec3(geometry.spacingXyzMm) ||
    !isVec3(geometry.originLpsMm)
  ) {
    errors.push('primaryLabelVolume.geometry needs sizeXyz, spacingXyzMm, and originLpsMm')
  } else if (geometry.coordinateSystem !== 'LPS') {
    errors.push('primaryLabelVolume.geometry.coordinateSystem must be "LPS"')
  }
  if (
    !spec.labelCodes ||
    typeof spec.labelCodes !== 'object' ||
    Object.keys(spec.labelCodes).length === 0
  ) {
    errors.push('primaryLabelVolume.labelCodes must map at least one code to a structure label')
  }
}

function validateStructures(structures: ThoracicStructureLabelDef[] | undefined, errors: string[]) {
  if (!Array.isArray(structures) || structures.length === 0) {
    errors.push('structures must be a non-empty array')
    return
  }
  structures.forEach((structure, index) => {
    if (!isNonEmptyString(structure?.label)) {
      errors.push(`structures[${index}].label is required`)
    }
    if (!isNonEmptyString(structure?.displayName)) {
      errors.push(`structures[${index}].displayName is required`)
    }
    if (!isNonEmptyString(structure?.category)) {
      errors.push(`structures[${index}].category is required`)
    }
  })
}

function validateProbePresets(
  presets: ProbePreset[] | undefined,
  defaultPresetId: unknown,
  errors: string[],
) {
  if (!Array.isArray(presets) || presets.length === 0) {
    errors.push('probePresets must be a non-empty array')
    return
  }
  presets.forEach((preset, index) => {
    if (!isNonEmptyString(preset?.id)) {
      errors.push(`probePresets[${index}].id is required`)
    }
    if (!isNonEmptyString(preset?.probeType)) {
      errors.push(`probePresets[${index}].probeType is required`)
    }
    if (!hasProbeState(preset?.defaults)) {
      errors.push(`probePresets[${index}].defaults must be a complete probe state`)
    }
  })
  if (!presets.some((preset) => preset?.id === defaultPresetId)) {
    errors.push('defaultProbePresetId must reference one of probePresets')
  }
}

function validateFrameSources(sources: FrameSource[] | undefined, errors: string[]) {
  if (!Array.isArray(sources) || sources.length === 0) {
    errors.push('frameSources must be a non-empty array')
    return
  }
  sources.forEach((source, index) => {
    if (!isNonEmptyString(source?.id)) {
      errors.push(`frameSources[${index}].id is required`)
    }
    if (!frameSourceKinds.has(source?.kind)) {
      errors.push(`frameSources[${index}].kind is not a known frame source kind`)
    }
    if (!frameQualities.has(source?.status)) {
      errors.push(`frameSources[${index}].status is not a known frame quality`)
    }
    if (typeof source?.priority !== 'number' || !Number.isFinite(source.priority)) {
      errors.push(`frameSources[${index}].priority must be a number`)
    }
    if (source?.kind === 'plus-atlas' && !isNonEmptyString(source?.indexUrl)) {
      errors.push(`frameSources[${index}] (plus-atlas) requires an indexUrl`)
    }
  })
}

export function validateThoracicManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = []
  const manifest = value as ThoracicCaseManifest

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['manifest must be an object'] }
  }
  if (manifest.schemaVersion !== 2) {
    errors.push('schemaVersion must be 2')
  }
  if (!isNonEmptyString(manifest.id)) {
    errors.push('id is required')
  }
  if (!isNonEmptyString(manifest.name)) {
    errors.push('name is required')
  }
  if (!isNonEmptyString(manifest.safetyLabel)) {
    errors.push('safetyLabel is required (educational-use disclaimer text)')
  }
  if (!isNonEmptyString(manifest.anatomicRegion)) {
    errors.push('anatomicRegion is required')
  }
  if (
    !Array.isArray(manifest.supportedApplications) ||
    manifest.supportedApplications.length === 0
  ) {
    errors.push('supportedApplications must be a non-empty array')
  }
  if (!isNonEmptyString(manifest.meshUrl)) {
    errors.push('meshUrl is required')
  }

  validateVolumeSpec(manifest.primaryLabelVolume, errors)
  validateStructures(manifest.structures, errors)
  validateProbePresets(manifest.probePresets, manifest.defaultProbePresetId, errors)
  validateFrameSources(manifest.frameSources, errors)

  const quality = manifest.qualityStatus
  if (!quality || typeof quality !== 'object') {
    errors.push('qualityStatus is required')
  } else if (!['prototype', 'acceptable', 'reviewed'].includes(quality.browserRaymarch as string)) {
    errors.push('qualityStatus.browserRaymarch must be prototype, acceptable, or reviewed')
  }

  if (!Array.isArray(manifest.learningTasks)) {
    errors.push('learningTasks must be an array')
  } else {
    manifest.learningTasks.forEach((task, index) => {
      if (
        !isNonEmptyString(task?.id) ||
        !taskKinds.has(task?.kind) ||
        !isNonEmptyString(task?.prompt)
      ) {
        errors.push(`learningTasks[${index}] needs id, a known kind, and a prompt`)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}

export function assertThoracicManifest(value: unknown): ThoracicCaseManifest {
  const result = validateThoracicManifest(value)
  if (!result.valid) {
    throw new Error(`Invalid thoracic case manifest: ${result.errors.join('; ')}`)
  }
  return value as ThoracicCaseManifest
}
