import type { DeviceClassCode } from './product-taxonomy'

/** Field names are deliberately precise: minimum tool channel is never a scope channel. */
export const COMPARISON_FIELDS = {
  insertionDiameter: { reviewedKeys: ['insertion_diameter_mm'], unit: 'mm' },
  distalDiameter: { reviewedKeys: ['distal_end_outer_diameter_mm'], unit: 'mm' },
  outerDiameter: { reviewedKeys: ['outer_diameter_mm'], unit: 'mm' },
  catalogDiameter: { reviewedKeys: ['diameter_mm'], catalogKey: 'diameter_mm', unit: 'mm' },
  workingChannel: { reviewedKeys: ['working_channel_mm'], unit: 'mm' },
  minChannel: {
    reviewedKeys: ['minimum_working_channel_mm'],
    catalogKey: 'min_working_channel_mm',
    unit: 'mm',
  },
  workingLength: {
    reviewedKeys: ['working_length_cm'],
    catalogKey: 'working_length_cm',
    unit: 'cm',
  },
  labeledLength: { reviewedKeys: ['labeled_length_mm'], unit: 'mm' },
  length: { reviewedKeys: ['length_mm'], catalogKey: 'length_mm', unit: 'mm' },
  gauge: { reviewedKeys: ['gauge'], catalogKey: 'gauge', unit: null },
  french: { reviewedKeys: ['french_size'], catalogKey: 'french_size', unit: 'Fr' },
  deliveryDiameter: {
    reviewedKeys: ['delivery_system_od_mm'],
    catalogKey: 'delivery_system_od_mm',
    unit: 'mm',
  },
  material: { reviewedKeys: ['material'], catalogKey: 'material', unit: null },
  tip: { reviewedKeys: ['tip_geometry'], unit: null },
  reuse: { reviewedKeys: ['reuse_status'], catalogKey: 'reuse_status', unit: null },
  sterile: { reviewedKeys: ['sterile_status'], catalogKey: 'sterile_status', unit: null },
  package: { reviewedKeys: ['package_uom'], catalogKey: 'package_uom', unit: null },
  packageQuantity: { reviewedKeys: ['package_quantity'], unit: null },
} as const
export type ComparisonField = keyof typeof COMPARISON_FIELDS

const categoryFields: Partial<Record<DeviceClassCode, ComparisonField[]>> = {
  bronchoscope: [
    'insertionDiameter',
    'distalDiameter',
    'catalogDiameter',
    'workingChannel',
    'workingLength',
    'length',
  ],
  needle: ['gauge', 'outerDiameter', 'catalogDiameter', 'minChannel', 'workingLength', 'tip'],
  airway_stent: ['outerDiameter', 'catalogDiameter', 'length', 'material', 'deliveryDiameter'],
  guidewire: ['catalogDiameter', 'length', 'workingLength', 'material'],
  pleural_drainage: ['french', 'catalogDiameter', 'length', 'material'],
  tracheostomy_tube: ['catalogDiameter', 'length', 'material'],
  cryotherapy: ['outerDiameter', 'catalogDiameter', 'minChannel', 'workingLength', 'labeledLength'],
  forceps_instrument: ['outerDiameter', 'catalogDiameter', 'minChannel', 'workingLength'],
  catheter_sheath: ['catalogDiameter', 'french', 'minChannel', 'workingLength'],
  balloon_dilation: ['catalogDiameter', 'length', 'minChannel', 'workingLength'],
  endoscopic_telescope: ['catalogDiameter', 'workingLength'],
  powered_shaver: ['catalogDiameter', 'length', 'tip'],
}

export function comparisonFieldsForClass(deviceClass: DeviceClassCode): ComparisonField[] {
  return [...(categoryFields[deviceClass] ?? []), 'reuse', 'sterile', 'package', 'packageQuantity']
}

/** Fields every class shares; they follow the class-specific technical fields. */
export const GENERAL_COMPARISON_FIELDS: readonly ComparisonField[] = [
  'reuse',
  'sterile',
  'package',
  'packageQuantity',
]

/**
 * "Show differences only": whether a row's recorded values differ across the compared devices.
 * A value that is not established is its own state — recorded-versus-missing IS a difference
 * worth seeing — while a row where every device is missing carries no information and folds
 * away. This applies to specification rows only. Identity, safety and market status rows are
 * never passed through it: they are always shown.
 */
export function comparisonValuesDiffer(
  values: readonly { value: string | number | boolean | null; unit: string | null }[],
): boolean {
  const states = new Set(
    values.map((entry) =>
      entry.value === null
        ? 'missing'
        : `${String(entry.value).trim().toLowerCase()}|${entry.unit ?? ''}`,
    ),
  )
  return states.size > 1
}
