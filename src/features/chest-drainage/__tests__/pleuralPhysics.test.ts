import { defaultSimulationState } from '../engine/constants'
import {
  calculateEffectiveDrySuction,
  calculateExpiratoryAirExit,
  calculateTubeConductance,
  isSuctionIndicatorPresent,
} from '../engine/pleuralPhysics'
import type { SimulationState } from '../engine/types'

function makeState(overrides: Partial<SimulationState> = {}): SimulationState {
  return {
    ...defaultSimulationState,
    ...overrides,
    patient: {
      ...defaultSimulationState.patient,
      ...overrides.patient,
    },
    tube: {
      ...defaultSimulationState.tube,
      ...overrides.tube,
    },
    device: {
      ...defaultSimulationState.device,
      ...overrides.device,
    },
  }
}

describe('chest drainage pleural physics', () => {
  it('models the water seal as preventing return flow when pleural pressure is below seal depth', () => {
    const state = makeState({
      patient: {
        ...defaultSimulationState.patient,
        pleuralPressureCmH2O: 0,
        airLeakSeverity: 0,
      },
      device: {
        ...defaultSimulationState.device,
        waterSealDepthCm: 2,
      },
    })

    expect(calculateExpiratoryAirExit(state)).toBe(0)
  })

  it('reduces expiratory air exit as water seal depth increases', () => {
    const shallowSeal = makeState({
      patient: {
        ...defaultSimulationState.patient,
        pleuralPressureCmH2O: 8,
      },
      device: {
        ...defaultSimulationState.device,
        waterSealDepthCm: 1,
      },
    })
    const deeperSeal = makeState({
      patient: {
        ...defaultSimulationState.patient,
        pleuralPressureCmH2O: 8,
      },
      device: {
        ...defaultSimulationState.device,
        waterSealDepthCm: 5,
      },
    })

    expect(calculateExpiratoryAirExit(deeperSeal)).toBeLessThan(
      calculateExpiratoryAirExit(shallowSeal),
    )
  })

  it('stops tube conductance and pressure-driven air exit when the tube is clamped', () => {
    const clamped = makeState({
      patient: {
        ...defaultSimulationState.patient,
        pleuralPressureCmH2O: 10,
      },
      tube: {
        ...defaultSimulationState.tube,
        clamped: true,
      },
    })

    expect(calculateTubeConductance(clamped)).toBe(0)
    expect(calculateExpiratoryAirExit(clamped)).toBe(0)
  })

  it('bounds dry suction target by available source capacity', () => {
    const weakSource = calculateEffectiveDrySuction(-40, 4, 1)
    const strongSource = calculateEffectiveDrySuction(-40, 20, 1)

    expect(Math.abs(weakSource)).toBeLessThan(40)
    expect(Math.abs(strongSource)).toBe(40)
  })

  it('does not confirm dry suction source below the modeled 16 L/min floor', () => {
    const state = makeState({
      device: {
        ...defaultSimulationState.device,
        suctionSettingCmH2O: -20,
        sourceSuctionFlowLpm: 7,
      },
    })

    expect(isSuctionIndicatorPresent(state)).toBe(false)
  })

  it('confirms dry suction source at the modeled 16 L/min floor', () => {
    const state = makeState({
      device: {
        ...defaultSimulationState.device,
        suctionSettingCmH2O: -20,
        sourceSuctionFlowLpm: 16,
      },
    })

    expect(isSuctionIndicatorPresent(state)).toBe(true)
  })
})
