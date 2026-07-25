/**
 * Clinical and educational alarm boundaries used by more than one critical-care module.
 *
 * These constants keep the focused modules and the integrated ICU simulator aligned. They are
 * alarm-model boundaries, not patient-specific treatment targets.
 */
export const SHARED_CRITICAL_CARE_THRESHOLDS = {
  meanArterialPressure: {
    /** Evidence: ssc-sepsis-2026. */
    lowMmHg: 65,
    /** Educational critical-alarm boundary shared by the current simulators. */
    criticalLowMmHg: 55,
    evidenceIds: ['ssc-sepsis-2026', 'ICU-SCENARIO-MODEL'] as const,
  },
  oxygenSaturation: {
    /** Educational warning boundary shared by the current simulators. */
    lowPercent: 90,
    /** Educational critical-alarm boundary shared by the current simulators. */
    criticalLowPercent: 85,
    evidenceIds: ['bounded-ventilation-model', 'ICU-SCENARIO-MODEL'] as const,
  },
  cardiacPowerOutput: {
    /** Common teaching boundary in shock cohorts; evidence: cpo-acute-cardiac-2007. */
    highRiskTeachingWatts: 0.6,
    /** Original acute-cardiac cohort cut point; evidence: cpo-acute-cardiac-2007. */
    originalCohortWatts: 0.53,
    evidenceIds: ['cpo-acute-cardiac-2007', 'pac-derived-part-2-2021'] as const,
  },
  pulmonaryArteryPulsatilityIndex: {
    /** Acute inferior-RV-infarction cohort cut point; evidence: papi-rvmi-2012. */
    acuteRvInfarctionHighRiskMax: 0.9,
    /**
     * Advanced-heart-failure/LVAD literature teaching boundary. This is context-specific and is
     * not an engine alarm or universal definition of RV failure.
     */
    advancedHeartFailureTeachingMax: 1.85,
    evidenceIds: ['papi-rvmi-2012', 'pac-derived-part-2-2021'] as const,
  },
} as const
