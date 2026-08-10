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
// Re-pinned 2026-08-09 for the owner-review governed-data corrections (release v1-1 line):
// F-04 moved six sampling instruments to back_table/diagnostic (both hashes move — zone and
// phase are inside the projections); F-05 re-phased the Drainage section (both chest-tube
// entries); F-06 removed the four IPC lines from CHEST_TUBE (item counts 11 → 7 and 12 → 8);
// F-10 added the flex-core bite block and airway adapter (EBUS 19 → 21, therapeutic 57 → 58,
// where the bite block also migrated its requirement key into the shared core). Readiness
// states and the suppressed-item count were expected to stay put, and did.
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 21,
    suppressedItemCount: 0,
    snapshotHash: 'b2f033f7dd6abe281ca7ff7fb094d93bdac5392448ed3b1fb196e49b210fc90b',
    resolvedContentHash: 'af722b416b13df64abc38a30c84babb7a661191865a659b8c9356870a4b43a6a',
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
    itemCount: 58,
    suppressedItemCount: 0,
    // Re-pinned for F-09 (2026-08-09): OPS-APC-RIGID became conditional on "Rigid system in
    // use" instead of required. A field-level diff of this scenario resolved under
    // release-therapeutic-bronch-v1-1 vs v1-2 showed exactly one changed item — that slot's
    // requiredness/effectiveRequiredness/dependencyRule/conditionalState — with item count,
    // warning count, suppression, and readiness unchanged.
    snapshotHash: 'e97e5f71d30fc77b4b0e1ed8f3265d5bc89e1c28ff2d1fa9848055048618e067',
    resolvedContentHash: '313b9176bd32eceaef9bbf23376325b353421219ceab470fb56a127104c94c16',
  },
  chestTubeSmallBoreDigital: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    readinessState: 'complete_with_warnings',
    itemCount: 7,
    suppressedItemCount: 1,
    snapshotHash: '53115b6aba1aae1b209269d8ab36d2dc641a5f95b93dafc0ebb1d04b9c5d7379',
    resolvedContentHash: '3f7a85e8cacfa584e918140787527e7833494a8f998122a305026fae233407f5',
  },
  chestTubeLargeBoreConventional: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    readinessState: 'complete_with_warnings',
    itemCount: 8,
    suppressedItemCount: 0,
    snapshotHash: '53ab0e750cbf0ac62e59806987ba6fede4eac591070a386eaeadb220212904ab',
    resolvedContentHash: '80c2236c66be7b14067f60208f6c24f642f5c9823124cfb4dfc6aa4c46abfa51',
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
      'FLEX_BRONCH_BITE_BLOCK', // Bite block (F-10: flex core v1.1; EBUS row display_order 16)
      'FLEX_BRONCH_AIRWAY_ADAPTER', // Airway adapter (F-10: flex core v1.1; EBUS row display_order 17)
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
      'FLEX_BRONCH_BITE_BLOCK', // Bite block (F-10: same line, requirement key re-homed into flex core v1.1)
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
      'FLEX_BRONCH_AIRWAY_ADAPTER', // Airway adapter (F-10: therapeutic row display_order 30)
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
