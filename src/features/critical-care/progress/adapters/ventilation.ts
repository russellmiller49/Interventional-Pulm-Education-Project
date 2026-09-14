import type { CriticalCareActivityDefinition } from '@/features/learning-module/activity'
import {
  LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY,
  MECHANICAL_VENTILATION_PROGRESS_VERSION,
  migrateLegacyProgress,
  parseLegacyProgress,
  parseProgress,
  type MechanicalVentilationProgressV2,
} from '@/features/mechanical-ventilation/engine/progress'

import type {
  CriticalCareLegacyProgressResult,
  CriticalCareProgressSourceReport,
  CriticalCareReadableStorage,
} from '../types'
import {
  isRecord,
  legacyAdapterResult,
  parseStoredJson,
  readStoredValue,
  sourceReport,
  versionLabel,
} from '../utils'

const MODULE_ID = 'mechanical-ventilation'

interface ParsedVentilationSource {
  readonly report: CriticalCareProgressSourceReport
  readonly progress?: MechanicalVentilationProgressV2
}

function parseCurrentSource(storage: CriticalCareReadableStorage | null): ParsedVentilationSource {
  const read = readStoredValue(storage, MODULE_ID, MECHANICAL_VENTILATION_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== MECHANICAL_VENTILATION_PROGRESS_VERSION) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const progress = parseProgress(read.raw)
  return progress
    ? { report: sourceReport(read, 'valid', { detectedVersion }), progress }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

function parseLegacySource(storage: CriticalCareReadableStorage | null): ParsedVentilationSource {
  const read = readStoredValue(storage, MODULE_ID, LEGACY_HAMILTON_C6_PROGRESS_STORAGE_KEY)
  if (read.report.status !== 'valid' || read.raw === null) return { report: read.report }
  const json = parseStoredJson(read.raw)
  if (!json.ok) return { report: sourceReport(read, 'corrupt', { issue: json.issue }) }
  if (!isRecord(json.value)) {
    return { report: sourceReport(read, 'corrupt', { issue: 'invalid-shape' }) }
  }
  const detectedVersion = versionLabel(json.value.version)
  if (json.value.version !== 1) {
    return {
      report: sourceReport(read, detectedVersion ? 'incompatible' : 'corrupt', {
        issue: detectedVersion ? 'unsupported-version' : 'invalid-shape',
        ...(detectedVersion ? { detectedVersion } : {}),
      }),
    }
  }
  const legacy = parseLegacyProgress(read.raw)
  return legacy
    ? {
        report: sourceReport(read, 'valid', { detectedVersion }),
        progress: migrateLegacyProgress(legacy),
      }
    : {
        report: sourceReport(read, 'corrupt', {
          issue: 'invalid-shape',
          ...(detectedVersion ? { detectedVersion } : {}),
        }),
      }
}

/** Historical sources are inspected read-only, never projected into current learning claims. */
export function readVentilationLegacyProgress(
  storage: CriticalCareReadableStorage | null,
  _activities: readonly CriticalCareActivityDefinition[],
): CriticalCareLegacyProgressResult {
  void _activities // Keep the established read-adapter signature without consuming graded catalog data.
  return legacyAdapterResult(
    MODULE_ID,
    [parseCurrentSource(storage).report, parseLegacySource(storage).report],
    [],
  )
}
