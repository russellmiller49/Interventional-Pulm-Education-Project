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
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 17,
    suppressedItemCount: 0,
    snapshotHash: 'c618e19cb98c195fab83255495b9f2abed88e4ec2bb6592e31311e35f13b8c6c',
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
    itemCount: 50,
    suppressedItemCount: 0,
    snapshotHash: 'ef39991f0cbadc6102f2cda039ffc54b67432b757324916ce435b899df7b29cd',
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
