// Reviewed stable domain expectations; intentionally separate from UI snapshots.
//
// Hashes and the central-airway readiness state were regenerated in v0.2, when:
//   - the snapshot payload stopped including `generatedAt` (the hash addresses card
//     content, so re-saving unchanged content keeps its identity), and
//   - an unresolved required role became a warning instead of a blocker, and the
//     deliberately-failing APC rule moved out of the production seed into a test fixture.
// Item and suppression counts are unchanged from v0.1.
//
// `ebusRoseMolecular` was rehashed again when the Olympus EU-ME2 row was corrected to sit in
// the EVIS EUS product line and both ultrasound centres were renamed to carry their model
// numbers (see seed/product-overrides.json). The card's ultrasound-processor line reads
// differently, so its content hash moves; the item and suppression counts do not.
//
// The two chest-tube fixtures were rehashed when external-review remediation moved the
// securement/dressing slot from GENERIC_SPECIMEN to DRESSING_SECUREMENT. No item or
// suppression counts changed.
//
// 2026-07-30, taxonomy v2. `ebusRoseMolecular` and `centralAirwayObstruction` were rehashed
// and their item counts moved, because both scenarios gained slots rather than because
// anything about them was reinterpreted:
//   - EBUS-TBNA gained a fluoroscopy C-arm and a radiation-protection requirement (17 → 19),
//   - central airway obstruction gained the three laser requirements — console, fibre, and
//     safety equipment — plus the same two imaging requirements and a tomosynthesis
//     navigation requirement (50 → 56), and then a laser-resistant endotracheal tube when the
//     laser section was rebuilt from the manufacturer IFUs and the airway literature (56 → 57).
// The two chest-tube fixtures are untouched: chest tube gained no slots. Readiness states and
// suppression counts are unchanged throughout. The role renames in the same milestone moved no
// hash on their own — a renamed role changes the code a slot requests, not the resolved
// content the snapshot addresses.
//
// 2026-07-30, recipe composition (engine 0.1.0 → 0.2.0). All four hashes moved and **no
// item count, suppression count, or readiness state did** — which is the point. Procedures
// are now assembled from versioned recipe modules, so the hashable domain output gained the
// composition manifest (`includedModules`) and every item gained its `requirementKey` and
// source module ids. The requirements themselves are the same requirements:
//   - EBUS-TBNA         = Flexible Bronchoscopy Core + EBUS-TBNA specific + Procedural
//                         Fluoroscopy (default-on), 19 items as before,
//   - central airway    = Flexible Bronchoscopy Core + Therapeutic Bronchoscopy Core +
//                         therapeutic specific + Procedural Fluoroscopy, 57 as before,
//   - both chest-tube   = Pleural Procedure Core + chest-tube specific, 11 and 12 as before.
//
// 2026-07-30, setup-order correction. All four hashes moved again, and again no item count,
// suppression count, or readiness state did. The first composition pass sorted each card by
// the module that contributed a line ("bands"), which put an assembly detail in charge of a
// clinical sequence: an EBUS card opened with the video processor and the linear EBUS
// bronchoscope — first on the reviewed template — sat third. Procedures now carry their own
// reviewed order (`requirementSequences`, generated from the template's `display_order`) and
// the module band survives only as the fallback for a requirement the procedure never placed.
// Every composed card's item order is back to the reviewed pre-composition sequence; the
// hashes move because `setupSequence` is part of the resolved item and its values changed.
// `goldenScenarioItemOrder` below pins the result so it cannot drift again unnoticed.
//
// 2026-08-01, hash separation and resolution provenance (engine 0.2.0 → 0.3.0). All four
// `snapshotHash` values moved and **no item count, suppression count, or readiness state did** —
// again the point. The hashable output gained `scope` (the stable organization/site/location
// identifiers behind the three display names) and `resolutionProvenance` (which release, catalog
// release, and resolver contract produced the card), so a snapshot written at 0.2.0 hashes
// differently by construction. The requirements, their order, and what each resolved to are
// untouched.
//
// `resolvedContentHash` is pinned here from the same milestone. It is the *semantic* projection —
// what the resolver decided and what the card prints as instructions, without implementation prose
// — so a future change that reworded a rule-trace message would move `snapshotHash` and leave this
// alone, and a change to effective requiredness would move both. Having both in the fixture is what
// makes that distinction visible in a diff rather than an argument about which hash to trust.
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 19,
    suppressedItemCount: 0,
    snapshotHash: '09084ae504ca33e8bc87c29d0d62cc9564f7f8b3b185483924639dfc21251f7e',
    resolvedContentHash: '78e77e4e542e756914856906158b19fd31e7d45211312c941270ed170b4aaffa',
  },
  centralAirwayObstruction: {
    scenarioId: 'central-airway-obstruction',
    modifierCodes: [
      'RIGID_AIRWAY',
      'APC',
      'BALLOON_DILATION',
      'STENT_PLACE',
      'JET_VENT',
      'FLUOROSCOPY',
      'HIGH_BLEED_RISK',
    ],
    readinessState: 'complete_with_warnings',
    itemCount: 57,
    suppressedItemCount: 0,
    snapshotHash: 'efc1eb5a5babd1bd4e95d1097fc076c2758cfbe839c7a72adffe4942de1b1495',
    resolvedContentHash: 'e953535778dc3f55d827f93fe9c60b32f74558dfc7667fc5af98ea15b437b4f1',
  },
  chestTubeSmallBoreDigital: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    readinessState: 'complete_with_warnings',
    itemCount: 11,
    suppressedItemCount: 1,
    snapshotHash: '7d8cbd5f08dce37e3d66dde70e9753405c4588ef7c834f0a47f4289ff151dd81',
    resolvedContentHash: 'df53244739c30de6d3c81088f88542189797e7075e8d2a144e36bd45ae64d7d3',
  },
  chestTubeLargeBoreConventional: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    readinessState: 'complete_with_warnings',
    itemCount: 12,
    suppressedItemCount: 0,
    snapshotHash: '72f3311726219af5099d2ddec261f95ae541f4583970dbf1c8a8a7e02850ca59',
    resolvedContentHash: 'ae632f4f94066c588822bf9aa8b583aa1c08900350156b7ab411ccbf860ec732',
  },
} as const

/**
 * The intended setup order for the three procedures composition reordered, by
 * `requirementKey`, as a card actually renders it.
 *
 * A hash proves a card did not change; it cannot say what the card *should* be, and the
 * reordering that prompted these fixtures rode in on a hash update nobody could read. These
 * lists are the reviewed clinical sequence, so a future change to how composition assembles
 * a card has to state its intent here rather than absorb it into a new hash.
 *
 * Each list is the imported template's own `display_order` — the sequence a clinician
 * reviewed — with modifier and rescue lines (`OPS-*`, `RESCUE-*`) after it, which is where
 * contingency content belongs. A shared core supplies the *definition* of a line such as
 * `FLEX_BRONCH_VIDEO_PROCESSOR`; the procedure still decides where it sits.
 */
export const goldenScenarioItemOrder = {
  /** EBUS-TBNA: the linear EBUS bronchoscope leads. It is the procedure. */
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    requirementKeys: [
      'SLOT-4648848CC3', // Linear EBUS bronchoscope
      'FLEX_BRONCH_VIDEO_PROCESSOR', // Compatible video processor/light source
      'SLOT-92874E31E1', // Endoscopic ultrasound processor
      'SLOT-B19121A5B9', // Compatible ultrasound cable
      'SLOT-93655BF7C4', // EBUS balloon
      'SLOT-1AF4BEFE3B', // EBUS-TBNA FNA needle
      'SLOT-B83EBD2FBB', // EBUS FNB needle
      'SLOT-D08C74941A', // Intranodal mini-forceps
      'SLOT-12ACA27E54', // Slides, cell-block, formalin/RPMI and labels
      'SLOT-76F4405D68', // Airway wash/BAL trap
      'FLEX_BRONCH_SUCTION_SETUP', // Suction source/tubing/syringes
      'SLOT-CD12842559', // Needle adapter / biopsy valve
      'SLOT-E8F0B48B49', // Vacuum-locking syringe
      'PROCEDURAL_FLUOROSCOPY_C_ARM', // Fluoroscopy C-arm
      'PROCEDURAL_RADIATION_PROTECTION', // Radiation protection
      'OPS-ROSE-STATION',
      'OPS-ROSE-SUPPLIES',
      'OPS-MOLECULAR-SPECIMEN',
      'OPS-MOLECULAR-READINESS',
    ],
  },
  /** Therapeutic flexible bronchoscopy: the therapeutic scope leads, suction stays third. */
  centralAirwayObstruction: {
    scenarioId: 'central-airway-obstruction',
    modifierCodes: [
      'RIGID_AIRWAY',
      'APC',
      'BALLOON_DILATION',
      'STENT_PLACE',
      'JET_VENT',
      'FLUOROSCOPY',
      'HIGH_BLEED_RISK',
    ],
    requirementKeys: [
      'THERAPEUTIC_BRONCHOSCOPE_PLATFORM', // Therapeutic bronchoscope
      'FLEX_BRONCH_VIDEO_PROCESSOR', // Compatible video processor/light source
      'FLEX_BRONCH_SUCTION_SETUP', // Suction source/tubing/syringes
      'SLOT-FCE9E3810E', // Energy/hemostasis platform and probes
      'SLOT-14453819D5', // Flexible cryoprobe
      'AIRWAY_RETRIEVAL_FORCEPS', // Flexible grasping forceps
      'SLOT-115310F554', // Retrieval basket/net
      'SLOT-3FE6796B6D', // Airway balloon dilator
      'SLOT-D43C866FB5', // Guidewire
      'SLOT-7412B3318B', // Inflation device
      'SLOT-45D721710F', // Covered metallic airway stent
      'SLOT-09A64B2C62', // Uncovered metallic airway stent
      'SLOT-D2974FC11B', // Biopsy forceps
      'SLOT-0F8FA96C28', // Specimen containers/labels
      'SLOT-97CFA5C9A2', // Flexible APC probe
      'SLOT-90A43CBAEF', // Energy cable / adapter
      'SLOT-971BBE6BF8', // Cryosurgery platform accessories
      'SLOT-D6B291DC80', // Bite block
      'SLOT-D7F2D36301', // Cleaning brush
      'SLOT-1538BC9076', // APC gas-system accessories
      'SLOT-081FB0C695', // Airway stent sizing device
      'SLOT-FDF73730B0', // BAL convenience tubing/kit
      'SLOT-185FBB545F', // Surgical laser console
      'SLOT-34CDBAB683', // Laser delivery fibre
      'SLOT-6630AD392A', // Laser safety equipment
      'SLOT-EE17F755B2', // Laser-resistant endotracheal tube
      'PROCEDURAL_FLUOROSCOPY_C_ARM', // Fluoroscopy C-arm
      'PROCEDURAL_RADIATION_PROTECTION', // Radiation protection
      'SLOT-38E5FB60B9', // Tomosynthesis navigation system
      'OPS-RIGID-HEAD',
      'OPS-RIGID-BARREL',
      'OPS-RIGID-ACCESSORY',
      'OPS-RIGID-TELESCOPE',
      'OPS-RIGID-LIGHT-CABLE',
      'OPS-RIGID-FORCEPS',
      'OPS-RIGID-SUCTION',
      'OPS-APC-PLATFORM',
      'OPS-APC-PROBE',
      'OPS-APC-RIGID',
      'OPS-APC-GAS',
      'OPS-APC-CABLE',
      'OPS-APC-FIRE',
      'OPS-AIRWAY-MEASUREMENT',
      'OPS-JET-VENTILATOR',
      'OPS-JET-ACCESSORY',
      'OPS-MANUAL-VENT',
      'OPS-CARM',
      'OPS-CARM-DRAPE',
      'OPS-RADIATION',
      'OPS-STENT-CONFIG',
      'OPS-STENT-TOOLS',
      'OPS-STENT-BACKUP',
      'RESCUE-BLEED-SUCTION',
      'RESCUE-BLEED-SCOPE',
      'RESCUE-BLEED-BALLOON',
      'RESCUE-BLEED-RIGID',
      'RESCUE-BLEED-VENT',
    ],
  },
  /**
   * EBV: the retrieval forceps stays sixth. It is a contingency line the valve card carries,
   * not the second thing anyone reaches for — the therapeutic core defines it, EBV places it.
   */
  ebv: {
    scenarioId: 'ebv',
    modifierCodes: [] as string[],
    requirementKeys: [
      'THERAPEUTIC_BRONCHOSCOPE_PLATFORM', // Therapeutic bronchoscope
      'SLOT-A24CA7DB72', // Compatible processor/light source
      'SLOT-C4034E9595', // Collateral ventilation assessment platform/catheter
      'SLOT-B14DF27813', // Endobronchial valve(s)
      'SLOT-D48FE87D5A', // Valve deployment catheter
      'AIRWAY_RETRIEVAL_FORCEPS', // Flexible grasping forceps
      'SLOT-D336807B69', // Suction setup
      'SLOT-030A408C27', // Chest tube kit immediately available
      'SLOT-022D0D3DC6', // Chest drainage unit
      'SLOT-639A3A4E14', // Valve sizing kit
      'SLOT-C657258C05', // Valve sizing balloon catheter
    ],
  },
} as const
