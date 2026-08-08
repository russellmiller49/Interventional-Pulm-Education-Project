import {
  calculatePrescriptionWorkbench,
  calculateQualitativePrePostDilution,
  type PrescriptionWorkbenchInputs,
} from '../prescriptionWorkbenchModel'

const VALID_INPUTS: PrescriptionWorkbenchInputs = Object.freeze({
  simulatedWeightKg: 70,
  hematocritPercent: 30,
  bloodFlowMlPerMinute: 100,
  preBloodPumpMlPerHour: 200,
  dialysateMlPerHour: 1_000,
  preReplacementMlPerHour: 300,
  postReplacementMlPerHour: 500,
  patientFluidRemovalMlPerHour: 100,
  anticoagulationConcept: 'none',
  solutionProfileId: null,
  syntheticBagCapacityMl: null,
  syntheticBagStream: 'dialysate',
})

describe('learner prescription workbench model', () => {
  it('reuses source-backed math and keeps the requested output boundaries explicit', () => {
    const result = calculatePrescriptionWorkbench(VALID_INPUTS)

    expect(result.effluentPumpTargetMlPerHour).toBe(2_100)
    expect(result.effluentDoseMlPerKgHour).toBe(30)
    expect(result.plasmaFlowMlPerHour).toBe(4_200)
    expect(result.machinePatientFluidRemovalTermMlPerHour).toBe(100)
    expect(result.aggregateSourcePumpThroughputMlPerDay).toBe(48_000)
    expect(result.totalPredilutionFraction).toBe(0.5)
    expect(result.syntheticBagDuration).toBeNull()
    expect(result.unavailableOutputs.map((output) => output.id)).toEqual([
      'effective-clearance',
      'total-circuit-ultrafiltration',
      'quantitative-ff',
      'whole-patient-net-removal',
    ])
    expect(result.unavailableOutputs[1]?.sourceRecordIds).toEqual(['MATH-PM-004'])
    expect(result.unavailableOutputs[2]?.sourceRecordIds).toEqual(['MATH-PM-003', 'MATH-PM-006'])
    expect(result.unavailableOutputs[3]?.sourceRecordIds).toEqual(['FLUID-PM-001', 'FLUID-PM-002'])
    expect(result.sourceRecordIds).toEqual(
      expect.arrayContaining(['SYNTH-LAB-PRESCRIPTION-001', 'SYNTH-LAB-PREPOST-001']),
    )
  })

  it('calculates bag duration only from an explicitly synthetic capacity and selected active stream', () => {
    const available = calculatePrescriptionWorkbench({
      ...VALID_INPUTS,
      syntheticBagCapacityMl: 5_000,
    }).syntheticBagDuration

    expect(available).toMatchObject({
      status: 'available',
      stream: 'dialysate',
      capacityMl: 5_000,
      streamRateMlPerHour: 1_000,
      durationHours: 5,
    })
    expect(available?.limitation).toMatch(/teaching-only/i)

    const unavailable = calculatePrescriptionWorkbench({
      ...VALID_INPUTS,
      dialysateMlPerHour: 0,
      syntheticBagCapacityMl: 5_000,
    }).syntheticBagDuration

    expect(unavailable).toMatchObject({
      status: 'unavailable-zero-stream',
      durationHours: null,
      streamRateMlPerHour: 0,
    })
  })

  it('fails closed for unapproved anticoagulation and solution profiles', () => {
    expect(() =>
      calculatePrescriptionWorkbench({
        ...VALID_INPUTS,
        anticoagulationConcept: 'systemic' as never,
      }),
    ).toThrow(/must remain none/i)

    expect(() =>
      calculatePrescriptionWorkbench({
        ...VALID_INPUTS,
        solutionProfileId: 'local-solution' as never,
      }),
    ).toThrow(/must remain null/i)
  })

  it('rejects invalid patient and flow entries rather than normalizing them silently', () => {
    expect(() => calculatePrescriptionWorkbench({ ...VALID_INPUTS, simulatedWeightKg: 0 })).toThrow(
      /greater than zero/i,
    )
    expect(() =>
      calculatePrescriptionWorkbench({ ...VALID_INPUTS, hematocritPercent: 100 }),
    ).toThrow(/less than 100/i)
    expect(() =>
      calculatePrescriptionWorkbench({ ...VALID_INPUTS, dialysateMlPerHour: -1 }),
    ).toThrow(/zero or greater/i)
  })

  it('changes only transparent unitless and qualitative tendencies with the pre/post split', () => {
    expect(calculateQualitativePrePostDilution(600, 200)).toMatchObject({
      direction: 'pre-dominant',
      totalReplacementMlPerHour: 800,
      preReplacementShare: 0.75,
      postReplacementShare: 0.25,
      filterInletConcentrationSplitIndex: 0.25,
      filtrationFractionBurdenProxy: 'lower',
      effectiveClearanceTendencyProxy: 'lower',
      foulingTendencyProxy: 'lower',
      proxyStatus: 'authored-qualitative-proxy-source-limited',
    })
    expect(calculateQualitativePrePostDilution(200, 600)).toMatchObject({
      direction: 'post-dominant',
      filterInletConcentrationSplitIndex: 0.75,
      filtrationFractionBurdenProxy: 'higher',
      effectiveClearanceTendencyProxy: 'higher',
      foulingTendencyProxy: 'higher',
    })
    expect(calculateQualitativePrePostDilution(400, 400)).toMatchObject({
      direction: 'equal-split',
      filterInletConcentrationSplitIndex: 0.5,
      filtrationFractionBurdenProxy: 'middle',
    })
    expect(calculateQualitativePrePostDilution(0, 0)).toMatchObject({
      direction: 'not-active',
      filterInletConcentrationSplitIndex: null,
      filtrationFractionBurdenProxy: 'not-applicable',
    })
    expect(calculateQualitativePrePostDilution(600, 200).sourceRecordIds).toEqual([
      'REVIEW-CKRT-CORE-2025',
      'GUID-RRT-ICU-2026',
      'SYNTH-LAB-PREPOST-001',
    ])
    expect(calculateQualitativePrePostDilution(600, 200).omittedVariableCaveat).toMatch(
      /does not model blood flow.*PBP dilution.*anticoagulation/i,
    )
  })
})
