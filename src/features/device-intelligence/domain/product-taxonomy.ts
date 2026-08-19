/**
 * The Phase D2C normalized Device Atlas taxonomy: a controlled vocabulary of physical
 * device classes and subtypes, replacing canonical `primary_category` as the atlas
 * browsing facet (owner decision, 2026-08-18).
 *
 * WHY: the canonical categories mix incompatible axes — physical device class ("Airway
 * stent", "Guidewire"), procedure domain ("Rigid bronchoscopy", "Pleural procedures"),
 * workflow ("Airway stenting", "Reprocessing"), and platform grouping ("Endoscopy
 * platform"). In production that put the MAXXwire guidewires and the AEROSIZER sizing
 * device together under "Airway stenting", and split physically identical bronchoscopes
 * across "Flexible bronchoscopy", "Bronchoscopy platform", "EBUS platform", and
 * "Peripheral navigation" by manufacturer and use.
 *
 * The normalized primary facet answers exactly one question — WHAT KIND OF DEVICE IS
 * THIS — because clinical use is already represented by the governed clinical-role and
 * procedure facets. A device class is therefore never a procedure, a clinical
 * application, a manufacturer, or a brand family.
 *
 * Codes are stable internal identifiers; they never render. Display labels live in
 * `messages/{en,es,zh-CN}.json` under `deviceIntelligence.taxonomy.*`, one label per
 * code per locale (enforced by tests). Canonical `primary_category` / `subcategory`
 * remain untouched governed catalog data and stay available as provenance.
 *
 * Taxonomy metadata is DISCOVERY grouping only. It must never gate atlas visibility,
 * search reachability, role/procedure membership, market/safety display, or
 * recommendation state, and shared class membership is never a clinical-equivalence,
 * substitution, compatibility, or formulary claim.
 */

/** Top-level physical device classes (owner target: ~15–35, not hundreds). */
export const DEVICE_CLASS_CODES = [
  'bronchoscope',
  'endoscopic_telescope',
  'guidewire',
  'airway_stent',
  'valve_occluder',
  'implant_delivery',
  'balloon_dilation',
  'sizing_measuring',
  'needle',
  'forceps_instrument',
  'cytology_brush',
  'catheter_sheath',
  'suction_irrigation',
  'retrieval_device',
  'trocar_access',
  'tracheostomy_tube',
  'pleural_drainage',
  'pleurodesis_agent',
  'electrosurgical',
  'cryotherapy',
  'laser_system',
  'powered_shaver',
  'navigation_system',
  'ultrasound_device',
  'console_capital',
  'reprocessing',
  'specimen_collection',
  'accessory',
  'other_needs_review',
] as const

export type DeviceClassCode = (typeof DEVICE_CLASS_CODES)[number]

/**
 * Normalized physical subtypes, each owned by exactly one class. The map IS the
 * ownership relation: a subtype code appearing under two classes is impossible by
 * construction, and `deviceClassOfSubtype` never disagrees with a row's class.
 */
export const DEVICE_SUBTYPE_CLASS: Record<string, DeviceClassCode> = {
  // Bronchoscopes — one physical class regardless of manufacturer or workflow.
  reusable_video_bronchoscope: 'bronchoscope',
  therapeutic_video_bronchoscope: 'bronchoscope',
  ultrathin_video_bronchoscope: 'bronchoscope',
  bronchofiberscope: 'bronchoscope',
  ebus_bronchoscope: 'bronchoscope',
  single_use_video_bronchoscope: 'bronchoscope',
  single_use_bronchoscope_set: 'bronchoscope',
  robotic_bronchoscope: 'bronchoscope',
  rigid_bronchoscope: 'bronchoscope',
  rigid_tracheoscope: 'bronchoscope',
  // Rod-lens optics shared by rigid bronchoscopy and thoracoscopy.
  rigid_telescope: 'endoscopic_telescope',
  thoracoscopy_telescope: 'endoscopic_telescope',
  mini_thoracoscope: 'endoscopic_telescope',
  // Guidewires.
  super_stiff_guidewire: 'guidewire',
  pulmonary_guidewire: 'guidewire',
  // Airway stents.
  sems_fully_covered: 'airway_stent',
  sems_partially_covered: 'airway_stent',
  sems_uncovered: 'airway_stent',
  sems_y_shaped: 'airway_stent',
  sems_j_shaped: 'airway_stent',
  sems_straight: 'airway_stent',
  silicone_straight_stent: 'airway_stent',
  silicone_y_stent: 'airway_stent',
  silicone_hourglass_stent: 'airway_stent',
  // Valves, blockers, occluders.
  endobronchial_valve: 'valve_occluder',
  valve_procedure_kit: 'valve_occluder',
  endobronchial_spigot: 'valve_occluder',
  endobronchial_blocker: 'valve_occluder',
  // Implant delivery.
  stent_applicator: 'implant_delivery',
  valve_delivery_catheter: 'implant_delivery',
  // Balloon dilation and inflation.
  airway_balloon_dilator: 'balloon_dilation',
  balloon_inflation_device: 'balloon_dilation',
  inflation_accessory: 'balloon_dilation',
  // Sizing and measuring.
  airway_sizing_device: 'sizing_measuring',
  valve_sizing_kit: 'sizing_measuring',
  sizing_occlusion_balloon: 'sizing_measuring',
  // Needles.
  ebus_tbna_needle: 'needle',
  ebus_fnb_needle: 'needle',
  conventional_tbna_needle: 'needle',
  peripheral_tbna_needle: 'needle',
  robotic_biopsy_needle: 'needle',
  core_biopsy_device: 'needle',
  rigid_biopsy_needle: 'needle',
  pleural_biopsy_needle: 'needle',
  access_needle: 'needle',
  // Forceps and hand instruments.
  flexible_biopsy_forceps: 'forceps_instrument',
  ebus_miniforceps: 'forceps_instrument',
  rigid_forceps: 'forceps_instrument',
  optical_rigid_forceps: 'forceps_instrument',
  articulated_rigid_instrument: 'forceps_instrument',
  modular_forceps_component: 'forceps_instrument',
  stent_handling_forceps: 'forceps_instrument',
  pleural_biopsy_forceps: 'forceps_instrument',
  thoracoscopy_hand_instrument: 'forceps_instrument',
  // Cytology brushes.
  pulmonary_cytology_brush: 'cytology_brush',
  navigation_cytology_brush: 'cytology_brush',
  // Catheters and sheaths.
  guide_sheath_kit: 'catheter_sheath',
  robotic_navigation_catheter: 'catheter_sheath',
  collateral_ventilation_catheter: 'catheter_sheath',
  guiding_catheter: 'catheter_sheath',
  // Suction and irrigation.
  rigid_suction_catheter: 'suction_irrigation',
  flexible_suction_catheter: 'suction_irrigation',
  suction_accessory: 'suction_irrigation',
  suction_pump: 'suction_irrigation',
  irrigation_pump: 'suction_irrigation',
  // Retrieval.
  retrieval_basket: 'retrieval_device',
  foreign_body_grasping_forceps: 'retrieval_device',
  // Access.
  thoracoscopy_trocar: 'trocar_access',
  // Tracheostomy tubes.
  cuffed_tracheostomy_tube: 'tracheostomy_tube',
  cuffless_tracheostomy_tube: 'tracheostomy_tube',
  subglottic_suction_tracheostomy_tube: 'tracheostomy_tube',
  // Pleural drainage.
  chest_drainage_unit: 'pleural_drainage',
  pleural_drainage_accessory: 'pleural_drainage',
  thoracic_catheter: 'pleural_drainage',
  ipc_insertion_kit: 'pleural_drainage',
  ipc_drainage_supply: 'pleural_drainage',
  ipc_accessory: 'pleural_drainage',
  pneumothorax_aspiration_set: 'pleural_drainage',
  small_bore_drainage_kit: 'pleural_drainage',
  thoracentesis_set: 'pleural_drainage',
  percutaneous_drainage_kit: 'pleural_drainage',
  thoracic_drainage_cannula: 'pleural_drainage',
  // Pleurodesis.
  talc_vial: 'pleurodesis_agent',
  talc_poudrage_kit: 'pleurodesis_agent',
  talc_applicator: 'pleurodesis_agent',
  // Electrosurgery / APC.
  electrosurgical_generator: 'electrosurgical',
  apc_unit: 'electrosurgical',
  rigid_apc_applicator: 'electrosurgical',
  flexible_apc_probe: 'electrosurgical',
  apc_accessory: 'electrosurgical',
  electrosurgical_cable: 'electrosurgical',
  return_electrode_cable: 'electrosurgical',
  electrosurgical_adapter: 'electrosurgical',
  electrosurgical_footswitch: 'electrosurgical',
  gas_supply_accessory: 'electrosurgical',
  bipolar_instrument_component: 'electrosurgical',
  // Cryotherapy.
  flexible_cryoprobe: 'cryotherapy',
  cryotherapy_accessory: 'cryotherapy',
  // Laser.
  laser_console: 'laser_system',
  laser_fiber: 'laser_system',
  laser_accessory: 'laser_system',
  // Powered shaver.
  shaver_console: 'powered_shaver',
  shaver_handpiece: 'powered_shaver',
  shaver_instrument: 'powered_shaver',
  shaver_accessory: 'powered_shaver',
  // Navigation and robotics.
  robotic_navigation_platform: 'navigation_system',
  navigation_platform_hardware: 'navigation_system',
  navigation_accessory: 'navigation_system',
  navigation_procedure_kit: 'navigation_system',
  robotic_vision_probe: 'navigation_system',
  // Ultrasound.
  pocus_system: 'ultrasound_device',
  ultrasound_transducer: 'ultrasound_device',
  radial_ebus_probe: 'ultrasound_device',
  ultrasound_probe_drive_unit: 'ultrasound_device',
  ultrasound_processor: 'ultrasound_device',
  ultrasound_accessory: 'ultrasound_device',
  // Consoles and capital equipment.
  video_processor: 'console_capital',
  light_source: 'console_capital',
  endoscopy_monitor: 'console_capital',
  endoscopy_workstation: 'console_capital',
  co2_insufflator: 'console_capital',
  collateral_ventilation_console: 'console_capital',
  // Reprocessing.
  endoscope_reprocessor: 'reprocessing',
  reprocessor_accessory: 'reprocessing',
  cleaning_brush: 'reprocessing',
  precleaning_kit: 'reprocessing',
  cleaning_adapter: 'reprocessing',
  // Specimen collection.
  specimen_container: 'specimen_collection',
  specimen_sampler: 'specimen_collection',
  bal_kit: 'specimen_collection',
  // Accessories.
  bite_block: 'accessory',
  endoscope_seal_valve: 'accessory',
  rigid_scope_component: 'accessory',
  rigid_bronchoscopy_accessory: 'accessory',
  ebus_scope_accessory: 'accessory',
  platform_accessory: 'accessory',
  vacuum_syringe: 'accessory',
  // Explicit fallback: genuinely unclassifiable, still fully visible.
  unclassified_device: 'other_needs_review',
} as const

export type DeviceSubtypeCode = keyof typeof DEVICE_SUBTYPE_CLASS

export const DEVICE_SUBTYPE_CODES = Object.keys(DEVICE_SUBTYPE_CLASS).sort() as DeviceSubtypeCode[]

/**
 * Review metadata ONLY. Confidence and needs-review never affect visibility,
 * searchability, role or procedure membership, market/safety display, or any
 * recommendation gate — an uncertain classification stays fully visible.
 */
export const TAXONOMY_CONFIDENCES = ['high', 'moderate', 'needs_review'] as const
export type TaxonomyConfidence = (typeof TAXONOMY_CONFIDENCES)[number]

/**
 * How a row was classified, as a controlled code (never prose in runtime output):
 *
 * - `pair_rule` — the reviewed (primary_category, subcategory) mapping table.
 * - `name_rule` — a reviewed deterministic product-name pattern scoped to one
 *   (primary_category, subcategory) pair, for pairs that mix physical types.
 * - `product_override` — a reviewed per-product assignment.
 * - `unmatched_fallback` — no reviewed rule matched; the product receives the explicit
 *   `other_needs_review` fallback and stays visible. Zero products use this today
 *   (asserted in tests); it exists so a future catalog addition degrades honestly
 *   instead of failing the build or hiding the product.
 */
export const CLASSIFICATION_BASES = [
  'pair_rule',
  'name_rule',
  'product_override',
  'unmatched_fallback',
] as const
export type ClassificationBasis = (typeof CLASSIFICATION_BASES)[number]

export const FALLBACK_DEVICE_CLASS: DeviceClassCode = 'other_needs_review'
export const FALLBACK_DEVICE_SUBTYPE: DeviceSubtypeCode = 'unclassified_device'

export function isDeviceClassCode(value: string): value is DeviceClassCode {
  return (DEVICE_CLASS_CODES as readonly string[]).includes(value)
}

export function isDeviceSubtypeCode(value: string): value is DeviceSubtypeCode {
  return Object.prototype.hasOwnProperty.call(DEVICE_SUBTYPE_CLASS, value)
}

/** The owning class for a subtype. Total over the controlled vocabulary. */
export function deviceClassOfSubtype(subtype: DeviceSubtypeCode): DeviceClassCode {
  return DEVICE_SUBTYPE_CLASS[subtype]
}

/** Message key for a class label, `deviceIntelligence`-relative. */
export function deviceClassLabelKey(code: DeviceClassCode): string {
  return `taxonomy.classes.${code}`
}

/** Message key for a subtype label, `deviceIntelligence`-relative. */
export function deviceSubtypeLabelKey(code: DeviceSubtypeCode): string {
  return `taxonomy.subtypes.${code}`
}

/**
 * The one taxonomy row shape that reaches runtime: controlled codes only. No free-text
 * rationale, no source-category copy, no rule identifiers — those live in the reviewed
 * rules file and the D2C review artifacts, never in the client-reachable overlay.
 */
export interface ProductTaxonomyView {
  deviceClassCode: DeviceClassCode
  deviceSubtypeCode: DeviceSubtypeCode
  taxonomyConfidence: TaxonomyConfidence
  needsReview: boolean
}

/**
 * The honest total fallback: a cohort product missing from the overlay (impossible
 * today, asserted by tests) is still classified and still shown — taxonomy state must
 * never become an atlas-visibility gate.
 */
export const UNCLASSIFIED_PRODUCT_TAXONOMY: ProductTaxonomyView = {
  deviceClassCode: FALLBACK_DEVICE_CLASS,
  deviceSubtypeCode: FALLBACK_DEVICE_SUBTYPE,
  taxonomyConfidence: 'needs_review',
  needsReview: true,
}
