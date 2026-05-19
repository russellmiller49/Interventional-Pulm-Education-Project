import { evaluateScenarioAction } from '../engine/scenarioEngine'
import { troubleshootingScenarios } from '../scenarios/chestDrainageCases'

describe('chest drainage scenario engine', () => {
  it('scores safe, partial, and unsafe scenario actions distinctly', () => {
    const scenario = troubleshootingScenarios[0]

    expect(evaluateScenarioAction(scenario, 'assess-and-check-connections').score).toBe(2)
    expect(evaluateScenarioAction(scenario, 'increase-wall-suction').score).toBe(1)
    expect(evaluateScenarioAction(scenario, 'clamp-and-walk-away').score).toBe(0)
  })
})
