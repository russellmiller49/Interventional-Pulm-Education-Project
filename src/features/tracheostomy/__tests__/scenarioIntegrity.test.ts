import { validateScenario } from '@/features/skill-lab/engine/validateScenario'

import { tracheostomyReferences } from '../content/references'
import { tracheostomyScenarios } from '../content/scenarios'

describe('tracheostomy scenario integrity', () => {
  const referenceIds = new Set(tracheostomyReferences.map((reference) => reference.id))

  it('covers the four intended emergency patterns', () => {
    expect(tracheostomyScenarios.map((scenario) => scenario.id)).toEqual([
      'blocked-tracheostomy',
      'fresh-tracheostomy-dislodgement',
      'sentinel-tracheostomy-bleed',
      'speaking-valve-distress',
    ])
  })

  it('uses unique scenario ids', () => {
    const ids = tracheostomyScenarios.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(tracheostomyScenarios.map((scenario) => [scenario.id, scenario] as const))(
    'scenario "%s" is a valid graph with a reachable terminal',
    (_id, scenario) => {
      expect(validateScenario(scenario)).toEqual([])
      expect(scenario.nodes.some((node) => node.terminal)).toBe(true)
    },
  )

  it('resolves every terminal citation to the reference registry', () => {
    for (const scenario of tracheostomyScenarios) {
      for (const node of scenario.nodes) {
        if (!node.terminal) {
          continue
        }

        expect(node.terminal.referenceIds.length).toBeGreaterThan(0)
        for (const referenceId of node.terminal.referenceIds) {
          expect(referenceIds).toContain(referenceId)
        }
      }
    }
  })

  it('keeps the fresh-tract and speaking-valve hard stops explicit', () => {
    const freshDislodgement = tracheostomyScenarios.find(
      (scenario) => scenario.id === 'fresh-tracheostomy-dislodgement',
    )
    const speakingValve = tracheostomyScenarios.find(
      (scenario) => scenario.id === 'speaking-valve-distress',
    )

    expect(freshDislodgement?.briefing).toMatch(/7 days|first planned change/i)
    expect(
      freshDislodgement?.nodes
        .flatMap((node) => node.choices)
        .some((choice) => choice.isSafe && /avoid blind reinsertion/i.test(choice.label)),
    ).toBe(true)
    expect(
      speakingValve?.nodes
        .flatMap((node) => node.choices)
        .some(
          (choice) => choice.isSafe && /remove the speaking valve immediately/i.test(choice.label),
        ),
    ).toBe(true)
  })
})
