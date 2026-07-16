import { advancePatientFluidTolerance } from '../patientModel'
import { createSyntheticFixture } from '../testSupport/syntheticFixture'

describe('CRRT educational fluid-tolerance abstraction', () => {
  it('worsens only the bounded stress abstraction when removal exceeds supplied refill and reserve', () => {
    const patient = createSyntheticFixture().patient
    const tolerated = advancePatientFluidTolerance(
      patient,
      patient.vascularRefillCapacityMlHour,
      -80,
      {
        stressGainPerExcessRemovalLiter: 1,
        stressRecoveryPerHour: 0.1,
        reviewStatus: 'pending',
        sourceIds: ['TEST-P2-001'],
      },
      3600,
    )
    const excessive = advancePatientFluidTolerance(
      { ...patient, intravascularReserveMl: 0 },
      patient.vascularRefillCapacityMlHour + 1_000,
      -1_080,
      {
        stressGainPerExcessRemovalLiter: 1,
        stressRecoveryPerHour: 0.1,
        reviewStatus: 'pending',
        sourceIds: ['TEST-P2-001'],
      },
      3600,
    )
    expect(tolerated.hemodynamicStressIndex).toBe(0)
    expect(excessive.hemodynamicStressIndex).toBe(1)
    expect(excessive.meanArterialPressureMmHg).toBe(patient.meanArterialPressureMmHg)
  })

  it('does not invent a response when no reviewed model parameters are supplied', () => {
    const patient = createSyntheticFixture().patient
    const result = advancePatientFluidTolerance(patient, 10_000, -10_000, null, 3600)
    expect(result.hemodynamicStressIndex).toBe(patient.hemodynamicStressIndex)
  })
})
