import type { DeviceClassCode } from './product-taxonomy'

/**
 * Category-aware presentation for the Device Atlas: which recorded specifications lead a
 * result for a given device class, and which numeric filters are offered for it.
 *
 * This is a mapping layer, not a data model. Every field reads a column the governed catalog
 * already records; nothing here derives, converts, or infers a value. Logic keys on stable
 * taxonomy class codes — never on English labels — and a class without an entry gets the
 * generic fallback, so an unconfigured class still renders honestly.
 *
 * Two boundaries are deliberate:
 *  - A numeric filter match is a statement about a RECORDED NUMBER ("recorded minimum working
 *    channel ≤ 2.0 mm"). It is never worded, here or in the UI, as clinical compatibility.
 *  - For bronchoscopes the catalog's `min_working_channel_mm` column holds the scope's own
 *    channel, not a tool requirement (see the comparison field notes). It is therefore NOT a
 *    bronchoscope summary or filter field; the verbatim size text carries that detail.
 */

export type AtlasSpecFieldKey =
  | 'diameter'
  | 'length'
  | 'french'
  | 'gauge'
  | 'workingLength'
  | 'minWorkingChannel'
  | 'deliveryOd'
  | 'material'
  | 'coverage'
  | 'reuse'

/** The recorded columns a spec field may read. Structural, so list items and rows both fit. */
export interface AtlasSpecSource {
  diameterMm: number | null
  lengthMm: number | null
  frenchSize: number | null
  /** Typed numeric upstream, but reviewed rows also carry strings such as "22G". */
  gauge: number | string | null
  workingLengthCm: number | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  material: string | null
  coverage: string | null
  reuseStatus?: string | null
}

interface AtlasSpecFieldDefinition {
  /** Message key under `deviceIntelligence.devices.specs`. */
  labelKey: AtlasSpecFieldKey
  unit: 'mm' | 'cm' | 'Fr' | 'G' | null
  read: (source: AtlasSpecSource) => number | string | null
}

export const ATLAS_SPEC_FIELDS: Record<AtlasSpecFieldKey, AtlasSpecFieldDefinition> = {
  diameter: { labelKey: 'diameter', unit: 'mm', read: (source) => source.diameterMm },
  length: { labelKey: 'length', unit: 'mm', read: (source) => source.lengthMm },
  french: { labelKey: 'french', unit: 'Fr', read: (source) => source.frenchSize },
  gauge: { labelKey: 'gauge', unit: 'G', read: (source) => source.gauge },
  workingLength: {
    labelKey: 'workingLength',
    unit: 'cm',
    read: (source) => source.workingLengthCm,
  },
  minWorkingChannel: {
    labelKey: 'minWorkingChannel',
    unit: 'mm',
    read: (source) => source.minWorkingChannelMm,
  },
  deliveryOd: { labelKey: 'deliveryOd', unit: 'mm', read: (source) => source.deliverySystemOdMm },
  material: { labelKey: 'material', unit: null, read: (source) => source.material },
  coverage: { labelKey: 'coverage', unit: null, read: (source) => source.coverage },
  reuse: { labelKey: 'reuse', unit: null, read: (source) => source.reuseStatus ?? null },
}

/** Numeric filters the index form can offer; each maps onto existing URL parameters. */
export type AtlasSpecFilterKey =
  | 'diameter'
  | 'length'
  | 'french'
  | 'workingLength'
  | 'channelMax'
  | 'gauge'

export type AtlasSpecFilterDefinition =
  | {
      kind: 'range'
      minParam: 'diameterMin' | 'lengthMin' | 'frenchMin' | 'workingLengthMin'
      maxParam: 'diameterMax' | 'lengthMax' | 'frenchMax' | 'workingLengthMax'
      unit: 'mm' | 'cm' | 'Fr'
      step: string
    }
  | { kind: 'max'; param: 'channelMax'; unit: 'mm'; step: string }
  | { kind: 'exact'; param: 'gauge'; unit: 'G'; step: string }

export const ATLAS_SPEC_FILTERS: Record<AtlasSpecFilterKey, AtlasSpecFilterDefinition> = {
  diameter: {
    kind: 'range',
    minParam: 'diameterMin',
    maxParam: 'diameterMax',
    unit: 'mm',
    step: '0.1',
  },
  length: { kind: 'range', minParam: 'lengthMin', maxParam: 'lengthMax', unit: 'mm', step: '1' },
  french: { kind: 'range', minParam: 'frenchMin', maxParam: 'frenchMax', unit: 'Fr', step: '1' },
  workingLength: {
    kind: 'range',
    minParam: 'workingLengthMin',
    maxParam: 'workingLengthMax',
    unit: 'cm',
    step: '1',
  },
  channelMax: { kind: 'max', param: 'channelMax', unit: 'mm', step: '0.1' },
  gauge: { kind: 'exact', param: 'gauge', unit: 'G', step: '1' },
}

export interface DeviceDisplayConfig {
  /** Specifications that lead a result card or model row, most useful first. */
  summaryFields: readonly AtlasSpecFieldKey[]
  /** Numeric filters offered for the class. */
  filterFields: readonly AtlasSpecFilterKey[]
}

/**
 * First-pass coverage: the classes where the governed catalog records enough of these
 * columns to be useful (measured against the cohort, not assumed). Everything else falls
 * back to `GENERIC_DEVICE_DISPLAY`.
 */
export const DEVICE_DISPLAY_CONFIG: Partial<Record<DeviceClassCode, DeviceDisplayConfig>> = {
  bronchoscope: {
    summaryFields: ['diameter', 'workingLength', 'reuse'],
    filterFields: ['diameter', 'workingLength'],
  },
  needle: {
    summaryFields: ['gauge', 'workingLength', 'minWorkingChannel'],
    filterFields: ['gauge', 'channelMax', 'workingLength'],
  },
  airway_stent: {
    summaryFields: ['diameter', 'length', 'material', 'coverage', 'deliveryOd'],
    filterFields: ['diameter', 'length'],
  },
  cryotherapy: {
    summaryFields: ['diameter', 'workingLength', 'minWorkingChannel'],
    filterFields: ['diameter', 'channelMax', 'workingLength'],
  },
  pleural_drainage: {
    summaryFields: ['french', 'workingLength', 'material'],
    filterFields: ['french'],
  },
  forceps_instrument: {
    summaryFields: ['diameter', 'workingLength', 'minWorkingChannel'],
    filterFields: ['diameter', 'channelMax', 'workingLength'],
  },
  balloon_dilation: {
    summaryFields: ['diameter', 'length', 'workingLength'],
    filterFields: ['diameter', 'length'],
  },
}

/** Fallback: whatever is recorded, in a fixed priority order, and the long-standing filters. */
export const GENERIC_DEVICE_DISPLAY: DeviceDisplayConfig = {
  summaryFields: [
    'diameter',
    'length',
    'french',
    'gauge',
    'workingLength',
    'minWorkingChannel',
    'deliveryOd',
    'material',
  ],
  filterFields: ['diameter', 'length', 'channelMax'],
}

export function deviceDisplayConfigFor(
  deviceClass: string | null | undefined,
): DeviceDisplayConfig {
  if (!deviceClass) return GENERIC_DEVICE_DISPLAY
  return DEVICE_DISPLAY_CONFIG[deviceClass as DeviceClassCode] ?? GENERIC_DEVICE_DISPLAY
}

const isRecorded = (value: number | string | null | undefined): value is number | string =>
  value !== null && value !== undefined && String(value).trim() !== ''

/** One recorded value with its unit. Strings ("22G", "Nitinol") pass through verbatim. */
function formatRecordedValue(key: AtlasSpecFieldKey, value: number | string): string {
  if (typeof value === 'string') return value.trim()
  const unit = ATLAS_SPEC_FIELDS[key].unit
  if (unit === 'G') return `${value}G`
  return unit ? `${value} ${unit}` : String(value)
}

/** A recorded value with its unit, or null when the field is not recorded. Never a guess. */
export function formatSpecValue(key: AtlasSpecFieldKey, source: AtlasSpecSource): string | null {
  const value = ATLAS_SPEC_FIELDS[key].read(source)
  return isRecorded(value) ? formatRecordedValue(key, value) : null
}

export interface SpecSummaryEntry {
  key: AtlasSpecFieldKey
  value: string
}

/** The recorded summary specifications for one model, capped so a row stays scannable. */
export function modelSpecSummary(
  deviceClass: string | null | undefined,
  source: AtlasSpecSource,
  limit = 3,
): SpecSummaryEntry[] {
  const entries: SpecSummaryEntry[] = []
  for (const key of deviceDisplayConfigFor(deviceClass).summaryFields) {
    const value = formatSpecValue(key, source)
    if (value !== null) entries.push({ key, value })
    if (entries.length >= limit) break
  }
  return entries
}

export interface FamilySpecSummaryEntry extends SpecSummaryEntry {
  /** How many of the listed models record this field — the rest are simply not recorded. */
  recordedCount: number
  modelCount: number
}

const MAX_LISTED_VALUES = 4

/**
 * Summarize a field across the models of one product line: the distinct recorded values, or a
 * min–max range once a numeric field has more values than fit on a line. The summary covers
 * only the models passed in (the ones that matched the filters) and reports how many of them
 * record the field, so a partial column never reads as a family-wide fact.
 */
export function familySpecSummary(
  deviceClass: string | null | undefined,
  sources: readonly AtlasSpecSource[],
  limit = 4,
): FamilySpecSummaryEntry[] {
  const entries: FamilySpecSummaryEntry[] = []
  for (const key of deviceDisplayConfigFor(deviceClass).summaryFields) {
    const definition = ATLAS_SPEC_FIELDS[key]
    const recorded = sources.map((source) => definition.read(source)).filter(isRecorded)
    if (recorded.length === 0) continue
    const numeric = recorded.every((value) => typeof value === 'number')
    const ordered = numeric
      ? [...(recorded as number[])].sort((left, right) => left - right)
      : recorded
    const formatted = [...new Set(ordered.map((value) => formatRecordedValue(key, value)))]
    // Mixed numeric/string columns (gauge: 21 beside "22G") still read in size order.
    const leading = formatted.map((value) => Number.parseFloat(value))
    const distinct = leading.every((value) => Number.isFinite(value))
      ? formatted
          .map((value, index) => ({ value, order: leading[index] }))
          .sort((left, right) => left.order - right.order)
          .map((entry) => entry.value)
      : formatted
    let text: string
    if (numeric && distinct.length > MAX_LISTED_VALUES) {
      const numbers = ordered as number[]
      text = `${numbers[0]}–${formatRecordedValue(key, numbers[numbers.length - 1])}`
    } else if (distinct.length > MAX_LISTED_VALUES) {
      text = `${distinct.slice(0, MAX_LISTED_VALUES).join(', ')}…`
    } else {
      text = distinct.join(', ')
    }
    entries.push({ key, value: text, recordedCount: recorded.length, modelCount: sources.length })
    if (entries.length >= limit) break
  }
  return entries
}

/**
 * Device classes offered as visible shortcuts in "Browse by device type". A navigation
 * convenience only: the list is the everyday bronchoscopy/pleural device types, shown in the
 * controlled vocabulary's own declaration order. It is NOT a ranking, and every other class
 * stays one click away under "All device types".
 */
export const FEATURED_DEVICE_CLASSES: readonly DeviceClassCode[] = [
  'bronchoscope',
  'guidewire',
  'airway_stent',
  'valve_occluder',
  'balloon_dilation',
  'needle',
  'forceps_instrument',
  'pleural_drainage',
  'electrosurgical',
  'cryotherapy',
]
