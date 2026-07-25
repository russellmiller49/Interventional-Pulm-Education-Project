/**
 * Hemodynamics-specific clinical boundaries.
 *
 * A threshold belongs here when it is used by both learner-facing interpretation and an engine
 * predicate. Case-specific starting values and bounded model parameters remain with their cases.
 */
export const HEMODYNAMIC_CLINICAL_THRESHOLDS = {
  pulmonaryHypertension: {
    /** Evidence: esc-ers-ph-2022. PH is defined by mPAP greater than this value. */
    meanPapMmHg: 20,
    /** Evidence: esc-ers-ph-2022. Used with mPAP and PVR, never alone. */
    preCapillaryPawpMaxMmHg: 15,
    /** Evidence: esc-ers-ph-2022. Used with mPAP and PAWP, never alone. */
    elevatedPvrWoodUnits: 2,
  },
  cardiacIndexAlarm: {
    /** Educational warning boundary; evidence: pac-derived-part-2-2021. */
    lowLMinM2: 2.2,
    /** Educational critical-alarm boundary; evidence: pac-derived-part-2-2021. */
    criticalLowLMinM2: 1.8,
  },
  pulsePressureVariation: {
    /** Evidence: ppv-sepsis-2000. Valid only under the authored validity conditions. */
    responsivePercent: 13,
    /** Evidence: ppv-sepsis-2000. Traditional validation tidal volume. */
    traditionalTidalVolumeMlKg: 8,
  },
  systemicVascularResistance: {
    /** Conventional adult reference; evidence: pac-derived-part-2-2021. */
    referenceMinDynSecCm5: 800,
    /** Conventional adult reference; evidence: pac-derived-part-2-2021. */
    referenceMaxDynSecCm5: 1200,
  },
  pulmonaryArteryCompliance: {
    /** Cohort median; evidence: pa-compliance-outcomes-2026. */
    cohortMedianMlMmHg: 3.29,
    /** Cohort interquartile lower bound; evidence: pa-compliance-outcomes-2026. */
    cohortIqrLowMlMmHg: 2.19,
    /** Cohort interquartile upper bound; evidence: pa-compliance-outcomes-2026. */
    cohortIqrHighMlMmHg: 4.7,
  },
  signalValidation: {
    /** Educational leveling tolerance; evidence: arterial-pressure-five-step-2020. */
    transducerLevelToleranceCm: 1,
    /** Modeled PPV rhythm-validity boundary; evidence: ppv-sepsis-2000. */
    rhythmRegularityMinimum: 0.95,
  },
} as const
