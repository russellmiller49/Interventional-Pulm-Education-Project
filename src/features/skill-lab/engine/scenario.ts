/**
 * Pure state machine for the branching decision scenario.
 *
 * A scenario is a graph of nodes; each choice either points to another node or
 * terminates. These helpers advance the in-memory state — applying a choice's
 * simulated `vitalsDelta`, appending to the decision history, and moving to the
 * next node — with no React or timers. The countdown path (`timeoutScenario`)
 * selects the safest available choice so an expired timer models "the safest
 * default action was taken late" rather than freezing the drill.
 *
 * Kept pure so the `scenarioIntegrity` test can assert every node's choices
 * resolve to a real node or a terminal that carries a debrief.
 */

import type { DecisionScenario, ScenarioChoice, ScenarioNode, ScenarioState, Vitals } from './types'

/** Clamp simulated vitals to physiologically displayable bounds. */
function clampVitals(vitals: Vitals): Vitals {
  return {
    spo2: Math.max(0, Math.min(100, Math.round(vitals.spo2))),
    hr: Math.max(0, Math.min(260, Math.round(vitals.hr))),
    sbp: Math.max(0, Math.min(300, Math.round(vitals.sbp))),
  }
}

function applyDelta(vitals: Vitals, delta?: Partial<Vitals>): Vitals {
  if (!delta) {
    return vitals
  }
  return clampVitals({
    spo2: vitals.spo2 + (delta.spo2 ?? 0),
    hr: vitals.hr + (delta.hr ?? 0),
    sbp: vitals.sbp + (delta.sbp ?? 0),
  })
}

function findNode(scenario: DecisionScenario, nodeId: string): ScenarioNode | undefined {
  return scenario.nodes.find((node) => node.id === nodeId)
}

/** Fresh state at the scenario's start node with its initial vitals. */
export function initScenario(scenario: DecisionScenario): ScenarioState {
  const startNode = findNode(scenario, scenario.startNodeId)
  return {
    nodeId: scenario.startNodeId,
    vitals: clampVitals(scenario.initialVitals),
    history: [],
    finished: Boolean(startNode?.terminal),
  }
}

/**
 * Apply a choice: record it, move the simulated vitals, and advance the node.
 * A choice with `nextNodeId: null`, or one that lands on a terminal node,
 * finishes the scenario. Unknown node/choice ids return the state unchanged so
 * a stale click can never corrupt the run.
 */
export function advanceScenario(
  scenario: DecisionScenario,
  state: ScenarioState,
  choiceId: string,
): ScenarioState {
  if (state.finished) {
    return state
  }

  const node = findNode(scenario, state.nodeId)
  const choice = node?.choices.find((candidate) => candidate.id === choiceId)
  if (!node || !choice) {
    return state
  }

  const vitals = applyDelta(state.vitals, choice.vitalsDelta)
  const history = [...state.history, choice.id]

  if (choice.nextNodeId === null) {
    return { nodeId: state.nodeId, vitals, history, finished: true }
  }

  const nextNode = findNode(scenario, choice.nextNodeId)
  return {
    nodeId: choice.nextNodeId,
    vitals,
    history,
    finished: Boolean(nextNode?.terminal),
  }
}

/**
 * Pick the branch a lapsed timer should take: prefer a safe choice, and among
 * ties prefer the one whose simulated physiologic hit is smallest (so timeout
 * models the least-bad default, not a random branch).
 */
function worstCaseSafeChoice(node: ScenarioNode): ScenarioChoice | undefined {
  if (node.choices.length === 0) {
    return undefined
  }

  const severity = (choice: ScenarioChoice): number => {
    const delta = choice.vitalsDelta
    if (!delta) {
      return 0
    }
    // Larger drops in spo2/sbp and larger hr swings are "more severe".
    return Math.abs(delta.spo2 ?? 0) + Math.abs(delta.sbp ?? 0) + Math.abs(delta.hr ?? 0)
  }

  const ranked = [...node.choices].sort((a, b) => {
    if (a.isSafe !== b.isSafe) {
      return a.isSafe ? -1 : 1
    }
    return severity(a) - severity(b)
  })

  return ranked[0]
}

/**
 * Countdown-expiry path: apply the least-bad choice for the current node. If
 * the node has no choices (already terminal), the state is returned unchanged.
 */
export function timeoutScenario(scenario: DecisionScenario, state: ScenarioState): ScenarioState {
  if (state.finished) {
    return state
  }

  const node = findNode(scenario, state.nodeId)
  if (!node) {
    return state
  }

  const fallback = worstCaseSafeChoice(node)
  if (!fallback) {
    return { ...state, finished: true }
  }

  return advanceScenario(scenario, state, fallback.id)
}
