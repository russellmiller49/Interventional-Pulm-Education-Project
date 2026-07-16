import { validateScenario } from '@/features/skill-lab/engine/validateScenario'

import { pleuroscopyScenarios } from '../content/scenarios'

/**
 * Every Pleuroscopy decision scenario must be a well-formed graph: choices
 * resolve to real nodes or terminals, every terminal has a debrief, and every
 * node can reach a terminal. (Mirrors the discipline of quizIntegrity.)
 */
describe('pleuroscopy scenario integrity', () => {
  it('has scenarios', () => {
    expect(pleuroscopyScenarios.length).toBeGreaterThan(0)
  })

  it('has unique scenario ids', () => {
    const ids = pleuroscopyScenarios.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(pleuroscopyScenarios.map((scenario) => [scenario.id, scenario] as const))(
    'scenario "%s" is a valid graph with a reachable terminal',
    (_id, scenario) => {
      expect(validateScenario(scenario)).toEqual([])
      expect(scenario.nodes.some((node) => node.terminal)).toBe(true)
    },
  )
})
