import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { normalizeCatalogKey, type GudidIndexEntry } from './build-gudid-index'
import { stableId } from './catalog-utils'
import {
  buildProductRecord,
  GUDID_RELEASE_DATE,
  GUDID_SOURCE_ID,
  type AdditionRecord,
} from './catalog-addition-records'
import { buildTaxonomyV2Additions } from './catalog-additions-taxonomy-v2'
import { buildBrochureIntakeAdditions } from './catalog-additions-brochure-intake'
import { formatJson } from './format-json'

/**
 * Builds the curated catalog additions the workbook does not carry: the Getinge/Atrium
 * thoracic drainage line and the FUJIFILM bronchoscope range.
 *
 * Every field is copied from its governed evidence: FDA GUDID records where available, or a
 * reviewed authoritative manufacturer document for exact brochure-intake identities. The latter
 * remain hidden and make no current-distribution claim.
 *
 *   npx tsx scripts/ip-preference-cards/build-catalog-additions.ts
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const SEED_DIRECTORY = 'data/ip-preference-cards/seed'

const MANUFACTURER_NAME = 'Atrium Medical (Getinge)'
const FUJIFILM_MANUFACTURER_NAME = 'FUJIFILM'
const GETINGE_SOURCE_ID = 'SRC047'
const FUJIFILM_SOURCE_ID = 'SRC048'
const TELEFLEX_MANUFACTURER_NAME = 'Teleflex'
const AURIS_MANUFACTURER_NAME = 'Auris Health (Johnson & Johnson)'
const NOAH_MANUFACTURER_NAME = 'Noah Medical'
const PORTEX_SOURCE_ID = 'SRC052'
const FUJIFILM_EUS_SOURCE_ID = 'SRC050'
const FUJIFILM_PULM_SOURCE_ID = 'SRC051'
const ICU_MEDICAL_MANUFACTURER_NAME = 'ICU Medical'
const BIVONA_COMPANY_KEY = 'Bivona (ICU Medical)'
const BIVONA_SOURCE_ID = 'SRC049'

/**
 * Physical sanity check on a transcribed tube row.
 *
 * PDF table extraction can merge two ordering rows into one, which leaves a plausible-looking
 * record carrying another row's numbers. These are dimensions a clinician would read off a
 * card, so a row that cannot be physically true is dropped and reported rather than emitted:
 * a wrong outer diameter is a real safety problem, and a missing tube is a visible gap.
 */
function bivonaRowProblem(tube: BivonaTube): string | null {
  if (!(tube.innerDiameterMm > 0) || tube.innerDiameterMm > 12) {
    return `inner diameter ${tube.innerDiameterMm} mm is outside the tracheostomy range`
  }
  if (tube.tubeSizeMm > 12) {
    return `tube size ${tube.tubeSizeMm} looks like a product code, not a size`
  }
  if (tube.outerDiameterMm !== null && tube.outerDiameterMm <= tube.innerDiameterMm) {
    return `outer diameter ${tube.outerDiameterMm} mm is not larger than the inner diameter ${tube.innerDiameterMm} mm`
  }
  if (tube.tubeLengthMm !== null && tube.tubeLengthMm < 25) {
    return `tube length ${tube.tubeLengthMm} mm is shorter than any catalogued tracheostomy tube`
  }
  return null
}

interface OlympusScopeDefinition {
  /** GUDID version/model string, which is how Olympus scopes are identified in the release. */
  gudidModel: string
  /** The ordering number clinicians use. */
  catalogNumber: string
  productName: string
  brandFamily: string
  roleCode: string
  distalMm: number | null
  insertionMm: number | null
  channelMm: number | null
  workingLengthCm: number | null
  fieldOfViewDeg: number | null
  summary: string
  /** Where the dimensions came from, recorded on the product row. */
  specSource: 'olympus-page' | 'gudid-description' | 'none'
}

/**
 * Olympus bronchoscopes.
 *
 * Olympus files these under opaque SKUs (`N3828922`) or no catalog number at all, with the
 * recognisable model buried in the version/model string as `OLYMPUS BF TYPE Q180`. Products
 * are therefore matched to GUDID on that model string, while `catalog_number` carries the
 * `BF-…` designation a clinician would actually say. `buildProductRecord` keeps the GUDID
 * model on `global_part_number`, which is what `gudid-confirm` joins on — so the
 * "Not currently distributed" badge lights up on its own for the discontinued models.
 *
 * Unlike every other addition, this list **includes models GUDID reports as no longer in
 * commercial distribution**. A preference card records what is in the room, not what is
 * orderable, and plenty of units still run a BF-1T180. They are badged, never hidden.
 *
 * Dimensions marked `olympus-page` come from the Olympus America product page for that model;
 * `gudid-description` ones are parsed from the FDA device record's own description text
 * (e.g. "BF-P180 VIDEOSCOPE 4.9MM DIA 2.0MM CH"). Channel sizes for the 190 series were
 * cross-checked against the Olympus Bronchoscope Compatibility Chart.
 */
const OLYMPUS_SCOPES: OlympusScopeDefinition[] = [
  // --- EVIS X1 -----------------------------------------------------------------------------
  {
    gudidModel: 'OLYMPUS BF-H1100',
    catalogNumber: 'BF-H1100',
    productName: 'BF-H1100 Video Bronchoscope',
    brandFamily: 'EVIS X1',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: 4.9,
    insertionMm: null,
    channelMm: 2.2,
    workingLengthCm: 60,
    fieldOfViewDeg: null,
    summary:
      'EVIS X1 diagnostic bronchoscope taking the distal end below 5 mm while keeping native HDTV imaging and a 2.2 mm instrument channel.',
    specSource: 'olympus-page',
  },
  {
    gudidModel: 'OLYMPUS BF-1TH1100',
    catalogNumber: 'BF-1TH1100',
    productName: 'BF-1TH1100 Video Bronchoscope',
    brandFamily: 'EVIS X1',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalMm: 5.8,
    insertionMm: null,
    channelMm: 3.0,
    workingLengthCm: 60,
    fieldOfViewDeg: null,
    summary:
      'EVIS X1 therapeutic bronchoscope pairing a reduced distal end with a 3.0 mm instrument channel and native HDTV imaging.',
    specSource: 'olympus-page',
  },
  // --- EVIS EXERA III ----------------------------------------------------------------------
  {
    gudidModel: 'OLYMPUS BF-Q190',
    catalogNumber: 'BF-Q190',
    productName: 'BF-Q190 Video Bronchoscope',
    brandFamily: 'EVIS EXERA III',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: 4.8,
    insertionMm: 4.9,
    channelMm: 2.0,
    workingLengthCm: 60,
    fieldOfViewDeg: 120,
    summary:
      'Standard diagnostic bronchoscope with a 2.0 mm instrument channel, 210 degrees of upward angulation, and the insertion-tube rotation function.',
    specSource: 'olympus-page',
  },
  {
    gudidModel: 'OLYMPUS BF-XT190',
    catalogNumber: 'BF-XT190',
    productName: 'BF-XT190 Video Bronchoscope',
    brandFamily: 'EVIS EXERA III',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalMm: 6.1,
    insertionMm: 6.3,
    channelMm: 3.2,
    workingLengthCm: 60,
    fieldOfViewDeg: 110,
    summary:
      'Therapeutic bronchoscope with a 3.2 mm working channel for smoke evacuation during electrocautery and secretion removal, with the insertion-tube rotation function.',
    specSource: 'olympus-page',
  },
  // --- EVIS EXERA II -----------------------------------------------------------------------
  {
    gudidModel: 'OLYMPUS BF TYPE Q180',
    catalogNumber: 'BF-Q180',
    productName: 'BF-Q180 Video Bronchoscope',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: 5.1,
    insertionMm: null,
    channelMm: 2.0,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Standard slim diagnostic bronchoscope with a 2.0 mm instrument channel.',
    specSource: 'gudid-description',
  },
  {
    gudidModel: 'OLYMPUS BF TYPE Q180-AC',
    catalogNumber: 'BF-Q180-AC',
    productName: 'BF-Q180-AC Video Bronchoscope, Autoclavable',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: 5.3,
    insertionMm: null,
    channelMm: 2.0,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Autoclavable variant of the BF-Q180, with a 2.0 mm instrument channel.',
    specSource: 'gudid-description',
  },
  {
    gudidModel: 'OLYPUS BF TYPE P180',
    catalogNumber: 'BF-P180',
    productName: 'BF-P180 Video Bronchoscope',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: 4.9,
    insertionMm: null,
    channelMm: 2.0,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Slim diagnostic bronchoscope with a 2.0 mm instrument channel.',
    specSource: 'gudid-description',
  },
  {
    gudidModel: 'OLYMPUS BF TYPE 1T180',
    catalogNumber: 'BF-1T180',
    productName: 'BF-1T180 Video Bronchoscope',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalMm: 6.0,
    insertionMm: null,
    channelMm: 3.0,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Large-channel therapeutic bronchoscope with a 3.0 mm instrument channel.',
    specSource: 'gudid-description',
  },
  {
    gudidModel: 'OLYMPUS BF TYPE 1TQ180',
    catalogNumber: 'BF-1TQ180',
    productName: 'BF-1TQ180 Video Bronchoscope',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalMm: 6.2,
    insertionMm: null,
    channelMm: 2.8,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Therapeutic bronchoscope with a wide 2.8 mm instrument channel.',
    specSource: 'gudid-description',
  },
  {
    gudidModel: 'OLYMPUS BF TYPE UC180F',
    catalogNumber: 'BF-UC180F',
    productName: 'BF-UC180F Ultrasound Bronchofibervideoscope',
    brandFamily: 'EVIS EXERA II',
    roleCode: 'EBUS_SCOPE',
    distalMm: null,
    insertionMm: null,
    channelMm: 2.2,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary:
      'Previous-generation convex EBUS bronchoscope with a 2.2 mm instrument channel; the predecessor to the BF-UC190F.',
    specSource: 'olympus-page',
  },
  // --- EVIS EXERA --------------------------------------------------------------------------
  {
    gudidModel: 'OLYMPUS BF TYPE XT160',
    catalogNumber: 'BF-XT160',
    productName: 'BF-XT160 Video Bronchoscope',
    brandFamily: 'EVIS EXERA',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalMm: 6.2,
    insertionMm: null,
    channelMm: 3.2,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary: 'Therapeutic bronchoscope with a 3.2 mm instrument channel.',
    specSource: 'gudid-description',
  },
  // --- Fiberscope --------------------------------------------------------------------------
  {
    gudidModel: 'BF-PE2',
    catalogNumber: 'BF-PE2',
    productName: 'BF-PE2 Bronchofiberscope',
    brandFamily: 'Olympus Bronchofiberscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalMm: null,
    insertionMm: null,
    channelMm: null,
    workingLengthCm: null,
    fieldOfViewDeg: null,
    summary:
      'Slim diagnostic bronchofiberscope. Listed in the FDA UDI database; no manufacturer document was available, so no dimensions are recorded.',
    specSource: 'none',
  },
]

interface RoboticDeviceDefinition {
  companyKey: string
  /** GUDID version/model number, which is the only stable identifier these labelers publish. */
  model: string
  productName: string
  brandFamily: string
  roleCode: string
  roleNote: string
  subcategory: string
  productKind: string
  summary: string
}

/**
 * Robotic bronchoscopy platforms and their single-use consumables.
 *
 * Everything here is confirmed from the FDA UDI database alone — no manufacturer brochure was
 * supplied, so identity, model number, and distribution status are claimed and nothing else.
 * No dimensions, channel sizes, or working lengths are asserted.
 *
 * Roles follow the Ion and superDimension/ILLUMISITE precedent already in the catalog:
 * the platform, its scope, patches, and introducer kits are `GUIDING_DEVICE`; needles,
 * forceps, and brushes take their own roles.
 *
 * Deliberately excluded: Auris `MUR-*` (ureteroscopy — a different specialty entirely),
 * `Version *` records (tower software releases, not devices), refurbished `-RFB`/`-R`/`GALRB`
 * configurations and the `GALRB-HK` regional variant (procurement options, not card lines),
 * the `MON-000005-01` tower upgrade SKU, and the Monarch fluidics tubing and bronchoscope /
 * sheath valves, which have no role to reach them.
 */
const ROBOTIC_DEVICES: RoboticDeviceDefinition[] = [
  // --- Auris Health / Monarch -------------------------------------------------------------
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000008',
    productName: 'Monarch Platform, Bronchoscopy 4.1',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Robotic bronchoscopy platform; current bronchoscopy configuration.',
    subcategory: 'Robotic bronchoscopy navigation platform',
    productKind: 'Reusable capital equipment',
    summary:
      'Robotic bronchoscopy platform providing electro-mechanical articulation and precise control of a flexible bronchoscope under continuous direct physician control. Bronchoscopy 4.1 configuration.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000006',
    productName: 'Monarch Bronchoscope 2.0 / Monarch Platform (P2)',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Robotic bronchoscopy platform; P2 generation.',
    subcategory: 'Robotic bronchoscopy navigation platform',
    productKind: 'Reusable capital equipment',
    summary:
      'Robotic bronchoscopy platform providing electro-mechanical articulation and precise control of a flexible bronchoscope under continuous direct physician control. P2 generation.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON000005',
    productName: 'Monarch Endoscopy Platform (P1)',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Robotic bronchoscopy platform; earliest P1 generation.',
    subcategory: 'Robotic bronchoscopy navigation platform',
    productKind: 'Reusable capital equipment',
    summary:
      'Robotic endoscopy platform providing electro-mechanical articulation and precise control of a flexible endoscope. P1 generation.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000007',
    productName: 'Monarch Tower, Cart, and Fluidics Pump',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Platform tower, cart, and fluidics pump.',
    subcategory: 'Robotic bronchoscopy platform hardware',
    productKind: 'Reusable capital equipment',
    summary: 'Monarch platform tower, cart, and fluidics pump.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000712',
    productName: 'Monarch Endoscopy Controller',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Physician controller for the Monarch platform.',
    subcategory: 'Robotic bronchoscopy platform hardware',
    productKind: 'Reusable capital equipment',
    summary: 'Hand controller used by the physician to drive the Monarch bronchoscope.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000709',
    productName: 'Monarch Window Field Generator and Supplies',
    brandFamily: 'Monarch Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Electromagnetic field generator for navigation.',
    subcategory: 'Robotic bronchoscopy platform hardware',
    productKind: 'Reusable capital equipment',
    summary: 'Electromagnetic field generator and supplies supporting Monarch navigation.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000705',
    productName: 'Monarch Reusable Navigation Sensors',
    brandFamily: 'Monarch Platform Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Reusable navigation sensors.',
    subcategory: 'Robotic bronchoscopy platform hardware',
    productKind: 'Reusable instrument',
    summary: 'Reusable electromagnetic navigation sensors for the Monarch platform.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MON-000713',
    productName: 'Monarch Extended Patient Introducer Mount',
    brandFamily: 'Monarch Platform Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Extended patient introducer mount.',
    subcategory: 'Robotic bronchoscopy platform hardware',
    productKind: 'Reusable instrument',
    summary: 'Extended mount for the Monarch patient introducer.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000011',
    productName: 'Monarch Bronchoscope System',
    brandFamily: 'Monarch Bronchoscope',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Single-use robotic bronchoscope and sheath system.',
    subcategory: 'Robotic bronchoscope',
    productKind: 'Single-use device',
    summary: 'Single-use Monarch bronchoscope and sheath system driven by the Monarch platform.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000211-A',
    productName: 'Monarch Bronchoscope',
    brandFamily: 'Monarch Bronchoscope',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Single-use robotic bronchoscope.',
    subcategory: 'Robotic bronchoscope',
    productKind: 'Single-use device',
    summary: 'Single-use Monarch bronchoscope driven by the Monarch platform.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000211-B',
    productName: 'Monarch Bronchoscope, Reprocessed',
    brandFamily: 'Monarch Bronchoscope (Reprocessed)',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Reprocessed robotic bronchoscope.',
    subcategory: 'Robotic bronchoscope',
    productKind: 'Reprocessed device',
    summary: 'Reprocessed Monarch bronchoscope driven by the Monarch platform.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000017',
    productName: 'Monarch Bronchoscope Patient Introducer Kit',
    brandFamily: 'Monarch Procedure Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Patient introducer kit for the Monarch bronchoscope.',
    subcategory: 'Robotic bronchoscopy accessory',
    productKind: 'Single-use device',
    summary: 'Patient introducer kit used to admit the Monarch bronchoscope to the airway.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000016',
    productName: 'Monarch Navigation Patient Patches (60)',
    brandFamily: 'Monarch Procedure Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Electromagnetic navigation patient patches, 60 per pack.',
    subcategory: 'Robotic bronchoscopy accessory',
    productKind: 'Single-use device',
    summary: 'Electromagnetic navigation patient patches for the Monarch platform, 60 per pack.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000012',
    productName: 'Monarch Aspirating Biopsy Needle',
    brandFamily: 'Monarch Sampling Tools',
    roleCode: 'TBNA_NEEDLE',
    roleNote: 'Aspirating biopsy needle for the Monarch bronchoscope.',
    subcategory: 'Transbronchial aspiration needle',
    productKind: 'Single-use device',
    summary: 'Aspirating biopsy needle passed through the Monarch bronchoscope.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000014',
    productName: 'Monarch Biopsy Forceps, Smooth Cup',
    brandFamily: 'Monarch Sampling Tools',
    roleCode: 'BIOPSY_FORCEPS_FLEX',
    roleNote: 'Smooth-cup biopsy forceps for the Monarch bronchoscope.',
    subcategory: 'Flexible biopsy forceps',
    productKind: 'Single-use device',
    summary: 'Smooth-cup biopsy forceps passed through the Monarch bronchoscope.',
  },
  {
    companyKey: 'Auris Health (Johnson & Johnson)',
    model: 'MBR-000015',
    productName: 'Monarch Cytology Brush',
    brandFamily: 'Monarch Sampling Tools',
    roleCode: 'CYTOLOGY_BRUSH',
    roleNote: 'Cytology brush for the Monarch bronchoscope.',
    subcategory: 'Pulmonary cytology brush',
    productKind: 'Single-use device',
    summary: 'Cytology brush passed through the Monarch bronchoscope.',
  },

  // --- Noah Medical / Galaxy --------------------------------------------------------------
  {
    companyKey: 'Noah Medical',
    model: 'GAL-001',
    productName: 'Galaxy System',
    brandFamily: 'Galaxy Platform',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Robotic bronchoscopy platform with tomosynthesis-based target correction.',
    subcategory: 'Robotic bronchoscopy navigation platform',
    productKind: 'Reusable capital equipment',
    summary:
      'Robotic bronchoscopy platform providing articulation and precise control of a single-use bronchoscope, with navigation integrating a pre-operative CT and a tomosynthesis spin that updates scope and target position to correct for anatomy not reflected in the pre-op scan.',
  },
  {
    companyKey: 'Noah Medical',
    model: '10000769',
    productName: 'Galaxy Bronchoscope',
    brandFamily: 'Galaxy Bronchoscope',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Single-use bronchoscope for the Galaxy platform.',
    subcategory: 'Robotic bronchoscope',
    productKind: 'Single-use device',
    summary:
      'Single-use bronchoscope driven by the Galaxy System, providing visualization of the patient airways for diagnostic procedures.',
  },
  {
    companyKey: 'Noah Medical',
    model: '10000307',
    productName: 'Galaxy Bronchoscope Guide',
    brandFamily: 'Galaxy Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Scope guide for the Galaxy bronchoscope.',
    subcategory: 'Robotic bronchoscopy accessory',
    productKind: 'Single-use device',
    summary: 'Scope guide used with the Galaxy bronchoscope.',
  },
  {
    companyKey: 'Noah Medical',
    model: '10000339',
    productName: 'Galaxy Bronchoscope Connector',
    brandFamily: 'Galaxy Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Connector between the Galaxy bronchoscope and the platform.',
    subcategory: 'Robotic bronchoscopy accessory',
    productKind: 'Single-use device',
    summary: 'Connector joining the Galaxy bronchoscope to the Galaxy System.',
  },
  {
    companyKey: 'Noah Medical',
    model: '10000799',
    productName: 'Galaxy System Accessory Kit',
    brandFamily: 'Galaxy Accessories',
    roleCode: 'GUIDING_DEVICE',
    roleNote: 'Accessory kit for the Galaxy platform.',
    subcategory: 'Robotic bronchoscopy accessory',
    productKind: 'Single-use device',
    summary: 'Accessory kit supplied for Galaxy System procedures.',
  },
]

/** One transcribed row of the Portex BLUselect ordering tables. */
interface PortexTube {
  productCode: string
  family: string
  roleCode: string
  population: string
  cuffType: 'cuffed' | 'cuffless'
  fenestrated: boolean
  subglotticSuction: boolean
  tubeSizeMm: number
  innerDiameterMm: number
  outerDiameterMm: number
  tubeLengthMm: number
}

/** One transcribed row of the Bivona catalogue ordering tables. */
interface BivonaTube {
  productCode: string
  family: string
  population: string
  cuffType: 'cuffed' | 'cuffless'
  tts: boolean
  fenestrated: boolean
  tubeSizeMm: number
  innerDiameterMm: number
  outerDiameterMm: number | null
  tubeLengthMm: number | null
  tubeAngleDegrees: number | null
  cuffRestingDiameterMm: number | null
}

interface DrainDefinition {
  primaryDi: string
  productName: string
  sealTechnology: string
  adultPeds: string
  sourceLocation: string
  notes: string
}

/**
 * Chest drainage units, keyed by GUDID Primary DI. Names and part numbers were confirmed
 * against the Getinge US thoracic drainage product pages; the Ordering Information tables
 * there publish the same model numbers GUDID carries.
 */
const DRAIN_DEFINITIONS: DrainDefinition[] = [
  {
    primaryDi: '00650862110012',
    productName: 'Atrium Oasis Dry Suction Water Seal Chest Drain',
    sealTechnology: 'Dry suction regulation with calibrated water seal',
    adultPeds: 'Adult',
    sourceLocation: 'Oasis dry suction water seal chest drain — Ordering Information',
    notes:
      'Single collection, 1 patient tube (part 3600-100). Suction adjustable -10 to -40 cmH2O, preset -20 cmH2O. Water seal requires the supplied sterile water.',
  },
  {
    primaryDi: '00650862110098',
    productName: 'Atrium Oasis Dry Suction Water Seal Chest Drain, Tyvek Package',
    sealTechnology: 'Dry suction regulation with calibrated water seal',
    adultPeds: 'Adult',
    sourceLocation: 'Oasis dry suction water seal chest drain',
    notes: 'Single collection with in-line connector, Tyvek packaging (part 3600-130).',
  },
  {
    primaryDi: '00650862111019',
    productName: 'Atrium Oasis Infant/Pediatric Dry Suction Water Seal Chest Drain',
    sealTechnology: 'Dry suction regulation with calibrated water seal',
    adultPeds: 'Pediatric',
    sourceLocation: 'Oasis dry suction water seal chest drain — Ordering Information',
    notes:
      'Infant/pediatric collection with 1/4 in tubing and pediatric connectors (part 3612-100).',
  },
  {
    primaryDi: '00650862115130',
    productName: 'Atrium Express Dry Seal Chest Drain',
    sealTechnology: 'Dry suction regulation with dry seal one-way valve',
    adultPeds: 'Adult',
    sourceLocation: 'Express dry seal chest drain — Ordering Information',
    notes:
      'Single collection, 1 patient tube (part 4000-100N). Needs no water to function; sterile water may be added for air-leak detection. Suction -10 to -40 cmH2O, preset -20 cmH2O.',
  },
  {
    primaryDi: '00650862164008',
    productName: 'Atrium Express Mini 500 Mobile Dry Seal Chest Drain',
    sealTechnology: 'Dry seal one-way valve, mobile/ambulatory',
    adultPeds: 'Adult',
    sourceLocation: 'Express Mini 500 mobile dry seal drain',
    notes: 'Single collection mobile dry seal drain (part 16400) for ambulatory drainage.',
  },
  {
    primaryDi: '00650862100327',
    productName: 'Atrium Ocean Water Seal Chest Drain',
    sealTechnology: 'Wet suction control with water seal',
    adultPeds: 'Adult',
    sourceLocation: 'AccessGUDID device record',
    notes:
      'Single collection with in-line connector and autotransfusion capability (part 2002-057). Listed in GUDID as in commercial distribution; not shown on the current Getinge US thoracic drainage landing page, so confirm orderability locally.',
  },
]

interface ScopeDefinition {
  /** GUDID catalog/model number, which is also the FUJIFILM model name. */
  model: string
  productName: string
  roleCode: string
  distalEndMm: number | null
  insertionTubeMm: number | null
  channelMm: number | null
  workingLengthCm: number | null
  summary: string
  /** True when the specs come from the supplied FUJIFILM catalog rather than GUDID alone. */
  specsFromCatalog: boolean
}

/**
 * FUJIFILM bronchoscopes. Specs are transcribed from the supplied FUJIFILM bronchoscope
 * catalog; identity and distribution status come from GUDID. Models the catalog shows but
 * GUDID does not list (EB-530XT) are deliberately absent — the same in-commercial-
 * distribution rule the drains follow.
 */
const FUJIFILM_SCOPES: ScopeDefinition[] = [
  {
    model: 'EB-580S',
    productName: 'FUJIFILM EB-580S Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: 5.3,
    insertionTubeMm: 5.1,
    channelMm: 2.2,
    workingLengthCm: 60,
    summary:
      'High-resolution standard bronchoscope with 210 degrees of upward bending and a 2.2 mm instrument channel.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-580T',
    productName: 'FUJIFILM EB-580T Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalEndMm: 5.8,
    insertionTubeMm: 5.9,
    channelMm: 2.8,
    workingLengthCm: 60,
    summary: 'High-resolution treatment-type bronchoscope with a 2.8 mm instrument channel.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-530S',
    productName: 'FUJIFILM EB-530S Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: 4.9,
    insertionTubeMm: 4.9,
    channelMm: 2.0,
    workingLengthCm: 60,
    summary: 'Standard bronchoscope with a slim 4.9 mm distal end and a 2.0 mm instrument channel.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-530H',
    productName: 'FUJIFILM EB-530H Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: 5.4,
    insertionTubeMm: null,
    channelMm: 2.0,
    workingLengthCm: 60,
    summary: 'Standard bronchoscope with a wide-angle image and a 2.0 mm instrument channel.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-530P',
    productName: 'FUJIFILM EB-530P Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: 3.8,
    insertionTubeMm: null,
    channelMm: 1.2,
    workingLengthCm: 60,
    summary: 'Slim bronchoscope with a 3.8 mm distal end and a 1.2 mm instrument channel.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-530T',
    productName: 'FUJIFILM EB-530T Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalEndMm: 5.8,
    insertionTubeMm: 5.9,
    channelMm: 2.8,
    workingLengthCm: 60,
    summary:
      'Treatment-type bronchoscope with a 2.8 mm instrument channel and a 5.8 mm distal end.',
    specsFromCatalog: true,
  },
  {
    model: 'EB-530US',
    productName: 'FUJIFILM EB-530US Ultrasonic Bronchoscope',
    roleCode: 'EBUS_SCOPE',
    distalEndMm: 6.7,
    insertionTubeMm: 6.3,
    channelMm: 2.0,
    workingLengthCm: 61,
    summary:
      'Convex EBUS bronchoscope with a 10 degree forward-oblique view and a 2.0 mm instrument channel.',
    specsFromCatalog: true,
  },
  // Registered in GUDID but absent from the supplied catalog, so identity only — no specs.
  {
    model: 'EB-710P',
    productName: 'FUJIFILM EB-710P Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: null,
    insertionTubeMm: null,
    channelMm: null,
    workingLengthCm: null,
    summary: 'Bronchoscope registered in the FDA UDI database; specifications not yet transcribed.',
    specsFromCatalog: false,
  },
  {
    model: 'EB-710XT',
    productName: 'FUJIFILM EB-710XT Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_THERAPEUTIC',
    distalEndMm: null,
    insertionTubeMm: null,
    channelMm: null,
    workingLengthCm: null,
    summary: 'Bronchoscope registered in the FDA UDI database; specifications not yet transcribed.',
    specsFromCatalog: false,
  },
  {
    model: 'EB-710US',
    productName: 'FUJIFILM EB-710US Ultrasonic Bronchoscope',
    roleCode: 'EBUS_SCOPE',
    distalEndMm: null,
    insertionTubeMm: null,
    channelMm: null,
    workingLengthCm: null,
    summary:
      'EBUS bronchoscope registered in the FDA UDI database; specifications not yet transcribed.',
    specsFromCatalog: false,
  },
  {
    model: 'EB-470P',
    productName: 'FUJIFILM EB-470P Video Bronchoscope',
    roleCode: 'FLEX_SCOPE_DIAGNOSTIC',
    distalEndMm: null,
    insertionTubeMm: null,
    channelMm: null,
    workingLengthCm: null,
    summary: 'Bronchoscope registered in the FDA UDI database; specifications not yet transcribed.',
    specsFromCatalog: false,
  },
]

interface FujifilmSystemDefinition {
  /** GUDID catalog/model number, matched after collapsing whitespace. */
  model: string
  /** Commercial ordering number, when GUDID records a configuration-specific model instead. */
  catalogNumber?: string
  alternateIds?: string | null
  productName: string
  /** Groups the boxes of one platform into a single product line in the explorer. */
  brandFamily: string
  roleCode: string
  roleNote: string
  primaryCategory: string
  subcategory: string
  summary: string
  sizeDisplay: string | null
  diameterMm?: number | null
  workingLengthCm?: number | null
  spec: Record<string, unknown>
  /** Null when GUDID is the only source and no manufacturer document describes the device. */
  brochure: { sourceId: string; location: string } | null
}

/**
 * FUJIFILM ultrasound processors, radial-probe hardware, and video processors / light
 * sources, from the supplied FUJIFILM EUS brochure (03/2025) and EndoSolutions for
 * Pulmonology catalog (2023). Identity and distribution status come from GUDID, on the same
 * in-commercial-distribution rule everything else follows.
 *
 * Deliberately absent: the ARIETTA 850 FF ENDO. It is in commercial distribution, but its
 * applicable-endoscope table lists only the EG-series gastroscopes — it does not drive the
 * EB-530US bronchoscope — so it does not belong to an interventional pulmonology use.
 */
const FUJIFILM_SYSTEMS: FujifilmSystemDefinition[] = [
  {
    model: 'SU-1 FV652A',
    catalogNumber: 'SU-1',
    alternateIds: 'SU-1 FV667A',
    productName: 'FUJIFILM SONART SU-1 Endoscopic Ultrasonic Processor',
    brandFamily: 'SONART',
    roleCode: 'ULTRASOUND_PROCESSOR',
    roleNote: 'Drives the EB-530US convex EBUS bronchoscope for EBUS-TBNA.',
    primaryCategory: 'Ultrasound platform',
    subcategory: 'Ultrasound processor',
    summary:
      'Endoscopic ultrasonic processor for the EB-530US convex EBUS bronchoscope, with high-resolution B-mode, elastography, contrast harmonic imaging, and picture-in-picture endoscopic/ultrasound display.',
    sizeDisplay: '390 x 135 x 485 mm; 13.0 kg',
    spec: {
      power_supply: 'AC 100-240 V, 50/60 Hz, 2.0-1.2 A',
      dimensions_mm: '390 x 135 x 485',
      weight_kg: 13.0,
      scanning_method: 'Electronic scanning',
      probe_types: 'Curved linear array / radial',
      frequencies_mhz: [5, 7.5, 10, 12],
      scanning_modes: 'B, M, CD, PD, PW, THI, CH, F-FLOW',
      special_modes: 'Elastography / CHI',
      compatible_bronchoscope: 'EB-530US',
    },
    brochure: {
      sourceId: 'SRC051',
      location: 'p. 27, SU-1 Endoscopic Ultrasonic Processor specifications',
    },
  },
  {
    model: 'SU-1 PLATINUM FV651A',
    catalogNumber: 'SU-1 PLATINUM',
    alternateIds: 'SU-1 PLATINUM FV666A',
    productName: 'FUJIFILM SONART SU-1 PLATINUM Endoscopic Ultrasonic Processor',
    brandFamily: 'SONART',
    roleCode: 'ULTRASOUND_PROCESSOR',
    roleNote: 'Higher-tier SONART ultrasonic processor.',
    primaryCategory: 'Ultrasound platform',
    subcategory: 'Ultrasound processor',
    summary:
      'Higher-tier SONART endoscopic ultrasonic processor. Listed in the FDA UDI database; the supplied FUJIFILM brochures specify the SU-1 only, so no dimensions or imaging modes are claimed here.',
    sizeDisplay: null,
    spec: {},
    brochure: null,
  },
  {
    model: 'ARIETTA 750',
    productName: 'FUJIFILM ARIETTA 750 FF ENDO Diagnostic Ultrasound System',
    brandFamily: 'ARIETTA FF ENDO',
    roleCode: 'ULTRASOUND_PROCESSOR',
    roleNote:
      'Cart-based ultrasound system; its curved linear array endoscope list includes the EB-530US.',
    primaryCategory: 'Ultrasound platform',
    subcategory: 'Ultrasound processor',
    summary:
      'High-end cart-based diagnostic ultrasound system for endoscopic ultrasound, with eFocusing transmission, Carving Imaging, real-time tissue elastography, and detective flow imaging. Its curved linear array endoscope list includes the EB-530US bronchoscope.',
    sizeDisplay: '550 x 900 x 1,220-1,695 mm; 145 kg',
    spec: {
      power_supply: 'AC 200-240 V, 50/60 Hz, 1300 VA or less',
      dimensions_mm: '550 x 900 x 1,220-1,695',
      weight_kg: 145,
      applicable_endoscopes_curved_linear: 'EG-740UT, EG-580UT, EB-530US',
      applicable_endoscopes_radial: 'EG-580UR',
    },
    brochure: {
      sourceId: 'SRC050',
      location: 'p. 18, ARIETTA 750 FF ENDO Diagnostic Ultrasound System',
    },
  },
  {
    model: 'SP-900',
    productName: 'FUJIFILM SP-900 Ultrasonic Processor',
    brandFamily: 'SP-900 Mini Probe System',
    roleCode: 'RADIAL_EBUS_DRIVE_UNIT',
    roleNote: 'Drives the PB2020-M2 radial mini probe for peripheral lesion localisation.',
    primaryCategory: 'Ultrasound platform',
    subcategory: 'Radial probe drive unit',
    summary:
      'Compact mechanical-radial ultrasonic processor for the FUJIFILM mini probe system, usable stand-alone or as part of a larger endoscopy stack. Penetration depth 20 mm or more.',
    sizeDisplay: '377 x 80 x 480 mm; 8.0 kg',
    spec: {
      power_supply: 'AC 100-240 V, 50/60 Hz, 0.7-0.5 A',
      dimensions_mm: '377 x 80 x 480',
      weight_kg: 8.0,
      scanning_mode: 'B mode',
      scanning_method: 'Mechanical radial',
      penetration_depth_mm: '20 or more',
      compatible_probe: 'PB2020-M2',
    },
    brochure: { sourceId: 'SRC051', location: 'p. 28, SP-900 Ultrasonic Processor' },
  },
  {
    model: 'PB2020-M2',
    productName: 'FUJIFILM PB2020-M2 Ultrasonic Probe for Bronchoscopy',
    brandFamily: 'SP-900 Mini Probe System',
    roleCode: 'RADIAL_EBUS_PROBE',
    roleNote: '20 MHz radial mini probe, 1.4-1.9 mm outer diameter.',
    primaryCategory: 'Ultrasound platform',
    subcategory: 'Radial EBUS mini probe',
    summary:
      '20 MHz radial ultrasonic mini probe for bronchoscopy, for approaching and confirming peripheral pulmonary lesions.',
    sizeDisplay: '20.0 MHz; OD 1.4-1.9 mm; working length 2,150 mm',
    diameterMm: 1.9,
    workingLengthCm: 215,
    spec: {
      frequency_mhz: 20.0,
      outer_diameter_mm: '1.4-1.9',
      working_length_mm: 2150,
      compatible_processor: 'SP-900',
    },
    brochure: { sourceId: 'SRC051', location: 'p. 28, PB2020-M2 Probe for Bronchoscopy' },
  },
  {
    model: 'VP-7000',
    productName: 'FUJIFILM ELUXEO VP-7000 Video Processor',
    brandFamily: 'ELUXEO 7000',
    roleCode: 'VIDEO_PROCESSOR',
    roleNote: 'Video processor for the 700 and 500 series bronchoscopes.',
    primaryCategory: 'Bronchoscopy platform',
    subcategory: 'Video processor',
    summary:
      'High-performance video processor for the FUJIFILM 700 and 500 series bronchoscopes, supporting the 4-LED Multi Light illumination system with LCI and BLI visualisation modes. DICOM compatible.',
    sizeDisplay: '390 x 110 x 485 mm; 9.0 kg',
    spec: {
      power_supply: 'AC 100-240 V, 50/60 Hz, 0.8-0.5 A',
      dimensions_mm: '390 x 110 x 485',
      weight_kg: 9.0,
      compatible_bronchoscopes: '700 / 500 series',
      output: 'DVI-D x2, DVI-I x1, HD-SDI x2, RGB-TV x1, S VIDEO x1, VIDEO x1',
    },
    brochure: { sourceId: 'SRC051', location: 'p. 31, VP-7000 ELUXEO video processor' },
  },
  {
    model: 'BL-7000',
    productName: 'FUJIFILM ELUXEO BL-7000 4-LED Light Source',
    brandFamily: 'ELUXEO 7000',
    roleCode: 'VIDEO_PROCESSOR',
    roleNote: 'Light source paired with the VP-7000 video processor.',
    primaryCategory: 'Bronchoscopy platform',
    subcategory: 'Light source',
    summary:
      '4-LED Multi Light source for the ELUXEO 7000 system, with an integrated air supply pump and a rated 10,000-hour average LED life expectancy. Class 1 LED product.',
    sizeDisplay: '390 x 155 x 485 mm; 12.0 kg',
    spec: {
      light_source: '4-LED',
      air_supply_pump: 'High, Mid, Low, Off',
      power_supply: 'AC 100-240 V, 50/60 Hz, 1.2-0.7 A',
      dimensions_mm: '390 x 155 x 485',
      weight_kg: 12.0,
      optical_radiation_safety: 'Class 1 LED product',
    },
    brochure: { sourceId: 'SRC051', location: 'p. 31, BL-7000 ELUXEO 4-LED light source' },
  },
  {
    model: 'EP-6000',
    productName: 'FUJIFILM ELUXEO Lite EP-6000 Video Processor with LED Light Source',
    brandFamily: 'ELUXEO Lite 6000',
    roleCode: 'VIDEO_PROCESSOR',
    roleNote: 'Single-box video processor and light source for the 700 and 500 series.',
    primaryCategory: 'Bronchoscopy platform',
    subcategory: 'Video processor with integrated light source',
    summary:
      'Combined 3-LED light source and video processor in one box, compatible with the FUJIFILM 700 and 500 series bronchoscopes. LCI and BLI are available with the EB-710P and EB-580S. DICOM compatible.',
    sizeDisplay: '395 x 210 x 485 mm; 15.0 kg',
    spec: {
      light_source: '3-LED',
      air_supply_pump: 'High, Mid, Low, Off',
      power_supply: 'AC 100-240 V, 50/60 Hz, 2.0-1.1 A',
      dimensions_mm: '395 x 210 x 485',
      weight_kg: 15.0,
      compatible_bronchoscopes: '700 / 500 series',
      optical_radiation_safety: 'Class 1 LED product',
    },
    brochure: { sourceId: 'SRC051', location: 'p. 32, EP-6000 ELUXEO Lite video processor' },
  },
]

/** "20 FR Straight – Firm PVC Catheter" → structured fields. */
const CATHETER_DESCRIPTION = /^(\d+)\s*FR\s+(Straight|Right Angle)\s*[–-]\s*(Soft|Firm)\s+PVC/i

async function main() {
  const gudid = JSON.parse(
    await readFile(path.join(GENERATED_DIRECTORY, 'gudid-index.json'), 'utf8'),
  ) as GudidIndexEntry[]

  // Reuse the workbook's manufacturer id when the name already exists, so a vendor that is
  // partly in the workbook and partly here stays one group in the explorer.
  const existingManufacturers = JSON.parse(
    await readFile(path.join(GENERATED_DIRECTORY, 'manufacturers.json'), 'utf8'),
  ) as { manufacturer_id: string; manufacturer: string }[]
  const manufacturerIdByName = new Map(
    existingManufacturers.map((row) => [
      row.manufacturer.trim().toLowerCase(),
      row.manufacturer_id,
    ]),
  )
  const resolveManufacturerId = (name: string) =>
    manufacturerIdByName.get(name.trim().toLowerCase()) ?? stableId('MFR', name)
  // Manufacturers are always declared with their resolved id; mergeCatalogAdditions skips
  // any that the workbook already defines, so this stays correct on a from-scratch rebuild.

  const atrium = gudid.filter(
    (entry) =>
      entry.companyKey === 'Atrium Medical (Getinge)' &&
      /^In Commercial Distribution$/i.test(entry.distributionStatus),
  )
  const byDi = new Map(atrium.map((entry) => [entry.primaryDi, entry]))

  const manufacturerId = resolveManufacturerId(MANUFACTURER_NAME)
  const products: AdditionRecord[] = []
  const productRoles: AdditionRecord[] = []
  const productSources: AdditionRecord[] = []

  const addRole = (productId: string, roleCode: string, roleFit: string, notes: string) => {
    productRoles.push({ product_id: productId, role_code: roleCode, role_fit: roleFit, notes })
  }
  const addSources = (productId: string, gudidEntry: GudidIndexEntry, getingeLocation: string) => {
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${gudidEntry.primaryDi}`,
      claim_type: 'Device identity and distribution status',
      verification_status: `GUDID "${gudidEntry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    productSources.push({
      product_id: productId,
      source_id: GETINGE_SOURCE_ID,
      source_location: getingeLocation,
      claim_type: 'Product family, configuration, and part number',
      verification_status: 'Manufacturer product page',
      notes: null,
    })
  }

  // Chest drainage units.
  for (const definition of DRAIN_DEFINITIONS) {
    const entry = byDi.get(definition.primaryDi)
    if (!entry) {
      console.warn(
        `Skipping ${definition.productName}: DI ${definition.primaryDi} is not in commercial distribution in this GUDID release.`,
      )
      continue
    }
    const productId = stableId('PRD', `${MANUFACTURER_NAME}|${definition.primaryDi}`)
    products.push(
      buildProductRecord({
        productId,
        manufacturerId,
        productName: definition.productName,
        gudid: entry,
        primaryCategory: 'Pleural procedures',
        subcategory: 'Chest drainage unit',
        productKind: 'Single-use device',
        frenchSize: null,
        placementMethod: null,
        material: null,
        sizeDisplay: definition.sealTechnology,
        adultPeds: definition.adultPeds,
        description: `${definition.productName}. ${definition.sealTechnology}.`,
        notes: definition.notes,
        sourceLocation: definition.sourceLocation,
      }),
    )
    addRole(
      productId,
      'GENERIC_DRAINAGE_UNIT',
      'Primary',
      `Non-digital chest drainage unit — ${definition.sealTechnology.toLowerCase()}.`,
    )
    addSources(productId, entry, definition.sourceLocation)
  }

  // Thoracic catheters (chest tubes).
  for (const entry of atrium.filter((candidate) =>
    /PVC Thoracic Catheters/i.test(candidate.brandName),
  )) {
    const match = CATHETER_DESCRIPTION.exec(entry.description)
    if (!match) continue
    const frenchSize = Number(match[1])
    const geometry = /right/i.test(match[2]) ? 'Right angle' : 'Straight'
    const stiffness = match[3].toLowerCase() === 'soft' ? 'Soft' : 'Firm'
    const productId = stableId('PRD', `${MANUFACTURER_NAME}|${entry.primaryDi}`)

    products.push(
      buildProductRecord({
        productId,
        manufacturerId,
        productName: `Atrium ${stiffness} PVC Thoracic Catheter, ${frenchSize} Fr ${geometry}`,
        gudid: entry,
        primaryCategory: 'Pleural procedures',
        subcategory: 'Surgical thoracic catheter',
        productKind: 'Single-use device',
        frenchSize,
        placementMethod: geometry,
        material: `${stiffness} PVC`,
        sizeDisplay: `${frenchSize} Fr ${geometry.toLowerCase()}`,
        adultPeds: frenchSize <= 12 ? 'Adult and pediatric' : 'Adult',
        description: entry.description,
        notes:
          'DEHP-free, not made with natural rubber latex. Blue radiopaque stripe and 2 cm depth markings per the manufacturer product page.',
        sourceLocation: 'Soft and firm PVC thoracic catheters',
      }),
    )

    addRole(
      productId,
      'CHEST_TUBE_SURGICAL',
      'Primary',
      `${frenchSize} Fr ${geometry.toLowerCase()} ${stiffness.toLowerCase()} PVC thoracic catheter.`,
    )
    // Bore-size roles follow the usual small- vs large-bore split used elsewhere in the catalog.
    if (frenchSize <= 14) {
      addRole(
        productId,
        'CHEST_TUBE_SMALL_BORE',
        'Compatible',
        `${frenchSize} Fr thoracic catheter.`,
      )
    } else {
      addRole(
        productId,
        'CHEST_TUBE_LARGE_BORE',
        'Compatible',
        `${frenchSize} Fr thoracic catheter.`,
      )
    }
    addSources(productId, entry, 'Soft and firm PVC thoracic catheters')
  }

  // FUJIFILM bronchoscopes.
  const fujifilmManufacturerId = resolveManufacturerId(FUJIFILM_MANUFACTURER_NAME)
  const fujifilmByModel = new Map(
    gudid
      .filter(
        (entry) =>
          entry.companyKey === 'FUJIFILM' &&
          /^In Commercial Distribution$/i.test(entry.distributionStatus),
      )
      .map((entry) => [(entry.catalogNumber || entry.versionModelNumber).toUpperCase(), entry]),
  )

  for (const scope of FUJIFILM_SCOPES) {
    const entry = fujifilmByModel.get(scope.model.toUpperCase())
    if (!entry) {
      console.warn(
        `Skipping ${scope.model}: not listed in commercial distribution in this GUDID release.`,
      )
      continue
    }
    const productId = stableId('PRD', `${FUJIFILM_MANUFACTURER_NAME}|${entry.primaryDi}`)
    const sizeParts = [
      scope.distalEndMm ? `distal ${scope.distalEndMm} mm` : null,
      scope.channelMm ? `channel ${scope.channelMm} mm` : null,
      scope.workingLengthCm ? `working length ${scope.workingLengthCm} cm` : null,
    ].filter(Boolean)

    products.push(
      buildProductRecord({
        productId,
        manufacturerId: fujifilmManufacturerId,
        manufacturerName: FUJIFILM_MANUFACTURER_NAME,
        productName: scope.productName,
        gudid: entry,
        primaryCategory: 'Bronchoscopy platform',
        subcategory:
          scope.roleCode === 'EBUS_SCOPE' ? 'EBUS bronchoscope' : 'Flexible video bronchoscope',
        productKind: 'Reusable instrument',
        frenchSize: null,
        placementMethod: null,
        material: null,
        sizeDisplay: sizeParts.length > 0 ? sizeParts.join('; ') : null,
        adultPeds: 'Adult',
        description: scope.summary,
        diameterMm: scope.distalEndMm,
        minWorkingChannelMm: scope.channelMm,
        workingLengthCm: scope.workingLengthCm,
        notes: scope.specsFromCatalog
          ? 'Dimensions transcribed from the FUJIFILM bronchoscope catalog.'
          : 'Listed in the FDA UDI database; dimensions not yet transcribed from a manufacturer catalog.',
        sourceLocation: scope.specsFromCatalog
          ? `FUJIFILM bronchoscope catalog — ${scope.model} specifications`
          : 'AccessGUDID device record',
      }),
    )
    addRole(
      productId,
      scope.roleCode,
      'Primary',
      scope.channelMm ? `${scope.channelMm} mm instrument channel.` : 'FUJIFILM bronchoscope.',
    )
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    if (scope.specsFromCatalog) {
      productSources.push({
        product_id: productId,
        source_id: FUJIFILM_SOURCE_ID,
        source_location: `${scope.model} specifications`,
        claim_type: 'Dimensions and optical specifications',
        verification_status: 'Manufacturer catalog',
        notes: null,
      })
    }
  }

  // Teleflex Pleur-evac thoracic drainage. Classified from the GUDID brand and description;
  // no manufacturer catalog was supplied, so nothing beyond identity is asserted.
  const teleflexManufacturerId = resolveManufacturerId(TELEFLEX_MANUFACTURER_NAME)
  const pleurEvacByCatalog = new Map<string, GudidIndexEntry>()
  for (const entry of gudid) {
    if (!/pleur.?evac/i.test(entry.brandName)) continue
    if (!/^In Commercial Distribution$/i.test(entry.distributionStatus)) continue
    if (!entry.catalogNumber) continue
    if (!pleurEvacByCatalog.has(entry.catalogNumber)) {
      pleurEvacByCatalog.set(entry.catalogNumber, entry)
    }
  }

  /** Seal and suction mechanism, read from the GUDID description wording. */
  function sealTechnologyFor(description: string): string | null {
    const text = description.toUpperCase()
    if (/DRY\s*SUC\w*\s*\/?\s*DRY\s*SEAL|DRY SUCTION\/DRY SEAL/.test(text)) {
      return 'Dry suction control with dry seal'
    }
    if (/DRY\s*\/\s*?WET|DRY\/WET/.test(text)) return 'Dry suction control with water seal'
    if (/\bWET\b/.test(text)) return 'Wet suction control with water seal'
    return null
  }

  const CATHETER_PREFIXES: Record<string, string> = {
    DSTC: 'Straight',
    DRAC: 'Right angle',
    DTRC: 'Trocar',
  }

  for (const [catalogNumber, entry] of [...pleurEvacByCatalog.entries()].sort()) {
    const description = entry.description
    const prefix = catalogNumber.split('-')[0].toUpperCase()
    const productId = stableId('PRD', `${TELEFLEX_MANUFACTURER_NAME}|${entry.primaryDi}`)

    if (CATHETER_PREFIXES[prefix]) {
      const french = /(\d+)\s*FRENCH/i.exec(description)
      if (!french) continue
      const frenchSize = Number(french[1])
      const geometry = CATHETER_PREFIXES[prefix]
      products.push(
        buildProductRecord({
          productId,
          manufacturerId: teleflexManufacturerId,
          manufacturerName: TELEFLEX_MANUFACTURER_NAME,
          productName: `Pleur-evac Thoracic Catheter, ${frenchSize} Fr ${geometry}`,
          gudid: entry,
          primaryCategory: 'Pleural procedures',
          subcategory: 'Surgical thoracic catheter',
          productKind: 'Single-use device',
          frenchSize,
          placementMethod: geometry,
          material: 'Soft PVC',
          sizeDisplay: `${frenchSize} Fr ${geometry.toLowerCase()}`,
          adultPeds: frenchSize <= 12 ? 'Adult and pediatric' : 'Adult',
          description,
          notes: null,
          sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
        }),
      )
      addRole(
        productId,
        'CHEST_TUBE_SURGICAL',
        'Primary',
        `${frenchSize} Fr ${geometry.toLowerCase()} thoracic catheter.`,
      )
      addRole(
        productId,
        frenchSize <= 14 ? 'CHEST_TUBE_SMALL_BORE' : 'CHEST_TUBE_LARGE_BORE',
        'Compatible',
        `${frenchSize} Fr thoracic catheter.`,
      )
    } else {
      const seal = sealTechnologyFor(description)
      // Bags, tubing, and connectors are drainage accessories, not collection systems.
      const isAccessory =
        /CONNECTOR|TUBING|TUBE|PLUG|BAG|TRANSFER/i.test(description) || /^PE10/i.test(catalogNumber)
      const roleCode = isAccessory ? 'PLEURAL_DRAINAGE_ACCESSORY' : 'GENERIC_DRAINAGE_UNIT'
      if (!isAccessory && !seal) continue

      const readable = description
        .replace(/PLEUR-?\s?EVAC/i, '')
        .replace(/LATEX FREE|\bLF\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
      products.push(
        buildProductRecord({
          productId,
          manufacturerId: teleflexManufacturerId,
          manufacturerName: TELEFLEX_MANUFACTURER_NAME,
          productName: `Pleur-evac ${readable || catalogNumber}`,
          gudid: entry,
          primaryCategory: 'Pleural procedures',
          subcategory: isAccessory ? 'Chest drainage accessory' : 'Chest drainage unit',
          productKind: 'Single-use device',
          frenchSize: null,
          placementMethod: null,
          material: null,
          sizeDisplay: seal,
          adultPeds: /INFANT/i.test(description)
            ? 'Pediatric'
            : /ADULT-?PED/i.test(description)
              ? 'Adult and pediatric'
              : 'Adult',
          description,
          notes: 'Latex free. Classified from the FDA UDI device description.',
          sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
        }),
      )
      addRole(
        productId,
        roleCode,
        'Primary',
        seal
          ? `Non-digital chest drainage unit — ${seal.toLowerCase()}.`
          : 'Chest drainage accessory.',
      )
    }

    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, configuration, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
  }

  // --- FUJIFILM ultrasound and video platforms --------------------------------------------
  //
  // GUDID records a configuration-specific model for some of these ("SU-1 FV652A"), so the
  // lookup collapses whitespace and the commercial ordering number is set explicitly.
  const collapse = (value: string) => value.replace(/\s+/g, ' ').trim().toUpperCase()
  const fujifilmByCollapsedModel = new Map(
    gudid
      .filter(
        (entry) =>
          entry.companyKey === 'FUJIFILM' &&
          /^In Commercial Distribution$/i.test(entry.distributionStatus),
      )
      .map((entry) => [collapse(entry.catalogNumber || entry.versionModelNumber), entry]),
  )

  for (const system of FUJIFILM_SYSTEMS) {
    const entry = fujifilmByCollapsedModel.get(collapse(system.model))
    if (!entry) {
      console.warn(
        `Skipping ${system.model}: not listed in commercial distribution in this GUDID release.`,
      )
      continue
    }
    const productId = stableId('PRD', `${FUJIFILM_MANUFACTURER_NAME}|${entry.primaryDi}`)
    products.push(
      buildProductRecord({
        productId,
        manufacturerId: fujifilmManufacturerId,
        manufacturerName: FUJIFILM_MANUFACTURER_NAME,
        brandFamily: system.brandFamily,
        catalogNumber: system.catalogNumber,
        alternateIds: system.alternateIds ?? null,
        productName: system.productName,
        gudid: entry,
        primaryCategory: system.primaryCategory,
        subcategory: system.subcategory,
        productKind:
          system.roleCode === 'RADIAL_EBUS_PROBE'
            ? 'Reusable instrument'
            : 'Reusable capital equipment',
        frenchSize: null,
        placementMethod: null,
        material: null,
        sizeDisplay: system.sizeDisplay,
        diameterMm: system.diameterMm ?? null,
        workingLengthCm: system.workingLengthCm ?? null,
        adultPeds: 'Adult',
        description: system.summary,
        notes: system.brochure
          ? 'Specifications transcribed from the supplied FUJIFILM brochure.'
          : 'Listed in the FDA UDI database; no supplied manufacturer document specifies this model, so no dimensions or imaging modes are claimed.',
        sourceLocation: system.brochure?.location ?? 'AccessGUDID device record',
        extraSpec: system.spec,
      }),
    )
    addRole(productId, system.roleCode, 'Primary', system.roleNote)
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, GTIN, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    if (system.brochure) {
      productSources.push({
        product_id: productId,
        source_id: system.brochure.sourceId,
        source_location: system.brochure.location,
        claim_type: 'Specifications, compatibility, and product naming',
        verification_status: 'Transcribed from the manufacturer brochure',
        notes: null,
      })
    }
  }

  // --- Olympus bronchoscopes ---------------------------------------------------------------
  const olympusManufacturerId = resolveManufacturerId('Olympus')
  // Matched on the version/model string, not the catalog number: Olympus files these under
  // opaque SKUs or none at all. Both in- and out-of-distribution records are eligible here.
  const olympusByModel = new Map(
    gudid
      .filter((entry) => entry.companyKey === 'Olympus')
      .map((entry) => [
        normalizeCatalogKey(entry.versionModelNumber || entry.catalogNumber),
        entry,
      ]),
  )
  // catalog-products.json is the *merged* output, so it already contains this file's own
  // previous additions. Keying the skip on catalog number alone would therefore drop every
  // scope on the second run and re-add it on the third. Record the product id alongside, so
  // a row this script generated is recognised as its own and not mistaken for a workbook one.
  const existingOlympusScopes = new Map(
    (
      JSON.parse(
        await readFile(path.join(GENERATED_DIRECTORY, 'catalog-products.json'), 'utf8'),
      ) as { manufacturer: string | null; catalog_number: string | null; product_id: string }[]
    )
      .filter((product) => product.manufacturer === 'Olympus')
      .map((product) => [(product.catalog_number ?? '').toUpperCase(), product.product_id]),
  )
  let olympusDiscontinued = 0

  for (const scope of OLYMPUS_SCOPES) {
    const entry = olympusByModel.get(normalizeCatalogKey(scope.gudidModel))
    if (!entry) {
      console.warn(`Skipping ${scope.catalogNumber}: no GUDID record for "${scope.gudidModel}".`)
      continue
    }
    const ownProductId = stableId('PRD', `Olympus|${entry.primaryDi}`)
    const existingId = existingOlympusScopes.get(scope.catalogNumber.toUpperCase())
    if (existingId !== undefined && existingId !== ownProductId) {
      console.warn(`Skipping ${scope.catalogNumber}: already carried by the workbook.`)
      continue
    }
    const inDistribution = /^In Commercial Distribution$/i.test(entry.distributionStatus)
    if (!inDistribution) olympusDiscontinued += 1

    const productId = ownProductId
    const sizeParts = [
      scope.insertionMm ? `insertion tube ${scope.insertionMm} mm` : null,
      scope.distalMm ? `distal ${scope.distalMm} mm` : null,
      scope.channelMm ? `channel ${scope.channelMm} mm` : null,
      scope.workingLengthCm ? `WL ${scope.workingLengthCm * 10} mm` : null,
    ].filter(Boolean)

    products.push(
      buildProductRecord({
        productId,
        manufacturerId: olympusManufacturerId,
        manufacturerName: 'Olympus',
        brandFamily: scope.brandFamily,
        catalogNumber: scope.catalogNumber,
        productName: scope.productName,
        gudid: entry,
        primaryCategory:
          scope.roleCode === 'EBUS_SCOPE' ? 'EBUS platform' : 'Flexible bronchoscopy',
        subcategory:
          scope.roleCode === 'EBUS_SCOPE' ? 'Linear EBUS scope' : 'Reusable video bronchoscope',
        // The workbook's term for a bronchoscope. Matching it keeps each EVIS series in one
        // product line — familyKey splits on product_kind.
        productKind: 'Reusable endoscope',
        frenchSize: null,
        placementMethod: null,
        material: null,
        diameterMm: scope.distalMm,
        minWorkingChannelMm: scope.channelMm,
        workingLengthCm: scope.workingLengthCm,
        sizeDisplay: sizeParts.length > 0 ? sizeParts.join('; ') : null,
        adultPeds: 'Adult',
        description: scope.summary,
        notes:
          scope.specSource === 'olympus-page'
            ? 'Dimensions from the Olympus America product page; channel size cross-checked against the Olympus Bronchoscope Compatibility Chart.'
            : scope.specSource === 'gudid-description'
              ? 'Dimensions parsed from the FDA UDI device description for this model.'
              : 'Listed in the FDA UDI database; no manufacturer document was available, so no dimensions are recorded.',
        sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
        extraSpec: {
          ...(scope.distalMm ? { distal_outer_diameter_mm: scope.distalMm } : {}),
          ...(scope.insertionMm ? { insertion_tube_diameter_mm: scope.insertionMm } : {}),
          ...(scope.channelMm ? { instrument_channel_mm: scope.channelMm } : {}),
          ...(scope.workingLengthCm ? { working_length_mm: scope.workingLengthCm * 10 } : {}),
          ...(scope.fieldOfViewDeg ? { field_of_view_deg: scope.fieldOfViewDeg } : {}),
          olympus_series: scope.brandFamily,
        },
      }),
    )
    addRole(
      productId,
      scope.roleCode,
      'Primary',
      scope.channelMm ? `${scope.channelMm} mm instrument channel.` : 'Olympus bronchoscope.',
    )
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, model number, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
  }

  // --- Robotic bronchoscopy platforms (Auris/Monarch, Noah/Galaxy) ------------------------
  const aurisManufacturerId = resolveManufacturerId(AURIS_MANUFACTURER_NAME)
  const noahManufacturerId = resolveManufacturerId(NOAH_MANUFACTURER_NAME)
  const roboticManufacturerIds: Record<string, { id: string; name: string }> = {
    'Auris Health (Johnson & Johnson)': { id: aurisManufacturerId, name: AURIS_MANUFACTURER_NAME },
    'Noah Medical': { id: noahManufacturerId, name: NOAH_MANUFACTURER_NAME },
  }
  const roboticByCompanyModel = new Map(
    gudid
      .filter(
        (entry) =>
          entry.companyKey in roboticManufacturerIds &&
          /^In Commercial Distribution$/i.test(entry.distributionStatus),
      )
      .map((entry) => [
        `${entry.companyKey}|${normalizeCatalogKey(entry.versionModelNumber || entry.catalogNumber)}`,
        entry,
      ]),
  )
  let roboticSkipped = 0

  for (const device of ROBOTIC_DEVICES) {
    const entry = roboticByCompanyModel.get(
      `${device.companyKey}|${normalizeCatalogKey(device.model)}`,
    )
    if (!entry) {
      console.warn(
        `Skipping ${device.model} (${device.productName}): not listed in commercial distribution in this GUDID release.`,
      )
      roboticSkipped += 1
      continue
    }
    const manufacturer = roboticManufacturerIds[device.companyKey]
    const productId = stableId('PRD', `${manufacturer.name}|${entry.primaryDi}`)

    products.push(
      buildProductRecord({
        productId,
        manufacturerId: manufacturer.id,
        manufacturerName: manufacturer.name,
        brandFamily: device.brandFamily,
        // These labelers publish a model number and often no catalog number at all.
        catalogNumber: device.model,
        productName: device.productName,
        gudid: entry,
        primaryCategory: 'Peripheral navigation',
        subcategory: device.subcategory,
        productKind: device.productKind,
        frenchSize: null,
        placementMethod: null,
        material: null,
        sizeDisplay: null,
        adultPeds: 'Adult',
        description: device.summary,
        // No manufacturer brochure was supplied for either platform, so nothing dimensional
        // is claimed — only what the FDA UDI record establishes.
        notes:
          'Listed in the FDA UDI database. No manufacturer catalog was supplied, so no dimensions, channel sizes, or working lengths are recorded.',
        sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
      }),
    )
    addRole(productId, device.roleCode, 'Primary', device.roleNote)
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, model number, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
  }

  // --- Portex BLUselect tracheostomy tubes (ICU Medical) ----------------------------------
  //
  // Portex is already a discovery brand in the GUDID index, so every BLUselect ordering code
  // joins to a device record without an allowlist. Cuff status and fenestration come from the
  // ordering table titles, which had to be read off the page images — the ICU Medical page is
  // a web print whose text layer drops those headings, and inferring "fenestrated" from a
  // product code would be exactly the kind of guess that puts a wrong tube on a card.
  // Shared by both ICU Medical lines: Portex BLUselect below and Bivona further down.
  const icuMedicalManufacturerId = resolveManufacturerId(ICU_MEDICAL_MANUFACTURER_NAME)
  const portexSeed = JSON.parse(
    await readFile(path.join(SEED_DIRECTORY, 'portex-bluselect-catalog.json'), 'utf8'),
  ) as { source_pdf: string; tubes: PortexTube[] }
  const portexByCatalogKey = new Map(
    gudid
      .filter((entry) => entry.companyKey === 'Portex (ICU Medical)')
      .map((entry) => [
        normalizeCatalogKey(entry.catalogNumber || entry.versionModelNumber),
        entry,
      ]),
  )
  let portexSkipped = 0

  for (const tube of portexSeed.tubes) {
    const entry = portexByCatalogKey.get(normalizeCatalogKey(tube.productCode))
    if (!entry || !/^In Commercial Distribution$/i.test(entry.distributionStatus)) {
      portexSkipped += 1
      continue
    }
    if (tube.outerDiameterMm <= tube.innerDiameterMm || tube.tubeLengthMm < 25) {
      console.warn(`Skipping Portex ${tube.productCode}: implausible dimensions.`)
      continue
    }

    const productId = stableId('PRD', `portex-${tube.productCode}`)
    const descriptors = [
      tube.cuffType === 'cuffed' ? 'cuffed' : 'cuffless',
      tube.fenestrated ? 'fenestrated' : null,
      tube.subglotticSuction ? 'with subglottic suction' : null,
    ]
      .filter(Boolean)
      .join(', ')

    products.push(
      buildProductRecord({
        productId,
        manufacturerId: icuMedicalManufacturerId,
        manufacturerName: ICU_MEDICAL_MANUFACTURER_NAME,
        brandFamily: tube.family,
        productName: `${tube.family} ${tube.tubeSizeMm}`,
        gudid: entry,
        primaryCategory: 'Airway management',
        subcategory: tube.subglotticSuction
          ? 'Subglottic suction tracheostomy tube'
          : tube.cuffType === 'cuffed'
            ? 'Cuffed tracheostomy tube'
            : 'Cuffless tracheostomy tube',
        productKind: 'Single-use device',
        frenchSize: null,
        placementMethod: null,
        material: 'PVC',
        // Sized by inner diameter, the same convention the Bivona tubes follow.
        diameterMm: tube.innerDiameterMm,
        lengthMm: tube.tubeLengthMm,
        sizeDisplay: `I.D. ${tube.innerDiameterMm} mm; O.D. ${tube.outerDiameterMm} mm; length ${tube.tubeLengthMm} mm`,
        adultPeds: tube.population,
        description: `${tube.family}, size ${tube.tubeSizeMm} (I.D. ${tube.innerDiameterMm} mm), ${descriptors}.`,
        notes: 'Not manufactured with DEHP plasticizers.',
        sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
        extraSpec: {
          inner_diameter_mm: tube.innerDiameterMm,
          outer_diameter_mm: tube.outerDiameterMm,
          tube_length_mm: tube.tubeLengthMm,
          cuff_type: tube.cuffType,
          fenestrated: tube.fenestrated,
          subglottic_suction: tube.subglotticSuction,
        },
      }),
    )
    addRole(
      productId,
      tube.roleCode,
      'Primary',
      `${tube.population} PVC tracheostomy tube, ${tube.innerDiameterMm} mm I.D., ${descriptors}.`,
    )
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, GTIN, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    productSources.push({
      product_id: productId,
      source_id: PORTEX_SOURCE_ID,
      source_location: `Ordering information, product code ${tube.productCode}`,
      claim_type: 'Tube dimensions, cuff type, fenestration, and product line',
      verification_status: 'Transcribed from the manufacturer product page',
      notes: null,
    })
  }

  // --- Bivona tracheostomy tubes (ICU Medical) -------------------------------------------
  //
  // The tubes come from the Bivona catalogue, transcribed into seed/bivona-catalog.json;
  // identity and distribution status come from GUDID, where the same 77 product codes are
  // reachable through a targeted allowlist in build-gudid-index.ts (the Bivona brand alone
  // lists ~53,000 devices, so the whole brand cannot be indexed).
  //
  // Sizing follows the clinical convention: a trach tube is chosen by inner diameter, so
  // `diameter_mm` carries the I.D. and `size_display` names both diameters so nothing is
  // ambiguous on a card.
  const bivonaSeed = JSON.parse(
    await readFile(path.join(SEED_DIRECTORY, 'bivona-catalog.json'), 'utf8'),
  ) as { source_pdf: string; tubes: BivonaTube[] }
  const bivonaByCatalogKey = new Map(
    gudid
      .filter((entry) => entry.companyKey === BIVONA_COMPANY_KEY)
      .map((entry) => [entry.catalogKey, entry]),
  )
  let bivonaSkipped = 0
  const bivonaRejected: string[] = []

  for (const tube of bivonaSeed.tubes) {
    const problem = bivonaRowProblem(tube)
    if (problem) {
      bivonaRejected.push(`${tube.productCode}: ${problem}`)
      continue
    }
    const entry = bivonaByCatalogKey.get(tube.productCode.toLowerCase().replace(/[^a-z0-9]/g, ''))
    // Same rule as every other addition: no FDA record of commercial distribution, no entry.
    if (!entry || !/^In Commercial Distribution$/i.test(entry.distributionStatus)) {
      bivonaSkipped += 1
      continue
    }

    const productId = stableId('PRD', `bivona-${tube.productCode}`)
    // Cuff status comes from the product line, never from the word "cuffed": Fome-Cuf,
    // Aire-Cuf, and TTS are all cuffed tubes whose names do not say so.
    const cuffed = tube.cuffType === 'cuffed'
    const sizeDisplay = [
      `I.D. ${tube.innerDiameterMm} mm`,
      tube.outerDiameterMm ? `O.D. ${tube.outerDiameterMm} mm` : null,
      tube.tubeLengthMm ? `length ${tube.tubeLengthMm} mm` : null,
    ]
      .filter(Boolean)
      .join('; ')
    const familyLabel = tube.family.replace(/\*+$/, '').trim()

    products.push(
      buildProductRecord({
        productId,
        manufacturerId: icuMedicalManufacturerId,
        manufacturerName: ICU_MEDICAL_MANUFACTURER_NAME,
        // The GUDID brand is just "Bivona" for all 77, which would collapse every line into
        // one family. The catalogue's own line names are what a user recognizes.
        brandFamily: familyLabel,
        productName: `${familyLabel} ${tube.tubeSizeMm}`,
        gudid: entry,
        primaryCategory: 'Airway management',
        subcategory: cuffed ? 'Cuffed tracheostomy tube' : 'Cuffless tracheostomy tube',
        productKind: 'Single-use device',
        frenchSize: null,
        placementMethod: null,
        material: 'Silicone',
        diameterMm: tube.innerDiameterMm,
        lengthMm: tube.tubeLengthMm,
        sizeDisplay,
        adultPeds: tube.population,
        description: `${familyLabel}, size ${tube.tubeSizeMm} (I.D. ${tube.innerDiameterMm} mm).`,
        notes: tube.tts ? 'Tight-to-shaft cuff: inflate with sterile water, not air.' : null,
        sourceLocation: `device.txt, PrimaryDI ${entry.primaryDi}`,
        extraSpec: {
          inner_diameter_mm: tube.innerDiameterMm,
          ...(tube.outerDiameterMm ? { outer_diameter_mm: tube.outerDiameterMm } : {}),
          ...(tube.tubeLengthMm ? { tube_length_mm: tube.tubeLengthMm } : {}),
          ...(tube.tubeAngleDegrees ? { tube_angle_degrees: tube.tubeAngleDegrees } : {}),
          ...(tube.cuffRestingDiameterMm
            ? { cuff_resting_diameter_mm: tube.cuffRestingDiameterMm }
            : {}),
          cuff_type: tube.cuffType,
          tight_to_shaft_cuff: tube.tts,
          fenestrated: tube.fenestrated,
        },
      }),
    )
    addRole(
      productId,
      cuffed ? 'TRACH_TUBE_CUFFED' : 'TRACH_TUBE_CUFFLESS',
      'Primary',
      `${tube.population} silicone tracheostomy tube, ${tube.innerDiameterMm} mm I.D.`,
    )
    productSources.push({
      product_id: productId,
      source_id: GUDID_SOURCE_ID,
      source_location: `device.txt, PrimaryDI ${entry.primaryDi}`,
      claim_type: 'Device identity, GTIN, and distribution status',
      verification_status: `GUDID "${entry.distributionStatus}" as of ${GUDID_RELEASE_DATE}`,
      notes: null,
    })
    productSources.push({
      product_id: productId,
      source_id: BIVONA_SOURCE_ID,
      source_location: `Product code ${tube.productCode}`,
      claim_type: 'Tube dimensions, cuff type, and product line',
      verification_status: 'Transcribed from the manufacturer catalog ordering tables',
      notes: null,
    })
  }

  // Taxonomy-v2 cohorts: energy platforms, collateral ventilation, thoracoscopy energy,
  // procedural imaging, laser, photodynamic therapy, and the breakthrough-designated devices.
  // Emitted last so its dedupe sees every product id this run has already produced.
  const taxonomyV2 = buildTaxonomyV2Additions({
    gudid,
    resolveManufacturerId,
    // catalog-products.json is the merged output, so it already contains this script's own
    // previous run. The map is keyed by catalog number (or product name where there is none)
    // and carries the existing product_id, so the emitter can tell one of its own rows from a
    // workbook row rather than skipping both.
    existingProductIdsByKey: new Map(
      (
        JSON.parse(
          await readFile(path.join(GENERATED_DIRECTORY, 'catalog-products.json'), 'utf8'),
        ) as { product_id: string; catalog_number: string | null; product_name: string }[]
      )
        .concat(
          products.map((product) => ({
            product_id: String(product.product_id),
            catalog_number: (product.catalog_number as string | null) ?? null,
            product_name: String(product.product_name),
          })),
        )
        .map((product) => [
          (product.catalog_number ?? product.product_name).toUpperCase(),
          product.product_id,
        ]),
    ),
  })
  products.push(...taxonomyV2.products)
  productRoles.push(...taxonomyV2.productRoles)
  productSources.push(...taxonomyV2.productSources)
  for (const warning of taxonomyV2.warnings) console.warn(warning)

  const brochureIntake = buildBrochureIntakeAdditions({
    existingProducts: (
      JSON.parse(
        await readFile(path.join(GENERATED_DIRECTORY, 'catalog-products.json'), 'utf8'),
      ) as {
        product_id: string
        manufacturer_id: string | null
        catalog_number: string | null
      }[]
    ).concat(
      products.map((product) => ({
        product_id: String(product.product_id),
        manufacturer_id:
          typeof product.manufacturer_id === 'string' ? product.manufacturer_id : null,
        catalog_number: typeof product.catalog_number === 'string' ? product.catalog_number : null,
      })),
    ),
  })
  products.push(...brochureIntake.products)
  productRoles.push(...brochureIntake.productRoles)
  productSources.push(...brochureIntake.productSources)
  for (const warning of brochureIntake.warnings) console.warn(warning)

  const additions = {
    format_version: '1.0',
    generated_by: 'scripts/ip-preference-cards/build-catalog-additions.ts',
    notes:
      'Curated catalog additions merged by the importer. GUDID-backed rows keep their dated FDA identity and distribution evidence; brochure-intake rows use exact manufacturer-document identities, remain hidden, and make no current U.S. distribution or orderability claim.',
    manufacturers: [
      {
        manufacturer_id: manufacturerId,
        manufacturer: MANUFACTURER_NAME,
        default_distributor: null,
        website:
          'https://www.getinge.com/us/products-and-solutions/intensive-care/thoracic-drainage-solutions/',
        notes:
          'Atrium Medical Corporation is the GUDID labeler for the Getinge thoracic drainage line (Oasis, Express, Ocean, and PVC thoracic catheters).',
      },
      {
        manufacturer_id: teleflexManufacturerId,
        manufacturer: TELEFLEX_MANUFACTURER_NAME,
        default_distributor: null,
        website: null,
        notes:
          'Teleflex is the GUDID labeler for the Pleur-evac chest drainage line. The workbook already lists Teleflex products under the same name.',
      },
      {
        manufacturer_id: fujifilmManufacturerId,
        manufacturer: FUJIFILM_MANUFACTURER_NAME,
        default_distributor: null,
        website: null,
        notes:
          'FUJIFILM Corporation is the GUDID labeler for the EB-series bronchoscopes. Separate from FUJIFILM SonoSite, the ultrasound business already listed in the workbook.',
      },
      {
        manufacturer_id: aurisManufacturerId,
        manufacturer: AURIS_MANUFACTURER_NAME,
        default_distributor: null,
        website: null,
        notes:
          'Auris Health is the GUDID labeler for the Monarch robotic bronchoscopy platform and its single-use consumables. Now part of Johnson & Johnson MedTech.',
      },
      {
        manufacturer_id: noahManufacturerId,
        manufacturer: NOAH_MANUFACTURER_NAME,
        default_distributor: null,
        website: null,
        notes:
          'Noah Medical Corporation is the GUDID labeler for the Galaxy robotic bronchoscopy platform and its single-use bronchoscope.',
      },
      {
        manufacturer_id: icuMedicalManufacturerId,
        manufacturer: ICU_MEDICAL_MANUFACTURER_NAME,
        default_distributor: null,
        website: null,
        notes:
          'ICU Medical is the GUDID labeler for the Bivona silicone tracheostomy tubes, and for Portex.',
      },
      ...taxonomyV2.manufacturers,
      ...brochureIntake.manufacturers,
    ],
    sources: [
      {
        source_id: GETINGE_SOURCE_ID,
        title: 'Getinge US Thoracic Drainage Solutions product pages',
        filename: null,
        source_type: 'Manufacturer product page',
        publisher: 'Getinge / Atrium Medical Corporation',
        revision_date: null,
        as_of_date: GUDID_RELEASE_DATE,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for product family naming, configuration, ordering part numbers, and stated operating ranges. Confirm current orderability and full IFU with the manufacturer or supply chain.',
        notes:
          'Covers Oasis dry suction water seal, Express dry seal, Express Mini 500 mobile dry seal, and soft/firm PVC thoracic catheters.',
      },
      {
        source_id: FUJIFILM_SOURCE_ID,
        title: 'FUJIFILM Bronchoscope Catalog',
        filename: 'bronchoscope_catalog_0.pdf',
        source_type: 'Manufacturer catalog',
        publisher: 'FUJIFILM Corporation',
        revision_date: null,
        as_of_date: null,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for model dimensions, instrument channel size, and optical specifications. The catalog is international; confirm US availability separately, which is why entries here are limited to models the FDA UDI database lists in commercial distribution.',
        notes:
          'Covers the EB-530 and EB-580 series. EB-530XT appears in the catalog but has no FDA UDI record and is therefore not listed.',
      },
      {
        source_id: FUJIFILM_EUS_SOURCE_ID,
        title: 'FUJIFILM Endoscopic Ultrasound — ultrasonic endoscopes & ultrasound system',
        filename: 'Fujifilm_EUS Brochure_03_2025_EN.pdf',
        source_type: 'Manufacturer brochure',
        publisher: 'FUJIFILM Healthcare Europe GmbH',
        revision_date: '2025-03',
        as_of_date: null,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for system specifications and applicable-endoscope lists. This is a European brochure; US availability is confirmed separately against the FDA UDI database, which is why only devices GUDID reports in commercial distribution are listed.',
        notes:
          'Covers the ARIETTA 850 / 750 FF ENDO systems, SU-1 processor, and the EG-series ultrasonic endoscopes. Only the ARIETTA 750 lists the EB-530US bronchoscope among its applicable endoscopes.',
      },
      {
        source_id: FUJIFILM_PULM_SOURCE_ID,
        title: 'FUJIFILM EndoSolutions for Pulmonology',
        filename: 'Fujifilm_EndoSolutionsPulmonology_2023_EN_144dpi.pdf',
        source_type: 'Manufacturer catalog',
        publisher: 'FUJIFILM Healthcare Europe GmbH',
        revision_date: '2023',
        as_of_date: null,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for bronchoscope and platform specifications and compatibility. European catalog; current U.S. availability and orderability must be confirmed separately.',
        notes:
          'Covers the EB-series bronchoscopes, EB-530US with the SU-1 processor, the SP-900 mini probe system, and the ELUXEO light sources and video processors. EB-530XT is included as a hidden brochure-verified identity with current U.S. status unverified; no current-status conclusion is inferred from this European catalog.',
      },
      {
        source_id: PORTEX_SOURCE_ID,
        title: 'Portex BLUselect Tracheostomy Tubes — ICU Medical product page',
        filename: portexSeed.source_pdf,
        source_type: 'Manufacturer product page',
        publisher: 'ICU Medical',
        revision_date: null,
        as_of_date: '2026-07-27',
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for ordering codes, tube dimensions, cuff type, and fenestration. US product page, so ordering codes are the US ones; every listed code was matched to an FDA UDI record in commercial distribution.',
        notes:
          'Cuff status and fenestration are taken from the ordering table titles read off the page images — this is a web print whose text layer drops those headings. Inner cannulas (101/851, 101/856, 101/858) are excluded: no role exists for them.',
      },
      {
        source_id: BIVONA_SOURCE_ID,
        title: 'Bivona Tracheostomy Tube Catalog',
        filename: bivonaSeed.source_pdf,
        source_type: 'Manufacturer catalog',
        publisher: 'ICU Medical',
        revision_date: null,
        as_of_date: null,
        reliability_tier: 'Tier 1 - manufacturer',
        use_policy:
          'Use for tube dimensions, cuff type, and product line naming. Ordering codes were transcribed from the catalog tables and matched one-to-one against FDA UDI records; confirm the exact configuration and full IFU with the manufacturer before use.',
        notes:
          'Cuff status is taken from the product line, not from the presence of the word "cuffed": Fome-Cuf, Aire-Cuf, and TTS lines are all cuffed.',
      },
      ...taxonomyV2.sources,
      ...brochureIntake.sources,
    ],
    products,
    product_roles: productRoles,
    product_sources: productSources,
  }

  await writeFile(
    path.join(SEED_DIRECTORY, 'catalog-additions.json'),
    await formatJson(additions),
    'utf8',
  )

  const roleCounts = new Map<string, number>()
  for (const role of productRoles) {
    const code = role.role_code as string
    roleCounts.set(code, (roleCounts.get(code) ?? 0) + 1)
  }
  const byManufacturer = new Map<string, number>()
  for (const product of products) {
    const name = String(product.manufacturer)
    byManufacturer.set(name, (byManufacturer.get(name) ?? 0) + 1)
  }
  console.log(`Wrote ${products.length} curated products.`)
  if (olympusDiscontinued > 0) {
    console.log(
      `  ${olympusDiscontinued} Olympus scope(s) added that GUDID reports as no longer in commercial distribution — badged, not hidden.`,
    )
  }
  if (portexSkipped > 0) {
    console.log(`  skipped ${portexSkipped} Portex tubes with no in-distribution GUDID record.`)
  }
  if (bivonaSkipped > 0) {
    console.log(`  skipped ${bivonaSkipped} Bivona tubes with no in-distribution GUDID record.`)
  }
  if (bivonaRejected.length > 0) {
    console.log(
      `  rejected ${bivonaRejected.length} Bivona row(s) as physically implausible — re-transcribe from the catalog:`,
    )
    for (const rejected of bivonaRejected) console.log(`      ${rejected}`)
  }
  for (const [name, count] of [...byManufacturer.entries()].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${name}`)
  }
  for (const [code, count] of [...roleCounts.entries()].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${code}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
