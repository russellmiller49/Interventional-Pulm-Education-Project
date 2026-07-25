// Reviewed stable domain expectations; intentionally separate from UI snapshots.
export const goldenScenarioExpectations = {
  ebusRoseMolecular: {
    scenarioId: 'ebus-rose-molecular',
    modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
    readinessState: 'complete_with_warnings',
    itemCount: 17,
    suppressedItemCount: 0,
    snapshotHash: 'f739cacc033943445b3e7a2ec0f6841b01762772a33e573a1b750dd76a2ccf25',
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
    readinessState: 'blocked',
    itemCount: 50,
    suppressedItemCount: 0,
    snapshotHash: '0eb8a8f52a794e3211129a82a4a63ad4774785d856180257efe7e78ca7ed9299',
  },
  chestTubeSmallBoreDigital: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE', 'DIGITAL_DRAINAGE'],
    readinessState: 'complete_with_warnings',
    itemCount: 11,
    suppressedItemCount: 1,
    snapshotHash: 'a5d7fc30e3da8504b4d264d181b9c9d47d20cd6250f206a78a3df48334e81181',
  },
  chestTubeLargeBoreConventional: {
    scenarioId: 'chest-tube',
    modifierCodes: ['TECH_CHEST_TUBE_LARGE_BORE'],
    readinessState: 'complete_with_warnings',
    itemCount: 12,
    suppressedItemCount: 0,
    snapshotHash: '017d342b9bd28c759fa45851c80707dea213e50ce9f8f02cb7bfd86244534b9c',
  },
} as const
