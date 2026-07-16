/**
 * Pure structural validator for a DecisionScenario graph.
 *
 * Returns a list of human-readable problems (empty array = valid). It checks
 * that the start node exists, node ids are unique, every terminal carries a
 * debrief, every non-terminal node offers at least one choice, every choice has
 * feedback and resolves to a real node or a terminal (null), every node is
 * reachable from the start, and every node can reach a terminal (no dead ends
 * or infinite loops). Used by the module `scenarioIntegrity` tests.
 */

import type { DecisionScenario } from './types'

const VALID_OUTCOMES = new Set(['rescued', 'harm', 'mixed'])

export function validateScenario(scenario: DecisionScenario): string[] {
  const problems: string[] = []
  const nodeIds = new Set(scenario.nodes.map((node) => node.id))

  if (nodeIds.size !== scenario.nodes.length) {
    problems.push(`${scenario.id}: duplicate node ids`)
  }
  if (!nodeIds.has(scenario.startNodeId)) {
    problems.push(`${scenario.id}: start node "${scenario.startNodeId}" does not exist`)
  }

  for (const node of scenario.nodes) {
    if (node.terminal) {
      if (!node.terminal.debrief?.trim()) {
        problems.push(`${scenario.id}/${node.id}: terminal missing debrief`)
      }
      if (!VALID_OUTCOMES.has(node.terminal.outcome)) {
        problems.push(
          `${scenario.id}/${node.id}: invalid terminal outcome "${node.terminal.outcome}"`,
        )
      }
    } else if (node.choices.length === 0) {
      problems.push(`${scenario.id}/${node.id}: non-terminal node has no choices`)
    }

    for (const choice of node.choices) {
      if (!choice.feedback?.trim()) {
        problems.push(`${scenario.id}/${node.id}/${choice.id}: choice missing feedback`)
      }
      if (choice.nextNodeId !== null && !nodeIds.has(choice.nextNodeId)) {
        problems.push(
          `${scenario.id}/${node.id}/${choice.id}: choice points to unknown node "${choice.nextNodeId}"`,
        )
      }
    }
  }

  // Reachability from the start node.
  const reachable = new Set<string>()
  const stack = [scenario.startNodeId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (reachable.has(id) || !nodeIds.has(id)) {
      continue
    }
    reachable.add(id)
    const node = scenario.nodes.find((candidate) => candidate.id === id)
    node?.choices.forEach((choice) => {
      if (choice.nextNodeId) {
        stack.push(choice.nextNodeId)
      }
    })
  }
  for (const node of scenario.nodes) {
    if (!reachable.has(node.id)) {
      problems.push(`${scenario.id}/${node.id}: node is unreachable from the start`)
    }
  }

  // Every node must be able to reach a terminal (no dead ends / trapping cycles).
  const canTerminate = new Map<string, boolean>()
  const visiting = new Set<string>()
  const reachesTerminal = (id: string): boolean => {
    if (canTerminate.has(id)) {
      return canTerminate.get(id) as boolean
    }
    const node = scenario.nodes.find((candidate) => candidate.id === id)
    if (!node) {
      return false
    }
    if (node.terminal) {
      canTerminate.set(id, true)
      return true
    }
    if (visiting.has(id)) {
      return false // cycle: this path does not itself terminate
    }
    visiting.add(id)
    let ok = false
    for (const choice of node.choices) {
      if (choice.nextNodeId === null || reachesTerminal(choice.nextNodeId)) {
        ok = true
        break
      }
    }
    visiting.delete(id)
    canTerminate.set(id, ok)
    return ok
  }
  for (const node of scenario.nodes) {
    if (!reachesTerminal(node.id)) {
      problems.push(`${scenario.id}/${node.id}: no path from this node reaches a terminal`)
    }
  }

  return problems
}
