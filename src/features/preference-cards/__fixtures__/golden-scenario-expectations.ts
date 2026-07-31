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
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 19,
    suppressedItemCount: 0,
    snapshotHash: 'ee8f3ccaa7ad14d6e6b0c02aba9cf7e255e2c97d3ce4a7264c65fd954ab40daf',
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
    snapshotHash: 'f4d163f273b48556f5a24bc7d0f9fc90791395c366faad6675c0501d2e855d67',
  },
  chestTubeSmallBoreDigital: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    readinessState: 'complete_with_warnings',
    itemCount: 11,
    suppressedItemCount: 1,
    snapshotHash: '44d9ab11b1d45eb3b74bd0ca0bb69297b278f116c03c6d10771d58787538bc72',
  },
  chestTubeLargeBoreConventional: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    readinessState: 'complete_with_warnings',
    itemCount: 12,
    suppressedItemCount: 0,
    snapshotHash: '3f4164d8927e3adced21e3240a496e4594652c461ba76defd6b09e35521c01c1',
  },
} as const
