import { validateScenario } from '@/features/skill-lab/engine/validateScenario'

import { rigidBronchoscopyScenarios } from '../content/scenarios'

/**
 * Every Rigid Bronchoscopy decision scenario must be a well-formed graph:
 * choices resolve to real nodes or terminals, every terminal has a debrief, and
 * every node can reach a terminal.
 */
describe('rigid bronchoscopy scenario integrity', () => {
  it('has scenarios', () => {
    expect(rigidBronchoscopyScenarios.length).toBeGreaterThan(0)
  })

  it('has unique scenario ids', () => {
    const ids = rigidBronchoscopyScenarios.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(rigidBronchoscopyScenarios.map((scenario) => [scenario.id, scenario] as const))(
    'scenario "%s" is a valid graph with a reachable terminal',
    (_id, scenario) => {
      expect(validateScenario(scenario)).toEqual([])
      expect(scenario.nodes.some((node) => node.terminal)).toBe(true)
    },
  )
})
