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
// Setup order changed for the composed procedures: requirements now sort in bands by the
// module that contributed them, so a shared core's lines lead the card.
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 19,
    suppressedItemCount: 0,
    snapshotHash: '55676fe3f17739bd8bdb511bf9aabfec1617529fc5765a6069082260e424980f',
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
    snapshotHash: '3ded5dab47df58b8368dbc3594ac0bd4eff5c5057ec916cd45b2de4f5d09cb7b',
  },
  chestTubeSmallBoreDigital: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    readinessState: 'complete_with_warnings',
    itemCount: 11,
    suppressedItemCount: 1,
    snapshotHash: 'e1b517ace65919c61825843b9dfe5c8cd33c3e524bf75729840e169cdea999af',
  },
  chestTubeLargeBoreConventional: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    readinessState: 'complete_with_warnings',
    itemCount: 12,
    suppressedItemCount: 0,
    snapshotHash: 'bb3e37c5d1b490b497441531e7b0f8576f30445b03007779cddb2fed448b2a74',
  },
} as const
