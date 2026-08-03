import { normalizeCatalogKey, type GudidIndexEntry } from './build-gudid-index'
import { stableId } from './catalog-utils'
import {
  buildProductRecord,
  GUDID_RELEASE_DATE,
  GUDID_SOURCE_ID,
  type AdditionRecord,
} from './catalog-addition-records'

/**
 * Catalog additions for taxonomy v2: the energy, collateral-ventilation, thoracoscopy-energy,
 * imaging, laser, photodynamic, and breakthrough-designated equipment the workbook has no rows
 * for.
 *
 * Three evidence classes live here, and they are handled differently on purpose:
 *
 *  1. **GUDID-backed** (ERBE VIO 3 / APC 3 / footswitches, Pulmonx Chartis). Identity and
 *     distribution status come from the FDA UDI record; dimensions come from the supplied
 *     manufacturer document. These are visible and verified, like every other addition.
 *
 *  2. **Manufacturer-documented but not UDI-listed** (the Richard Wolf mini-thoracoscopy
 *     bundles and electrodes, the Karl Storz dissection electrode, the three mobile C-arms,
 *     LungVision, the Galvanize Aliya line). A printed order number on a manufacturer sell
 *     sheet is real evidence of identity, and none of it is evidence of current US
 *     distribution. They enter `candidate` grade and `hidden` visibility with an
 *     `availability_note` saying exactly which record is missing — discoverable in the
 *     verification workbench, never selectable on a card until someone attaches a UDI record.
 *     Where a device clears *both* bars — a manufacturer document for identity and a UDI
 *     record reporting commercial distribution — it is promoted to visible and verified. Most
 *     of the airway laser cohort clears both.
 *
 *  3. **Tier-4 secondary research only** (photodynamic therapy and the
 *     breakthrough-designated cohort). Same hidden/candidate handling, plus a source whose own
 *     use policy says nothing may be promoted from it alone. The breakthrough cohort is walled
 *     off from card building entirely by its reviewed `slottingScope: 'not_applicable'`.
 *
 * Nothing here invents a catalog number. Several of these products genuinely have none in any
 * supplied document — a C-arm brochure prints no orderable identifier at all — and an empty
 * `catalog_number` is the honest record of that.
 */

// --- source ids ----------------------------------------------------------------------------
export const ERBE_VIO3_SOURCE_ID = 'SRC053'
export const CHARTIS_IFU_SOURCE_ID = 'SRC054'
export const RICHARD_WOLF_SOURCE_ID = 'SRC055'
export const KARL_STORZ_SOURCE_ID = 'SRC056'
export const CIOS_SPIN_SOURCE_ID = 'SRC057'
export const OEC_3D_SOURCE_ID = 'SRC058'
export const ZIEHM_SOURCE_ID = 'SRC059'
export const LUNGVISION_SOURCE_ID = 'SRC060'
export const ALIYA_SOURCE_ID = 'SRC061'
export const OMNIGUIDE_INTELLIGUIDE_SOURCE_ID = 'SRC062'
export const OMNIGUIDE_VELOCITY_SOURCE_ID = 'SRC065'
export const OMNIGUIDE_510K_SOURCE_ID = 'SRC066'
export const BIOLITEC_SOURCE_ID = 'SRC067'
export const LISA_SOURCE_ID = 'SRC068'
export const QUANTA_SOURCE_ID = 'SRC069'
export const FORTEC_SOURCE_ID = 'SRC070'
export const LASERSCOPE_510K_SOURCE_ID = 'SRC071'
export const PDT_REPORT_SOURCE_ID = 'SRC063'
export const BREAKTHROUGH_REPORT_SOURCE_ID = 'SRC064'

const RESEARCH_AS_OF = '2026-07-30'

const NOT_UDI_LISTED_NOTE =
  'No FDA UDI record was located for this order number in the AccessGUDID release, so US commercial-distribution status is unestablished. Confirm identity, current availability, and the full IFU with the manufacturer before use.'

const TIER_4_NOTE =
  'Recorded from a secondary research report only. No manufacturer document or FDA record is on file for it here, so it is hidden from selection until one is attached.'

// --- GUDID-backed capital equipment and catheters -------------------------------------------

interface GudidDeviceDefinition {
  /** Matched against the GUDID index on catalog number, then version/model number. */
  lookup: string
  catalogNumber?: string
  productName: string
  brandFamily: string
  roleCode: string
  primaryCategory: string
  subcategory: string
  productKind: string
  summary: string
  sourceId: string
  sourceLocation: string
  claimType: string
  sizeDisplay?: string | null
  workingLengthCm?: number | null
  diameterMm?: number | null
  minWorkingChannelMm?: number | null
  spec?: Record<string, unknown>
  notes?: string | null
}

/**
 * ERBE VIO 3 and APC 3.
 *
 * The catalog already carries 11 FiAPC probes, 4 cryoprobes, 14 ERBECRYO accessories, and 69
 * connecting cables with no console to attach any of them to — the generator was the one row
 * nobody had added. The brochure prints `10160-000` generically as "VIO Electrosurgical unit";
 * the GUDID record names it "ERBE VIO® 3 Electrosurgical Unit", which is what is used here.
 * The APC 3 has no order number anywhere in the brochure; its catalog number comes from the
 * UDI record alone.
 */
const ERBE_DEVICES: GudidDeviceDefinition[] = [
  {
    lookup: '10160-000',
    productName: 'ERBE VIO 3 Electrosurgical Unit',
    brandFamily: 'VIO 3',
    roleCode: 'ENERGY_PLATFORM',
    primaryCategory: 'Energy platform',
    subcategory: 'Electrosurgical generator',
    productKind: 'Capital equipment',
    summary:
      'Electrosurgical generator for the VIO 3 platform, the console the FiAPC probes, APC applicators, hot biopsy forceps, and connecting cables in this catalog attach to.',
    sourceId: ERBE_VIO3_SOURCE_ID,
    sourceLocation: 'Product data — Products table; Technical data table',
    claimType: 'Order number and technical data',
    sizeDisplay: '415 x 215 x 375 mm; 12 kg',
    spec: {
      max_cut_output_w: 400,
      max_cut_output_reference_ohm: 300,
      max_coag_output_w: 360,
      display_size_in: 10.4,
      intermittent_operation_duty_cycle_percent: 25,
      program_groups: 20,
      programs_per_group: 15,
      mains_voltage: '100-120 V / 220-240 V AC, 50/60 Hz',
    },
    notes:
      'The VIO CART (20180-000) and the VIO 3 / APC 3 fastening sets (20180-140/143/144) are printed in the same brochure but have no FDA UDI record, so they are not listed as separate products.',
  },
  {
    lookup: '10135-000',
    productName: 'ERBE APC 3 Argon Plasma Coagulation Unit',
    brandFamily: 'APC 3',
    roleCode: 'ENERGY_PLATFORM',
    primaryCategory: 'Energy platform',
    subcategory: 'Argon plasma coagulation unit',
    productKind: 'Capital equipment',
    summary:
      'Argon plasma coagulation module for the VIO platform. Drives the FiAPC flexible probes and rigid APC applicators already in this catalog.',
    sourceId: ERBE_VIO3_SOURCE_ID,
    sourceLocation: 'APC waveforms available with APC 3 module',
    claimType: 'Device identity and platform pairing',
    notes:
      'The VIO 3 brochure names the APC 3 module but prints no order number for it; 10135-000 is the FDA UDI catalog number. No APC 3 technical data is claimed from the VIO 3 brochure.',
  },
  {
    lookup: '20189-353',
    productName: 'VIO 3 Two-Pedal ReMode Footswitch with Bracket',
    brandFamily: 'VIO 3',
    roleCode: 'ENERGY_PLATFORM_ACCESSORY',
    primaryCategory: 'Energy platform',
    subcategory: 'Footswitch',
    productKind: 'Reusable instrument',
    summary:
      'Immersible, machine-washable two-pedal footswitch with ReMode functionality for the VIO 3.',
    sourceId: ERBE_VIO3_SOURCE_ID,
    sourceLocation: 'Product data — Products table',
    claimType: 'Order number and configuration',
  },
  {
    lookup: '20188-350',
    productName: 'VIO 3 One-Pedal ReMode Footswitch',
    brandFamily: 'VIO 3',
    roleCode: 'ENERGY_PLATFORM_ACCESSORY',
    primaryCategory: 'Energy platform',
    subcategory: 'Footswitch',
    productKind: 'Reusable instrument',
    summary: 'One-pedal footswitch with ReMode functionality for the VIO 3.',
    sourceId: ERBE_VIO3_SOURCE_ID,
    sourceLocation: 'Product data — Products table',
    claimType: 'Order number and configuration',
  },
]

/**
 * Pulmonx Chartis.
 *
 * Brand families are functional rather than the marketing name: `familyKey` splits on
 * `product_kind`, so filing the catheters and the consoles under one "Chartis Pulmonary
 * Assessment System" renders as two identical-looking rows. The same reasoning named the
 * Monarch and Galaxy families.
 *
 * The supplied IFU is the CE-marked international document and carries no FDA statement at
 * all; identity and US distribution come from the UDI records. Only two catalog numbers exist
 * anywhere in that 68-page IFU — CHR-CA-12.0 and CHR-CA-12.0-XL — and the XL has no UDI
 * record, so it is deliberately absent and noted on the standard catheter instead.
 */
const PULMONX_DEVICES: GudidDeviceDefinition[] = [
  {
    lookup: 'CHR-CA-12.0',
    productName: 'Chartis Catheter',
    brandFamily: 'Chartis Catheter',
    roleCode: 'COLLATERAL_VENTILATION_SYSTEM',
    primaryCategory: 'Bronchoscopic lung volume reduction',
    subcategory: 'Collateral ventilation assessment catheter',
    productKind: 'Single-use device',
    summary:
      'Balloon-tipped, dual-lumen catheter that isolates a target compartment and measures the airflow leaving it, so collateral ventilation can be assessed before valve placement.',
    sourceId: CHARTIS_IFU_SOURCE_ID,
    sourceLocation: 'Section 1.0 specifications table; Section 4.0 warnings',
    claimType: 'Working length, outer diameter, and bronchoscope requirement',
    sizeDisplay: '72 cm working length; 2.7 mm OD',
    workingLengthCm: 72,
    diameterMm: 2.7,
    minWorkingChannelMm: 2.8,
    spec: {
      total_length_cm: 169,
      airway_diameter_range_mm: '5-12',
      maximum_air_volume_ml: 3,
      shaft_material: 'Medical-grade PEBAX',
    },
    notes:
      'A CHR-CA-12.0-XL variant with a 76 cm working length is specified in the same IFU but has no FDA UDI record, so it is not listed as a separate product.',
  },
  {
    lookup: 'CHR-CA-15.0',
    productName: 'Chartis Precision Catheter',
    brandFamily: 'Chartis Catheter',
    roleCode: 'COLLATERAL_VENTILATION_SYSTEM',
    primaryCategory: 'Bronchoscopic lung volume reduction',
    subcategory: 'Collateral ventilation assessment catheter',
    productKind: 'Single-use device',
    summary:
      'Current-generation collateral ventilation assessment catheter, used with the Chartis Console.',
    sourceId: GUDID_SOURCE_ID,
    sourceLocation: 'AccessGUDID device record',
    claimType: 'Device identity and distribution status',
    notes:
      'The supplied Chartis IFU covers the CHR-CA-12.0 family only, so no dimensions are claimed for this catheter.',
  },
  {
    lookup: 'CHR-CO-100',
    productName: 'Chartis Console',
    brandFamily: 'Chartis Console',
    roleCode: 'COLLATERAL_VENTILATION_SYSTEM',
    primaryCategory: 'Bronchoscopic lung volume reduction',
    subcategory: 'Collateral ventilation console',
    productKind: 'Capital equipment',
    summary:
      'Reusable console that displays airway flow and pressure from the isolated compartment in real time. Supports a standard mode and a ventilator mode.',
    sourceId: CHARTIS_IFU_SOURCE_ID,
    sourceLocation: 'Section 1.0; Section 2.0; Section 4.0',
    claimType: 'Device identity and function',
    notes:
      'The IFU prints no catalog number, dimensions, or model designation for the console; the ordering number comes from the FDA UDI record. The catheter connects to it through a Connector Set, which the IFU names as a component but never gives an order number for.',
  },
  {
    lookup: 'CHR-CO-300',
    productName: 'Chartis Tablet Console',
    brandFamily: 'Chartis Console',
    roleCode: 'COLLATERAL_VENTILATION_SYSTEM',
    primaryCategory: 'Bronchoscopic lung volume reduction',
    subcategory: 'Collateral ventilation console',
    productKind: 'Capital equipment',
    summary:
      'Two-part touchscreen console and sensor enclosure for bronchoscopy-suite use with the Chartis Catheter.',
    sourceId: GUDID_SOURCE_ID,
    sourceLocation: 'AccessGUDID device record',
    claimType: 'Device identity and distribution status',
  },
]

// --- documented but not UDI-listed, and Tier-4 research entries ------------------------------

interface DocumentedDeviceDefinition {
  /** Empty when no supplied document prints an orderable identifier — several do not. */
  catalogNumber: string | null
  productName: string
  manufacturerName: string
  brandFamily: string
  roleCode: string | null
  primaryCategory: string
  subcategory: string
  productKind: string
  summary: string
  sourceId: string
  sourceLocation: string
  claimType: string
  sizeDisplay?: string | null
  diameterMm?: number | null
  lengthMm?: number | null
  workingLengthCm?: number | null
  /**
   * Lasing medium, exactly as the source names it. Never inferred from a wavelength: a bare
   * quartz fibre has no medium of its own, and a brochure that prints only "1.9 µm" has not
   * told you it is thulium even when everyone knows it is.
   */
  laserType?: string | null
  /** Who a hospital actually orders it from, when that differs from who makes it. */
  distributor?: string | null
  spec?: Record<string, unknown>
  notes?: string | null
  /** Overrides the default "documented, not UDI-listed" availability note. */
  availabilityNote?: string
  verificationStatus: string
  /**
   * Default hidden/candidate. Promoted to visible only where a manufacturer document
   * establishes identity AND an FDA UDI record reports the device in commercial distribution —
   * the same bar every other visible product in this catalog clears.
   */
  visibility?: 'prototype_visible' | 'hidden'
  verificationGrade?: 'verified_source' | 'candidate'
}

/**
 * Richard Wolf single-port mini-thoracoscopy set.
 *
 * The catalog already carries three of these twelve SKUs from the workbook — the two trocar
 * sleeves and the surgical probe — so only the nine it does not are emitted. The two
 * electrodes are the point of the exercise: `MED_THORACOSCOPY` had no energy requirement at
 * all, in a procedure where hook and button coagulation are routine.
 *
 * Every order number below was read twice from the sell sheet (layout and non-layout text
 * extraction) and re-checked against a 450 dpi render, because the non-layout extraction
 * detaches one row's "Includes:" line from its product number. Note `8919.3311` — a four-digit
 * suffix, not a mis-typed `8919.331`, which is a different in-distribution trocar sleeve.
 */
const RICHARD_WOLF_MINI_THORACOSCOPY: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: '89204015',
    productName: 'Operative Telescope 5.5 mm, 0°, with 3.5 mm Working Channel (bundle)',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPE_RIGID',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Operative telescope',
    productKind: 'Reusable endoscope',
    summary:
      'Single-piece 0° operative endoscope, 5.5 mm outer diameter, with a 3.5 mm built-in working channel for single-port medical thoracoscopy.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number, configuration, and bundle contents',
    sizeDisplay: '5.5 mm OD, 0°, 215 mm shaft, 3.5 mm channel',
    diameterMm: 5.5,
    spec: {
      viewing_angle_deg: 0,
      shaft_length_mm: 215,
      working_channel_mm: 3.5,
      bundle_contents:
        'Op-endoscope 0° 5.5 mm SL 215 mm (8920.401), automatic valve i.d. 5.7 mm (8920.311), sealing membrane 17 mm (89.103), sealing cap 2.4-3.4 mm (89.01)',
    },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this bundle order number.',
  },
  {
    catalogNumber: '8906.151',
    productName: 'Trocar, Threaded, Dull Tip, 5.5 mm, WL 83 mm',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_TROCAR',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Trocar',
    productKind: 'Reusable instrument',
    summary: 'Threaded dull-tip trocar for the 5.7 mm flexible thoracoscopy sleeve.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number and configuration',
    sizeDisplay: '5.5 mm, WL 83 mm',
    diameterMm: 5.5,
    spec: { working_length_mm: 83, tip: 'Dull', thread: true },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this order number.',
  },
  {
    catalogNumber: '8919.3311',
    productName: 'Trocar, Dull Tip, 5.5 mm, WL 104 mm',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_TROCAR',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Trocar',
    productKind: 'Reusable instrument',
    summary: 'Dull-tip trocar for the 5.5 mm thoracoscopy sleeve.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number and configuration',
    sizeDisplay: '5.5 mm, WL 104 mm',
    diameterMm: 5.5,
    spec: { working_length_mm: 104, tip: 'Dull' },
    notes:
      'The printed order number carries a four-digit suffix (8919.3311). 8919.331 is a different, UDI-listed trocar sleeve — do not collapse the two.',
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this order number.',
  },
  {
    catalogNumber: '83912167',
    productName: 'Double Spoon Forceps, Monopolar, 3.5 mm (bundle)',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_BIOPSY_FORCEPS',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Biopsy forceps',
    productKind: 'Reusable instrument',
    summary:
      'Monopolar double-spoon biopsy forceps, 3.5 mm, supplied with an insulated 330 mm sheath tube and pistol-grip handle.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number, configuration, and bundle contents',
    sizeDisplay: '3.5 mm, SL 330 mm',
    diameterMm: 3.5,
    spec: {
      bundle_contents:
        'Double spoon forceps insert 3.5 mm (8391216), insulated sheath tube 3.5 mm SL 330 mm (8391933), pistol-shaped monopolar handle (83930074)',
    },
    notes:
      'The sell sheet states only that the instrument is monopolar. It names no generator, wattage, waveform, or return-electrode requirement — confirm all of that against the current IFU and the generator in the room.',
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this bundle order number.',
  },
  {
    catalogNumber: '83912227',
    productName: 'Dissection Forceps, Monopolar, 3.5 mm (bundle)',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_BIOPSY_FORCEPS',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Dissection forceps',
    productKind: 'Reusable instrument',
    summary:
      'Monopolar dissection forceps, 3.5 mm, supplied with an insulated 330 mm sheath tube and pistol-grip handle.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number, configuration, and bundle contents',
    sizeDisplay: '3.5 mm, SL 330 mm',
    diameterMm: 3.5,
    spec: {
      bundle_contents:
        'Dissection forceps insert 3.5 mm (8391222), insulated sheath tube 3.5 mm SL 330 mm (8391933), pistol-shaped monopolar handle (83930074)',
    },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this bundle order number.',
  },
  {
    catalogNumber: '8379.452',
    productName: 'Hook Electrode, Monopolar, 3.5 mm, WL 310 mm',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_ELECTRODE',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Hook electrode',
    productKind: 'Reusable instrument',
    summary:
      'Monopolar hook electrode for cutting and coagulating adhesions through the 3.5 mm thoracoscopy channel.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number and configuration',
    sizeDisplay: '3.5 mm, WL 310 mm',
    diameterMm: 3.5,
    spec: { working_length_mm: 310, energy: 'Monopolar' },
    notes:
      'Requires a compatible electrosurgical generator and return electrode. The sell sheet states no settings; use the generator IFU.',
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this order number.',
  },
  {
    catalogNumber: '8379.462',
    productName: 'Coagulation Electrode, Button, Monopolar, 3.5 mm, WL 310 mm',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'THORACOSCOPY_ELECTRODE',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Coagulation electrode',
    productKind: 'Reusable instrument',
    summary:
      'Monopolar button coagulation electrode for surface haemostasis through the 3.5 mm thoracoscopy channel.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number and configuration',
    sizeDisplay: '3.5 mm, WL 310 mm',
    diameterMm: 3.5,
    spec: { working_length_mm: 310, energy: 'Monopolar' },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this order number.',
  },
  {
    catalogNumber: '8380.68',
    productName: 'Suction Tube, 2.8 mm, WL 450 mm',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'GENERIC_SUCTION',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Suction tube',
    productKind: 'Reusable instrument',
    summary: 'Suction tube sized for the 3.5 mm operative channel.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number and configuration',
    sizeDisplay: '2.8 mm, WL 450 mm',
    diameterMm: 2.8,
    spec: { working_length_mm: 450 },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this order number.',
  },
  {
    catalogNumber: '806625301',
    productName: 'Fiber Light Cable 2.5 mm, 3 m (bundle)',
    manufacturerName: 'Richard Wolf',
    brandFamily: 'Mini-Thoracoscopy Set',
    roleCode: 'ENDOSCOPY_LIGHT_CABLE',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Light cable',
    productKind: 'Reusable instrument',
    summary: 'Fibre light cable with projector- and endoscope-side adapters.',
    sourceId: RICHARD_WOLF_SOURCE_ID,
    sourceLocation: 'Mini-Thoracoscopy Set ordering table',
    claimType: 'Order number, configuration, and bundle contents',
    sizeDisplay: '2.5 mm, 3 m',
    diameterMm: 2.5,
    spec: {
      bundle_contents:
        'Fibre light cable 2.5 mm TL 3 m (80662530), adapter projector side (8095.07), adapter endoscope side (809509)',
    },
    verificationStatus:
      'Candidate - Richard Wolf Mini-Thoracoscopy Set sell sheet; no FDA UDI record located for this bundle order number.',
  },
]

/**
 * Karl Storz thoracoscopy.
 *
 * Four of the five items on the Storz medical-thoracoscopy, pleurodesis, and empyema pages are
 * already in the catalog. The dissection electrode is the fifth, and it is the one that fills
 * the same gap the Richard Wolf electrodes do.
 */
const KARL_STORZ_THORACOSCOPY: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: '26072UF',
    productName: 'Optical Dissection Electrode',
    manufacturerName: 'Karl Storz',
    brandFamily: 'Thoracoscopy 26072 family',
    roleCode: 'THORACOSCOPY_ELECTRODE',
    primaryCategory: 'Medical thoracoscopy',
    subcategory: 'Dissection electrode',
    productKind: 'Reusable instrument',
    summary:
      'Optical dissection electrode for the 26072 thoracoscopy family, used through the same optical instrument channel as the biopsy forceps and suction tube.',
    sourceId: KARL_STORZ_SOURCE_ID,
    sourceLocation: 'Pleurodesis search-results page',
    claimType: 'Article number and product name',
    notes:
      'The Storz "medical thoracoscopy", "pleurodesis", and "empyema" pages are nested subsets of one 26072 instrument family rather than three separate sets; this item appears on the pleurodesis page.',
    verificationStatus:
      'Candidate - KARL STORZ online catalog capture; no FDA UDI record located for this article number.',
  },
]

/**
 * Mobile C-arms.
 *
 * Identity only, and deliberately so. None of the three brochures prints a catalog, order,
 * part, model-configuration, GTIN, or UDI number anywhere, and none states an FDA clearance.
 * Recording dose, detector, or reconstruction claims off a marketing brochure would be exactly
 * the kind of specification a card must not carry, so nothing beyond the system name and the
 * fact that it does 3D is asserted.
 */
const FLUOROSCOPY_SYSTEMS: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'Cios Spin Mobile 3D C-arm',
    manufacturerName: 'Siemens Healthineers',
    brandFamily: 'Cios',
    roleCode: 'FLUOROSCOPY_C_ARM',
    primaryCategory: 'Procedural imaging',
    subcategory: 'Mobile 2D/3D C-arm',
    productKind: 'Capital equipment',
    summary: 'Mobile C-arm with 2D fluoroscopy and 3D cone-beam acquisition.',
    sourceId: CIOS_SPIN_SOURCE_ID,
    sourceLocation: 'Siemens Healthineers USA product page',
    claimType: 'System identity',
    notes:
      'The product page prints no catalog, order, or UDI number and states no FDA clearance. No dose, detector, or image-quality claim is recorded from it.',
    verificationStatus:
      'Candidate - manufacturer product page; identity only. No orderable identifier exists in the document and no FDA UDI record was located.',
  },
  {
    catalogNumber: null,
    productName: 'OEC 3D Mobile Imaging System',
    manufacturerName: 'GE HealthCare',
    brandFamily: 'OEC',
    roleCode: 'FLUOROSCOPY_C_ARM',
    primaryCategory: 'Procedural imaging',
    subcategory: 'Mobile 2D/3D C-arm',
    productKind: 'Capital equipment',
    summary: 'Mobile C-arm with 2D fluoroscopy and 3D volumetric imaging.',
    sourceId: OEC_3D_SOURCE_ID,
    sourceLocation: 'OEC 3D brochure',
    claimType: 'System identity',
    notes:
      'The brochure prints no catalog or UDI number. The string "JB02978XX(3)" on its final page is a GE marketing document-tracking code and is not an ordering number.',
    verificationStatus:
      'Candidate - manufacturer brochure; identity only. No orderable identifier exists in the document and no FDA UDI record was located.',
  },
  {
    catalogNumber: null,
    productName: 'Ziehm Vision RFD 3D Mobile C-arm',
    manufacturerName: 'Ziehm Imaging',
    brandFamily: 'Ziehm Vision',
    roleCode: 'FLUOROSCOPY_C_ARM',
    primaryCategory: 'Procedural imaging',
    subcategory: 'Mobile 2D/3D C-arm',
    productKind: 'Capital equipment',
    summary: 'Mobile flat-detector C-arm with 2D fluoroscopy and 3D acquisition.',
    sourceId: ZIEHM_SOURCE_ID,
    sourceLocation: 'Ziehm Vision RFD 3D product brochure',
    claimType: 'System identity',
    notes:
      'The brochure prints no catalog or UDI number and states no FDA clearance for the C-arm itself.',
    verificationStatus:
      'Candidate - manufacturer brochure; identity only. No orderable identifier exists in the document and no FDA UDI record was located.',
  },
]

/** Body Vision LungVision — tomosynthesis-based navigation. Identity only, same reasoning. */
const NAVIGATION_SYSTEMS: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'LungVision System',
    manufacturerName: 'Body Vision Medical',
    brandFamily: 'LungVision Platform',
    roleCode: 'TOMOSYNTHESIS_NAVIGATION_SYSTEM',
    primaryCategory: 'Procedural imaging',
    subcategory: 'Tomosynthesis navigation platform',
    productKind: 'Capital equipment',
    summary:
      'Augmented-fluoroscopy navigation platform that reconstructs intraprocedural tomosynthesis from a standard C-arm to localize peripheral lesions and confirm tool-in-lesion.',
    sourceId: LUNGVISION_SOURCE_ID,
    sourceLocation: 'LungVision System product page and MOSS brochure',
    claimType: 'System identity and intended use',
    notes:
      'Neither supplied document prints an order number, model designation, or UDI for the system, the main unit, the tablet, the stand, or the optional monitor, and neither states an FDA clearance number.',
    verificationStatus:
      'Candidate - manufacturer product page and brochure; identity only. No orderable identifier exists in the documents and no FDA UDI record was located.',
  },
  {
    catalogNumber: null,
    productName: 'LungVision Procedure Kit',
    manufacturerName: 'Body Vision Medical',
    brandFamily: 'LungVision Procedure Kit',
    roleCode: 'TOMOSYNTHESIS_NAVIGATION_SYSTEM',
    primaryCategory: 'Procedural imaging',
    subcategory: 'Navigation procedure kit',
    productKind: 'Single-use device',
    summary: 'Single-procedure kit used with the LungVision System.',
    sourceId: LUNGVISION_SOURCE_ID,
    sourceLocation: 'LungVision MOSS brochure',
    claimType: 'Component identity',
    notes:
      'Called a "Procedural Kit" in the MOSS brochure. No order number, sterility statement, single-use statement, or shelf life is printed for it in either document.',
    verificationStatus:
      'Candidate - manufacturer brochure; identity only. No orderable identifier exists in the document and no FDA UDI record was located.',
  },
]

/**
 * Galvanize Aliya — pulsed electric field.
 *
 * The manufacturer's own page states the EX Generator, the PEF System, and the INUMI Flex
 * Needle are 510(k) cleared for surgical ablation of soft tissue, and does not promote an
 * airway indication. That distinction is the whole reason this belongs in the normal catalog
 * with a regulatory badge rather than on the emerging view: it has US marketing authorization,
 * and that authorization is not for the airway.
 */
const PEF_DEVICES: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'Aliya EX Generator',
    manufacturerName: 'Galvanize Therapeutics',
    brandFamily: 'Aliya',
    roleCode: 'PULSED_FIELD_ABLATION_SYSTEM',
    primaryCategory: 'Energy platform',
    subcategory: 'Pulsed electric field generator',
    productKind: 'Capital equipment',
    summary:
      'Pulsed electric field generator delivering short high-voltage bursts for non-thermal soft-tissue ablation.',
    sourceId: ALIYA_SOURCE_ID,
    sourceLocation: 'Aliya System product page',
    claimType: 'Device identity and 510(k) indication wording',
    notes:
      'Cleared for surgical ablation of soft tissue. The manufacturer does not promote an airway indication; any bronchoscopic use is off-label and outside the cleared indication.',
    verificationStatus:
      'Candidate - manufacturer product page; the page prints no catalog number and no 510(k) number. Identity and indication wording only.',
  },
  {
    catalogNumber: null,
    productName: 'Aliya PEF System',
    manufacturerName: 'Galvanize Therapeutics',
    brandFamily: 'Aliya',
    roleCode: 'PULSED_FIELD_ABLATION_SYSTEM',
    primaryCategory: 'Energy platform',
    subcategory: 'Pulsed electric field system',
    productKind: 'Capital equipment',
    summary: 'Pulsed electric field ablation system for soft tissue.',
    sourceId: ALIYA_SOURCE_ID,
    sourceLocation: 'Aliya System product page',
    claimType: 'Device identity and 510(k) indication wording',
    notes: 'Cleared for surgical ablation of soft tissue; no airway indication is claimed.',
    verificationStatus:
      'Candidate - manufacturer product page; the page prints no catalog number and no 510(k) number. Identity and indication wording only.',
  },
  {
    catalogNumber: null,
    productName: 'INUMI Flex Needle',
    manufacturerName: 'Galvanize Therapeutics',
    brandFamily: 'Aliya',
    roleCode: 'PULSED_FIELD_ABLATION_CATHETER',
    primaryCategory: 'Therapeutic bronchoscopy',
    subcategory: 'Pulsed electric field needle',
    productKind: 'Single-use device',
    summary: 'Flexible needle electrode used with the Aliya pulsed electric field system.',
    sourceId: ALIYA_SOURCE_ID,
    sourceLocation: 'Aliya System product page',
    claimType: 'Device identity and 510(k) indication wording',
    notes: 'Cleared for surgical ablation of soft tissue; no airway indication is claimed.',
    verificationStatus:
      'Candidate - manufacturer product page; the page prints no catalog number and no 510(k) number. Identity and indication wording only.',
  },
]

/**
 * Airway lasers.
 *
 * Rebuilt from manufacturer IFUs, brochures, and a 510(k) summary, replacing the Tier-4
 * research-report cohort that stood in for them. The selection rule, applied to 43 supplied
 * documents, is deliberately narrow because a surgical laser folder is mostly other people's
 * specialties: **a laser device is listed here only when its own labeling names airway,
 * bronchoscopic, or pulmonary use, and the wavelength and delivery form match what the airway
 * literature actually describes.** Both halves are required. A long specialty list that
 * happens to contain "pulmonology" is evidence; a marketing line contradicted by the same
 * page's own specialty table is not.
 *
 * Deliberately excluded, and why — this is most of the folder:
 *  - **A.R.C. Laser FOX** (in the previous cohort). A.R.C.'s own sheets are "devoted to lasers
 *    in ENT"; the applications printed are turbinate, polyp, septum, epistaxis, snoring,
 *    stapedotomy, myringotomy, DCR, tonsil. The general FOX III brochure names dermatology,
 *    surgery, ophthalmology, aesthetics, dental, ENT and veterinary. No supplied A.R.C.
 *    document names an airway application. A.R.C. does build the CO2 engine inside the
 *    OmniGuide IntelliGuide console below, so the company is in the airway chain — under
 *    someone else's label.
 *  - **OmniGuide OTO-S and OTO-M fibres** (also in the previous cohort) and the Elevate ENT and
 *    BeamPath ROBOTIC handpieces. Their cleared Indications for Use enumerate twelve
 *    specialties and pulmonology is not among them; VELOCITY and the Mark III waveguide below
 *    carry the airway labeling instead.
 *  - **Lumenis VersaPulse and the Boston Scientific Pulse 30H/120H** holmium systems. The only
 *    pulmonary word in the VersaPulse brochure is one marketing line — "multiple specialties
 *    including urology, gastroenterology, pulmonology, orthopedics, ENT and more" — which the
 *    bulleted specialty list on the same page omits. Internally inconsistent marketing copy is
 *    not an indication.
 *  - **LISA Sphinx and Sphinx Jr.**, LithoFib and SideFib fibres, FlexGuard, RexScope/Telex;
 *    **Quanta Litho 60, Cyber TM, Discovery Pico**; **Olympus Empower**. Lithotripsy, BPH, and
 *    aesthetics.
 *  - **The ForTec KTP/Nd:YAG mobile-service sheet.** It is the only KTP and Nd:YAG source in
 *    the folder, and Nd:YAG is the wavelength the literature leans on hardest — but the sheet
 *    is a rental-service offering with no manufacturer, no model number, and a specialty list
 *    (general surgery, gynecology, ENT, plastic surgery, urology, orthopedics) that names no
 *    airway use. That US Nd:YAG access now runs largely through mobile service is recorded in
 *    the LASER_CONSOLE role guidance instead, where it belongs.
 */
const LASER_DEVICES: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: 'FELS-25A',
    laserType: 'CO2',
    visibility: 'prototype_visible',
    verificationGrade: 'verified_source',
    productName: 'BeamPath FELS-25A CO2 Laser System with IntelliGuide',
    manufacturerName: 'OmniGuide',
    brandFamily: 'BeamPath',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'CO2 laser console',
    productKind: 'Capital equipment',
    summary:
      'CO2 laser console delivering 10,600 nm through a hollow-core flexible waveguide fibre, which is what makes CO2 usable endoscopically at all.',
    sourceId: OMNIGUIDE_INTELLIGUIDE_SOURCE_ID,
    sourceLocation: 'IntelliGuide IFU — indications, warnings, and user settings',
    claimType: 'Model identity, wavelength, and airway operating limits',
    spec: {
      wavelength_nm: 10600,
      airway_oxygen_limit_percent: 30,
      configurations: 'FELS-25A, FELS-25A-E, FELS-25A-S2, FELS-25A-S3, FELS-25A-S4',
      lasing_medium: 'CO2',
    },
    notes:
      'The cleared Indications for Use list twelve specialties and pulmonology is not among them. The manual nonetheless instructs on airway use directly — a laser-safe tracheotomy tube at 10.6 micron, oxygen at or below 30% while firing, airway-fire protocol, and "the fiber should not be used below the carina" — so airway use is contemplated in the labeling even though it is not in the cleared specialty list. Confirm the indication locally before planning a case around it. The CO2 engine is an A.R.C. Laser C-LAS built for OmniGuide. ForTec Medical also offers an OmniGuide CO2 system as a mobile service under its Interventional Pulmonology line, rated to 25 W; that sheet describes ENT and gynaecology procedures only, so it is recorded here rather than as a separate product.',
    verificationStatus:
      'Verified - OmniGuide IntelliGuide instructions for use; FDA UDI record lists FELS-25A in commercial distribution.',
  },
  {
    catalogNumber: 'SL980+1470nm45W',
    laserType: 'Diode',
    visibility: 'prototype_visible',
    verificationGrade: 'verified_source',
    productName: 'LEONARDO DUAL 45',
    manufacturerName: 'biolitec',
    brandFamily: 'LEONARDO',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Dual-wavelength diode laser console',
    productKind: 'Capital equipment',
    summary:
      'Dual-wavelength 980 nm and 1470 nm diode console. The two wavelengths are the ones the airway literature tabulates as penetrating 2-4 mm and 2-3 mm respectively — shallow, compact, and air-cooled.',
    sourceId: BIOLITEC_SOURCE_ID,
    sourceLocation: 'LEONARDO brochure — family indications and technical data',
    claimType: 'Model identity, wavelengths, and stated indications',
    spec: { wavelengths_nm: '980 + 1470', power_w: 45, lasing_medium: 'Diode' },
    notes:
      'The brochure names "Lung metastases and bronchial tumors" among the minimally invasive laser therapies the family\u2019s fibres and application kits serve — an explicit bronchial claim rather than an inference from a general soft-tissue clearance. It calls the platform a "highly compact diode laser", which is where the recorded medium comes from.',
    verificationStatus:
      'Verified - biolitec LEONARDO brochure; FDA UDI record (CeramOptec GmbH) lists Leonardo DUAL 45 in commercial distribution.',
  },
  {
    catalogNumber: 'SL980+1470nm200W',
    laserType: 'Diode',
    visibility: 'prototype_visible',
    verificationGrade: 'verified_source',
    productName: 'LEONARDO DUAL 200',
    manufacturerName: 'biolitec',
    brandFamily: 'LEONARDO',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Dual-wavelength diode laser console',
    productKind: 'Capital equipment',
    summary: 'Higher-power dual-wavelength 980 nm and 1470 nm diode console.',
    sourceId: BIOLITEC_SOURCE_ID,
    sourceLocation: 'LEONARDO brochure — family indications and technical data',
    claimType: 'Model identity, wavelengths, and stated indications',
    spec: { wavelengths_nm: '980 + 1470', power_w: 200, lasing_medium: 'Diode' },
    notes:
      'Shares the family indication list, including "Lung metastases and bronchial tumors". A LEONARDO DUAL 100 is printed in the same brochure but has no FDA UDI record, so it is not listed as a separate product.',
    verificationStatus:
      'Verified - biolitec LEONARDO brochure; FDA UDI record (CeramOptec GmbH) lists Leonardo DUAL 200 in commercial distribution.',
  },
  {
    catalogNumber: null,
    visibility: 'prototype_visible',
    verificationGrade: 'verified_source',
    laserType: 'Thulium + erbium',
    productName: 'Opera EVO Dual Wavelength Laser',
    manufacturerName: 'Quanta System',
    brandFamily: 'Opera',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Dual-wavelength laser console',
    productKind: 'Capital equipment',
    summary:
      'Dual-wavelength 1.9 µm and 1.5 µm console. Shallow penetration and ablation efficiency, which the manufacturer positions for endoscopic airway debulking.',
    sourceId: QUANTA_SOURCE_ID,
    sourceLocation: 'Opera EVO brochure — Thoracic Surgery application panel',
    claimType: 'System identity, wavelengths, and stated thoracic applications',
    spec: { wavelengths_um: '1.9 + 1.5', lasing_medium: 'Thulium + erbium' },
    notes:
      'The brochure carries a dedicated Thoracic Surgery panel naming "Endoscopic airway treatment" and "Lung resection", and states the shallow penetration is useful in "the endoscopic treatments of airway tree (e.g. obstruction debulking)". The specification table gives the sources only as wavelengths, 1.9 µm and 1.5 µm; the medium is recorded as thulium and erbium because the brochure\u2019s own citation list names it "the Thulium/Erbium laser system". It prints no catalog number, and its own first page warns that it is not intended for all markets — confirm US availability and indication locally.',
    verificationStatus:
      'Verified - Quanta Opera EVO brochure; FDA UDI record lists Opera Evo in commercial distribution. No catalog number is printed in the brochure.',
  },
  {
    catalogNumber: '105 105 331',
    laserType: 'Thulium',
    productName: 'RevoLix jr.',
    manufacturerName: 'LISA Laser Products',
    brandFamily: 'RevoLix',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Thulium laser console',
    productKind: 'Capital equipment',
    summary:
      'Continuous-wave 2013 nm thulium console the manufacturer positions for airway recanalization and desobstruction.',
    sourceId: LISA_SOURCE_ID,
    sourceLocation: 'RevoLix jr. brochure — Applications page, Pneumology block',
    claimType: 'System identity, wavelength, and stated pulmonary applications',
    spec: { wavelength_nm: 2013, mode: 'Continuous wave', lasing_medium: 'Thulium' },
    notes:
      'The brochure calls it a "surgical Thulium laser" running as a continuous-wave DPSS system, and notes its 2.0 micron wavelength is "almost identical to the well established Holmium laser". It lists a Pneumology block reading "Bronchoscopy / Airway recanalization / Desobstruction / Tissue coagulation". Note that the airway literature tabulates Nd:YAG, Nd:YAP, Ho:YAG, KTP, diode, and CO2 but not thulium at 2013 nm; the airway claim here is the manufacturer\u2019s, adjacent to the Ho:YAG 2100 nm evidence rather than covered by it.',
    verificationStatus:
      'Candidate - LISA Laser brochure; FDA UDI record lists RevoLix and RevoLix Jr. in commercial distribution, but no peer-reviewed airway series for thulium is on file here.',
  },
  {
    catalogNumber: '332005',
    laserType: 'CO2',
    visibility: 'prototype_visible',
    verificationGrade: 'verified_source',
    productName: 'VELOCITY High Performance Fiber',
    manufacturerName: 'OmniGuide',
    brandFamily: 'BeamPath',
    roleCode: 'LASER_FIBER',
    primaryCategory: 'Laser',
    subcategory: 'Hollow-core CO2 waveguide fibre',
    productKind: 'Single-use device',
    summary:
      'Flexible hollow-core CO2 delivery fibre with published airway operating limits, for laryngeal and subglottic work.',
    sourceId: OMNIGUIDE_VELOCITY_SOURCE_ID,
    sourceLocation: 'VELOCITY fibre IFU — user settings and warnings',
    claimType: 'Wavelength, airway pressure and power limits, and oxygen limit',
    spec: {
      wavelength_nm: 10600,
      max_power_w: 30,
      pediatric_airway_setting: '30 psi, 10 W or less',
      adult_glottic_subglottic_setting: '50 psi',
      airway_oxygen_limit_percent: 25,
    },
    notes:
      'Do not use below the carina, and use a laser-safe endotracheal tube. The IFU publishes airway-specific settings that exist only because airway use is contemplated, but pulmonology, bronchoscopy, and thoracic surgery are not in its Section II specialty list — confirm the indication locally.',
    verificationStatus:
      'Verified - OmniGuide VELOCITY instructions for use; FDA UDI record lists 332005 in commercial distribution.',
  },
  {
    catalogNumber: null,
    laserType: 'CO2',
    productName: 'BeamPath CO2 Mark III Waveguide Fiber',
    manufacturerName: 'OmniGuide',
    brandFamily: 'BeamPath',
    roleCode: 'LASER_FIBER',
    primaryCategory: 'Laser',
    subcategory: 'Hollow-core CO2 waveguide fibre',
    productKind: 'Single-use device',
    summary:
      'Hollow-core CO2 waveguide fibre. The one device in the supplied set whose FDA Indications for Use literally name pulmonology.',
    sourceId: OMNIGUIDE_510K_SOURCE_ID,
    sourceLocation: '510(k) K070157 summary and FDA-stamped Indications for Use',
    claimType: 'Cleared indications and wavelength',
    spec: { wavelength_nm: 10600 },
    notes:
      'Cleared "in the medical specialties of general and plastic surgery, oral/maxillofacial surgery, dentistry, dermatology, gynecology, otorhinolaryngology, gastroenterology, neurosurgery, urology, and pulmonology" for open and endoscopic use. The 510(k) summary prints no catalog number, so none is recorded.',
    verificationStatus:
      'Verified - FDA 510(k) K070157; the Indications for Use name pulmonology explicitly.',
  },
]

/**
 * The ForTec Medical interventional-pulmonology line.
 *
 * ForTec is a mobile laser service rather than a manufacturer: a hospital books the console and
 * the technologist for the case instead of buying the platform. That is not a footnote — it is
 * how most US centres reach Nd:YAG and KTP at all, now that Nd:YAG availability here is
 * limited, and it is why these belong in a catalog whose job is to record what will actually be
 * in the room.
 *
 * They are listed because **ForTec catalogues them under Interventional Pulmonology itself**.
 * That vendor categorization is the airway claim; on the underlying product sheets it is
 * usually the only one, and every entry below records exactly how far its own paperwork goes.
 * The gap is real and worth reading before selecting any of them: the supplied FDA clearance
 * for the KTP/Nd:YAG platform (K972575) covers **BPH only**, the EVOLVE sheet describes
 * prostate vaporization only, and the OmniGuide sheet describes ENT and gynaecology only.
 *
 * All are candidate-grade and hidden. A rental catalog page is good evidence that a device can
 * be got, and weak evidence of what it is cleared to do.
 */
const FORTEC_DEVICES: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'KTP/YAG Laser System (mobile service)',
    manufacturerName: 'Laserscope',
    distributor: 'ForTec Medical',
    brandFamily: 'KTP/YAG',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Dual-wavelength KTP and Nd:YAG laser console',
    productKind: 'Capital equipment',
    laserType: 'KTP + Nd:YAG',
    summary:
      'Dual-wavelength console switching between KTP 532 nm and Nd:YAG 1064 nm — the two wavelengths the airway literature leans on hardest, one for cutting a stricture and one for deep coagulation before debulking.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec KTP/YAG sheet and Interventional Pulmonology product listing',
    claimType: 'System identity, wavelengths, and power ranges',
    spec: {
      ktp_wavelength_nm: 532,
      ktp_power: '50 mW - 36 W',
      ndyag_wavelength_nm: 1064,
      ndyag_power_w: '5 - 100',
      mode: 'Continuous wave',
      lasing_medium: 'KTP (frequency-doubled Nd:YAG) + Nd:YAG',
    },
    notes:
      'ForTec lists this under Interventional Pulmonology, which is the only airway claim attached to it. Read the limits: the sheet\u2019s own specialty list is general surgery, gynecology, ENT, plastic surgery, urology and orthopedics — pulmonology is absent — and the supplied FDA clearance K972575, for the Laserscope KTP/Nd:YAG 800 and Orion series, is indicated for BPH only. Airway use falls outside that clearance. The 100 W Nd:YAG ceiling is far above the 20-40 W the airway literature uses, and settings above 40 W are a reported perforation risk.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing; the supplied 510(k) K972575 covers BPH only and no airway indication is stated.',
  },
  {
    catalogNumber: null,
    productName: 'Quanta Holmium Laser (mobile service)',
    manufacturerName: 'Quanta System',
    distributor: 'ForTec Medical',
    brandFamily: 'Quanta Holmium',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Holmium laser console',
    productKind: 'Capital equipment',
    laserType: 'Ho:YAG',
    summary:
      'Ho:YAG 2100 nm console. Strongly water-absorbed, so it cuts with very little thermal spread while keeping some coagulation.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec Quanta Holmium sheet and Interventional Pulmonology product listing',
    claimType: 'System identity, wavelength, power options, and stated penetration',
    spec: {
      wavelength_nm: 2100,
      power_options_w: '35, 60, 100',
      penetration_mm: '0.3 - 0.4',
      aiming_beam: 'Green',
      lasing_medium: 'Ho:YAG',
    },
    notes:
      'The sheet states a penetration of 0.3-0.4 mm, close to the "under 1 mm" the airway literature tabulates for Ho:YAG at about 10 W. The 60 W and 100 W configurations need 220 V. ForTec lists it under Interventional Pulmonology; the sheet itself names no airway indication.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing; no airway indication is stated on the product sheet.',
  },
  {
    catalogNumber: null,
    productName: 'neoV Laser (mobile service)',
    manufacturerName: 'ForTec Medical',
    distributor: 'ForTec Medical',
    brandFamily: 'neoV',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Diode laser console',
    productKind: 'Capital equipment',
    laserType: 'Diode',
    summary:
      'Compact 1470 nm diode console, 7.7 lb, with a Corona Probe that distributes energy circumferentially — the one console in this set whose own page is written for bronchoscopy.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec neoV Laser - Pulmonology product page',
    claimType: 'System identity, wavelength, mode, power, and stated bronchoscopic use',
    spec: {
      wavelength_nm: 1470,
      mode: 'Continuous wave / pulsed',
      power_w: 12,
      weight_lb: 7.7,
      lasing_medium: 'Diode',
    },
    notes:
      'The strongest airway wording of the ForTec line, and it is the page\u2019s own: "delivers a powerful and safe laser beam for pulmonology procedures", under a heading reading "Bronchoscopy Treatment", with the Corona Probe described as giving "efficient thermal ablation with minimal risk to the underlying muscle structure". This is the neoV 1470 the airway literature tabulates at 2-3 mm penetration and about 10 W; the page states 12 W.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing, which names bronchoscopy and pulmonology directly; no FDA clearance or UDI record is on file here.',
  },
  {
    catalogNumber: null,
    productName: 'EVOLVE 180 Diode Laser (mobile service)',
    manufacturerName: 'ForTec Medical',
    distributor: 'ForTec Medical',
    brandFamily: 'EVOLVE',
    roleCode: 'LASER_CONSOLE',
    primaryCategory: 'Laser',
    subcategory: 'Diode laser console',
    productKind: 'Capital equipment',
    laserType: 'Diode',
    summary:
      'High-power 980 nm diode console. 980 nm is one of the wavelengths the airway literature tabulates, at roughly 2-4 mm penetration.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec EVOLVE sheet and Interventional Pulmonology product listing',
    claimType: 'System identity, wavelength, and power ceiling',
    spec: { wavelength_nm: 980, max_power_w: 180, lasing_medium: 'Diode' },
    notes:
      'Listed under Interventional Pulmonology by ForTec, but the product sheet describes one thing only: vaporizing obstructing prostate tissue in BPH. Note the mismatch in scale before selecting it — the airway literature runs 980 nm at about 20 W, and this unit goes to 180 W.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing; the product sheet describes prostate vaporization only and states no airway indication.',
  },
  {
    catalogNumber: null,
    productName: 'Excalibur Holmium Laser Fiber with Safety Sheath',
    manufacturerName: 'ForTec Medical',
    distributor: 'ForTec Medical',
    brandFamily: 'Excalibur',
    roleCode: 'LASER_FIBER',
    primaryCategory: 'Laser',
    subcategory: 'Holmium laser fibre',
    productKind: 'Single-use device',
    laserType: 'Ho:YAG',
    summary:
      'Holmium fibre whose sheath recesses the tip from the target, so the fibre tip never touches the working channel.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec Holmium Laser Fibers - Inter. Pulmonology product page',
    claimType: 'Fibre construction, sheath function, and stated pulmonary use',
    spec: {
      wavelength_nm: 2100,
      construction: 'Glass core, glass cladding, coating, protective buffer tubing',
      lasing_medium: 'Ho:YAG',
    },
    notes:
      'The page states it "can be used in inter. pulmonlogy procedures" (the typo is the page\u2019s). The scope-protection claims are the reason to prefer it: the tip does not contact the working channel, it passes a flexed scope repeatedly without backing the scope out, and a fibre filter plus glass-ferrule blast shield keep stray energy out of the cladding.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing; no catalog number, FDA clearance, or UDI record is on file here.',
  },
  {
    catalogNumber: null,
    productName: 'SmartScope Holmium Laser Fiber',
    manufacturerName: 'ForTec Medical',
    distributor: 'ForTec Medical',
    brandFamily: 'SmartScope',
    roleCode: 'LASER_FIBER',
    primaryCategory: 'Laser',
    subcategory: 'Holmium laser fibre',
    productKind: 'Single-use device',
    laserType: 'Ho:YAG',
    summary:
      'Rounded-tip holmium fibre in 272, 365, 550 and 1000 µm, sterile single-use, compatible with any open-port holmium laser.',
    sourceId: FORTEC_SOURCE_ID,
    sourceLocation: 'ForTec Holmium Laser Fibers - Inter. Pulmonology product page',
    claimType: 'Fibre sizes, packaging, and compatibility',
    sizeDisplay: '272, 365, 550, 1000 µm',
    spec: {
      wavelength_nm: 2100,
      core_sizes_um: '272, 365, 550, 1000',
      compatibility: 'All open-port holmium lasers',
      lasing_medium: 'Ho:YAG',
    },
    notes:
      'The page describes the rounded tip as passing the working channel of a ureteroscope; the pulmonary claim on the page attaches to the Excalibur fibre above rather than to this one. Confirm the size against the bronchoscope channel actually in use.',
    verificationStatus:
      'Candidate - ForTec Medical mobile-service listing; no catalog number, FDA clearance, or UDI record is on file here.',
  },
]

/**
 * LISA bare fibres, emitted from the application matrix in the surgical-fibres brochure.
 *
 * Only the four families the matrix actually ticks for **Bronchoscopy** are listed. LithoFib,
 * SideFib, and the 800/1000 µm RigiFib sizes are not ticked and are not emitted — the
 * distinction is the whole reason to read the matrix rather than the product line. The
 * brochure qualifies the matrix as "clinical applications are recommendations only" and states
 * no wavelength anywhere, and the sibling reusable-fibre IFU is anatomy-free, so these are
 * candidate-grade despite the explicit bronchoscopy tick.
 */
const LISA_BRONCHOSCOPY_FIBRES: {
  catalogNumber: string
  name: string
  coreUm: number
  outerDiameterMm: number
  french: number
}[] = [
  {
    catalogNumber: '101 503 513',
    name: 'SureFib-SU',
    coreUm: 272,
    outerDiameterMm: 0.42,
    french: 1.3,
  },
  {
    catalogNumber: '101 503 387',
    name: 'FlexiFib-SU',
    coreUm: 272,
    outerDiameterMm: 0.42,
    french: 1.3,
  },
  {
    catalogNumber: '101 503 384',
    name: 'PercuFib-SU',
    coreUm: 365,
    outerDiameterMm: 0.73,
    french: 2.2,
  },
  {
    catalogNumber: '101 503 289',
    name: 'RigiFib-SU',
    coreUm: 550,
    outerDiameterMm: 0.75,
    french: 2.3,
  },
]

for (const fibre of LISA_BRONCHOSCOPY_FIBRES) {
  LASER_DEVICES.push({
    catalogNumber: fibre.catalogNumber,
    productName: `${fibre.name} Single-Use Laser Fibre, ${fibre.coreUm} µm`,
    manufacturerName: 'LISA Laser Products',
    brandFamily: 'LISA surgical laser fibres',
    roleCode: 'LASER_FIBER',
    primaryCategory: 'Laser',
    subcategory: 'Bare laser fibre',
    productKind: 'Single-use device',
    summary:
      'Single-use bare quartz fibre with a spherical GlideTip, sized to pass a flexible endoscope working channel.',
    sourceId: LISA_SOURCE_ID,
    sourceLocation: 'Surgical laser fibres brochure — application matrix',
    claimType: 'Order number, fibre dimensions, and ticked clinical applications',
    sizeDisplay: `${fibre.coreUm} µm core, ${fibre.outerDiameterMm} mm OD, ${fibre.french} Fr`,
    diameterMm: fibre.outerDiameterMm,
    spec: {
      optical_core_um: fibre.coreUm,
      outer_diameter_mm: fibre.outerDiameterMm,
      french_size: fibre.french,
      length_m: 2.5,
    },
    notes:
      'The brochure\u2019s application matrix ticks Bronchoscopy for this fibre family, and does not tick it for LithoFib, SideFib, or the 800 and 1000 µm RigiFib sizes. The matrix is qualified as "recommendations only". No laser type is recorded because a bare quartz fibre has no lasing medium of its own and the brochure states no wavelength for any of them — confirm compatibility against the console actually in the room.',
    verificationStatus:
      'Candidate - LISA Laser surgical fibres brochure; no per-SKU FDA UDI record was located for this order number.',
  })
}

LASER_DEVICES.push({
  catalogNumber: 'ACC-GFU-100',
  visibility: 'prototype_visible',
  verificationGrade: 'verified_source',
  productName: 'Gas Filter Unit (GFU)',
  manufacturerName: 'OmniGuide',
  brandFamily: 'BeamPath',
  roleCode: 'LASER_SAFETY_EQUIPMENT',
  primaryCategory: 'Laser',
  subcategory: 'Laser system gas filter',
  productKind: 'Single-use device',
  summary:
    'Filter unit for the purge gas that runs through the OmniGuide CO2 waveguide fibres; required for sterile-field gas delivery.',
  sourceId: OMNIGUIDE_INTELLIGUIDE_SOURCE_ID,
  sourceLocation: 'IntelliGuide IFU — gas connection section',
  claimType: 'Order number and required-accessory status',
  notes: 'Also printed as ACC-GFU-100-1 in the gas-connection section. Supplied as a box of 10.',
  verificationStatus:
    'Verified - OmniGuide IntelliGuide instructions for use; FDA UDI record lists ACC-GFU-100 in commercial distribution.',
})

/**
 * Photodynamic therapy, from the Tier-4 research report only.
 *
 * The regulatory identifiers below (NDA 20-451, PMA P990021/S005, PMA P940010/S011) are what
 * makes this cohort unusual: the report claims genuine FDA approvals, not designations. Those
 * claims are recorded on the regulatory axis with the approval numbers, and the products stay
 * hidden and candidate-grade because the evidence behind them is still a secondary report.
 */
const PDT_DIFFUSER_LENGTHS_CM = [1.0, 1.5, 2.0, 2.5, 3.0, 5.0]

const PDT_DEVICES: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'PHOTOFRIN (porfimer sodium) for Injection, 75 mg vial',
    manufacturerName: 'Pinnacle Biologics',
    brandFamily: 'PHOTOFRIN',
    roleCode: 'PHOTODYNAMIC_PHOTOSENSITIZER',
    primaryCategory: 'Photodynamic therapy',
    subcategory: 'Photosensitizer',
    productKind: 'Drug',
    summary:
      'Lyophilized photosensitizer given intravenously 40 to 50 hours before endobronchial light activation.',
    sourceId: PDT_REPORT_SOURCE_ID,
    sourceLocation: 'Bronchoscopic photodynamic therapy report — drug section',
    claimType: 'Presentation, reconstitution, and dose',
    sizeDisplay: '75 mg single-dose vial',
    spec: {
      reconstitution: '31.8 mL of 5% dextrose or 0.9% sodium chloride, giving 2.5 mg/mL',
      dose: '2 mg/kg IV over 3-5 minutes',
      light_activation_hours: '40-50',
    },
    notes:
      'Drug-as-line-item, following the same precedent as the talc vial. Prolonged cutaneous photosensitivity follows administration; the light-activation and debridement bronchoscopies are separate staged encounters.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; the report cites NDA 20-451 but no label or FDA record is on file here.',
  },
  {
    catalogNumber: 'BWF5-630-2-PI',
    productName: 'PHOTOFRIN 630 PDT Laser, Model BWF5-630-2-PI',
    manufacturerName: 'Pinnacle Biologics',
    brandFamily: 'PHOTOFRIN 630 PDT Laser',
    roleCode: 'PHOTODYNAMIC_LASER',
    primaryCategory: 'Photodynamic therapy',
    subcategory: 'PDT activation laser',
    productKind: 'Capital equipment',
    summary:
      'Activation laser for porfimer sodium, required to deliver stable output at 630 ± 3 nm.',
    sourceId: PDT_REPORT_SOURCE_ID,
    sourceLocation: 'Bronchoscopic photodynamic therapy report — laser section',
    claimType: 'Model designation and required output wavelength',
    spec: { output_wavelength_nm: '630 ± 3' },
    notes:
      'Not interchangeable with an arbitrary red laser. A unit emitting red light with different output characteristics can cause incomplete activation, overtreatment, normal-tissue injury, or fibre damage. Supersedes the DIOMED 630 PDT Laser Model T2USA.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; the report cites PMA supplement P990021/S005 but no FDA record is on file here.',
  },
]

for (const lengthCm of PDT_DIFFUSER_LENGTHS_CM) {
  PDT_DEVICES.push({
    catalogNumber: null,
    productName: `OPTIGUIDE Fiber Optic Diffuser, ${lengthCm.toFixed(1)} cm`,
    manufacturerName: 'Pinnacle Biologics',
    brandFamily: 'OPTIGUIDE',
    roleCode: 'PHOTODYNAMIC_DIFFUSER',
    primaryCategory: 'Photodynamic therapy',
    subcategory: 'Cylindrical light diffuser',
    productKind: 'Single-use device',
    summary:
      'Cylindrical diffuser fibre passed through the bronchoscope working channel to deliver the activation light along the length of the lesion.',
    sourceId: PDT_REPORT_SOURCE_ID,
    sourceLocation: 'Bronchoscopic photodynamic therapy report — diffuser section',
    claimType: 'Diffuser lengths and construction',
    sizeDisplay: `${lengthCm.toFixed(1)} cm diffuser`,
    lengthMm: lengthCm * 10,
    spec: {
      diffuser_length_cm: lengthCm,
      fiber_core_um: 400,
      connector: 'SMA-905',
      sterilization: 'Ethylene oxide, single use',
      labeled_fluence_j_per_cm: 200,
      labeled_delivery_seconds: 500,
      target_power_w: Number((lengthCm * 0.4).toFixed(1)),
    },
    notes:
      'Choose the diffuser length to cover the lesion while sparing normal mucosa; overlapping treatments can overdose normal bronchial mucosa. The report prints the original model designations only as the combined string "DCYL 10/15/25" and gives no per-model mapping, so no legacy model number is claimed here.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; the report cites PMA supplement P940010/S011 but no FDA record is on file here.',
  })
}

/**
 * The FDA Breakthrough Device cohort.
 *
 * Six devices, none of them with documented US marketing authorization. They exist in the
 * catalog so `/preference-cards/emerging` can name them and so the ablation card can point at
 * a real entry instead of a blank; the reviewed governance overlay gives each one
 * `slottingScope: 'not_applicable'`, which is what keeps them out of every role query, the
 * picker, and any saved card.
 *
 * Three carry a role — the two microwave systems and the pulsed-field one — because the
 * bronchoscopic-ablation card names those modalities as conditional slots that today have
 * nothing selectable in them. The other three answer no requirement the module has, and giving
 * them an invented role would be worse than leaving them role-less.
 */
const EMERGING_DEVICES: DocumentedDeviceDefinition[] = [
  {
    catalogNumber: null,
    productName: 'dNerva Lung Denervation System',
    manufacturerName: 'Nuvaira',
    brandFamily: 'dNerva',
    roleCode: null,
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Targeted lung denervation',
    productKind: 'Investigational device',
    summary:
      'Catheter-based one-time bronchoscopic procedure intended to disrupt pulmonary nerve input.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — dNerva profile',
    claimType: 'Device identity and regulatory status',
    notes:
      "Nuvaira's own clinical-evidence page states the device is not commercially available in the USA. No public FDA designation letter was located; the designation date comes from a company announcement.",
    verificationStatus:
      'Candidate - secondary AI-generated research report; investigational, no US marketing authorization identified.',
  },
  {
    catalogNumber: null,
    productName: 'RejuvenAir System',
    manufacturerName: 'CSA Medical',
    brandFamily: 'RejuvenAir',
    roleCode: null,
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Metered cryospray',
    productKind: 'Investigational device',
    summary:
      'Metered cryospray delivering −196 °C liquid nitrogen bronchoscopically to diseased airway mucosa.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — RejuvenAir profile',
    claimType: 'Device identity and regulatory status',
    notes:
      'A PMA submission was announced 2026-01-07; the device remains investigational and not commercially available in the United States. No public FDA designation letter was located.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; investigational, no US marketing authorization identified.',
  },
  {
    catalogNumber: null,
    productName: 'RheOx System',
    manufacturerName: 'Galvanize Therapeutics',
    brandFamily: 'RheOx',
    roleCode: 'PULSED_FIELD_ABLATION_SYSTEM',
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Bronchial rheoplasty',
    productKind: 'Investigational device',
    summary:
      'Generator and single-use catheter delivering short bursts of pulsed electric field energy for non-thermal ablation of mucus-producing airway cells.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — RheOx profile',
    claimType: 'Device identity and regulatory status',
    notes:
      "Under PMA review per the manufacturer's own pipeline page. No published FDA decision document or final PMA action was identified, and no public FDA designation letter was located.",
    verificationStatus:
      'Candidate - secondary AI-generated research report; company-stated PMA review, no confirmed US marketing authorization.',
  },
  {
    catalogNumber: null,
    productName: 'Monarch-enabled NeuWave Microwave Ablation Technology',
    manufacturerName: 'Ethicon',
    brandFamily: 'MONARCH + NEUWAVE',
    roleCode: 'MICROWAVE_ABLATION_CATHETER',
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Robotic bronchoscopic microwave ablation',
    productKind: 'Investigational device',
    summary:
      'Transbronchial microwave ablation delivered through the MONARCH robotic bronchoscopy platform, studied as the NEUWAVE FLEX system guided by MONARCH.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — Monarch/NeuWave profile',
    claimType: 'Device identity and regulatory status',
    notes:
      'Under development per the designation announcement. No FDA PMA, De Novo, or 510(k) decision was identified for this bronchoscopic ablation indication. The announcement is dated 2020-07-31 and describes an FDA action of 2020-07-30.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; under development, no US marketing authorization identified for this indication.',
  },
  {
    catalogNumber: null,
    productName: 'Emprint Ablation Catheter Kit',
    manufacturerName: 'Medtronic',
    brandFamily: 'Emprint',
    roleCode: 'MICROWAVE_ABLATION_CATHETER',
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Bronchoscopic microwave ablation catheter',
    productKind: 'Investigational device',
    summary:
      'Catheter kit intended for bronchoscopic microwave ablation of malignant lung lesions, used with the Emprint generator and a Medtronic lung navigation platform.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — Emprint profile',
    claimType: 'Device identity and regulatory status',
    notes:
      "Medtronic's own announcement states the kit is an investigational device, not approved or cleared in the United States and not available for sale there.",
    verificationStatus:
      'Candidate - secondary AI-generated research report; investigational, no US marketing authorization.',
  },
  {
    catalogNumber: null,
    productName: 'NIO Lung Cancer Reveal',
    manufacturerName: 'Invenio Imaging',
    brandFamily: 'NIO Laser Imaging System',
    roleCode: null,
    primaryCategory: 'Emerging bronchoscopic therapy',
    subcategory: 'Biopsy image analysis',
    productKind: 'Investigational device',
    summary:
      'Image-analysis module intended to assist evaluation of bronchoscopic lung forceps biopsies from fresh, unprocessed specimens.',
    sourceId: BREAKTHROUGH_REPORT_SOURCE_ID,
    sourceLocation: 'Breakthrough devices report — NIO Lung Cancer Reveal profile',
    claimType: 'Device identity and regulatory status',
    notes:
      'The company states its website claims have not been FDA-reviewed and that the product is not available for sale in all regions. Its own labeling says the output should not be used as the primary diagnosis.',
    verificationStatus:
      'Candidate - secondary AI-generated research report; no FDA authorization identified for this indication.',
  },
]

// --- emission --------------------------------------------------------------------------------

export interface TaxonomyV2Emission {
  products: AdditionRecord[]
  productRoles: AdditionRecord[]
  productSources: AdditionRecord[]
  manufacturers: AdditionRecord[]
  sources: AdditionRecord[]
  warnings: string[]
}

function documentedProductRecord(
  productId: string,
  manufacturerId: string,
  definition: DocumentedDeviceDefinition,
): AdditionRecord {
  return {
    product_id: productId,
    manufacturer_id: manufacturerId,
    manufacturer: definition.manufacturerName,
    // A service provider that is also the listed manufacturer is recorded once, not twice.
    distributor:
      definition.distributor && definition.distributor !== definition.manufacturerName
        ? definition.distributor
        : null,
    brand_family: definition.brandFamily,
    product_name: definition.productName,
    catalog_number: definition.catalogNumber,
    alternate_ids: null,
    gtin: null,
    primary_category: definition.primaryCategory,
    subcategory: definition.subcategory,
    product_kind: definition.productKind,
    reuse_status: null,
    sterile_status: null,
    implantable: false,
    material: null,
    coverage: null,
    laser_type: definition.laserType ?? null,
    placement_method: null,
    size_display: definition.sizeDisplay ?? null,
    diameter_mm: definition.diameterMm ?? null,
    length_mm: definition.lengthMm ?? null,
    french_size: null,
    gauge: null,
    working_length_cm: definition.workingLengthCm ?? null,
    min_working_channel_mm: null,
    delivery_system_od_mm: null,
    package_uom: 'Each',
    adult_peds: 'Adult',
    description: definition.summary,
    compatibility_text: null,
    verification_status: definition.verificationStatus,
    // Hidden, not omitted. These are real devices with real evidence gaps; the verification
    // workbench is where they belong until someone closes the gap.
    live_dropdown_status:
      definition.visibility === 'prototype_visible'
        ? 'Visible - GUDID in commercial distribution and manufacturer-listed'
        : 'Hidden - current U.S. status unverified',
    primary_source_id: definition.sourceId,
    primary_source_location: definition.sourceLocation,
    source_as_of: RESEARCH_AS_OF,
    availability_note:
      definition.availabilityNote ??
      (definition.visibility === 'prototype_visible'
        ? 'GUDID distribution status is not by itself proof of local orderability; confirm with your supply chain.'
        : NOT_UDI_LISTED_NOTE),
    notes: definition.notes ?? null,
    spec_json: definition.spec ?? null,
    global_part_number: null,
    reference_part_number: null,
    gtin_raw: null,
    spec_json_raw: null,
    visibility_state: definition.visibility ?? 'hidden',
    verification_grade: definition.verificationGrade ?? 'candidate',
  }
}

export function buildTaxonomyV2Additions(options: {
  gudid: GudidIndexEntry[]
  resolveManufacturerId: (name: string) => string
  /**
   * Identity key → product_id for everything already in the merged catalog.
   *
   * Watch the self-referential dedupe trap. `catalog-products.json` is the *merged* output, so
   * by the second run it already contains this generator's own previous additions. Skipping on
   * "is this key present?" therefore drops every row on run two and re-adds it on run three.
   * The test is whether the existing row is *someone else's*: ids are deterministic from the
   * natural key, so a row whose id equals the one this generator would produce is its own and
   * must still be emitted. Same reasoning as the Olympus scope loop.
   */
  existingProductIdsByKey: Map<string, string>
}): TaxonomyV2Emission {
  const { gudid, resolveManufacturerId, existingProductIdsByKey } = options

  const claimedByAnotherRow = (key: string, productId: string) => {
    const existing = existingProductIdsByKey.get(key)
    return existing !== undefined && existing !== productId
  }
  const products: AdditionRecord[] = []
  const productRoles: AdditionRecord[] = []
  const productSources: AdditionRecord[] = []
  const warnings: string[] = []

  const gudidByKey = new Map<string, GudidIndexEntry>()
  for (const entry of gudid) {
    for (const key of [entry.catalogNumber, entry.versionModelNumber]) {
      if (!key) continue
      const normalized = normalizeCatalogKey(key)
      if (!normalized) continue
      if (!gudidByKey.has(normalized)) gudidByKey.set(normalized, entry)
    }
  }

  const emitGudidDevice = (definition: GudidDeviceDefinition, manufacturerName: string) => {
    const entry = gudidByKey.get(normalizeCatalogKey(definition.lookup))
    if (!entry || !/^In Commercial Distribution$/i.test(entry.distributionStatus)) {
      warnings.push(
        `Skipping ${definition.productName}: ${definition.lookup} is not in commercial distribution in this GUDID release.`,
      )
      return
    }
    const productId = stableId('PRD', `${manufacturerName}|${entry.primaryDi}`)
    const catalogNumber = definition.catalogNumber ?? definition.lookup
    if (claimedByAnotherRow(catalogNumber.toUpperCase(), productId)) return

    const manufacturerId = resolveManufacturerId(manufacturerName)
    products.push(
      buildProductRecord({
        productId,
        manufacturerId,
        manufacturerName,
        brandFamily: definition.brandFamily,
        catalogNumber,
        productName: definition.productName,
        gudid: entry,
        primaryCategory: definition.primaryCategory,
        subcategory: definition.subcategory,
        productKind: definition.productKind,
        frenchSize: null,
        placementMethod: null,
        material: null,
        sizeDisplay: definition.sizeDisplay ?? null,
        diameterMm: definition.diameterMm ?? null,
        workingLengthCm: definition.workingLengthCm ?? null,
        minWorkingChannelMm: definition.minWorkingChannelMm ?? null,
        adultPeds: 'Adult',
        description: definition.summary,
        notes: definition.notes ?? null,
        sourceLocation: definition.sourceLocation,
        extraSpec: definition.spec,
      }),
    )
    productRoles.push({
      product_id: productId,
      role_code: definition.roleCode,
      role_fit: 'Primary',
      notes: null,
    })
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    if (definition.sourceId !== GUDID_SOURCE_ID) {
      productSources.push({
        product_id: productId,
        source_id: definition.sourceId,
        source_location: definition.sourceLocation,
        claim_type: definition.claimType,
        verification_status: 'Manufacturer document',
        notes: null,
      })
    }
  }

  for (const definition of ERBE_DEVICES) emitGudidDevice(definition, 'ERBE')
  for (const definition of PULMONX_DEVICES) emitGudidDevice(definition, 'Pulmonx')

  const documentedGroups: DocumentedDeviceDefinition[][] = [
    FORTEC_DEVICES,
    RICHARD_WOLF_MINI_THORACOSCOPY,
    KARL_STORZ_THORACOSCOPY,
    FLUOROSCOPY_SYSTEMS,
    NAVIGATION_SYSTEMS,
    PEF_DEVICES,
    LASER_DEVICES,
    PDT_DEVICES,
    EMERGING_DEVICES,
  ]

  for (const group of documentedGroups) {
    for (const definition of group) {
      const naturalKey = `${definition.manufacturerName}|${definition.catalogNumber ?? definition.productName}`
      const productId = stableId('PRD', naturalKey)
      // No catalog number for several of these, so identity falls back to the product name.
      const identityKey = (definition.catalogNumber ?? definition.productName).toUpperCase()
      if (claimedByAnotherRow(identityKey, productId)) continue
      const manufacturerId = resolveManufacturerId(definition.manufacturerName)
      products.push(documentedProductRecord(productId, manufacturerId, definition))
      if (definition.roleCode) {
        productRoles.push({
          product_id: productId,
          role_code: definition.roleCode,
          role_fit: 'Primary',
          notes: null,
        })
      }
      productSources.push({
        product_id: productId,
        source_id: definition.sourceId,
        source_location: definition.sourceLocation,
        claim_type: definition.claimType,
        verification_status:
          definition.sourceId === PDT_REPORT_SOURCE_ID ||
          definition.sourceId === BREAKTHROUGH_REPORT_SOURCE_ID
            ? TIER_4_NOTE
            : 'Manufacturer document; no FDA UDI record located',
        notes: null,
      })
    }
  }

  const manufacturerNames = [
    ...new Set(documentedGroups.flat().map((definition) => definition.manufacturerName)),
  ].sort()

  const manufacturers: AdditionRecord[] = manufacturerNames.map((name) => ({
    manufacturer_id: resolveManufacturerId(name),
    manufacturer: name,
    default_distributor: null,
    website: null,
    notes: `Added with the taxonomy-v2 energy, imaging, laser, photodynamic, and emerging-device cohorts.`,
  }))

  const sources: AdditionRecord[] = [
    {
      source_id: ERBE_VIO3_SOURCE_ID,
      title: 'ERBE VIO 3 — Precise. Reliable. Reproducible.',
      filename: 'Vio 3.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'Erbe Elektromedizin GmbH / Erbe USA Incorporated',
      revision_date: '2020-07',
      as_of_date: null,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for order numbers, generator technical data, and accessory configuration. The brochure carries no FDA statement — US distribution status comes from the FDA UDI database instead. It prints no order number for the APC 3 module and no APC probe data.',
      notes:
        'The VIO CART (20180-000), wire basket (20180-010), and fastening sets (20180-140/143/144) are printed here but have no FDA UDI record, so they are not emitted as products.',
    },
    {
      source_id: CHARTIS_IFU_SOURCE_ID,
      title: 'Chartis Pulmonary Assessment System Catheter — Instructions for Use',
      filename: 'IFU-Chartis-Pulmonary-Assessment-System-Catheter-100-0714-Revision-C.pdf',
      source_type: 'Manufacturer IFU',
      publisher: 'Pulmonx Corporation',
      revision_date: '2025-12-18',
      as_of_date: null,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for catheter working length, outer diameter, airway diameter range, and the minimum bronchoscope working-channel requirement. This is the CE-marked international IFU and contains no FDA statement of any kind; US distribution status comes from the FDA UDI database.',
      notes:
        'Only two catalog numbers appear anywhere in the document — CHR-CA-12.0 and CHR-CA-12.0-XL. The console and connector set are named as components with no order numbers. The XL has no FDA UDI record and is therefore not listed as a product.',
    },
    {
      source_id: RICHARD_WOLF_SOURCE_ID,
      title: 'Richard Wolf Mini-Thoracoscopy Set',
      filename: '2323-07.01-0624USA_Mini_Thoracoscopy_Set_SS.pdf',
      source_type: 'Manufacturer flyer',
      publisher: 'Richard Wolf Medical Instruments Corporation',
      revision_date: '2024-06',
      as_of_date: null,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for order numbers, instrument dimensions, and bundle contents. This is a sell sheet, not an IFU: it states no indications, contraindications, electrosurgical settings, or compatible generator. None of these order numbers matched an FDA UDI record, so every product from it is hidden pending verification.',
      notes:
        'Order numbers were read from both layout and non-layout text extraction and re-checked against a 450 dpi render. The non-layout extraction detaches the double-spoon forceps row from its number; do not build from it alone. 8919.3311 carries a four-digit suffix and is distinct from the UDI-listed 8919.331.',
    },
    {
      source_id: KARL_STORZ_SOURCE_ID,
      title: 'KARL STORZ online catalog — medical thoracoscopy, pleurodesis, and empyema pages',
      filename: 'Search - Pleurodesis _ KARL STORZ Endoskope _ Cyprus.pdf',
      source_type: 'Manufacturer ordering-page capture',
      publisher: 'KARL STORZ SE & Co. KG',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for article numbers and product names. These are filtered indication views, not complete instrument sets, and they are nested subsets of one 26072 family rather than three independent lists.',
      notes:
        'Four of the five thoracoscopy items on these pages are already carried by the workbook; only the optical dissection electrode was missing.',
    },
    {
      source_id: CIOS_SPIN_SOURCE_ID,
      title: 'Cios Spin mobile C-arm — Siemens Healthineers USA product page',
      filename: 'Mobile C-arm machine - Cios Spin - Siemens Healthineers USA.pdf',
      source_type: 'Manufacturer product page',
      publisher: 'Siemens Medical Solutions USA, Inc.',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Identity only. The page prints no catalog, order, part, GTIN, or UDI number and states no FDA clearance. Dose, detector, and image-quality claims are deliberately not recorded.',
      notes: null,
    },
    {
      source_id: OEC_3D_SOURCE_ID,
      title: 'OEC 3D — Precise. Efficient.',
      filename: 'OEC-3D_Brochure.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'GE OEC Medical Systems, Inc. (GE HealthCare)',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Identity only. No catalog, order, part, GTIN, or UDI number appears anywhere, and no FDA clearance is stated.',
      notes:
        'The string "JB02978XX(3)" on the final page is a GE marketing document-tracking code, not an ordering number.',
    },
    {
      source_id: ZIEHM_SOURCE_ID,
      title: 'Ziehm Vision RFD 3D — Exceptional clarity at minimum dose',
      filename: 'en_productbrochure_ziehmvisionrfd3d_rev10_02_2026.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'Ziehm Imaging GmbH',
      revision_date: '2026-02',
      as_of_date: null,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Identity only. No catalog, order, part, GTIN, or UDI number appears in the seventeen pages, and no FDA clearance is stated for the C-arm.',
      notes: null,
    },
    {
      source_id: LUNGVISION_SOURCE_ID,
      title: 'LungVision System — Body Vision Medical product page and MOSS brochure',
      filename: 'LungVision® System _ AI-Powered Lung Imaging Technology.pdf',
      source_type: 'Manufacturer product page',
      publisher: 'Body Vision Medical Inc.',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Identity and intended use only. Neither document prints an order number, model designation, or UDI for any component, and neither states an FDA clearance number.',
      notes: null,
    },
    {
      source_id: ALIYA_SOURCE_ID,
      title: 'Aliya System — Galvanize Therapeutics product page',
      filename: 'Aliya System – Galvanize.pdf',
      source_type: 'Manufacturer product page',
      publisher: 'Galvanize Therapeutics, Inc.',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for device identity and the manufacturer’s own 510(k) indication wording. The page prints no catalog number and no 510(k) number; the visible MKG-codes are literature control numbers, not SKUs.',
      notes:
        'The manufacturer states the EX Generator, PEF System, and INUMI Flex Needle are 510(k) cleared for surgical ablation of soft tissue and does not promote an airway indication.',
    },
    {
      source_id: FORTEC_SOURCE_ID,
      title: 'ForTec Medical Interventional Pulmonology laser line — product pages and sheets',
      filename: 'neoV Laser – Pulmonology - ForTec Medical.pdf',
      source_type: 'Manufacturer product page',
      publisher: 'ForTec Medical',
      revision_date: null,
      as_of_date: '2026-07-30',
      reliability_tier: 'Tier 1 - manufacturer/distributor',
      use_policy:
        'Use for system identity, wavelengths, power ranges, and the fact that the device is obtainable as a mobile service. ForTec is a service provider, not the manufacturer of most of these platforms, and its Interventional Pulmonology categorization is a statement about what it will bring to a case rather than about what the device is cleared to do. Where the underlying product sheet names a different specialty — BPH for EVOLVE, ENT and gynaecology for OmniGuide, urology for the SmartScope fibre — the sheet is recorded on the product and the gap is left visible.',
      notes:
        'Covers the KTP/YAG dual-wavelength system, the Quanta Holmium console, the neoV 1470 nm diode, the EVOLVE 180 W 980 nm diode, and the Excalibur and SmartScope holmium fibres. The neoV page is the only one written for bronchoscopy; the Excalibur page states pulmonary use directly.',
    },
    {
      source_id: LASERSCOPE_510K_SOURCE_ID,
      title:
        'FDA 510(k) K972575 — Laserscope KTP/Nd:YAG Surgical Laser Systems (800 and Orion Series)',
      filename: 'K972575.pdf',
      source_type: 'FDA/NLM UDI database snapshot',
      publisher: 'U.S. Food and Drug Administration',
      revision_date: '1998-07-17',
      as_of_date: null,
      reliability_tier: 'Tier 1 - regulatory device identity',
      use_policy:
        'Records what the KTP/Nd:YAG platform is actually cleared for, which is BPH and nothing else: "intended for use in cutting, coagulating and vaporizing prostatic tissues during treatment of benign prostatic hyperplasia". Use it to bound the airway claim rather than to support one. It also confirms the physics recorded on the product: ablation and haemostasis at the Nd:YAG 1064 nm wavelength, vaporization at the KTP 532 nm wavelength, KTP being a frequency-doubling crystal rather than a lasing medium of its own.',
      notes:
        'Cleared 1998-07-17. The device is classified by the OB/GYN, General Plastic Surgery, and ENT panels, so other clearances exist for the platform; this one does not cover the airway.',
    },
    {
      source_id: OMNIGUIDE_INTELLIGUIDE_SOURCE_ID,
      title: 'OmniGuide BeamPath FELS-25A CO2 Laser with IntelliGuide — Instructions for Use',
      filename: 'INTELLIGUIDE-IFU.pdf',
      source_type: 'Manufacturer IFU',
      publisher: 'OmniGuide, Inc.',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for console identity, configurations, wavelength, and the airway operating limits the manual publishes. Note the gap the manual itself leaves: its cleared Indications for Use enumerate twelve specialties and pulmonology is not among them, while its warnings and user settings instruct on airway use directly. Record both; do not resolve the tension by inference.',
      notes:
        'The CO2 laser engine is an A.R.C. Laser C-LAS built for OmniGuide. Also the source for the ACC-GFU-100 gas filter unit.',
    },
    {
      source_id: OMNIGUIDE_VELOCITY_SOURCE_ID,
      title: 'OmniGuide VELOCITY High Performance Fiber — Instructions for Use',
      filename: 'VELOCITY-Fiber-IFU.pdf',
      source_type: 'Manufacturer IFU',
      publisher: 'OmniGuide, Inc.',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for the airway-specific settings it publishes — paediatric airway 30 psi at 10 W or less, adult glottic and subglottic 50 psi, oxygen at or below 25%, laser-safe endotracheal tube, and not below the carina. Its Section II specialty list does not include pulmonology, bronchoscopy, or thoracic surgery; the airway instruction is in the warnings and user settings.',
      notes: null,
    },
    {
      source_id: OMNIGUIDE_510K_SOURCE_ID,
      title: 'FDA 510(k) K070157 — OmniGuide BeamPath CO2 Mark III Waveguide Fiber',
      filename: 'K070157.pdf',
      source_type: 'FDA/NLM UDI database snapshot',
      publisher: 'U.S. Food and Drug Administration',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - regulatory device identity',
      use_policy:
        'The cleanest regulatory citation for airway use of a CO2 waveguide fibre in this set: the Indications for Use name pulmonology explicitly, in both the 510(k) summary and the FDA-stamped enclosure. It prints no catalog number, so none may be attached to it.',
      notes: null,
    },
    {
      source_id: BIOLITEC_SOURCE_ID,
      title: 'biolitec LEONARDO surgical laser brochure',
      filename: 'Leonardo-Brochure.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'biolitec biomedical technology GmbH / CeramOptec GmbH',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for model identity, wavelengths, power, and the family indication list, which names "Lung metastases and bronchial tumors" explicitly. The LEONARDO DUAL 100 appears here but has no FDA UDI record and is therefore not listed as a product.',
      notes:
        'The legal manufacturer on the labels is CeramOptec GmbH, which is also the FDA UDI labeler; the brand is biolitec.',
    },
    {
      source_id: LISA_SOURCE_ID,
      title: 'LISA Laser Products surgical laser fibres brochure and RevoLix jr. brochure',
      filename: 'SurgicalLaserFibresBrochure_en.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'LISA Laser Products GmbH',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use the fibres brochure\u2019s application matrix, which ticks Bronchoscopy for the SureFib, FlexiFib, PercuFib, and RigiFib families and does not tick it for LithoFib, SideFib, or the 800 and 1000 µm RigiFib sizes. The brochure qualifies the matrix as "clinical applications are recommendations only" and states no wavelength for any fibre, so nothing here establishes console compatibility.',
      notes:
        'The RevoLix jr. brochure carries a Pneumology block reading "Bronchoscopy / Airway recanalization / Desobstruction / Tissue coagulation". LISA is a wholly owned subsidiary of OmniGuide Holdings.',
    },
    {
      source_id: QUANTA_SOURCE_ID,
      title: 'Quanta System Opera EVO brochure',
      filename: 'quanta-opera-evo_16026793233801.pdf',
      source_type: 'Manufacturer brochure',
      publisher: 'Quanta System S.p.A. (EL.En. Group)',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 1 - manufacturer',
      use_policy:
        'Use for system identity, wavelengths, and the Thoracic Surgery application panel, which names "Endoscopic airway treatment" and "Lung resection". The brochure prints no catalog number and its first page states it is not intended for all markets, so confirm US availability and indication separately.',
      notes: null,
    },
    {
      source_id: PDT_REPORT_SOURCE_ID,
      title: 'Bronchoscopic photodynamic therapy — secondary research report',
      filename: 'deep-research-report PDT.md',
      source_type: 'Secondary AI-generated report',
      publisher: 'Compiled for this project',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 4 - secondary / verification required',
      use_policy:
        'Discovery only; no product should be promoted to a live dropdown from this source alone. The NDA and PMA numbers it cites are recorded on the regulatory axis as reported, not as verified FDA records.',
      notes:
        'Covers PHOTOFRIN (porfimer sodium), the PHOTOFRIN 630 PDT laser, and the OPTIGUIDE diffuser family, plus the staged drug/light/debridement workflow timings.',
    },
    {
      source_id: BREAKTHROUGH_REPORT_SOURCE_ID,
      title: 'FDA Breakthrough Devices in bronchoscopy and interventional pulmonology',
      filename: 'deep-research-report breakthrough devices.md',
      source_type: 'Secondary AI-generated report',
      publisher: 'Compiled for this project',
      revision_date: null,
      as_of_date: RESEARCH_AS_OF,
      reliability_tier: 'Tier 4 - secondary / verification required',
      use_policy:
        'Discovery only. Every designation date, status, and identifier must be re-verified against FDA PMA, 510(k), and De Novo records before any clinical or catalog use. The report states that for several devices the designation date comes from a company announcement rather than a public FDA letter.',
      notes:
        'The report contains no catalog, model, or UDI number for any of the seven devices; the only regulatory identifier in it is the Zephyr PMA number. Its "seven" is what one search surfaced, not an FDA enumeration.',
    },
  ]

  return { products, productRoles, productSources, manufacturers, sources, warnings }
}
