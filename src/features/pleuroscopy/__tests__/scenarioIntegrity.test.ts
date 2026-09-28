import { validateScenario } from '@/features/skill-lab/engine/validateScenario'

import { pleuroscopyScenarios } from '../content/scenarios'

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
  return []
}

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

/**
 * The re-expansion scenario applied thoracentesis drainage-volume limits to
 * open-port thoracoscopy and was removed. These pins keep it, and the teaching
 * it carried, from returning without review.
 */
describe('pleuroscopy scenarios: removed drainage-volume teaching', () => {
  it('does not ship the re-expansion scenario', () => {
    expect(pleuroscopyScenarios.map((scenario) => scenario.id)).not.toContain('re-expansion-oedema')
  })

  it('keeps the three remaining scenarios', () => {
    expect(pleuroscopyScenarios.map((scenario) => scenario.id)).toEqual([
      'biopsy-site-bleeding',
      'prolonged-air-leak',
      'post-procedure-empyema',
    ])
  })

  it('teaches no drainage-volume limit in any scenario text', () => {
    const text = collectStrings(pleuroscopyScenarios).join('\n')
    expect(text).not.toMatch(/re-?expansion/i)
    expect(text).not.toMatch(/volume-limited/i)
    expect(text).not.toMatch(/\b(a|one) litre\b/i)
  })
})
